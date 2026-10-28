# 🏪 MINI MARKET FINANCIAL CONTROL & THREE-DAY AUDIT MANAGEMENT SYSTEM
**Hamer Shop Financial Reconciliation & Periodic Internal Audit Engine (የሐመር ሱቅ የእለት ገቢና የሦስት ቀን ኦዲት መቆጣጠሪያ)**

---

## 📁 Project Architecture & Directory Layout

```
audit-system/
├── backend/                  # Node.js + Express.js + MySQL 8.0+ REST API
│   ├── src/
│   │   ├── config/           # Database pool & transaction engine
│   │   ├── controllers/      # Income, Expense, Closing, Audit, Discrepancy & Report controllers
│   │   ├── middleware/       # JWT Authentication & Role Authorization (RBAC)
│   │   ├── services/         # Server-authoritative calculation engine & Audit logger
│   │   ├── routes/           # REST endpoint routers
│   │   ├── db/               # MySQL DDL Schema
│   │   └── server.js         # Express Application entry point
│   ├── package.json
│   ├── .env.example
│   └── README.md
├── mobile/                   # React Native + Expo Mobile Application
│   ├── src/
│   │   ├── api/              # Typed REST client with token management
│   │   ├── context/          # Auth context & session provider
│   │   ├── components/       # FinancialCard, StatusBadge, DiscrepancyAlerts
│   │   ├── navigation/       # Navigation stack with RBAC guards
│   │   ├── screens/          # Dashboard, Income, Expense, Closing, 3-Day Audit, Discrepancies, Reports, Logs
│   │   ├── types/            # TypeScript financial & audit interfaces
│   │   └── utils/            # ETB currency & date formatting
│   ├── App.tsx
│   ├── app.json
│   ├── package.json
│   └── README.md
└── docs/                     # Specifications & Design Documents
    ├── 01_REQUIREMENTS_AND_BUSINESS_RULES.md
    ├── 02_AUDIT_RULES_AND_PERMISSIONS.md
    ├── 03_DATABASE_DESIGN.sql
    └── 04_API_SPECIFICATION.md
```

---

## ⚙️ How to Open and Run in VS Code

### Step 1: Open the Project in VS Code
Open VS Code and choose **File > Open Folder...**, then select:
`c:\research proposal\OneDrive\Desktop\audit-system`

### Step 2: Configure & Start MySQL Database
1. Start the MySQL service.
2. Create `backend/.env` from `backend/.env.example` and configure the MySQL
   connection settings, `DB_NAME`, and the required JWT/CORS environment values:
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=<your MySQL password>
   DB_NAME=minimarket_audit_db
   JWT_SECRET=<unique random value of at least 32 bytes>
   CORS_ORIGIN=<comma-separated exact browser origins>
   ```
   On Windows, ensure the filename is exactly `backend\.env`, not
   `backend\.env.txt` (turn on file-name extensions in File Explorer to check).
3. From the project directory, initialize the schema (no default users are created):
   ```bash
   cd backend
   npm install
   npm run db:init
   ```
   Run the API from this same `backend` directory so it reads the same `.env`.
   The configured MySQL user must have permission to create the database and
   tables. `db:init` creates the database selected by `DB_NAME` (default:
   `minimarket_audit_db`). Confirm it reports `Schema created successfully`
   before starting the API. Existing accounts remain approved during the
   upgrade; legacy administrator accounts are converted to Manager. No default
   login credentials are built into the app. On a fresh installation, run
   `npm run manager:create` from `backend` to create a local Manager account;
   the suggested username is `demo.manager` and you choose the password in a
   hidden terminal prompt. Managers can edit their own profile in Settings and
   approve registrations or assign roles in User Management.

### Step 3: Start the Backend Server
```bash
cd backend
npm run dev
# Server will start on http://localhost:5000/api/v1
```

### Step 4: Start the Mobile Application (Expo)
Open a second terminal in VS Code:
```bash
cd mobile
npm install
npx expo start
```
- Press `w` to run on Web Browser.
- Press `a` to run on Android Emulator.
- Or scan the QR code with **Expo Go** on your smartphone.

---

## 👥 System Roles & Strict Role Specialization

The database is not initialized with demo accounts or default credentials.
Public sign-up accepts Recorder or Auditor accounts, which remain pending until
approved by a Manager. A first Manager must be securely provisioned by the
operator; Manager-created accounts can be assigned any role and are active
immediately.

| Role | Access |
| :--- | :--- |
| **Recorder (መዝጋቢ)** | Daily income and expense entry, assigned day closing, and discrepancy explanations. |
| **Manager (ኃላፊ)** | Full application access, user/role management, pending registration approval, and all financial/audit workflows. |
| **Auditor (ኦዲተር)** | Read financial records; edit existing income/expense entries while the day is open with a reason; 3-Day Audits, discrepancy review, reports, and analytics. No system audit-trail access. |

---

## 📈 Interactive Financial Trends & Analytics Engine

The system includes interactive chart dashboards accessible by Managers and Auditors:
* **Timeframes:** `Daily`, `3-Day Cycle` (*የሦስት ቀን ኦዲት*), `Weekly`, and `Monthly`.
* **Income vs. Expense Trajectory:** Interactive dual-column bar visualization tracking operational cash retention.
* **Safe Cash vs. Bank Liquidity:** Stacked visual breakdown ensuring cash and bank balances are independently analyzed.
* **Audit Discrepancy & Variance Heatmap:** Tracks cumulative shortages (🔴), surpluses (🟠), and perfect closures (🟢).
* **Endpoints:**
  - `GET /api/v1/analytics/trends?timeframe=daily|3day|weekly|monthly`
  - `GET /api/v1/analytics/discrepancies`
* Daily, weekly, and monthly views aggregate recorded transactions from the
  most recent business-day periods. The 3-Day view reflects submitted formal
  three-day audits, so it remains empty until an audit has been submitted.

Business days are scheduled to open at 00:00 and close at 22:00 in
`Africa/Addis_Ababa`. The Manager may override the daily schedule; automated
closing records estimated ledger balances and requires physical verification.
Password recovery requires SMTP settings in `backend/.env`; reset tokens are
hashed, expire after 30 minutes, and are single use.

---

## 🧮 Core Accounting & Audit Formulas

1. **Daily Expected Cash in Safe (*ካዝና*):**
   $$\text{Expected Cash} = \text{Opening Cash} + \text{Cash Income} - \text{Cash Expenses} \pm \text{Adjustments}$$

2. **Daily Expected Bank Balance (*ባንክ*):**
   $$\text{Expected Bank} = \text{Opening Bank} + \text{Bank Income} - \text{Bank Expenses} \pm \text{Adjustments}$$

3. **Three-Day Audit Cycle Formula (*የሦስት ቀን ኦዲት*):**
   $$\text{Expected 3-Day Cash} = \text{Opening Cash}_{D_1} + \sum_{i=1}^{3} \text{Cash Income}_{D_i} + \text{Add. Income} - \sum_{i=1}^{3} \text{Cash Expenses}_{D_i} \pm \text{Adjustments}$$
   $$\text{Expected 3-Day Bank} = \text{Opening Bank}_{D_1} + \sum_{i=1}^{3} \text{Bank Income}_{D_i} - \sum_{i=1}^{3} \text{Bank Expenses}_{D_i} \pm \text{Adjustments}$$
   $$\text{Audit Value} = \text{Actual Count} - \text{Expected Balance} = 0\text{ ETB (Reconciled Target)}$$
