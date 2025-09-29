# Staff Report Management System

Internal weekly reporting for Bank of Abyssinia. Staff submit structured reports
built from manager-authored templates, supervisors review them, and managers own
templates, account approval, a database inventory, and reporting analytics.

## Contents

| Directory | What it is |
|---|---|
| `api/` | The API — TypeScript, Express 5, Mongoose, Zod |
| `web/` | The interface — React 19, Vite, Tailwind 4 |
| `backend/` | The previous API. Retained until the new one is deployed. |
| `staff_report_management_system/` | The previous interface. Retained likewise. |
| `.planning/` | Codebase analysis and the recorded behaviour of the previous API |

The two legacy directories still run, so the old and new versions can be compared
side by side. They are removed once the new ones are deployed.

## Running it

Requires Node 18 or newer and a MongoDB instance.

### 1. Start MongoDB

Either a local container:

```bash
docker run -d --name srms-mongo -p 27017:27017 -v srms-mongo-data:/data/db mongo:7
```

or an Atlas cluster, in which case add the machine's IP under Network Access.

### 2. The API

```bash
cd api
npm install
cp .env.example .env      # fill in MONGODB_URI and JWT_SECRET
npm run seed              # sample accounts, a template, and some reports
npm run dev               # http://localhost:5000
```

`JWT_SECRET` must be at least 32 characters. Generate one with
`openssl rand -hex 32`. The API refuses to start without it rather than falling
back to a default.

### 3. The interface

```bash
cd web
npm install
npm run dev               # http://localhost:5173
```

The dev server proxies `/api` to port 5000, so no base URL is needed locally. For
a deployed build, set `VITE_API_BASE_URL`.

### Seeded accounts

`npm run seed` creates one account per role. Development only — the script
refuses to run against a production database.

| Role | Email | Password |
|---|---|---|
| staff | `staff@bankofabyssinia.com` | `staff-password-123` |
| supervisor | `supervisor@bankofabyssinia.com` | `supervisor-password-123` |
| manager | `manager@bankofabyssinia.com` | `manager-password-123` |

## How it works

### Roles

Three roles, enforced by the API. The interface hides what a role cannot do, but
the decision is always the server's.

| | staff | supervisor | manager |
|---|---|---|---|
| Submit reports | yes | yes | yes |
| See own reports | yes | yes | yes |
| See all reports | | yes | yes |
| Review reports | | yes | yes |
| Analytics | | yes | yes |
| Reset passwords | | staff only | staff and supervisors |
| Approve registrations | | | yes |
| Manage templates | | | yes |
| Manage the database inventory | | | yes |

Nobody reviews their own report, and nobody resets the password of a peer of equal
rank or their own — there is a separate change-password route for that.

Registration cannot choose its own role. An applicant asks for access; the
approving manager decides what role the account is granted.

### Templates drive the forms

A template is a list of field definitions: name, type, label, whether it is
required, validators, and display order. Eight field types are supported: `text`,
`textarea`, `number`, `date`, `select`, `checkbox`, `yesno`, and `file`.

The interface generates the form from those definitions, and the API compiles the
same definitions into a validation schema. Both sides therefore agree on what a
template requires by construction rather than by convention.

Reports record the template version they were submitted against. Editing a
template's fields raises its version, so answers submitted earlier remain
interpretable. A template that reports reference is retired rather than deleted.

### Reporting periods

A report carries the period it covers, supplied by the submitter, separate from
when it was submitted. Weeks are ISO-8601 and computed in UTC, so a report filed
on Monday about the previous week belongs to the week it describes, and the figures
do not shift with the server's timezone.

### Attachments

Attachments are stored in MongoDB via GridFS and addressed by id. Access follows
the report that owns them: the submitter and any reviewer can read an attachment,
and anyone else receives a 404 rather than a 403, which avoids confirming that a
file exists. Uploads are capped in size and restricted to an allowlist of types.

## Development

### Tests

```bash
cd api && npm test        # 169 tests
cd web && npm test        # 23 tests
```

API tests start their own in-memory MongoDB, so no external database is needed.

### Checking behaviour against the previous API

The previous API had no tests, so its behaviour was recorded before the rewrite.
`.planning/contract/API-CONTRACT.json` holds request and response pairs for 56
calls, and the reconciliation script replays the equivalent call against the new
API:

