import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { api } from '../api/client';
import { DayReconciliationPreview } from '../types';
import { formatETB } from '../utils/currency';
import { AppTopHeader } from '../components/AppTopHeader';
import { AppIcon } from '../components/AppIcon';

export const DailyClosingScreen = ({ route, navigation }: any) => {
  const { businessDayId } = route.params || {};
  const [activeDayId, setActiveDayId] = useState<number | null>(businessDayId || null);
  const [preview, setPreview] = useState<DayReconciliationPreview | null>(null);
  const [actualCash, setActualCash] = useState('');
  const [actualBank, setActualBank] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      let dayId = businessDayId;
      try {
        setLoading(true);
        if (!dayId) {
          const curRes = await api.getCurrentBusinessDay();
          if (curRes?.currentDay?.id) {
            dayId = curRes.currentDay.id;
            setActiveDayId(dayId);
          }
        }
        if (dayId) {
          const res = await api.getClosingPreview(dayId);
          if (res?.reconciliationPreview) {
            setPreview(res.reconciliationPreview);
          }
        }
      } catch (err: any) {
        console.log('Error loading closing preview:', err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [businessDayId]);

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(`${title}\n${message}`);
      }
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
    }
  };

  // Section 1: Daily Activity calculations (excludes opening balances)
  const totalCashIncome = preview?.totalCashIncome || 0;
  const totalCashExpenses = preview?.totalCashExpenses || 0;
  const netDailyCashActivity = preview?.netDailyCashActivity !== undefined
    ? preview.netDailyCashActivity
    : Math.round((totalCashIncome - totalCashExpenses) * 100) / 100;

  const totalBankIncome = preview?.totalBankIncome || 0;
  const totalBankExpenses = preview?.totalBankExpenses || 0;
  const netDailyBankActivity = preview?.netDailyBankActivity !== undefined
    ? preview.netDailyBankActivity
    : Math.round((totalBankIncome - totalBankExpenses) * 100) / 100;

  // Section 2: Closing balance components (carries forward previous closing)
  const openingCash = preview?.openingCash || 0;
  const openingBank = preview?.openingBank || 0;
  const cashAdjustments = preview?.cashAdjustments || 0;
  const bankAdjustments = preview?.bankAdjustments || 0;

  const expCash = preview?.expectedCash || 0;
  const expBank = preview?.expectedBank || 0;

  // Section 4: Live client-side actual verification differences
  const actCashNum = parseFloat(actualCash);
  const actBankNum = parseFloat(actualBank);

  const cashDiff = !isNaN(actCashNum) ? Math.round((actCashNum - expCash) * 100) / 100 : null;
  const bankDiff = !isNaN(actBankNum) ? Math.round((actBankNum - expBank) * 100) / 100 : null;

  const executeClosing = async (targetId: number) => {
    try {
      setSubmitting(true);
      const res = await api.performClosing(targetId, {
        actual_cash: actCashNum,
        actual_bank: actBankNum,
        notes: closingNotes,
      });

      const cashStatus = (res.closing?.reconciliation?.cashDifference || 0) === 0
        ? 'BALANCED'
        : (res.closing?.reconciliation?.cashDifference || 0) < 0 ? 'SHORTAGE' : 'SURPLUS';

      const bankStatus = (res.closing?.reconciliation?.bankDifference || 0) === 0
        ? 'BALANCED'
        : (res.closing?.reconciliation?.bankDifference || 0) < 0 ? 'SHORTAGE' : 'SURPLUS';

      const successMsg =
        `Status: ${res.closing?.reconciliation?.dailyStatus || 'CLOSED'}\n` +
        `Cash: ${cashStatus} (${formatETB(res.closing?.reconciliation?.cashDifference || 0)})\n` +
        `Bank: ${bankStatus} (${formatETB(res.closing?.reconciliation?.bankDifference || 0)})`;

      showAlert(
        'Day Closed Successfully / የቀኑ ሂሳብ ተዘግቷል!',
        successMsg,
        () => navigation.navigate('Dashboard')
      );
    } catch (err: any) {
      showAlert('Closing Failed / ዝጋታ አልተሳካም', err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePerformClosing = async () => {
    const targetId = activeDayId || businessDayId;
    if (!targetId) {
      showAlert(
        'No Active Day / ክፍት ቀን የለም',
        'No active business day is currently opened. Please open today\'s register on the Dashboard first.'
      );
      return;
    }

    if (isNaN(actCashNum) || isNaN(actBankNum)) {
      showAlert(
        'Required Fields / መረጃ ይጎድላል',
        'Please enter both the actual physical cash count in safe and the verified bank balance.'
      );
      return;
    }

    const confirmMsg =
      'Are you sure you want to finalize and lock this business day?\n\n' +
      'All transactions will be sealed permanently, and closing balances will carry forward to the next business day.';

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm ? window.confirm(confirmMsg) : true;
      if (confirmed) {
        executeClosing(targetId);
      }
    } else {
      Alert.alert(
        'Confirm Daily Closing / ዝጋታ አረጋግጥ',
        confirmMsg,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Lock & Close Day',
            style: 'destructive',
            onPress: () => executeClosing(targetId),
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Calculating Daily Balances & Activity...</Text>
      </View>
    );
  }

  if (!preview && !activeDayId) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <AppTopHeader
          title="Daily Closing & Reconciliation"
          showBack={true}
          navigation={navigation}
        />
        <View style={[styles.center, { padding: 24 }]}>
          <AppIcon name="alert" size={36} color="#D97706" />
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 8 }}>
            No Open Business Day
          </Text>
          <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 20 }}>
            There is no active business day currently opened for closing. Please open today's register first.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#1E3A8A', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}
            onPress={() => navigation.navigate('Dashboard')}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Go to Dashboard / ወደ መነሻ ሂድ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const businessDate = preview?.businessDay?.business_date
    ? String(preview.businessDay.business_date).split('T')[0]
    : 'Today';

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <AppTopHeader
        title="Daily Closing & Reconciliation (የዕለት ሂሳብ ዝጋ)"
        showBack={true}
        navigation={navigation}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <AppIcon name="lock" size={20} color="#1E3A8A" />
            <Text style={styles.title}>Daily Closing & Financial Reconciliation</Text>
          </View>
          <Text style={styles.amharicSubtitle}>
            የዕለት ሂሳብ ማጠቃለያ፣ ስሌትና ትክክለኛ ማረጋገጫ — {businessDate}
          </Text>
        </View>

        {/* ── CARD 1: SECTION 1 – DAILY FINANCIAL ACTIVITY ─────────── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <AppIcon name="trend" size={17} color="#1E3A8A" />
            <Text style={styles.cardTitle}>1. Daily Financial Activity (የዕለቱ የገንዘብ እንቅስቃሴ)</Text>
          </View>
          <Text style={styles.helpText}>
            Measures pure financial activity generated during this business day. Opening balances are carried-forward positions and are strictly excluded from daily activity.
          </Text>

          {/* Cash Activity */}
          <Text style={styles.subSectionHeader}>💵 CASH ACTIVITY (የካዝና እንቅስቃሴ)</Text>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  Total Daily Cash Income (የዕለቱ የካዝና ገቢ):</Text>
            <Text style={[styles.calcValue, { color: '#059669' }]}>
              +{formatETB(totalCashIncome)}
            </Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  Total Daily Cash Expenses (የዕለቱ የካዝና ወጪ):</Text>
            <Text style={[styles.calcValue, { color: '#DC2626' }]}>
              −{formatETB(totalCashExpenses)}
            </Text>
          </View>
          <View style={[styles.calcRow, styles.activityHighlightRow]}>
            <Text style={styles.activityHighlightLabel}>
              Net Daily Cash Activity (የዕለቱ የተጣራ ካዝና እንቅስቃሴ):
            </Text>
            <Text
              style={[
                styles.activityHighlightValue,
                { color: netDailyCashActivity >= 0 ? '#059669' : '#DC2626' },
              ]}
            >
              {netDailyCashActivity >= 0 ? '+' : ''}{formatETB(netDailyCashActivity)}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Bank Activity */}
          <Text style={styles.subSectionHeader}>🏦 BANK ACTIVITY (የባንክ እንቅስቃሴ)</Text>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  Total Daily Bank Income (የዕለቱ የባንክ ገቢ):</Text>
            <Text style={[styles.calcValue, { color: '#059669' }]}>
              +{formatETB(totalBankIncome)}
            </Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  Total Daily Bank Expenses (የዕለቱ የባንክ ወጪ):</Text>
            <Text style={[styles.calcValue, { color: '#DC2626' }]}>
              −{formatETB(totalBankExpenses)}
            </Text>
          </View>
          <View style={[styles.calcRow, styles.activityHighlightRow]}>
            <Text style={styles.activityHighlightLabel}>
              Net Daily Bank Activity (የዕለቱ የተጣራ ባንክ እንቅስቃሴ):
            </Text>
            <Text
              style={[
                styles.activityHighlightValue,
                { color: netDailyBankActivity >= 0 ? '#059669' : '#DC2626' },
              ]}
            >
              {netDailyBankActivity >= 0 ? '+' : ''}{formatETB(netDailyBankActivity)}
            </Text>
          </View>
        </View>

        {/* ── CARD 2: SECTION 2 – DAILY CLOSING BALANCE CALCULATION ─── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <AppIcon name="clipboard" size={17} color="#1E3A8A" />
            <Text style={styles.cardTitle}>2. Daily Closing Balance Calculation (ዕለታዊ የዝጋታ ሒሳብ)</Text>
          </View>
          <Text style={styles.helpText}>
            Formula: Previous Closing + Daily Income − Daily Expenses ± Approved Adjustments.{'\n'}
            Each account's previous closing balance becomes its next opening balance.
          </Text>

          {/* Cash Account Closing */}
          <Text style={styles.subSectionHeader}>💵 CASH ACCOUNT (ካዝና)</Text>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  Previous Closing Cash (የቀዳሚ ቀን ካዝና ዝጋታ):</Text>
            <Text style={styles.calcValue}>{formatETB(openingCash)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  + Total Daily Cash Income (የዕለቱ ካዝና ገቢ):</Text>
            <Text style={[styles.calcValue, { color: '#059669' }]}>
              +{formatETB(totalCashIncome)}
            </Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  − Total Daily Cash Expenses (የዕለቱ ካዝና ወጪ):</Text>
            <Text style={[styles.calcValue, { color: '#DC2626' }]}>
              −{formatETB(totalCashExpenses)}
            </Text>
          </View>
          {cashAdjustments !== 0 && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>  ± Approved Cash Adjustments (ማስተካከያ):</Text>
              <Text style={[styles.calcValue, { color: cashAdjustments >= 0 ? '#059669' : '#DC2626' }]}>
                {cashAdjustments >= 0 ? '+' : ''}{formatETB(cashAdjustments)}
              </Text>
            </View>
          )}
          <View style={[styles.calcRow, styles.totalHighlightRow]}>
            <Text style={styles.totalHighlightLabel}>
              = Calculated Closing Cash Balance (የተሰላ የካዝና ዝጋታ):
            </Text>
            <Text style={styles.totalHighlightValue}>{formatETB(expCash)}</Text>
          </View>

          <View style={styles.divider} />

          {/* Bank Account Closing */}
          <Text style={styles.subSectionHeader}>🏦 BANK ACCOUNT (ባንክ)</Text>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  Previous Closing Bank (የቀዳሚ ቀን ባንክ ዝጋታ):</Text>
            <Text style={styles.calcValue}>{formatETB(openingBank)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  + Total Daily Bank Income (የዕለቱ ባንክ ገቢ):</Text>
            <Text style={[styles.calcValue, { color: '#059669' }]}>
              +{formatETB(totalBankIncome)}
            </Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  − Total Daily Bank Expenses (የዕለቱ ባንክ ወጪ):</Text>
            <Text style={[styles.calcValue, { color: '#DC2626' }]}>
              −{formatETB(totalBankExpenses)}
            </Text>
          </View>
          {bankAdjustments !== 0 && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>  ± Approved Bank Adjustments (ማስተካከያ):</Text>
              <Text style={[styles.calcValue, { color: bankAdjustments >= 0 ? '#059669' : '#DC2626' }]}>
                {bankAdjustments >= 0 ? '+' : ''}{formatETB(bankAdjustments)}
              </Text>
            </View>
          )}
          <View style={[styles.calcRow, styles.totalHighlightRow]}>
            <Text style={styles.totalHighlightLabel}>
              = Calculated Closing Bank Balance (የተሰላ የባንክ ዝጋታ):
            </Text>
            <Text style={styles.totalHighlightValue}>{formatETB(expBank)}</Text>
          </View>
        </View>

        {/* ── CARD 3: SECTION 4 – ACTUAL VERIFICATION ──────────────── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <AppIcon name="shield" size={17} color="#1E3A8A" />
            <Text style={styles.cardTitle}>3. Actual Verification (ትክክለኛ ቆጠራ ማረጋገጫ)</Text>
          </View>
          <Text style={styles.helpText}>
            Audit Difference = Actual Verified − Calculated Closing Balance{'\n'}
            (0 = Balanced / ትክክል | &lt; 0 = Shortage / አጥረ | &gt; 0 = Surplus / ተርፏል)
          </Text>

          <View style={styles.ruleNotice}>
            <AppIcon name="shield" size={14} color="#1E3A8A" />
            <Text style={styles.ruleNoticeText}>
              Cash and Bank accounts are evaluated independently. Never automatically offset a cash shortage against a bank surplus.
            </Text>
          </View>

          {/* Actual Cash Input */}
          <Text style={styles.inputLabel}>
            Actual Physical Cash in Safe (ካዝና ውስጥ የተገኘ ጥሬ ገንዘብ) *
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Enter physical cash count (e.g. 10000)"
            value={actualCash}
            onChangeText={setActualCash}
          />

          {cashDiff !== null && (
            <View style={styles.diffBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.diffLabel}>Cash Audit Difference (የካዝና ልዩነት):</Text>
                <Text style={styles.diffFormula}>
                  Actual ({formatETB(actCashNum)}) − Calculated ({formatETB(expCash)})
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <AppIcon
                  name={cashDiff === 0 ? 'check' : 'alert'}
                  size={15}
                  color={cashDiff === 0 ? '#059669' : cashDiff < 0 ? '#DC2626' : '#D97706'}
                />
                <Text
                  style={[
                    styles.diffValue,
                    cashDiff === 0
                      ? { color: '#059669' }
                      : cashDiff < 0
                      ? { color: '#DC2626' }
                      : { color: '#D97706' },
                  ]}
                >
                  {cashDiff === 0
                    ? 'BALANCED (0.00 ETB)'
                    : cashDiff < 0
                    ? `SHORTAGE (${formatETB(Math.abs(cashDiff))})`
                    : `SURPLUS (+${formatETB(cashDiff)})`}
                </Text>
              </View>
            </View>
          )}

          {/* Actual Bank Input */}
          <Text style={styles.inputLabel}>
            Actual Verified Bank Balance (ባንክ ላይ ያለ የተረጋገጠ ሒሳብ) *
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Enter verified bank balance (e.g. 25000)"
            value={actualBank}
            onChangeText={setActualBank}
          />

          {bankDiff !== null && (
            <View style={styles.diffBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.diffLabel}>Bank Audit Difference (የባንክ ልዩነት):</Text>
                <Text style={styles.diffFormula}>
                  Actual ({formatETB(actBankNum)}) − Calculated ({formatETB(expBank)})
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <AppIcon
                  name={bankDiff === 0 ? 'check' : 'alert'}
                  size={15}
                  color={bankDiff === 0 ? '#059669' : bankDiff < 0 ? '#DC2626' : '#D97706'}
                />
                <Text
                  style={[
                    styles.diffValue,
                    bankDiff === 0
                      ? { color: '#059669' }
                      : bankDiff < 0
                      ? { color: '#DC2626' }
                      : { color: '#D97706' },
                  ]}
                >
                  {bankDiff === 0
                    ? 'BALANCED (0.00 ETB)'
                    : bankDiff < 0
                    ? `SHORTAGE (${formatETB(Math.abs(bankDiff))})`
                    : `SURPLUS (+${formatETB(bankDiff)})`}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.inputLabel}>Closing Notes & Remarks (የዝጋታ ማስታወሻ)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. End of day register closing & physical count verified"
            value={closingNotes}
            onChangeText={setClosingNotes}
          />

          <TouchableOpacity
            style={[styles.closeDayBtn, submitting && styles.btnDisabled]}
            onPress={handlePerformClosing}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.closeDayBtnText}>Perform Daily Closing & Lock / የቀኑን ሒሳብ ዝጋና ቆልፍ</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 13,
  },
  headerBox: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  amharicSubtitle: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  helpText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 17,
  },
  subSectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    backgroundColor: '#F8FAFC',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
    marginTop: 4,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  calcLabel: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
  },
  calcValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  activityHighlightRow: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  activityHighlightLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    flex: 1,
  },
  activityHighlightValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  totalHighlightRow: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  totalHighlightLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
    flex: 1,
  },
  totalHighlightValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  ruleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  ruleNoticeText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  diffBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    gap: 8,
  },
  diffLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  diffFormula: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  diffValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  closeDayBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: {
    backgroundColor: '#A5B4FC',
  },
  closeDayBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
