import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const FALLBACK_API_URL = 'http://172.17.130.100:5000/api/v1';

function resolveDefaultApiUrl(): string {
  try {
    const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (configured) {
      return configured.replace(/\/+$/, '');
    }

    const expoHost =
      Constants.expoConfig?.hostUri?.split(':')[0] ||
      Constants.manifest2?.extra?.expoClient?.hostUri?.split(':')[0] ||
      Constants.manifest?.debuggerHost?.split(':')[0];

    if (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1') {
      return 'http://' + expoHost + ':5000/api/v1';
    }

    return FALLBACK_API_URL;
  } catch {
    return FALLBACK_API_URL;
  }
}

let cachedServerUrl: string | null = null;

export async function getCustomServerUrl(): Promise<string> {
  if (cachedServerUrl) return cachedServerUrl;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('custom_server_url');
        if (stored?.trim()) {
          cachedServerUrl = stored.trim().replace(/\/+$/, '');
          return cachedServerUrl;
        }
      }
    } else {
      const stored = await SecureStore.getItemAsync('custom_server_url');
      if (stored?.trim()) {
        cachedServerUrl = stored.trim().replace(/\/+$/, '');
        return cachedServerUrl;
      }
    }
  } catch (err) {
    console.warn('Could not read custom server URL:', err);
  }

  cachedServerUrl = resolveDefaultApiUrl();
  return cachedServerUrl;
}

export async function setCustomServerUrl(url: string): Promise<string> {
  let cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'http://' + cleaned;
  }
  if (!cleaned.endsWith('/api/v1')) {
    cleaned = cleaned + '/api/v1';
  }

  cachedServerUrl = cleaned;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('custom_server_url', cleaned);
      }
    } else {
      await SecureStore.setItemAsync('custom_server_url', cleaned);
    }
  } catch (err) {
    console.warn('Could not persist custom server URL:', err);
  }
  return cleaned;
}

let memoryToken: string | null = null;

// Cross-platform token storage
export async function setToken(token: string | null) {
  memoryToken = token;

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('auth_token');
      }
      return;
    }
    if (token) {
      await SecureStore.setItemAsync('auth_token', token);
    } else {
      await SecureStore.deleteItemAsync('auth_token');
    }
  } catch (err) {
    console.warn('Storage warning:', err);
  }
}

