import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { api } from '../api/client';
import { Discrepancy } from '../types';
import { formatETB, formatDate } from '../utils/currency';
import { StatusBadge } from '../components/StatusBadge';
import { AppTopHeader } from '../components/AppTopHeader';
import { AppIcon } from '../components/AppIcon';

export const DiscrepanciesScreen = ({ navigation }: any) => {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<Discrepancy | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDiscrepancies();
  }, []);

  const loadDiscrepancies = async () => {
    try {
      setLoading(true);
      const res = await api.getDiscrepancies();
      if (res?.discrepancies) {
        setDiscrepancies(res.discrepancies);
      }
    } catch (err: any) {
      console.log('Error loading discrepancies:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExplain = (disc: Discrepancy) => {
    setSelectedDiscrepancy(disc);
    setExplanation(disc.explanation || '');
    setEvidenceRef(disc.evidence_ref || '');
    setModalVisible(true);
  };

  const handleSubmitExplanation = async () => {
    if (!selectedDiscrepancy) return;
    if (!explanation.trim()) {
      Alert.alert('Required', 'Please enter a clear explanation for this discrepancy.');
      return;
    }

    try {
      setSubmitting(true);
      await api.submitDiscrepancyExplanation(selectedDiscrepancy.id, {
        explanation: explanation.trim(),
        evidence_ref: evidenceRef.trim() || undefined,
      });

      Alert.alert('Submitted', 'Discrepancy explanation recorded for investigation.');
      setModalVisible(false);
      loadDiscrepancies();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppTopHeader
        title="Discrepancy Investigation (የጉድለት/ትርፍ ምርመራ)"
        showBack={true}
        navigation={navigation}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <AppIcon name="alert" size={19} color="#D97706" />
            <Text style={styles.title}>Discrepancy Investigation & Control</Text>
          </View>
          <Text style={styles.amharicSubtitle}>የጉድለትና የትርፍ ማብራሪያና ቁጥጥር</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1E3A8A" />
        ) : discrepancies.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <AppIcon name="check" size={19} color="#059669" />
              <Text style={styles.emptyTitle}>All Accounts Balanced</Text>
            </View>
            <Text style={styles.emptyDesc}>No active shortages or discrepancies recorded.</Text>
          </View>
        ) : (
          discrepancies.map((d) => (
            <View key={d.id} style={styles.discCard}>
              <View style={styles.discHeader}>
                <Text style={styles.discCode}>{d.discrepancy_code}</Text>
                <StatusBadge status={d.status} />
              </View>

              <Text style={styles.discDate}>Date: {formatDate(d.business_date)}</Text>

              <View style={styles.discDetailRow}>
                <Text style={styles.discAccount}>
                  Account: {d.account_type === 'CASH' ? 'Cash Safe' : 'Bank'}
                </Text>
                <Text
                  style={[
                    styles.discAmount,
                    { color: d.difference_amount < 0 ? '#DC2626' : '#D97706' },
                  ]}
                >
                  {d.difference_amount < 0 ? 'Shortage: ' : 'Surplus: '}
                  {formatETB(Math.abs(d.difference_amount))}
                </Text>
              </View>

              <View style={styles.expectedActualRow}>
                <Text style={styles.eaText}>Expected: {formatETB(d.expected_amount)}</Text>
                <Text style={styles.eaText}>Actual: {formatETB(d.actual_amount)}</Text>
              </View>

              {d.explanation && (
                <View style={styles.explanationBox}>
                  <Text style={styles.explanationLabel}>Explanation / ማብራሪያ:</Text>
                  <Text style={styles.explanationText}>{d.explanation}</Text>
                </View>
              )}

              {d.status !== 'CLOSED' && (
                <TouchableOpacity
                  style={styles.explainBtn}
                  onPress={() => handleOpenExplain(d)}
                >
                  <Text style={styles.explainBtnText}>Provide / Update Explanation</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Explanation Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Investigation Explanation</Text>
            <Text style={styles.modalSubtitle}>
              Case #{selectedDiscrepancy?.discrepancy_code} (
              {formatETB(selectedDiscrepancy?.difference_amount)})
            </Text>

            <Text style={styles.inputLabel}>Reason / Explanation (የጉድለቱ/የትርፉ ምክንያት) *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              numberOfLines={4}
              placeholder="e.g. Unrecorded purchase expense, counting error, or delayed receipt"
              value={explanation}
              onChangeText={setExplanation}
            />

            <Text style={styles.inputLabel}>Supporting Document / Evidence Reference</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Invoice #2039 or CCTV log timestamp"
              value={evidenceRef}
              onChangeText={setEvidenceRef}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, submitting && styles.btnDisabled]}
                onPress={handleSubmitExplanation}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Submit Explanation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  discCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  discHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  discCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  discDate: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  discDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  discAccount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  discAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  expectedActualRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    marginVertical: 6,
  },
  eaText: {
    fontSize: 12,
    color: '#64748B',
  },
  explanationBox: {
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#D97706',
  },
  explanationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  explanationText: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 2,
  },
  explainBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  explainBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 16,
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
    marginBottom: 12,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 6,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#1E3A8A',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 6,
  },
  btnDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
