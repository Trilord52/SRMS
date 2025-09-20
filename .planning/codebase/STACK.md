# Technology Stack

**Analysis Date:** 2026-08-08

## Overview

SRMS (Staff Report Management System) is a two-app MERN repository built for Bank of Abyssinia
internal weekly reporting. The backend is a plain CommonJS Express API; the frontend is a
Create React App single-page application. There is no monorepo tooling — the two apps are
sibling directories with independent `package.json` files and are installed and run separately.

## Languages & Runtime

| Concern | Value | Evidence |
|---|---|---|
| Language | JavaScript (ES2020+, CommonJS on the server, ESM/JSX in the client) | no `tsconfig.json` anywhere |
| Server module system | CommonJS (`require` / `module.exports`) | `backend/index.js` |
| Client module system | ESM via `react-scripts` bundler | `staff_report_management_system/src/index.js` |
| Node version | unpinned — no `engines` field, no `.nvmrc` | `backend/package.json` |
| Type checking | none | no TypeScript, no JSDoc type annotations |

**Note:** the absence of a pinned Node version is a reproducibility gap. Express 5 requires
Node 18+; Mongoose 8 requires Node 16+. Effective floor is Node 18.

## Backend Stack

Manifest: `backend/package.json` (name `backend`, version `1.0.0`, license ISC)

| Package | Version | Role |
|---|---|---|
| `express` | ^5.1.0 | HTTP framework |
| `mongoose` | ^8.16.5 | MongoDB ODM — all 5 models |
| `mongodb` | ^6.18.0 | native driver, used directly for database introspection |
| `jsonwebtoken` | ^9.0.2 | JWT signing and verification |
| `bcryptjs` | ^3.0.2 | password hashing, salt rounds 10 |
| `multer` | ^2.0.2 | multipart file uploads to disk |
| `cors` | ^2.8.5 | CORS, currently wide open |
| `dotenv` | ^17.2.1 | env loading |
| `nodemon` | ^3.0.0 (dev) | watch-mode restart |

Both `mongoose` and the raw `mongodb` driver are present. Mongoose covers the app's own
collections; the native driver backs the "database inspection" feature in
`backend/routes/databases.js`.

### Backend scripts

```json
"start": "node index.js"
"dev": "nodemon index.js"
"seed": "node seed-dummy-accounts.js"
"check-mongodb": "node check-mongodb.js"
"test": "echo \"Error: no test specified\" && exit 1"
```

`test` is the npm placeholder — it exits non-zero. There is no backend test runner.

## Frontend Stack

Manifest: `staff_report_management_system/package.json` (version 0.1.0, private)

| Package | Version | Role |
|---|---|---|
| `react` / `react-dom` | ^19.1.1 | UI runtime |
| `react-scripts` | 5.0.1 | build tooling (Create React App) |
| `react-router-dom` | ^6.20.1 | client routing, 6 routes |
| `recharts` | ^3.1.2 | analytics charts |
| `reactjs-file-preview` | ^1.0.11 | file preview widget |
| `web-vitals` | ^2.1.4 | perf reporting, wired but unused |
| `@testing-library/react` | ^16.3.0 | present, effectively unused |
| `@testing-library/jest-dom` | ^6.6.4 | present, effectively unused |
| `@testing-library/user-event` | ^13.5.0 | present, effectively unused |
| `@testing-library/dom` | ^10.4.1 | present, effectively unused |

### Frontend scripts

```json
"start": "react-scripts start"
"build": "react-scripts build"
"test":  "react-scripts test"
"eject": "react-scripts eject"
```

### Styling

Plain CSS, no preprocessor, no CSS-in-JS, no utility framework. 30+ `.css` files colocated
with components. Dark mode is implemented as separate hand-written override files
(`Users.dark.css`, `FileUploadSection.dark.css`, `FiltersToolbar.dark.css`,
`ReportCard.dark.css`) toggled by a `darkMode` flag in `localStorage`.

No CSS custom properties are defined anywhere. Every color is a hardcoded literal. Dominant
values by frequency: `#ffbf00` (75 uses, brand amber), `#333` (62), `#ffffff` (58), `#666` (49),
`#555555` (41), `#e1e5e9` (39), `#f8f9fa` (36), `#404040` (29), `#dc3545` (27), `#28a745` (14).

## Configuration

Environment variables — all backend, none on the client:

| Variable | Required | Used in |
|---|---|---|
| `MONGODB_URI` | yes, process exits if unset | `backend/index.js` |
| `JWT_SECRET` | yes, process exits if unset | `backend/index.js`, `backend/middleware/auth.js` |
| `NODE_ENV` | optional, gates error detail | `backend/index.js`, route error handlers |

There is **no `.env.example`** in the repository, so required configuration is undocumented.
`.env` files are correctly gitignored at the root `.gitignore` for both apps.

The server port is hardcoded to `5000` in `backend/index.js` — not configurable via env.

The client has no API base URL configuration; `http://localhost:5000` is hardcoded across
roughly 30 call sites in `src/`.

## Build & Tooling

| Tool | State |
|---|---|
| Bundler | `react-scripts` 5.0.1 (webpack 5, CRA) — upstream unmaintained |
| Linting | only CRA's built-in `eslintConfig` (`react-app`, `react-app/jest`). No standalone ESLint config, no lint script |
| Formatting | none — no Prettier, no EditorConfig |
| CI | none — no `.github/` directory |
| Containers | none — no Dockerfile, no compose file |
| Package manager | npm (lockfile `backend/package-lock.json`, 1748 lines) |

## Notable Stack Risks

- `react-scripts` 5.0.1 is end-of-life. React 19 runs on it but this is a dead toolchain.
- No TypeScript across ~16,000 lines of application code.
- Client and server share no types or validation schemas; request/response shapes are implicit.
- Testing dependencies are installed but only the CRA default smoke test exists.

---
*Stack analysis: 2026-08-08*
<!-- refreshed: 2026-08-08 -->
