# Staff Report Management System – Refactor & Modularization Guide (2025)

This document summarizes all improvements, refactors, and new features added across the frontend and backend integration during this iteration. It also documents the new file/folder structure, running instructions, and developer notes to help future maintenance.

## What’s New (High-Level)
- Frontend modularization of large dashboards (Staff, Manager, Supervisor) into clean, reusable components
- Robust file preview system (images/PDFs) for uploads and history with quick inline preview buttons
- Manager analytics dashboard with period/staff filters and drilldown charts (Recharts)
- Complete Manager user approvals and all users tabs (with approve/reject and detailed user info)
- Confirmation dialogs for risky actions (report submit; database create/update/delete)
- CSS refactor into feature-scoped modules, plus dark-mode overrides in dedicated files

## Updated Project Structure (Frontend)
- `src/components/staff/`
  - `StaffSidebar.js`, `StaffPagination.js`, `StaffTemplatesModal.js`
  - `Sidebar.css`, `Pagination.css`
- `src/components/manager/`
  - `ManagerAnalytics.js`, `ManagerAnalytics.css`
  - `ReportCard.manager.css`
  - `users/UsersGrid.js`, `users/UserCard.js`, `users/Users.css`, `users/Users.dark.css`, `users/Users.manager.css`
- `src/components/supervisor/`
  - (Reserved for future supervisor-specific components)
- `src/components/shared/`
  - UI: `FileUploadSection.js`, `FiltersToolbar.js`, `ReportCard.js`
  - Forms: `DatabaseInfoSection.js`, `YesNoSelectorsSection.js`, `TextAreasSection.js`
  - Base CSS: `FileUploadSection.css`, `FiltersToolbar.css`, `ReportCard.css`, `DatabaseInfoSection.css`, `YesNoSelectorsSection.css`, `TextAreasSection.css`
  - Dark CSS: `FileUploadSection.dark.css`, `FiltersToolbar.dark.css`, `ReportCard.dark.css`
- Large dashboards now import only the modular CSS they need, keeping dashboard CSS slim and focused on unique overrides.

## Key Frontend Changes
- Staff and Supervisor Dashboards
  - Extracted report form sections into shared components:
    - `DatabaseInfoSection` (database + auto-populated tech fields)
    - `YesNoSelectorsSection` (Synchronization/Backup/Resource)
    - `TextAreasSection` (Incident Reports/Additional Remarks)
  - Replaced inline upload sections with `FileUploadSection` including quick inline 👁️ preview button
  - Replaced filters toolbars with `FiltersToolbar`
  - Replaced report cards/list grid with `ReportCard`
  - File Preview
    - Handlers now accept either a `File` object or a server-side `filename` string
    - `FilePreview` is invoked with `{ file, filename }` so images/PDFs load reliably from local or server
  - Confirmations
    - Staff: report submission confirmation (already existed)
    - Supervisor: report submission confirmation added

- Manager Dashboard
  - Sidebar unified with `StaffSidebar`
  - Analytics panel (`ManagerAnalytics`)
    - Period filters: daily/weekly/monthly/annually
    - Staff filter (populated from `staffList`)
    - Drilldown: `/analytics/staff-performance` when a staff is selected
    - Charts powered by Recharts (line, bar, pie)
  - Users tabs
    - `UsersGrid` + `UserCard` for Pending Approvals and All Users
    - Approve/reject actions with visual badges and toasts
  - Databases
    - Confirmation prompts added for create/update/delete
  - File preview reliability: same `{ file | filename }` improvements applied

## CSS Modularization
- Moved shared, repeated blocks out of the large dashboard CSS files into:
  - `shared/FiltersToolbar.css`, `shared/ReportCard.css`, `shared/FileUploadSection.css`, `staff/Pagination.css`, `staff/Sidebar.css`
- Created dark-mode overrides:
  - `shared/FiltersToolbar.dark.css`, `shared/ReportCard.dark.css`, `shared/FileUploadSection.dark.css`, `manager/users/Users.dark.css`
- Manager-only overrides (theme/hover/spacing) moved to:
  - `manager/ReportCard.manager.css`, `manager/users/Users.manager.css`
- The large `StaffDashboard.css`, `SupervisorDashboard.css`, and `ManagerDashboard.css` were trimmed to keep only dashboard-specific or advanced/dark overrides not covered by shared modules.

## Backend Integration Notes
- The backend already provides:
  - `/analytics/dashboard` for overall KPIs, review stats, completion rate, submission trends
  - `/analytics/staff-performance` for per-staff drilldowns
  - `/analytics/database-performance` for DB aggregations
- Dashboards authenticate requests with the saved JWT token
- `FilePreview` downloads server files via `GET /reports/download/:filename` when `filename` is passed

## Running the App
Prerequisites
- Node.js (v14+), npm
- MongoDB running locally or a MongoDB Atlas connection string

Backend
```bash
cd backend
npm install
# create .env
# MONGODB_URI=your_mongodb_uri
# JWT_SECRET=your_secret
npm start
# Check: http://localhost:5000/health
```

Frontend
```bash
cd staff_report_management_system
npm install
# For charts
npm install recharts
npm start
# App: http://localhost:3000
```

Environment Variables
- Backend `.env`
  - `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV`
- Frontend `.env` (optional)
  - `REACT_APP_API_BASE` (defaults used in code: `http://localhost:5000`)

## Usage Tips
- Staff/Supervisor
  - Fill form -> use quick 👁️ to preview local image/PDF files
  - Submit: confirmation prompt
  - History: preview/download per attachment
- Manager
  - Overview: analytics cards + charts
  - Switch period/staff for filtered charts; drilldown appears when staff is selected
  - Users: manage approvals in `User Approval`; see all accounts in `All Users`
  - Databases: add/edit/delete (with confirmation); see related reports updates

## Contributing Guidelines
- Prefer feature-scoped components and CSS under `components/shared/` or role folders
- Keep dark-mode overrides in `*.dark.css` modules when possible
- When adding backend endpoints, document expected payloads and update the analytics consumers in `ManagerAnalytics.js`

## Troubleshooting
- File previews don’t load for server files
  - Ensure `filename` is passed to `FilePreview` when previewing history items (the code now handles this)
- Charts not rendering
  - Ensure Recharts is installed in the frontend app
- Auth issues
  - Confirm `token` and `user` exist in localStorage and are valid

---

**Last Updated**: December 2024
**Version**: 2.0.0
**Status**: Production Ready
