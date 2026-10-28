# MINI MARKET FINANCIAL CONTROL & THREE-DAY AUDIT MANAGEMENT SYSTEM
## Step 1 & 2: System Requirements & Financial Business Rules Specification
**System Name:** Hamer Shop Financial & Audit Control System (የሐመር ሱቅ የእለት ገቢና የሦስት ቀን ኦዲት መቆጣጠሪያ)

---

### 1. STRICT SYSTEM BOUNDARIES & EXCLUSIONS
To guarantee financial integrity and simplicity, the system strictly enforces the following boundary:
* **Excluded Capabilities (Out-of-Scope):**
  - No product SKUs, categories, or barcode scanning.
  - No inventory stock management, stock-taking, or reorder levels.
  - No individual customer profiles, shopping carts, or line-item sales.
  - No POS terminal hardware integration or point-of-sale registers.
  - No purchasing / supplier order tracking.
* **Included Capabilities (In-Scope):**
  - Aggregated daily financial income movements (Cash Safe vs. Bank).
  - Aggregated and itemized daily operational expenses linked to exact payment source.
  - Independent opening, expected, actual, and closing balances for **Cash** and **Bank**.
  - Daily reconciliation with automatic discrepancy classification (*Shortage / Surplus / Balanced*).
  - Periodic **Three-Day Audit Cycle** (*የሦስት ቀን ኦዲት*) with comprehensive financial balance calculations.
  - Controlled Discrepancy Investigation, Explanations, Supporting References, and Authorized Adjustments.
  - Role-Based Access Control (RBAC), Segregation of Duties, and Immutable Audit Trails.

---

### 2. CORE FINANCIAL ACCOUNTS & MULTI-ACCOUNT ISOLATION
The system manages two isolated financial accounts:

1. **Cash in Safe (ካዝና):**
   - Physical liquid paper and coin currency held inside the store safe.
   - Reduced by physical cash expenses; increased by cash sales income and cash capital additions.
2. **Bank Account (ባንክ):**
   - Digital funds held in commercial bank accounts and verified mobile money accounts (e.g., CBE, Telebirr, Awash).
   - Reduced by direct bank transfer expenses; increased by digital customer transfers/deposits.

```
+-----------------------------------------------------------------------------+
|                               FINANCIAL LEDGER                              |
+------------------------------------+----------------------------------------+
|          CASH ACCOUNT              |              BANK ACCOUNT              |
|              (ካዝና)                |                 (ባንክ)                  |
+------------------------------------+----------------------------------------+
| • Opening Cash Balance             | • Opening Bank Balance                 |
| • (+) Daily Cash Income            | • (+) Daily Bank Income                |
| • (-) Daily Cash Expenses          | • (-) Daily Bank Expenses              |
| • (±) Approved Cash Adjustments    | • (±) Approved Bank Adjustments        |
| = Expected Cash Balance            | = Expected Bank Balance                |
| vs. Actual Physical Cash Count     | vs. Actual Verified Bank Statement     |
| = Cash Variance (Shortage/Surplus) | = Bank Variance (Discrepancy)          |
+------------------------------------+----------------------------------------+
| RULE: A Cash Shortage CAN NEVER be compensated by a Bank Surplus!          |
+-----------------------------------------------------------------------------+
```

---

### 3. MATHEMATICAL SPECIFICATION & FORMULAS

#### 3.1 Daily Income Aggregation
$$\text{Total Daily Income} = \text{Cash Income} + \text{Bank Income}$$
* Calculated strictly by the system engine.

#### 3.2 Daily Expected Cash Calculation
$$\text{Expected Cash}_t = \text{Opening Cash}_t + \text{Cash Income}_t - \sum \text{Cash Expenses}_t \pm \sum \text{Approved Adjustments (Cash)}_t$$

#### 3.3 Daily Cash Variance & Reconciliation
$$\Delta_{\text{Cash}} = \text{Actual Cash Count} - \text{Expected Cash}$$
* If $\Delta_{\text{Cash}} = 0 \implies \text{Cash Status: \textbf{BALANCED} (🟢)}$
* If $\Delta_{\text{Cash}} < 0 \implies \text{Cash Status: \textbf{SHORTAGE} (🔴)}$ ($\text{Amount} = |\Delta_{\text{Cash}}|$)
* If $\Delta_{\text{Cash}} > 0 \implies \text{Cash Status: \textbf{SURPLUS} (🟠)}$ ($\text{Amount} = \Delta_{\text{Cash}}$)

#### 3.4 Daily Expected Bank Calculation
$$\text{Expected Bank}_t = \text{Opening Bank}_t + \text{Bank Income}_t - \sum \text{Bank Expenses}_t \pm \sum \text{Approved Adjustments (Bank)}_t$$

#### 3.5 Daily Bank Variance & Reconciliation
$$\Delta_{\text{Bank}} = \text{Actual Verified Bank} - \text{Expected Bank}$$
* If $\Delta_{\text{Bank}} = 0 \implies \text{Bank Status: \textbf{BALANCED} (🟢)}$
* If $\Delta_{\text{Bank}} \ne 0 \implies \text{Bank Status: \textbf{DISCREPANCY} (🔴)}$

---

### 4. THREE-DAY AUDIT CYCLE FORMULAS (*የሦስት ቀን ኦዲት*)

A three-day audit is conducted over three consecutive operating days ($d_1, d_2, d_3$):

#### 4.1 Expected Three-Day Cash Balance
$$\text{Expected Three-Day Cash} = \text{Opening Cash}_{d_1} + \sum_{i=1}^{3} \text{Cash Income}_{d_i} + \text{Other Incomes} - \sum_{i=1}^{3} \text{Cash Expenses}_{d_i} \pm \text{Adjustments}$$

#### 4.2 Expected Three-Day Bank Balance
$$\text{Expected Three-Day Bank} = \text{Opening Bank}_{d_1} + \sum_{i=1}^{3} \text{Bank Income}_{d_i} - \sum_{i=1}^{3} \text{Bank Expenses}_{d_i} \pm \text{Adjustments}$$

#### 4.3 Three-Day Audit Verification (Target Value = 0)
$$\text{Audit Value}_{\text{Cash}} = \text{Actual Cash Count} - \text{Expected Three-Day Cash} = 0\text{ ETB}$$
$$\text{Audit Value}_{\text{Bank}} = \text{Actual Verified Bank} - \text{Expected Three-Day Bank} = 0\text{ ETB}$$

* When $\text{Audit Value} = 0$, the audit period is eligible for formal closure and sign-off.
* If $\text{Audit Value} \ne 0$, an investigation case is automatically generated with a mandatory explanation and designated responsible party.