```bash
cd api && npx tsx src/scripts/verifyParity.ts
```

It classifies each difference as unchanged, moved, deliberately corrected, or
removed, and exits non-zero if any difference has no declared reason.
`.planning/contract/PARITY.md` is the readable output.

### Checking the interface

```bash
cd web && npm run verify:browser
```

Signs in as each role in a real browser, visits every screen, submits a report
through a generated form, approves a registration, and fails on any console error
or failed request. Screenshots land in `web/screenshots/`.

### Continuous integration

`.github/workflows/ci.yml` runs four jobs on every push: the API suite, the web
suite, the parity reconciliation, and a check that no `.env` file or credentialled
connection string is committed.

## API

Base path `/api/v1`. Every error uses one envelope:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [{ "path": "templateData.summary", "message": "Too short" }]
  }
}
```

`code` is stable and machine-readable, so a client never has to match on message
text.

| Method | Path | Who |
|---|---|---|
| `POST` | `/auth/register` | anyone |
| `POST` | `/auth/login` | anyone |
| `GET` | `/auth/me` | signed in |
| `POST` | `/auth/change-password` | signed in |
| `GET` | `/auth/users` | supervisor, manager |
| `GET` | `/auth/registrations/pending` | manager |
| `PATCH` | `/auth/registrations/:userId` | manager |
| `POST` | `/auth/reset-password` | supervisor, manager |
| `GET` | `/templates`, `/templates/:id` | signed in |
| `POST` `PATCH` `DELETE` | `/templates`, `/templates/:id` | manager |
| `GET` | `/reports` | signed in, scoped by role |
| `GET` | `/reports/:id` | submitter or reviewer |
| `POST` | `/reports` | signed in |
| `PATCH` | `/reports/:id` | submitter, while unreviewed |
| `POST` | `/reports/:id/review` | supervisor, manager |
| `GET` | `/reports/files/:fileId` | submitter or reviewer |
| `DELETE` | `/reports/:id` | manager |
| `GET` | `/databases`, `/databases/:id` | signed in |
| `POST` `PATCH` `DELETE` | `/databases`, `/databases/:id` | manager |
| `POST` | `/databases/:id/restore` | manager |
| `POST` | `/databases/bulk-retire` | manager |
| `GET` | `/analytics/overview` | supervisor, manager |
| `GET` | `/analytics/by-submitter` | supervisor, manager |
| `GET` | `/analytics/by-template` | supervisor, manager |

`GET /health` reports the database connection state and returns 503 when it is
down, so a load balancer does not see a healthy process with a dead database.

## Notes on the rewrite

The previous version worked but had no tests, no types, and no CI, and could not be
deployed — both halves hardcoded `localhost:5000`. Rather than patch it, its
behaviour was recorded and it was rebuilt alongside.

Defects found and fixed along the way, each now covered by a test:

- The file download endpoint joined an unsanitised URL parameter onto a directory
  path, so any signed-in user could read arbitrary server files, including the
  environment file holding the database URL and signing key.
- Managers and supervisors could read every attachment with no per-report check.
- Registration trusted the role in the request body and auto-approved managers, so
  anyone who could reach the endpoint could create an administrator account.
- Registration logged the whole request body, putting plaintext passwords into the
  server log.
- Login had no rate limit and gave distinguishable errors for an unknown address
  and a wrong password, so it could be used to discover which accounts existed.
- The global error handler was registered above the routes, so it never ran.
- Average review time was divided by the total number of reports rather than the
  number reviewed, so unreviewed work pulled the figure toward zero.
- Reviewed share and approval rate were the same calculation, which double-counted
  approval in the performance score.
- The weekly trend built four rolling buckets while filtering to seven days, so
  three were always empty by construction.
- Analytics with no date range returned every report ever submitted.
- Week numbers used non-standard arithmetic in local time.
- Three of the four clauses in the download authorisation query referenced fields
  that do not exist on the schema.
- Bulk retire was unreachable, declared after the route that captured its path.
- Uploads had no size or type limit.
- Every client route was public and rendered regardless of who asked.

The full analysis is in `.planning/codebase/`, and `.planning/contract/PARITY.md`
lists every deliberate behaviour change with its reason. The previous README, which
documented a 2025 refactor rather than how to run the project, is kept at
`.planning/README.legacy-refactor-notes.md`.
