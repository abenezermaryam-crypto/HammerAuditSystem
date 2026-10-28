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
} from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BusinessDay, ThreeDayAudit } from '../types';
import { formatETB, formatDate } from '../utils/currency';
import { StatusBadge } from '../components/StatusBadge';
import { AppTopHeader } from '../components/AppTopHeader';
import { AppIcon } from '../components/AppIcon';

export const ThreeDayAuditScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [closedDays, setClosedDays] = useState<BusinessDay[]>([]);
  const [selectedDayIds, setSelectedDayIds] = useState<number[]>([]);
  const [auditPreview, setAuditPreview] = useState<any | null>(null);
  const [additionalIncome, setAdditionalIncome] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [actualBank, setActualBank] = useState('');
  const [remarks, setRemarks] = useState('');
  const [recentAudits, setRecentAudits] = useState<ThreeDayAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (typeof window !== 'undefined' && (window as any).alert) {
      (window as any).alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [daysRes, auditsRes] = await Promise.all([
        api.getEligibleAuditDays(),
        api.getAudits(),
      ]);
      if (daysRes?.closedDays) {
        setClosedDays(daysRes.closedDays);
        // Preselect first 3 if available
        if (daysRes.closedDays.length >= 3) {
          setSelectedDayIds(daysRes.closedDays.slice(0, 3).map((d: any) => d.id));
        }
      }
      if (auditsRes?.audits) {
        setRecentAudits(auditsRes.audits);
      }
    } catch (err: any) {
      console.log('Error loading audit data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculatePreview = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (selectedDayIds.length !== 3) {
      const msg = 'Please select exactly 3 consecutive closed days.';
      setSubmitError(msg);
      showAlert('Required', msg);
      return;
    }

    try {
      const res = await api.previewThreeDayAudit({
        day_ids: selectedDayIds,
        additional_cash_income: parseFloat(additionalIncome) || 0,
      });
      if (res?.auditPreview) {
        setAuditPreview(res.auditPreview);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Calculation failed';
      setSubmitError(errorMsg);
      showAlert('Calculation Error', errorMsg);
    }
  };

  const handleSubmitAudit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (selectedDayIds.length !== 3) {
      const msg = 'Please select exactly 3 consecutive closed days for the audit cycle. / እባክዎ 3 ተከታታይ የተዘጉ ቀናትን ይምረጡ።';
      setSubmitError(msg);
      showAlert('Selection Required / ምርጫ ያስፈልጋል', msg);
      return;
    }

    const actCashNum = parseFloat(actualCash);
    const actBankNum = parseFloat(actualBank);

    if (isNaN(actCashNum) || isNaN(actBankNum)) {
      const msg = 'Please enter valid actual verified physical cash and bank balances. / እባክዎ ካዝና ውስጥ የተገኘ እና ባንክ ያለ የተረጋገጠ ብር ያስገቡ።';
      setSubmitError(msg);
      showAlert('Required / አስፈላጊ', msg);
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.submitThreeDayAudit({
        day_ids: selectedDayIds,
        actual_cash: actCashNum,
        actual_bank: actBankNum,
        additional_cash_income: parseFloat(additionalIncome) || 0,
        remarks,
      });

      const auditCode = res.audit?.audit_code || res.audit?.auditCode || 'AUD-CYCLE';
      const auditStatus = res.audit?.overall_status || res.audit?.overallStatus || 'BALANCED';

      const successMsg = `3-Day Audit #${auditCode} submitted successfully!\nOverall Status: ${auditStatus}`;
      setSubmitSuccess(successMsg);

      showAlert(
        'Audit Completed / ኦዲቱ ተጠናቋል',
        `3-Day Audit #${auditCode} registered with status: ${auditStatus}`,
        () => {
          loadData();
        }
      );

      loadData();
      setAuditPreview(null);
      setActualCash('');
      setActualBank('');
      setRemarks('');
      setSelectedDayIds([]);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Audit submission failed';
      setSubmitError(errorMsg);
      showAlert('Audit Submission Failed / ኦዲት አልተሳካም', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDaySelection = (id: number) => {
    setSubmitError(null);
    if (selectedDayIds.includes(id)) {
      setSelectedDayIds(selectedDayIds.filter((d) => d !== id));
    } else {
      if (selectedDayIds.length >= 3) {
        showAlert('Limit Reached', 'A cycle is composed of exactly 3 consecutive days.');
        return;
      }
      setSelectedDayIds([...selectedDayIds, id]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <AppTopHeader
        title="Three-Day Audit (የሦስት ቀን ኦዲት)"
        showBack={true}
        navigation={navigation}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <AppIcon name="clipboard" size={20} color="#1E3A8A" />
            <Text style={styles.title}>Three-Day Audit Control</Text>
          </View>
          <Text style={styles.amharicSubtitle}>የሦስት ቀን ኦዲት አሰራርና ማጠቃለያ</Text>
        </View>

      {/* Day Selection Box */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Select 3 Consecutive Closed Days</Text>
        <Text style={styles.helpText}>Selected: {selectedDayIds.length} / 3 days</Text>

        {closedDays.length === 0 ? (
          <Text style={styles.emptyText}>No closed days pending 3-day audit.</Text>
        ) : (
          closedDays.map((day) => {
            const isSelected = selectedDayIds.includes(day.id);
            return (
              <TouchableOpacity
                key={day.id}
                style={[styles.daySelectRow, isSelected && styles.daySelectRowActive]}
                onPress={() => toggleDaySelection(day.id)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <AppIcon name="calendar" size={14} color="#64748B" />
                  <Text style={[styles.dayDate, isSelected && styles.dayTextActive]}>{formatDate(day.business_date)}</Text>
                </View>
                <Text style={styles.dayStatus}>Closed</Text>
              </TouchableOpacity>
            );
          })
        )}

        <Text style={styles.label}>Additional Cash Incomes (ተጨማሪ ገቢዎች ካሉ)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0.00 ETB (e.g. Returned purchase surplus)"
          value={additionalIncome}
          onChangeText={setAdditionalIncome}
        />

        <TouchableOpacity
          style={[styles.calcBtn, selectedDayIds.length !== 3 && styles.btnDisabled]}
          onPress={handleCalculatePreview}
          disabled={selectedDayIds.length !== 3}
        >
          <Text style={styles.calcBtnText}>Calculate 3-Day Expected Balances</Text>
        </TouchableOpacity>
      </View>

      {/* Calculated Preview — Section 2 & 3 */}
      {auditPreview && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Three-Day Audit Calculation Formula</Text>

          {/* Starting balance source badge */}
          <View style={[
            styles.sourceBadge,
            auditPreview.startingBalanceSource === 'PREVIOUS_AUDIT'
              ? styles.sourceBadgePrev : styles.sourceBadgeInit,
          ]}>
            <Text style={styles.sourceBadgeText}>
              {auditPreview.startingBalanceSource === 'PREVIOUS_AUDIT'
                ? `🔗 Starting balance carried from previous audit (ended ${auditPreview.previousAuditEndDate})`
                : '🏁 Starting balance: initial verified opening balance (first audit)'}
            </Text>
          </View>

          {/* ── CASH SECTION ─────────────────────────────────────── */}
          <Text style={styles.subSectionHeader}>💵 CASH (ካዝና)</Text>

          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>
              {auditPreview.startingBalanceSource === 'PREVIOUS_AUDIT'
                ? '  Previous Audit Closing Cash (ቀዳሚ ኦዲት ዝጋታ):'
                : '  Initial Starting Cash Balance (የመጀመሪያ ቀን ካዝና):'}
            </Text>
            <Text style={styles.calcVal}>{formatETB(auditPreview.openingCash)}</Text>
          </View>

          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  + 3-Day Cash Income (ወደ ካዝና የገባ ድምር):</Text>
            <Text style={[styles.calcVal, { color: '#059669' }]}>
              +{formatETB(auditPreview.total3DayCashIncome)}
            </Text>
          </View>

          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  − 3-Day Cash Expenses (ከካዝና የወጣ ድምር):</Text>
            <Text style={[styles.calcVal, { color: '#DC2626' }]}>
              −{formatETB(auditPreview.total3DayCashExpenses)}
            </Text>
          </View>

          {(auditPreview.additionalCashIncome > 0) && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>  + Additional Cash Income (ተጨማሪ ገቢ):</Text>
              <Text style={[styles.calcVal, { color: '#059669' }]}>
                +{formatETB(auditPreview.additionalCashIncome)}
              </Text>
            </View>
          )}

          {(auditPreview.cashAdjustments !== 0) && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>  ± Approved Cash Adjustments (ማስተካከያ):</Text>
              <Text style={[styles.calcVal, { color: auditPreview.cashAdjustments >= 0 ? '#059669' : '#DC2626' }]}>
                {auditPreview.cashAdjustments >= 0 ? '+' : ''}{formatETB(auditPreview.cashAdjustments)}
              </Text>
            </View>
          )}

          <View style={[styles.calcRow, styles.expectedHighlight]}>
            <Text style={styles.expectedText}>= Calculated Closing Cash Balance:</Text>
            <Text style={styles.expectedAmount}>{formatETB(auditPreview.closingCashBalance ?? auditPreview.expectedCash)}</Text>
          </View>

          <View style={styles.divider} />

          {/* ── BANK SECTION ─────────────────────────────────────── */}
          <Text style={styles.subSectionHeader}>🏦 BANK (ባንክ)</Text>

          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>
              {auditPreview.startingBalanceSource === 'PREVIOUS_AUDIT'
                ? '  Previous Audit Closing Bank (ቀዳሚ ኦዲት ባንክ ዝጋታ):'
                : '  Initial Starting Bank Balance (የመጀመሪያ ቀን ባንክ):'}
            </Text>
            <Text style={styles.calcVal}>{formatETB(auditPreview.openingBank)}</Text>
          </View>

          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  + 3-Day Bank Income (ወደ ባንክ የገባ ድምር):</Text>
            <Text style={[styles.calcVal, { color: '#059669' }]}>
              +{formatETB(auditPreview.total3DayBankIncome)}
            </Text>
          </View>

          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>  − 3-Day Bank Expenses (ከባንክ የወጣ ድምር):</Text>
            <Text style={[styles.calcVal, { color: '#DC2626' }]}>
              −{formatETB(auditPreview.total3DayBankExpenses)}
            </Text>
          </View>

          {(auditPreview.bankAdjustments !== 0) && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>  ± Approved Bank Adjustments (ማስተካከያ):</Text>
              <Text style={[styles.calcVal, { color: auditPreview.bankAdjustments >= 0 ? '#059669' : '#DC2626' }]}>
                {auditPreview.bankAdjustments >= 0 ? '+' : ''}{formatETB(auditPreview.bankAdjustments)}
              </Text>
            </View>
          )}

          <View style={[styles.calcRow, styles.expectedHighlight]}>
            <Text style={styles.expectedText}>= Calculated Closing Bank Balance:</Text>
            <Text style={styles.expectedAmount}>{formatETB(auditPreview.closingBankBalance ?? auditPreview.expectedBank)}</Text>
          </View>

          {/* ── Section 3: Physical Audit Verification ─────────── */}
          <Text style={styles.sectionDividerHeader}>3. Physical Audit Verification (ኦዲት ማረጋገጫ)</Text>
          <Text style={styles.helpText}>
            Audit Difference = Actual Verified − Calculated Closing Balance{'\n'}
            (Negative = Shortage / አጥረ | Positive = Surplus / ተርፏል)
          </Text>

          <Text style={styles.label}>Actual Cash Count in Safe (ካዝና ውስጥ የተገኘ ገንዘብ) *</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="0.00 ETB"
            value={actualCash}
            onChangeText={setActualCash}
          />

          <Text style={styles.label}>Actual Verified Bank Balance (ባንክ ላይ ያለ የተረጋገጠ ብር) *</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="0.00 ETB"
            value={actualBank}
            onChangeText={setActualBank}
          />

          <Text style={styles.label}>Auditor Remarks & Examination Notes (ምርመራ)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Three-day cash count verified by auditor"
            value={remarks}
            onChangeText={setRemarks}
          />

          {/* Error/Success Banners */}
          {submitError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠ {submitError}</Text>
            </View>
          )}
          {submitSuccess && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>✓ {submitSuccess}</Text>
            </View>
          )}

          {(user?.role === 'auditor' || user?.role === 'manager') && (
            <TouchableOpacity
              style={[styles.submitAuditBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmitAudit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitAuditBtnText}>Submit & Sign 3-Day Audit / ኦዲት አጠናቅቅ</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}


      {/* Historical 3-Day Audits */}
      <Text style={styles.historySectionTitle}>Recent Three-Day Audits (የቀደሙ ኦዲቶች)</Text>
      {recentAudits.map((aud) => (
        <View key={aud.id} style={styles.auditCard}>
          <View style={styles.auditCardHeader}>
            <Text style={styles.auditCode}>{aud.audit_code}</Text>
            <StatusBadge status={aud.overall_status} />
          </View>
          <Text style={styles.auditPeriod}>
            Period: {formatDate(aud.start_date)} - {formatDate(aud.end_date)}
          </Text>
          <View style={styles.auditBalancesRow}>
            <Text style={styles.auditBalanceItem}>
              Cash Diff: {formatETB(aud.cash_difference)}
            </Text>
            <Text style={styles.auditBalanceItem}>
              Bank Diff: {formatETB(aud.bank_difference)}
            </Text>
          </View>
          <Text style={styles.auditorSignature}>Auditor: {aud.auditor_name}</Text>
        </View>
      ))}
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
    color: '#D97706',
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
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 18,
  },
  sourceBadge: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  sourceBadgePrev: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  sourceBadgeInit: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  sourceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
    lineHeight: 18,
  },
  subSectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  daySelectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  daySelectRowActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  dayDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dayTextActive: {
    color: '#92400E',
  },
  dayStatus: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyText: {
    color: '#94A3B8',
    fontStyle: 'italic',
    marginVertical: 8,
  },
  label: {
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
  calcBtn: {
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  btnDisabled: {
    backgroundColor: '#FCD34D',
  },
  calcBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  calcLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  calcVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  expectedHighlight: {
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  expectedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  expectedAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  sectionDividerHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 4,
  },
  submitAuditBtn: {
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  submitAuditBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  historySectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    marginTop: 8,
  },
  auditCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  auditCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  auditCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  auditPeriod: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  auditBalancesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  auditBalanceItem: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  auditorSignature: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  errorBannerText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  successBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  successBannerText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
