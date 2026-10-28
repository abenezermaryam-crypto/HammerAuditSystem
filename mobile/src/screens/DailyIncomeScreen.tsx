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
import { DailyIncome } from '../types';
import { formatETB } from '../utils/currency';
import { AppTopHeader } from '../components/AppTopHeader';
import { useAuth } from '../context/AuthContext';
import { AppIcon } from '../components/AppIcon';

export const DailyIncomeScreen = ({ route, navigation }: any) => {
  const { businessDayId } = route.params || {};
  const [activeDayId, setActiveDayId] = useState<number | null>(businessDayId || null);
  const [activeDayDate, setActiveDayDate] = useState<string>('');
  const [cashIncome, setCashIncome] = useState('');
  const [bankIncome, setBankIncome] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [incomes, setIncomes] = useState<DailyIncome[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const { user } = useAuth();

  const totalCalculated = (parseFloat(cashIncome) || 0) + (parseFloat(bankIncome) || 0);

  useEffect(() => {
    async function init() {
      let dayId = businessDayId;
      try {
        setLoading(true);
        const curRes = await api.getCurrentBusinessDay();
        if (curRes?.currentDay?.id) {
          if (!dayId) {
            dayId = curRes.currentDay.id;
            setActiveDayId(dayId);
          }
          setActiveDayDate(curRes.currentDay.business_date);
          setIsDayOpen(curRes.currentDay.id === dayId && curRes.currentDay.status === 'OPEN');
        }
        if (dayId) {
          const res = await api.getIncomes(dayId);
          if (res?.incomes) {
            setIncomes(res.incomes);
          }
        }
      } catch (err: any) {
        console.log('Error loading incomes:', err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [businessDayId]);

  const loadIncomes = async (dayId?: number) => {
    const targetId = dayId || activeDayId;
    if (!targetId) return;
    try {
      setLoading(true);
      const res = await api.getIncomes(targetId);
      if (res?.incomes) {
        setIncomes(res.incomes);
      }
    } catch (err: any) {
      console.log('Error loading incomes:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIncome = async () => {
    const targetId = activeDayId || businessDayId;
    if (!targetId) {
      Alert.alert(
        'No Active Day / ክፍት ቀን የለም',
        'No active business day is currently opened. Please open today\'s register on the Dashboard first. / እባክዎ መጀመሪያ በመነሻ ገጹ ላይ የቀኑን መዝገብ ይክፈቱ።'
      );
      return;
    }

    const cVal = parseFloat(cashIncome) || 0;
    const bVal = parseFloat(bankIncome) || 0;

    if (cVal === 0 && bVal === 0) {
      Alert.alert('Required', 'Please enter at least Cash Income or Bank Income amount.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        if (changeReason.trim().length < 10) {
          Alert.alert('Reason required', 'Explain the correction in at least 10 characters.');
          return;
        }
        await api.updateIncome(editingId, {
          cash_income: cVal,
          bank_income: bVal,
          description: description || 'Aggregated daily income',
          reference_number: reference || undefined,
          reason: changeReason.trim(),
        });
      } else {
        await api.recordIncome({
          business_day_id: targetId,
          cash_income: cVal,
          bank_income: bVal,
          description: description || 'Aggregated daily income',
          reference_number: reference || undefined,
        });
      }

      Alert.alert('Success', editingId ? 'Income updated with an audit record.' : 'Daily income recorded successfully.');
      setCashIncome('');
      setBankIncome('');
      setDescription('');
      setReference('');
      setChangeReason('');
      setEditingId(null);
      loadIncomes(targetId);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <AppTopHeader
        title="Record Daily Income (ገቢ መዝግብ)"
        showBack={true}
        navigation={navigation}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Record Aggregated Daily Income</Text>
        {!isDayOpen && <Text style={styles.dayClosedNotice}>The business day is closed. A Manager must reopen it before entries can be added or edited.</Text>}
        {user?.role === 'auditor' && <Text style={styles.dayClosedNotice}>Auditors may correct existing records only; new entries must be recorded by a Recorder or Manager.</Text>}
        <Text style={styles.amharicSubtitle}>የእለት ገቢ መመዝገቢያ ቅጽ</Text>

        <Text style={styles.label}>Cash Income to Safe (ወደ ካዝና የገባ የእለት ገቢ)</Text>
        <TextInput
          style={styles.input}
          editable={isDayOpen && (user?.role !== 'auditor' || editingId !== null)}
          keyboardType="numeric"
          placeholder="0.00 ETB"
          value={cashIncome}
          onChangeText={setCashIncome}
        />

        <Text style={styles.label}>Bank / Digital Income (ወደ ባንክ የተላለፈ የእለት ገቢ)</Text>
        <TextInput
          style={styles.input}
          editable={isDayOpen && (user?.role !== 'auditor' || editingId !== null)}
          keyboardType="numeric"
          placeholder="0.00 ETB"
          value={bankIncome}
          onChangeText={setBankIncome}
        />

        {/* Live Automatic System Calculation */}
        <View style={styles.calculationPreviewBox}>
          <Text style={styles.previewLabel}>System Calculated Total Daily Income:</Text>
          <Text style={styles.previewValue}>{formatETB(totalCalculated)}</Text>
        </View>

        <Text style={styles.label}>Description / Shift Notes</Text>
        <TextInput
          style={styles.input}
          editable={isDayOpen && (user?.role !== 'auditor' || editingId !== null)}
          placeholder="e.g. Afternoon sales aggregation"
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Reference / Voucher (Optional)</Text>
        <TextInput
          style={styles.input}
          editable={isDayOpen && (user?.role !== 'auditor' || editingId !== null)}
          placeholder="e.g. TX-99382 or Safe Drop #1"
          value={reference}
          onChangeText={setReference}
        />

        {editingId !== null && (
          <>
            <Text style={styles.label}>Reason for correction (required)</Text>
            <TextInput
              style={styles.input}
              value={changeReason}
              onChangeText={setChangeReason}
              editable={isDayOpen && editingId !== null}
              placeholder="Explain why this financial record is changing"
              multiline
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isDayOpen || (user?.role === 'auditor' && editingId === null)) && styles.btnDisabled]}
          onPress={handleSaveIncome}
          disabled={submitting || !isDayOpen || (user?.role === 'auditor' && editingId === null)}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>{editingId ? 'Save Income Correction' : 'Submit Daily Income / ገቢ አስገባ'}</Text>
          )}
        </TouchableOpacity>
        {editingId !== null && (
          <TouchableOpacity onPress={() => { setEditingId(null); setChangeReason(''); }}>
            <Text style={styles.cancelEdit}>Cancel correction</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.historyTitle}>Today's Recorded Income Entries</Text>
      {loading ? (
        <ActivityIndicator color="#1E3A8A" />
      ) : incomes.length === 0 ? (
        <Text style={styles.emptyText}>No income entries recorded yet for today.</Text>
      ) : (
        incomes.map((inc) => (
          <View key={inc.id} style={styles.incomeItem}>
            <View style={styles.incomeRow}>
              <Text style={styles.incomeDesc}>{inc.description || 'Daily Income'}</Text>
              <Text style={styles.incomeTotal}>{formatETB(inc.total_income)}</Text>
            </View>
            <View style={styles.incomeBreakdown}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <AppIcon name="wallet" size={14} color="#059669" />
                <Text style={styles.breakdownText}>Cash: {formatETB(inc.cash_income)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <AppIcon name="landmark" size={14} color="#2563EB" />
                <Text style={styles.breakdownText}>Bank: {formatETB(inc.bank_income)}</Text>
              </View>
            </View>
            <Text style={styles.recordedBy}>Recorded by: {inc.recorded_by_name || 'Recorder'}</Text>
            {isDayOpen && user && ['recorder', 'auditor', 'manager'].includes(user.role) && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setEditingId(inc.id);
                  setCashIncome(String(inc.cash_income));
                  setBankIncome(String(inc.bank_income));
                  setDescription(inc.description || '');
                  setReference(inc.reference_number || '');
                  setChangeReason('');
                }}
              >
                <AppIcon name="activity" size={15} color="#1E3A8A" />
                <Text style={styles.editText}>Edit income</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  amharicSubtitle: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    marginBottom: 16,
  },
  dayClosedNotice: { color: '#9A3412', backgroundColor: '#FFEDD5', padding: 10, borderRadius: 6, marginVertical: 8 },
  editButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, marginTop: 8 },
  editText: { color: '#1E3A8A', fontWeight: '700', fontSize: 12 },
  cancelEdit: { textAlign: 'center', padding: 10, color: '#475569', fontWeight: '600' },
  label: {
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
    fontSize: 15,
    marginBottom: 14,
    color: '#0F172A',
  },
  calculationPreviewBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  previewLabel: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
  },
  previewValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E3A8A',
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  emptyText: {
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  incomeItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  incomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  incomeDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  incomeTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  incomeBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  breakdownText: {
    fontSize: 12,
    color: '#64748B',
  },
  recordedBy: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
});
