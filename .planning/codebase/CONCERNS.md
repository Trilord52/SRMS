# Concerns

**Analysis Date:** 2026-08-08

Findings from reading the code, ordered by severity. Each entry cites the file and line so it can
be re-verified. Nothing here is speculative unless explicitly marked as needing confirmation.

## Critical

### C1 — Path traversal in the file download endpoint

`backend/routes/reports.js:649-656`

```js
router.get('/download/:filename', authenticate, async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../uploads', filename);
  if (!fs.existsSync(filePath)) { ... }
```

`filename` comes straight from the URL with no sanitization, no `path.basename()`, and no check
that the resolved path stays inside `uploads/`. Express matches the route on the still-encoded
path, then decodes the parameter — so `%2F` does not break routing but becomes `/` in the value.
A request like `GET /reports/download/..%2F..%2Fbackend%2F.env` resolves outside the upload
directory.

Any authenticated user of any role can reach this. The highest-value target is `backend/.env`,
which holds `MONGODB_URI` and `JWT_SECRET` — reading it means full database access and the
ability to forge tokens for any user.

Fix: `path.basename(filename)`, then assert the resolved path is a prefix match on the upload
root before touching the filesystem.

### C2 — Managers and supervisors can download any file unconditionally

`backend/routes/reports.js:658-662`

```js
let hasAccess = false;
if (req.user.role === 'manager' || req.user.role === 'supervisor') {
  hasAccess = true;
} else {
  const report = await Report.findOne({ ... });
```

The access check is skipped entirely for two of the three roles. Combined with C1, an
authenticated supervisor can read arbitrary files off the server with no per-report
authorization at all.

### C3 — Passwords written to server logs in plaintext

`backend/routes/auth.js:11`

```js
console.log('Registration request received:', req.body);
```

`req.body` on registration contains the raw `password`. Every registration writes a plaintext
credential to stdout, which on any hosted platform means it lands in a retained log store.

`backend/routes/auth.js:92` logs only the email on login, which is the correct pattern — the
registration line is the outlier.

## High

### H1 — Global error handler is registered before the routes and never runs

`backend/index.js:36-43` mounts `app.use((err, req, res, next) => {...})` above the route mounts
at lines 45-49. Express dispatches error middleware in registration order, so this handler sits
upstream of every route and never receives their errors. It is dead code.

The per-handler `try`/`catch` blocks mask the consequence, but any error thrown outside a `catch`
falls through to Express's default handler, which in a non-production environment returns a stack
trace to the client.

### H2 — Dead query branches in the download access check

`backend/routes/reports.js:663-669` queries `synchronizationFiles`, `backupFiles`, and
`resourceFiles`:

```js
const report = await Report.findOne({
  $or: [
    { synchronizationFiles: filename },
    { backupFiles: filename },
    { resourceFiles: filename },
    { files: filename }
  ],
```

None of those three fields exist on the `Report` schema (`backend/models/Report.js` defines only
`files: [String]`). Three of the four `$or` branches can never match. Either the schema lost
fields the code still expects, or the code was copied from an earlier shape. Only the `files`
branch functions, so staff access control depends on one working clause out of four.

### H3 — No rate limiting anywhere

`POST /auth/login` (`backend/routes/auth.js:90`) has no attempt throttling, no lockout, and no
CAPTCHA. There is no `express-rate-limit` dependency. Password guessing is unbounded, and bcrypt
cost 10 makes each attempt cheap enough to script.

### H4 — CORS fully open

`backend/index.js:22` — `app.use(cors())` with no options allows every origin and method. With
tokens stored in `localStorage` and no origin restriction, any page can call the API with a
stolen token.

### H5 — 22 user-uploaded files committed to git

`backend/uploads/` contains 22 `.PNG`/`.png` files totalling 5.5 MB, tracked in history
(`1754904492715-AVL1.PNG`, `1755065424854-logo.png`, and so on). These are real uploads from
running the system, not fixtures. They are in a public repository. Removing them from HEAD does
not remove them from history.

`.gitignore` never excluded `backend/uploads/`, so the directory was tracked from the start.

### H6 — Uploads have no size or type limits

`backend/routes/reports.js:11-24`

```js
const upload = multer({ storage: storage });
```

No `limits`, no `fileFilter`. Any authenticated user can upload a file of any size and any type,
including executables and HTML. Combined with the download endpoint serving them back, stored
XSS is plausible depending on the `Content-Type` used on response — worth confirming how the
download completes past line 669.

Filenames are `Date.now() + '-' + file.originalname` (line 20), so the original name — including
any path characters or unicode — is preserved unsanitized on disk.

## Medium

### M1 — No route protection on the client

