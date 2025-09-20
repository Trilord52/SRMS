# Architecture

**Analysis Date:** 2026-08-08

## Pattern

Classic two-tier client/server. A REST-ish Express API over MongoDB, consumed by a React SPA.
No shared code, no shared types, no build coupling between the two halves — they communicate
only over HTTP and are deployed, installed, and versioned independently.

```
React SPA (CRA, port 3000)
        │  fetch, hardcoded http://localhost:5000
        ▼
Express API (port 5000, hardcoded)
        │  Mongoose ODM  +  native mongodb driver
        ▼
MongoDB (Atlas)          local disk ./uploads/
```

There is no service layer, no repository layer, and no dependency injection. Route handlers
talk to Mongoose models directly.

## Backend Layers

Only three layers exist, and one of them is thin:

| Layer | Location | Responsibility |
|---|---|---|
| Entry / composition | `backend/index.js` (55 lines) | env validation, DB connect, middleware, route mounting, listen |
| Middleware | `backend/middleware/auth.js` (26 lines) | JWT verify → attach `req.user` |
| Routes | `backend/routes/*.js` (~1,900 lines) | validation, authorization, business logic, DB queries, response shaping |
| Models | `backend/models/*.js` (~250 lines) | Mongoose schemas + indexes |

**Business logic lives in route handlers.** `routes/reports.js` alone is 776 lines. This is the
single most consequential architectural fact about the backend: there is no layer that can be
unit-tested without an HTTP server and a live database.

### Entry point — `backend/index.js`

Execution order, which matters:

1. `require('dotenv').config()`
2. Fail-fast env validation — `MONGODB_URI` and `JWT_SECRET`, each `process.exit(1)` if absent
3. `app.use(cors())`, `app.use(express.json())`
4. **Global error handler registered here** — before the routes
5. Route mounts
6. `GET /health`
7. `app.listen(5000)`

Step 4 is a real bug, not a style question. Express matches error middleware by registration
order, so an error handler mounted *above* the routes never sees errors thrown by them. The
handler at `backend/index.js:36` is dead code; unhandled route errors fall through to Express's
default handler instead. Each route file compensates with its own try/catch.

### Route mounting and prefix inconsistency

```js
app.use('/auth',           authRoutes);        // routes/auth.js       317 lines
app.use('/reports',        reportRoutes);      // routes/reports.js    776 lines
app.use('/databases',      databaseRoutes);    // routes/databases.js  174 lines
app.use('/analytics',      analyticsRoutes);   // routes/analytics.js  438 lines
app.use('/api/templates',  require('./routes/templates')); // 222 lines
```

Four routers mount at the bare root; one mounts under `/api`. The inline `require` on the last
line also breaks the import-at-top convention used for the other four. There is no versioning
on any prefix.

Total surface: **40 endpoints** across 5 routers.

### Request flow

```
request
  → cors
  → express.json
  → router match
  → authenticate (per-route, where applied)   middleware/auth.js
      jwt.verify(token, JWT_SECRET) → User.findById(decoded.userId) → req.user
  → handler
      try {
        inline field validation
        inline role check: if (req.user.role !== 'manager') return 403
        Mongoose query
        res.json(...)
      } catch (error) {
        console.error(...)
        res.status(500).json({ message, error: NODE_ENV === 'development' ? ... })
      }
```

Two structural consequences:

- **A DB round-trip per authenticated request.** `authenticate` re-fetches the full `User`
  document on every call rather than trusting claims in the token. Safe (revocation works
  immediately) but unindexed-by-design cost on every request.
- **Authorization is not a middleware.** Role checks are inline `if` statements inside handlers,
  repeated ~18 times across `auth.js`, `databases.js`, and `reports.js`. There is no
  `requireRole('manager')` guard, so a handler that forgets the check has no safety net.

## Authorization Model

Three roles: `staff`, `supervisor`, `manager`.

| Capability | staff | supervisor | manager |
|---|---|---|---|
| Submit reports | ✓ | ✓ | ✓ |
| See own reports only | ✓ | | |
| Review / approve reports | | ✓ | ✓ |
| Reset staff passwords | | ✓ | ✓ |
| Reset supervisor passwords | | | ✓ |
| Approve registrations | | | ✓ |
| Manage templates | | | ✓ |
| Manage database inventory | | | ✓ |

Encoded as scattered comparisons, e.g. `backend/routes/reports.js:127-129` branches the report
query by role, and `backend/routes/auth.js:294-299` implements the password-reset hierarchy.

Two independent approval state machines share the same vocabulary, which is a documented
source of confusion:

- **User approval** — `User.approvalStatus`: `pending → approved | rejected`. Managers are
  auto-approved at registration (`backend/routes/auth.js:46-47`).
- **Report review** — `Report.reviewStatus`: `pending → approved | rejected`, with
  `Report.revisionOf` linking a resubmission back to a rejected original.

## Key Backend Abstractions

| Abstraction | Where | Note |
|---|---|---|
| `authenticate` | `middleware/auth.js` | the only reusable middleware in the codebase |
| `validateTemplateData` | `routes/reports.js:27` | route-local middleware; validates `templateData` against the referenced `Template.fields` |
| `upload` (multer) | `routes/reports.js:11-24` | disk storage, `Date.now()`-prefixed filenames, no size or MIME limits |
| Dynamic field schema | `models/Template.js` | nested `fieldSchema` with 8 field types, per-field validators, and ordering |

### The dynamic template subsystem

This is the architecturally distinctive part of SRMS and the highest-risk area for any rewrite.

`Template.fields[]` is a user-authored form definition: each field carries `name`, `type`
(`text | number | date | select | checkbox | textarea | file | yesno`), `label`, `placeholder`,
`defaultValue`, `required`, `options[]`, `validators` (`minLength`, `maxLength`, `min`, `max`,
`pattern`, `customMessage`), `order`, and `readOnly`.

