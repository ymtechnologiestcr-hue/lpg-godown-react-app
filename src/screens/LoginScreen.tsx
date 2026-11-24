import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackdrop } from '../components/auth/AuthBackdrop';
import { showToast } from '../components/common/ToastManager';
import { AppRole } from '../constants/appRole';
import { isSupportedMobileRole } from '../constants/auth';
import { AUTH_COLORS } from '../constants/authTheme';
import { useAuth } from '../context/AuthContext';
import {
  identifyAuthMethod,
  loginWithPassword,
} from '../services/authService';

type AuthStep = 'IDENTIFIER' | 'PASSWORD';

export default function LoginScreen() {
  const router = useRouter();
  const { login, setSplashCompleted, setLoginTransitionActive } = useAuth();

  const [step, setStep] = useState<AuthStep>('IDENTIFIER');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [masked, setMasked] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [identifierFocused, setIdentifierFocused] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleChangeEmail = () => {
    setPassword('');
    setShowPassword(false);
    setMasked('');
    setStep('IDENTIFIER');
  };

  const handleIdentify = async () => {
    if (!identifier.trim()) {
      showToast('Enter email or phone number', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await identifyAuthMethod(identifier.trim());
      if (res.data?.role && !isSupportedMobileRole(res.data.role as any)) {
        showToast(`Role "${res.data.role}" is not supported. Use the cashier/admin web app.`, 'error');
        return;
      }
      setMasked(res.data?.masked || '');
      setStep('PASSWORD');
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Unable to identify user';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = async (payload: {
    token: string;
    user: { id: number; role: AppRole; name: string; email: string; phone: string };
  }) => {
    if (!isSupportedMobileRole(payload.user.role)) {
      showToast(`Role "${payload.user.role}" is not supported on this app.`, 'error');
      return;
    }

    setSplashCompleted(true);
    setLoginTransitionActive(true);
    await login(payload.token, payload.user as any);
    showToast('Login successful!', 'success');
    router.replace('/login-success' as never);
  };

  const handlePasswordLogin = async () => {
    if (!password.trim()) {
      showToast('Enter password', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await loginWithPassword(identifier.trim(), password);
      if (res.success && res.token && res.user) {
        await completeLogin({ token: res.token, user: res.user as any });
      } else {
        showToast(res.message || 'Login failed', 'error');
      }
    } catch (error: any) {
      setLoginTransitionActive(false);
      const message = error?.response?.data?.message || error?.message || 'Unable to login with password';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackdrop>
      <StatusBar barStyle="dark-content" backgroundColor={AUTH_COLORS.background} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              keyboardVisible && styles.scrollContentWithKeyboard,
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.brandHeader}>
              <View style={styles.brandIcon}>
                <Ionicons name="flame" size={24} color={AUTH_COLORS.brandRed} />
              </View>
              <View style={styles.brandCopy}>
                <View style={styles.brandNameRow}>
                  <Text style={styles.brandName}>LPG Mitra</Text>
                  <Ionicons name="checkmark-circle" size={15} color={AUTH_COLORS.accentBlue} />
                </View>
                <Text style={styles.brandCaption}>Smart LPG distribution &amp; stock tracking</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>{step === 'IDENTIFIER' ? 'Welcome back' : 'Enter your password'}</Text>
              <Text style={styles.subtitle}>Driver, Godown Manager, Purchase Manager</Text>

              <Text style={styles.label}>Email or phone</Text>
              <TextInput
                style={[styles.input, identifierFocused && styles.inputFocused]}
                value={identifier}
                onChangeText={setIdentifier}
                editable={step === 'IDENTIFIER'}
                placeholder="Enter email or phone"
                placeholderTextColor={AUTH_COLORS.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType={step === 'IDENTIFIER' ? 'go' : 'next'}
                onFocus={() => setIdentifierFocused(true)}
                onBlur={() => setIdentifierFocused(false)}
                onSubmitEditing={step === 'IDENTIFIER' ? handleIdentify : undefined}
              />

              {step === 'IDENTIFIER' && (
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleIdentify}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? <ActivityIndicator color={AUTH_COLORS.white} /> : (
                    <>
                      <Text style={styles.buttonText}>Continue</Text>
                      <Ionicons name="arrow-forward" size={18} color={AUTH_COLORS.white} />
                    </>
                  )}
                </TouchableOpacity>
              )}

              {step === 'PASSWORD' && (
                <>
                  <View style={styles.accountRow}>
                    <Ionicons name="person-circle-outline" size={17} color={AUTH_COLORS.secondary} />
                    <Text style={styles.info}>Signing in as {masked || identifier}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.changeEmailButton}
                    onPress={handleChangeEmail}
                    disabled={loading}
                    accessibilityRole="button"
                  >
                    <Text style={styles.linkText}>Change email</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      placeholder="Enter password"
                      placeholderTextColor={AUTH_COLORS.muted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="go"
                      onSubmitEditing={handlePasswordLogin}
                    />
                    <TouchableOpacity
                      style={styles.passwordVisibilityButton}
                      onPress={() => setShowPassword((visible) => !visible)}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      accessibilityState={{ selected: showPassword }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={21}
                        color={AUTH_COLORS.secondary}
                      />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handlePasswordLogin}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    {loading ? <ActivityIndicator color={AUTH_COLORS.white} /> : (
                      <Text style={styles.buttonText}>Login</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
        </ScrollView>
      </SafeAreaView>
    </AuthBackdrop>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 28,
  },
  scrollContentWithKeyboard: {
    justifyContent: 'flex-start',
    paddingTop: 12,
    paddingBottom: 20,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    paddingHorizontal: 3,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandCopy: {
    flex: 1,
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandName: {
    color: AUTH_COLORS.navy,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
  },
  brandCaption: {
    color: AUTH_COLORS.secondary,
    fontSize: 10,
    lineHeight: 15,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#25354A',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 5,
  },
  title: {
    color: AUTH_COLORS.navy,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: AUTH_COLORS.secondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 22,
  },
  label: {
    color: AUTH_COLORS.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    marginBottom: 7,
  },
  input: {
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AUTH_COLORS.secondary,
    backgroundColor: AUTH_COLORS.white,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
    color: AUTH_COLORS.text,
    marginBottom: 15,
  },
  inputFocused: {
    borderColor: AUTH_COLORS.brandRed,
    backgroundColor: AUTH_COLORS.white,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
    marginBottom: 1,
  },
  info: {
    color: AUTH_COLORS.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
  changeEmailButton: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
    marginBottom: 13,
  },
  linkText: {
    color: AUTH_COLORS.brandRed,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  passwordInputContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordVisibilityButton: {
    position: 'absolute',
    right: 7,
    top: 0,
    height: 50,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.brandRed,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    marginTop: 5,
    shadowColor: AUTH_COLORS.brandRedDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: AUTH_COLORS.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
});
