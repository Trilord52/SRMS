# External Integrations

**Analysis Date:** 2026-08-08

## Summary

SRMS has a small integration surface: one database, one self-hosted auth scheme, local disk
file storage, and no third-party services. There are no webhooks, no payment providers, no
email/SMS senders, and no analytics or telemetry vendors.

## Database — MongoDB

| Aspect | Detail |
|---|---|
| Engine | MongoDB (Atlas assumed — `backend/index.js` comment says "Connect to MongoDB Atlas using .env") |
| Client | `mongoose` ^8.16.5 for app collections; `mongodb` ^6.18.0 native driver for introspection |
| Connection | `mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })` |
| Failure mode | `process.exit(1)` on connect error — no retry, no backoff |
| Health check | `GET /health` returns `{ status: 'OK' }` but does **not** check DB connectivity |
| Helper script | `backend/check-mongodb.js` (59 lines), run via `npm run check-mongodb` |

`useNewUrlParser` and `useUnifiedTopology` are no-ops in Mongoose 8 — they were removed as
meaningful options in driver v4. Harmless but dead configuration.

### Collections (Mongoose models)

| Model | File | Key fields |
|---|---|---|
| `User` | `backend/models/User.js` | firstName, lastName, userId, email (regex-locked), role, password, isApproved, approvalStatus, approvedBy, approvedAt, rejectionReason, department, phoneNumber, registrationDate |
| `Report` | `backend/models/Report.js` | templateId, templateData (Mixed), templateVersion, revisionOf, submittedBy, submissionDate, weekNumber/year/month/day, reviewedBy, reviewStatus, reviewComments, supervisorComments, rejectionReason, reviewedAt, files[] |
| `Template` | `backend/models/Template.js` | name, description, category (enum, 9 values), fields[] (nested fieldSchema), isActive, version, createdBy, lastModifiedBy, timestamps |
| `Database` | `backend/models/Database.js` | database, databaseType, ipAddress, dbVersion, osVersion, createdBy, customFeatures[], isActive |
| `FileMetadata` | `backend/models/FileMetadata.js` | filename, originalName, mimetype, size, uploadedBy, uploadedAt, reportId, fileType, canPreview, previewUrl, thumbnailUrl, width, height, pageCount, documentType |

### Indexes

Declared explicitly, which is unusual for a project this size and worth preserving:

```js
// Report
{ year: 1, weekNumber: 1, submissionDate: -1 }
{ submittedBy: 1, submissionDate: -1 }
{ reviewStatus: 1, submissionDate: -1 }
{ revisionOf: 1, submissionDate: -1 }

// Template
{ category: 1, isActive: 1 }
{ createdBy: 1 }

// FileMetadata
{ filename: 1 }
{ uploadedBy: 1 }
{ reportId: 1 }
```

## Managed Database Inventory (self-referential feature)

The `Database` model and `backend/routes/databases.js` are **not** an integration in the
outbound sense — they are an inventory feature. Managers register external database servers
(name, type, IP address, version, OS version) as records, and the app exposes schema and
performance views over them:

- `GET /databases/available`
- `GET /databases/:id/schema`
- `GET /analytics/database-performance`
- `GET /reports/database/:databaseName`

`ipAddress` is stored as a plain required string with no validation. Whether the app actually
connects to those hosts or only records metadata needs confirmation when reading
`routes/databases.js` in full — the native `mongodb` driver dependency suggests live
introspection at least for MongoDB targets.

## Authentication — self-hosted JWT

No external identity provider. No OAuth, no SSO, no SAML, no MFA.

| Aspect | Detail |
|---|---|
| Scheme | Bearer JWT in `Authorization` header |
| Verify | `jwt.verify(token, process.env.JWT_SECRET)` in `backend/middleware/auth.js` |
| Payload | `{ userId }` — resolved to a full `User` document on every request |
| Password hashing | bcryptjs, `genSalt(10)` |
| Expiry | not set at verification time; token lifetime is whatever `/auth/login` signs |
| Client storage | `localStorage` keys `token` and `user` |
| Refresh | none — no refresh token flow |

### Organizational constraint

Email is regex-locked to a single corporate domain in **two** places:

```js
// backend/models/User.js  (schema match)
/^[\w.-]+@bankofabyssinia\.com$/
// backend/routes/auth.js  (route-level check)
/^[\w.-]+@bankofabyssinia\.com$/
```

Duplicated literal — a domain change requires edits in both files.

### Roles

Three roles enum'd on `User`: `staff`, `supervisor`, `manager`. Enforced by inline
`req.user.role !== '...'` comparisons scattered through route handlers (see CONVENTIONS.md).
Managers self-approve at registration; staff and supervisors enter a `pending` queue.

## File Storage — local disk

| Aspect | Detail |
|---|---|
| Library | `multer` ^2.0.2, `diskStorage` |
| Destination | `uploads/` relative to backend CWD, `mkdirSync` on demand |
| Filename | `Date.now() + '-' + file.originalname` |
| Limits | **none** — no `limits`, no `fileFilter`, no MIME allowlist |
| Download | `GET /reports/download/:filename` |
| Preview | client-side via `reactjs-file-preview` |

No object storage (no S3, GCS, Azure Blob). Uploads are ephemeral on any container-based
deploy and will not survive a redeploy. 22 real uploaded files (5.5 MB) are committed to git
under `backend/uploads/`.

## Client → Server Wiring

The frontend calls the API with bare `fetch` and a hardcoded origin. No API client module, no
axios, no interceptor. Sample of call-site counts by path:

```
7×  http://localhost:5000/reports
7×  http://localhost:5000/api/templates/
4×  http://localhost:5000/reports/download/
3×  http://localhost:5000/api/templates
2×  http://localhost:5000/databases
2×  http://localhost:5000/auth/staff
2×  http://localhost:5000/auth/reset-password
2×  http://localhost:5000/analytics/dashboard
```

`http://localhost:5000` is unconfigurable, so the built client cannot reach a deployed API
without a code change.

## CORS

`app.use(cors())` with no options — all origins, all methods allowed. Acceptable for local
development, unsuitable for deployment.

## Absent Integrations

Worth stating explicitly, because the reporting domain would normally imply some of these:

- No email delivery — approval and rejection decisions notify nobody
- No scheduled jobs or cron — "weekly report" cadence is entirely manual
- No error tracking (no Sentry) and no structured logging
- No secret manager — env vars only
- No PDF/XLSX generation library, despite `/reports/export` and `/analytics/export` endpoints

---
*Integrations analysis: 2026-08-08*
<!-- refreshed: 2026-08-08 -->
