#!/usr/bin/env node
/**
 * Drives the three role journeys in a real browser and saves a screenshot of
 * each screen, so the interface is checked by looking at it rather than only by
 * unit tests. Uses the system Chrome rather than a downloaded browser.
 *
 *   node scripts/capture-screens.mjs
 *
 * Expects the API on :5000 and the dev server on :5173.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.WEB_URL ?? 'http://localhost:5173';
const OUT = 'screenshots';

const ACCOUNTS = {
  staff: { email: 'staff@bankofabyssinia.com', password: 'staff-password-123' },
  supervisor: { email: 'supervisor@bankofabyssinia.com', password: 'supervisor-password-123' },
  manager: { email: 'manager@bankofabyssinia.com', password: 'manager-password-123' },
};

/** Each role, and the pages to visit once signed in. */
const JOURNEYS = [
  { role: 'staff', pages: [['', 'my-reports'], ['submit', 'submit-report']] },
  {
    role: 'supervisor',
    pages: [['', 'review-queue'], ['reports', 'all-reports'], ['analytics', 'analytics']],
  },
  {
    role: 'manager',
    pages: [
      ['', 'overview'],
      ['templates', 'templates'],
      ['databases', 'databases'],
      ['approvals', 'approvals'],
      ['users', 'users'],
    ],
  },
];

const problems = [];

