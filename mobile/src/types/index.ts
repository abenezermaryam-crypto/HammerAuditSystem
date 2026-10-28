export type UserRole = 'recorder' | 'manager' | 'auditor';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone_number?: string | null;
  role: UserRole;
}

export interface ManagedUser extends User {
  phone_number: string | null;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
}

export interface BusinessDay {
  id: number;
  business_date: string;
  opening_cash: number;
  opening_bank: number;
  status: 'OPEN' | 'PENDING_CLOSING' | 'CLOSED' | 'AUDITED';
  opened_by: number;
  opened_by_name?: string;
  closed_by?: number;
  closed_by_name?: string;
  closed_at?: string;
}

export interface DailyIncome {
  id: number;
  business_day_id: number;
  cash_income: number;
  bank_income: number;
  total_income: number;
  description?: string;
  reference_number?: string;
  recorded_by_name?: string;
  created_at: string;
}

export interface DailyExpense {
  id: number;
  business_day_id: number;
  description: string;
  amount: number;
  payment_source: 'CASH' | 'BANK';
  reference_number?: string;
  expense_category?: string;
  recorded_by_name?: string;
  created_at: string;
}

export interface DayReconciliationPreview {
  businessDay: BusinessDay;
  openingCash: number;
  openingBank: number;
  totalCashIncome: number;
  totalBankIncome: number;
  totalDailyIncome: number;
  totalCashExpenses: number;
  totalBankExpenses: number;
  totalDailyExpenses: number;
  netDailyCashActivity?: number;
  netDailyBankActivity?: number;
  cashAdjustments: number;
  bankAdjustments: number;
  expectedCash: number;
  expectedBank: number;
}

export interface DashboardMetrics {
  hasDay: boolean;
  business_day_id?: number;
  business_date?: string;
  status: 'OPEN' | 'CLOSED' | 'AUDITED' | 'NO_DAY_OPENED';
  opening_cash: number;
  opening_bank: number;
  today_income: number;
  today_expenses: number;
  expected_cash: number;
  actual_cash: number;
  cash_difference: number;
  cash_status: 'BALANCED' | 'SHORTAGE' | 'SURPLUS';
  expected_bank: number;
  actual_bank: number;
  bank_difference: number;
  bank_status: 'BALANCED' | 'DISCREPANCY';
  openDiscrepancies: number;
  threeDayAuditStatus: string;
  latestAuditCode?: string;
  alerts: Array<{ type: 'danger' | 'warning' | 'info'; message: string }>;
}

export interface Discrepancy {
  id: number;
  discrepancy_code: string;
  source_type: 'DAILY_CLOSING' | 'THREE_DAY_AUDIT';
  business_date: string;
  account_type: 'CASH' | 'BANK';
  expected_amount: number;
  actual_amount: number;
  difference_amount: number;
  discrepancy_type: 'SHORTAGE' | 'SURPLUS' | 'BANK_MISMATCH';
  status: 'OPEN' | 'IN_INVESTIGATION' | 'REVIEWED' | 'RESOLVED' | 'ADJUSTED_RESOLVED' | 'CLOSED';
  responsible_person_name?: string;
  explanation?: string;
  evidence_ref?: string;
  created_at: string;
}

export interface ThreeDayAudit {
  id: number;
  audit_code: string;
  start_date: string;
  end_date: string;
  opening_cash: number;
  total_3day_cash_income: number;
  total_3day_cash_expenses: number;
  additional_cash_income: number;
  expected_cash: number;
  actual_cash: number;
  cash_difference: number;
  cash_audit_status: 'BALANCED' | 'SHORTAGE' | 'SURPLUS';
  opening_bank: number;
  total_3day_bank_income: number;
  total_3day_bank_expenses: number;
  expected_bank: number;
  actual_bank: number;
  bank_difference: number;
  bank_audit_status: 'BALANCED' | 'DISCREPANCY';
  overall_status: 'OPEN' | 'IN_REVIEW' | 'BALANCED' | 'DISCREPANCY_FOUND' | 'INVESTIGATION' | 'RESOLVED' | 'CLOSED';
  auditor_name: string;
  approved_by_name?: string;
  auditor_remarks?: string;
}

export type TimeframeType = 'daily' | '3day' | 'weekly' | 'monthly';

export interface FinancialTrendPoint {
  label: string;
  date?: string;
  code?: string;
  cashIncome: number;
  bankIncome: number;
  totalIncome: number;
  cashExpense: number;
  bankExpense: number;
  totalExpense: number;
  cashBalance?: number;
  bankBalance?: number;
  expectedCash?: number;
  expectedBank?: number;
  actualCash?: number;
  actualBank?: number;
  cashDiff?: number;
  bankDiff?: number;
  status?: string;
}

export interface DiscrepancyMetrics {
  totalCases: number;
  openCases: number;
  investigatingCases: number;
  resolvedCases: number;
  totalShortageETB: number;
  totalSurplusETB: number;
}
