import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AppHeader from '../components/common/AppHeader';
import ScreenContainer from '../components/common/ScreenContainer';
import { AUTH_USER_KEY } from '../constants/auth';
import { DS, TYPO, RADIUS, WEIGHT } from '../constants/designSystem';
import { useDateRange } from '../context/DateRangeContext';
import api from '../services/api';

type RequestItem = {
  id: number;
  quantity: number;
  productName?: string;
  productType?: string;
  batchNo?: string;
  createdAt?: string;
  isApproved: number;
};

type InHandData = {
  summary: {
    allocated: number;
    allocatedToday?: number;
    carriedForward?: number;
    delivered: number;
    returned?: number;
    defective?: number;
    inHand: number;
  };
  returnRequests: RequestItem[];
  defectiveRequests: RequestItem[];
};

const formatTime = (value?: string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function InHandCylindersScreen() {
  const router = useRouter();
  const { rangeKey } = useDateRange();
  const [driverId, setDriverId] = useState<number | null>(null);

  const [data, setData] = useState<InHandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDriverId = async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const id = Number(parsed?.driver_id || parsed?.id || parsed?.user_id);
        setDriverId(Number.isNaN(id) ? null : id);
      } catch {
        setDriverId(null);
      }
    };

    loadDriverId();
  }, []);

  const fetchInHandSummary = useCallback(async () => {
    try {
      setError('');

      if (!driverId) {
        setError('Unable to identify driver session');
        return;
      }

      const response = await api.get(`/drivers/${driverId}/in-hand-summary`);

      if (response.data?.success) {
        setData(response.data.data);
      } else {
        setError('Failed to load in-hand summary');
      }
    } catch (err: any) {
      console.error(
        'fetchInHandSummary error:',
        err?.response?.data || err.message
      );
      setError('Failed to load in-hand summary');
    }
  }, [driverId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchInHandSummary();
      setLoading(false);
    };

    load();
  }, [fetchInHandSummary, rangeKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInHandSummary();
    setRefreshing(false);
  };

  const pendingReturnRequests =
    data?.returnRequests?.filter((item) => Number(item.isApproved) === 0) || [];

  const pendingDefectiveRequests =
    data?.defectiveRequests?.filter((item) => Number(item.isApproved) === 0) ||
    [];

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <AppHeader />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={28} color={DS.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.pageTitle}>In-Hand Cylinders</Text>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={DS.primary} />
            <Text style={styles.infoText}>Loading in-hand summary...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchInHandSummary}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              {(() => {
                const inHandRemaining = Number(data?.summary?.inHand ?? 0);
                const inHandReturned = Number(data?.summary?.returned ?? 0);
                const inHandDefective = Number(data?.summary?.defective ?? 0);
                const inHandOriginal =
                  inHandRemaining + inHandReturned + inHandDefective;

                return (
                  <>
              <StatCard
                value={data?.summary?.allocated ?? 0}
                label="Allocated"
                color={DS.primary}
              />

              <StatCard
                value={data?.summary?.delivered ?? 0}
                label="Delivered"
                color={DS.green}
              />

              <StatCard
                value={`${inHandRemaining}/${inHandOriginal}`}
                label="In Hand"
                color={DS.orange}
              />
                  </>
                );
              })()}
            </View>

            {Number(data?.summary?.carriedForward ?? 0) > 0 ? (
              <View style={styles.carryForwardBanner}>
                <Ionicons name="repeat-outline" size={18} color={DS.orange} />
                <Text style={styles.carryForwardText}>
                  {data?.summary?.carriedForward} cylinder(s) carried forward from
                  previous day(s) are included in your allocated total.
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Return Requests</Text>

            {pendingReturnRequests.length > 0 ? (
              pendingReturnRequests.map((item) => (
                <RequestCard
                  key={`return-${item.id}`}
                  quantity={item.quantity}
                  productName={item.productName}
                  productType={item.productType}
                  batchNo={item.batchNo}
                  time={formatTime(item.createdAt)}
                  type="return"
                />
              ))
            ) : (
              <View style={styles.emptyBoxSmall}>
                <Text style={styles.emptyText}>No pending return requests</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Defective Cylinder Requests</Text>

            {pendingDefectiveRequests.length > 0 ? (
              pendingDefectiveRequests.map((item) => (
                <RequestCard
                  key={`defective-${item.id}`}
                  quantity={item.quantity}
                  productName={item.productName}
                  productType={item.productType}
                  batchNo={item.batchNo}
                  time={formatTime(item.createdAt)}
                  type="defective"
                />
              ))
            ) : (
              <View style={styles.emptyBoxSmall}>
                <Text style={styles.emptyText}>
                  No pending defective requests
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function StatCard({
  value,
  label,
  color,
}: {
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RequestCard({
  quantity,
  productName,
  productType,
  batchNo,
  time,
  type,
}: {
  quantity: number;
  productName?: string;
  productType?: string;
  batchNo?: string;
  time: string;
  type: 'return' | 'defective';
}) {
  const isDefective = type === 'defective';

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestLeft}>
        <View
          style={isDefective ? styles.requestIconRed : styles.requestIconOrange}
        >
          <Ionicons
            name={isDefective ? 'warning-outline' : 'time-outline'}
            size={18}
            color={isDefective ? DS.red : DS.orange}
          />
        </View>

        <View style={styles.requestTextBox}>
          <Text style={styles.requestTitle}>
            {quantity} {isDefective ? 'Defective ' : ''}
            {quantity === 1 ? 'Cylinder' : 'Cylinders'}
          </Text>

          {!!productName && (
            <Text style={styles.requestProduct} numberOfLines={1}>
              {productName}
            </Text>
          )}

          <View style={styles.metaRow}>
            {!!batchNo && (
              <Text style={styles.batchPill}>{batchNo}</Text>
            )}

            {!!productType && (
              <Text style={styles.typePill}>{productType}</Text>
            )}
          </View>

          <Text style={styles.requestTime}>{time}</Text>
        </View>
      </View>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>Awaiting Approval</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  backButton: {
    marginRight: 16,
    padding: 2,
  },

  pageTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },

  statCard: {
    flex: 1,
    backgroundColor: DS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    paddingVertical: 18,
    alignItems: 'center',
  },

  statValue: {
    ...TYPO.h5,
    marginBottom: 6,
  },

  statLabel: {
    ...TYPO.c2,
    color: DS.textSecondary,
  },

  carryForwardBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: DS.orange,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginBottom: 16,
  },
  carryForwardText: {
    ...TYPO.c1,
    color: DS.textSecondary,
    flex: 1,
  },

  sectionTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
    marginBottom: 10,
    marginTop: 4,
  },

  requestCard: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  requestLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  requestIconOrange: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: DS.orangeSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  requestIconRed: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: DS.redSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  requestTextBox: {
    flex: 1,
  },

  requestTitle: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
  },

  requestProduct: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 2,
  },

  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },

  batchPill: {
    backgroundColor: DS.blueSoft,
    color: DS.primary,
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },

  typePill: {
    backgroundColor: DS.surface,
    color: DS.textSecondary,
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },

  requestTime: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 6,
  },

  badge: {
    backgroundColor: DS.orangeSoft,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginLeft: 8,
  },

  badgeText: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
    color: DS.orangeText,
  },

  emptyBoxSmall: {
    backgroundColor: DS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: 18,
  },

  emptyText: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },

  centerBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoText: {
    ...TYPO.b3,
    marginTop: 12,
    color: DS.textSecondary,
  },

  errorText: {
    ...TYPO.b3,
    color: DS.red,
    marginBottom: 12,
  },

  retryButton: {
    backgroundColor: DS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
  },

  retryButtonText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.white,
  },
});