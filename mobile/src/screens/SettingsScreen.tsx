import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { AppTopHeader } from '../components/AppTopHeader';
import { AppIcon } from '../components/AppIcon';

export const SettingsScreen = ({ navigation }: any) => {
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    phone_number: user?.phone_number || '',
    username: user?.username || '',
    email: user?.email || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleUpdateProfile = async () => {
    setMessage(null);
    try {
      setSavingProfile(true);
      const response = await api.updateOwnProfile(profile);
      updateUser(response.user);
      setProfile({
        full_name: response.user.full_name,
        phone_number: response.user.phone_number || '',
        username: response.user.username,
        email: response.user.email,
      });
      setMessage({ text: 'Profile updated successfully.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update profile.', type: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setMessage(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ text: 'Please fill in all password fields.', type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ text: 'New password and confirm password do not match.', type: 'error' });
      return;
    }

    if (
      newPassword.length < 10
      || !/[a-z]/.test(newPassword)
      || !/[A-Z]/.test(newPassword)
      || !/\d/.test(newPassword)
      || !/[^A-Za-z0-9\s]/.test(newPassword)
    ) {
      setMessage({
        text: 'Use at least 10 characters with uppercase, lowercase, a number, and a symbol.',
        type: 'error',
      });
      return;
    }

    try {
      setSavingPassword(true);
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setMessage({ text: 'Password successfully updated! You can now use your new password.', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update password.', type: 'error' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <AppTopHeader
        title="Settings & System Security (ማስተካከያ)"
        showBack={true}
        navigation={navigation}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Active Account Profile Banner */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <AppIcon name="users" size={17} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Active User Profile</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Full Name:</Text>
            <Text style={styles.profileVal}>{user?.full_name}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Username:</Text>
            <Text style={styles.profileVal}>{user?.username}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>System Role:</Text>
            <Text style={[styles.profileVal, styles.roleHighlight]}>
              {user?.role?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Work Email:</Text>
            <Text style={styles.profileVal}>{user?.email}</Text>
          </View>
        </View>

        {user?.role === 'manager' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Edit Manager Profile</Text>
            <Text style={styles.cardSubtitle}>Update your name, phone, username, or email. Your Manager role cannot be changed here.</Text>
            {([
              ['full_name', 'Full name', 'default'],
              ['phone_number', 'Phone number', 'phone-pad'],
              ['username', 'Username', 'default'],
              ['email', 'Email address', 'email-address'],
            ] as Array<[keyof typeof profile, string, 'default' | 'phone-pad' | 'email-address']>).map(([field, label, keyboardType]) => (
              <View key={field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={profile[field]}
                  onChangeText={(value) => setProfile((current) => ({ ...current, [field]: value }))}
                  autoCapitalize={field === 'username' || field === 'email' ? 'none' : 'words'}
                  keyboardType={keyboardType}
                />
              </View>
            ))}
            <TouchableOpacity
              style={[styles.saveBtn, savingProfile && styles.btnDisabled]}
              onPress={handleUpdateProfile}
              disabled={savingProfile}
            >
              {savingProfile ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Change Password Independently */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <AppIcon name="lock" size={17} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Change Password Independently</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Update your account password securely (የይለፍ ቃል መቀየሪያ)
          </Text>

          {message && (
            <View
              style={[
                styles.messageBox,
                message.type === 'success' ? styles.msgSuccess : styles.msgError,
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppIcon name={message.type === 'success' ? 'check' : 'alert'} size={15}
                  color={message.type === 'success' ? '#065F46' : '#991B1B'} />
                <Text
                  style={[
                    styles.msgText,
                    message.type === 'success' ? styles.textSuccess : styles.textError,
                  ]}
                >
                  {message.text}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.label}>Current Password (አሁን ያለው የይለፍ ቃል)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrent}
              placeholder="••••••••••••"
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowCurrent(!showCurrent)}
            >
              <AppIcon name={showCurrent ? 'eye' : 'eyeOff'} size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>New Password (አዲሱ የይለፍ ቃል)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
              placeholder="10+ characters, upper/lowercase, number, symbol"
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowNew(!showNew)}
            >
              <AppIcon name={showNew ? 'eye' : 'eyeOff'} size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm New Password (አዲሱን ደግመው ያረጋግጡ)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showNew}
              placeholder="Re-type new password"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, savingPassword && styles.btnDisabled]}
            onPress={handleChangePassword}
            disabled={savingPassword}
          >
            {savingPassword ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Update Password / የይለፍ ቃል ቀይር</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Store & Financial Configurations */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <AppIcon name="store" size={17} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Store & Accounting Settings</Text>
          </View>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Store Name:</Text>
            <Text style={styles.settingVal}>Hamer Shop (የሐመር ሱቅ)</Text>
          </View>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Base Currency:</Text>
            <Text style={styles.settingVal}>ETB (Ethiopian Birr)</Text>
          </View>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Number Precision:</Text>
            <Text style={styles.settingVal}>2 Decimals (Exact DECIMAL 14,2)</Text>
          </View>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Audit Cycle Length:</Text>
            <Text style={styles.settingVal}>3 Consecutive Operating Days (የሦስት ቀን)</Text>
          </View>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Ledger Isolation:</Text>
            <Text style={[styles.settingVal, { color: '#059669', fontWeight: 'bold' }]}>
              Safe Cash & Bank are strictly isolated
            </Text>
          </View>
        </View>

        {/* Direct Session Exit / Logout */}
        <TouchableOpacity style={styles.exitBtn} onPress={logout}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <AppIcon name="logout" size={16} color="#FCA5A5" />
            <Text style={styles.exitBtnText}>Exit System & Sign Out / ውጣ</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  profileVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  roleHighlight: {
    color: '#1E3A8A',
    fontWeight: '800',
  },
  messageBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderLeftWidth: 4,
  },
  msgSuccess: {
    backgroundColor: '#DCFCE7',
    borderLeftColor: '#166534',
  },
  msgError: {
    backgroundColor: '#FEE2E2',
    borderLeftColor: '#DC2626',
  },
  msgText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSuccess: {
    color: '#166534',
  },
  textError: {
    color: '#991B1B',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    marginBottom: 12,
  },
  inputFlex: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 11,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  eyeBtn: {
    paddingHorizontal: 12,
  },
  eyeText: {
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  settingLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  settingVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  exitBtn: {
    backgroundColor: '#450A0A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#991B1B',
    marginTop: 8,
  },
  exitBtnText: {
    color: '#FCA5A5',
    fontSize: 15,
    fontWeight: '800',
  },
});
