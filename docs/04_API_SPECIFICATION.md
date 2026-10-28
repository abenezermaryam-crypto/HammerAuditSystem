# REST API SPECIFICATION & CONTRACTS
## Step 8: Complete Backend API Design (Express.js RESTful API)

**Base URL:** `http://localhost:5000/api/v1`

---

### 1. AUTHENTICATION & SESSIONS
* `POST /auth/register`
  - Body: `{ "full_name": "...", "phone_number": "...", "username": "...", "email": "...", "password": "...", "role": "recorder|auditor" }`
  - Creates a pending account; a Manager must approve it before login is allowed.
* `POST /auth/login`
  - Body: `{ "username": "...", "password": "..." }`
  - Response includes a JWT and the authenticated user's role.
* `POST /auth/change-password`
  - Requires current password and a strong replacement password (10-72 bytes, uppercase, lowercase, number, and symbol).
* `POST /auth/forgot-password` accepts an email and returns the same generic response regardless of account existence. SMTP sends a hashed, 30-minute, single-use reset link.
* `POST /auth/reset-password` accepts `{ "token": "...", "new_password": "..." }`.
* Manager-only user management:
  - `GET /users` lists account status and roles.
  - `POST /users` creates an approved user with role `recorder`, `auditor`, or `manager`.
  - `PATCH /users/me` updates the signed-in Manager's own name, phone, username, and email without changing their role.
  - `PUT /users/:id` edits profile, role, and optionally password.
  - `POST /users/:id/approve` approves a pending account.
  - `DELETE /users/:id` deactivates an account without deleting its audit history.
  - `PATCH /users/:id/activate` reactivates a deactivated account.
* `GET /auth/me`
  - Header: `Authorization: Bearer <TOKEN>`
  - Response: `{ "user": { ... } }`

---

### 2. BUSINESS DAYS & DAILY CLOSING
* `GET /business-days/current`
  - Returns current open business day or status.
* `POST /business-days/open` (Manager)
  - Body: `{ "business_date": "YYYY-MM-DD", "opening_cash": 10000, "opening_bank": 30000, "reason": "..." }`. Reopening a closed day requires a reason.
* Schedule: Opens at 00:00 and closes at 22:00 `Africa/Addis_Ababa`; Manager overrides are stored by business date.
* `GET /business-days/:id/reconciliation-preview`
  - Returns calculated `expected_cash`, `expected_bank`, aggregated incomes, and aggregated expenses.
* `POST /business-days/:id/close` (Recorder / Manager)
  - Body: `{ "actual_cash": 15700.00, "actual_bank": 34500.00, "notes": "Shift closed" }`
  - Server executes reconciliation transaction, calculates differences, logs discrepancy if needed, and locks day.

---

### 3. DAILY INCOME & EXPENSES
* `POST /incomes` (Recorder / Manager)
  - Body: `{ "business_day_id": 1, "cash_income": 12000.00, "bank_income": 5000.00, "description": "Aggregated daily income" }`
* `GET /incomes?business_day_id=1` (Recorder / Auditor / Manager)
* `PUT /incomes/:id` (Recorder / Auditor / Manager; open day only; modification reason required)
* `POST /expenses` (Recorder / Manager)
  - Body: `{ "business_day_id": 1, "description": "Shop supply", "amount": 1000.00, "payment_source": "CASH", "reference_number": "REC-01" }`
* `GET /expenses?business_day_id=1` (Recorder / Auditor / Manager)
* `PUT /expenses/:id` (Recorder / Auditor / Manager; open day only; modification reason required)

---

### 4. THREE-DAY AUDIT MANAGEMENT (የሦስት ቀን ኦዲት)
* `GET /audits` (Auditor / Manager)
  - Returns list of 3-day audits with status filters.
* `POST /audits/preview` (Auditor / Manager)
  - Body: `{ "day_ids": [1, 2, 3], "additional_cash_income": 0 }`
  - Server returns multi-day aggregated formula calculations.
* `POST /audits/submit` (Auditor / Manager)
  - Body: `{ "day_ids": [1, 2, 3], "actual_cash": 23200.00, "actual_bank": 34500.00, "additional_cash_income": 0, "remarks": "Audit completed" }`
  - Creates 3-day audit record, updates statuses of business days to `AUDITED`.
* `POST /audits/:id/sign-off` (Auditor / Manager)
  - Closes the audit cycle.

---

### 5. DISCREPANCIES & ADJUSTMENTS
* `GET /discrepancies` (Recorder / Auditor / Manager; filter by `status`, `account_type`)
* `POST /discrepancies/:id/explain` (Responsible Person / Manager)
  - Body: `{ "explanation": "Receipt #41 was omitted", "evidence_ref": "DOC-99" }`
* `POST /adjustments` (Auditor / Manager)
  - Body: `{ "discrepancy_id": 1, "business_day_id": 1, "account_type": "CASH", "amount": -500.00, "reason_category": "UNRECORDED_EXPENSE", "detailed_reason": "Verified voucher #88" }`

---

### 6. FINANCIAL CONTROL REPORTS & DASHBOARD
* `GET /dashboard/summary` - Key dashboard metrics (Today's balances, cash status, bank status, open discrepancies, audit state).
* `GET /reports/incomes?start_date=...&end_date=...` (Auditor / Manager)
* `GET /reports/expenses?start_date=...&end_date=...` (Auditor / Manager)
* `GET /reports/closings?start_date=...&end_date=...` (Auditor / Manager)
* `GET /reports/three-day-audits` (Auditor / Manager)
* `GET /analytics/trends` and `GET /analytics/discrepancies` (Auditor / Manager)
  - `timeframe=daily|weekly|monthly` aggregates recorded transaction totals
    from the latest business days; `timeframe=3day` lists submitted formal
    three-day audits and is empty until one has been submitted.
* `GET /reports/audit-trail` (Manager only; denied to Auditors)
