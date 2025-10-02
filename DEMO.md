# Demonstration guide

A script for showing the Staff Report Management System to someone else. Every
command and step below was run against this repository, so it should behave as
written.

Two parts:

- **[Part 1 — Setup](#part-1--setup)** — getting it running and checking it works.
- **[Part 2 — The walkthrough](#part-2--the-walkthrough)** — what to click, in order,
  and what to say about it.

Budget about 15 minutes for setup the first time (mostly `npm install`), and
20–25 minutes for the walkthrough.

---

## Part 1 — Setup

### What you need

| | |
|---|---|
| Node | 18 or newer (`node --version`) |
| Docker | for MongoDB, or an Atlas cluster instead |
| A browser | Chrome or Firefox |

Three terminals are easiest: one for the API, one for the interface, one for
checks. A local database needs a fourth.

### Step 1 — Choose a database

Either works. Atlas needs no local install and is what the deployed app uses;
Docker needs no account and works offline.

**Atlas (what this project uses).** Take the connection string from the cluster
and note two things: it ends at the host, so a database name has to be appended,
and your current IP has to be allowlisted under Network Access.

```bash
curl -s https://api.ipify.org        # the IP to add to the allowlist
```

Nothing else to start — go to step 2.

**Docker, as an alternative:**

```bash
docker run -d --name srms-mongo -p 27017:27017 -v srms-mongo-data:/data/db mongo:7
docker start srms-mongo              # if it already exists from a previous run
docker exec srms-mongo mongosh --quiet --eval 'db.adminCommand({ping:1}).ok'
```

Expect `1`. The named volume means data survives a restart.

### Step 2 — Configure and start the API

```bash
cd api
npm install
cp .env.example .env
```

Open `api/.env` and set two values.

For Atlas — note the `/srms_v2` before the query string, which Atlas does not
include and without which the driver writes to a database called `test`:

```bash
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/srms_v2?retryWrites=true&w=majority
JWT_SECRET=<paste the output of: openssl rand -hex 32>
```

For Docker:

```bash
MONGODB_URI=mongodb://localhost:27017/srms_v2
JWT_SECRET=<paste the output of: openssl rand -hex 32>
```

The API refuses to start if `JWT_SECRET` is shorter than 32 characters rather than
falling back to a default. That refusal is deliberate and worth mentioning.

Load the sample data:

```bash
npm run seed
```

It prints the accounts it created. Then start it:

```bash
npm run dev
```

Expect:

```text
MongoDB connected (database: srms_v2)
API listening on port 5000 (development)
```

Leave it running.

### Step 3 — Start the interface

In a second terminal:

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:5173>. You should land on the sign-in screen.

### Step 4 — Confirm it is actually wired up

In a third terminal:

```bash
curl -s http://localhost:5000/health
```

Expect `{"status":"ok","database":"connected"}`.

This endpoint reports the database state, not just that the process is alive, so a
`degraded` here means the API is up but cannot reach MongoDB.

### The accounts

| Role | Email | Password |
|---|---|---|
| Staff | `staff@bankofabyssinia.com` | `staff-password-123` |
| Supervisor | `supervisor@bankofabyssinia.com` | `supervisor-password-123` |
| Manager | `manager@bankofabyssinia.com` | `manager-password-123` |

There is also a pending applicant, `hanna.applicant@bankofabyssinia.com`, waiting
for approval. She cannot sign in yet — that is the point of her.

### Step 5 — Run the checks

Worth doing before an audience, so you know nothing is broken.

```bash
cd api && npm test          # 172 tests, roughly 10 seconds
cd web && npm test          # 23 tests, roughly 2 seconds
```

The API tests start their own in-memory MongoDB, so they do not touch your data
and need no database running.

Two further checks, both worth showing if the audience is technical:

```bash
# Replays the recorded behaviour of the previous API against the new one.
cd api && npx tsx src/scripts/verifyParity.ts

# Signs in as each role in a real browser and screenshots every page.
# Needs both servers running.
cd web && npm run verify:browser
```

The browser check writes to `web/screenshots/`, which is a good fallback if the
live demo misbehaves.

### Resetting between runs

```bash
cd api && npm run seed
```

This clears and recreates everything. Safe to run as often as you like — it
refuses to run against a production database.

### If something is wrong

| Symptom | Cause | Fix |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:27017` | MongoDB is not running | `docker start srms-mongo` |
| API exits complaining about `JWT_SECRET` | shorter than 32 characters | regenerate with `openssl rand -hex 32` |
| `Could not connect to any servers in your MongoDB Atlas cluster` | your IP is not allowlisted | add it under Atlas Network Access |
| Sign-in says *pending manager approval* | you used the applicant account | use one of the three approved accounts |
| Port 5000 or 5173 already in use | a server from a previous session | `ss -ltnp \| grep -E '5000\|5173'`, then `kill <pid>` |
| Interface loads but every request fails | API is not running | check terminal 2, and `curl localhost:5000/health` |

---

## Part 2 — The walkthrough

Have three browser windows ready, or use a private window per role so the three
sessions do not overwrite each other's token.

### Opening line

> Weekly database reporting for a bank. Three roles: staff submit reports,
> supervisors review them, managers own the templates and the accounts. The
> interesting part is that the report forms are not hardcoded — a manager defines
> the fields, and both the form and the server-side validation are generated from
> that one definition.

---

### Scene 1 — The routes are actually protected (1 min)

Before signing in, put this in the address bar:

```text
http://localhost:5173/manager
```

You are redirected to sign-in.

> In the previous version every route was public. Typing this URL rendered the
> whole manager interface for anyone, and it simply failed every request behind
> the scenes. The guard is in front of it now, and the API enforces it separately,
> so neither one is trusting the other.

---

### Scene 2 — Staff submits a report (5 min)

Sign in as **staff**.

**a. The list.** Five reports, each with its review status. Point out the red
banner for the rejected one.

> A rejected report tells the submitter what to change, and can be resubmitted
> linked to the original rather than as an unrelated new report.

**b. Submit a report.** Click *Submit report*.

Point at **Period start** before touching the template:

> This is the week the report is about, and it defaults to this Monday. It is
> separate from when you submit. Previously the week was derived from the moment
> of submission, so filing Monday morning about last week filed it under the wrong
> week with no way to correct it.

**c. Now choose the template** — *Weekly Database Health Check*.

The form appears. This is the part to slow down on.

> None of these fields are written into the front end. The manager defined them,
> and the form is generated from that definition. The character limits and the
> numeric range under each field come from the same place. When you submit, the
> server compiles that same definition into a validation schema and checks the
> answers against it — so the form and the validator cannot disagree about what
> this template requires.

Fill it in:

| Field | Value |
|---|---|
| Summary | `Two replication lags on the reporting replica, both resolved.` |
| Incidents this week | `2` |
| Highest severity | Low |
| Backups verified | Yes |
| Checklist completed | tick it |
| Notes | anything |
| Last patched | any date |

**Worth demonstrating first:** put `1` in Summary and submit. It is rejected with
*Summary must be at least 10 characters*, against that field specifically rather
than as one vague failure.

> Errors come back keyed to the field that failed, so the form can mark them in
> place. The message names the field and the actual limit, and there is exactly one
> per problem.

Fix it and submit. You return to the list with the new report at the top, pending.

---

### Scene 3 — Supervisor reviews it (4 min)

Sign in as **supervisor** in a second window.

**a. The queue** holds everything awaiting a decision, including what staff just
submitted.

**b. Click *Review*.** The full report opens with every answer laid out.

**c. Reject it first.** Click *Reject*, and try to confirm with the reason empty —
it refuses.

> A rejection has to say why. The previous version let you reject with no
> explanation, which left the submitter with nothing to act on.

Give a reason: `Attach the incident log for the Wednesday failover.` Confirm.

**d. Then show the limit.** Open the report the *supervisor* submitted, if you ran
the browser check earlier — or note it in passing:

> A reviewer cannot decide on their own submission. The interface says so rather
> than offering a button the server will refuse.

**e. Analytics.** Click *Analytics*.

> Three figures that were previously wrong. Average review time is now averaged
> over reviewed reports only — the old code divided by every report, so unreviewed
> work dragged the number toward zero. Reviewed share and approval rate are
> genuinely different measures now; both used to be the same calculation, which
> double-counted approval in the score. And where nothing has been decided yet
> this shows a dash rather than 0%, because those mean different things.

---

### Scene 4 — Manager (7 min)

Sign in as **manager** in a third window.

**a. Overview.** Tiles, one chart, two tables.

> One chart, one measure, no legend needed — the title says what it is. The
> status breakdown is tiles rather than a stacked bar on purpose: pending, approved
> and rejected are amber, green and red, and those three fail colourblind
> separation as a set. Amber against green comes out at about a quarter of the
> distance needed. So status is carried by the label and the icon, and the chart
> colour was checked against both light and dark backgrounds rather than picked by
> eye.

Toggle dark mode with the moon icon.

> Dark mode is a separate set of tokens, not an inverted filter. The chart blue
> steps to a lighter shade that was validated against the dark background.

**b. Templates.** Open *Weekly Database Health Check*.

> This is where the form you filled in came from. Eight field types, per-field
> validation rules, display order.

Change a field's label and save.

> Saving a field change raises the template version. Reports keep the version they
> were submitted against, so a report filed last month still means what it meant
> then. And a template that reports point at is retired rather than deleted —
> deleting it would leave those answers uninterpretable.

**c. Approvals.** Hanna is waiting.

Set *Role to assign* to **supervisor**, then Approve.

> This is the one I would point at. The applicant asked for staff access. The
> manager decides what they actually get — including promotion to supervisor or
> manager, which registration itself cannot do.
>
> In the previous version the registration form sent its own role and the API
> trusted it, and it auto-approved anyone who said "manager". So anyone who could
> reach the sign-up page could create themselves an administrator account and then
> read every report and every database credential in the system.

Go to **Users** and show Hanna is now a supervisor.

**d. Password reset.** On Users, click *Reset password* for a staff member.

> A supervisor can reset staff passwords only. A manager can reset staff and
> supervisors. Nobody resets a peer of equal rank, and nobody resets their own —
> there is a separate change-password flow for that, which requires the current
> password.

**e. Databases.** The inventory.

> Host is validated as an address or a hostname. It used to be free text, so
> anything at all could sit in a field the interface presents as an address.
> Retiring a record keeps it, because reporting history refers to it.

---

### Scene 5 — For a technical audience (5 min, optional)

**a. Attachments cannot be reached by guessing.**

The old API had `GET /reports/download/:filename`. That route no longer exists:

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"staff@bankofabyssinia.com","password":"staff-password-123"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")

curl -s --path-as-is -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/v1/reports/download/../../.env"
```

Returns:

```json
{"error":{"code":"NOT_FOUND","message":"No route matches GET /api/v1/reports/download/../../.env"}}
```

The url-encoded form (`..%2F..%2F.env`) gives the same answer. `--path-as-is`
matters because curl normalises `../` away before sending otherwise, so without it
you are not testing what you think you are.

> The old route joined that filename onto a directory path with no checks. An
> encoded `../` walked out of the uploads folder, so any signed-in user of any role
> could read arbitrary files on the server — including the environment file with
> the database password and the token signing key. With those you have the whole
> database and can forge a token for any user.
>
> Files are now addressed by their own id and stored in the database rather than on
> disk, so there is no path built from request input for anything to escape.

**b. Authorisation does not leak existence.** With a file id from a report the
staff account did not submit:

```bash
curl -s -H "Authorization: Bearer <staff-token>" \
  http://localhost:5000/api/v1/reports/files/<id>
```

Returns 404, not 403.

> 403 would confirm the file exists. Someone with no claim to it gets the same
> answer as if it were not there.

**c. The tests.**

```bash
cd api && npm test
```

> 172 tests. There were none before. A large block asserts the authorisation
> matrix endpoint by endpoint and role by role, so a handler added without its
> role check fails the suite instead of shipping.

**d. How the rewrite was checked.**

```bash
cd api && npx tsx src/scripts/verifyParity.ts
```

> The old code had no tests, so there was nothing describing what it did. Its
> behaviour was recorded first — 56 real calls with their responses — and this
> replays each one against the new API. Every difference is classified: the route
> moved, the behaviour was deliberately corrected, or the endpoint is gone. If a
> difference has no declared reason, this exits non-zero and CI fails. So no
> behaviour changed by accident.

**e. The browser check.**

```bash
cd web && npm run verify:browser
```

> Signs in as each role, visits every screen, submits a report through the
> generated form, approves a registration, and fails on any console error. It
> found a real bug: the approvals page collected the role and never sent it, so
> every approval silently granted whatever was requested. The 172 API tests passed
> because the endpoint was correct. The front-end tests passed because none
> covered that page. Only running it caught the gap.

---

## Closing summary

Worth having these numbers to hand.

| | Before | Now |
|---|---|---|
| Tests | 1, and it did not pass | 195 |
| CI | none | 4 jobs per push |
| TypeScript | none | throughout |
| Deployable | no, both halves hardcoded `localhost:5000` | yes, Render blueprint included |
| Critical security issues | 3 | 0 |
| Defects found and fixed | | 16 |

The three that mattered most:

1. **Path traversal** — any signed-in user could read the server's environment
   file, which held the database password and token signing key.
2. **Privilege escalation** — anyone reaching the sign-up page could create
   themselves an approved manager account.
3. **Plaintext passwords in logs** — every registration wrote the password to
   stdout, which on a hosted platform means a retained log store.

Supporting detail lives in `.planning/codebase/` for the analysis and
`.planning/contract/PARITY.md` for every deliberate behaviour change with its
reason.
