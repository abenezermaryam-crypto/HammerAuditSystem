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

  // Daily Activity calculations for this business day
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

  const totalDailyNetIncome = Math.round((netDailyCashActivity + netDailyBankActivity) * 100) / 100;

  const executeClosing = async (targetId: number) => {
    try {
      setSubmitting(true);
      await api.performClosing(targetId, {
        notes: closingNotes,
      });

      showAlert(
        'Day Closed Successfully / የቀኑ ሂሳብ ተዘግቷል!',
        `Daily net activity registered:\nNet Cash: ${formatETB(netDailyCashActivity)}\nNet Bank: ${formatETB(netDailyBankActivity)}\nTotal Net Activity: ${formatETB(totalDailyNetIncome)}`,
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

    const confirmMsg =
      'Are you sure you want to finalize and lock today\'s financial activity?\n\n' +
      `Daily Net Activity: ${formatETB(totalDailyNetIncome)}\n\n` +
      'All transactions for this day will be locked and ready for periodic Three-Day Audit.';

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
        <Text style={styles.loadingText}>Calculating Daily Net Balances...</Text>
      </View>
    );
  }

  if (!preview && !activeDayId) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <AppTopHeader
          title="Daily Closing (የዕለት ሂሳብ ዝጋ)"
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
        title="Daily Closing (የዕለት ሂሳብ ዝጋ)"
        showBack={true}
        navigation={navigation}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <AppIcon name="lock" size={20} color="#1E3A8A" />
            <Text style={styles.title}>Daily Financial Closing</Text>
          </View>
          <Text style={styles.amharicSubtitle}>
            የዕለት ገቢና ወጪ ማጠቃለያ — {businessDate}
          </Text>
        </View>

        {/* Audit Notice Box */}
        <View style={styles.infoNotice}>
          <AppIcon name="shield" size={16} color="#0284C7" />
          <Text style={styles.infoNoticeText}>
            📌 Daily closing registers that single day's net income and expense entries.{'\n'}
            Cross-check actual verification (ትክክለኛ ቆጠራ ማረጋገጫ) and cashbox/bank audit reconciliation occur every 3 days during the Three-Day Audit.
          </Text>
        </View>

        {/* ── CARD 1: DAILY FINANCIAL ACTIVITY ─────────── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <AppIcon name="trend" size={17} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Daily Financial Net Summary (የዕለቱ የገንዘብ እንቅስቃሴ)</Text>
          </View>

          {/* Cash Activity */}
          <Text style={styles.subSectionHeader}>💵 CASH ACTIVITY (የካዝና እንቅስቃሴ)</Text>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Total Daily Cash Income (የዕለቱ የካዝና ገቢ):</Text>
            <Text style={[styles.calcValue, { color: '#059669' }]}>
              +{formatETB(totalCashIncome)}
            </Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Total Daily Cash Expenses (የዕለቱ የካዝና ወጪ):</Text>
            <Text style={[styles.calcValue, { color: '#DC2626' }]}>
              −{formatETB(totalCashExpenses)}
            </Text>
          </View>
          <View style={[styles.calcRow, styles.activityHighlightRow]}>
            <Text style={styles.activityHighlightLabel}>
              Net Daily Cash Balance (የዕለቱ የተጣራ ካዝና):
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
            <Text style={styles.calcLabel}>Total Daily Bank Income (የዕለቱ የባንክ ገቢ):</Text>
            <Text style={[styles.calcValue, { color: '#059669' }]}>
              +{formatETB(totalBankIncome)}
            </Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Total Daily Bank Expenses (የዕለቱ የባንክ ወጪ):</Text>
            <Text style={[styles.calcValue, { color: '#DC2626' }]}>
              −{formatETB(totalBankExpenses)}
            </Text>
          </View>
          <View style={[styles.calcRow, styles.activityHighlightRow]}>
            <Text style={styles.activityHighlightLabel}>
              Net Daily Bank Balance (የዕለቱ የተጣራ ባንክ):
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

          <View style={styles.divider} />

          {/* Combined Daily Net Total */}
          <View style={[styles.calcRow, styles.totalHighlightRow]}>
            <Text style={styles.totalHighlightLabel}>
              Total Net Daily Activity (ጠቅላላ የዕለቱ የተጣራ ገቢ):
            </Text>
            <Text style={styles.totalHighlightValue}>
              {totalDailyNetIncome >= 0 ? '+' : ''}{formatETB(totalDailyNetIncome)}
            </Text>
          </View>
        </View>

        {/* ── CARD 2: CLOSING NOTES & SUBMIT ─────────── */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Closing Notes & Remarks (የዝጋታ ማስታወሻ)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. End of day register activity closed and saved"
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
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  amharicSubtitle: {
    fontSize: 13,
    color: '#1E3A8A',
    fontWeight: '600',
    marginTop: 2,
  },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  infoNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 18,
    fontWeight: '500',
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
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
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
    paddingVertical: 5,
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
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  totalHighlightLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3A8A',
    flex: 1,
  },
  totalHighlightValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  closeDayBtn: {
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  btnDisabled: {
    backgroundColor: '#93C5FD',
  },
  closeDayBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
