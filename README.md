# HustleHub+

A secure freelance marketplace (MERN stack). Freelancers list gigs, clients request bookings,
freelancers accept or reject them, and every **accepted** booking creates a simulated payment that
is tracked as income and used to estimate tax.

> **Status:** Part 1 (secure backend), Part 2 (full-stack) and the final POE (financial dashboard and tax estimation,
> CI/CD, static analysis, Docker, logging, extra security features and the final security review) are implemented.
> The DevSecOps material is in [section 8](#8-devsecops-and-final-security-review).

## Contents
1. [What changed after Part 2 feedback](#1-what-changed-after-part-2-feedback)
2. [Features](#2-features)
3. [Financial features: income dashboard and tax estimation](#3-financial-features-income-dashboard-and-tax-estimation)
4. [Security measures and why we chose them](#4-security-measures-and-why-we-chose-them)
5. [Running the project (step by step)](#5-running-the-project-step-by-step)
6. [Testing](#6-testing)
7. [API reference](#7-api-reference)
8. [DevSecOps and final security review](#8-devsecops-and-final-security-review): CI/CD, static analysis, Docker, logging, extra security features
9. [Appendix: original Part 1 documentation](#appendix-original-part-1-documentation)

---

## 1. What changed after Part 2 feedback

| Feedback | What we did |
| --- | --- |
| Data must be shown to be saved in MongoDB | All data (users, gigs, bookings, transactions) is stored with Mongoose in MongoDB; the old file storage is gone. Evidence: screenshots of MongoDB Compass collections (see `evidence/`). |
| A client must not be able to confirm their own booking; the freelancer must accept or reject | New bookings are created as `pending`. Only the freelancer who owns the gig can call `PATCH /api/bookings/:id/status` with `accepted` or `rejected`. The transaction (income) is created **only on acceptance**. Clients have no confirm control in the UI or API. |
| Admin functionality was not tested | Admin Postman tests no longer skip. They cover admin login, users, stats, all bookings, all transactions, gig moderation, and 401/403 checks for every other role. Added `GET /api/admin/bookings` and `GET /api/admin/transactions`. |
| UI needed to be more visually appealing and usable | New financial dashboard with summary cards and a chart, status badges, accept/reject buttons, loading and empty states, keyboard focus styles, sticky navbar. |
| Newman must be used to execute the tests | `npm run test:api` runs the whole collection with Newman (see [Testing](#6-testing)). |
| Video had no voice-over | New video to be recorded with narration (link at the bottom of this README). |
| README must describe the full-stack system | This README: features, security motivation, and step-by-step run instructions for backend and frontend. |

## 2. Features

| Role | Can do |
| --- | --- |
| **Client** | Register / log in, browse gigs, request a booking (starts **pending**), see own bookings and payments |
| **Freelancer** | Create, edit, hide and delete **own** gigs; accept or reject bookings on own gigs; view the financial dashboard |
| **Admin** | View all users, bookings and transactions, see platform statistics, remove any gig. Created by script only (cannot self-register). |

### Booking lifecycle

```
Client requests booking  ->  status: pending   (no transaction yet)
Freelancer accepts       ->  status: confirmed (transaction created, income credited)
Freelancer rejects       ->  status: rejected  (no transaction, no income)
```

Accepting is a single atomic database update that only matches a `pending` booking owned by the
freelancer, so a booking cannot be answered twice (no duplicate transactions) and no other user can
answer it. If creating the transaction fails, the booking is put back to `pending`.

## 3. Financial features: income dashboard and tax estimation

### What the freelancer sees (`/earnings`, labelled **Dashboard**)
* **Total income**, **estimated tax**, **net income** (income minus estimated tax) for the current tax year.
* **Awaiting your response**: number and value of pending bookings.
* **Income per month** bar chart (March to February).
* **Recent payments** table and a "How is my tax estimated?" explanation.
* Loading, empty and error states.

### Endpoint
`GET /api/freelancer/income-summary` (JWT + `freelancer` role, data filtered by the token's user id).
The older `GET /api/freelancer/income` is kept.

### Tax calculation logic
We estimate **South African individual income tax for the 2026/27 tax year**
(1 March 2026 to 28 February 2027), using the SARS tables published with the 2026 Budget.
The logic lives in one file, `backend/services/taxService.js`, and is unit tested.

1. **Taxable income** = total of the freelancer's *completed* transactions dated inside the current tax year.
2. **Normal tax** = base amount of the bracket + marginal rate x (income above the bracket floor).
3. **Tax payable** = max(0, normal tax - primary rebate of R17 820).

| Taxable income (R) | Tax (R) |
| --- | --- |
| 0 - 245 100 | 18% of income |
| 245 101 - 383 100 | 44 118 + 26% above 245 100 |
| 383 101 - 530 200 | 79 998 + 31% above 383 100 |
| 530 201 - 695 800 | 125 599 + 36% above 530 200 |
| 695 801 - 887 000 | 185 215 + 39% above 695 800 |
| 887 001 - 1 878 600 | 259 783 + 41% above 887 000 |
| 1 878 601 and above | 666 339 + 45% above 1 878 600 |

Because the rebate (R17 820) equals 18% of R99 000, income up to **R99 000 is tax-free**.

**Worked example.** A freelancer earns R300 000 this tax year:
`44 118 + 26% x (300 000 - 245 100) = 44 118 + 14 274 = 58 392`, then `58 392 - 17 820 = R40 572` tax.
Effective rate = 40 572 / 300 000 = **13.5%**. Net income = **R259 428**.

**Assumptions (also shown to the user as a disclaimer)**
* Gross platform income is treated as the full taxable income; no business expenses, deductions, medical credits or other income.
* Only the primary rebate is applied (age-based rebates are not).
* Income is not annualised: tax is calculated on income earned so far in the tax year.
* Money is stored in whole cents (integers) to avoid floating-point errors; the tax year boundary uses South African time (UTC+2).
* This is an **estimate, not tax advice**. Tables must be updated each tax year (`TAX_YEAR_2027` in `taxService.js`).

**Source:** SARS (2026) *Rates of tax for individuals*. Available at: https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/ (Accessed: 30 October 2026).

### Verifying the tax figures
`backend/tests/taxService.test.js` covers: R0 and negative income, below the threshold, the R99 000 threshold, every bracket
boundary (continuity), the top bracket, "tax never decreases as income rises", tax-year edges (28 Feb vs 1 March in SAST), and
the monthly grouping and net-income maths. Postman also checks the endpoint end-to-end (R250 income gives R0 tax and R250 net).
Frontend tests render the dashboard from a mocked API response, including the empty and error states.

## 4. Security measures and why we chose them

| Measure | Where | Why |
| --- | --- | --- |
| bcrypt (cost 12) password hashing | `authController` | Slow, salted hashing makes stolen hashes expensive to crack. Plain-text passwords are never stored. |
| JWT on every protected route | `authMiddleware.protect` | Stateless authentication; the user is re-read from the database on each request so deleted users lose access. |
| Role-based access control | `authorize(...)` + ownership checks | Least privilege. Clients cannot create gigs, freelancers cannot book, only admins reach `/api/admin/*`, and users only ever see their own records. Other users' records return `404`, not `403`, so ids cannot be probed. |
| Server-side price and ownership | `createBooking` | The price, owner and title are read from the gig in the database; the client only sends a gig id (prevents price tampering). |
| Booking state machine | `respondToBooking` | Only the owning freelancer can accept or reject, and only once, so a client cannot self-confirm. |
| Input validation (express-validator) | `middleware/validators.js` | Every body and id is validated before reaching a controller. |
| NoSQL / prototype-pollution rejection | `middleware/sanitize.js` | Keys such as `$ne` or `__proto__` are rejected instead of reaching MongoDB. |
| Helmet + Content Security Policy | `middleware/security.js`, `vite.config.js` | Security headers on the API, and a strict CSP on the React build (`script-src 'self'`, no inline scripts or styles). This is why the dashboard chart is plain SVG with CSS classes. |
| Rate limiting | `middleware/rateLimiter.js` | Login brute-force (5 failed attempts per account per 15 min), registration, booking (20 per 10 min per user), and a general API limit; a clear `429` message is returned. |
| HTTPS | `server.js` | Credentials and tokens never travel in clear text. |
| Safe errors | `middleware/errorHandler.js` | No stack traces, paths or configuration values are returned. |
| Body size limit (10 kb) | `server.js` | Basic denial-of-service protection. |
| Password policy | `utils/passwordPolicy.js` | 10 to 64 characters, upper/lower case and a number, no common passwords, no name or email inside it; the maximum respects bcrypt's 72-byte limit. See [8.5](#85-additional-security-features). |
| Account lockout and admin unlock | `authController`, `adminController` | 5 failed logins lock an account for 15 minutes with an identical, timing-safe response; admins can lift it. See [8.5](#85-additional-security-features). |
| Structured security logging | `utils/logger.js` | Redacted, request-correlated JSON logs of every security-relevant event, shipped to a cloud platform. See [8.4](#84-logging-and-monitoring). |

## 5. Running the project (step by step)

**Requirements:** Node.js 22 (what CI and Docker use), npm, and either Docker Desktop (easiest) or a local MongoDB / free MongoDB Atlas cluster.

### Quick start with Docker (recommended)
```bash
cd hustlehub-plus
cp .env.example .env     # then set MONGO_PASSWORD, JWT_SECRET and ADMIN_PASSWORD inside it
docker compose up --build
docker compose exec backend npm run seed-admin     # second terminal
```
Open http://localhost:8080. Full details, ports and troubleshooting are in [8.3](#83-docker-and-docker-compose).
The two sections below run the backend and frontend directly on your machine instead.

### Backend
```bash
cd hustlehub-plus/backend
npm install
cp .env.example .env          # then edit .env (see below)
npm run generate-cert         # creates certs/key.pem and certs/cert.pem (self-signed)
npm run seed-admin            # creates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD
npm start                     # https://localhost:5000
```
`.env` values: `MONGO_URI`, `JWT_SECRET` (generate with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `CORS_ORIGIN=http://localhost:5173`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters with upper-case, lower-case and a number).
Open https://localhost:5000 once in your browser and accept the self-signed certificate warning.

### Frontend
```bash
cd hustlehub-plus/frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api to the HTTPS backend)
```

### Try the whole flow
1. Register a **freelancer** and create a gig (My gigs).
2. Register a **client**, open Browse gigs and book it. The booking shows as **Pending**.
3. Log in as the freelancer, open Bookings and click **Accept**.
4. Open **Dashboard** to see income, estimated tax, net income and the monthly chart.
5. Log in as the admin to see platform statistics and all bookings and transactions.

## 6. Testing

| What | Command | Notes |
| --- | --- | --- |
| Backend unit tests | `cd hustlehub-plus/backend && npm test` | Jest, 51 tests in 6 suites: tax logic, logger (redaction, masking, log-injection), error handler, login logging and account lockout, password policy, admin unlock and RBAC |
| Frontend tests | `cd hustlehub-plus/frontend && npm test` | Vitest + Testing Library, 19 tests: login, register, gigs (render + booking), bookings (accept/reject, client cannot confirm), financial dashboard, admin |
| API tests with Newman | `cd hustlehub-plus/backend && npm run test:api` | Needs the backend running |
| Static analysis | `cd hustlehub-plus/backend && npm run lint` | ESLint with security rules, must report nothing |
| Dependency audit | `npm audit --omit=dev --audit-level=high` (in each app) | Must report no high or critical vulnerabilities |

All of these run automatically on every push; see [8.1](#81-cicd-pipeline-github-actions).

**Newman setup:** copy `postman/HustleHub_Local.postman_environment.example.json` to
`postman/local.postman_environment.json` (git-ignored) and fill in `adminEmail` and `adminPassword` (the same values used for `npm run seed-admin`).
Newman writes an HTML report to `hustlehub-plus/newman-report/report.html`. The collection covers success and failure
cases for every role, including the booking accept/reject flow, the income summary, and all admin endpoints.

> The booking rate-limit test fires more than 20 booking requests, so restart the backend between full Newman runs.

## 7. API reference

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | Register as client or freelancer |
| POST | `/api/auth/login` | public | Log in, returns JWT |
| GET | `/api/auth/me` | any | Current user |
| GET/POST | `/api/gigs` | any / freelancer | Browse / create gigs |
| GET | `/api/gigs/mine` | freelancer | Own gigs |
| PATCH/DELETE | `/api/gigs/:id` | owner | Update / delete own gig |
| POST | `/api/bookings` | client | Request a booking (status `pending`) |
| PATCH | `/api/bookings/:id/status` | freelancer (owner) | `{ "status": "accepted" \| "rejected" }` |
| GET | `/api/bookings`, `/api/bookings/:id` | client / freelancer / admin | Own bookings (admin: all) |
| GET | `/api/transactions` | client / freelancer / admin | Own transactions (admin: all) |
| GET | `/api/freelancer/income`, `/api/freelancer/income-summary` | freelancer | Income, tax estimate, monthly data |
| GET | `/api/admin/users`, `/stats`, `/bookings`, `/transactions` | admin | Platform overview |
| PATCH | `/api/admin/users/:id/unlock` | admin | Lift an account lockout early |
| DELETE | `/api/admin/gigs/:id` | admin | Remove any gig |

## 8. DevSecOps and final security review

This section documents everything added for the final POE: the CI/CD pipeline, static analysis, containers,
logging, the extra security features and the final security review.

[![HustleHub+ CI](https://github.com/EMGPRS/insy7314-2026-insy7314-poe-classroom-st10377354/actions/workflows/ci.yml/badge.svg)](https://github.com/EMGPRS/insy7314-2026-insy7314-poe-classroom-st10377354/actions/workflows/ci.yml)

### 8.1 CI/CD pipeline (GitHub Actions)

**File:** `.github/workflows/ci.yml` (the separate `autograde.yaml` is the IIE classroom autograder and is untouched).
It runs on every push and pull request to `main`, and can be started by hand. Jobs run in parallel where possible,
and the run fails if any job fails.

| Job | What it does | Fails when |
| --- | --- | --- |
| `backend` | `npm ci`, Jest unit tests, and a build check that parses every backend file (`node --check`; Node has no compile step) | a test fails or a file has a syntax error |
| `frontend` | `npm ci`, Vitest + Testing Library tests, production build with Vite, uploads `dist` as an artifact | a test fails or the build breaks |
| `api-tests` | Starts MongoDB as a service, generates the HTTPS certificate, seeds an admin, starts the API over HTTPS and runs the whole Postman collection with **Newman**; uploads the HTML report | any API assertion fails |
| `dependency-audit` | `npm audit` for backend and frontend production dependencies (dev tooling is reported but does not gate) | a high or critical vulnerability exists |
| `static-analysis` | ESLint with security rules, `--max-warnings 0`; uploads a JSON report | any error or warning |
| `docker` | Builds both images, starts the full stack with Docker Compose, waits for every container to be healthy, then smoke-tests the API, the site and the nginx `/api` proxy | an image fails to build, a container is unhealthy, or a smoke test fails |
| `pipeline-passed` | Final gate that depends on all the jobs above | any job did not succeed |

Design choices: `npm ci` installs exactly what the lockfile says, so builds are reproducible; the workflow has
least-privilege permissions (`contents: read`); superseded runs on the same branch are cancelled; and **no secret is stored in the
repository** because the JWT secret, admin password and database password are generated fresh on every run.


<img width="938" height="477" alt="image" src="https://github.com/user-attachments/assets/c2eba3ab-385e-4a5a-a480-ffbb976c1792" />



### 8.2 Static code analysis

**Tools:** ESLint (`eslint:recommended`) plus `eslint-plugin-security` for the backend, and `npm audit` for dependencies of both applications.
Both run in the pipeline, and a single warning or a high or critical production vulnerability fails the build.
Run locally with `cd hustlehub-plus/backend && npm run lint`.

**What the first security scan found and what we did about it**

| Finding | Count | Assessment | Action |
| --- | --- | --- | --- |
| `detect-unsafe-regex` on the two "at most two decimals" price checks | 2 | A nested-quantifier regex can in theory be abused for ReDoS | **Fixed:** replaced with a small helper (`hasAtMostTwoDecimals`) using two simple anchored checks; behaviour verified identical on 12 inputs |
| `detect-object-injection` (`obj[key]`) in config, gigs, rate limiter, sanitiser, validators, tax service | 9 | False positives: every key comes from a hard-coded list, a constant, `Object.keys()` or arithmetic, never from user input | **Justified inline:** a single-line `eslint-disable` with the reason written next to it, so the rule stays on everywhere else |
| `npm audit` (production): `proxy-addr` (critical), `body-parser` (high), `qs` (moderate) | 3 | Real vulnerabilities in transitive dependencies | **Fixed** with `npm audit fix` (patch-level updates, no breaking changes); production audit now reports 0 |

**What the results indicate:** after these fixes there are no unresolved ESLint security findings in the backend and no known
vulnerabilities in production dependencies (0 errors, 0 warnings, 0 vulnerabilities). Advisories that remain are in
dev-only tools (Newman, Jest) that are never shipped to production, so they are reported but do not gate the pipeline.
**Scope note:** ESLint covers the backend; the React app is covered by `npm audit`, its tests and the strict CSP.

<img width="938" height="327" alt="image" src="https://github.com/user-attachments/assets/41203dbb-fa66-4882-a155-4d9df40fc448" />

<img width="938" height="319" alt="image" src="https://github.com/user-attachments/assets/f2577778-ff38-4001-bf02-816455bdbbf9" />



### 8.3 Docker and Docker Compose

Both applications are containerised and orchestrated with `hustlehub-plus/docker-compose.yml`.

| Service | Image | Port (host) | Notes |
| --- | --- | --- | --- |
| `mongo` | `mongo:7` | `127.0.0.1:27018` | Requires a username and password, data kept in a volume, healthcheck |
| `backend` | built from `backend/Dockerfile` | `127.0.0.1:5000` (HTTPS) | Multi-stage build, production dependencies only, runs as the non-root `node` user, generates its own self-signed certificate on first start, healthcheck over HTTPS |
| `frontend` | built from `frontend/Dockerfile` | `8080` | React build served by non-root nginx, which also forwards `/api` to the backend, adds a CSP and other security headers, and limits request bodies to 10 kB |

Start-up order is enforced: the backend waits for a healthy database and the frontend waits for a healthy backend.

```bash
cd hustlehub-plus
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env
# edit .env: set MONGO_PASSWORD, JWT_SECRET, ADMIN_PASSWORD (see comments inside the file)
docker compose up --build       # first build takes a few minutes
docker compose exec backend npm run seed-admin     # in a second terminal
docker compose ps               # all three should say "healthy"
```

Open **http://localhost:8080** for the site. The API is at https://localhost:5000 (accept the self-signed certificate warning).
Stop with `docker compose down` (add `-v` to also delete the database). After changing code, run `docker compose up -d --build`.
To inspect the database in MongoDB Compass use `mongodb://USER:PASSWORD@127.0.0.1:27018/?authSource=admin`.

Notes: stop any locally running `npm start` / `npm run dev` first (ports 5000 and 8080). `NODE_ENV` defaults to `development` in Compose
because the production HSTS header would make browsers force every `localhost` port onto HTTPS.
The CI `docker` job runs this same stack on every push.

<img width="938" height="322" alt="image" src="https://github.com/user-attachments/assets/72278847-62ac-4efe-88ce-c90d8f7f4ce4" />

<img width="938" height="527" alt="image" src="https://github.com/user-attachments/assets/4544f42c-7e6a-4d01-bc01-d84ac244206c" />

### 8.4 Logging and monitoring

The API writes **structured JSON logs**: one event per line, always with the same fields, so they can be searched, filtered
and alerted on. The logger is `backend/utils/logger.js` (Winston). Every line has `timestamp`, `level`, `event` and `service`; events
raised while handling a request also carry `requestId`, `ip`, `userId` and `role`. The `requestId` is returned in the `X-Request-Id`
response header, so one request can be followed through every log line it produced.

**Where logs go:** the console (always; in Docker use `docker compose logs -f backend`), an optional rotating file (`LOG_FILE`), and the
cloud platform **Better Stack** (set `LOGTAIL_SOURCE_TOKEN` and `LOGTAIL_ENDPOINT`; the events then appear in its Live tail).
Docker also rotates container logs (10 MB x 3 files).

| Event | Level | Why it is logged |
| --- | --- | --- |
| `auth.login.success` | info | Audit trail of who signed in and when |
| `auth.login.failure` (reason `wrong_password` or `unknown_email`) | warn | Detects password guessing and account probing. Clients always get the same message; only the private log keeps the reason |
| `auth.account.locked`, `auth.login.locked` | warn | Shows the lockout protection working against brute force |
| `auth.register.success`, `auth.register.duplicate` | info / warn | Account creation trail and duplicate sign-up attempts |
| `auth.token.rejected` (missing, invalid or expired, user not found) | warn | Detects forged, stolen or expired tokens |
| `access.denied` | warn | A signed-in user attempted something their role forbids (RBAC probing) |
| `booking.created`, `booking.accepted`, `booking.rejected` | info | Full booking lifecycle |
| `transaction.recorded`, `transaction.failed` | info / error | Every simulated payment is traceable to a booking, client and freelancer |
| `admin.gig.removed`, `admin.account.unlocked` | warn | Admin actions must be auditable |
| `security.rate_limit_exceeded` (which limiter, which path) | warn | Evidence of flooding or brute-force attempts |
| `http.request` (method, path, status, duration) | info / warn / error | Traffic overview and slow or failing endpoints |
| `request.rejected` | warn | Bad requests such as malformed JSON or oversized bodies |
| `app.error` (with stack trace) | error | Real bugs and outages, with the detail developers need. The API response stays generic |
| `server.started`, `db.connected`, `server.stopping`, `server.db_connect_failed` | info / error | Service lifecycle |

**The logs are protected too:** any field named like a password, token, secret, authorization, cookie or hash is replaced with
`[REDACTED]`; emails are masked (`m***@example.com`); request bodies, headers and query strings are never logged; and because logs
are JSON, line breaks typed into a form cannot forge extra log entries. All of this is unit tested (`tests/logger.test.js`,
`tests/errorHandler.test.js`, `tests/authLogging.test.js`).

*Limitation:* behind the nginx container the `ip` field shows the proxy address, because `X-Forwarded-For` is deliberately not trusted
(a client could spoof it on the directly published API port). A production deployment would configure a trusted proxy.

<img width="938" height="320" alt="image" src="https://github.com/user-attachments/assets/fab3b981-fc82-4e05-898c-c97e16bddb72" />

<img width="938" height="472" alt="image" src="https://github.com/user-attachments/assets/d742498a-f1dd-4b8d-9ed2-e3ae6c863160" />


### 8.5 Additional security features

These go beyond the minimum requirements. Each is implemented, tested and can be demonstrated.

**1. Account lockout with safe responses and admin recovery.** After 5 consecutive failed logins an account is locked for 15 minutes; a successful
login resets the counter; an admin can lift a lock early with `PATCH /api/admin/users/:id/unlock`. A locked account returns exactly the same
`401 Invalid email or password.` as any other failed login and still performs a bcrypt comparison first, so neither the response nor its timing reveals
whether an email exists or is locked. The lock is recorded in the log (`auth.account.locked`, `auth.login.locked`, `admin.account.unlocked`) and the login page tells
users the rule up front. Code: `authController.js`, `adminController.js` (`unlockUser`). Tests: `authLogging.test.js`, `adminUnlock.test.js`.

**2. Password policy with a blocklist and bcrypt-aware limits.** Passwords need 10 to 64 characters with upper case, lower case and a number. Common passwords
(including decorated ones such as `Password12345!`) and passwords containing the person's name or email are refused. Length and a blocklist stop the guesses attackers try first
(NIST SP 800-63B). The maximum matters because bcrypt ignores everything after 72 bytes and very long inputs make the server hash for a long time; it is checked in bytes, so emoji
cannot sneak past it, and non-text input such as `{ "$ne": null }` is rejected. Code: `utils/passwordPolicy.js` used by `registerValidationRules`; the register form repeats the length
rules for instant feedback while the API stays the authority. Tests: `passwordPolicy.test.js`. *Limit:* the blocklist is small; a production system would check a large breached-password list.

**3. Security audit trail and request tracing** (see 8.4), **4. hardened containers and web server** (non-root users, credentials only through environment variables, database published on
`127.0.0.1` only, nginx CSP and security headers, hidden server version, 10 kB body limit), and **5. security gates in the pipeline** (8.1).

### 8.6 Final security review

How the system addresses the common threats (grouped by the OWASP Top 10, 2021):

| Threat | How it is addressed | Where |
| --- | --- | --- |
| **Injection** (NoSQL operators, prototype pollution) | Every body, param and id is validated before a controller runs; any key starting with `$`, containing `.` or named `__proto__`/`constructor`/`prototype` is rejected; Mongoose is used with typed schemas and no query is built from strings; non-text passwords are rejected | `validators.js`, `sanitize.js`, models |
| **Cross-site scripting** | React escapes all rendered values and the code base never uses `dangerouslySetInnerHTML`; names containing `<` or `>` are refused; the React build has a strict CSP (`script-src 'self'`, no inline scripts) and nginx repeats it as a header; the API's own CSP is `default-src 'none'`; `X-Content-Type-Options: nosniff` | `Register.jsx`, `vite.config.js`, `nginx.conf`, `security.js` |
| **Authentication weaknesses** | bcrypt (cost 12); JWT with id and role only, signed with a secret from the environment and expiring (1 hour in Compose); the token is re-validated and the user re-read from the database on every protected request; identical responses and a dummy hash comparison so timing does not reveal which emails exist; rate limits on login (per account and per IP) and registration; account lockout; password policy | `authController.js`, `authMiddleware.js`, `rateLimiter.js`, `passwordPolicy.js` |
| **Broken access control** (including IDOR) | `protect` plus `authorize(...)` on every route; admin routes are admin-only; users only ever receive their own records; other people's records return `404`, not `403`, so ids cannot be probed; price, owner and title of a booking are read from the database, never from the request; only the owning freelancer can accept or reject, and only once | `authMiddleware.js`, controllers, `bookingController.js` |
| **Sensitive data exposure** | HTTPS everywhere on the API; password hashes are never returned (`toSafeUser`); secrets only in environment variables and git-ignored `.env` files; API responses are `Cache-Control: no-store`; logs redact secrets and mask emails; error responses never contain stack traces, paths or configuration | `server.js`, `userModel.js`, `logger.js`, `errorHandler.js` |
| **Security misconfiguration** | Helmet security headers, CORS allow-list, 10 kB body limit; containers run as non-root with healthchecks; the database requires credentials and is bound to `127.0.0.1`; `NODE_ENV` controls HSTS | `security.js`, `server.js`, Dockerfiles, `docker-compose.yml` |
| **Vulnerable and outdated components** | `npm audit` gates the pipeline; the 3 production vulnerabilities found were fixed; lockfiles are used with `npm ci` | `ci.yml` |
| **Insecure design / integrity** | Booking state machine and atomic update so a booking cannot be answered twice or self-confirmed; a transaction is created only on acceptance and a confirmed booking is rolled back if its transaction fails; the CI pipeline builds from lockfiles | `bookingController.js`, `ci.yml` |
| **Logging and monitoring failures** | Structured, redacted, request-correlated logs for logins, lockouts, token rejections, role denials, bookings, transactions, rate limits, admin actions and errors, shipped to a cloud platform | `logger.js`, section 8.4 |
| **Denial of service / brute force** | General, login, registration and booking rate limits with clear `429` responses; body size limit; password length cap; lockout | `rateLimiter.js`, `server.js` |
| **CSRF** | Not applicable in the usual form: the token is sent in the `Authorization` header by JavaScript, not in a cookie, so a forged cross-site request carries no credentials | `api.js` |
| **SSRF** | The API makes no outbound requests based on user input | n/a |

**Known limitations (honest summary):** the JWT is kept in `sessionStorage` (cleared when the tab closes, but readable by script if an XSS flaw ever existed, which is why
the CSP is strict); there are no refresh tokens or server-side token revocation; the development certificate is self-signed; behind nginx the client IP is not forwarded (see 8.4); the password blocklist is small; ESLint covers
the backend only; MongoDB traffic inside the Docker network is authenticated but not encrypted.

### 8.7 Evidence and submission checklist

GitHub repository link, this README, `.github/workflows/ci.yml`, both Dockerfiles with `docker-compose.yml`, static-analysis results, logging evidence,
and the demonstration video. Screenshots are kept in `evidence/`.

**Demonstration video (with voice-over):** https://youtu.be/NMUZz3JIJas

---

# Appendix: original Part 1 documentation

> Written for Part 1, when users were stored in a local file. The project now uses MongoDB, and the architecture and API
> sections above supersede the parts below that describe file storage.

# HustleHub+ — Part 1

## 1. Project Overview

HustleHub+ is a digital platform designed to connect **clients and freelancers** in one central system. The purpose of the platform is to provide a secure environment where users can create accounts, authenticate themselves, and access services based on their roles.

The system aims to address the difficulty of managing interactions between clients and freelancers by providing a structured platform for user management and authentication.

The intended users of HustleHub+ are:

* **Clients** — users who require services from freelancers.
* **Freelancers** — users who provide services to clients.
* **Administrators** — users who will manage and oversee the platform as the system is expanded.

Part 1 focuses mainly on establishing the secure authentication foundation of HustleHub+. The implemented functionality includes user registration, user login, JWT-based authentication, protected user information, input validation, password hashing, HTTPS communication and error handling.


## 1. Project Overview

HustleHub+ is a digital platform designed to connect **clients and freelancers** in one central system. The purpose of the platform is to provide a secure environment where users can create accounts, authenticate themselves, and access services based on their roles.

The system aims to address the difficulty of managing interactions between clients and freelancers by providing a structured platform for user management and authentication.

The intended users of HustleHub+ are:

* **Clients** — users who require services from freelancers.
* **Freelancers** — users who provide services to clients.
* **Administrators** — users who will manage and oversee the platform as the system is expanded.

Part 1 focuses mainly on establishing the secure authentication foundation of HustleHub+. The implemented functionality includes user registration, user login, JWT-based authentication, protected user information, input validation, password hashing, HTTPS communication and error handling.



## 2. System Architecture

HustleHub+ is being developed using the MERN technology stack. MERN stands for MongoDB, Express, React and Node.js. React is used for the frontend, while Express and Node.js are used for the backend and MongoDB is used for database storage in a typical MERN application (MongoDB, 2026).

For Part 1, the implemented system mainly focuses on the backend and authentication. The current version uses Node.js and Express and stores user information in a `users.json` file instead of MongoDB. The React frontend and MongoDB database are planned for the later parts of the project.

Express uses middleware to process requests before they reach the relevant route and controller. Express also provides routing for HTTP methods such as GET and POST (Express.js, 2026).

The Part 1 request flow is:

Client → HTTPS → Node.js/Express → Middleware → Routes → Controllers → User Model → users.json

HTTPS is used to provide encrypted communication between the client and server. Node.js provides an HTTPS module that implements HTTP over TLS/SSL (Node.js, 2026).

### Architecture Diagram

```mermaid
flowchart TD

    USER["User<br/>Client / Freelancer"]

    CLIENT["Part 1 API Client<br/>Postman / Browser"]

    REACT["React Frontend<br/>Planned for later part"]

    HTTPS["HTTPS Server<br/>Node.js<br/>TLS / SSL"]

    CERT["cert.pem<br/>SSL Certificate"]
    KEY["key.pem<br/>Private Key"]

    EXPRESS["Express Application"]

    MIDDLEWARE["API Middleware<br/><br/>CORS<br/>JSON / URL-encoded parser<br/>10 KB request limit"]

    ROUTES["Authentication Routes<br/>/api/auth"]

    VALIDATE["Input Validation<br/>express-validator"]

    CONTROLLER["Auth Controller"]

    REGISTER["POST /register"]
    LOGIN["POST /login"]
    ME["GET /me"]

    JWTMW["JWT Authentication<br/>Middleware"]

    BCRYPT["bcrypt<br/>Hash / Compare Password"]

    JWT["JWT Generation<br/>User ID + Role"]

    MODEL["User Model"]

    STORAGE[("users.json<br/><br/>User ID<br/>Name<br/>Email<br/>Password Hash<br/>Role<br/>Created At")]

    ERROR["404 / Error Handling"]

    RESPONSE["JSON Response"]

    USER --> CLIENT
    USER -.-> REACT

    CLIENT -->|"HTTPS Request"| HTTPS
    REACT -.->|"Future HTTPS Request"| HTTPS

    CERT --> HTTPS
    KEY --> HTTPS

    HTTPS --> EXPRESS
    EXPRESS --> MIDDLEWARE
    MIDDLEWARE --> ROUTES

    ROUTES --> REGISTER
    ROUTES --> LOGIN
    ROUTES --> ME

    REGISTER --> VALIDATE
    LOGIN --> VALIDATE
    VALIDATE --> CONTROLLER

    CONTROLLER --> MODEL
    MODEL --> STORAGE

    CONTROLLER --> BCRYPT
    BCRYPT --> MODEL

    CONTROLLER --> JWT

    ME --> JWTMW
    JWTMW -->|"Verify Token"| MODEL
    JWTMW --> CONTROLLER

    CONTROLLER --> RESPONSE
    JWTMW --> RESPONSE

    EXPRESS --> ERROR
    VALIDATE --> ERROR

    RESPONSE --> CLIENT
    ERROR --> CLIENT
```

## Request Flow

When a user sends a request, it is first received by the HTTPS server. The request is then passed to the Express application and its middleware.

The middleware processes the request before it reaches the authentication routes. For registration and login, the input is validated before the request reaches the authentication controller.

The controller communicates with the User Model, which reads from or writes to `users.json`.

For successful registration or login, bcrypt is used to protect passwords and a JWT is generated. The server then returns a JSON response to the client.

Protected requests, such as `GET /api/auth/me`, pass through the JWT authentication middleware before the user's information is returned.



# 3. Project Structure

The important folders and files in the Part 1 repository are organised as follows:

```text
.
├── .gitignore
├── README.md
├── hustlehub-plus/
│   ├── backend/
│   │   ├── config/config.js
│   │   ├── controllers/authController.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js
│   │   │   ├── errorHandler.js
│   │   │   └── validators.js
│   │   ├── models/userModel.js
│   │   ├── routes/authRoutes.js
│   │   ├── scripts/generateCert.js
│   │   ├── utils/generateToken.js
│   │   ├── .env.example
│   │   ├── nodemon.json
│   │   ├── package.json
│   │   └── server.js
│   └── postman/
│       └── HustleHub_Part1.postman_collection.json
```

The following are **generated locally and never committed**: `backend/.env`, `backend/certs/` and `backend/data/users.json`.

### Important Files and Folders

**`controllers/`**

Contains the authentication business logic. `authController.js` handles registration, login and retrieving the authenticated user's information.

**`middleware/`**

Contains middleware used to validate requests, authenticate JWTs and handle application errors.

**`models/`**

Contains `userModel.js`, which manages reading, creating and finding users in `users.json`.

**`data/`** *(generated at runtime, git-ignored)*

Holds the Part 1 file-based user storage (`users.json`). It is created automatically on first run.

**`routes/`**

Contains the authentication routes and connects API endpoints to the appropriate controller functions.

**`utils/`**

Contains utility functionality such as JWT token generation.

**`config/`**

Contains application configuration.

**`certs/`** *(generated, git-ignored)*

Contains the SSL/TLS certificate and private key used for local HTTPS communication. Create them with `npm run generate-cert`.

**`scripts/`**

Contains the script used to generate the local SSL certificate.

**`postman/`**

Contains the Postman collection used to test the HustleHub+ API.

**`server.js`**

The main entry point of the backend application. It configures Express, middleware, routes, error handling and the HTTPS server.



# 4. Authentication & Security

## Registration

The registration process follows these steps:

```text
User Details
     ↓
Input Validation
     ↓
Duplicate Email Check
     ↓
bcrypt Password Hashing
     ↓
User Stored in users.json
     ↓
JWT Generated
     ↓
JSON Response
```

When a user registers, the application first validates the submitted information.

The registration validation checks the user's name, email, password and role.

The password must meet the required password rules. The password is then hashed using **bcrypt** before it is stored.

The original password is therefore not stored directly in `users.json`.

After the user has been successfully created, the system generates a JWT containing the user's ID and role. The token is returned to the client as part of the response.

---

## Login

The login process follows these steps:

```text
Email + Password
       ↓
Input Validation
       ↓
Find User
       ↓
bcrypt Password Comparison
       ↓
JWT Generation
       ↓
JSON Response
```

When a user logs in, the email and password are first validated.

The system searches for the user using the submitted email address. The submitted password is then compared with the stored bcrypt password hash.

If the credentials are correct, a JWT is generated and returned to the user.

If the credentials are incorrect, the application returns a `401 Unauthorized` response.

The application uses a general authentication error message instead of revealing whether an email address exists. This helps reduce the risk of account enumeration.

---

## JWT Authentication

**JSON Web Token (JWT)** is used to authenticate users after they have successfully logged in or registered.

The JWT contains the user's:

* User ID
* Role

Sensitive information such as the user's password is not placed inside the JWT.

The token allows the server to identify an authenticated user when they make requests to protected endpoints.

The token is sent with requests using the HTTP Authorization header:

```text
Authorization: Bearer <JWT>
```

The JWT authentication middleware verifies the token using the application's JWT secret.

The middleware then retrieves the corresponding user and attaches safe user information to the request.

The protected endpoint implemented in Part 1 is:

```text
GET /api/auth/me
```

If the JWT is missing, invalid or expired, the request is rejected with a `401 Unauthorized` response.

---

## Other Security Controls

### bcrypt Password Hashing

bcrypt is used to hash passwords before they are stored.

This is important because storing passwords in plain text would expose users' passwords if the storage file were compromised.

### Input Validation

The application uses `express-validator` to validate user input.

This helps prevent malformed or invalid information from being processed by the application.

Registration and login inputs are checked before reaching the authentication controller.

### HTTPS

The backend uses HTTPS with SSL/TLS certificates.

HTTPS encrypts communication between the API client and server, helping prevent sensitive information such as login credentials and authentication tokens from being transmitted in plain text.

### Error Handling

The application uses centralised error handling.

Errors such as invalid requests, authentication failures, missing routes and unexpected server errors are handled consistently.

The application avoids exposing unnecessary internal information or server stack traces to users.

### Login timing protection

If an email does not exist, the server still performs a bcrypt comparison against a dummy hash. Both "unknown email" and "wrong password" therefore take the same time and return the same message, so an attacker cannot work out which emails are registered.

### CORS

Cross-Origin Resource Sharing is limited to an allow-list set in `CORS_ORIGIN` (default `http://localhost:5173`). Requests from any other website origin are not given permission by the browser.

### Environment Variables

Sensitive configuration values, including the JWT secret and other environment-specific settings, are stored using environment variables rather than being hard-coded into the application.

The `.env` file is used for local configuration and is **git-ignored**, while `.env.example` provides placeholders for the required configuration (`PORT`, `NODE_ENV`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`).

This reduces the risk of accidentally exposing secrets in source code.

---

### Security & Quality Assurance Handover

This document outlines the implementation details for the security features and static code analysis standards completed as part of the **HustleHub Plus** backend PoE requirements.

---

##  Additional Security Feature: Account Lockout

To protect user accounts against brute-force credential stuffing and unauthorized login attacks, an automated **Account Lockout** mechanism has been implemented.

### **Implementation Details:**
* **Database Schema Modifications (`userModel.js`):**
  * Added `failedLoginAttempts` (Number, default: `0`) to track consecutive incorrect password entries.
  * Added `lockUntil` (Date, default: `null`) to timestamp the expiration of temporary account lockouts.
* **Lockout Logic & Workflow:**
  * Each failed authentication attempt increments a user's `failedLoginAttempts` counter.
  * After 5 consecutive failed attempts the `lockUntil` timestamp is set 15 minutes into the future.
  * Subsequent authentication attempts check `lockUntil`; while it is in the future the request is rejected with the **same** `401 Invalid email or password.` as any other failed login (after a dummy password comparison), so the response and its timing never reveal that an account exists or is locked. An admin can lift the lock with `PATCH /api/admin/users/:id/unlock`. See section 8.5.
  * Successful authentication automatically resets both `failedLoginAttempts` to `0` and clears the `lockUntil` timestamp.

---

##  Static Code Analysis (ESLint)

The backend codebase enforces a strict **"0 errors, 0 warnings"** code quality and syntax standard using **ESLint**.

### **Configuration & Standards (`eslint.config.mjs`):**
* Added `eslint-plugin-security` (recommended rules) and run ESLint with `--max-warnings 0` in the CI pipeline. See section 8.2 for the findings and fixes.
* Configured flat config architecture supporting CommonJS and Node.js globals (`process`, `__dirname`, `module`, `require`, etc.).
* Integrated Jest testing globals (`describe`, `test`, `expect`, etc.) for seamless test suite verification.
* Configured unused argument and variable filters (`argsIgnorePattern: "^_"`, `varsIgnorePattern: "^_"`) to maintain clean syntax checking without compromising express middleware parameter structures.

### **Verification Results:**
The static analysis tool was executed across the entire backend directory (`npm run lint`), resulting in a clean pass with **0 errors and 0 warnings**.

> **Verification Evidence:**
>
> <img width="1042" height="207" alt="Static_Code_Analysis" src="https://github.com/user-attachments/assets/b3f12e13-5772-4b2c-9055-29877ec00fb3" />

> The security-rule findings, fixes and pipeline integration are documented in section 8.2.

---

# 5. API Endpoints

The following endpoints are implemented in Part 1:

| Method | Endpoint             | Purpose                                     | Authentication |
| ------ | -------------------- | ------------------------------------------- | -------------- |
| POST   | `/api/auth/register` | Register a new user                         | Not required   |
| POST   | `/api/auth/login`    | Authenticate a user                         | Not required   |
| GET    | `/api/auth/me`       | Return the authenticated user's information | JWT required   |

### POST `/api/auth/register`

Creates a new client or freelancer account.

A successful registration creates the user, stores the password as a bcrypt hash and returns a JWT.
<img width="981" height="481" alt="image" src="https://github.com/user-attachments/assets/baa370ef-672b-44f9-af05-c15053f96ad9" />
Figure 1 — Successful Registration


### POST `/api/auth/login`

Authenticates an existing user.

The submitted password is compared with the stored bcrypt password hash. If authentication succeeds, a JWT is returned.
<img width="860" height="455" alt="image" src="https://github.com/user-attachments/assets/a5af44db-155d-47d8-ae45-54fc888e828a" />
Figure 2 — Successful Login


### GET `/api/auth/me`

Returns information about the currently authenticated user.

This endpoint requires a valid JWT Bearer token.
<img width="940" height="502" alt="image" src="https://github.com/user-attachments/assets/07c73aad-d533-464a-9ae7-a956ca270aee" />
Figure 3 — Protected /me Request


---

# 6. API Testing

The HustleHub+ Part 1 API was tested using **Postman**.

The Postman collection is included in:

```text
postman/HustleHub_Part1.postman_collection.json
```

## Successful Tests

The following successful scenarios were tested:

| Test                                   | Expected Result |
| -------------------------------------- | --------------- |
| Successful registration                | `200 OK`        |
| Successful login                       | `200 OK`        |
| Protected `/me` request with valid JWT | `200 OK`        |

## Negative and Error Tests

The following error scenarios were also tested:

| Test                                | Expected Result    |
| ----------------------------------- | ------------------ |
| Duplicate email during registration | `409 Conflict`     |
| Invalid registration data           | `400 Bad Request`  |
| Incorrect password                  | `401 Unauthorized` |
| Unknown email                       | `401 Unauthorized` |
| `/me` without JWT                   | `401 Unauthorized` |
| Invalid JWT                         | `401 Unauthorized` |

These tests demonstrate that the API does not only handle successful requests but also responds appropriately to invalid input, authentication failures and protected-resource access attempts.

---

# 7. How to Run the Project

## Requirements

Before running the project, install:

* Node.js
* npm
* Postman for API testing

## Step 1: Clone or Extract the Project

Obtain the HustleHub+ project files and open the project directory in a terminal.

```bash
cd hustlehub-plus
```

## Step 2: Open the Backend

```bash
cd backend
```

## Step 3: Install Dependencies

Run:

```bash
npm install
```

This installs the dependencies required by the backend, including Express, bcrypt, JSON Web Token, express-validator, CORS, dotenv and selfsigned.

## Step 4: Configure Environment Variables

Copy the example file and generate your own secret:

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value as `JWT_SECRET` in `.env`. Never commit `.env`.

## Step 5: Generate the SSL Certificate

The HTTPS server needs a local certificate, which is not stored in the repository:

```bash
npm run generate-cert
```

This creates `backend/certs/cert.pem` and `backend/certs/key.pem`. Your browser or Postman will warn that the certificate is untrusted. This is expected for a local development certificate.

## Step 6: Start the Server

Run the backend using:

```bash
npm start
```

For development, if the project configuration provides the development script, use:

```bash
npm run dev
```

The server runs as an HTTPS API.

## Step 7: Test the API

Open Postman and import:

```text
postman/HustleHub_Part1.postman_collection.json
```

The collection can then be used to test registration, login and the protected `/me` endpoint.




## References

## References


Express.js (2026) Using middleware. Available at: https://expressjs.com/en/guide/using-middleware/ (Accessed: 2 September 2026).

MongoDB (2026) What is the MERN stack? Available at: https://www.mongodb.com/resources/languages/mern-stack (Accessed: 2 September 2026).

Node.js (2026) HTTPS. Available at: https://nodejs.org/api/https.html (Accessed: 2 September 2026).

OWASP Foundation (2026) Password Storage Cheat Sheet. Available at: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html (Accessed: 2 September 2026).

OWASP Foundation (2026) JSON Web Token Cheat Sheet. Available at: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html (Accessed: 2 September 2026).

React (2026) React documentation. Available at: https://react.dev/learn (Accessed: 2 September 2026).

Mermaid (n.d.) HustleHub+ system architecture diagram. Available at: Mermaid diagram (Accessed: 1 September 2026).


SARS (2026) Rates of tax for individuals. Available at: https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/ (Accessed: 30 October 2026).
