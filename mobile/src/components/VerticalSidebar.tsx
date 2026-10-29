import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AppIcon } from './AppIcon';

interface VerticalSidebarProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
}

export const VerticalSidebar: React.FC<VerticalSidebarProps> = ({
  visible,
  onClose,
  navigation,
}) => {
  const { user, logout } = useAuth();
  const role = user?.role || 'recorder';

  const navigateTo = (screenName: string) => {
    onClose();
    navigation.navigate(screenName);
  };

  const handleExitLogout = () => {
    onClose();
    logout();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        {/* Backdrop Tappable to close */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Vertical Left Navbar Panel */}
        <View style={styles.sidebarPanel}>
          {/* Header */}
          <View style={styles.sidebarHeader}>
            <View>
              <View style={styles.brandRow}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={{ width: 28, height: 28, borderRadius: 6, marginRight: 6 }}
                  resizeMode="contain"
                />
                <Text style={styles.brandTitle}>HAMER SHOP</Text>
              </View>
              <Text style={styles.brandSubtitle}>Financial Control & Audit</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
            >
              <AppIcon name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* User Profile Card */}
          <View style={styles.userBadgeCard}>
            <Text style={styles.userName}>
              {user?.full_name || 'User'}
            </Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>
                {role.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Vertical Navigation Links */}
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuList}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigateTo('Dashboard')}
            >
              <AppIcon name="home" size={18} color="#0284C7" />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.navTitle}> Home</Text>
                <Text style={styles.navDesc}>መነሻ ገጽና የቀን ሂሳብ</Text>
              </View>
            </TouchableOpacity>

            {(role === 'manager' || role === 'auditor') && (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigateTo('Analytics')}
              >
                <AppIcon name="trend" size={18} color="#0284C7" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.navTitle}>Financial Trends & Analytics</Text>
                  <Text style={styles.navDesc}>የገንዘብ አዝማሚያዎችና ግራፍ</Text>
                </View>
              </TouchableOpacity>
            )}

            {(role === 'recorder' || role === 'manager' || role === 'auditor') && (
              <>
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => navigateTo('DailyIncome')}
                >
                  <AppIcon name="income" size={18} color="#059669" />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.navTitle}>Record Daily Income</Text>
                    <Text style={styles.navDesc}>የእለት ገቢ መመዝገቢያ</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => navigateTo('DailyExpense')}
                >
                  <AppIcon name="expense" size={18} color="#DC2626" />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.navTitle}>Record Daily Expense</Text>
                    <Text style={styles.navDesc}>የእለት ወጪ መመዝገቢያ</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => navigateTo('DailyClosing')}
                >
                  <AppIcon name="lock" size={18} color="#4F46E5" />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.navTitle}>Daily Closing & Reconciliation</Text>
                    <Text style={styles.navDesc}>የእለት ቆጠራና ማስታረቂያ</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {(role === 'auditor' || role === 'manager') && (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigateTo('ThreeDayAudit')}
              >
                <AppIcon name="clipboard" size={18} color="#D97706" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.navTitle}>Three-Day Audit</Text>
                  <Text style={styles.navDesc}>የሦስት ቀን ኦዲት (Target = 0)</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigateTo('Discrepancies')}
            >
              <AppIcon name="alert" size={18} color="#DC2626" />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.navTitle}>Discrepancy Investigation</Text>
                <Text style={styles.navDesc}>የጉድለትና የትርፍ ምርመራ</Text>
              </View>
            </TouchableOpacity>

            {(role === 'manager' || role === 'auditor') && (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigateTo('Reports')}
              >
                <AppIcon name="activity" size={18} color="#059669" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.navTitle}>Financial & Audit Reports</Text>
                  <Text style={styles.navDesc}>የገንዘብና የኦዲት ሪፖርቶች</Text>
                </View>
              </TouchableOpacity>
            )}



            {/* Settings & Password */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigateTo('Settings')}
            >
              <AppIcon name="settings" size={18} color="#64748B" />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.navTitle}>Settings & Security</Text>
                <Text style={styles.navDesc}>የይለፍ ቃል መቀየሪያና ማስተካከያ</Text>
              </View>
            </TouchableOpacity>

            {role === 'manager' && (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigateTo('UserManagement')}
              >
                <AppIcon name="users" size={18} color="#059669" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.navTitle}>User Management</Text>
                  <Text style={styles.navDesc}>Review registrations and manage roles</Text>
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Bottom Exit / Logout Action */}
          <TouchableOpacity style={styles.exitItem} onPress={handleExitLogout}>
            <AppIcon name="logout" size={16} color="#FCA5A5" />
            <Text style={styles.exitTitle}>Exit System / ውጣ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sidebarPanel: {
    width: 290,
    maxWidth: '85%',
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 45,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#0284C7',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandSubtitle: {
    fontSize: 11,
    marginTop: 2,
    color: '#64748B',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  userBadgeCard: {
    borderRadius: 10,
    padding: 12,
    marginVertical: 14,
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    backgroundColor: '#DBEAFE',
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E40AF',
  },
  menuScroll: {
    flex: 1,
  },
  menuList: {
    paddingVertical: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  navTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  navDesc: {
    fontSize: 10,
    marginTop: 1,
    color: '#64748B',
  },
  exitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#450A0A',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#991B1B',
    marginTop: 10,
  },
  exitTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FCA5A5',
  },
});
