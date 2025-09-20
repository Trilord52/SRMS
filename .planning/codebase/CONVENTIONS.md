# Code Conventions

**Analysis Date:** 2026-08-08

## Enforcement

Nothing is enforced automatically. There is no Prettier, no standalone ESLint config, no
EditorConfig, no lint script, no pre-commit hook, and no CI. The only linting is CRA's built-in
`eslintConfig` (`react-app`, `react-app/jest`) which runs during `react-scripts start` and warns
in the terminal without failing the build.

Consequence: the conventions below are observed regularities, not rules. Several have drifted.

## Formatting

| Aspect | Observed |
|---|---|
| Indentation | 2 spaces, consistent |
| Quotes | single quotes in JS, double in JSX attributes |
| Semicolons | present, consistent |
| Trailing commas | inconsistent |
| Line length | no limit — long ternaries and JSX lines run past 120 chars |
| Blank lines | inconsistent grouping |
| BOM | `backend/models/Template.js` begins with a UTF-8 byte-order mark (`EF BB BF`) — the only file that does |

## Backend Conventions

### Module style

CommonJS throughout, imports at the top:

```js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticate = require('../middleware/auth');
const router = express.Router();
```

One deviation: `backend/index.js:49` inlines a `require` inside the mount call
(`app.use('/api/templates', require('./routes/templates'))`) while the other four routers are
imported at the top.

### Route handler shape

Every handler follows the same skeleton — this is the codebase's most consistent pattern:

```js
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required: ...' });
    }

    // ... work ...

    res.status(201).json({ message: '...', user: { ... } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Registration failed'
    });
  }
});
```

Conventions inside it:

- `async`/`await` everywhere — no `.then()` chains, no callbacks
- destructure `req.body` on the first line
- guard clauses with early `return`, not `else` branches
- per-handler `try`/`catch`; no `next(error)` delegation and no async wrapper utility
- `console.error` with a context-prefixed label before responding

### Response conventions

Inconsistent, and worth cataloguing since a redesign has to pick one:

| Pattern | Where |
|---|---|
| `res.json({ message, ...data })` | most handlers |
| `res.status(403).send('Forbidden')` — plain text | `routes/databases.js:35,58,88,109,129` |
| Error key present only when `NODE_ENV === 'development'` | most catch blocks |
| Explicit user object reshaping in the response | `routes/auth.js` |

So error bodies are sometimes `{ message }`, sometimes `{ message, error }`, and sometimes a bare
string. There is no error envelope and no error codes — clients must match on message text.

### Status code usage

`200` implicit via `res.json`, `201` on register, `400` for validation, `401` for auth failure,
`403` for role failure, `404` for missing documents, `500` in catch blocks. Reasonably
conventional; the gap is that validation and business-rule rejections both use `400`.

### Authorization convention

Inline comparison at the top of the handler body, repeated roughly 18 times:

```js
if (req.user.role !== 'manager') {
  return res.status(403).json({ message: 'Access denied' });
}
```

`routes/databases.js` compresses it to a single line with a plain-text body:

```js
if (req.user.role !== 'manager') return res.status(403).send('Forbidden');
```

There is no `requireRole()` middleware. Hierarchical checks are hand-written per site, e.g.
`routes/auth.js:294-299` for who may reset whose password.

### Model conventions

```js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({ /* fields */ });

reportSchema.index({ year: 1, weekNumber: 1, submissionDate: -1 });

module.exports = mongoose.model('Report', reportSchema);
```

- one model per file, PascalCase filename matching the model name
- indexes declared after the schema, before export
- `{ timestamps: true }` used only on `Template` — the other four models hand-roll date fields
- field-level `required: true` used on `Database` and `FileMetadata`, absent on `User` where
  most fields are bare `String`
- enums declared inline as string arrays
- comments explaining intent are present in `Report.js` and `Database.js`

### Comment style

Sparse but purposeful. Section dividers and rationale, not restatement:

