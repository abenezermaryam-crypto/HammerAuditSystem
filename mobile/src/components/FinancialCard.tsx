import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatETB } from '../utils/currency';
import { StatusBadge } from './StatusBadge';
import { AppIcon } from './AppIcon';
import { useTheme } from '../context/ThemeContext';

interface FinancialCardProps {
  title: string;
  accountType: 'CASH' | 'BANK';
  openingBalance: number;
  expectedBalance: number;
  actualBalance?: number;
  difference?: number;
  status: string;
}

export const FinancialCard: React.FC<FinancialCardProps> = ({
  title,
  accountType,
  openingBalance,
  expectedBalance,
  actualBalance,
  difference,
  status,
}) => {
  const { theme, isDark } = useTheme();
  const isCash = accountType === 'CASH';
  const themeColor = isCash ? '#10B981' : '#38BDF8';

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: theme.card,
        borderLeftColor: themeColor,
        borderWidth: 1,
        borderColor: theme.cardBorder,
      }
    ]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <AppIcon name={isCash ? 'wallet' : 'landmark'} size={18} color={themeColor} />
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        </View>
        <StatusBadge status={status} />
      </View>

      <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: theme.textSub }]}>Opening</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>{formatETB(openingBalance)}</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: theme.textSub }]}>Expected</Text>
          <Text style={[styles.metricValue, { color: isDark ? '#38BDF8' : '#1E3A8A', fontWeight: 'bold' }]}>
            {formatETB(expectedBalance)}
          </Text>
        </View>
      </View>

      {actualBalance !== undefined && (
        <View style={[styles.actualRow, { borderTopColor: theme.cardBorder }]}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: theme.textSub }]}>Actual Verified</Text>
            <Text style={[styles.metricValue, { color: theme.text, fontWeight: '700' }]}>
              {formatETB(actualBalance)}
            </Text>
          </View>

          {difference !== undefined && difference !== 0 && (
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: theme.textSub }]}>Variance</Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color: difference < 0 ? '#EF4444' : '#10B981',
                    fontWeight: 'bold',
                  },
                ]}
              >
                {difference < 0 ? '-' : '+'}
                {formatETB(Math.abs(difference))}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actualRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
  },
});
