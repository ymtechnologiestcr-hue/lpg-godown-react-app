import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { APP_ROLE_KEY, AppRole } from '../constants/appRole';
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  getHomeRouteByRole,
  isSupportedMobileRole,
} from '../constants/auth';
import { DS, TYPO, RADIUS, WEIGHT } from '../constants/designSystem';
import {
  identifyAuthMethod,
  loginWithPassword,
  requestOtp,
  verifyOtp,
} from '../services/authService';

type AuthStep = 'IDENTIFIER' | 'METHOD' | 'PASSWORD' | 'OTP';

export default function LoginScreen() {
  const router = useRouter();

  const [step, setStep] = useState<AuthStep>('IDENTIFIER');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [masked, setMasked] = useState('');
  const [availablePassword, setAvailablePassword] = useState(false);
  const [availableOtp, setAvailableOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleIdentify = async () => {
    if (!identifier.trim()) {
      Alert.alert('Required', 'Enter email or phone number');
      return;
    }

    try {
      setLoading(true);
      const res = await identifyAuthMethod(identifier.trim());
      setMasked(res.data?.masked || '');
      setAvailablePassword(Boolean(res.data?.availableMethods?.password));
      setAvailableOtp(Boolean(res.data?.availableMethods?.otp));
      setStep('METHOD');
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Unable to identify user';
      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = async (payload: {
    token: string;
    user: { id: number; role: AppRole; name: string; email: string; phone: string };
  }) => {
    if (!isSupportedMobileRole(payload.user.role)) {
      Alert.alert('Unsupported role', 'Use cashier web app for CASHIER login.');
      return;
    }

    await AsyncStorage.setItem(AUTH_TOKEN_KEY, payload.token);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(payload.user));
    await AsyncStorage.setItem(APP_ROLE_KEY, payload.user.role);

    router.replace(getHomeRouteByRole(payload.user.role) as never);
  };

  const handlePasswordLogin = async () => {
    if (!password.trim()) {
      Alert.alert('Required', 'Enter password');
      return;
    }

    try {
      setLoading(true);
      const res = await loginWithPassword(identifier.trim(), password);
      if (res.success) {
        await completeLogin({ token: res.token, user: res.user as any });
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Unable to login with password';
      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    try {
      setLoading(true);
      await requestOtp(identifier.trim());
      setStep('OTP');
      Alert.alert('OTP sent', 'Enter the OTP to continue.');
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Unable to send OTP';
      Alert.alert('OTP failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert('Required', 'Enter OTP');
      return;
    }

    try {
      setLoading(true);
      const res = await verifyOtp(identifier.trim(), otp.trim());
      if (res.success) {
        await completeLogin({ token: res.token, user: res.user as any });
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Invalid OTP';
      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>LPG Role Login</Text>
        <Text style={styles.subtitle}>Driver, Godown Manager, Purchase Manager</Text>

        {(step === 'IDENTIFIER' || step === 'METHOD' || step === 'PASSWORD' || step === 'OTP') && (
          <>
            <Text style={styles.label}>Email or Phone</Text>
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
              editable={step === 'IDENTIFIER'}
              placeholder="Enter email or phone"
              autoCapitalize="none"
            />
          </>
        )}

        {step === 'IDENTIFIER' && (
          <TouchableOpacity style={styles.button} onPress={handleIdentify} disabled={loading}>
            {loading ? <ActivityIndicator color={DS.white} /> : <Text style={styles.buttonText}>Continue</Text>}
          </TouchableOpacity>
        )}

        {step === 'METHOD' && (
          <>
            <Text style={styles.info}>Authenticate as {masked || 'user'}</Text>
            {availablePassword && (
              <TouchableOpacity style={styles.button} onPress={() => setStep('PASSWORD')} disabled={loading}>
                <Text style={styles.buttonText}>Login with Password</Text>
              </TouchableOpacity>
            )}
            {availableOtp && (
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color={DS.primary} /> : <Text style={styles.secondaryButtonText}>Login with OTP</Text>}
              </TouchableOpacity>
            )}
          </>
        )}

        {step === 'PASSWORD' && (
          <>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Enter password"
            />
            <TouchableOpacity style={styles.button} onPress={handlePasswordLogin} disabled={loading}>
              {loading ? <ActivityIndicator color={DS.white} /> : <Text style={styles.buttonText}>Login</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkButton} onPress={() => setStep('METHOD')}>
              <Text style={styles.linkText}>Back</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'OTP' && (
          <>
            <Text style={styles.label}>OTP</Text>
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              placeholder="Enter 6-digit OTP"
              maxLength={6}
            />
            <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color={DS.white} /> : <Text style={styles.buttonText}>Verify OTP</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkButton} onPress={handleSendOtp}>
              <Text style={styles.linkText}>Resend OTP</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1E65FF', // Matching welcome screen blue
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.xl, // Softer, larger radius
    padding: 28, // More spacious padding inside the card
    transform: [{ translateY: -60 }], // Place 60px above current center position
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 0, // Clean borderless look
  },
  title: {
    ...TYPO.h5,
    color: DS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...TYPO.b3,
    marginBottom: 24,
    color: DS.textSecondary,
  },
  label: {
    ...TYPO.c2,
    color: DS.textSecondary,
    marginBottom: 8,
  },
  input: {
    height: 52, // Slightly taller input for professional look
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.borderStrong,
    backgroundColor: DS.surface,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: WEIGHT.medium,
    color: DS.textPrimary,
    marginBottom: 16,
  },
  info: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginBottom: 12,
  },
  button: {
    height: 52, // Taller button
    borderRadius: RADIUS.md,
    backgroundColor: DS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: DS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    ...TYPO.b2, // Slightly larger bold text
    fontWeight: WEIGHT.semibold,
    color: DS.white,
  },
  secondaryButton: {
    height: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: DS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    ...TYPO.b2,
    fontWeight: WEIGHT.semibold,
    color: DS.primary,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  linkText: {
    ...TYPO.b3,
    fontWeight: WEIGHT.semibold,
    color: DS.primary,
  },
});