```js
// Registration approval system
// Week-based sorting fields
// Review system for supervisor
// Managers are auto-approved, others need approval
/* Index for efficient sorting and filtering 1 for ascending, -1 for descending ... */
```

Only one TODO exists in the entire repo:
`src/components/StaffDashboard.js:18` — `// TODO: remove if no longer used`.

### Logging

`console.log` / `console.error` only. 50 calls across backend routes and entry:

| File | count |
|---|---|
| `routes/reports.js` | 14 |
| `routes/auth.js` | 12 |
| `routes/databases.js` | 8 |
| `routes/templates.js` | 7 |
| `index.js` | 6 |
| `routes/analytics.js` | 3 |

`routes/auth.js:11` logs `req.body` on registration, which puts a plaintext password in the
server log. Called out in CONCERNS.md.

## Frontend Conventions

### Component style

Function components with hooks, default export at the bottom:

```jsx
import React, { useState, useEffect } from 'react';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  // ...
  return ( /* JSX */ );
}

export default Login;
```

- no class components anywhere
- `React` imported explicitly even though React 19 does not require it
- `.js` extension for all JSX files — `.jsx` never used
- one component per file, filename matches component name
- CSS imported by side effect at the top of the component

### Naming

| Kind | Convention |
|---|---|
| Components | PascalCase |
| Hooks/state | camelCase, `[thing, setThing]` |
| Handlers | `handleX` |
| Booleans | `isX` / `hasX` / `showX` |
| CSS classes | kebab-case |
| Component folders | camelCase |

### Data fetching

Hand-rolled `fetch` per call site, roughly 30 of them:

```js
const token = localStorage.getItem('token');
const res = await fetch('http://localhost:5000/reports', {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await res.json();
```

- hardcoded `http://localhost:5000` origin at every site
- token read from `localStorage` at every site
- no API client module, no wrapper, no interceptor
- no shared loading/error state convention — each component invents its own
- `useEffect` with a manual `async` inner function; no cleanup or abort

### Client state

- `useState` local to the component; no Context, no reducer, no state library
- props drilled from dashboards into children
- `localStorage` as the de-facto global store, keys: `token`, `user`, `darkMode`, `rememberMe`,
  `managerSettings`, `staffSettings`
- `user` is stored as JSON and re-parsed at each read site

### Styling

- plain CSS, kebab-case classes, colocated with the component
- no CSS modules, no scoping — class names are globally shared
- dark mode via a `darkMode` flag in `localStorage` plus parallel `.dark.css` files for three
  components; other components hardcode both themes inline
- **no CSS custom properties anywhere** — every color is a literal, `#ffbf00` appearing 75 times

### Frontend logging

39 `console.*` calls in `src/`, mostly `console.error` in fetch catch blocks.

## Conventions to Preserve in a Rewrite

Things the current code does well and that a rewrite should not lose:

1. Guard-clause-first handlers with early returns — readable and consistent
2. Explicit Mongoose index declarations tuned to real query patterns
3. Fail-fast env validation at boot (`backend/index.js:12-20`)
4. Purposeful section comments in models
5. `async`/`await` uniformly, no mixed promise styles
6. One component per file, filename matching the export

## Conventions to Fix

| Issue | Current | Target |
|---|---|---|
| Error shape | three different bodies incl. plain text | one typed error envelope |
| Role checks | ~18 inline `if` statements | `requireRole()` middleware |
| API origin | hardcoded 30× in client | single configured base URL |
| Token access | `localStorage.getItem` at every call site | one auth/client layer |
| Colors | 75 hardcoded literals | design tokens |
| Logging | `console.*` incl. `req.body` with password | structured logger, redacted |
| Route prefixes | four bare, one `/api` | uniform versioned prefix |
| Dead code | `backend/server.js`, orphan CSS, duplicate components | removed |
| Enforcement | none | ESLint + Prettier + typecheck in CI |

---
*Conventions analysis: 2026-08-08*
<!-- refreshed: 2026-08-08 -->