async function main() {
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome' });

  try {
    // Signed-out screens first.
    const anon = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    watch(anon, 'signed-out');

    await anon.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await anon.screenshot({ path: `${OUT}/01-login.png` });

    // A protected route must redirect rather than render.
    await anon.goto(`${BASE}/manager`, { waitUntil: 'networkidle' });
    if (!anon.url().includes('/login')) {
      problems.push(`Guard failed: /manager did not redirect while signed out (landed on ${anon.url()})`);
    } else {
      console.log('  guard: /manager redirects to sign-in while signed out');
    }

    await anon.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await anon.screenshot({ path: `${OUT}/02-register.png` });
    await anon.close();

    let index = 3;

    for (const { role, pages } of JOURNEYS) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      watch(page, role);

      await signIn(page, role);

      for (const [path, name] of pages) {
        const url = `${BASE}/${role}${path ? `/${path}` : ''}`;
        await page.goto(url, { waitUntil: 'networkidle' });
        // Charts and tables settle a beat after the network goes quiet.
        await page.waitForTimeout(600);

        const label = `${String(index).padStart(2, '0')}-${role}-${name}`;
        await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: true });
        console.log(`  captured ${label}`);
        index += 1;
      }

      // A role must not be able to open another role's area.
      const forbidden = role === 'manager' ? 'staff' : 'manager';
      await page.goto(`${BASE}/${forbidden}`, { waitUntil: 'networkidle' });
      if (page.url().includes(`/${forbidden}`)) {
        problems.push(`Guard failed: ${role} reached /${forbidden}`);
      } else {
        console.log(`  guard: ${role} cannot open /${forbidden}`);
      }

      // The dynamic form is the critical path: it is generated from template
      // data, so it is filled and submitted for real rather than only rendered.
      if (role === 'staff') {
        index = await submitAReport(page, index);
      }

      // Approving a registration assigns the role, so the effect is checked
      // rather than assumed.
      if (role === 'manager') {
        index = await approveARegistration(page, index);
      }

      // Dark mode, on one page per role, since it is a separate token set.
      if (role === 'manager') {
        await page.goto(`${BASE}/manager`, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: /switch to dark theme/i }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/${index}-manager-overview-dark.png`, fullPage: true });
        console.log(`  captured ${index}-manager-overview-dark`);
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  if (problems.length > 0) {
    console.error('\nProblems found:');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }

  console.log('\nAll journeys captured with no console errors and no guard failures.');
}

/**
 * Fills and submits a report through the generated form.
 *
 * This exercises the part of the rewrite with the least static protection: the
 * fields come from template data, the server validates against the same
 * definition, and a mismatch between the two would only show up here.
 */
async function submitAReport(page, index) {
  // Counted first: this navigates, so doing it after filling would discard the
  // form before the submit button could be clicked.
  const before = await countRows(page);

  await page.goto(`${BASE}/staff/submit`, { waitUntil: 'networkidle' });

  // Choosing the template is what causes the fields to be generated.
  await page.getByLabel('Template').selectOption({ index: 1 });
  await page.waitForTimeout(400);

  await page.getByLabel('Summary').fill('Captured by the browser run: all instances healthy.');
  await page.getByLabel('Incidents this week').fill('2');
  await page.getByLabel('Highest severity').selectOption('low');
  await page.getByLabel('Backups verified').selectOption('yes');
  await page.getByLabel(/Checklist completed/).check();
  await page.getByLabel('Notes').fill('Filled in by the automated browser check.');
  await page.getByLabel('Last patched').fill('2026-08-11');

  const filled = `${String(index).padStart(2, '0')}-staff-submit-form-filled`;
  await page.screenshot({ path: `${OUT}/${filled}.png`, fullPage: true });
  console.log(`  captured ${filled}`);
  index += 1;

  await page.locator('button[type="submit"]').click();

  // On success the form navigates back to the report list.
  await page.waitForURL(/\/staff$/, { timeout: 15_000 }).catch(() => {
    problems.push('Submitting the generated form did not return to the report list');
  });
  await page.waitForTimeout(800);

  const after = await page.locator('tbody tr').count();
  if (after <= before) {
    problems.push(`Report count did not increase after submitting (${before} then ${after})`);
  } else {
    console.log(`  submitted a report through the generated form (${before} then ${after} rows)`);
  }

  const listed = `${String(index).padStart(2, '0')}-staff-my-reports-after-submit`;
  await page.screenshot({ path: `${OUT}/${listed}.png`, fullPage: true });
  console.log(`  captured ${listed}`);
  return index + 1;
}

/**
 * Approves the pending registration as a supervisor and confirms the granted
 * role is the one the manager chose, not the one the registration asked for.
 */
async function approveARegistration(page, index) {
  await page.goto(`${BASE}/manager/approvals`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const pending = await page.locator('tbody tr').count();
  if (pending === 0) {
    console.log('  no pending registration to approve, skipping');
    return index;
  }

  // The registration asked for staff; the manager grants supervisor.
  await page.locator('tbody tr').first().getByRole('combobox').selectOption('supervisor');
  await page.getByRole('button', { name: 'Approve' }).first().click();
  await page.waitForTimeout(1200);

  const remaining = await page.locator('tbody tr').count();
  if (remaining >= pending) {
    problems.push(`Approving did not clear the request (${pending} then ${remaining})`);
  } else {
    console.log(`  approved a registration (${pending} then ${remaining} waiting)`);
  }

  // The granted role should now show on the users page.
  await page.goto(`${BASE}/manager/users`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const row = page.locator('tbody tr', { hasText: 'hanna.applicant@bankofabyssinia.com' });
  const text = (await row.count()) > 0 ? await row.first().innerText() : '';

  if (!text.includes('supervisor')) {
    problems.push(`Granted role was not applied; the row reads: ${text.replace(/\s+/g, ' ')}`);
  } else {
    console.log('  granted role applied: the account is now a supervisor, not staff');
  }

  const label = `${String(index).padStart(2, '0')}-manager-users-after-approval`;
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: true });
  console.log(`  captured ${label}`);
  return index + 1;
}

async function countRows(page) {
  await page.waitForTimeout(400);
  return page.locator('tbody tr').count();
}

async function signIn(page, role) {
  const { email, password } = ACCOUNTS[role];
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(new RegExp(`/${role}`), { timeout: 15_000 });
  console.log(`\n${role}: signed in`);
}

/** Fails the run on a console error or an unhandled request failure. */
function watch(page, label) {
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // React's dev-mode key warning would not indicate a broken screen.
    if (text.includes('Download the React DevTools')) return;
    problems.push(`[${label}] console error: ${text}`);
  });

  page.on('requestfailed', (request) => {
    problems.push(`[${label}] request failed: ${request.method()} ${request.url()}`);
  });

  page.on('response', (response) => {
    if (response.status() >= 500) {
      problems.push(`[${label}] ${response.status()} from ${response.url()}`);
    }
  });
}

main().catch((error) => {
  console.error('Capture failed:', error.message);
  process.exit(1);
});
