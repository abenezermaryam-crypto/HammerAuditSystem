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
import { DailyExpense } from '../types';
import { formatETB } from '../utils/currency';
import { AppTopHeader } from '../components/AppTopHeader';
import { useAuth } from '../context/AuthContext';
import { AppIcon } from '../components/AppIcon';

export const DailyExpenseScreen = ({ route, navigation }: any) => {
  const { businessDayId } = route.params || {};
  const [activeDayId, setActiveDayId] = useState<number | null>(businessDayId || null);
  const [activeDayDate, setActiveDayDate] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentSource, setPaymentSource] = useState<'CASH' | 'BANK'>('CASH');
  const [category, setCategory] = useState('Supplies');
  const [reference, setReference] = useState('');
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const { user } = useAuth();

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
          const res = await api.getExpenses(dayId);
          if (res?.expenses) {
            setExpenses(res.expenses);
          }
        }
      } catch (err: any) {
        console.log('Error loading expenses:', err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [businessDayId]);

  const loadExpenses = async (dayId?: number) => {
    const targetId = dayId || activeDayId;
    if (!targetId) return;
    try {
      setLoading(true);
      const res = await api.getExpenses(targetId);
      if (res?.expenses) {
        setExpenses(res.expenses);
      }
    } catch (err: any) {
      console.log('Error loading expenses:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExpense = async () => {
    const targetId = activeDayId || businessDayId;
    if (!targetId) {
      Alert.alert(
        'No Active Day / ክፍት ቀን የለም',
        'No active business day is currently opened. Please open today\'s register on the Dashboard first. / እባክዎ መጀመሪያ በመነሻ ገጹ ላይ የቀኑን መዝገብ ይክፈቱ።'
      );
      return;
    }

    const expVal = parseFloat(amount) || 0;
    if (!description.trim() || expVal <= 0) {
      Alert.alert('Required', 'Please enter a valid expense description and amount greater than 0.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        if (changeReason.trim().length < 10) {
          Alert.alert('Reason required', 'Explain the correction in at least 10 characters.');
          return;
        }
        await api.updateExpense(editingId, {
          description: description.trim(),
          amount: expVal,
          payment_source: paymentSource,
          expense_category: category,
          reference_number: reference || undefined,
          reason: changeReason.trim(),
        });
      } else {
        await api.recordExpense({
          business_day_id: targetId,
          description: description.trim(),
          amount: expVal,
          payment_source: paymentSource,
          expense_category: category,
          reference_number: reference || undefined,
        });
      }

      Alert.alert('Success', editingId ? 'Expense updated with an audit record.' : `Expense of ${formatETB(expVal)} recorded against ${paymentSource}.`);
      setDescription('');
      setAmount('');
      setReference('');
      setChangeReason('');
      setEditingId(null);
      loadExpenses(targetId);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <AppTopHeader
        title="Record Daily Expense (ወጪ መዝግብ)"
        showBack={true}
        navigation={navigation}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Record Daily Operational Expense</Text>
        {!isDayOpen && <Text style={styles.dayClosedNotice}>The business day is closed. A Manager must reopen it before entries can be added or edited.</Text>}
        {user?.role === 'auditor' && <Text style={styles.dayClosedNotice}>Auditors may correct existing records only; new entries must be recorded by a Recorder or Manager.</Text>}
        <Text style={styles.amharicSubtitle}>የእለት ወጪ መመዝገቢያ ቅጽ</Text>

        <Text style={styles.label}>Payment Source Account (የወጣበት አካውንት)</Text>
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            disabled={!isDayOpen || (user?.role === 'auditor' && editingId === null)}
            style={[
              styles.segmentBtn,
              paymentSource === 'CASH' && styles.segmentBtnActiveCash,
            ]}
            onPress={() => setPaymentSource('CASH')}
          >
            <View style={styles.segmentContent}>
              <AppIcon name="wallet" size={15} color={paymentSource === 'CASH' ? '#FFFFFF' : '#475569'} />
              <Text style={[styles.segmentText, paymentSource === 'CASH' && styles.segmentTextActive]}>
                Cash from Safe (ከካዝና የወጣ)
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={!isDayOpen || (user?.role === 'auditor' && editingId === null)}
            style={[
              styles.segmentBtn,
              paymentSource === 'BANK' && styles.segmentBtnActiveBank,
            ]}
            onPress={() => setPaymentSource('BANK')}
          >
            <View style={styles.segmentContent}>
              <AppIcon name="landmark" size={15} color={paymentSource === 'BANK' ? '#FFFFFF' : '#475569'} />
              <Text style={[styles.segmentText, paymentSource === 'BANK' && styles.segmentTextActive]}>
                Bank Transfer (ከባንክ የወጣ)
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Expense Description (የወጪው ምክንያት)</Text>
        <TextInput
          style={styles.input}
          editable={isDayOpen && (user?.role !== 'auditor' || editingId !== null)}
          placeholder="e.g. Shop supplies, electricity, transport"
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Amount (የብር መጠን)</Text>
        <TextInput
          style={styles.input}
          editable={isDayOpen && (user?.role !== 'auditor' || editingId !== null)}
          keyboardType="numeric"
          placeholder="0.00 ETB"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>Voucher / Receipt Reference (Optional)</Text>
        <TextInput
          style={styles.input}
          editable={isDayOpen && (user?.role !== 'auditor' || editingId !== null)}
          placeholder="e.g. REC-883 or Bill #"
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
          onPress={handleSaveExpense}
          disabled={submitting || !isDayOpen || (user?.role === 'auditor' && editingId === null)}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>{editingId ? 'Save Expense Correction' : 'Submit Expense / ወጪ መዝግብ'}</Text>
          )}
        </TouchableOpacity>
        {editingId !== null && (
          <TouchableOpacity onPress={() => { setEditingId(null); setChangeReason(''); }}>
            <Text style={styles.cancelEdit}>Cancel correction</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.historyTitle}>Today's Recorded Expenses</Text>
      {loading ? (
        <ActivityIndicator color="#DC2626" />
      ) : expenses.length === 0 ? (
        <Text style={styles.emptyText}>No expenses recorded yet today.</Text>
      ) : (
        expenses.map((exp) => (
          <View key={exp.id} style={styles.expenseItem}>
            <View style={styles.expenseRow}>
              <Text style={styles.expenseDesc}>{exp.description}</Text>
              <Text style={styles.expenseAmount}>-{formatETB(exp.amount)}</Text>
            </View>
            <View style={styles.expenseMetaRow}>
              <View style={[styles.sourceBadge, exp.payment_source === 'CASH' ? styles.sourceCash : styles.sourceBank]}>
                <AppIcon name={exp.payment_source === 'CASH' ? 'wallet' : 'landmark'} size={13} color={exp.payment_source === 'CASH' ? '#065F46' : '#1E40AF'} />
                <Text style={[styles.sourceBadgeText, exp.payment_source === 'CASH' ? styles.sourceCashText : styles.sourceBankText]}>
                  {exp.payment_source === 'CASH' ? 'Cash Safe' : 'Bank'}
                </Text>
              </View>
              {exp.reference_number && (
                <Text style={styles.refText}>Ref: {exp.reference_number}</Text>
              )}
            </View>
            {isDayOpen && user && ['recorder', 'auditor', 'manager'].includes(user.role) && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setEditingId(exp.id);
                  setDescription(exp.description);
                  setAmount(String(exp.amount));
                  setPaymentSource(exp.payment_source);
                  setCategory(exp.expense_category || 'General');
                  setReference(exp.reference_number || '');
                  setChangeReason('');
                }}
              >
                <AppIcon name="activity" size={15} color="#1E3A8A" />
                <Text style={styles.editText}>Edit expense</Text>
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
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 16,
  },
  dayClosedNotice: { color: '#9A3412', backgroundColor: '#FFEDD5', padding: 10, borderRadius: 6, marginVertical: 8 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 8 },
  editText: { color: '#1E3A8A', fontWeight: '700', fontSize: 12 },
  cancelEdit: { textAlign: 'center', padding: 10, color: '#475569', fontWeight: '600' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  segmentedContainer: {
    flexDirection: 'row',
    marginBottom: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  segmentBtnActiveCash: {
    backgroundColor: '#10B981',
  },
  segmentBtnActiveBank: {
    backgroundColor: '#3B82F6',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  segmentContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  segmentTextActive: {
    color: '#FFFFFF',
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
  submitBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: {
    backgroundColor: '#FCA5A5',
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
  expenseItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  expenseDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  expenseMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceBadgeText: { fontSize: 11, fontWeight: '700' },
  sourceCashText: { color: '#065F46' },
  sourceBankText: { color: '#1E40AF' },
  sourceCash: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  sourceBank: {
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
  },
  refText: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
