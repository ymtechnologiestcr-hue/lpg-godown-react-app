import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AppHeader from '../components/common/AppHeader';
import ScreenContainer from '../components/common/ScreenContainer';
import { AUTH_USER_KEY } from '../constants/auth';
import { DS, TYPO, RADIUS, PALETTE, WEIGHT } from '../constants/designSystem';
import { useDateRange } from '../context/DateRangeContext';
import api from '../services/api';

type Product = {
  id: number;
  name: string;
  type?: string;
  price?: number;
  categoryName?: string;
  availableQty?: number;
  collectedQty?: number;
  returnedQty?: number;
};

type TodayData = {
  summary: {
    collected: number;
    returned: number;
    inHand: number;
  };
  collectedFrom: {
    id: number;
    saleId: number;
    customerName: string;
    productType: string;
    quantity: number;
    createdAt: string;
  }[];
  returnRequests: {
    id: number;
    productName?: string;
    quantity: number;
    createdAt: string;
    isApproved: number;
  }[];
};

type HistoryDay = {
  date: string;
  collected: number;
  returned: number;
  inHand: number;
  collections: {
    id: number;
    customerName: string;
    productType: string;
    quantity: number;
    createdAt: string;
  }[];
  returns: {
    id: number;
    productName?: string;
    quantity: number;
    createdAt: string;
    isApproved: number;
  }[];
};

type HistoryData = {
  items: HistoryDay[];
};

