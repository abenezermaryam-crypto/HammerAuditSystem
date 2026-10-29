import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api, getCustomServerUrl, setCustomServerUrl } from '../api/client';
import { AppIcon } from '../components/AppIcon';

export const LoginScreen = () => {
  // Requirement 1: Always require fresh username and password at every login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [resetToken, setResetToken] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'recorder' | 'auditor'>('recorder');
  // Password Recovery state: verifies both username and registered email; code sent by email
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [maskedDestination, setMaskedDestination] = useState('');
  const [devCodeHint, setDevCodeHint] = useState('');
  const { login } = useAuth();
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [currentServerUrl, setCurrentServerUrl] = useState('');
  const [inputServerUrl, setInputServerUrl] = useState('');
  const [serverSaveMessage, setServerSaveMessage] = useState('');

  useEffect(() => {
    getCustomServerUrl().then((url) => {
      setCurrentServerUrl(url);
      setInputServerUrl(url);
    });
  }, []);

  const handleSaveServer = async () => {
    if (!inputServerUrl.trim()) return;
    try {
      const updated = await setCustomServerUrl(inputServerUrl.trim());
      setCurrentServerUrl(updated);
      setServerSaveMessage('Server URL updated successfully!');
      setTimeout(() => {
        setServerSaveMessage('');
        setServerModalVisible(false);
      }, 1000);
    } catch {
      setServerSaveMessage('Failed to save server URL.');
    }
  };

  useEffect(() => {
    const applyResetLink = (url: string) => {
      try {
        const parsedUrl = new URL(url);
        const token = parsedUrl.searchParams.get('resetToken');
        if (token) {
          setResetToken(token);
          setMode('reset');
        }
      } catch {
        setErrorMessage('The password reset link is invalid.');
      }
    };
    if (typeof window !== 'undefined' && window.location?.search) {
      applyResetLink(window.location.href);
    } else {
      Linking.getInitialURL().then((url) => {
        if (url) applyResetLink(url);
      });
    }
    const subscription = Linking.addEventListener('url', ({ url }) => applyResetLink(url));
    return () => subscription.remove();
  }, []);

  const handleLogin = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      await login(username.trim(), password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!fullName.trim() || !phoneNumber.trim() || !username.trim() || !email.trim() || !password) {
      setErrorMessage('Complete all fields to create your account.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const response = await api.register({
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        role,
      });
      setSuccessMessage(response.message || 'Registration received. Wait for Manager approval before signing in.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to register. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    const uName = recoveryUsername.trim();
    const uEmail = recoveryEmail.trim();

    if (!uName) {
      setErrorMessage('Please enter your username / የተጠቃሚ ስም ያስገቡ.');
      return;
    }

    if (!uEmail) {
      setErrorMessage('Please enter your registered email address / የተመዘገበ ኢሜይል ያስገቡ.');
      return;
    }

    if (!uEmail.includes('@') || !uEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address (e.g. you@example.com).');
      return;
    }

    try {
      setLoading(true);
      const response = await api.requestPasswordReset({
        username: uName,
        email: uEmail,
      });

      setSuccessMessage(response.message);
      setMaskedDestination(response.destination || uEmail);
      if (response.dev_code) {
        setDevCodeHint(response.dev_code);
      }
      if (response.reset_token) {
        setResetToken(response.reset_token);
      }
      setMode('reset');
      setPassword('');
      setConfirmPassword('');
      setVerificationCode('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to request password recovery. Please verify your username and email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    const uName = recoveryUsername.trim();
    const uEmail = recoveryEmail.trim();
    if (!uName || !uEmail) {
      setMode('forgot');
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    try {
      setLoading(true);
      const response = await api.requestPasswordReset({
        username: uName,
        email: uEmail,
      });
      setSuccessMessage(response.message);
      if (response.dev_code) {
        setDevCodeHint(response.dev_code);
      }
      if (response.destination) {
        setMaskedDestination(response.destination);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!verificationCode.trim() && !resetToken) {
      setErrorMessage('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your new password.');
      return;
    }

    if (password.length < 10) {
      setErrorMessage('Password must be at least 10 characters with uppercase, lowercase, numbers, and symbols.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please ensure both match.');
      return;
    }

    try {
      setLoading(true);
      const response = await api.resetPassword({
        username: recoveryUsername.trim() || undefined,
        email: recoveryEmail.trim() || undefined,
        code: verificationCode.trim() || undefined,
        token: resetToken || undefined,
        new_password: password,
      });
      setSuccessMessage(response.message || 'Password reset successfully! You can now sign in.');
      setMode('login');
      setUsername(recoveryUsername.trim() || username);
      setResetToken('');
      setPassword('');
      setConfirmPassword('');
      setVerificationCode('');
      setDevCodeHint('');
    } catch (err: any) {
      setErrorMessage(err.message || 'The verification code or reset link could not be used.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Production Brand Header with New Logo */}
        <View style={styles.headerContainer}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <View style={styles.brandBadge}>
            <View style={styles.brandRow}>
              <AppIcon name="store" size={16} color="#38BDF8" />
              <Text style={styles.brandBadgeText}>HAMER SHOP</Text>
            </View>
          </View>
          <Text style={styles.title}>Financial Control System</Text>
          <Text style={styles.amharicSubtitle}>የሐመር ሱቅ የገንዘብና የሦስት ቀን ኦዲት መቆጣጠሪያ</Text>
        </View>

        {/* Secure Credentials Form Card */}
        <View style={styles.formCard}>
          {(mode === 'login' || mode === 'register') && <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}
              onPress={() => { setMode('login'); setErrorMessage(''); setSuccessMessage(''); }}
            >
              <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'register' && styles.modeButtonActive]}
              onPress={() => { setMode('register'); setErrorMessage(''); setSuccessMessage(''); }}
            >
              <Text style={[styles.modeText, mode === 'register' && styles.modeTextActive]}>Create account</Text>
            </TouchableOpacity>
          </View>}
          <Text style={styles.formTitle}>
            {mode === 'login'
              ? 'Welcome back'
              : mode === 'register'
              ? 'Create your account'
              : mode === 'forgot'
              ? 'Password recovery / የይለፍ ቃል መልሶ ማግኛ'
              : 'Choose a new password / አዲስ የይለፍ ቃል ፍጠር'}
          </Text>
          <Text style={styles.formSubtitle}>
            {mode === 'login'
              ? 'Sign in with your approved Recorder, Auditor, or Manager account.'
              : mode === 'register'
              ? 'Register as a Recorder or Auditor. A Manager must approve your account before you can sign in.'
              : mode === 'forgot'
              ? 'Enter your username and registered email. A 6-digit verification code will be sent to your email.'
              : maskedDestination
              ? `Enter the 6-digit verification code sent to ${maskedDestination} and specify your new password.`
              : 'Enter the 6-digit verification code sent to your email and specify your new password.'}
          </Text>

          {successMessage ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>✓ {successMessage}</Text>
            </View>
          ) : null}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <View style={styles.messageRow}>
                <AppIcon name="alert" size={15} color="#991B1B" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            </View>
          ) : null}
          {devCodeHint ? (
            <View style={styles.devCodeBadge}>
              <View style={styles.messageRow}>
                <AppIcon name="key" size={15} color="#B45309" />
                <Text style={styles.devCodeText}>
                  Dev Verification Code: {devCodeHint}
                </Text>
              </View>
            </View>
          ) : null}

          {mode === 'register' ? (
            <>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholder="+251 ..."
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.label}>Choose your role</Text>
              <View style={styles.roleOptions}>
                {(['recorder', 'auditor'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.roleOption, role === option && styles.roleOptionActive]}
                    onPress={() => setRole(option)}
                  >
                    <Text style={[styles.roleOptionText, role === option && styles.roleOptionTextActive]}>
                      {option === 'recorder' ? 'Recorder' : 'Auditor'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          {mode === 'forgot' && (
            <>
              <Text style={styles.label}>Username / የተጠቃሚ ስም</Text>
              <TextInput
                style={styles.input}
                value={recoveryUsername}
                onChangeText={(txt) => {
                  setRecoveryUsername(txt);
                  setErrorMessage('');
                }}
                autoCapitalize="none"
                placeholder="Enter your registered username (e.g. recorder1)"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Registered email address / የተመዘገበ ኢሜይል</Text>
              <TextInput
                style={styles.input}
                value={recoveryEmail}
                onChangeText={(txt) => {
                  setRecoveryEmail(txt);
                  setErrorMessage('');
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.recoveryHelperText}>
                We will verify that both the username and email match your registered account, and dispatch a 6-digit verification code to your email.
              </Text>
            </>
          )}

          {mode === 'reset' && (
            <>
              <Text style={styles.label}>6-digit verification code / ባለ 6-አሃዝ የማረጋገጫ ኮድ</Text>
              <TextInput
                style={styles.input}
                value={verificationCode}
                onChangeText={(txt) => {
                  setVerificationCode(txt);
                  setErrorMessage('');
                }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="Enter 6-digit code (e.g. 123456)"
                placeholderTextColor="#94A3B8"
              />
            </>
          )}

          {/* Username Input */}
          {(mode === 'login' || mode === 'register') && <>
          <Text style={styles.label}>{mode === 'login' ? 'Username or work email' : 'Username'}</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(txt) => {
              setUsername(txt);
              setErrorMessage('');
            }}
            autoCapitalize="none"
            placeholder={mode === 'login' ? 'Enter your username or email' : 'Choose a unique username'}
            placeholderTextColor="#94A3B8"
          />
          </>}

          {/* Password Input with Show/Hide Toggle */}
          {(mode === 'login' || mode === 'register' || mode === 'reset') && <>
          <Text style={styles.label}>{mode === 'login' ? 'Password' : 'New strong password'}</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={(txt) => {
                setPassword(txt);
                setErrorMessage('');
              }}
              secureTextEntry={!showPassword}
              placeholder={mode === 'login' ? 'Enter your password' : 'At least 10 characters'}
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
            >
              <AppIcon name={showPassword ? 'eye' : 'eyeOff'} size={18} color="#475569" />
            </TouchableOpacity>
          </View>
          </>}

          {(mode === 'register' || mode === 'reset') ? (
            <>
              <Text style={styles.passwordHint}>
                Use 10+ characters with uppercase, lowercase, a number, and a symbol.
              </Text>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                placeholder="Re-enter your password"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
            </>
          ) : null}

          {mode === 'login' && (
            <TouchableOpacity onPress={() => { setMode('forgot'); setErrorMessage(''); setSuccessMessage(''); setRecoveryUsername(''); setRecoveryEmail(''); }}>
              <Text style={styles.forgotLink}>Forgot password? / የይለፍ ቃል ረሱ?</Text>
            </TouchableOpacity>
          )}

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : mode === 'forgot' ? handleForgotPassword : handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginBtnText}>
                {mode === 'login'
                  ? 'Sign In / ግባ'
                  : mode === 'register'
                  ? 'Submit registration'
                  : mode === 'forgot'
                  ? 'Send Verification Code to Email / ኮድ በኢሜይል ላክ'
                  : 'Confirm & Reset Password / የይለፍ ቃል ቀይር'}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'reset' && (
            <TouchableOpacity onPress={handleResendCode} style={styles.resendBtn} disabled={loading}>
              <Text style={styles.resendText}>Didn't receive email? Resend code / ኮድ እንደገና በኢሜይል ላክ</Text>
            </TouchableOpacity>
          )}

          {mode === 'reset' && (
            <TouchableOpacity onPress={() => { setMode('forgot'); setErrorMessage(''); setSuccessMessage(''); }}>
              <Text style={styles.backRecoveryLink}>Change username or email</Text>
            </TouchableOpacity>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <TouchableOpacity onPress={() => { setMode('login'); setErrorMessage(''); setSuccessMessage(''); setDevCodeHint(''); }}>
              <Text style={styles.forgotLink}>Back to sign in / ወደ መግቢያ ተመለስ</Text>
            </TouchableOpacity>
          )}

          {/* Server Connection Status & Config Button */}
          <TouchableOpacity
            style={styles.serverPill}
            onPress={() => setServerModalVisible(true)}
          >
            <AppIcon name="settings" size={12} color="#64748B" />
            <Text style={styles.serverPillText} numberOfLines={1}>
              API Server: {currentServerUrl ? currentServerUrl.replace(/^http:\/\//, '').replace(/\/api\/v1$/, '') : 'Configuring...'} (Tap to change)
            </Text>
          </TouchableOpacity>

          {/* Security Notice Footer */}
          <View style={styles.securityFooter}>
            <View style={styles.securityRow}>
              <AppIcon name="shield" size={16} color="#64748B" />
              <Text style={styles.securityText}>
                Hamer Shop Financial Control & Management System
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Server Configuration Modal */}
      <Modal visible={serverModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Backend Server Address</Text>
            <Text style={styles.modalSubtitle}>
              Configure the API server URL where the audit system is running (e.g. your PC LAN IP or HTTPS cloud domain).
            </Text>

            {serverSaveMessage ? (
              <View style={styles.modalSuccessBox}>
                <Text style={styles.modalSuccessText}>{serverSaveMessage}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Server Base URL</Text>
            <TextInput
              style={styles.modalInput}
              value={inputServerUrl}
              onChangeText={setInputServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://172.17.130.100:5000/api/v1"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalResetBtn}
                onPress={() => setInputServerUrl('http://172.17.130.100:5000/api/v1')}
              >
                <Text style={styles.modalResetText}>Reset Default</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveServer}
              >
                <Text style={styles.modalSaveText}>Save & Connect</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setServerModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 80,
  },
  brandLogo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    marginBottom: 12,
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  serverPillText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalSuccessBox: {
    backgroundColor: '#D1FAE5',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  modalSuccessText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 11,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  modalResetBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalResetText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalCloseBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 26,
  },
  brandBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#38BDF8',
    marginBottom: 8,
  },
  brandBadgeText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  amharicSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 26,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 9,
    padding: 3,
    marginBottom: 18,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 7,
  },
  modeButtonActive: {
    backgroundColor: '#1E3A8A',
  },
  modeText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  formTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
  },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  successBox: {
    backgroundColor: '#D1FAE5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  successText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
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
    fontSize: 15,
    marginBottom: 16,
    color: '#0F172A',
  },
  roleOptions: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  roleOption: {
    flex: 1,
    alignItems: 'center',
    padding: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8,
  },
  roleOptionActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#1E3A8A',
  },
  roleOptionText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  roleOptionTextActive: {
    color: '#1E3A8A',
  },
  passwordHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: -7,
    marginBottom: 12,
  },
  forgotLink: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    marginVertical: 12,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rememberText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  loginBtn: {
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  securityFooter: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  securityText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  securityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  recoveryMethodRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  recoveryMethodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  recoveryMethodTabActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1E3A8A',
  },
  recoveryMethodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  recoveryMethodTextActive: {
    color: '#1E3A8A',
    fontWeight: '700',
  },
  recoveryHelperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: -8,
    marginBottom: 16,
    lineHeight: 17,
  },
  devCodeBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  devCodeText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '700',
  },
  resendBtn: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
  },
  resendText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '700',
  },
  backRecoveryLink: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
});
