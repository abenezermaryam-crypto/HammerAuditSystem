import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api/client';
import { AppTopHeader } from '../components/AppTopHeader';
import { ManagedUser, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

type ProfileForm = {
  full_name: string;
  phone_number: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
};

const emptyForm: ProfileForm = {
  full_name: '',
  phone_number: '',
  username: '',
  email: '',
  password: '',
  role: 'recorder',
};

export const UserManagementScreen = ({ navigation }: any) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const response = await api.getUsers();
      setUsers(response.users);
    } catch (err: any) {
      setError(err.message || 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const editUser = (user: ManagedUser) => {
    setEditingId(user.id);
    setForm({
      full_name: user.full_name,
      phone_number: user.phone_number || '',
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
    });
    setError('');
    setMessage('');
  };

  const submitForm = async () => {
    setError('');
    setMessage('');
    if (!form.full_name.trim() || !form.phone_number.trim() || !form.username.trim() || !form.email.trim()) {
      setError('Complete the name, phone, username, and email fields.');
      return;
    }
    if (!editingId && !form.password) {
      setError('A strong password is required for new users.');
      return;
    }
    try {
      setSaving(true);
      const profile = {
        full_name: form.full_name,
        phone_number: form.phone_number,
        username: form.username,
        email: form.email,
        role: form.role,
      };
      if (editingId) {
        await api.updateUser(editingId, {
          ...profile,
          ...(form.password ? { password: form.password } : {}),
        });
        setMessage('User details updated.');
      } else {
        await api.createUser({ ...profile, password: form.password });
        setMessage('User created and approved.');
      }
      resetForm();
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Unable to save user.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: () => Promise<any>, successMessage: string) => {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Unable to update user.');
    }
  };

  const confirmRemove = (user: ManagedUser) => {
    const remove = () => runAction(() => api.removeUser(user.id), 'User deactivated.');
    const prompt = `Deactivate ${user.full_name}? Their audit history will be retained.`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(prompt)) remove();
      return;
    }
    Alert.alert('Remove user', prompt, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: remove },
    ]);
  };

  const updateField = (field: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <View style={styles.screen}>
      <AppTopHeader title="User Management" navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{editingId ? 'Edit user' : 'Add a user'}</Text>
          <Text style={styles.subtitle}>
            Managers can assign Recorder, Auditor, or Manager access. New Manager-created accounts are approved immediately.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}
          {([
            ['full_name', 'Full name'],
            ['phone_number', 'Phone number'],
            ['username', 'Username'],
            ['email', 'Email address'],
            ['password', editingId ? 'New password (optional)' : 'Strong password'],
          ] as Array<[keyof ProfileForm, string]>).map(([field, label]) => (
            <View key={field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={form[field]}
                onChangeText={(value) => updateField(field, value)}
                placeholder={label}
                autoCapitalize={field === 'email' || field === 'username' ? 'none' : 'words'}
                keyboardType={field === 'email' ? 'email-address' : field === 'phone_number' ? 'phone-pad' : 'default'}
                secureTextEntry={field === 'password'}
              />
            </View>
          ))}
          <Text style={styles.label}>Role</Text>
          <View style={styles.roleRow}>
            {(['recorder', 'auditor', 'manager'] as UserRole[]).map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.roleButton, form.role === role && styles.roleButtonActive]}
                onPress={() => setForm((current) => ({ ...current, role }))}
              >
                <Text style={[styles.roleButtonText, form.role === role && styles.roleButtonTextActive]}>
                  {role.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.primaryButton} disabled={saving} onPress={submitForm}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{editingId ? 'Save changes' : 'Create user'}</Text>}
            </TouchableOpacity>
            {editingId ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={resetForm}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.title}>Accounts</Text>
          <TouchableOpacity onPress={loadUsers}><Text style={styles.refresh}>Refresh</Text></TouchableOpacity>
        </View>
        {loading ? <ActivityIndicator size="large" color="#1E3A8A" /> : users.map((user) => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userHeading}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.full_name}</Text>
                <Text style={styles.userDetail}>@{user.username} · {user.email}</Text>
                <Text style={styles.userDetail}>{user.phone_number || 'No phone number'} · {user.role.toUpperCase()}</Text>
              </View>
              <Text style={[styles.status, !user.is_active ? styles.inactive : user.is_approved ? styles.approved : styles.pending]}>
                {!user.is_active ? 'INACTIVE' : user.is_approved ? 'APPROVED' : 'PENDING'}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.smallButton} onPress={() => editUser(user)}>
                <Text style={styles.smallButtonText}>Edit</Text>
              </TouchableOpacity>
              {!user.is_approved && user.is_active ? (
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => runAction(() => api.approveUser(user.id), 'Registration approved.')}
                >
                  <Text style={styles.smallButtonText}>Approve</Text>
                </TouchableOpacity>
              ) : null}
              {user.is_active ? (
                user.id !== currentUser?.id ? (
                  <TouchableOpacity
                    style={[styles.smallButton, styles.removeButton]}
                    onPress={() => confirmRemove(user)}
                  >
                    <Text style={styles.smallButtonText}>Remove</Text>
                  </TouchableOpacity>
                ) : null
              ) : (
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => runAction(() => api.activateUser(user.id), 'User reactivated.')}
                >
                  <Text style={styles.smallButtonText}>Reactivate</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 40, maxWidth: 900, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 22, borderWidth: 1, borderColor: '#E2E8F0' },
  title: { color: '#0F172A', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 14 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 5 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 11, color: '#0F172A' },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 3 },
  roleButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  roleButtonActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  roleButtonText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  roleButtonTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', marginTop: 12 },
  primaryButton: { backgroundColor: '#1E3A8A', padding: 12, borderRadius: 8, minWidth: 130, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryButton: { padding: 12, marginLeft: 8 },
  secondaryText: { color: '#475569', fontWeight: '700' },
  error: { color: '#991B1B', backgroundColor: '#FEE2E2', padding: 10, borderRadius: 7, marginBottom: 6 },
  success: { color: '#065F46', backgroundColor: '#D1FAE5', padding: 10, borderRadius: 7, marginBottom: 6 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  refresh: { color: '#1D4ED8', fontWeight: '700' },
  userCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 14, marginBottom: 10 },
  userHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userInfo: { flex: 1, paddingRight: 8 },
  userName: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  userDetail: { color: '#64748B', fontSize: 12, marginTop: 4 },
  status: { fontSize: 10, fontWeight: '800', borderRadius: 5, overflow: 'hidden', padding: 5 },
  approved: { color: '#065F46', backgroundColor: '#D1FAE5' },
  pending: { color: '#92400E', backgroundColor: '#FEF3C7' },
  inactive: { color: '#991B1B', backgroundColor: '#FEE2E2' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  smallButton: { backgroundColor: '#E2E8F0', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 6, marginRight: 7, marginBottom: 4 },
  removeButton: { backgroundColor: '#FEE2E2' },
  smallButtonText: { color: '#1E293B', fontSize: 12, fontWeight: '700' },
});
