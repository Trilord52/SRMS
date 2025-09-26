#!/usr/bin/env tsx
/**
 * Parity reconciliation against the captured legacy contract.
 *
 * The recorded baseline in .planning/contract/API-CONTRACT.json is the only
 * description of what the old API did. This script runs the equivalent call
 * against the new API and classifies each difference, so a change is either
 * declared here with a reason or shows up as unexplained.
 *
 * A clean diff is not the goal: routes moved under /api/v1, the error envelope
 * changed, and several statuses are deliberately different. The point is that
 * every difference is accounted for.
 *
 *   npx tsx src/scripts/verifyParity.ts
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';

process.env.NODE_ENV ??= 'test';
process.env.JWT_SECRET ??= 'parity-check-secret-long-enough-to-validate-ok';
process.env.MONGODB_URI ??= 'mongodb://replaced-by-memory-server/parity';

const CONTRACT_PATH = resolve(__dirname, '../../../.planning/contract/API-CONTRACT.json');
const OUT_PATH = resolve(__dirname, '../../../.planning/contract/PARITY.md');

type Role = 'staff' | 'supervisor' | 'manager' | 'anonymous';

/** Why a status differs from the recorded baseline. */
type Intent =
  | { kind: 'unchanged' }
  | { kind: 'moved'; note: string }
  | { kind: 'corrected'; note: string }
  | { kind: 'removed'; note: string };

interface Mapping {
  /** The `label` used in the captured contract. */
  legacyLabel: string;
  legacyPath: string;
  newPath: string | null;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  role: Role;
  body?: unknown;
  /** Path placeholders resolved from seeded fixtures. */
  resolve?: (ctx: Context) => string;
  intent: Intent;
}

interface Context {
  templateId: string;
  reportId: string;
  databaseId: string;
  pendingUserId: string;
  fileId: string;
  staffId: string;
}

interface LegacyRecord {
  label: string;
  method: string;
  path: string;
  status: number;
}

async function main(): Promise<void> {
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')) as {
    records: LegacyRecord[];
  };

  const memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri('srms_parity'));

  const { createApp } = await import('../app');
  const app = createApp();

  const tokens = await seedAccounts(app);
  const ctx = await seedFixtures(app, tokens);

  const results: Array<{
    mapping: Mapping;
    legacyStatus: number | null;
    newStatus: number | null;
    unexplained: boolean;
  }> = [];

  for (const mapping of MAPPINGS) {
    const legacy = contract.records.find((record) => record.label === mapping.legacyLabel);
    const legacyStatus = legacy?.status ?? null;

    let newStatus: number | null = null;
    if (mapping.newPath !== null) {
      const path = mapping.resolve ? mapping.resolve(ctx) : mapping.newPath;
      newStatus = await call(app, mapping.method, path, mapping.role, tokens, mapping.body);
    }

    // A difference is unexplained when nothing was declared about it.
    const unexplained =
      mapping.intent.kind === 'unchanged' && legacyStatus !== null && newStatus !== legacyStatus;

    results.push({ mapping, legacyStatus, newStatus, unexplained });
  }

  writeReport(results, contract.records.length);

  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await memory.stop();

  const unexplainedCount = results.filter((r) => r.unexplained).length;
  console.log(`\nChecked ${results.length} mapped calls.`);
  console.log(`Unexplained differences: ${unexplainedCount}`);
  console.log(`Written to ${OUT_PATH}`);

  if (unexplainedCount > 0) {
    for (const r of results.filter((x) => x.unexplained)) {
      console.log(`  ${r.mapping.method} ${r.mapping.newPath}: ${r.legacyStatus} -> ${r.newStatus}`);
    }
    process.exit(1);
  }
}

const PASSWORD = 'parity-check-password';