`staff_report_management_system/src/App.js` — all six routes are public. There is no
`ProtectedRoute` wrapper, no token check, no role gate, no redirect. `/manager-dashboard` renders
for anyone who types the URL; it just fails its fetches.

Not a server-side vulnerability, since the API enforces roles, but it leaks UI structure and
produces a broken experience rather than a redirect to login.

### M2 — Authorization by copy-paste, not middleware

Roughly 18 inline role comparisons across `backend/routes/auth.js`, `databases.js`, and
`reports.js`:

```js
if (req.user.role !== 'manager') return res.status(403).send('Forbidden');
```

There is no `requireRole()` guard. A handler added without the check has no safety net, and
nothing in the codebase makes the omission visible. Given H2 shows access-control code already
drifting out of sync with the schema, this is a live risk rather than a stylistic one.

### M3 — Non-ISO week number computation

`backend/models/Report.js:28-33`

```js
weekNumber: { type: Number, default: function() {
  const date = new Date();
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + start.getDay() + 1) / 7);
}},
```

Three problems. It is not ISO-8601 week numbering, so it disagrees with any external calendar.
It uses local server time, so the same submission gets a different week depending on deployment
timezone. And it can return 53 or an off-by-one at year boundaries.

This matters more than it looks: `weekNumber` is denormalized onto every report, indexed
(`{ year: 1, weekNumber: 1, submissionDate: -1 }`), and drives `/reports/week/:weekNumber`,
`/reports/weekly-summary`, and the analytics endpoints. Existing stored data already carries
whatever this produced.

### M4 — `weekNumber` reflects submission time, not the reporting period

Same code as M3. A report submitted Monday about the previous week is filed under the current
week. There is no user-supplied period field. Late submissions are silently misattributed.

### M5 — `401` vs `400` on failed login

`backend/routes/auth.js:107,114` return `400` for both "user not found" and "password mismatch".
The correct status is `401`. Clients cannot distinguish a validation error from an auth failure
without parsing the message string.

Positively: both paths return the same `'Invalid credentials'` message, so user existence is not
leaked.

### M6 — Corporate email regex duplicated

`/^[\w.-]+@bankofabyssinia\.com$/` appears in both `backend/models/User.js` (schema `match`) and
`backend/routes/auth.js:24`. A domain change requires two edits, and the two can silently
diverge.

### M7 — Email case sensitivity allows duplicate accounts

`backend/routes/auth.js:32` — `User.findOne({ email })` with no normalization. MongoDB comparison
is case-sensitive, so `Foo@bankofabyssinia.com` and `foo@bankofabyssinia.com` are distinct users
and both pass the uniqueness check. Login then depends on typing the same case used at
registration.

### M8 — `reset-password` does not validate the new password

`backend/routes/auth.js:306-308` hashes `newPassword` without checking that it exists or meets
any policy. If the field is absent, `bcrypt.hash(undefined, salt)` throws and the user gets a
generic `500`. There is no minimum length or complexity rule anywhere in the codebase, on this
route or on registration.

### M9 — No password change flow for the account owner

Only `POST /auth/reset-password` exists, and it is restricted to supervisors and managers acting
on other users (`backend/routes/auth.js:294-304`). A staff member cannot change their own
password. Managers cannot change theirs either, since the branch requires the target to be staff
or supervisor.

### M10 — Client cannot be deployed

`http://localhost:5000` is hardcoded at roughly 30 fetch sites in
`staff_report_management_system/src/`. There is no `REACT_APP_API_URL`. A production build points
at the user's own machine.

Symmetrically, `backend/index.js:54` hardcodes `app.listen(5000)` with no `process.env.PORT`
fallback, which breaks on platforms that assign a port.

### M11 — No `.env.example`

Three variables are required (`MONGODB_URI`, `JWT_SECRET`, `NODE_ENV`) and two cause
`process.exit(1)` when missing (`backend/index.js:12-20`). None are documented. A new checkout
cannot be run without reading the source.

### M12 — `backend/.gitignore` does not ignore `.env`

`backend/.gitignore` is a copy of the CRA frontend template. It covers `.env.local`,
`.env.development.local`, and friends, but not plain `.env`. The root `.gitignore` does cover
`backend/.env`, so the secret is protected — by the outer file only. Anyone reasoning from the
local ignore file would conclude wrongly.

## Low

### L1 — Dead and orphaned files

| File | Issue |
|---|---|
| `backend/server.js` | 1 line, unreferenced; `package.json` `main` is `index.js` |
| `src/components/shared/TemplateSelection.css` | no corresponding component |
| `src/reportWebVitals.js` | wired but never used |
| `src/logo.svg` | CRA default |

### L2 — Duplicate components

