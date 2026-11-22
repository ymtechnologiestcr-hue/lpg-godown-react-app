import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackdrop } from '../components/auth/AuthBackdrop';
import { AUTH_COLORS } from '../constants/authTheme';
import { AGENCY_NAME_KEY, AUTH_USER_KEY, getHomeRouteByRole } from '../constants/auth';
import { useAuth } from '../context/AuthContext';
import { fetchUserSettings } from '../services/authService';

export default function LoginSuccessScreen() {
  const router = useRouter();
  const {
    agencyName,
    isAuthenticated,
    role,
    user,
    setLoginTransitionActive,
  } = useAuth();
  const [fetchedAgency, setFetchedAgency] = useState('');
  const [fetchedName, setFetchedName] = useState('');
  const [agencyReady, setAgencyReady] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentOffset = useRef(new Animated.Value(16)).current;
  const logoScale = useRef(new Animated.Value(0.86)).current;
  const progress = useRef(new Animated.Value(0)).current;

  const knownAgency = agencyName || user?.agency_name || user?.company_name || '';

  useEffect(() => {
    setLoginTransitionActive(false);
  }, [setLoginTransitionActive]);

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(contentOffset, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),
    ]);

    entrance.start();
    return () => entrance.stop();
  }, [contentOpacity, contentOffset, logoScale]);

  useEffect(() => {
    const progressAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 1,
          useNativeDriver: true,
        }),
      ]),
    );
    progressAnimation.start();
    return () => progressAnimation.stop();
  }, [progress]);

  useEffect(() => {
    let mounted = true;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    if (knownAgency) {
      setAgencyReady(true);
      return () => {
        mounted = false;
      };
    }

    if (!user?.id) {
      setAgencyReady(true);
      return () => {
        mounted = false;
      };
    }

    setAgencyReady(false);
    fallbackTimer = setTimeout(() => {
      if (mounted) setAgencyReady(true);
    }, 2500);

    fetchUserSettings(user.id)
      .then(async (response) => {
        if (!mounted || !response?.success || !response.data) return;
        const agency = response.data.agency_name || response.data.company_name || '';
        setFetchedAgency(agency);
        setFetchedName(response.data.name || '');
        if (agency) {
          const storedUser = await AsyncStorage.getItem(AUTH_USER_KEY);
          const parsedUser = storedUser ? JSON.parse(storedUser) : user;
          await AsyncStorage.multiSet([
            [AGENCY_NAME_KEY, agency],
            [AUTH_USER_KEY, JSON.stringify({ ...parsedUser, agency_name: agency })],
          ]);
        }
      })
      .catch(() => {
        // Continue to the dashboard even if profile details are unavailable.
      })
      .finally(() => {
        if (mounted) {
          if (fallbackTimer) clearTimeout(fallbackTimer);
          setAgencyReady(true);
        }
      });

    return () => {
      mounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [knownAgency, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !role) {
      router.replace('/login');
      return;
    }
    if (!agencyReady) return;

    const timer = setTimeout(() => {
      router.replace(getHomeRouteByRole(role) as never);
    }, 1500);

    return () => clearTimeout(timer);
  }, [agencyReady, isAuthenticated, role, router]);

  const displayAgency = knownAgency || fetchedAgency || 'LPG Mitra';
  const displayName = user?.name || fetchedName;

  return (
    <AuthBackdrop>
      <StatusBar barStyle="dark-content" backgroundColor={AUTH_COLORS.background} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentOffset }],
            },
          ]}
        >
          <Animated.View style={[styles.logoTile, { transform: [{ scale: logoScale }] }]}>
            <Image
              source={require('../../assets/images/lpg-mitra-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityLabel="LPG Mitra logo"
            />
          </Animated.View>

          <Text style={styles.eyebrow}>WELCOME TO</Text>
          <Text style={styles.agencyName}>{displayAgency}</Text>
          {displayName ? (
            <Text style={styles.userName}>Hello, {displayName}</Text>
          ) : null}

          <View style={styles.loadingRow}>
            <Ionicons name="checkmark-circle" size={17} color={AUTH_COLORS.accentBlue} />
            <Text style={styles.loadingText}>Preparing your dashboard</Text>
          </View>
          <View style={styles.loadingTrack}>
            <Animated.View
              style={[
                styles.loadingProgress,
                {
                  transform: [
                    {
                      translateX: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-85, 155],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <Text style={styles.poweredBy}>POWERED BY</Text>
          <Text style={styles.companyName}>YM Technologies</Text>
        </View>
      </SafeAreaView>
    </AuthBackdrop>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  logoTile: {
    width: 112,
    height: 112,
    borderRadius: 25,
    backgroundColor: AUTH_COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    shadowColor: '#24354B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  logoImage: {
    width: 98,
    height: 98,
  },
  eyebrow: {
    color: AUTH_COLORS.secondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  agencyName: {
    color: AUTH_COLORS.navy,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  userName: {
    color: AUTH_COLORS.secondary,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 34,
  },
  loadingText: {
    color: AUTH_COLORS.secondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  loadingTrack: {
    width: 150,
    height: 4,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: '#E5EAF0',
    marginTop: 12,
  },
  loadingProgress: {
    width: 82,
    height: 4,
    borderRadius: 2,
    backgroundColor: AUTH_COLORS.brandRed,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 8,
  },
  poweredBy: {
    color: AUTH_COLORS.muted,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  companyName: {
    color: AUTH_COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 4,
  },
});
