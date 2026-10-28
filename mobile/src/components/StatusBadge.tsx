import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppIcon, AppIconName } from './AppIcon';

interface StatusBadgeProps {
  status: string;
  type?: 'CASH' | 'BANK' | 'GENERAL';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let bg = '#E5E7EB';
  let textColor = '#374151';
  let icon: AppIconName = 'activity';

  switch (status) {
    case 'BALANCED':
      bg = '#DCFCE7';
      textColor = '#166534';
      icon = 'check';
      break;
    case 'SHORTAGE':
      bg = '#FEE2E2';
      textColor = '#991B1B';
      icon = 'alert';
      break;
    case 'SURPLUS':
      bg = '#FEF3C7';
      textColor = '#92400E';
      icon = 'alert';
      break;
    case 'DISCREPANCY':
    case 'DISCREPANCY_FOUND':
    case 'CASH_DISCREPANCY':
    case 'BANK_DISCREPANCY':
    case 'DUAL_DISCREPANCY':
      bg = '#FEE2E2';
      textColor = '#B91C1C';
      icon = 'alert';
      break;
    case 'OPEN':
      bg = '#DBEAFE';
      textColor = '#1E40AF';
      icon = 'activity';
      break;
    case 'CLOSED':
    case 'AUDITED':
      bg = '#F3E8FF';
      textColor = '#6B21A8';
      icon = 'lock';
      break;
    case 'IN_INVESTIGATION':
      bg = '#FFEDD5';
      textColor = '#C2410C';
      icon = 'activity';
      break;
    case 'RESOLVED':
    case 'ADJUSTED_RESOLVED':
      bg = '#D1FAE5';
      textColor = '#065F46';
      icon = 'check';
      break;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={styles.content}>
        <AppIcon name={icon} size={14} color={textColor} />
        <Text style={[styles.text, { color: textColor }]}>{status.replace(/_/g, ' ')}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
