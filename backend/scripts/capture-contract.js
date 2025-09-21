#!/usr/bin/env node
/**
 * Contract capture harness.
 *
 * Records the current API's observable behaviour so a rewrite can be checked
 * against it. The legacy implementation has no tests, so this recording is the
 * only oracle for "did behaviour change?".
 *
 * Run against a disposable database:
 *   MONGODB_URI=mongodb://localhost:27017/srms_contract node scripts/capture-contract.js
 *
 * Writes .planning/contract/API-CONTRACT.json (full detail) and
 * .planning/contract/API-CONTRACT.md (reviewable summary).
 */

const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const OUT_DIR = path.resolve(__dirname, '../../.planning/contract');

const ACCOUNTS = {
  staff: { email: 'staff@bankofabyssinia.com', password: 'staff123' },
  supervisor: { email: 'supervisor@bankofabyssinia.com', password: 'supervisor123' },
  manager: { email: 'manager@bankofabyssinia.com', password: 'manager123' },
};

const tokens = {};
const records = [];

/** Replace values that change between runs so diffs stay meaningful. */
function normalise(value) {
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '_id' || k === 'id') out[k] = '<objectid>';
      else if (k === 'token') out[k] = '<jwt>';
      else if (k === 'password') out[k] = '<hash>';
      else if (/^\d{13}-/.test(String(v))) out[k] = '<upload-filename>';
      else if (/At$|Date$|^createdAt$|^updatedAt$/.test(k)) out[k] = '<timestamp>';
      else out[k] = normalise(v);
    }
    return out;
  }
  if (typeof value === 'string') {
    if (/^[0-9a-f]{24}$/.test(value)) return '<objectid>';
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return '<timestamp>';
    if (/^\d{13}-/.test(value)) return '<upload-filename>';
  }
  return value;
}

/** Describe a response body by shape rather than content. */
function shapeOf(value, depth = 0) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array<empty>';
    return `array<${shapeOf(value[0], depth + 1)}>`;
  }
  if (typeof value === 'object') {
    if (depth > 2) return 'object';
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${k}:${shapeOf(value[k], depth + 1)}`).join(', ')}}`;
  }
  return typeof value;
}

async function call(label, method, endpointPath, { role, body, form, expect } = {}) {
  const headers = {};
  if (role) headers.Authorization = `Bearer ${tokens[role]}`;

  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  let parsed;
  let raw = '';
  try {
    res = await fetch(`${BASE}${endpointPath}`, { method, headers, body: payload });
    raw = await res.text();
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
    }
  } catch (err) {
    records.push({
      label, method, path: endpointPath, role: role || null,
      error: `request failed: ${err.message}`,
    });
    return { status: 0, body: null };
  }

  records.push({
    label,
    method,
    path: endpointPath,
    role: role || null,
    requestBody: body !== undefined ? normalise(body) : form ? '<multipart>' : null,
    status: res.status,
    contentType: res.headers.get('content-type'),
    responseShape: shapeOf(parsed),
    responseSample: normalise(parsed),
    expected: expect ?? null,
    matchedExpectation: expect === undefined ? null : res.status === expect,
  });

  return { status: res.status, body: parsed };
}

async function login(role) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ACCOUNTS[role]),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`login failed for ${role}: ${JSON.stringify(data)}`);
  tokens[role] = data.token;
}

/** A template exercising every field type the schema allows. */
const TEMPLATE = {
  name: 'Contract Capture Weekly Report',
  description: 'Exercises every field type and validator supported by the schema.',
  category: 'weekly',
  fields: [
    { name: 'summary', type: 'text', label: 'Summary', required: true, order: 1,
      validators: { minLength: 3, maxLength: 200 } },
    { name: 'incidentCount', type: 'number', label: 'Incident count', required: true, order: 2,
      validators: { min: 0, max: 999 } },
    { name: 'periodStart', type: 'date', label: 'Period start', required: true, order: 3 },
    { name: 'severity', type: 'select', label: 'Severity', required: true, order: 4,
      options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }] },
    { name: 'acknowledged', type: 'checkbox', label: 'Acknowledged', order: 5 },
    { name: 'notes', type: 'textarea', label: 'Notes', order: 6,
      validators: { maxLength: 2000 } },
    { name: 'backupVerified', type: 'yesno', label: 'Backup verified', required: true, order: 7 },
    { name: 'attachment', type: 'file', label: 'Attachment', order: 8 },
  ],
};

