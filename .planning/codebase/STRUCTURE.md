# Directory Structure

**Analysis Date:** 2026-08-08

## Top Level

```
SRMS/
├── README.md                          137 lines — refactor guide, not setup docs
├── .gitignore                         root-level, covers both apps
├── backend/                           Express API
└── staff_report_management_system/    Create React App SPA
```

No monorepo tooling — no workspaces, no Turborepo, no Nx, no root `package.json`. The two apps
are installed and run independently. There is no `.github/`, no Dockerfile, no `docs/`.

The frontend directory name (`staff_report_management_system`) is snake_case and 30 characters,
while the repo is `SRMS` and the backend is `backend`. Inconsistent, and long enough to make
every path in the app awkward.

## Backend

```
backend/
├── index.js                    55    entry: env check, DB connect, mounts, listen
├── server.js                    1    near-empty, dead file
├── package.json                29
├── package-lock.json         1748
├── .gitignore                  23    CRA-derived, wrong for a backend
├── check-mongodb.js            59    connectivity helper (npm run check-mongodb)
├── seed-dummy-accounts.js     177    seeds test users (npm run seed)
├── middleware/
│   └── auth.js                 26    the only middleware file
├── models/
│   ├── User.js                 42
│   ├── Report.js               64
│   ├── Template.js             94    largest model — nested fieldSchema
│   ├── Database.js             27
│   └── FileMetadata.js         28
├── routes/
│   ├── reports.js             776    largest file in the backend
│   ├── analytics.js           438
│   ├── auth.js                317
│   ├── templates.js           222
│   └── databases.js           174
└── uploads/                        22 committed .PNG/.png files, 5.5 MB
```

Backend application code totals roughly 2,500 lines, of which ~1,900 are route handlers.

### Notes

- `backend/server.js` is 1 line and unreferenced — `package.json` `main` is `index.js`. Dead.
- `backend/.gitignore` is a copy of the CRA template: it ignores `/build` and `.env.local`
  variants but **not** plain `.env`. The root `.gitignore` does cover `backend/.env`, so the
  secret is protected — but by the outer file, not the local one.
- `backend/uploads/` holds real user-uploaded images committed to git history.
- There is no `.env.example`, so the three required variables are undocumented.

## Frontend

```
staff_report_management_system/
├── package.json                       CRA manifest
├── public/
│   ├── index.html                     <title>React App</title> — unbranded
│   ├── manifest.json                  "Create React App Sample" — unbranded
│   ├── favicon.ico
│   ├── logo192.png
│   ├── logo512.png
│   ├── logo-removebg-preview.png      real brand asset
│   ├── amharic text.PNG               real brand asset — space in filename
│   └── robots.txt
└── src/
    ├── index.js                       React root
    ├── index.css
    ├── App.js                    27   router, 6 flat routes
    ├── App.css
    ├── App.test.js                    CRA default smoke test — the only test
    ├── setupTests.js              5
    ├── reportWebVitals.js        13   wired, unused
    ├── logo.svg                       CRA default
    └── components/
```

### `src/components/` layout

```
components/
├── Login.js                187   ┐
├── Signup.js               286   │ auth screens
├── StaffDashboard.js       634   ┐
├── SupervisorDashboard.js  648   │ role dashboards
├── ManagerDashboard.js   1,687   ┘ largest file in the repo
├── Toast.js / ToastContainer.js  global notifications
├── FilePreview.js                ┐
├── KeyboardShortcuts.js    114   │ duplicated in shared/
├── LoadingSpinner.js             ┘
│
├── shared/                       cross-role components
│   ├── DynamicForm.js      265   renders forms from Template.fields[]
│   ├── FiltersToolbar.js   132
│   ├── ReportCard.js
│   ├── FileUploadSection.js
│   ├── DatabaseInfoSection.js
│   ├── TextAreasSection.js
│   ├── YesNoSelectorsSection.js
│   ├── TemplateSelection.css     ← CSS with no matching .js
│   ├── FilePreview.js            ← duplicate
│   ├── KeyboardShortcuts.js      ← duplicate
│   └── LoadingSpinner.js         ← duplicate
│
├── manager/
│   ├── ManagerSidebar.js
│   ├── ManagerAnalytics.js 268
│   ├── TemplateManager.js  431
│   ├── PasswordReset.js
│   ├── overview/Overview.js
│   ├── reports/CreateReport.js
│   ├── staffReports/StaffReports.js
│   ├── staff/StaffManagement.js
│   ├── templates/Templates.js
│   ├── userApproval/UserApproval.js
│   ├── users/UsersGrid.js, UserCard.js
│   ├── databases/Databases.js
│   └── settings/Settings.js       107
│
├── supervisor/
│   ├── SupervisorSidebar.js
│   ├── PasswordReset.js           ← near-duplicate of manager/PasswordReset.js
│   ├── overview/Overview.js       ← near-duplicate of manager/overview/Overview.js
│   ├── reports/Reports.js
│   ├── createReport/CreateReport.js
│   └── settings/Settings.js       ← near-duplicate of manager/settings/Settings.js
│
└── staff/
    ├── StaffSidebar.js
    ├── StaffPagination.js
    ├── StaffTemplatesModal.js
    ├── Sidebar.css
    └── Pagination.css
```

