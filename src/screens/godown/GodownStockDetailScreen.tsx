import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useDateRange } from '../../context/DateRangeContext';
import api from '../../services/api';

type StockItem = {
  productId: number;
  productName: string;
  item?: string;
  quantity: number;
  emptyQuantity?: number;
  defectiveQuantity?: number;
  physical?: number;
  system?: number;
  diff?: number;
};

type StockDetailData = {
  type: string;
  mode?: 'available' | 'empty';
  title: string;
  totalAvailable: number;
  totalEmpty: number;
  totalDefective: number;
  totalStock?: number;
  physical?: number;
  system?: number;
  diff?: number;
  showBookings?: boolean;
  stockBreakdown?: {
    godownStock: { physical: number; system: number };
    allocatedStock: { physical: number; system: number };
    totalStock: { physical: number; system: number };
  };
  items: StockItem[];
};

export default function GodownStockDetailScreen() {
  const params = useLocalSearchParams();
  const type = String(params.type || 'domestic').toLowerCase();
  const { rangeKey } = useDateRange();

  const [data, setData] = useState<StockDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isCommercial = type === 'commercial';
  const isEmptyType = type.includes('empty');

  const title = useMemo(() => {
    if (type === 'empty-domestic') return 'Domestic Empty';
    if (type === 'empty-commercial') return 'Commercial Empty';
    if (type === 'commercial') return 'Commercial Available';
    return 'Domestic Available';
  }, [type]);

  const totalStock = useMemo(() => {
    if (!data) return 0;
    return Number(
      data.totalStock ??
        (isEmptyType ? data.totalEmpty : data.totalAvailable)
    );
  }, [data, isEmptyType]);

  const physical = useMemo(() => {
    if (!data) return 0;
    return Number(data.physical ?? totalStock);
  }, [data, totalStock]);

  const system = useMemo(() => {
    if (!data) return 0;
    return Number(data.system ?? totalStock);
  }, [data, totalStock]);

  const diff = useMemo(() => {
    if (!data) return 0;
    return Number(data.diff ?? physical - system);
  }, [data, physical, system]);

  const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;

  const badgeBg = diff === 0 ? DS.grey100 : diff > 0 ? DS.greenSoft : DS.redSoft;
  const badgeColor = diff === 0 ? DS.textSecondary : diff > 0 ? PALETTE.green600 : DS.red;

  const tileColor = isEmptyType ? DS.orange : isCommercial ? DS.green : DS.primary;
  const tileBg = isEmptyType ? DS.orangeSoft : isCommercial ? DS.greenSoft : DS.primarySoft;

  const fetchStockDetail = useCallback(async () => {
    try {
      const response = await api.get(`/godown/stock-detail/${type}`);

      if (response.data?.success) {
        setData(response.data.data);
      }
    } catch (error: any) {
      console.log(
        'fetchStockDetail error:',
        error?.response?.data || error.message
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useEffect(() => {
    fetchStockDetail();
  }, [fetchStockDetail, rangeKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStockDetail();
  };

  if (loading) {
    return (
      <ScreenContainer>
        <AppHeader />
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={DS.primary} />
          <Text style={styles.loaderText}>Loading stock details...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <AppHeader />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color={DS.textPrimary} />
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={[styles.summaryIcon, { backgroundColor: tileBg }]}>
              <Ionicons name="cube-outline" size={22} color={tileColor} />
            </View>

            <View style={styles.stockBox}>
              <Text style={styles.stockLabel}>TOTAL STOCK</Text>
              <Text style={styles.stockValue}>{totalStock}</Text>
            </View>

            <View style={[styles.diffBadge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.diffBadgeText, { color: badgeColor }]}>
                {diffLabel}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>PHYSICAL</Text>
              <Text style={styles.metricValue}>{physical}</Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>SYSTEM</Text>
              <Text style={styles.metricValue}>{system}</Text>
            </View>
          </View>
        </View>

        {data?.stockBreakdown && (
          <View style={[styles.breakdownCard, { marginBottom: 22 }]}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
              <Text style={styles.title}>Total Stock Breakdown</Text>
            </View>
            <View style={styles.tableHeadRow}>
              <Text style={[styles.tableHeadText, { flex: 1.5 }]}>LOCATION</Text>
              <Text style={[styles.tableHeadText, { textAlign: 'right' }]}>PHYSICAL</Text>
              <Text style={[styles.tableHeadText, { textAlign: 'right' }]}>SYSTEM</Text>
            </View>

            <View style={styles.itemRow}>
              <Text style={[styles.itemName, { flex: 1.5 }]}>Godown Stock</Text>
              <Text style={[styles.itemMetric, { color: DS.red, textAlign: 'right' }]}>
                {data.stockBreakdown.godownStock.physical}
              </Text>
              <Text style={[styles.itemMetric, { textAlign: 'right' }]}>
                {data.stockBreakdown.godownStock.system}
              </Text>
            </View>

            <View style={styles.itemRow}>
              <Text style={[styles.itemName, { flex: 1.5 }]}>Allocated Stock</Text>
              <Text style={[styles.itemMetric, { textAlign: 'right' }]}>
                {data.stockBreakdown.allocatedStock.physical}
              </Text>
              <Text style={[styles.itemMetric, { textAlign: 'right' }]}>
                {data.stockBreakdown.allocatedStock.system}
              </Text>
            </View>

            <View style={styles.itemRow}>
              <Text style={[styles.itemName, { flex: 1.5, fontWeight: WEIGHT.bold }]}>
                Total Stock
              </Text>
              <Text style={[styles.itemMetric, { color: DS.primary, fontWeight: WEIGHT.bold, textAlign: 'right' }]}>
                {data.stockBreakdown.totalStock.physical}
              </Text>
              <Text style={[styles.itemMetric, { fontWeight: WEIGHT.bold, textAlign: 'right' }]}>
                {data.stockBreakdown.totalStock.system}
              </Text>
            </View>
          </View>
        )}

        {(data?.showBookings ?? isCommercial) && !isEmptyType ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.bookingCard}
            onPress={() => router.push('/commercial-bookings')}
          >
            <View style={styles.bookingLeft}>
              <View style={styles.bookingIconBox}>
                <Ionicons name="clipboard-outline" size={28} color={DS.primary} />
              </View>

              <View style={styles.bookingTextBox}>
                <Text style={styles.bookingTitle}>Delivery Boy Bookings</Text>
                <Text style={styles.bookingSub}>
                  Approve commercial cylinder bookings
                </Text>
              </View>
            </View>

            <Ionicons
              name="chevron-forward"
              size={26}
              color={DS.textSecondary}
            />
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionTitle}>Item-wise Breakdown</Text>

        <View style={styles.breakdownCard}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.tableHeadText, { flex: 1.5 }]}>ITEM</Text>
            <Text style={styles.tableHeadText}>PHYSICAL</Text>
            <Text style={styles.tableHeadText}>SYSTEM</Text>
            <Text style={[styles.tableHeadText, { textAlign: 'right' }]}>DIFF</Text>
          </View>

          {(data?.items || []).length ? (
            data?.items.map((item) => (
              <View key={item.productId} style={styles.itemRow}>
                <Text style={[styles.itemName, { flex: 1.5 }]}>
                  {item.item || item.productName}
                </Text>

                <Text style={styles.itemMetric}>
                  {Number(item.physical ?? (isEmptyType ? item.emptyQuantity : item.quantity) ?? 0)}
                </Text>

                <Text style={styles.itemMetric}>
                  {Number(item.system ?? (isEmptyType ? item.emptyQuantity : item.quantity) ?? 0)}
                </Text>

                <Text
                  style={[
                    styles.itemDiff,
                    {
                      color:
                        Number(item.diff || 0) === 0
                          ? DS.textSecondary
                          : Number(item.diff || 0) > 0
                            ? PALETTE.green600
                            : DS.red,
                    },
                  ]}
                >
                  {Number(item.diff || 0) > 0
                    ? `+${Number(item.diff || 0)}`
                    : `${Number(item.diff || 0)}`}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No stock items found</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 100,
  },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loaderText: {
    ...TYPO.b4,
    marginTop: 10,
    color: DS.textSecondary,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },

  backButton: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },

  summaryCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginBottom: 16,
  },

  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  stockBox: {
    flex: 1,
  },

  stockLabel: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.6,
  },

  stockValue: {
    ...TYPO.h3,
    color: DS.textPrimary,
  },

  diffBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  diffBadgeText: {
    ...TYPO.c2,
    fontWeight: WEIGHT.semibold,
  },

  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  metricBox: {
    flex: 1,
    backgroundColor: DS.surface,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },

  metricLabel: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 2,
  },

  metricValue: {
    ...TYPO.h4,
    color: DS.textPrimary,
  },

  bookingCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  bookingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  bookingIconBox: {
    width: 58,
    height: 58,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  bookingTextBox: {
    flex: 1,
  },

  bookingTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  bookingSub: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 4,
  },

  sectionTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
    marginBottom: 12,
  },

  breakdownCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },

  tableHeadRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: DS.surface,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: DS.divider,
  },

  tableHeadText: {
    ...EYEBROW,
    flex: 1,
    color: DS.textSecondary,
    letterSpacing: 0.6,
  },

  itemRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: DS.divider,
    flexDirection: 'row',
    alignItems: 'center',
  },

  itemName: {
    ...TYPO.b4,
    color: DS.textPrimary,
  },

  itemMetric: {
    ...TYPO.s2,
    flex: 1,
    color: DS.textPrimary,
    textAlign: 'center',
  },

  itemDiff: {
    ...TYPO.s2,
    flex: 1,
    textAlign: 'right',
  },

  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },

  emptyText: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },
});