export async function getToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('auth_token');
      }
      return memoryToken;
    }
    memoryToken = await SecureStore.getItemAsync('auth_token');
    return memoryToken;
  } catch (err) {
    return null;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const token = await getToken();
  const baseUrl = await getCustomServerUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.error || `HTTP Error ${response.status}`);
    }

    return data;
  } catch (error: any) {
    const message = error?.message || 'Unable to reach the backend service.';
    throw new Error(message);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  login: (credentials: { username: string; password: string }) =>
    apiRequest('/auth/login', 'POST', credentials),
  register: (data: {
    full_name: string;
    phone_number: string;
    username: string;
    email: string;
    password: string;
    role: 'recorder' | 'auditor';
  }) => apiRequest('/auth/register', 'POST', data),
  getUsers: () => apiRequest<{ users: import('../types').ManagedUser[] }>('/users'),
  createUser: (data: {
    full_name: string;
    phone_number: string;
    username: string;
    email: string;
    password: string;
    role: import('../types').UserRole;
  }) => apiRequest('/users', 'POST', data),
  updateOwnProfile: (data: {
    full_name: string;
    phone_number: string;
    username: string;
    email: string;
  }) => apiRequest<{ user: import('../types').User }>('/users/me', 'PATCH', data),
  updateUser: (id: number, data: {
    full_name: string;
    phone_number: string;
    username: string;
    email: string;
    role: import('../types').UserRole;
    password?: string;
  }) => apiRequest(`/users/${id}`, 'PUT', data),
  approveUser: (id: number) => apiRequest(`/users/${id}/approve`, 'POST'),
  activateUser: (id: number) => apiRequest(`/users/${id}/activate`, 'PATCH'),
  removeUser: (id: number) => apiRequest(`/users/${id}`, 'DELETE'),
  getMe: () => apiRequest('/auth/me'),
  changePassword: (data: { current_password: string; new_password: string }) =>
    apiRequest('/auth/change-password', 'POST', data),
  requestPasswordReset: (data: { username?: string; email?: string; identifier?: string; phone_number?: string }) =>
    apiRequest<{
      message: string;
      delivery_method: 'EMAIL' | 'SMS';
      destination: string;
      identifier: string;
      username?: string;
      email?: string;
      expires_in_minutes: number;
      dev_code?: string;
      reset_token?: string;
    }>('/auth/forgot-password', 'POST', data),
  verifyResetCode: (data: { code?: string; token?: string; identifier?: string; username?: string; email?: string }) =>
    apiRequest<{ message: string }>('/auth/verify-reset-code', 'POST', data),
  resetPassword: (data: { token?: string; code?: string; identifier?: string; username?: string; email?: string; new_password: string }) =>
    apiRequest<{ message: string }>('/auth/reset-password', 'POST', data),
  getDashboardSummary: () => apiRequest('/dashboard/summary'),
  getCurrentBusinessDay: () => apiRequest('/business-days/current'),
  getBusinessDays: () => apiRequest('/business-days'),
  openBusinessDay: (data: { business_date: string; opening_cash?: number; opening_bank?: number; reason?: string }) =>
    apiRequest('/business-days/open', 'POST', data),
  recordIncome: (data: { business_day_id: number; cash_income: number; bank_income: number; description?: string; reference_number?: string }) =>
    apiRequest('/incomes', 'POST', data),
  getIncomes: (business_day_id: number) =>
    apiRequest(`/incomes?business_day_id=${business_day_id}`),
  updateIncome: (id: number, data: { cash_income: number; bank_income: number; description: string; reference_number?: string; reason: string }) =>
    apiRequest(`/incomes/${id}`, 'PUT', data),
  recordExpense: (data: { business_day_id: number; description: string; amount: number; payment_source: 'CASH' | 'BANK'; reference_number?: string; expense_category?: string }) =>
    apiRequest('/expenses', 'POST', data),
  getExpenses: (business_day_id: number) =>
    apiRequest(`/expenses?business_day_id=${business_day_id}`),
  updateExpense: (id: number, data: { description: string; amount: number; payment_source: 'CASH' | 'BANK'; reference_number?: string; expense_category?: string; reason: string }) =>
    apiRequest(`/expenses/${id}`, 'PUT', data),
  getClosingPreview: (business_day_id: number) =>
    apiRequest(`/closings/preview/${business_day_id}`),
  performClosing: (business_day_id: number, data: { actual_cash: number; actual_bank: number; notes?: string }) =>
    apiRequest(`/closings/close/${business_day_id}`, 'POST', data),
  getEligibleAuditDays: () => apiRequest('/audits/eligible-days'),
  previewThreeDayAudit: (data: { day_ids: number[]; additional_cash_income?: number }) =>
    apiRequest('/audits/preview', 'POST', data),
  submitThreeDayAudit: (data: { day_ids: number[]; actual_cash: number; actual_bank: number; additional_cash_income?: number; remarks?: string }) =>
    apiRequest('/audits/submit', 'POST', data),
  getAudits: () => apiRequest('/audits'),
  signOffAudit: (id: number, data: { remarks?: string }) =>
    apiRequest(`/audits/${id}/sign-off`, 'POST', data),
  getDiscrepancies: (params?: { status?: string; account_type?: string }) => {
    let q = '';
    if (params?.status) q += `status=${params.status}&`;
    if (params?.account_type) q += `account_type=${params.account_type}&`;
    return apiRequest(`/discrepancies?${q}`);
  },
  submitDiscrepancyExplanation: (id: number, data: { explanation: string; evidence_ref?: string }) =>
    apiRequest(`/discrepancies/${id}/explain`, 'POST', data),
  createAdjustment: (data: any) => apiRequest('/adjustments', 'POST', data),
  getDailyIncomeReport: (start_date?: string, end_date?: string) =>
    apiRequest(`/reports/incomes?start_date=${start_date || ''}&end_date=${end_date || ''}`),
  getDailyExpenseReport: (start_date?: string, end_date?: string) =>
    apiRequest(`/reports/expenses?start_date=${start_date || ''}&end_date=${end_date || ''}`),
  getDailyClosingReport: (start_date?: string, end_date?: string) =>
    apiRequest(`/reports/closings?start_date=${start_date || ''}&end_date=${end_date || ''}`),
  getAuditTrailLogs: (limit = 100) =>
    apiRequest(`/reports/audit-trail?limit=${limit}`),
  getFinancialTrends: (timeframe: 'daily' | '3day' | 'weekly' | 'monthly' = 'daily') =>
    apiRequest(`/analytics/trends?timeframe=${timeframe}`),
  getDiscrepancyMetrics: () =>
    apiRequest('/analytics/discrepancies'),
};