78 files, ~14,000 lines total; ~6,500 lines in `.js`, the remainder CSS.

## Organizational Patterns

Three competing conventions coexist, which is the clearest structural signal that the codebase
grew by accretion:

1. **Flat, at `components/` root** — `Login.js`, `Signup.js`, the three dashboards, `Toast.js`
2. **By role, flat** — `manager/ManagerSidebar.js`, `staff/StaffSidebar.js`
3. **By role, then by feature folder** — `manager/userApproval/UserApproval.js`,
   `supervisor/createReport/CreateReport.js`

Nesting depth ranges from 1 to 3 levels for components of equivalent importance. The feature
folders mostly contain a single file, so the extra level buys nothing.

## CSS Colocation

CSS sits beside its component, with dark mode split into parallel files:

```
components/manager/users/
├── UserCard.js
├── UsersGrid.js
├── Users.css              base
├── Users.dark.css         dark overrides
└── Users.manager.css      manager-scoped overrides
```

Four naming variants are in use: `Name.css`, `Name.dark.css`, `Name.manager.css`,
`ReportCard.manager.css`. Three files carry a `.dark.css` sibling; the rest hardcode both themes
inline. `shared/TemplateSelection.css` has no corresponding component file — orphaned.

## Naming Conventions

| Kind | Convention | Examples |
|---|---|---|
| React components | PascalCase, `.js` (not `.jsx`) | `ManagerDashboard.js`, `DynamicForm.js` |
| Component folders | camelCase | `userApproval/`, `staffReports/`, `createReport/` |
| Backend files | camelCase or kebab | `auth.js`, `check-mongodb.js`, `seed-dummy-accounts.js` |
| Models | PascalCase, singular | `User.js`, `Report.js`, `FileMetadata.js` |
| Routes | lowercase plural | `reports.js`, `databases.js`, `analytics.js` |
| CSS | matches component, dotted qualifiers | `Users.dark.css` |
| Frontend root dir | snake_case | `staff_report_management_system/` |

`.jsx` is never used despite every component file containing JSX.

## Key Locations

Where to look for a given concern:

| Need | Path |
|---|---|
| API entry, mounts, env validation | `backend/index.js` |
| JWT verification | `backend/middleware/auth.js` |
| Report business logic | `backend/routes/reports.js` |
| Analytics aggregations | `backend/routes/analytics.js` |
| Login / register / approvals | `backend/routes/auth.js` |
| Template CRUD | `backend/routes/templates.js` |
| Dynamic form field definition | `backend/models/Template.js` |
| Dynamic form rendering | `src/components/shared/DynamicForm.js` |
| Client routing | `src/App.js` |
| Role dashboards | `src/components/{Staff,Supervisor,Manager}Dashboard.js` |
| Brand assets | `staff_report_management_system/public/` |
| Brand colors | hardcoded across 30+ `.css` files — no central token file |

## Structural Debt Summary

| Item | Detail |
|---|---|
| Dead files | `backend/server.js` (1 line), `shared/TemplateSelection.css` (orphan) |
| Duplicate components | `FilePreview`, `KeyboardShortcuts`, `LoadingSpinner` — two copies each |
| Near-duplicate role code | `PasswordReset`, `Overview`, `Settings` across `manager/` and `supervisor/` |
| Oversized files | `ManagerDashboard.js` 1,687 lines; `routes/reports.js` 776 lines |
| Committed binaries | `backend/uploads/` — 22 files, 5.5 MB in git history |
| Unbranded shell | `index.html` title and `manifest.json` still say "React App" |
| Filename with space | `public/amharic text.PNG` |
| Missing | `.env.example`, CI config, lint script, formatter config |

---
*Structure analysis: 2026-08-08*
<!-- refreshed: 2026-08-08 -->
