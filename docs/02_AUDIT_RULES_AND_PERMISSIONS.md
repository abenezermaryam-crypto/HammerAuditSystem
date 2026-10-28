# AUDIT RULES, ROLES & PERMISSION SPECIFICATION
## Step 3, 4 & 5: Governance, Segregation of Duties, State Machines & Use Cases

---

### 1. USER ROLES MATRIX & SEGREGATION OF DUTIES

The system enforces strict segregation of duties to prevent internal fraud, unrecorded cash drains, and retrospective tampering.

| Capability / Action | Recorder (`recorder`) | Manager (`manager`) | Auditor (`auditor`) |
| :--- | :---: | :---: | :---: |
| **Record Daily Aggregated Income and Expenses** | ✅ Yes | ✅ Yes | ❌ Read Only |
| **Edit existing income and expense records while the day is open (reason required)** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Submit Physical Cash & Bank Counts / Daily Closing** | ✅ Assigned Day | ✅ Yes | ❌ Read Only |
| **Open a Business Day** | ❌ No | ✅ Yes | ❌ No |
| **Conduct and sign off 3-Day Audits** | ❌ No | ✅ Yes | ✅ Yes |
| **Review and resolve discrepancies** | ✅ Explain assigned cases | ✅ Full access | ✅ Review access |
| **Create Approved Adjustment (`ADJ-XXX`)** | ❌ No | ✅ Yes | ✅ Yes |
| **View reports and analytics** | ❌ No | ✅ Full access | ✅ Full access |
| **View system audit trail** | ❌ No | ✅ Full access | ❌ No |
| **Manage users, roles, and pending registrations** | ❌ No | ✅ Full control | ❌ No |

Public registration is limited to Recorder and Auditor roles. Every newly
registered account is inactive for sign-in until a Manager approves it. Managers
can create approved accounts and assign Recorder, Auditor, or Manager roles.
Accounts are deactivated rather than deleted so financial and audit history
retains valid user references.

Business days automatically open at 00:00 and close at 22:00 in the
`Africa/Addis_Ababa` time zone. Managers may override the schedule. Automated
closing uses ledger-estimated balances, clearly marked for Manager physical
verification. Reopening a closed day requires a Manager reason, preserves the
prior closing snapshot, and is blocked for audited days.

---

### 2. DISCREPANCY LIFECYCLE STATE MACHINE

When $\text{Actual Count} \ne \text{Expected Balance}$, the backend generates a `Discrepancy` entity that follows this strict finite state machine:

```
                  [ Daily Closing / 3-Day Audit Count ]
                                     |
                         (Actual != Expected)
                                     |
                                     v
                           [ Status: OPEN ]
                                     |
                           (Assign Responsible User)
                                     |
                                     v
                        [ Status: IN_INVESTIGATION ]
                                     |
              +----------------------+----------------------+
              |                                             |
     (Explanation Provided)                       (Missing Expense Found)
              |                                             |
              v                                             v
     [ Status: REVIEWED ]                        [ Create Adjustment Request ]
              |                                             |
     (Auditor Approval)                           (Auditor Approved)
              |                                             |
              v                                             v
     [ Status: RESOLVED ]                        [ Status: ADJUSTED_RESOLVED ]
              |                                             |
              +----------------------+----------------------+
                                     |
                                     v
                            [ Status: CLOSED ]
```

---

### 3. CLOSED DAY PROTECTION & ANTI-MANIPULATION PROTOCOL

1. **State Immutability:** Once a business day status is `CLOSED`, financial edits are rejected by the API. A Manager must reopen it with a recorded reason; every correction preserves old/new values, editor, and reason.
2. **Adjustment Accounting:** If an expense of $500\text{ ETB}$ was legitimately missed on Day 1:
   - Day 1 record is **never** altered.
   - An **Approved Adjustment Record** (`ADJ-001`, Amount: $-500\text{ ETB}$, Type: `UNRECORDED_EXPENSE`, Reason: "Invoice #4432 verified") is created.
   - The adjustment feeds directly into the expected balance formula and leaves a permanent audit trail.
3. **No Direct Expected Balance Typing:**
   - A user can never submit `expected_cash = 25000`. The server computes:
     `expected_cash = opening_cash + total_cash_income - total_cash_expenses + adjustments`.
