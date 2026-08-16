import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DS, TYPO, EYEBROW, RADIUS, PALETTE, WEIGHT } from '../../constants/designSystem';
import {
  getPurchaseBootstrap,
  getPurchaseDashboard,
} from '../../services/purchaseService';
import type { PurchaseBootstrap, PurchaseDashboard } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_USER_KEY } from '../../constants/auth';

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN')}`;

const getStatusColors = (status: string) => {
  if (status === 'APPROVED' || status === 'COMPLETED') {
    return { bg: DS.greenSoft, text: PALETTE.green600 };
  }

  if (status === 'WAITING_APPROVAL' || status === 'IN_PROGRESS') {
    return { bg: DS.primarySoft, text: DS.primary };
  }

  return { bg: DS.grey100, text: DS.textSecondary };
};

export default function PurchaseHomeScreen() {
  const [bootstrap, setBootstrap] = useState<PurchaseBootstrap | null>(null);
  const [dashboard, setDashboard] = useState<PurchaseDashboard | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (withRefresh = false) => {
    try {
      if (withRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const bootstrapData = await getPurchaseBootstrap();
      const dashboardData = await getPurchaseDashboard(bootstrapData.manager.id);

      setBootstrap(bootstrapData);
      setDashboard(dashboardData);
    } catch (error) {
      console.log('Purchase dashboard error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    AsyncStorage.getItem(AUTH_USER_KEY).then((data) => {
      if (data) {
        setUser(JSON.parse(data));
      }
    });

    const subscription = DeviceEventEmitter.addListener(
      'PURCHASE_FLOW_UPDATED',
      () => fetchData(true)
    );

    return () => subscription.remove();
  }, []);

  const summary = dashboard?.summary;
  const recentTrips = dashboard?.recentTrips ?? [];
  const activeTrip = dashboard?.activeTrip;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.welcome}>WELCOME BACK</Text>
              <Text style={styles.name}>{user?.name ?? bootstrap?.manager.name ?? 'Purchase Manager'}</Text>
              {user?.vehicleNumber ? (
                <Text style={styles.vehicle}>{user.vehicleNumber}</Text>
              ) : null}
            </View>

            <TouchableOpacity activeOpacity={0.8} style={styles.bellButton}>
              <Ionicons
                name="notifications-outline"
                size={24}
                color={DS.white}
              />
            </TouchableOpacity>
          </View>

          {activeTrip ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.activeBanner}
              onPress={() => {
                if (activeTrip.status === 'IN_PROGRESS' && !activeTrip.loads.length) {
                  router.push({
                    pathname: '/purchase/create-load',
                    params: { tripId: String(activeTrip.id) },
                  } as any);
                  return;
                }

                router.push('/purchase-loads' as any);
              }}
            >
              <View style={styles.activeBannerDot} />
              <Text style={styles.activeBannerText}>
                Trip #{activeTrip.id}{' '}
                {activeTrip.status === 'WAITING_APPROVAL'
                  ? 'waiting approval'
                  : activeTrip.status === 'APPROVED'
                  ? 'approved'
                  : 'in progress'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={DS.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.startTripButton}
              onPress={() => router.push('/purchase/start-trip' as any)}
            >
              <Ionicons name="bus-outline" size={26} color={DS.textPrimary} />
              <Text style={styles.startTripText}>Start New Trip</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sheet}>
          {loading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color={DS.primary} />
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>ACTIVE SUMMARY</Text>

              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Pending Load Approval</Text>
                  <Text style={styles.summaryValue}>{summary?.pendingLoadApproval ?? 0}</Text>
                </View>

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Pending Expenses</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(summary?.pendingExpenses ?? 0)}</Text>
                </View>
              </View>

              <View style={styles.completedCard}>
                <View>
                  <Text style={styles.completedLabel}>COMPLETED TRIPS</Text>
                  <Text style={styles.completedValue}>{summary?.completedTrips ?? 0} this month</Text>
                </View>

                <View style={styles.completedIcon}>
                  <Ionicons name="bus-outline" size={24} color={PALETTE.green600} />
                </View>
              </View>

              <View style={styles.activityHeader}>
                <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
                <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/purchase-trips' as any)}>
                  <Text style={styles.viewAll}>View all</Text>
                </TouchableOpacity>
              </View>

              {recentTrips.length ? (
                recentTrips.map((trip) => {
                  const statusColors = getStatusColors(trip.status);

                  return (
                    <TouchableOpacity
                      key={trip.id}
                      activeOpacity={0.85}
                      style={styles.tripCard}
                      onPress={() => router.push('/purchase-trips' as any)}
                    >
                      <View>
                        <Text style={styles.tripTitle}>Trip #{trip.id}</Text>
                        <Text style={styles.tripMeta}>
                          {trip.loads} loads - {trip.expenses} expenses
                        </Text>
                      </View>

                      <View style={styles.tripRight}>
                        <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
                          <Text style={[styles.statusText, { color: statusColors.text }]}>{trip.status.replaceAll('_', ' ')}</Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={22}
                          color={DS.grey300}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="time-outline" size={24} color={DS.primary} />
                  <Text style={styles.emptyTitle}>No purchase trips yet</Text>
                  <Text style={styles.emptySubtitle}>Start the first trip to create loads and expenses.</Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DS.primary,
  },
  scroll: {
    flex: 1,
    backgroundColor: DS.background,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  hero: {
    backgroundColor: DS.primary,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  welcome: {
    ...EYEBROW,
    color: PALETTE.primary200,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  name: {
    ...TYPO.h4,
    color: DS.white,
  },
  vehicle: {
    ...TYPO.b2,
    color: PALETTE.primary100,
    marginTop: 6,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  startTripButton: {
    height: 60,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  startTripText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  activeBanner: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    backgroundColor: PALETTE.primary800,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PALETTE.primary300,
  },
  activeBannerText: {
    ...TYPO.b4,
    flex: 1,
    color: PALETTE.primary100,
  },
  sheet: {
    backgroundColor: DS.background,
    marginTop: -2,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 110,
    minHeight: 760,
  },
  loaderBox: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    ...EYEBROW,
    color: DS.textTertiary,
    letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.card,
    paddingHorizontal: 18,
    paddingVertical: 18,
    justifyContent: 'space-between',
  },
  summaryLabel: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },
  summaryValue: {
    ...TYPO.h4,
    color: DS.textPrimary,
  },
  completedCard: {
    minHeight: 88,
    borderRadius: RADIUS.lg,
    backgroundColor: PALETTE.green50,
    borderWidth: 1,
    borderColor: PALETTE.green100,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  completedLabel: {
    ...EYEBROW,
    color: PALETTE.green600,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  completedValue: {
    ...TYPO.h5,
    color: PALETTE.green700,
  },
  completedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PALETTE.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  viewAll: {
    ...TYPO.b4,
    color: DS.primary,
  },
  tripCard: {
    minHeight: 76,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.card,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginBottom: 2,
  },
  tripMeta: {
    ...TYPO.c1,
    color: DS.textSecondary,
  },
  tripRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    backgroundColor: DS.grey100,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
  },
  emptyCard: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
});