Reports store submitted values in `Report.templateData` as `Schema.Types.Mixed` — schemaless —
plus `templateVersion` to record which template generation produced them. The client renders the
form from the same definition in `src/components/shared/DynamicForm.js` (265 lines).

So the contract between form rendering, server validation, and stored data is **runtime data,
not code**. Nothing static checks it. `Mixed` means Mongoose applies no validation to
`templateData` at all — `validateTemplateData` is the only guard.

## Frontend Architecture

### Composition

`src/index.js` → `src/App.js` → `BrowserRouter` with 6 flat routes:

```jsx
/                     → Login
/login                → Login
/signup               → Signup
/staff-dashboard      → StaffDashboard
/supervisor-dashboard → SupervisorDashboard
/manager-dashboard    → ManagerDashboard
```

`ToastContainer` sits outside `Router` as a global singleton.

### No route protection

Every route is public. There is no `<ProtectedRoute>`, no auth guard, no redirect on missing
token, and no role gate. Dashboards are reachable by URL regardless of login state; they simply
fail their data fetches. Access control is entirely server-side.

### Dashboard-as-god-component

Each role has one very large dashboard component that owns routing-by-tab, data fetching, and
state:

| Component | Lines |
|---|---|
| `src/components/ManagerDashboard.js` | 1,687 |
| `src/components/SupervisorDashboard.js` | 648 |
| `src/components/StaffDashboard.js` | 634 |
| `src/components/manager/TemplateManager.js` | 431 |
| `src/components/manager/ManagerAnalytics.js` | 268 |
| `src/components/shared/DynamicForm.js` | 265 |

`ManagerDashboard.js` at 1,687 lines is 12% of the frontend in one file.

### State management

No state library and no React Context. State is:

- `useState` / `useEffect` local to each dashboard
- props drilled into child components
- `localStorage` as the cross-cutting store — keys `token`, `user`, `darkMode`, `rememberMe`,
  `managerSettings`, `staffSettings`

There is no caching, no request deduplication, no retry, and no shared loading/error convention.
Each component hand-rolls its own `fetch` + `useState` triad, which is why the same report list
is refetched independently by sibling components.

### Data fetching

Bare `fetch` at roughly 30 call sites, each with a hardcoded `http://localhost:5000` origin and
a manually attached `Authorization` header. No API client module exists, so there is no single
place to change the base URL, inject the token, or handle a 401.

## Duplicate Component Tree

Several components exist twice, once at `src/components/` and once under
`src/components/shared/`:

| Component | Copies |
|---|---|
| `FilePreview` | `components/FilePreview.js`, `components/shared/FilePreview.js` |
| `KeyboardShortcuts` | `components/KeyboardShortcuts.js`, `components/shared/KeyboardShortcuts.js` |
| `LoadingSpinner` | `components/LoadingSpinner.js`, `components/shared/LoadingSpinner.js` |

A partial extraction to `shared/` was started and never finished — the originals were left in
place. Which copy each dashboard imports must be checked per file.

## Data Flow — report submission

The critical path, end to end:

```
StaffDashboard
  → GET /api/templates/available          list assignable templates
  → StaffTemplatesModal                   user picks a template
  → DynamicForm                           renders fields from Template.fields[]
  → FileUploadSection                      multipart attachments
  → POST /reports (multipart)
        validateTemplateData               checks templateData against Template.fields
        multer                             writes ./uploads/<timestamp>-<originalname>
        Report.save()                      weekNumber/year/month/day auto-derived
  → SupervisorDashboard
      → PUT /reports/:id/review            reviewStatus → approved | rejected
      → rejected: staff resubmits, new Report with revisionOf → original._id
  → ManagerDashboard / ManagerAnalytics
      → GET /analytics/dashboard, /staff-performance, /weekly-summary
```

`weekNumber` is computed in a Mongoose schema `default` function using `new Date()` at insert
time (`backend/models/Report.js`), so it reflects the submission moment, not the reporting
period. The week arithmetic there is also non-ISO — see CONCERNS.md.

## Cross-Cutting Concerns

| Concern | Implementation |
|---|---|
| Logging | `console.log` / `console.error` — 50 calls in backend routes, 39 in frontend |
| Error handling | per-handler try/catch; the global handler is unreachable |
| Validation | inline `if (!field)` checks; no schema validation library |
| Config | `process.env` read directly at point of use |
| Auth | JWT bearer, verified per route |
| Dark mode | `localStorage.darkMode` flag + parallel `.dark.css` files |

## Architectural Constraints for a Rewrite

Facts that any redesign has to respect or deliberately change:

1. **`Report.templateData` is `Mixed`.** Existing documents have no enforced shape. Migrating to
   validated schemas requires reading real data to discover actual shapes per `templateVersion`.
2. **`weekNumber` / `year` / `month` / `day` are denormalized onto every report** and three
   compound indexes depend on them. Analytics queries and the `/reports/week/:weekNumber`
   endpoint are built on this.
3. **`revisionOf` forms a self-referential chain** on `Report`. Revision history is a linked
   list, not a version array.
4. **Uploads are local disk with git-tracked history.** Any containerized deploy loses them
   without an object-storage migration.
5. **The BOA email regex is duplicated** in model and route.
6. **Two `pending/approved/rejected` state machines** coexist (`User.approvalStatus`,
   `Report.reviewStatus`) and must not be conflated in a shared type.
7. **Server port 5000 and client API origin are hardcoded**, so neither half is deployable as-is.

---
*Architecture analysis: 2026-08-08*
<!-- refreshed: 2026-08-08 -->
