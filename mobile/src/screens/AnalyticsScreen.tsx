import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { api } from '../api/client';
import { FinancialTrendPoint, DiscrepancyMetrics, TimeframeType } from '../types';
import { formatETB } from '../utils/currency';
import { InteractiveTrendChart } from '../components/InteractiveTrendChart';
import { AppTopHeader } from '../components/AppTopHeader';
import { AppIcon } from '../components/AppIcon';
import { useTheme } from '../context/ThemeContext';

export const AnalyticsScreen = ({ navigation }: any) => {
  const { theme, isDark } = useTheme();
  const [timeframe, setTimeframe] = useState<TimeframeType>('daily');
  const [trendData, setTrendData] = useState<FinancialTrendPoint[]>([]);
  const [metrics, setMetrics] = useState<DiscrepancyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    loadAnalytics();
  }, [timeframe]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [trendRes, metricRes] = await Promise.all([
        api.getFinancialTrends(timeframe),
        api.getDiscrepancyMetrics(),
      ]);

      if (trendRes?.data) {
        setTrendData(trendRes.data);
      }
      if (metricRes?.metrics) {
        setMetrics(metricRes.metrics);
      }
    } catch (err: any) {
      console.log('Error loading analytics:', err.message);
      setTrendData([]);
      setLoadError(err.message || 'Unable to load analytics. Check the backend connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  // Compute period totals
  const totalIncomeSum = trendData.reduce((s, p) => s + (p.totalIncome || 0), 0);
  const totalExpenseSum = trendData.reduce((s, p) => s + (p.totalExpense || 0), 0);
  const netRetained = totalIncomeSum - totalExpenseSum;

  const timeframeLabels: Record<TimeframeType, string> = {
    daily: 'Daily Operational Trajectory (የእለት አዝማሚያ)',
    '3day': 'Three-Day Periodic Audits (የሦስት ቀን ኦዲት ዑደት)',
    weekly: 'Weekly Aggregated Flow (የሳምንት ድምር)',
    monthly: 'Monthly Performance (የወር ማጠቃለያ)',
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppTopHeader
        title="Financial Trends & Analytics (አዝማሚያዎች)"
        showBack={true}
        navigation={navigation}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.bg }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <AppIcon name="trend" size={20} color={isDark ? '#38BDF8' : '#0284C7'} />
            <Text style={[styles.title, { color: theme.text }]}>Financial Control Trends & Analytics</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Interactive cash flow, bank movements, and audit variance metrics
          </Text>
        </View>

        {/* Timeframe Segmented Selector */}
        <View style={[styles.timeframeSelector, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
          {(['daily', '3day', 'weekly', 'monthly'] as TimeframeType[]).map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[
                styles.timeframeBtn,
                timeframe === tf && [styles.timeframeBtnActive, { backgroundColor: isDark ? '#2563EB' : '#1E3A8A' }],
              ]}
              onPress={() => setTimeframe(tf)}
            >
              <Text
                style={[
                  styles.timeframeText,
                  { color: timeframe === tf ? '#FFFFFF' : (isDark ? '#94A3B8' : '#475569') },
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

        {/* Period KPI Summary Banner */}
        {loadError ? <Text style={styles.loadError}>{loadError}</Text> : null}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: '#10B981' }]}>
            <Text style={[styles.kpiLabel, { color: theme.textSub }]}>Total Period Income</Text>
            <Text style={[styles.kpiValue, { color: '#10B981' }]}>
              {formatETB(totalIncomeSum)}
            </Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: '#EF4444' }]}>
            <Text style={[styles.kpiLabel, { color: theme.textSub }]}>Total Period Expenses</Text>
            <Text style={[styles.kpiValue, { color: '#EF4444' }]}>
              {formatETB(totalExpenseSum)}
            </Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: '#3B82F6' }]}>
            <Text style={[styles.kpiLabel, { color: theme.textSub }]}>Net Retained Funds</Text>
            <Text style={[styles.kpiValue, { color: netRetained >= 0 ? (isDark ? '#60A5FA' : '#1E40AF') : '#EF4444' }]}>
              {formatETB(netRetained)}
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.accent} style={styles.loader} />
        ) : (
          <>
            {/* Chart 1: Income vs Expense Trajectory */}
            <InteractiveTrendChart
              data={trendData}
              chartType="INCOME_EXPENSE"
              timeframeLabel={timeframeLabels[timeframe]}
              emptyMessage={timeframe === '3day'
                ? 'No three-day audits have been submitted yet. Daily income and expense totals remain available in Daily, Weekly, and Monthly views.'
                : 'No business-day records are available for this timeframe.'}
            />

            {/* Chart 2: Cash Safe vs Bank Liquidity Breakdown */}
            <InteractiveTrendChart
              data={trendData}
              chartType="LIQUIDITY_TREND"
              timeframeLabel={timeframeLabels[timeframe]}
              emptyMessage={timeframe === '3day'
                ? 'No three-day audits have been submitted yet.'
                : 'No business-day records are available for this timeframe.'}
            />

            {/* Audit Discrepancy & Variance Analytics Card */}
            {metrics && (
              <View style={[styles.varianceCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <AppIcon name="shield" size={17} color={isDark ? '#94A3B8' : '#475569'} />
                  <Text style={[styles.varianceTitle, { color: theme.text }]}>Audit Discrepancy & Risk Metrics</Text>
                </View>
                <Text style={[styles.varianceSubtitle, { color: theme.textMuted }]}>
                  Historical shortage & surplus monitoring
                </Text>

                <View style={styles.metricsGrid}>
                  <View style={[styles.metricBox, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                    <Text style={[styles.metricNum, { color: theme.text }]}>{metrics.totalCases}</Text>
                    <Text style={[styles.metricDesc, { color: theme.textMuted }]}>Total Cases</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                    <Text style={[styles.metricNum, { color: '#EF4444' }]}>
                      {metrics.openCases}
                    </Text>
                    <Text style={[styles.metricDesc, { color: theme.textMuted }]}>Open Shortages</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                    <Text style={[styles.metricNum, { color: '#F59E0B' }]}>
                      {metrics.investigatingCases}
                    </Text>
                    <Text style={[styles.metricDesc, { color: theme.textMuted }]}>In Investigation</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                    <Text style={[styles.metricNum, { color: '#10B981' }]}>
                      {metrics.resolvedCases}
                    </Text>
                    <Text style={[styles.metricDesc, { color: theme.textMuted }]}>Resolved</Text>
                  </View>
                </View>

                <View style={[styles.discrepancyAmountsRow, { borderTopColor: theme.cardBorder }]}>
                  <View style={styles.discAmountCol}>
                    <Text style={[styles.discLabel, { color: theme.textSub }]}>Cumulative Cash Shortage (ጉድለት):</Text>
                    <Text style={[styles.discAmount, { color: '#EF4444' }]}>
                      -{formatETB(metrics.totalShortageETB)}
                    </Text>
                  </View>

                  <View style={styles.discAmountCol}>
                    <Text style={[styles.discLabel, { color: theme.textSub }]}>Cumulative Cash Surplus (ትርፍ):</Text>
                    <Text style={[styles.discAmount, { color: '#F59E0B' }]}>
                      +{formatETB(metrics.totalSurplusETB)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  timeframeSelector: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  timeframeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  timeframeBtnActive: {},
  timeframeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadError: {
    color: '#991B1B',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 3,
    borderTopWidth: 3,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  loader: {
    marginTop: 30,
  },
  varianceCard: {
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 1,
  },
  varianceTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  varianceSubtitle: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  metricNum: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricDesc: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  discrepancyAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  discAmountCol: {
    flex: 1,
  },
  discLabel: {
    fontSize: 11,
  },
  discAmount: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
});