const DATABASE_RECORD = {
  database: 'ContractCaptureDB',
  databaseType: 'PostgreSQL',
  ipAddress: '10.0.0.42',
  dbVersion: '16.1',
  osVersion: 'Ubuntu 24.04',
  customFeatures: [
    { name: 'replicaCount', type: 'number', label: 'Replica count', required: true },
    { name: 'tier', type: 'enum', label: 'Tier', enumOptions: ['gold', 'silver'], required: false },
  ],
};

async function main() {
  console.log('Logging in as all three roles…');
  for (const role of Object.keys(ACCOUNTS)) await login(role);

  console.log('Capturing auth surface…');
  await call('health', 'GET', '/health', { expect: 200 });
  await call('login (valid)', 'POST', '/auth/login', { body: ACCOUNTS.staff, expect: 200 });
  await call('login (wrong password)', 'POST', '/auth/login',
    { body: { email: ACCOUNTS.staff.email, password: 'wrong' }, expect: 400 });
  await call('login (unknown user)', 'POST', '/auth/login',
    { body: { email: 'nobody@bankofabyssinia.com', password: 'x' }, expect: 400 });
  await call('login (missing fields)', 'POST', '/auth/login', { body: {}, expect: 400 });
  await call('register (non-BOA email)', 'POST', '/auth/register', {
    body: { firstName: 'A', lastName: 'B', userId: 'X1', email: 'a@gmail.com', password: 'pw123456' },
    expect: 400,
  });
  await call('register (pending approval)', 'POST', '/auth/register', {
    body: {
      firstName: 'Contract', lastName: 'Probe', userId: `CP${Date.now() % 100000}`,
      email: `contract.probe.${Date.now() % 100000}@bankofabyssinia.com`,
      password: 'probe123', role: 'staff', department: 'IT', phoneNumber: '+251900000000',
    },
    expect: 201,
  });
  await call('profile', 'GET', '/auth/profile', { role: 'staff', expect: 200 });
  await call('profile (no token)', 'GET', '/auth/profile', { expect: 401 });
  await call('staff list (supervisor)', 'GET', '/auth/staff', { role: 'supervisor', expect: 200 });
  await call('staff list (staff denied)', 'GET', '/auth/staff', { role: 'staff', expect: 403 });
  await call('all users (manager)', 'GET', '/auth/all-users', { role: 'manager', expect: 200 });
  await call('all users (staff denied)', 'GET', '/auth/all-users', { role: 'staff', expect: 403 });
  await call('pending registrations', 'GET', '/auth/pending-registrations', { role: 'manager', expect: 200 });
  await call('pending registrations (staff denied)', 'GET', '/auth/pending-registrations',
    { role: 'staff', expect: 403 });

  console.log('Capturing templates…');
  const created = await call('create template', 'POST', '/api/templates',
    { role: 'manager', body: TEMPLATE, expect: 201 });
  const templateId = created.body && (created.body._id || (created.body.template && created.body.template._id));
  await call('create template (staff denied)', 'POST', '/api/templates',
    { role: 'staff', body: TEMPLATE, expect: 403 });
  await call('list templates', 'GET', '/api/templates', { role: 'manager', expect: 200 });
  await call('available templates', 'GET', '/api/templates/available', { role: 'staff', expect: 200 });
  if (templateId) {
    await call('template schema', 'GET', `/api/templates/${templateId}/schema`, { role: 'staff', expect: 200 });
    await call('update template', 'PUT', `/api/templates/${templateId}`, {
      role: 'manager',
      body: { ...TEMPLATE, description: 'Updated during contract capture.' },
      expect: 200,
    });
  }
  await call('template schema (bad id)', 'GET', '/api/templates/000000000000000000000000/schema',
    { role: 'staff', expect: 404 });

  console.log('Capturing databases…');
  const db = await call('create database', 'POST', '/databases',
    { role: 'manager', body: DATABASE_RECORD, expect: 201 });
  const dbId = db.body && (db.body._id || (db.body.database && db.body.database._id));
  await call('create database (staff denied)', 'POST', '/databases',
    { role: 'staff', body: DATABASE_RECORD, expect: 403 });
  await call('list databases', 'GET', '/databases', { role: 'staff', expect: 200 });
  await call('list all databases', 'GET', '/databases/all', { role: 'manager', expect: 200 });
  if (dbId) {
    await call('get database', 'GET', `/databases/${dbId}`, { role: 'manager', expect: 200 });
    await call('update database', 'PUT', `/databases/${dbId}`,
      { role: 'manager', body: { ...DATABASE_RECORD, dbVersion: '16.2' }, expect: 200 });
  }

  console.log('Capturing report lifecycle…');
  let reportId = null;
  if (templateId) {
    const form = new FormData();
    form.append('templateId', templateId);
    form.append('templateVersion', '1');
    form.append('templateData', JSON.stringify({
      summary: 'Weekly database health check completed.',
      incidentCount: 2,
      periodStart: '2025-09-15',
      severity: 'low',
      acknowledged: true,
      notes: 'No action required.',
      backupVerified: 'yes',
    }));
    form.append('files', new Blob([Buffer.from('contract capture attachment')],
      { type: 'text/plain' }), 'evidence.txt');

    const submitted = await call('submit report (multipart)', 'POST', '/reports',
      { role: 'staff', form, expect: 201 });
    reportId = submitted.body && (submitted.body._id || (submitted.body.report && submitted.body.report._id));
  }

  await call('list reports (staff scope)', 'GET', '/reports', { role: 'staff', expect: 200 });
  await call('list reports (manager scope)', 'GET', '/reports', { role: 'manager', expect: 200 });
  await call('list reports paginated', 'GET', '/reports?page=1&limit=5', { role: 'manager', expect: 200 });
  await call('reports by week', 'GET', '/reports/week/38', { role: 'manager', expect: 200 });
  await call('reports by date range', 'GET', '/reports/date-range?startDate=2025-01-01&endDate=2026-12-31',
    { role: 'manager', expect: 200 });
  await call('weekly summary', 'GET', '/reports/weekly-summary', { role: 'manager', expect: 200 });
  await call('export reports (json)', 'GET', '/reports/export?format=json', { role: 'manager', expect: 200 });
  await call('reports by database name', 'GET', '/reports/database/ContractCaptureDB',
    { role: 'manager', expect: 200 });

  if (reportId) {
    await call('get report', 'GET', `/reports/${reportId}`, { role: 'staff', expect: 200 });
    await call('review report (reject)', 'PUT', `/reports/${reportId}/review`, {
      role: 'supervisor',
      body: { reviewStatus: 'rejected', reviewComments: 'Needs the incident log attached.',
              rejectionReason: 'Missing incident log' },
      expect: 200,
    });
    await call('review report (staff denied)', 'PUT', `/reports/${reportId}/review`,
      { role: 'staff', body: { reviewStatus: 'approved' }, expect: 403 });
  }

  console.log('Capturing traversal defences…');
  for (const attack of ['..%2F.env', '..%2F..%2F..%2Fetc%2Fpasswd', '%2e%2e%2f.env']) {
    await call(`download traversal ${attack}`, 'GET', `/reports/download/${attack}`,
      { role: 'staff', expect: 400 });
    await call(`download traversal ${attack} (manager)`, 'GET', `/reports/download/${attack}`,
      { role: 'manager', expect: 400 });
  }
  await call('download unowned file', 'GET', '/reports/download/does-not-exist.png',
    { role: 'manager', expect: 403 });

  console.log('Capturing analytics…');
  await call('analytics dashboard', 'GET', '/analytics/dashboard', { role: 'manager', expect: 200 });
  await call('analytics dashboard (staff denied)', 'GET', '/analytics/dashboard',
    { role: 'staff', expect: 403 });
  await call('staff performance', 'GET', '/analytics/staff-performance', { role: 'manager', expect: 200 });
  await call('database performance', 'GET', '/analytics/database-performance',
    { role: 'manager', expect: 200 });

  // Destructive operations last so earlier captures see populated data.
  console.log('Capturing destructive operations…');
  if (reportId) {
    await call('delete report (staff denied)', 'DELETE', `/reports/${reportId}`,
      { role: 'staff', expect: 403 });
    await call('delete report', 'DELETE', `/reports/${reportId}`, { role: 'manager', expect: 200 });
  }
  if (dbId) {
    await call('delete database', 'DELETE', `/databases/${dbId}`, { role: 'manager', expect: 200 });
    await call('reactivate database', 'PUT', `/databases/${dbId}/reactivate`,
      { role: 'manager', expect: 200 });
  }
  if (templateId) {
    await call('delete template', 'DELETE', `/api/templates/${templateId}`,
      { role: 'manager', expect: 200 });
  }

  writeOutputs();
}

