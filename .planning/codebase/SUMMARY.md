# Codebase Summary

**Project:** SRMS — Staff Report Management System
**Analysis Date:** 2026-08-08
**Analyzed by:** inline sequential mapping (subagent dispatch unavailable — gateway 503)

## What This Is

An internal weekly-reporting tool for Bank of Abyssinia. Staff submit structured reports built
from manager-authored dynamic templates; supervisors review and approve or reject them; managers
own templates, user registration approval, a database-server inventory, and analytics.

Two-tier MERN application in one repository:

```
staff_report_management_system/   React 19 SPA on Create React App (port 3000)
backend/                          Express 5 API on MongoDB Atlas (port 5000)
```

Roughly 16,500 lines of application code. No monorepo tooling — the two halves are installed and
run independently and share nothing but HTTP.

## Scale

| Metric | Value |
|---|---|
| Backend application code | ~2,500 lines (~1,900 in route handlers) |
| Frontend code | ~6,500 lines JS + ~7,500 lines CSS |
| API endpoints | 40 across 5 routers |
| Mongoose models | 5 |
| React components | ~50 |
| Test files | 1 (CRA boilerplate, non-functional) |
| Largest file | `src/components/ManagerDashboard.js` — 1,687 lines |

## Stack in One Table

| Layer | Choice |
|---|---|
| Frontend | React 19.1.1, react-scripts 5.0.1, react-router-dom 6, Recharts 3 |
| Styling | plain CSS, 30+ colocated files, no tokens, parallel `.dark.css` overrides |
| Backend | Express 5.1, Mongoose 8.16, native `mongodb` 6.18 driver |
| Auth | self-hosted JWT (24h) + bcryptjs, token in `localStorage` |
| Files | multer to local disk `./uploads/` |
| Types | none — no TypeScript anywhere |
| Tests | none functional |
| CI | none |

Full detail in [STACK.md](STACK.md) and [INTEGRATIONS.md](INTEGRATIONS.md).

## Architecture in One Paragraph

Route handlers are the application. There is no service layer, no repository layer, and no
dependency injection — Express handlers perform validation, authorization, business logic, and
Mongoose queries inline, then shape the response. `backend/routes/reports.js` alone is 776 lines.
On the client, each role has one god-component dashboard (`ManagerDashboard.js` at 1,687 lines)
that owns tab routing, fetching, and state; there is no state library, no Context, and no API
client — ~30 bare `fetch` calls each hardcode `http://localhost:5000` and read the token from
`localStorage` themselves. See [ARCHITECTURE.md](ARCHITECTURE.md).

### The distinctive part

`Template.fields[]` is a user-authored form definition — 8 field types, per-field validators,
ordering. Reports store answers in `Report.templateData` as `Schema.Types.Mixed`, plus a
`templateVersion` stamp. The client renders the form from the same definition
(`src/components/shared/DynamicForm.js`).

So the contract between form rendering, server validation, and stored data is **runtime data,
not code.** Nothing static checks it, and Mongoose applies no validation to `Mixed`. This is the
highest-risk area for any rewrite and the thing most likely to be silently lost.

## Health Assessment

| Dimension | Rating | Note |
|---|---|---|
| Feature completeness | strong | three real role workflows, dynamic templates, analytics, file handling |
| Security | **poor** | 3 critical findings, exploitable today in a public repo |
| Test coverage | **none** | 1 boilerplate test that does not pass |
| Type safety | none | no TypeScript over 16.5k lines |
| Deployability | **blocked** | client and server both hardcode `localhost:5000` |
| Documentation | thin | README documents a past refactor, not setup; no `.env.example` |
| Consistency | mixed | handler shape is uniform; error shapes, folder depth, and CSS approach are not |

The gap between feature completeness and engineering hygiene is the defining characteristic here.
The domain logic is real and non-trivial; everything around it — tests, types, config, secrets
handling, deployability — is missing.

## Must-Fix Before Anything Else

Three findings are exploitable in the current public repository, independent of any rewrite:

1. **Path traversal** — `backend/routes/reports.js:652` joins an unsanitized URL parameter onto
   the uploads path. Encoded slashes survive routing, so any authenticated user of any role can
   read arbitrary server files, including `backend/.env` with `MONGODB_URI` and `JWT_SECRET`.
2. **Blanket file access** — `backend/routes/reports.js:660` grants managers and supervisors
   access to every file with no per-report check.
3. **Plaintext passwords in logs** — `backend/routes/auth.js:11` logs the full `req.body` on
   registration. Any retained log from a past run may contain real credentials.

