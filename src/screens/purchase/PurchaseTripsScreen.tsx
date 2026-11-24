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

import ScreenContainer from '../../components/common/ScreenContainer';
import { DS, TYPO, EYEBROW, RADIUS, PALETTE, WEIGHT } from '../../constants/designSystem';
import { getPurchaseBootstrap, getPurchaseTrips } from '../../services/purchaseService';
import type { PurchaseTripSummary } from '../../types';

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN')}`;

type TripFilter = 'ALL' | 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'APPROVED' | 'COMPLETED';

const formatTripDateTime = (value: string) => {
  try {
    const date = new Date(value);
    const day = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
    const time = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase();
    return `${day}, ${time}`;
  } catch {
    return value;
  }
};

const statusPillStyle = (status: PurchaseTripSummary['status']) => {
  if (status === 'COMPLETED' || status === 'APPROVED') {
    return { bg: DS.greenSoft, text: PALETTE.green600 };
  }

  if (status === 'WAITING_APPROVAL') {
    return { bg: DS.primarySoft, text: DS.primary };
  }

  if (status === 'IN_PROGRESS') {
    return { bg: DS.orangeSoft, text: DS.orangeText };
  }

  return { bg: DS.grey100, text: DS.textSecondary };
};

export default function PurchaseTripsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trips, setTrips] = useState<PurchaseTripSummary[]>([]);
  const [activeFilter, setActiveFilter] = useState<TripFilter>('ALL');

  const fetchTrips = async (withRefresh = false) => {
    try {
      if (withRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const bootstrap = await getPurchaseBootstrap(withRefresh);
      const tripList = await getPurchaseTrips(bootstrap.manager.id, withRefresh);
      setTrips(tripList);
    } catch (error) {
      console.log('Purchase trips error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrips();

    const subscription = DeviceEventEmitter.addListener(
      'PURCHASE_FLOW_UPDATED',
      () => fetchTrips(true)
    );

    return () => subscription.remove();
  }, []);

  const filteredTrips = trips.filter((trip) =>
    activeFilter === 'ALL' ? true : trip.status === activeFilter
  );

  const filterTabs: { key: TripFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'WAITING_APPROVAL', label: 'Waiting Approval' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchTrips(true)} />
      }
    >
      <View style={styles.screenBg}>
        <View style={styles.containerCard}>
          <Text style={styles.headerTitle}>My Trips</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {filterTabs.map((tab) => {
              const active = activeFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  activeOpacity={0.85}
                  style={[styles.filterPill, active ? styles.filterPillActive : null]}
                  onPress={() => setActiveFilter(tab.key)}
                >
                  <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color={DS.primary} />
            </View>
          ) : filteredTrips.length ? (
            filteredTrips.map((trip) => {
              const pill = statusPillStyle(trip.status);

              return (
                <View key={trip.id} style={styles.tripCard}>
                  <View style={styles.tripHeader}>
                    <View>
                      <Text style={styles.tripLabel}>Trip ID</Text>
                      <Text style={styles.tripId}>#{trip.id}</Text>
                    </View>

                    <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.statusText, { color: pill.text }]}>
                        {trip.status.replaceAll('_', ' ')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricsRow}>
                    <MetricCell label="START KM" value={trip.startKm.toLocaleString('en-IN')} />
                    <MetricCell label="LOADS" value={trip.loadsCount} />
                    <MetricCell label="CYL" value={trip.totalCylinders} />
                    <MetricCell label="EXP" value={formatCurrency(trip.totalExpenses)} />
                  </View>

                  <Text style={styles.tripTime}>{formatTripDateTime(trip.startedAt)}</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No trips in this filter</Text>
              <Text style={styles.emptySubtitle}>Switch the tab or start a new trip.</Text>
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

function MetricCell({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  containerCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.xl,
    padding: 16,
  },
  headerTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
    marginBottom: 12,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 8,
  },
  filterPill: {
    height: 34,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DS.grey50,
  },
  filterPillActive: {
    backgroundColor: DS.textPrimary,
    borderColor: DS.textPrimary,
  },
  filterPillText: {
    ...TYPO.c2,
    color: DS.textSecondary,
  },
  filterPillTextActive: {
    color: DS.white,
  },
  loaderBox: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripCard: {
    backgroundColor: DS.grey50,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tripLabel: {
    ...EYEBROW,
    color: DS.textTertiary,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  tripId: {
    ...TYPO.h5,
    color: DS.textPrimary,
    marginTop: 1,
  },
  statusPill: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  statusText: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
  },
  metricsRow: {
    marginTop: 12,
    backgroundColor: DS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.divider,
    paddingVertical: 10,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricCell: {
    alignItems: 'center',
    minWidth: 58,
  },
  metricLabel: {
    ...EYEBROW,
    color: DS.textTertiary,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  metricValue: {
    ...TYPO.s2,
    color: DS.textPrimary,
    marginTop: 4,
  },
  tripTime: {
    ...TYPO.c1,
    color: DS.textTertiary,
    marginTop: 10,
    marginLeft: 2,
  },
  emptyCard: {
    backgroundColor: DS.grey50,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  emptySubtitle: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