const formatTime = (value?: string | null) => {
  if (!value) return '';

  try {
    const date = new Date(value);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const formatDateLabel = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

export default function EmptyCylindersScreen() {
  const router = useRouter();
  const { rangeKey } = useDateRange();
  const [driverId, setDriverId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');

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

  const fetchTodayData = useCallback(async () => {
    if (!driverId) return;

    const response = await api.get(`/drivers/${driverId}/empty-cylinders/today`);

    if (response.data?.success) {
      setTodayData(response.data.data);
    } else {
      throw new Error('Failed to load empty cylinders today');
    }
  }, [driverId]);

  const fetchHistoryData = useCallback(async () => {
    if (!driverId) return;

    const response = await api.get(`/drivers/${driverId}/empty-cylinders/history`);

    if (response.data?.success) {
      setHistoryData(response.data.data);
    } else {
      throw new Error('Failed to load empty cylinders history');
    }
  }, [driverId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!driverId) {
        setError('Unable to identify driver session');
        return;
      }

      if (activeTab === 'today') {
        await fetchTodayData();
      } else {
        await fetchHistoryData();
      }
    } catch (err: any) {
      console.error('EmptyCylindersScreen error:', err?.response?.data || err.message);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchTodayData, fetchHistoryData, driverId]);

  useEffect(() => {
    loadData();
  }, [loadData, rangeKey]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);

      if (activeTab === 'today') {
        await fetchTodayData();
      } else {
        await fetchHistoryData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const resetModal = () => {
    setProducts([]);
    setSelectedProduct(null);
    setQuantity('');
  };

  const fetchReturnableProducts = useCallback(async () => {
    if (!driverId) {
      setProducts([]);
      return;
    }

    try {
      setLoadingProducts(true);

      const response = await api.get(
        `/drivers/${driverId}/empty-cylinders/returnable-products`
      );

      if (response.data?.success) {
        setProducts(response.data.data || []);
      }
    } catch (err: any) {
      console.log('fetchReturnableProducts error:', err?.response?.data || err.message);
    } finally {
      setLoadingProducts(false);
    }
  }, [driverId]);

  const openReturnModal = () => {
    setSelectedProduct(null);
    setQuantity('');
    setReturnModalVisible(true);
    fetchReturnableProducts();
  };

  const submitReturnRequest = async () => {
    try {
      if (!selectedProduct?.id) {
        Alert.alert('Error', 'Please select product');
        return;
      }

      if (!quantity || Number(quantity) <= 0) {
        Alert.alert('Error', 'Please enter valid quantity');
        return;
      }

      if (!driverId) {
        Alert.alert('Error', 'Unable to identify driver session');
        return;
      }

      const requestedQty = Number(quantity);
      const availableQty = Number(selectedProduct.availableQty || 0);

      if (requestedQty > availableQty) {
        Alert.alert(
          'Error',
          `Only ${availableQty} empty cylinder(s) can be returned for selected product`
        );
        return;
      }

      setSubmitting(true);

      const response = await api.post('/drivers/empty-cylinders/return-request', {
        driver_id: driverId,
        product_id: selectedProduct.id,
        quantity: requestedQty,
      });

      if (response.data?.success) {
        Alert.alert('Success', 'Return request sent for approval');
        // Clear the current selection and refresh the returnable list so a
        // fully-returned product drops off and the next one can be picked.
        setSelectedProduct(null);
        setQuantity('');
        await Promise.all([fetchReturnableProducts(), fetchTodayData()]);
      } else {
        Alert.alert('Error', response.data?.message || 'Failed to create request');
      }
    } catch (err: any) {
      console.error('submitReturnRequest error:', err?.response?.data || err.message);
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <AppHeader />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color={DS.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.pageTitle}>Empty Cylinders</Text>
        </View>

        <View style={styles.segmentWrap}>
          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'today' && styles.segmentTabActive]}
            onPress={() => setActiveTab('today')}
          >
            <Ionicons name="time-outline" size={16} color={DS.textSecondary} />
            <Text
              style={[
                styles.segmentText,
                activeTab === 'today' && styles.segmentTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'history' && styles.segmentTabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Ionicons name="time-outline" size={16} color={DS.textSecondary} />
            <Text
              style={[
                styles.segmentText,
                activeTab === 'history' && styles.segmentTextActive,
              ]}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={DS.primary} />
            <Text style={styles.infoText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : activeTab === 'today' ? (
          <>
            <View style={styles.statsRow}>
              {(() => {
                const emptyRemaining = Number(todayData?.summary?.inHand ?? 0);
                const emptyOriginal = Number(todayData?.summary?.collected ?? 0);

                return (
                  <>
              <StatCard
                value={todayData?.summary?.collected ?? 0}
                label="Collected"
                color={DS.orange}
              />

              <StatCard
                value={todayData?.summary?.returned ?? 0}
                label="Returned"
                color={DS.green}
              />

              <StatCard
                value={`${emptyRemaining}/${emptyOriginal}`}
                label="In Hand"
                color={DS.red}
              />
                  </>
                );
              })()}
            </View>

            <Text style={styles.sectionTitle}>Collected From</Text>

            {todayData?.collectedFrom?.length ? (
              todayData.collectedFrom.map((item) => (
                <View key={`collected-${item.id}`} style={styles.infoCard}>
                  <View>
                    <Text style={styles.infoTitle}>{item.customerName}</Text>
                    <Text style={styles.infoSub}>
                      {item.productType} · {formatTime(item.createdAt)}
                    </Text>
                  </View>

                  <Text style={styles.qtyOrange}>{item.quantity}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No empty cylinders collected today</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Return Requests</Text>

            {todayData?.returnRequests?.length ? (
              todayData.returnRequests.map((item) => (
                <RequestCard
                  key={`request-${item.id}`}
                  quantity={item.quantity}
                  productName={item.productName}
                  createdAt={item.createdAt}
                  isApproved={item.isApproved}
                />
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No return requests</Text>
              </View>
            )}

            <TouchableOpacity style={styles.returnButton} onPress={openReturnModal}>
              <Ionicons name="refresh-outline" size={22} color={DS.white} />
              <Text style={styles.returnButtonText}>Return Empties to Godown</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {historyData?.items?.length ? (
              historyData.items.map((item) => {
                const isExpanded = expandedDate === item.date;

                return (
                  <View key={item.date} style={styles.historyCard}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.historyTop}
                      onPress={() => setExpandedDate(isExpanded ? null : item.date)}
                    >
                      <View style={styles.historyLeft}>
                        <View style={styles.calendarWrap}>
                          <Ionicons
                            name="calendar-outline"
                            size={18}
                            color={DS.orange}
                          />
                        </View>

                        <View>
                          <Text style={styles.historyDate}>
                            {formatDateLabel(item.date)}
                          </Text>

                          <Text style={styles.historyMeta}>
                            Collected:{' '}
                            <Text style={styles.orangeText}>{item.collected}</Text>{' '}
                            Returned:{' '}
                            <Text style={styles.greenText}>{item.returned}</Text>
                          </Text>
                        </View>
                      </View>

                      <Ionicons
                        name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                        size={18}
                        color={DS.textSecondary}
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.historyExpanded}>
                        <View style={styles.historyStatsRow}>
                          <MiniStat
                            value={item.collected}
                            label="Collected"
                            color={DS.orange}
                          />
                          <MiniStat
                            value={item.returned}
                            label="Returned"
                            color={DS.green}
                          />
                          <MiniStat
                            value={item.inHand}
                            label="In Hand"
                            color={DS.textSecondary}
                          />
                        </View>

                        <Text style={styles.historySectionLabel}>Collections</Text>

                        {item.collections?.map((row) => (
                          <View key={`h-col-${row.id}`} style={styles.historyLineCard}>
                            <View>
                              <Text style={styles.infoTitle}>{row.customerName}</Text>
                              <Text style={styles.infoSub}>
                                {row.productType} · {formatTime(row.createdAt)}
                              </Text>
                            </View>

                            <Text style={styles.qtyOrange}>{row.quantity}</Text>
                          </View>
                        ))}

                        <Text style={styles.historySectionLabel}>Returns</Text>

                        {item.returns?.map((row) => (
                          <RequestCard
                            key={`h-ret-${row.id}`}
                            quantity={row.quantity}
                            productName={row.productName}
                            createdAt={row.createdAt}
                            isApproved={row.isApproved}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No history found</Text>
              </View>
            )}
          </>
        )}
      </View>

      <Modal
        visible={returnModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setReturnModalVisible(false);
          resetModal();
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBackdrop}
            onPress={() => {
              setReturnModalVisible(false);
              resetModal();
            }}
          />

          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Return Empty Cylinders</Text>

            <Text style={styles.modalDesc}>
              This request will be sent to the Godown Manager for approval.
            </Text>

            <Text style={styles.inputLabel}>Products to Return</Text>

            {loadingProducts ? (
              <View style={styles.modalLoaderBox}>
                <ActivityIndicator color={DS.primary} />
              </View>
            ) : products.length === 0 ? (
              <View style={styles.modalEmptyBox}>
                <Text style={styles.emptyText}>
                  No empty cylinders available to return
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.returnProductList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {products.map((item) => {
                  const isSelected = selectedProduct?.id === item.id;
                  const maxQty = Number(item.availableQty || 0);

                  return (
                    <View key={item.id}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={[
                          styles.returnProductItem,
                          isSelected && styles.returnProductItemActive,
                        ]}
                        onPress={() => {
                          setSelectedProduct(item);
                          setQuantity('');
                        }}
                      >
                        <View style={styles.returnProductInfo}>
                          <Text style={styles.productName}>{item.name}</Text>
                          <Text style={styles.productType}>
                            {(item.type || '').toString()}
                            {item.categoryName ? ` · ${item.categoryName}` : ''}
                          </Text>
                        </View>

                        <View style={styles.returnProductQtyPill}>
                          <Text style={styles.returnProductQtyText}>{maxQty}</Text>
                          <Text style={styles.returnProductQtyLabel}>available</Text>
                        </View>
                      </TouchableOpacity>

                      {isSelected && (
                        <View style={styles.inlineQtyBox}>
                          <Text style={styles.inputLabel}>
                            Number of Cylinders to Return
                          </Text>
                          <TextInput
                            value={quantity}
                            onChangeText={(value) =>
                              setQuantity(value.replace(/[^0-9]/g, ''))
                            }
                            placeholder={`Enter count (max ${maxQty})`}
                            placeholderTextColor={DS.textTertiary}
                            keyboardType="numeric"
                            style={styles.modalInput}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                styles.modalButton,
                (submitting || !selectedProduct || !quantity) && styles.disabledButton,
              ]}
              activeOpacity={0.85}
              onPress={submitReturnRequest}
              disabled={submitting || !selectedProduct || !quantity}
            >
              {submitting ? (
                <ActivityIndicator color={DS.white} />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={22} color={DS.white} />
                  <Text style={styles.modalButtonText}>Send for Approval</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

function MiniStat({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function RequestCard({
  quantity,
  productName,
  createdAt,
  isApproved,
}: {
  quantity: number;
  productName?: string;
  createdAt: string;
  isApproved: number;
}) {
  const approved = Number(isApproved) === 1;

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestLeft}>
        <Ionicons
          name={approved ? 'checkmark-circle-outline' : 'time-outline'}
          size={20}
          color={approved ? DS.green : DS.orange}
          style={styles.requestIcon}
        />

        <View>
          <Text style={styles.requestTitle}>
            {quantity} {quantity === 1 ? 'Cylinder' : 'Cylinders'}
          </Text>

          {!!productName && <Text style={styles.requestProduct}>{productName}</Text>}

          <Text style={styles.requestTime}>{formatTime(createdAt)}</Text>
        </View>
      </View>

      <View style={[styles.badge, approved ? styles.approvedBadge : styles.pendingBadge]}>
        <Text style={[styles.badgeText, approved ? styles.approvedText : styles.pendingText]}>
          {approved ? 'Approved' : 'Awaiting Approval'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  backButton: {
    marginRight: 14,
    padding: 2,
  },

  pageTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },

  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: DS.surface,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: 16,
  },

  segmentTab: {
    flex: 1,
    height: 42,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  segmentTabActive: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
  },

  segmentText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textSecondary,
  },

  segmentTextActive: {
    color: DS.textPrimary,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },

  statCard: {
    flex: 1,
    backgroundColor: DS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    paddingVertical: 16,
    alignItems: 'center',
  },

  statValue: {
    ...TYPO.h5,
    marginBottom: 4,
  },

  statLabel: {
    ...TYPO.c2,
    color: DS.textSecondary,
  },

  sectionTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginBottom: 10,
    marginTop: 4,
  },

  infoCard: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  infoTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },

  infoSub: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 3,
  },

  qtyOrange: {
    ...TYPO.h5,
    color: DS.orange,
  },

  requestCard: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  requestLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  requestIcon: {
    marginRight: 8,
  },

  requestTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },

  requestProduct: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 2,
  },

  requestTime: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 2,
  },

  badge: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginLeft: 8,
  },

  approvedBadge: {
    backgroundColor: DS.greenSoft,
  },

  pendingBadge: {
    backgroundColor: DS.orangeSoft,
  },

  badgeText: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
  },

  approvedText: {
    color: PALETTE.green600,
  },

  pendingText: {
    color: DS.orangeText,
  },

  returnButton: {
    height: 60,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },

  returnButtonText: {
    ...TYPO.s2,
    color: DS.white,
  },

  historyCard: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    marginBottom: 12,
    overflow: 'hidden',
  },

  historyTop: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  calendarWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: DS.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  historyDate: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },

  historyMeta: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 3,
  },

  orangeText: {
    color: DS.orange,
    fontWeight: WEIGHT.semibold,
  },

  greenText: {
    color: PALETTE.green600,
    fontWeight: WEIGHT.semibold,
  },

  historyExpanded: {
    borderTopWidth: 1,
    borderTopColor: DS.divider,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },

  historyStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },

  miniStat: {
    flex: 1,
    backgroundColor: DS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },

  miniStatValue: {
    ...TYPO.s1,
  },

  miniStatLabel: {
    ...TYPO.c3,
    color: DS.textSecondary,
    marginTop: 3,
  },

  historySectionLabel: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },

  historyLineCard: {
    backgroundColor: DS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  emptyBox: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 14,
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
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  modalSheet: {
    backgroundColor: DS.white,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 22,
  },

  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: DS.grey300,
    alignSelf: 'center',
    marginBottom: 22,
  },

  modalTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginBottom: 16,
  },

  modalDesc: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginBottom: 18,
  },

  inputLabel: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
    marginBottom: 8,
  },

  modalInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    backgroundColor: DS.white,
    ...TYPO.b2,
    color: DS.textPrimary,
    marginBottom: 16,
  },

  productDropdown: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    maxHeight: 180,
    marginTop: -10,
    marginBottom: 16,
    overflow: 'hidden',
  },

  modalLoaderBox: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  modalEmptyBox: {
    backgroundColor: DS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: 16,
  },

  returnProductList: {
    maxHeight: 320,
    marginBottom: 16,
  },

  returnProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: DS.white,
  },

  returnProductItemActive: {
    borderColor: DS.primary,
    backgroundColor: DS.primarySoft,
  },

  returnProductInfo: {
    flex: 1,
    marginRight: 12,
  },

  returnProductQtyPill: {
    alignItems: 'center',
    minWidth: 64,
  },

  returnProductQtyText: {
    ...TYPO.h5,
    color: DS.orange,
  },

  returnProductQtyLabel: {
    ...TYPO.c3,
    color: DS.textSecondary,
  },

  inlineQtyBox: {
    marginTop: -2,
    marginBottom: 12,
  },

  productItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DS.divider,
  },

  productName: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
  },

  productType: {
    ...TYPO.c3,
    color: DS.textSecondary,
    marginTop: 2,
  },

  selectedProductBox: {
    backgroundColor: DS.greenSoft,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },

  selectedProductText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: PALETTE.green600,
    flex: 1,
  },

  modalButton: {
    height: 60,
    backgroundColor: DS.primary,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 2,
  },

  modalButtonText: {
    ...TYPO.s2,
    color: DS.white,
  },

  disabledButton: {
    opacity: 0.65,
  },
});