`FilePreview`, `KeyboardShortcuts`, and `LoadingSpinner` each exist twice — once at
`src/components/` and once at `src/components/shared/`. A partial extraction was never finished.
Which copy is live must be checked per importer.

Near-duplicates also exist across roles: `PasswordReset`, `Overview`, and `Settings` are
reimplemented in both `manager/` and `supervisor/`.

### L3 — Oversized files

| File | Lines |
|---|---|
| `src/components/ManagerDashboard.js` | 1,687 |
| `backend/routes/reports.js` | 776 |
| `src/components/SupervisorDashboard.js` | 648 |
| `src/components/StaffDashboard.js` | 634 |

`ManagerDashboard.js` is 12% of the frontend in a single file.

### L4 — Unbranded application shell

`public/index.html` still has `<title>React App</title>` and `<meta name="theme-color" content="#000000">`.
`public/manifest.json` still says `"name": "Create React App Sample"`, `"short_name": "React App"`.
Real brand assets (`logo-removebg-preview.png`, `amharic text.PNG`) sit unused beside them.

### L5 — Filename with a space

`public/amharic text.PNG` — breaks unquoted shell paths and needs URL encoding.

### L6 — Dead Mongoose options

`backend/index.js:27-28` passes `useNewUrlParser` and `useUnifiedTopology`. Both were removed as
meaningful options in driver v4; under Mongoose 8 they are ignored.

### L7 — `console.*` as the only logging

50 calls in the backend, 39 in the frontend. No log levels, no structure, no request IDs, no
redaction. Not operable in a deployed environment.

### L8 — Health check does not check health

`backend/index.js:52` returns `{ status: 'OK' }` unconditionally. It does not test the MongoDB
connection, so a load balancer sees a healthy process with a dead database.

### L9 — No connection retry

`backend/index.js:29-33` calls `process.exit(1)` on the initial connect failure. A transient
network blip at boot kills the container instead of retrying.

### L10 — UTF-8 BOM in one file

`backend/models/Template.js` begins with a byte-order mark (`EF BB BF`) — the only file in the
repo that does. Harmless under Node but a diff-noise source and a hazard for tooling that
concatenates files.

### L11 — Testing dependencies installed but unused

Four `@testing-library/*` packages are dependencies. The only test is the CRA boilerplate in
`src/App.test.js`, which asserts a "learn react" link that this app does not render — so it is
failing or has never been run. See TESTING.md.

### L12 — One stale TODO

`src/components/StaffDashboard.js:18` — `// TODO: remove if no longer used`.

## Absent Capabilities

Not defects, but gaps that shape the roadmap:

| Missing | Consequence |
|---|---|
| Email delivery | approval and rejection decisions notify nobody |
| Object storage | uploads do not survive a container redeploy |
| CI | nothing verifies a commit |
| Rate limiting | brute force is unbounded (H3) |
| Token refresh | 24h expiry with no refresh means a hard logout mid-session |
| Structured logging / error tracking | no post-incident visibility |
| Audit trail | no record of who approved, rejected, or reset what, beyond fields on the affected document |
| Pagination defaults on the server | list endpoints appear to return full collections |

## Positives Worth Preserving

The codebase is not uniformly weak, and a rewrite should carry these forward deliberately:

- **No secrets committed.** `.env` is excluded by the root `.gitignore`. Unlike some sibling
  repositories in this collection, SRMS leaks no credentials.
- **JWT expiry is set** — `{ expiresIn: '24h' }` at `backend/routes/auth.js:135`.
- **bcrypt with per-user salt**, cost 10, used consistently at registration and reset.
- **Uniform "Invalid credentials" message** on both login failure paths — no user enumeration.
- **Fail-fast env validation** at boot (`backend/index.js:12-20`).
- **Deliberate compound indexes** on `Report`, `Template`, and `FileMetadata`, matching real
  query shapes.
- **Password never returned** — `/auth/profile` uses `.select('-password')`.
- **Role-appropriate report scoping** — `backend/routes/reports.js:127-129` narrows the query for
  staff rather than filtering client-side.
- **Approval status surfaced with reasons** on rejected login, which is good product behavior.

## Severity Summary

| Severity | Count | Items |
|---|---|---|
| Critical | 3 | C1 path traversal, C2 blanket file access, C3 password logging |
| High | 6 | H1 dead error handler, H2 dead access-check branches, H3 no rate limit, H4 open CORS, H5 committed uploads, H6 unrestricted upload |
| Medium | 12 | M1-M12 |
| Low | 12 | L1-L12 |

**Immediate action, independent of the rewrite:** C1, C2, and C3 are exploitable in the current
public repository. C3 also means any log retained from a past run may contain real passwords.

---
*Concerns analysis: 2026-08-08*
<!-- refreshed: 2026-08-08 -->
