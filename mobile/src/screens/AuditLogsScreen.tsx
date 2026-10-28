import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { api } from '../api/client';
import { formatDate } from '../utils/currency';
import { AppTopHeader } from '../components/AppTopHeader';
import { AppIcon } from '../components/AppIcon';

export const AuditLogsScreen = ({ navigation }: any) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditTrailLogs(50);
      if (res?.logs) {
        setLogs(res.logs);
      }
    } catch (err: any) {
      console.log('Error loading audit logs:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <AppTopHeader
        title="Immutable Audit Trail (የኦዲት መዝገብ)"
        showBack={true}
        navigation={navigation}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <AppIcon name="shield" size={20} color="#1E3A8A" />
            <Text style={styles.title}>Immutable System Audit Trail</Text>
          </View>
          <Text style={styles.subtitle}>Who changed what, when, why, and authorization logs</Text>
        </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1E3A8A" />
      ) : logs.length === 0 ? (
        <Text style={styles.emptyText}>No audit trail events logged yet.</Text>
      ) : (
        logs.map((log) => (
          <View key={log.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.actionText}>{log.action}</Text>
              <Text style={styles.timeText}>
                {new Date(log.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <Text style={styles.userText}>
              User: {log.user_full_name || 'System'} ({log.user_role || 'SYSTEM'})
            </Text>

            <Text style={styles.entityText}>
              Target: {log.entity_name} #{log.entity_id}
            </Text>

            {log.reason && (
              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Reason:</Text>
                <Text style={styles.reasonText}>{log.reason}</Text>
              </View>
            )}

            <Text style={styles.dateText}>Date: {formatDate(log.created_at)}</Text>
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
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBox: {
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 20,
  },
  logCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8',
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  userText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
    marginTop: 2,
  },
  entityText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  reasonBox: {
    backgroundColor: '#0F172A',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  reasonLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
  },
  reasonText: {
    fontSize: 11,
    color: '#E2E8F0',
    marginTop: 1,
  },
  dateText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 6,
  },
});
