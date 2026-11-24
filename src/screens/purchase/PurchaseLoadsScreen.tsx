import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import ScreenContainer from '../../components/common/ScreenContainer';
import { DS, TYPO, EYEBROW, RADIUS, PALETTE, WEIGHT } from '../../constants/designSystem';
import {
  getActivePurchaseTrip,
  getPurchaseBootstrap,
  getPurchaseLoads,
} from '../../services/purchaseService';
import { getEmptyCylinderLoads } from '../../services/emptyCylinderLoadService';
import type {
  EmptyCylinderLoad,
  PurchaseLoad,
  PurchaseTripOverview,
} from '../../types';

type SubTab = 'CYLINDER' | 'EMPTY';

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
};

const formatEmptyStatusColors = (status: EmptyCylinderLoad['status']) => {
  if (status === 'COMPLETED' || status === 'ACCEPTED') {
    return { bg: DS.greenSoft, text: PALETTE.green600 };
  }
  if (status === 'REJECTED') {
    return { bg: DS.redSoft, text: DS.red };
  }
  return { bg: DS.orangeSoft, text: DS.orangeText };
};

const formatStatusColors = (status: PurchaseLoad['status']) => {
  if (status === 'APPROVED') {
    return { bg: DS.greenSoft, text: PALETTE.green600 };
  }

  if (status === 'PENDING') {
    return { bg: DS.orangeSoft, text: DS.orangeText };
  }

  return { bg: DS.primarySoft, text: DS.primary };
};

export default function PurchaseLoadsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [loads, setLoads] = useState<PurchaseLoad[]>([]);
  const [emptyLoads, setEmptyLoads] = useState<EmptyCylinderLoad[]>([]);
  const [activeTrip, setActiveTrip] = useState<PurchaseTripOverview | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('CYLINDER');

  const fetchData = async (withRefresh = false) => {
    try {
      if (withRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const bootstrap = await getPurchaseBootstrap(withRefresh);
      setUserId(bootstrap.manager.id);

      const [loadList, currentTrip, emptyList] = await Promise.all([
        getPurchaseLoads(bootstrap.manager.id, withRefresh),
        getActivePurchaseTrip(bootstrap.manager.id, withRefresh),
        getEmptyCylinderLoads(
          { purchaseManagerId: bootstrap.manager.id },
          withRefresh,
        ),
      ]);

      setLoads(loadList);
      setActiveTrip(currentTrip);
      setEmptyLoads(emptyList);
    } catch (error) {
      console.log('Purchase loads error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    const subscription = DeviceEventEmitter.addListener(
      'PURCHASE_FLOW_UPDATED',
      () => {
        fetchData(true);
      }
    );

    return () => subscription.remove();
  }, []);

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />
      }
    >
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.title}>Loads</Text>
            <Text style={styles.subtitle}>
              {subTab === 'CYLINDER'
                ? 'Trip load sheets and invoice status'
                : 'Empty cylinder dispatches assigned to you'}
            </Text>
          </View>

          {subTab === 'CYLINDER' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.addButton,
                !activeTrip || activeTrip.status !== 'IN_PROGRESS'
                  ? styles.addButtonDisabled
                  : null,
              ]}
              disabled={!activeTrip || activeTrip.status !== 'IN_PROGRESS'}
              onPress={() =>
                router.push({
                  pathname: '/purchase/create-load',
                  params: { tripId: String(activeTrip?.id ?? '') },
                } as any)
              }
            >
              <Ionicons name="add" size={18} color={DS.white} />
              <Text style={styles.addButtonText}>Add Load</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.subTabWrap}>
          <TouchableOpacity
            style={[styles.subTab, subTab === 'CYLINDER' && styles.subTabActive]}
            onPress={() => setSubTab('CYLINDER')}
          >
            <Text
              style={[
                styles.subTabText,
                subTab === 'CYLINDER' && styles.subTabTextActive,
              ]}
            >
              Cylinder Loads
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTab, subTab === 'EMPTY' && styles.subTabActive]}
            onPress={() => setSubTab('EMPTY')}
          >
            <Text
              style={[
                styles.subTabText,
                subTab === 'EMPTY' && styles.subTabTextActive,
              ]}
            >
              Empty Cylinder Loads
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={DS.primary} />
          </View>
        ) : subTab === 'EMPTY' ? (
          <EmptyLoadsList emptyLoads={emptyLoads} />
        ) : (
          <CylinderLoadsList activeTrip={activeTrip} loads={loads} />
        )}
      </View>
    </ScreenContainer>
  );
}

