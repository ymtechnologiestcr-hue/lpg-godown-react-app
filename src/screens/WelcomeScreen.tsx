import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackdrop } from '../components/auth/AuthBackdrop';
import { getHomeRouteByRole } from '../constants/auth';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: 'flash-outline' as const, label: 'Instant\nBooking', color: '#E3343D', tint: '#FFF0F0' },
  { icon: 'bar-chart-outline' as const, label: 'Live Stock\n& Ledgers', color: '#1689D4', tint: '#EDF8FF' },
  { icon: 'map-outline' as const, label: 'Smart Route\nDispatch', color: '#E3343D', tint: '#FFF0F0' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, role, setSplashCompleted } = useAuth();

  const continueToLogin = () => {
    setSplashCompleted(true);
    if (isAuthenticated && role) {
      router.replace(getHomeRouteByRole(role) as never);
    } else {
      router.replace('/login');
    }
  };

  return (
    <AuthBackdrop>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF9FA" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.logoTile}>
            <Image
              source={require('../../assets/images/lpg-mitra-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityLabel="LPG Mitra logo"
            />
          </View>

          <View style={styles.brandRow}>
            <Text style={styles.brandName}>LPG Mitra</Text>
            <Ionicons name="checkmark-circle" size={17} color="#1689D4" />
          </View>
          <Text style={styles.tagline}>Smart LPG Cylinder Distribution &amp; Stock</Text>
          <Text style={styles.tagline}>Tracking System</Text>

          <View style={styles.featureRow}>
            {FEATURES.map((feature) => (
              <View key={feature.label} style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: feature.tint }]}>
                  <Ionicons name={feature.icon} size={17} color={feature.color} />
                </View>
                <Text style={styles.featureLabel}>{feature.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={continueToLogin}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Continue with email"
        >
          <Ionicons name="phone-portrait-outline" size={17} color="#FFFFFF" />
          <Text style={styles.continueButtonText}>Continue with Email</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.poweredBy}>POWERED BY</Text>
          <View style={styles.companyRow}>
            <Text style={styles.companyName}>YM Technologies</Text>
            <View style={styles.companyDot} />
          </View>
        </View>
      </SafeAreaView>
    </AuthBackdrop>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
  },
  logoTile: {
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#24354B',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.1,
    shadowRadius: 17,
    elevation: 5,
  },
  logoImage: {
    width: 88,
    height: 88,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  brandName: {
    color: '#11243A',
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  tagline: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  featureRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 9,
    marginTop: 22,
  },
  featureCard: {
    flex: 1,
    minHeight: 75,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    shadowColor: '#26384B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 9,
    elevation: 2,
  },
  featureIcon: {
    width: 27,
    height: 27,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  featureLabel: {
    color: '#1F2E43',
    fontSize: 8,
    lineHeight: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  continueButton: {
    height: 48,
    borderRadius: 13,
    backgroundColor: '#C81924',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
    shadowColor: '#A10F19',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.19,
    shadowRadius: 9,
    elevation: 4,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 2,
    marginHorizontal: -20,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  poweredBy: {
    color: '#94A3B8',
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
    marginBottom: 10,
  },
  companyName: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  companyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1689D4',
  },
});
