# Backend - Mini Market Financial Control & Three-Day Audit API

Express.js + MySQL 8.0+ server-authoritative financial calculation and audit engine.

---

## Prerequisites
- Node.js (v18.0.0 or higher)
- MySQL Server (v8.0 or higher)

---

## Setup & Installation

1. **Install Dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment:**
   Create `.env` based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   On Windows, confirm the file is named exactly `backend\.env`, not
   `backend\.env.txt` (File Explorer can hide known extensions). Start the
   backend commands from the `backend` directory so dotenv reads that file.
   Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` for your
   MySQL installation. Set `JWT_SECRET` and `CORS_ORIGIN` as described below.
   `JWT_SECRET` must be a unique random value of at least 32 bytes; the server refuses
   to start if it is missing or too short. `CORS_ORIGIN` must list exact allowed
   browser origins (comma-separated, with no paths or wildcard). Native mobile
   requests without an `Origin` header continue to work; browser requests from
   other origins are not granted CORS access.
   Set `TRUST_PROXY_HOPS` to the exact number of trusted reverse proxies between
   the Internet and this Node service when deploying behind a load balancer
   (often `1`); leave it at `0` when directly exposed. Correct configuration is
   needed for client-IP rate limits. Do not trust forwarded headers from
   untrusted clients.
   Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`,
   `SMTP_FROM`, and `PASSWORD_RESET_URL` to enable account-independent
   password-reset requests. `PASSWORD_RESET_URL` must point to the deployed
   mobile/web app or its `minimarket-financial-audit://reset` deep link.
   Production startup refuses to serve traffic unless SMTP credentials and a
   non-local HTTPS/deep-link reset URL are configured. Authentication routes
   are rate-limited; if running multiple backend instances, configure a shared
   rate-limit store so limits are enforced across instances.
   The forgot-password endpoint always returns a generic response to avoid
   disclosing whether an email is registered. If mail is not arriving, check
   backend startup warnings and `Password reset request failed` logs, then
   verify SMTP credentials and the reset URL. The default localhost URL only
   works when the user can access the same local Expo web server.

3. **Initialize the Database Schema:**
   ```bash
   npm run db:init
   ```
   Run this from the `backend` directory after configuring `.env`. MySQL must be
   running, and the configured user must be allowed to create databases and
   tables. This command creates the database named by `DB_NAME` (default:
   `minimarket_audit_db`) and initializes its schema; you do not need to create
   the database separately.
   * For manual initialization, create the database matching `DB_NAME` first,
     then import `src/db/schema.sql` in MySQL Workbench / phpMyAdmin. If `DB_NAME`
     is not the default, update the SQL file's `CREATE DATABASE` and `USE` names.
   No fixed demo password is stored in the project. To provision a local demo
   Manager, run `npm run manager:create` in an interactive terminal. The
   suggested username is `demo.manager`; enter a strong password when prompted
   (the password is hidden). The resulting account is active and approved.
   Public registration accepts Recorder and Auditor roles, and those accounts
   remain pending until approved by a Manager. Managers can then approve
   sign-ups and create or manage Recorder, Auditor, and Manager accounts in the app.
   `db:init` adds phone and approval fields to existing databases, preserves
   existing account approval, and converts legacy administrator accounts to
   Manager. Remove any demo accounts previously created in an existing database
   before deployment.
   The API also checks for missing account columns at startup and applies the
   account compatibility migration before accepting requests. If MySQL denies
   schema changes or the database/tables do not exist, run `npm run db:init`
   from `backend` and verify the same `DB_NAME` and MySQL connection settings
   are used when starting the API.

Business-day automation uses `Africa/Addis_Ababa`: daily opening at 00:00 and
closing at 22:00. The scheduler synchronizes at startup, every 15 seconds, and
before financial API requests, so missed ticks are reconciled after a restart.
Automatic closing records ledger estimates rather than physical counts.
Managers can reopen a closed, unaudited day only with a reason; the previous
closing snapshot and all subsequent financial edits remain recorded.
Income/expense edits require an explanation and preserve before/after values.
System audit-trail API access is Manager-only; essential internal audit logs
continue to be retained.

5. **Edit the Manager profile:** Sign in with the account created above, open
   **Settings & Security**, edit the profile fields, and choose **Save Profile**.
   The Manager role cannot be removed from one's own account; password changes
   remain in the separate Change Password section.

4. **Start Development Server:**
   ```bash
   npm run dev
   # or
   npm start
   ```
   The API uses port `5000` by default. If another process is already using it,
   stop that process before starting another server. You can override the backend
   port with `PORT` in `.env`; if you do, update the mobile app's API base URL to
   use the same port.

---