function CylinderLoadsList({
  activeTrip,
  loads,
}: {
  activeTrip: PurchaseTripOverview | null;
  loads: PurchaseLoad[];
}) {
  return (
    <>
        {activeTrip ? (
          <View style={styles.activeTripCard}>
            <Text style={styles.activeTripLabel}>ACTIVE TRIP</Text>
            <Text style={styles.activeTripTitle}>Trip #{activeTrip.id}</Text>
            <Text style={styles.activeTripMeta}>
              {activeTrip.loads.length} loads - {activeTrip.expenses.length} expenses
            </Text>
          </View>
        ) : null}

        {loads.length ? (
          loads.map((load) => {
            const statusColors = formatStatusColors(load.status);

            return (
              <TouchableOpacity
                key={load.id}
                activeOpacity={0.88}
                style={styles.loadCard}
                onPress={() =>
                  router.push(`/purchase/load/${load.id}` as any)
                }
              >
                <View style={styles.loadCardTop}>
                  <View>
                    <Text style={styles.loadTitle}>Load #{load.id}</Text>
                    <Text style={styles.loadMeta}>
                      {load.productType} - {load.itemsCount ?? 0} items
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusColors.bg },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusColors.text }]}>
                      {load.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.loadCardBottom}>
                  <View>
                    <Text style={styles.loadHint}>Total cylinders</Text>
                    <Text style={styles.loadQty}>{load.totalQuantity}</Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={DS.textSecondary}
                  />
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={28} color={DS.primary} />
            <Text style={styles.emptyTitle}>No loads created yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a trip and save the first load sheet to see it here.
            </Text>
          </View>
        )}
    </>
  );
}

function EmptyLoadsList({ emptyLoads }: { emptyLoads: EmptyCylinderLoad[] }) {
  if (!emptyLoads.length) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="cube-outline" size={28} color={DS.primary} />
        <Text style={styles.emptyTitle}>No empty cylinder loads</Text>
        <Text style={styles.emptySubtitle}>
          Dispatches assigned to you by the godown will appear here.
        </Text>
      </View>
    );
  }

  return (
    <>
      {emptyLoads.map((load) => {
        const statusColors = formatEmptyStatusColors(load.status);

        return (
          <TouchableOpacity
            key={load.id}
            activeOpacity={0.88}
            style={styles.loadCard}
            onPress={() => router.push(`/purchase/empty-load/${load.id}` as any)}
          >
            <View style={styles.loadCardTop}>
              <View style={styles.flexShrink}>
                <Text style={styles.loadTitle}>Load #{load.id}</Text>
                <Text style={styles.loadMeta}>
                  {formatDateTime(load.dispatchedAt)}
                </Text>
                <Text style={styles.loadMeta}>
                  By {load.assignedBy} · {load.vehicleNumber}
                </Text>
              </View>

              <View
                style={[styles.statusPill, { backgroundColor: statusColors.bg }]}
              >
                <Text style={[styles.statusText, { color: statusColors.text }]}>
                  {load.statusLabel}
                </Text>
              </View>
            </View>

            <View style={styles.categoryRow}>
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>
                  Domestic: {load.domesticQuantity}
                </Text>
              </View>
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>
                  Commercial: {load.commercialQuantity}
                </Text>
              </View>
            </View>

            <View style={styles.loadCardBottom}>
              <View>
                <Text style={styles.loadHint}>Total empties</Text>
                <Text style={styles.loadQty}>{load.totalQuantity}</Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={DS.textSecondary}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 110,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  title: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },
  subtitle: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 4,
  },
  subTabWrap: {
    flexDirection: 'row',
    backgroundColor: DS.grey100,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: 18,
  },
  subTab: {
    flex: 1,
    height: 38,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabActive: {
    backgroundColor: DS.card,
  },
  subTabText: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },
  subTabTextActive: {
    color: DS.textPrimary,
    fontWeight: WEIGHT.semibold,
  },
  flexShrink: {
    flexShrink: 1,
    paddingRight: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  categoryChip: {
    backgroundColor: DS.surface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryChipText: {
    ...TYPO.c1,
    color: DS.textSecondary,
  },
  addButton: {
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: DS.primary,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonDisabled: {
    backgroundColor: PALETTE.primary200,
  },
  addButtonText: {
    ...TYPO.b4,
    color: DS.white,
  },
  activeTripCard: {
    backgroundColor: DS.textPrimary,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 18,
  },
  activeTripLabel: {
    ...EYEBROW,
    color: DS.grey400,
    letterSpacing: 1,
  },
  activeTripTitle: {
    ...TYPO.h5,
    color: DS.white,
    marginTop: 6,
  },
  activeTripMeta: {
    ...TYPO.b3,
    color: DS.grey300,
    marginTop: 4,
  },
  loaderBox: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
  },
  loadCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  loadTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  loadMeta: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
  },
  loadCardBottom: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadHint: {
    ...TYPO.c1,
    color: DS.textSecondary,
  },
  loadQty: {
    ...TYPO.h5,
    color: DS.textPrimary,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 24,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginTop: 14,
  },
  emptySubtitle: {
    ...TYPO.b3,
    color: DS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
