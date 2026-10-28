import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { api } from '../api/client';
import { formatETB, formatDate } from '../utils/currency';
import { StatusBadge } from '../components/StatusBadge';
import { AppTopHeader } from '../components/AppTopHeader';
import { useAuth } from '../context/AuthContext';
import { AppIcon } from '../components/AppIcon';

export const ReportsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'CLOSINGS' | 'INCOMES' | 'EXPENSES'>('CLOSINGS');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [activeTab]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'CLOSINGS') {
        const res = await api.getDailyClosingReport();
        setData(res?.data || []);
      } else if (activeTab === 'INCOMES') {
        const res = await api.getDailyIncomeReport();
        setData(res?.data || []);
      } else if (activeTab === 'EXPENSES') {
        const res = await api.getDailyExpenseReport();
        setData(res?.data || []);
      }
    } catch (err: any) {
      console.log('Error loading reports:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppTopHeader
        title="Financial & Audit Reports (ሪፖርቶች)"
        showBack={true}
        navigation={navigation}
      />
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'CLOSINGS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('CLOSINGS')}
        >
          <Text style={[styles.tabText, activeTab === 'CLOSINGS' && styles.tabTextActive]}>
            Closings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'INCOMES' && styles.tabBtnActive]}
          onPress={() => setActiveTab('INCOMES')}
        >
          <Text style={[styles.tabText, activeTab === 'INCOMES' && styles.tabTextActive]}>
            Income
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'EXPENSES' && styles.tabBtnActive]}
          onPress={() => setActiveTab('EXPENSES')}
        >
          <Text style={[styles.tabText, activeTab === 'EXPENSES' && styles.tabTextActive]}>
            Expenses
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#1E3A8A" style={styles.loader} />
        ) : data.length === 0 ? (
          <Text style={styles.emptyText}>No report records found.</Text>
        ) : (
          data.map((item, idx) => (
            <View key={idx} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <AppIcon name="calendar" size={14} color="#64748B" />
                  <Text style={styles.cardDate}>{formatDate(item.business_date)}</Text>
                </View>
                {item.daily_status && <StatusBadge status={item.daily_status} />}
              </View>

              {activeTab === 'CLOSINGS' && (
                <View style={styles.detailsBox}>
                  <View style={styles.reportRow}>
                    <Text style={styles.label}>Cash Safe:</Text>
                    <Text style={styles.value}>
                      Exp: {formatETB(item.expected_cash)} | Act: {formatETB(item.actual_cash)}
                    </Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.label}>Bank Balance:</Text>
                    <Text style={styles.value}>
                      Exp: {formatETB(item.expected_bank)} | Act: {formatETB(item.actual_bank)}
                    </Text>
                  </View>
                  <Text style={styles.closedBy}>Closed by: {item.closed_by_name}</Text>
                </View>
              )}

              {activeTab === 'INCOMES' && (
                <View style={styles.detailsBox}>
                  <View style={styles.reportRow}>
                    <Text style={styles.label}>{item.description || 'Income'}</Text>
                    <Text style={[styles.value, { color: '#059669', fontWeight: 'bold' }]}>
                      +{formatETB(item.total_income)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <AppIcon name="wallet" size={14} color="#059669" />
                    <Text style={styles.metaText}>Cash: {formatETB(item.cash_income)}</Text>
                    <AppIcon name="landmark" size={14} color="#2563EB" />
                    <Text style={styles.metaText}>Bank: {formatETB(item.bank_income)}</Text>
                  </View>
                </View>
              )}

              {activeTab === 'EXPENSES' && (
                <View style={styles.detailsBox}>
                  <View style={styles.reportRow}>
                    <Text style={styles.label}>{item.description}</Text>
                    <Text style={[styles.value, { color: '#DC2626', fontWeight: 'bold' }]}>
                      -{formatETB(item.amount)}
                    </Text>
                  </View>
                  <Text style={styles.metaText}>Source: {item.payment_source}</Text>
                </View>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#EFF6FF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#1E3A8A',
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loader: {
    marginTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 30,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  value: {
    fontSize: 13,
    color: '#0F172A',
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  closedBy: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 6,
  },
  auditLogBtn: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  auditLogBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