function writeOutputs() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const mismatches = records.filter((r) => r.matchedExpectation === false);
  const errors = records.filter((r) => r.error);

  fs.writeFileSync(
    path.join(OUT_DIR, 'API-CONTRACT.json'),
    JSON.stringify({ capturedAgainst: BASE, endpointCount: records.length, records }, null, 2)
  );

  const lines = [
    '# API Contract — captured behaviour of the legacy implementation',
    '',
    'Generated by `backend/scripts/capture-contract.js`. This records what the',
    'current API actually does, so the rewrite can be checked against observed',
    'behaviour rather than assumptions. The legacy code has no tests, so this is',
    'the only parity oracle available.',
    '',
    'Object ids, timestamps, JWTs, and upload filenames are replaced with',
    'placeholders so repeat runs diff cleanly.',
    '',
    `**Calls recorded:** ${records.length}`,
    `**Status mismatches vs expectation:** ${mismatches.length}`,
    `**Request errors:** ${errors.length}`,
    '',
    '## Status summary',
    '',
    '| # | method | path | role | status | expected | match |',
    '|---|---|---|---|---|---|---|',
  ];

  records.forEach((r, i) => {
    const match = r.matchedExpectation === null ? '—' : r.matchedExpectation ? 'yes' : '**NO**';
    lines.push(`| ${i + 1} | ${r.method} | \`${r.path}\` | ${r.role || '—'} | ${r.status ?? 'ERR'} | ${r.expected ?? '—'} | ${match} |`);
  });

  if (mismatches.length) {
    lines.push('', '## Status mismatches', '',
      'Each of these is a place where the API does something other than expected.',
      'Decide per item whether the rewrite should preserve or correct it.', '');
    for (const m of mismatches) {
      lines.push(`### ${m.method} \`${m.path}\` as ${m.role || 'anonymous'}`, '',
        `- expected \`${m.expected}\`, got \`${m.status}\``,
        `- response: \`${JSON.stringify(m.responseSample).slice(0, 300)}\``, '');
    }
  }

  lines.push('', '## Response shapes', '');
  for (const r of records) {
    if (r.error) continue;
    lines.push(`### ${r.method} \`${r.path}\`${r.role ? ` — ${r.role}` : ''}`, '',
      `- status: \`${r.status}\``,
      `- content-type: \`${r.contentType || 'none'}\``,
      `- shape: \`${r.responseShape}\``, '');
  }

  fs.writeFileSync(path.join(OUT_DIR, 'API-CONTRACT.md'), `${lines.join('\n')}\n`);

  console.log(`\nRecorded ${records.length} calls.`);
  console.log(`Mismatches: ${mismatches.length}, request errors: ${errors.length}`);
  console.log(`Written to ${OUT_DIR}`);
  if (mismatches.length) {
    console.log('\nMismatches:');
    for (const m of mismatches) {
      console.log(`  ${m.method} ${m.path} [${m.role || 'anon'}] expected ${m.expected}, got ${m.status}`);
    }
  }
}

main().catch((err) => {
  console.error('Capture failed:', err.message);
  writeOutputs();
  process.exit(1);
});
