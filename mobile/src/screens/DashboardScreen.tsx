import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { DashboardMetrics, FinancialTrendPoint, TimeframeType } from '../types';
import { formatETB, formatDate } from '../utils/currency';
import { FinancialCard } from '../components/FinancialCard';
import { StatusBadge } from '../components/StatusBadge';
import { AppTopHeader } from '../components/AppTopHeader';
import { InteractiveTrendChart } from '../components/InteractiveTrendChart';
import { AppIcon } from '../components/AppIcon';
import { useTheme } from '../context/ThemeContext';

function getAddisDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export const DashboardScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trendData, setTrendData] = useState<FinancialTrendPoint[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>('daily');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedule, setSchedule] = useState<{ timeZone: string; openTime?: string; closeTime?: string; opensAt?: string; closesAt?: string; remainingMinutes: number; overrideAction?: 'OPEN' | 'CLOSED' | null } | null>(null);
  const [currentBusinessDay, setCurrentBusinessDay] = useState<any>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [trendError, setTrendError] = useState('');

  const role = user?.role || 'recorder';

  const fetchDashboardData = useCallback(async () => {
    try {
      const dashRes = await api.getDashboardSummary();
      const dayRes = await api.getCurrentBusinessDay();
      setSchedule(dayRes?.schedule || dashRes?.metrics?.schedule || null);
      setCurrentBusinessDay(dayRes?.currentDay || null);

      if (dashRes?.metrics) {
        setMetrics(dashRes.metrics);
      }
      if (role === 'manager' || role === 'auditor') {
        try {
          const trendRes = await api.getFinancialTrends(selectedTimeframe);
          setTrendData(trendRes?.data || []);
          setTrendError('');
        } catch (err: any) {
          setTrendData([]);
          setTrendError(err.message || 'Unable to load financial trends.');
        }
      } else {
        setTrendData([]);
      }
    } catch (err: any) {
      console.log('Error loading dashboard:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, selectedTimeframe]);

  useEffect(() => {
    fetchDashboardData();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDashboardData();
    });
    return unsubscribe;
  }, [navigation, fetchDashboardData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSchedule((current) => {
        if (!current || current.remainingMinutes <= 0) return current;
        return { ...current, remainingMinutes: current.remainingMinutes - 1 };
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };
  const currentDateKey = String(currentBusinessDay?.business_date_key || currentBusinessDay?.business_date || '').slice(0, 10);

  const handleOpenDay = async () => {
    const todayStr = getAddisDateKey();
    const reopeningToday = metrics?.status === 'CLOSED'
      && currentDateKey === todayStr;
    const keepingOpen = metrics?.status === 'OPEN';

    const executeOpen = async () => {
      try {
        await api.openBusinessDay({
          business_date: todayStr,
          ...(reopeningToday ? { reason: reopenReason.trim() } : {}),
        });
        setReopenReason('');
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined' && window.alert) {
            window.alert(keepingOpen
              ? 'Automatic closing is overridden for today. / የዛሬ ራስ-ሰር መዝጊያ ተሰርዟል።'
              : 'Business day opened successfully / የቀኑ ሂሳብ መዝገብ ተከፍቷል!');
          }
        } else {
          Alert.alert(
            'Success',
            keepingOpen ? 'Automatic closing is overridden for today.' : 'Business day opened successfully.'
          );
        }
        fetchDashboardData();
      } catch (err: any) {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined' && window.alert) {
            window.alert('Error: ' + err.message);
          }
        } else {
          Alert.alert('Error', err.message);
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmOpen = typeof window !== 'undefined' && window.confirm
        ? window.confirm(keepingOpen
          ? 'Keep today’s business day open beyond the scheduled 22:00 closing time? This action will be recorded.'
          : `Open financial controls for ${todayStr}? Opening balances will auto-carry forward from the last closed day.`)
        : true;
      if (confirmOpen) {
        executeOpen();
      }
    } else {
      Alert.alert(
        keepingOpen ? 'Override Automatic Closing' : 'Open Business Day',
        keepingOpen
          ? 'Keep today’s business day open beyond the scheduled 22:00 closing time? This action will be recorded.'
          : `Open financial controls for ${todayStr}? Opening balances will auto-carry forward from the last closed day.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Day', onPress: executeOpen },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Loading Financial Control Ledger...</Text>
      </View>
    );
  }

  const timeframeLabels: Record<TimeframeType, string> = {
    daily: 'Daily Operational Trajectory (የእለት አዝማሚያ)',
    '3day': 'Three-Day Audit Cycles (የሦስት ቀን ኦዲት ዑደት)',
    weekly: 'Weekly Aggregated Flow (የሳምንት ድምር)',
    monthly: 'Monthly Performance (የወር ማጠቃለያ)',
  };

  return (
    <View style={[styles.screenWrapper, { backgroundColor: theme.bg }]}>
      {/* Interactive Top Navigation Bar (Home, Analysis, Audit, Alerts, Logout) */}
      <AppTopHeader
        title="Hamer Shop Financial Control (የሐመር ሱቅ)"
        navigation={navigation}
        showBack={false}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: theme.bg }]}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Business Day Status Banner */}
        <View style={[styles.dayStatusCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.dayStatusRow}>
            <View>
              <Text style={[styles.dateLabel, { color: theme.textSub }]}>Active Financial Business Date:</Text>
              <Text style={[styles.dateValue, { color: theme.text }]}>
                {metrics?.business_date ? formatDate(metrics.business_date) : 'No Open Day'}
              </Text>
            </View>
            <StatusBadge status={metrics?.status || 'NO_DAY_OPENED'} />
          </View>

            <View style={styles.scheduleRow}>
              <AppIcon name="calendar" size={16} color="#475569" />
              <Text style={styles.scheduleText}>
                {schedule
                  ? `${schedule.openTime || schedule.opensAt}–${schedule.closeTime || schedule.closesAt} · ${schedule.timeZone}`
                  : 'Daily schedule: 00:00–22:00 · Africa/Addis_Ababa'}
              </Text>
            </View>
            {currentBusinessDay && (
              <Text style={styles.remainingText}>
                Opened {currentBusinessDay.opened_time_local || '—'} ·
                {currentBusinessDay.closed_time_local ? ` Closed ${currentBusinessDay.closed_time_local}` : ' Not closed'}
                {currentBusinessDay.automatically_closed ? ' · Automatically closed; Manager verification required' : ''}
              </Text>
            )}
            {metrics?.status === 'OPEN' && (
              <Text style={styles.remainingText}>
                {schedule?.remainingMinutes ?? 0} minutes until scheduled close
              </Text>
            )}
            {metrics?.status === 'OPEN' && role === 'manager' && schedule?.overrideAction === 'OPEN' && (
              <Text style={styles.reopenHint}>Automatic closing is overridden for today.</Text>
            )}
            {metrics?.status === 'OPEN' && role === 'manager' && schedule?.overrideAction !== 'OPEN' && (
              <TouchableOpacity style={styles.openDayBtn} onPress={handleOpenDay}>
                <Text style={styles.openDayBtnText}>Keep Open Beyond 22:00</Text>
              </TouchableOpacity>
            )}
            {metrics?.status === 'NO_DAY_OPENED' && role === 'manager' && (
              <TouchableOpacity style={styles.openDayBtn} onPress={handleOpenDay}>
                <Text style={styles.openDayBtnText}>Open Today's Financial Register</Text>
              </TouchableOpacity>
            )}
            {metrics?.status === 'CLOSED' && role === 'manager'
              && currentDateKey === getAddisDateKey() && (
              <View>
                <Text style={styles.reopenHint}>Manager override: reopening is logged and requires a reason.</Text>
                <TextInput
                  style={styles.reopenInput}
                  value={reopenReason}
                  onChangeText={setReopenReason}
                  placeholder="Reason for reopening (at least 10 characters)"
                  multiline
                />
                <TouchableOpacity
                  style={[styles.openDayBtn, reopenReason.trim().length < 10 && styles.openDayDisabled]}
                  onPress={handleOpenDay}
                  disabled={reopenReason.trim().length < 10}
                >
                  <Text style={styles.openDayBtnText}>Reopen Today's Closed Business Day</Text>
                </TouchableOpacity>
              </View>
            )}
            {metrics?.status === 'CLOSED' && role === 'manager'
              && currentDateKey !== getAddisDateKey() && (
                <TouchableOpacity style={styles.openDayBtn} onPress={handleOpenDay}>
                  <Text style={styles.openDayBtnText}>Open Today's Business Day</Text>
                </TouchableOpacity>
              )}
        </View>

        {/* Alerts Box */}
        {metrics?.alerts && metrics.alerts.length > 0 && (
          <View style={styles.alertsContainer}>
            {metrics.alerts.map((alert, idx) => (
              <View
                key={idx}
                style={[
                  styles.alertItem,
                  alert.type === 'danger'
                    ? styles.alertDanger
                    : alert.type === 'warning'
                    ? styles.alertWarning
                    : styles.alertInfo,
                ]}
              >
                <Text
                  style={[
                    styles.alertText,
                    alert.type === 'danger'
                      ? styles.textDanger
                      : alert.type === 'warning'
                      ? styles.textWarning
                      : styles.textInfo,
                  ]}
                >
                  {alert.message}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ======================================================== */}
        {/* HOMEPAGE ANALYSIS & TRENDS SECTION (DIRECTLY DISPLAYED) */}
        {/* ======================================================== */}
        {(role === 'manager' || role === 'auditor') && (
          <View style={styles.analysisSection}>
            <View style={styles.sectionTitleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppIcon name="trend" size={17} color="#1E3A8A" />
                <Text style={styles.sectionTitle}>Live Financial Analytics & Trends</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Analytics')}>
                <Text style={styles.seeAllText}>Detailed View ➔</Text>
              </TouchableOpacity>
            </View>

          {/* Timeframe Selector directly on Homepage */}
          <View style={styles.timeframeSelector}>
            {(['daily', '3day', 'weekly', 'monthly'] as TimeframeType[]).map((tf) => (
              <TouchableOpacity
                key={tf}
                style={[
                  styles.timeframeBtn,
                  selectedTimeframe === tf && styles.timeframeBtnActive,
                ]}
                onPress={() => setSelectedTimeframe(tf)}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    selectedTimeframe === tf && styles.timeframeTextActive,
                  ]}
                >
                  {tf === 'daily'
                    ? 'Daily'
                    : tf === '3day'
                    ? '3-Day'
                    : tf === 'weekly'
                    ? 'Weekly'
                    : 'Monthly'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Interactive Chart 1: Income vs Expense */}
          {trendError ? <Text style={styles.trendError}>{trendError}</Text> : null}
          <InteractiveTrendChart
            data={trendData}
            chartType="INCOME_EXPENSE"
            timeframeLabel={timeframeLabels[selectedTimeframe]}
            emptyMessage={selectedTimeframe === '3day'
              ? 'No three-day audits have been submitted yet. Daily income and expense totals remain available in Daily, Weekly, and Monthly views.'
              : 'No business-day records are available for this timeframe.'}
          />

          {/* Interactive Chart 2: Cash Safe vs Bank Liquidity */}
          <InteractiveTrendChart
            data={trendData}
            chartType="LIQUIDITY_TREND"
            timeframeLabel={timeframeLabels[selectedTimeframe]}
            emptyMessage={selectedTimeframe === '3day'
              ? 'No three-day audits have been submitted yet.'
              : 'No business-day records are available for this timeframe.'}
          />
          </View>
        )}

        {/* Daily Income & Expenses Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryBox, { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
            <Text style={styles.summaryBoxLabel}>Today's Income</Text>
            <Text style={[styles.summaryBoxValue, { color: '#065F46' }]}>
              {formatETB(metrics?.today_income)}
            </Text>
          </View>

          <View style={[styles.summaryBox, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
            <Text style={styles.summaryBoxLabel}>Today's Expenses</Text>
            <Text style={[styles.summaryBoxValue, { color: '#991B1B' }]}>
              {formatETB(metrics?.today_expenses)}
            </Text>
          </View>
        </View>

        {/* Controlled Account 1: Physical Cash in Safe (ካዝና) */}
        <FinancialCard
          title="Physical Cash in Safe (ካዝና)"
          accountType="CASH"
          openingBalance={metrics?.opening_cash || 0}
          expectedBalance={metrics?.expected_cash || 0}
          actualBalance={metrics?.status === 'CLOSED' ? metrics?.actual_cash : undefined}
          difference={metrics?.status === 'CLOSED' ? metrics?.cash_difference : undefined}
          status={metrics?.cash_status || 'BALANCED'}
        />

        {/* Controlled Account 2: Bank Balance (ባንክ) */}
        <FinancialCard
          title="Bank Account Balance (ባንክ)"
          accountType="BANK"
          openingBalance={metrics?.opening_bank || 0}
          expectedBalance={metrics?.expected_bank || 0}
          actualBalance={metrics?.status === 'CLOSED' ? metrics?.actual_bank : undefined}
          difference={metrics?.status === 'CLOSED' ? metrics?.bank_difference : undefined}
          status={metrics?.bank_status || 'BALANCED'}
        />

        {/* ROLE-SPECIFIC WORKFLOW ACTIONS */}
        <Text style={styles.sectionHeader}>
          {role === 'recorder'
            ? 'Recorder Shift Workflows'
            : role === 'auditor'
            ? 'Auditor Periodic Controls'
            : role === 'manager'
            ? 'Managerial Shift Operations'
            : 'Financial Controls'}
        </Text>

        <View style={styles.actionsGrid}>
          {/* CASHIER */}
          {role === 'recorder' && (
            <>
              {metrics?.status === 'OPEN' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#0284C7' }]}
                    onPress={() => navigation.navigate('DailyIncome', { businessDayId: metrics?.business_day_id })}
                  >
                    <AppIcon name="income" size={20} color="#FFFFFF" />
                    <Text style={styles.actionTitle}>Record Income</Text>
                    <Text style={styles.actionDesc}>የእለት ገቢ አስገባ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#DC2626' }]}
                    onPress={() => navigation.navigate('DailyExpense', { businessDayId: metrics?.business_day_id })}
                  >
                    <AppIcon name="expense" size={20} color="#FFFFFF" />
                    <Text style={styles.actionTitle}>Record Expense</Text>
                    <Text style={styles.actionDesc}>የእለት ወጪ አስገባ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#4F46E5', width: '100%' }]}
                    onPress={() => navigation.navigate('DailyClosing', { businessDayId: metrics?.business_day_id })}
                  >
                    <AppIcon name="lock" size={20} color="#FFFFFF" />
                    <Text style={styles.actionTitle}>Daily Reconciliation & Closing</Text>
                    <Text style={styles.actionDesc}>የእለት ቆጠራ አስረክብ</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#475569', width: '100%' }]}
                onPress={() => navigation.navigate('Discrepancies')}
              >
                <AppIcon name="alert" size={20} color="#FFFFFF" />
                <Text style={styles.actionTitle}>My Discrepancy Explanations</Text>
                <Text style={styles.actionDesc}>የጉድለት/የትርፍ ማብራሪያ ስጥ ({metrics?.openDiscrepancies || 0} Open)</Text>
              </TouchableOpacity>
            </>
          )}

          {/* MANAGER */}
          {role === 'manager' && (
            <>
              {metrics?.status === 'OPEN' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#0284C7' }]}
                    onPress={() => navigation.navigate('DailyIncome', { businessDayId: metrics?.business_day_id })}
                  >
                    <AppIcon name="income" size={20} color="#FFFFFF" />
                    <Text style={styles.actionTitle}>Record Income</Text>
                    <Text style={styles.actionDesc}>ገቢ መዝግብ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#DC2626' }]}
                    onPress={() => navigation.navigate('DailyExpense', { businessDayId: metrics?.business_day_id })}
                  >
                    <AppIcon name="expense" size={20} color="#FFFFFF" />
                    <Text style={styles.actionTitle}>Record Expense</Text>
                    <Text style={styles.actionDesc}>ወጪ መዝግብ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#4F46E5' }]}
                    onPress={() => navigation.navigate('DailyClosing', { businessDayId: metrics?.business_day_id })}
                  >
                    <AppIcon name="lock" size={20} color="#FFFFFF" />
                    <Text style={styles.actionTitle}>Daily Closing Review</Text>
                    <Text style={styles.actionDesc}>ቆጠራ አረጋግጥ</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#475569' }]}
                onPress={() => navigation.navigate('Discrepancies')}
              >
                <AppIcon name="alert" size={20} color="#FFFFFF" />
                <Text style={styles.actionTitle}>Discrepancies</Text>
                <Text style={styles.actionDesc}>({metrics?.openDiscrepancies || 0} cases)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#059669', width: '100%' }]}
                onPress={() => navigation.navigate('Reports')}
              >
                <AppIcon name="activity" size={20} color="#FFFFFF" />
                <Text style={styles.actionTitle}>Financial Reports</Text>
                <Text style={styles.actionDesc}>የሱቅ ሪፖርቶች</Text>
              </TouchableOpacity>
            </>
          )}

          {/* AUDITOR */}
          {role === 'auditor' && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#D97706', width: '100%' }]}
                onPress={() => navigation.navigate('ThreeDayAudit')}
              >
                <AppIcon name="clipboard" size={20} color="#FFFFFF" />
                <Text style={styles.actionTitle}>Three-Day Audit (የሦስት ቀን ኦዲት)</Text>
                <Text style={styles.actionDesc}>
                  Target formula: Audit Value = 0 ETB
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#475569' }]}
                onPress={() => navigation.navigate('Discrepancies')}
              >
                <AppIcon name="alert" size={20} color="#FFFFFF" />
                <Text style={styles.actionTitle}>Discrepancy Cases</Text>
                <Text style={styles.actionDesc}>Authorize ADJ-XXX vouchers</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#059669' }]}
                onPress={() => navigation.navigate('Reports')}
              >
                <AppIcon name="activity" size={20} color="#FFFFFF" />
                <Text style={styles.actionTitle}>Audit Reports</Text>
                <Text style={styles.actionDesc}>Multi-period statements</Text>
              </TouchableOpacity>

            </>
          )}

          {/* ADMIN */}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 14,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  dayStatusCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  openDayBtn: {
    marginTop: 10,
    backgroundColor: '#1E3A8A',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  openDayBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  scheduleText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  remainingText: { fontSize: 12, color: '#1E3A8A', marginTop: 5, fontWeight: '600' },
  reopenHint: { marginTop: 10, color: '#9A3412', fontSize: 12 },
  reopenInput: { marginTop: 8, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 7, padding: 9, minHeight: 44 },
  openDayDisabled: { opacity: 0.5 },
  trendError: { color: '#991B1B', backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginBottom: 10 },
  alertsContainer: {
    marginBottom: 10,
  },
  alertItem: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 4,
  },
  alertDanger: {
    backgroundColor: '#FEE2E2',
    borderLeftColor: '#DC2626',
  },
  alertWarning: {
    backgroundColor: '#FEF3C7',
    borderLeftColor: '#D97706',
  },
  alertInfo: {
    backgroundColor: '#E0F2FE',
    borderLeftColor: '#0284C7',
  },
  alertText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textDanger: { color: '#991B1B' },
  textWarning: { color: '#92400E' },
  textInfo: { color: '#0369A1' },
  analysisSection: {
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  timeframeSelector: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  timeframeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  timeframeBtnActive: {
    backgroundColor: '#1E3A8A',
  },
  timeframeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  timeframeTextActive: {
    color: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryBox: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 3,
    borderWidth: 1,
  },
  summaryBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  summaryBoxValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 3,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
    marginBottom: 10,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionDesc: {
    fontSize: 11,
    color: '#E2E8F0',
    marginTop: 2,
  },
});