Also high: the global error handler at `backend/index.js:36` is registered above the routes and
therefore never runs; three of four `$or` branches in the download access check reference fields
that do not exist on the `Report` schema; no rate limiting on login; CORS fully open; 22 real
user uploads (5.5 MB) committed to git history; uploads accept any size and any MIME type.

Full inventory with line citations in [CONCERNS.md](CONCERNS.md) — 3 critical, 6 high, 12 medium,
12 low.

## What the Current Code Does Well

Worth carrying forward deliberately rather than rediscovering:

- **No committed secrets** — the root `.gitignore` covers `backend/.env`
- **JWT expiry set** (24h) and **bcrypt with per-user salt** at cost 10
- **No user enumeration** — both login failure paths return the same message
- **Fail-fast env validation** at boot
- **Deliberate compound indexes** tuned to real query patterns on `Report`, `Template`, `FileMetadata`
- **Guard-clause-first handlers** with early returns — genuinely consistent across all 40 endpoints
- **Role-appropriate query scoping** server-side rather than client-side filtering

## Constraints Any Rewrite Must Respect

1. `Report.templateData` is `Mixed` — existing documents have no enforced shape. Migration
   requires reading real data per `templateVersion` to discover actual shapes.
2. `weekNumber` / `year` / `month` / `day` are denormalized onto every report and three compound
   indexes depend on them. The current derivation is non-ISO, timezone-dependent, and reflects
   submission time rather than the reporting period — so stored historical values are already
   approximate.
3. `revisionOf` forms a self-referential linked list on `Report`. Revision history is a chain,
   not an array.
4. Two independent `pending → approved | rejected` state machines share one vocabulary —
   `User.approvalStatus` and `Report.reviewStatus`. They must not be collapsed into a shared type.
5. Uploads live on local disk with git-tracked history; containerized deployment loses them
   without an object-storage migration.
6. The BOA email regex `/^[\w.-]+@bankofabyssinia\.com$/` is duplicated in model and route.
7. Both ports/origins are hardcoded — neither half deploys as-is.

## Testability Blockers

Beyond having no tests, two things actively prevent writing them:

- `backend/index.js` calls `app.listen(5000)` unconditionally and never exports `app`, so
  Supertest cannot mount it without starting a real listener. This needs a code change first.
- Importing `backend/index.js` calls `process.exit(1)` when `MONGODB_URI` or `JWT_SECRET` are
  absent, killing the test process unless env is pre-seeded.

Plus the structural one: with logic inside handlers, there is nothing to unit-test in isolation.
Priorities and target strategy in [TESTING.md](TESTING.md).

### Highest-value early test asset

Because the legacy app has no tests to inherit, there is no oracle for "did the rewrite change
this?" Record real request/response pairs for all 40 endpoints from the running legacy app first —
that contract capture is worth more than any individual test written afterward.

## Documents

| Document | Contents |
|---|---|
| [STACK.md](STACK.md) | languages, dependencies with versions, scripts, config, build tooling |
| [ARCHITECTURE.md](ARCHITECTURE.md) | layers, request flow, authorization model, dynamic template subsystem, data flow |
| [STRUCTURE.md](STRUCTURE.md) | directory tree with line counts, naming conventions, structural debt |
| [CONVENTIONS.md](CONVENTIONS.md) | observed patterns, what to preserve, what to fix |
| [INTEGRATIONS.md](INTEGRATIONS.md) | MongoDB, models, indexes, auth, file storage, client wiring, absent integrations |
| [TESTING.md](TESTING.md) | current state, blockers, target strategy, priority order |
| [CONCERNS.md](CONCERNS.md) | 33 findings with file:line citations, severity-ranked |

## Analysis Caveats

- Mapping ran inline and sequentially. The four parallel mapper subagents all failed with a
  gateway `503` (`openrouter/free` had no available channel in the `default` group) — an
  infrastructure fault, not a repository problem.
- `backend/routes/analytics.js` (438 lines) and `backend/routes/templates.js` (222 lines) were
  read for endpoint inventory and conventions but not line-by-line for logic defects. The
  aggregation correctness in `analytics.js` is unverified.
- The download handler was read through line 669; how the response completes (and therefore
  whether stored XSS via `Content-Type` is reachable) is noted as needing confirmation in
  CONCERNS.md H6.
- Whether `routes/databases.js` connects live to inventoried database hosts or only records
  metadata was not confirmed; the native `mongodb` driver dependency suggests at least some live
  introspection.

---
*Codebase analysis: 2026-08-08*
<!-- refreshed: 2026-08-08 -->
