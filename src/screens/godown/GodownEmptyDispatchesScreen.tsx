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

import AppHeader from '../../components/common/AppHeader';
import ScreenContainer from '../../components/common/ScreenContainer';
import { DS, TYPO, EYEBROW, RADIUS, PALETTE, WEIGHT } from '../../constants/designSystem';
import { getEmptyCylinderLoads } from '../../services/emptyCylinderLoadService';
import type { EmptyCylinderLoad, EmptyCylinderLoadStatus } from '../../types';

// Read-only view of the empty-cylinder dispatches this godown created, so the
// godown manager sees the purchase manager's acceptance and completion without
// having to ask. The purchase-side screens own all the actions.
type StatusFilter = 'ALL' | EmptyCylinderLoadStatus;

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'REJECTED', label: 'Rejected' },
];

const statusColors = (status: EmptyCylinderLoadStatus) => {
  if (status === 'COMPLETED') {
    return { bg: DS.greenSoft, text: PALETTE.green600 };
  }
  if (status === 'ACCEPTED') {
    return { bg: DS.primarySoft, text: DS.primary };
  }
  if (status === 'REJECTED') {
    return { bg: DS.redSoft, text: DS.red };
  }
  return { bg: DS.orangeSoft, text: DS.orangeText };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const time = date
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toLowerCase();
  return `${day}, ${time}`;
};

export default function GodownEmptyDispatchesScreen() {
  const [loads, setLoads] = useState<EmptyCylinderLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');

  const fetchLoads = async (withRefresh = false) => {
    try {
      if (withRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // No purchaseManagerId filter — the godown sees every dispatch it made.
      const data = await getEmptyCylinderLoads();
      setLoads(data);
    } catch (error) {
      console.log('Empty dispatches error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLoads();

    const subscription = DeviceEventEmitter.addListener('PURCHASE_FLOW_UPDATED', () =>
      fetchLoads(true)
    );

    return () => subscription.remove();
  }, []);

  const filtered = loads.filter((load) =>
    activeFilter === 'ALL' ? true : load.status === activeFilter
  );

  const pendingCount = loads.filter((load) => load.status === 'PENDING').length;

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchLoads(true)} />
      }
    >
      <AppHeader />

      <View style={styles.content}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Empty Cylinder Dispatches</Text>
        <Text style={styles.subtitle}>
          {pendingCount
            ? `${pendingCount} awaiting purchase manager acceptance`
            : 'All dispatches have been actioned'}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.85}
                style={[styles.filterPill, active ? styles.filterPillActive : null]}
                onPress={() => setActiveFilter(tab.key)}
              >
                <Text
                  style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}
                >
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
        ) : filtered.length ? (
          filtered.map((load) => {
            const pill = statusColors(load.status);

            return (
              <View key={load.id} style={styles.loadCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardLabel}>DISPATCH</Text>
                    <Text style={styles.cardId}>#{load.id}</Text>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.statusText, { color: pill.text }]}>
                      {load.statusLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricsRow}>
                  <Metric label="TOTAL" value={load.totalQuantity} />
                  <Metric label="DOMESTIC" value={load.domesticQuantity} />
                  <Metric label="COMMERCIAL" value={load.commercialQuantity} />
                </View>

                <Row label="Vehicle" value={load.vehicleNumber} />
                {load.ervNumber ? <Row label="ERV number" value={load.ervNumber} /> : null}
                <Row label="Dispatched" value={formatDateTime(load.dispatchedAt)} />
                {load.acceptedAt ? (
                  <Row label="Accepted" value={formatDateTime(load.acceptedAt)} />
                ) : null}
                {load.completedAt ? (
                  <Row label="Completed" value={formatDateTime(load.completedAt)} />
                ) : null}
                {load.status === 'REJECTED' && load.rejectReason ? (
                  <Row label="Reject reason" value={load.rejectReason} />
                ) : null}

                {load.status === 'REJECTED' ? (
                  <View style={styles.noteRow}>
                    <Ionicons name="information-circle-outline" size={16} color={DS.red} />
                    <Text style={styles.noteText}>
                      These empties were returned to godown stock.
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No dispatches in this filter</Text>
            <Text style={styles.emptySubtitle}>
              Switch the tab, or create one from Stock → Stock Out.
            </Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  backText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.primary,
    marginBottom: 16,
  },
  title: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },
  subtitle: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 4,
    marginBottom: 14,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 12,
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
  loadCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardLabel: {
    ...EYEBROW,
    color: DS.textTertiary,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  cardId: {
    ...TYPO.h5,
    color: DS.textPrimary,
    marginTop: 1,
  },
  statusPill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  statusText: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
  },
  metricsRow: {
    marginTop: 12,
    marginBottom: 6,
    backgroundColor: DS.grey50,
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
    flex: 1,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: {
    ...TYPO.b3,
    color: DS.textSecondary,
  },
  summaryValue: {
    ...TYPO.b3,
    color: DS.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
    paddingLeft: 12,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  noteText: {
    ...TYPO.c1,
    color: DS.red,
    flexShrink: 1,
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
