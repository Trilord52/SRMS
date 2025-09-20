# Testing

**Analysis Date:** 2026-08-08

## Current State

**There is effectively no test coverage.** One test file exists in the entire repository, and it
is the unmodified Create React App template smoke test.

| Metric | Value |
|---|---|
| Test files | 1 (`staff_report_management_system/src/App.test.js`) |
| Backend test files | 0 |
| Meaningful assertions | 0 |
| CI running tests | none — no `.github/` directory |
| Coverage tooling | none configured |
| E2E tests | none |

## Frontend

### Framework

Jest + React Testing Library, supplied transitively by `react-scripts` 5.0.1. No standalone
Jest config — CRA owns it.

Installed and available but essentially unused:

| Package | Version |
|---|---|
| `@testing-library/react` | ^16.3.0 |
| `@testing-library/jest-dom` | ^6.6.4 |
| `@testing-library/user-event` | ^13.5.0 |
| `@testing-library/dom` | ^10.4.1 |

`src/setupTests.js` (5 lines) is the CRA default, importing `@testing-library/jest-dom`.

### The one test

`src/App.test.js` is the CRA boilerplate — it renders `<App />` and asserts a "learn react" link
exists. That link does not exist in this application (`src/App.js` renders a router with a login
screen), so the test is either failing or was never run.

Runner: `npm test` → `react-scripts test` (watch mode by default; needs `CI=true` for one-shot).

### What is untested

All of it. Notably:

- `ManagerDashboard.js` — 1,687 lines
- `SupervisorDashboard.js` — 648 lines
- `StaffDashboard.js` — 634 lines
- `TemplateManager.js` — 431 lines
- `DynamicForm.js` — 265 lines, renders arbitrary user-defined form schemas
- `Login.js` / `Signup.js` — the auth entry points

## Backend

No test framework is installed. No Jest, no Vitest, no Mocha, no Supertest. The `test` script is
the npm placeholder that fails by design:

```json
"test": "echo \"Error: no test specified\" && exit 1"
```

### What is untested

~1,900 lines of route logic across 5 routers and 40 endpoints, including:

| Area | File | Lines | Risk if wrong |
|---|---|---|---|
| Report CRUD, review, revisions, export | `routes/reports.js` | 776 | data loss, wrong review state |
| Analytics aggregations | `routes/analytics.js` | 438 | silently wrong numbers |
| Auth, registration, approvals, password reset | `routes/auth.js` | 317 | privilege escalation |
| Template CRUD | `routes/templates.js` | 222 | breaks all dependent reports |
| Database inventory | `routes/databases.js` | 174 | exposure of infra metadata |
| JWT verification | `middleware/auth.js` | 26 | auth bypass |

### Manual verification scripts

Two scripts serve as ad-hoc checks. Neither asserts anything:

| Script | Purpose |
|---|---|
| `backend/check-mongodb.js` (59 lines) | prints MongoDB connectivity result; `npm run check-mongodb` |
| `backend/seed-dummy-accounts.js` (177 lines) | inserts test users across the three roles; `npm run seed` |

`seed-dummy-accounts.js` is the closest thing to a fixture the project has and is worth reading
before designing test data — it encodes the author's mental model of valid users per role.

## No Mocking Infrastructure

No mocking of any kind exists: no `jest.mock` usage, no MSW, no `mongodb-memory-server`, no HTTP
fixtures, no factory helpers.

This matters because of the architecture: business logic lives inside Express route handlers
talking directly to Mongoose (see ARCHITECTURE.md). There is no service layer to unit-test in
isolation. Testing any rule — "supervisors may reset only staff passwords", "rejected reports
create a revision" — currently requires booting the app and a real database.

## Testability Blockers

Concrete obstacles a test suite has to work around or fix:

1. **No service layer.** Logic is inseparable from HTTP handling. Either test through HTTP
   (Supertest) or extract services first.
2. **Hardcoded port.** `app.listen(5000)` is called unconditionally at the bottom of
   `backend/index.js`, and `app` is never exported. Supertest cannot import the app without
   starting a real listener — this requires a code change before any integration test can run.
3. **Hardcoded client API origin.** `http://localhost:5000` appears at ~30 fetch sites, so
   component tests cannot redirect calls without network interception.
4. **Fail-fast env at import time.** `backend/index.js` calls `process.exit(1)` if `MONGODB_URI`
   or `JWT_SECRET` are missing, so importing the module in a test environment kills the process
   unless env is pre-seeded.
5. **God components.** A 1,687-line dashboard has too many responsibilities to unit-test; it
   needs decomposition first.
6. **`Report.templateData` is `Schema.Types.Mixed`.** No schema to validate against, so
   correctness tests must be written per template definition.
7. **Local disk uploads.** Multer writes to `./uploads/` relative to CWD, so upload tests leave
   artifacts unless the destination is injectable.

## Target Test Strategy

For the rewrite, given the chosen stack (Vite + TypeScript + Tailwind + shadcn/ui + TanStack
Query + Zod):

| Layer | Tool | Scope |
|---|---|---|
| Unit — backend | Vitest | Zod schemas, role guards, week-number derivation, template validation |
| Integration — API | Vitest + Supertest + `mongodb-memory-server` | all 40 endpoints, per-role authorization matrix |
| Unit — frontend | Vitest + React Testing Library | components, especially `DynamicForm` against every field type |
| Network mocking | MSW | replaces per-site fetch stubbing |
| E2E | Playwright | the three role journeys end to end |
| Coverage | Vitest v8 provider | gate in CI |

### Priority order

Highest value first, based on where a defect is both likely and expensive:

1. **Authorization matrix** — every endpoint × every role. This is where the current inline role
   checks could silently be missing on a handler.
2. **Dynamic template forms** — all 8 field types (`text`, `number`, `date`, `select`,
   `checkbox`, `textarea`, `file`, `yesno`), each validator (`minLength`, `maxLength`, `min`,
   `max`, `pattern`), plus `required`, `readOnly`, and `order`. Behavior here is defined by
   runtime data, so it is the most likely thing to be lost in a rewrite.
3. **Report review lifecycle** — `pending → approved | rejected`, and `revisionOf` chaining on
   resubmission.
4. **User approval lifecycle** — pending queue, manager auto-approval, rejection reasons.
   Must not be conflated with report review despite sharing the same status vocabulary.
5. **Week-number derivation** — the current implementation is non-ISO (see CONCERNS.md); tests
   should pin the intended behavior explicitly, including year boundaries.
6. **Auth** — BOA email regex, bcrypt round-trip, JWT verify, expiry handling.
7. **File upload** — size limits, MIME allowlist, filename collisions.
8. **Analytics aggregations** — verified against fixed seeded datasets.

### Parity harness

Because this is a full rewrite with API redesign, the most valuable early test asset is a
**recorded contract of current behavior**: for each of the 40 endpoints, real request/response
pairs captured from the running legacy app. Without it there is no oracle for "did the rewrite
change this?" — the legacy app has no tests to inherit.

---
*Testing analysis: 2026-08-08*
<!-- refreshed: 2026-08-08 -->