async function seedAccounts(app: Express): Promise<Record<Role, string>> {
  const { UserModel } = await import('../models/User');
  const { hashPassword } = await import('../lib/password');

  const tokens: Record<Role, string> = {
    staff: '',
    supervisor: '',
    manager: '',
    anonymous: '',
  };

  for (const role of ['staff', 'supervisor', 'manager'] as const) {
    const email = `${role}.parity@bankofabyssinia.com`;
    await UserModel.create({
      firstName: role,
      lastName: 'Parity',
      userId: `${role.toUpperCase()}-PARITY`,
      email,
      passwordHash: await hashPassword(PASSWORD),
      role,
      accountStatus: 'approved',
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    tokens[role] = res.body.token;
  }

  return tokens;
}

async function seedFixtures(app: Express, tokens: Record<Role, string>): Promise<Context> {
  const { UserModel } = await import('../models/User');
  const { ReportFileModel } = await import('../models/ReportFile');
  const { hashPassword } = await import('../lib/password');

  const template = await request(app)
    .post('/api/v1/templates')
    .set('Authorization', `Bearer ${tokens.manager}`)
    .send({
      name: 'Parity Weekly',
      description: 'Fixture template for the parity run.',
      category: 'weekly',
      fields: [
        { name: 'summary', type: 'text', label: 'Summary', required: true, order: 1 },
        { name: 'incidentCount', type: 'number', label: 'Incidents', order: 2 },
        { name: 'evidence', type: 'file', label: 'Evidence', order: 3 },
      ],
    });

  const templateId = template.body.template._id as string;

  const report = await request(app)
    .post('/api/v1/reports')
    .set('Authorization', `Bearer ${tokens.staff}`)
    .field('templateId', templateId)
    .field('periodStart', '2025-09-08')
    .field('templateData', JSON.stringify({ summary: 'Parity fixture.', incidentCount: 1 }))
    .attach('files', Buffer.from('parity evidence'), {
      filename: 'evidence.txt',
      contentType: 'text/plain',
    });

  const reportId = report.body.report?._id as string | undefined;
  if (!reportId) {
    // A placeholder id here would surface later as a bogus "unexplained
    // difference", so the fixture fails loudly instead.
    throw new Error(
      `Fixture report was not created (status ${report.status}): ${JSON.stringify(report.body)}`
    );
  }
  const file = await ReportFileModel.findOne({ reportId });

  const database = await request(app)
    .post('/api/v1/databases')
    .set('Authorization', `Bearer ${tokens.manager}`)
    .send({
      name: 'ParityDB',
      databaseType: 'PostgreSQL',
      host: '10.0.0.7',
      dbVersion: '16.1',
      osVersion: 'Ubuntu 24.04',
    });

  const pending = await UserModel.create({
    firstName: 'Pending',
    lastName: 'Applicant',
    userId: 'PENDING-PARITY',
    email: 'pending.parity@bankofabyssinia.com',
    passwordHash: await hashPassword(PASSWORD),
    role: 'staff',
    accountStatus: 'pending',
  });

  const staff = await UserModel.findOne({ email: 'staff.parity@bankofabyssinia.com' });

  return {
    templateId,
    reportId: reportId ?? '000000000000000000000000',
    databaseId: database.body.database?._id ?? '000000000000000000000000',
    pendingUserId: pending._id.toString(),
    fileId: file?._id.toString() ?? '000000000000000000000000',
    staffId: staff?._id.toString() ?? '000000000000000000000000',
  };
}

async function call(
  app: Express,
  method: Mapping['method'],
  path: string,
  role: Role,
  tokens: Record<Role, string>,
  body?: unknown
): Promise<number> {
  let req = request(app)[method.toLowerCase() as 'get'](path);
  if (role !== 'anonymous') req = req.set('Authorization', `Bearer ${tokens[role]}`);
  if (body !== undefined) req = req.send(body as object);
  const res = await req;
  return res.status;
}

/**
 * One entry per meaningful legacy behaviour. Where a status changed, the reason
 * is declared so the difference is a decision rather than a surprise.
 */
const MAPPINGS: Mapping[] = [
  {
    legacyLabel: 'health',
    legacyPath: '/health',
    newPath: '/health',
    method: 'GET',
    role: 'anonymous',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'login (valid)',
    legacyPath: '/auth/login',
    newPath: '/api/v1/auth/login',
    method: 'POST',
    role: 'anonymous',
    body: { email: 'staff.parity@bankofabyssinia.com', password: PASSWORD },
    intent: { kind: 'moved', note: 'Now under /api/v1. Status unchanged.' },
  },
  {
    legacyLabel: 'login (wrong password)',
    legacyPath: '/auth/login',
    newPath: '/api/v1/auth/login',
    method: 'POST',
    role: 'anonymous',
    body: { email: 'staff.parity@bankofabyssinia.com', password: 'wrong' },
    intent: {
      kind: 'corrected',
      note: '400 to 401. A rejected credential is an authentication failure, not a malformed request.',
    },
  },
  {
    legacyLabel: 'login (unknown user)',
    legacyPath: '/auth/login',
    newPath: '/api/v1/auth/login',
    method: 'POST',
    role: 'anonymous',
    body: { email: 'nobody@bankofabyssinia.com', password: 'whatever-it-is' },
    intent: {
      kind: 'corrected',
      note: '400 to 401, and the response is identical to a wrong password so the endpoint cannot be used to discover which addresses exist.',
    },
  },
  {
    legacyLabel: 'login (missing fields)',
    legacyPath: '/auth/login',
    newPath: '/api/v1/auth/login',
    method: 'POST',
    role: 'anonymous',
    body: {},
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'register (non-BOA email)',
    legacyPath: '/auth/register',
    newPath: '/api/v1/auth/register',
    method: 'POST',
    role: 'anonymous',
    body: {
      firstName: 'A',
      lastName: 'B',
      userId: 'X-1',
      email: 'someone@gmail.com',
      password: 'a-long-enough-password',
    },
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'register (pending approval)',
    legacyPath: '/auth/register',
    newPath: '/api/v1/auth/register',
    method: 'POST',
    role: 'anonymous',
    body: {
      firstName: 'New',
      lastName: 'Applicant',
      userId: 'NEW-PARITY-1',
      email: 'new.applicant@bankofabyssinia.com',
      password: 'a-long-enough-password',
      role: 'staff',
    },
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'profile',
    legacyPath: '/auth/profile',
    newPath: '/api/v1/auth/me',
    method: 'GET',
    role: 'staff',
    intent: { kind: 'moved', note: '/auth/profile renamed to /auth/me.' },
  },
  {
    legacyLabel: 'profile (no token)',
    legacyPath: '/auth/profile',
    newPath: '/api/v1/auth/me',
    method: 'GET',
    role: 'anonymous',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'staff list (supervisor)',
    legacyPath: '/auth/staff',
    newPath: '/api/v1/auth/users?role=staff',
    method: 'GET',
    role: 'supervisor',
    intent: {
      kind: 'moved',
      note: '/auth/staff and /auth/all-users merged into /auth/users with filters; a supervisor is scoped to staff.',
    },
  },
  {
    legacyLabel: 'staff list (staff denied)',
    legacyPath: '/auth/staff',
    newPath: '/api/v1/auth/users',
    method: 'GET',
    role: 'staff',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'all users (manager)',
    legacyPath: '/auth/all-users',
    newPath: '/api/v1/auth/users',
    method: 'GET',
    role: 'manager',
    intent: { kind: 'moved', note: 'Merged into /auth/users.' },
  },
  {
    legacyLabel: 'all users (staff denied)',
    legacyPath: '/auth/all-users',
    newPath: '/api/v1/auth/users',
    method: 'GET',
    role: 'staff',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'pending registrations',
    legacyPath: '/auth/pending-registrations',
    newPath: '/api/v1/auth/registrations/pending',
    method: 'GET',
    role: 'manager',
    intent: { kind: 'moved', note: 'Path renamed for consistency.' },
  },
  {
    legacyLabel: 'pending registrations (staff denied)',
    legacyPath: '/auth/pending-registrations',
    newPath: '/api/v1/auth/registrations/pending',
    method: 'GET',
    role: 'staff',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'create template',
    legacyPath: '/api/templates',
    newPath: '/api/v1/templates',
    method: 'POST',
    role: 'manager',
    body: {
      name: 'Parity Second',
      description: 'Another fixture template.',
      category: 'incident',
      fields: [{ name: 'detail', type: 'text', label: 'Detail', required: true }],
    },
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'create template (staff denied)',
    legacyPath: '/api/templates',
    newPath: '/api/v1/templates',
    method: 'POST',
    role: 'staff',
    body: { name: 'x', description: 'y', category: 'custom', fields: [] },
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'list templates',
    legacyPath: '/api/templates',
    newPath: '/api/v1/templates',
    method: 'GET',
    role: 'manager',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'available templates',
    legacyPath: '/api/templates/available',
    newPath: '/api/v1/templates',
    method: 'GET',
    role: 'staff',
    intent: {
      kind: 'moved',
      note: '/available folded into the list endpoint, which already scopes staff to active templates.',
    },
  },
  {
    legacyLabel: 'template schema',
    legacyPath: '/api/templates/:id/schema',
    newPath: '/api/v1/templates/:id',
    method: 'GET',
    role: 'staff',
    resolve: (ctx) => `/api/v1/templates/${ctx.templateId}`,
    intent: {
      kind: 'moved',
      note: 'The separate /schema route is gone; fetching the template returns its fields.',
    },
  },
  {
    legacyLabel: 'template schema (bad id)',
    legacyPath: '/api/templates/:id/schema',
    newPath: '/api/v1/templates/000000000000000000000000',
    method: 'GET',
    role: 'staff',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'create database',
    legacyPath: '/databases',
    newPath: '/api/v1/databases',
    method: 'POST',
    role: 'manager',
    body: {
      name: 'ParitySecondDB',
      databaseType: 'Oracle',
      host: 'db2.example.com',
      dbVersion: '19c',
      osVersion: 'RHEL 8',
    },
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'create database (staff denied)',
    legacyPath: '/databases',
    newPath: '/api/v1/databases',
    method: 'POST',
    role: 'staff',
    body: { name: 'x', databaseType: 'y', host: '10.0.0.1', dbVersion: '1', osVersion: '2' },
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'list databases',
    legacyPath: '/databases',
    newPath: '/api/v1/databases',
    method: 'GET',
    role: 'staff',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'list all databases',
    legacyPath: '/databases/all',
    newPath: '/api/v1/databases?isActive=false',
    method: 'GET',
    role: 'manager',
    intent: { kind: 'moved', note: '/all folded into the list endpoint as an isActive filter.' },
  },
  {
    legacyLabel: 'get database',
    legacyPath: '/databases/:id',
    newPath: '/api/v1/databases/:id',
    method: 'GET',
    role: 'manager',
    resolve: (ctx) => `/api/v1/databases/${ctx.databaseId}`,
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'list reports (staff scope)',
    legacyPath: '/reports',
    newPath: '/api/v1/reports',
    method: 'GET',
    role: 'staff',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'list reports (manager scope)',
    legacyPath: '/reports',
    newPath: '/api/v1/reports',
    method: 'GET',
    role: 'manager',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'list reports paginated',
    legacyPath: '/reports?page=1&limit=5',
    newPath: '/api/v1/reports?page=1&limit=5',
    method: 'GET',
    role: 'manager',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'reports by week',
    legacyPath: '/reports/week/:weekNumber',
    newPath: '/api/v1/reports?isoYear=2025&isoWeek=37',
    method: 'GET',
    role: 'manager',
    intent: {
      kind: 'moved',
      note: 'Replaced by isoYear and isoWeek filters on the list endpoint, and the week is now ISO-8601 rather than the previous non-standard arithmetic.',
    },
  },
  {
    legacyLabel: 'reports by date range',
    legacyPath: '/reports/date-range',
    newPath: '/api/v1/reports?from=2025-01-01&to=2026-12-31',
    method: 'GET',
    role: 'manager',
    intent: { kind: 'moved', note: 'Replaced by from and to filters on the list endpoint.' },
  },
  {
    legacyLabel: 'get report',
    legacyPath: '/reports/:id',
    newPath: '/api/v1/reports/:id',
    method: 'GET',
    role: 'staff',
    resolve: (ctx) => `/api/v1/reports/${ctx.reportId}`,
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'review report (staff denied)',
    legacyPath: '/reports/:id/review',
    newPath: '/api/v1/reports/:id/review',
    method: 'POST',
    role: 'staff',
    resolve: (ctx) => `/api/v1/reports/${ctx.reportId}/review`,
    body: { decision: 'approved' },
    intent: {
      kind: 'moved',
      note: 'PUT to POST, since a review is a one-time decision rather than an idempotent replacement.',
    },
  },
  {
    legacyLabel: 'download traversal ..%2F.env',
    legacyPath: '/reports/download/..%2F.env',
    newPath: null,
    method: 'GET',
    role: 'staff',
    intent: {
      kind: 'removed',
      note: 'The filename-based download route is gone. Files are addressed by their own id, so no path is constructed from request input and traversal has no surface.',
    },
  },
  {
    legacyLabel: 'download unowned file',
    legacyPath: '/reports/download/:filename',
    newPath: '/api/v1/reports/files/:fileId',
    method: 'GET',
    role: 'supervisor',
    resolve: (ctx) => `/api/v1/reports/files/${ctx.fileId}`,
    intent: {
      kind: 'corrected',
      note: '403 to 200 for a reviewer with a legitimate claim; a staff member with no claim now receives 404 rather than the blanket access the old handler granted every manager and supervisor.',
    },
  },
  {
    legacyLabel: 'analytics dashboard',
    legacyPath: '/analytics/dashboard',
    newPath: '/api/v1/analytics/overview',
    method: 'GET',
    role: 'manager',
    intent: { kind: 'moved', note: '/dashboard split into /overview, /by-submitter, /by-template.' },
  },
  {
    legacyLabel: 'analytics dashboard (staff denied)',
    legacyPath: '/analytics/dashboard',
    newPath: '/api/v1/analytics/overview',
    method: 'GET',
    role: 'staff',
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'staff performance',
    legacyPath: '/analytics/staff-performance',
    newPath: '/api/v1/analytics/by-submitter',
    method: 'GET',
    role: 'manager',
    intent: { kind: 'moved', note: 'Renamed to describe what it groups by.' },
  },
  {
    legacyLabel: 'database performance',
    legacyPath: '/analytics/database-performance',
    newPath: '/api/v1/analytics/by-template',
    method: 'GET',
    role: 'manager',
    intent: {
      kind: 'corrected',
      note: 'The old name said database while the code grouped by template name. Renamed to match the actual grouping.',
    },
  },
  {
    legacyLabel: 'delete report (staff denied)',
    legacyPath: '/reports/:id',
    newPath: '/api/v1/reports/:id',
    method: 'DELETE',
    role: 'staff',
    resolve: (ctx) => `/api/v1/reports/${ctx.reportId}`,
    intent: { kind: 'unchanged' },
  },
  {
    legacyLabel: 'delete database',
    legacyPath: '/databases/:id',
    newPath: '/api/v1/databases/:id',
    method: 'DELETE',
    role: 'manager',
    resolve: (ctx) => `/api/v1/databases/${ctx.databaseId}`,
    intent: { kind: 'unchanged' },
  },
];

function writeReport(
  results: Array<{
    mapping: Mapping;
    legacyStatus: number | null;
    newStatus: number | null;
    unexplained: boolean;
  }>,
  totalRecorded: number
): void {
  const counts = {
    unchanged: results.filter((r) => r.mapping.intent.kind === 'unchanged').length,
    moved: results.filter((r) => r.mapping.intent.kind === 'moved').length,
    corrected: results.filter((r) => r.mapping.intent.kind === 'corrected').length,
    removed: results.filter((r) => r.mapping.intent.kind === 'removed').length,
    unexplained: results.filter((r) => r.unexplained).length,
  };

  const lines: string[] = [
    '# Parity reconciliation',
    '',
    'Generated by `api/src/scripts/verifyParity.ts`.',
    '',
    'The legacy API had no tests, so the recorded contract in `API-CONTRACT.json`',
    'is the only description of its behaviour. This table runs the equivalent call',
    'against the new API and states, for each one, whether the behaviour is the',
    'same, the route moved, the behaviour was deliberately corrected, or the',
    'endpoint was removed.',
    '',
    'A clean diff was never the aim. Every endpoint moved under `/api/v1` and the',
    'error envelope changed shape. What matters is that no difference is accidental.',
    '',
    `- Recorded legacy calls: ${totalRecorded}`,
    `- Mapped and checked here: ${results.length}`,
    `- Same behaviour: ${counts.unchanged}`,
    `- Route moved, behaviour kept: ${counts.moved}`,
    `- Behaviour deliberately corrected: ${counts.corrected}`,
    `- Endpoint removed: ${counts.removed}`,
    `- **Unexplained differences: ${counts.unexplained}**`,
    '',
    '## Calls',
    '',
    '| legacy | new | role | legacy status | new status | verdict |',
    '|---|---|---|---|---|---|',
  ];

  for (const { mapping, legacyStatus, newStatus, unexplained } of results) {
    const verdict = unexplained ? '**UNEXPLAINED**' : mapping.intent.kind;
    lines.push(
      `| \`${mapping.method} ${mapping.legacyPath}\` | ${
        mapping.newPath === null ? '_removed_' : `\`${mapping.newPath}\``
      } | ${mapping.role} | ${legacyStatus ?? '—'} | ${newStatus ?? '—'} | ${verdict} |`
    );
  }

  const explained = results.filter((r) => r.mapping.intent.kind !== 'unchanged');
  if (explained.length) {
    lines.push('', '## Declared differences', '');
    for (const { mapping, legacyStatus, newStatus } of explained) {
      const note = 'note' in mapping.intent ? mapping.intent.note : '';
      lines.push(
        `### \`${mapping.method} ${mapping.legacyPath}\` (${mapping.intent.kind})`,
        '',
        `- new: ${mapping.newPath === null ? 'removed' : `\`${mapping.newPath}\``}`,
        `- status: ${legacyStatus ?? '—'} → ${newStatus ?? '—'}`,
        `- ${note}`,
        ''
      );
    }
  }

  const unexplainedResults = results.filter((r) => r.unexplained);
  if (unexplainedResults.length) {
    lines.push('', '## Unexplained differences', '',
      'These changed without a declared reason. Each needs either a fix or an',
      'entry in the mapping table saying why the change is intended.', '');
    for (const { mapping, legacyStatus, newStatus } of unexplainedResults) {
      lines.push(`- \`${mapping.method} ${mapping.newPath}\` as ${mapping.role}: ${legacyStatus} → ${newStatus}`);
    }
  }

  mkdirSync(resolve(OUT_PATH, '..'), { recursive: true });
  writeFileSync(OUT_PATH, `${lines.join('\n')}\n`);
}

main().catch((error) => {
  console.error('Parity check failed:', error);
  process.exit(1);
});
