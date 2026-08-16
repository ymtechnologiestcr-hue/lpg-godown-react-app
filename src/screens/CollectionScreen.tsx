import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import ScreenContainer from "../components/common/ScreenContainer";
import SettleAmountModal from "../components/ui/SettleAmountModal";
import UpiPaymentModal from "../components/ui/UpiPaymentModal";
import { AUTH_USER_KEY } from "../constants/auth";
import { DS, PALETTE, RADIUS, TYPO, WEIGHT } from "../constants/designSystem";
import { useDateRange } from "../context/DateRangeContext";
import api from "../services/api";

type CollectionStatus = "ASSIGNED" | "PENDING" | "SETTLED" | "APPROVED" | null;

type CollectionCardData = {
  amount: number;
  count: number;
  status: CollectionStatus;
  transactions: any[];
  displayMessage?: string;
};

type CollectionSummaryResponse = {
  summary: {
    cashCollected: number;
    upiCollected: number;
    onlineCollected?: number;
    creditCollected?: number;
    totalCollected: number;
    totalDeliveries: number;
    totalSettled?: number;
  };
  settlements: {
    cashAssigned: CollectionCardData;
    cashPending: CollectionCardData;
    upiAssigned: CollectionCardData;
    upiPending: CollectionCardData;
  };
};

type CollectionHistoryTransaction = {
  saleId: number;
  customerName: string;
  amount: number;
  paymentMode: string;
  deliveredAt: string;
  status: CollectionStatus;
};

type CollectionHistoryDayItem = {
  date: string;
  totalAmount: number;
  summary: {
    cash: {
      amount: number;
      status: CollectionStatus;
      settledAt: string | null;
    };
    upi: {
      amount: number;
      status: CollectionStatus;
      settledAt: string | null;
    };
  };
  transactions: CollectionHistoryTransaction[];
};

type CollectionHistoryResponse = {
  items: CollectionHistoryDayItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

const formatAmount = (value?: number) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const formatTime = (dateString?: string | null) => {
  if (!dateString) return "";

  try {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const formatDateLabel = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

const getPaymentLabel = (method?: string) => {
  const value = String(method || "").toUpperCase();

  if (value === "CARD" || value === "ONLINE") return "Online";
  if (value === "CASH") return "Cash";
  if (value === "UPI") return "UPI";

  return value || "N/A";
};

const TEXT_BLACK = DS.textPrimary;

function CollectionActionCard({
  type,
  title,
  amount,
  count,
  status,
  loading,
  onPress,
}: {
  type: "CASH" | "UPI";
  title: string;
  amount: number;
  count: number;
  status: CollectionStatus;
  loading: boolean;
  onPress: () => void;
}) {
  const isAssigned = status === "ASSIGNED";
  const isPending = status === "PENDING";

  const icon = type === "CASH" ? "wallet-outline" : "phone-portrait-outline";
  const color = type === "CASH" ? DS.green : DS.primary;
  const bg = type === "CASH" ? DS.greenSoft : DS.primarySoft;

  return (
    <View style={styles.collectionCard}>
      <View style={styles.collectionTopRow}>
        <View style={styles.collectionTitleRow}>
          <View style={[styles.iconWrap, { backgroundColor: bg }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>

          <View>
            <Text style={styles.collectionTitle}>{title}</Text>
            <Text style={styles.collectionAmount}>{formatAmount(amount)}</Text>
          </View>
        </View>

        {isPending && (
          <View style={styles.pendingPill}>
            <Ionicons name="time-outline" size={14} color={DS.orange} />
            <Text style={styles.pendingPillText}>
              Pending for Cashier Approval
            </Text>
          </View>
        )}
      </View>

      <View style={styles.collectionInfoRow}>
        <Text style={styles.collectionInfoText}>
          {count} {isAssigned ? "assigned" : "pending"} payments
        </Text>

        <Text style={styles.collectionInfoAmount}>{formatAmount(amount)}</Text>
      </View>

      {isAssigned && (
        <TouchableOpacity
          style={[
            styles.collectionButton,
            {
              backgroundColor: type === "CASH" ? DS.buttonGreen : DS.primary,
            },
          ]}
          onPress={onPress}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={DS.white} />
          ) : (
            <>
              <Ionicons
                name={type === "CASH" ? "cash-outline" : "card-outline"}
                size={16}
                color={DS.white}
              />
              <Text style={styles.collectionButtonText}>Settle Amount</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function CollectionScreen() {
  const { range, rangeKey } = useDateRange();
  const [driverId, setDriverId] = useState<number | null>(null);
  const [driverName, setDriverName] = useState("");

  const [activeTab, setActiveTab] = useState<"summary" | "history">("summary");

  const [summaryData, setSummaryData] =
    useState<CollectionSummaryResponse | null>(null);

  const [historyData, setHistoryData] =
    useState<CollectionHistoryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [settlingMethod, setSettlingMethod] = useState<
    "UPI" | "TOTAL_UPI" | "CASH" | "ONLINE" | null
  >(null);
  const [upiModalVisible, setUpiModalVisible] = useState(false);
  const [pendingUpiAmount, setPendingUpiAmount] = useState(0);

  useEffect(() => {
    const loadDriverId = async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const id = Number(parsed?.id);

        setDriverId(id && !Number.isNaN(id) ? id : null);
        if (parsed?.name) {
          setDriverName(parsed.name);
        }
      } catch {
        setDriverId(null);
      }
    };

    loadDriverId();
  }, []);



  const fetchCollectionSummary = useCallback(async () => {
    if (!driverId) return;

    const { startDate, endDate } = range;
    const response = await api.get(`/drivers/${driverId}/collection-summary?startDate=${startDate}&endDate=${endDate}`);

    if (response.data?.success) {
      setSummaryData(response.data.data);
    }
  }, [driverId, range]);

  const fetchCollectionHistory = useCallback(
    async (page = 1) => {
      if (!driverId) return;

      const response = await api.get(
        `/drivers/${driverId}/profile-history?page=${page}&limit=4`,
      );

      if (response.data?.success) {
        if (page === 1) {
          setHistoryData(response.data.data);
        } else {
          setHistoryData((prev) => {
            if (!prev) return response.data.data;
            return {
              ...response.data.data,
              items: [...prev.items, ...response.data.data.items],
            };
          });
        }
        if (response.data.data?.driver?.name) {
          setDriverName(response.data.data.driver.name);
        }
      }
    },
    [driverId],
  );

  const loadScreen = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (activeTab === "summary") {
        await fetchCollectionSummary();
      } else {
        await fetchCollectionHistory(historyPage);
      }
    } catch (err: any) {
      setError("Failed to load data");
      Alert.alert("Error", err?.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchCollectionSummary, fetchCollectionHistory, historyPage]);

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [loadScreen, rangeKey])
  );

  const onRefresh = async () => {
    try {
      setRefreshing(true);

      if (activeTab === "summary") {
        await fetchCollectionSummary();
      } else {
        await fetchCollectionHistory(historyPage);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const refreshAfterSettlement = async () => {
    await fetchCollectionSummary();
    await fetchCollectionHistory(historyPage);
  };

  const handleSettleSubmit = async (payload: {
    method: "CASH" | "UPI" | "ONLINE";
    amount: number;
    denominations?: any;
  }) => {
    if (!driverId) {
      Alert.alert("Error", "Driver session not found");
      return;
    }

    try {
      if (payload.method === "UPI" || payload.method === "ONLINE") {
        setPendingUpiAmount(payload.amount);
        setSettleModalVisible(false);
        setUpiModalVisible(true);
      } else {
        setSettlingMethod("CASH");
        const response = await api.put(
          `/drivers/${driverId}/settle-collections`,
          payload
        );

        if (response.data?.success) {
          setSettleModalVisible(false);
          Alert.alert("Success", "Collection sent for cashier approval");
          await refreshAfterSettlement();
        }
        setSettlingMethod(null);
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to settle collection"
      );
      setSettlingMethod(null);
    }
  };

  const handleUpiSubmit = async (payload: {
    method: "UPI";
    amount: number;
    paymentApp: string;
  }) => {
    if (!driverId) return;

    try {
      setSettlingMethod("UPI");
      
      const initiateRes = await api.post("/manual-payment/initiate", {
        amount: payload.amount,
        driverId,
        method: "UPI",
        paymentApp: payload.paymentApp,
      });

      if (!initiateRes.data?.success) {
        Alert.alert("Error", "Failed to initiate payment");
        setSettlingMethod(null);
        return;
      }

      const verifyRes = await api.post("/manual-payment/verify", {
        order_id: initiateRes.data.order_id,
        status: "SUCCESS"
      });

      if (verifyRes.data?.success) {
        const response = await api.put(
          `/drivers/${driverId}/settle-collections`,
          { method: "UPI", amount: payload.amount }
        );

        if (response.data?.success) {
          setUpiModalVisible(false);
          Alert.alert("Success", "Collection sent for cashier approval");
          await refreshAfterSettlement();
        }
      } else {
         Alert.alert("Error", "Failed to verify payment");
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to settle collection via UPI"
      );
    } finally {
      setSettlingMethod(null);
    }
  };

  const cashAssigned = summaryData?.settlements?.cashAssigned;
  const cashPending = summaryData?.settlements?.cashPending;

  const upiAssigned = summaryData?.settlements?.upiAssigned;
  const upiPending = summaryData?.settlements?.upiPending;

  const totalAmount = summaryData?.summary?.totalCollected ?? 0;

  const assignedTotal =
    Number(cashAssigned?.amount || 0) + Number(upiAssigned?.amount || 0);

  const currentFormattedDate = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.customHeader}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerDriverName}>{driverName || "Driver"}</Text>
            <Text style={styles.headerDate}>{currentFormattedDate}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "summary" && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab("summary")}
          >
            <Ionicons
              name="card-outline"
              size={18}
              color={activeTab === "summary" ? TEXT_BLACK : DS.textSecondary}
            />

            <Text
              style={[
                styles.tabText,
                activeTab === "summary" && styles.activeTabText,
              ]}
            >
              Collection Summary
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "history" && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab("history")}
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={activeTab === "history" ? TEXT_BLACK : DS.textSecondary}
            />

            <Text
              style={[
                styles.tabText,
                activeTab === "history" && styles.activeTabText,
              ]}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={DS.primary}
            style={{ marginTop: 40 }}
          />
        ) : activeTab === "summary" ? (
          <>
            <View style={styles.blueBannerCard}>
              <Text style={styles.blueBannerTitle}>TODAY&apos;S TOTAL COLLECTION</Text>
              <Text style={styles.blueBannerAmount}>{formatAmount(summaryData?.summary?.totalCollected)}</Text>
              <View style={styles.blueBannerStatsRow}>
                <View style={styles.blueBannerStatCard}>
                  <Text style={styles.blueBannerStatLabel}>Deliveries</Text>
                  <Text style={styles.blueBannerStatValue}>{summaryData?.summary?.totalDeliveries || 0}</Text>
                </View>
                <View style={styles.blueBannerStatCard}>
                  <Text style={styles.blueBannerStatLabel}>Settled</Text>
                  <Text style={styles.blueBannerStatValue}>{formatAmount(summaryData?.summary?.totalSettled || 0)}</Text>
                </View>
                <View style={styles.blueBannerStatCard}>
                  <Text style={styles.blueBannerStatLabel}>Balance</Text>
                  <Text style={styles.blueBannerStatValue}>{formatAmount((summaryData?.summary?.totalCollected || 0) - (summaryData?.summary?.totalSettled || 0))}</Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryCardContainer}>
              <Text style={styles.splitAmountsTitle}>Split Amounts</Text>

              <View style={styles.splitRow}>
                <View style={styles.splitLabelRow}>
                  <View style={[styles.splitIconWrap, { backgroundColor: '#E1F4E5' }]}>
                    <Ionicons name="cash-outline" size={16} color="#2E7D32" />
                  </View>
                  <Text style={styles.splitLabel}>Cash</Text>
                </View>
                <Text style={styles.splitAmount}>{formatAmount(summaryData?.summary?.cashCollected)}</Text>
              </View>

              <View style={styles.splitDivider} />

              <View style={styles.splitRow}>
                <View style={styles.splitLabelRow}>
                  <View style={[styles.splitIconWrap, { backgroundColor: '#E3F2FD' }]}>
                    <Ionicons name="phone-portrait-outline" size={16} color="#1565C0" />
                  </View>
                  <Text style={styles.splitLabel}>UPI</Text>
                </View>
                <Text style={styles.splitAmount}>{formatAmount(summaryData?.summary?.upiCollected)}</Text>
              </View>

              <View style={styles.splitDivider} />

              <View style={styles.splitRow}>
                <View style={styles.splitLabelRow}>
                  <View style={[styles.splitIconWrap, { backgroundColor: '#E3F2FD' }]}>
                    <Ionicons name="card-outline" size={16} color="#1565C0" />
                  </View>
                  <Text style={styles.splitLabel}>Online</Text>
                </View>
                <Text style={styles.splitAmount}>{formatAmount(summaryData?.summary?.onlineCollected || 0)}</Text>
              </View>

              <View style={styles.splitDivider} />

              <View style={styles.splitRow}>
                <View style={styles.splitLabelRow}>
                  <View style={[styles.splitIconWrap, { backgroundColor: '#FFF3E0' }]}>
                    <Ionicons name="time-outline" size={16} color="#E65100" />
                  </View>
                  <Text style={styles.splitLabel}>Credit</Text>
                </View>
                <Text style={styles.splitAmount}>{formatAmount(summaryData?.summary?.creditCollected || 0)}</Text>
              </View>
              
              <View style={styles.splitDivider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>{formatAmount(summaryData?.summary?.totalCollected)}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.ctaButton,
                  assignedTotal === 0 && styles.ctaButtonDisabled
                ]}
                disabled={assignedTotal === 0}
                onPress={() => setSettleModalVisible(true)}
              >
                <Text style={styles.ctaButtonText}>Settle the Amount</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settlementRequestsContainer}>
              <View style={styles.settlementRequestsHeader}>
                <View>
                  <Text style={styles.settlementRequestsTitle}>Settlement Requests</Text>
                  <Text style={styles.settlementRequestsTotalPending}>
                    Total Pending: {formatAmount(Number(cashPending?.amount || 0) + Number(upiPending?.amount || 0))}
                  </Text>
                </View>
                <Text style={styles.settlementRequestsCount}>
                  {Number(cashPending?.count || 0) + Number(upiPending?.count || 0)} request(s)
                </Text>
              </View>

              {(Number(cashPending?.count || 0) + Number(upiPending?.count || 0)) === 0 ? (
                <View style={styles.emptyRequestsWrapper}>
                  <Text style={styles.emptyRequestsText}>No settlement requests yet</Text>
                </View>
              ) : (
                <View style={styles.pendingRequestsList}>
                  {cashPending?.transactions?.map((tx: any, index: number) => (
                    <View key={`cash-${tx.id || index}`} style={styles.pendingRequestItem}>
                      <View style={styles.pendingRequestInfo}>
                        <Text style={styles.pendingRequestMethod}>Cash</Text>
                        <Text style={styles.pendingRequestMessage}>
                          {tx.customerName ? `Customer: ${tx.customerName}` : cashPending.displayMessage || "Pending for approval"}
                        </Text>
                      </View>
                      <Text style={styles.pendingRequestAmount}>
                        {formatAmount(tx.amount)}
                      </Text>
                    </View>
                  ))}
                  {upiPending?.transactions?.map((tx: any, index: number) => (
                    <View key={`upi-${tx.id || index}`} style={styles.pendingRequestItem}>
                      <View style={styles.pendingRequestInfo}>
                        <Text style={styles.pendingRequestMethod}>UPI</Text>
                        <Text style={styles.pendingRequestMessage}>
                          {tx.customerName ? `Customer: ${tx.customerName}` : upiPending.displayMessage || "Pending for approval"}
                        </Text>
                      </View>
                      <Text style={styles.pendingRequestAmount}>
                        {formatAmount(tx.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : (
          <>
            {historyData?.items?.map((group, index) => (
              <View key={index} style={styles.historyGroup}>
                <View style={styles.historyHeader}>
                  <View style={styles.historyDateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={DS.textSecondary}
                    />

                    <Text style={styles.historyDate}>
                      {formatDateLabel(group.date)}
                    </Text>
                  </View>

                  <Text style={styles.historyTotal}>
                    {formatAmount(group.totalAmount)}
                  </Text>
                </View>

                {group.transactions?.map((item: any, transactionIndex: number) => (
                  <View
                    key={transactionIndex}
                    style={styles.historyTransaction}
                  >
                    <View
                      style={[
                        styles.iconWrap,
                        {
                          backgroundColor:
                            item.paymentMode === "CASH"
                              ? DS.greenSoft
                              : DS.primarySoft,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          item.paymentMode === "CASH"
                            ? "wallet-outline"
                            : "phone-portrait-outline"
                        }
                        size={18}
                        color={
                          item.paymentMode === "CASH" ? DS.green : DS.primary
                        }
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerName}>
                        {item.customerName}
                      </Text>

                      <Text style={styles.customerMeta}>
                        Qty: {item.quantity} · {getPaymentLabel(item.paymentMode)}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.transactionAmount}>
                        {formatAmount(item.totalAmount)}
                      </Text>

                      <View style={styles.paidPill}>
                        <Text style={styles.paidText}>Paid</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ))}
            
            {historyData?.pagination?.hasNextPage && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() => setHistoryPage((p) => p + 1)}
              >
                <Text style={styles.loadMoreText}>Load More</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      <SettleAmountModal
        visible={settleModalVisible}
        dueAmount={assignedTotal}
        loading={!!settlingMethod}
        onClose={() => setSettleModalVisible(false)}
        onSubmit={handleSettleSubmit}
        settlements={summaryData?.settlements}
      />
      <UpiPaymentModal
        visible={upiModalVisible}
        dueAmount={pendingUpiAmount}
        loading={!!settlingMethod}
        onClose={() => setUpiModalVisible(false)}
        onSubmit={handleUpiSubmit as any}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  customHeader: {
    backgroundColor: '#1E65F3',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerDriverName: {
    ...TYPO.h5,
    color: DS.white,
  },
  headerDate: {
    ...TYPO.b4,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCardContainer: {
    backgroundColor: DS.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: DS.border,
  },
  blueBannerCard: {
    backgroundColor: '#1E65F3',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  blueBannerTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  blueBannerAmount: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 20,
  },
  blueBannerStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  blueBannerStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 10,
  },
  blueBannerStatLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
  },
  blueBannerStatValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  splitAmountsTitle: {
    ...TYPO.s2,
    color: TEXT_BLACK,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  splitLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  splitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitLabel: {
    ...TYPO.s2,
    color: TEXT_BLACK,
    fontWeight: '600',
  },
  splitAmount: {
    ...TYPO.s2,
    color: TEXT_BLACK,
    fontWeight: 'bold',
  },
  splitDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  totalLabel: {
    ...TYPO.s2,
    color: TEXT_BLACK,
    fontWeight: 'bold',
  },
  totalAmount: {
    ...TYPO.s1,
    color: '#1E65F3',
    fontWeight: 'bold',
  },
  ctaButton: {
    backgroundColor: '#1E65F3',
    width: '100%',
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaButtonDisabled: {
    backgroundColor: DS.grey300,
  },
  ctaButtonText: {
    ...TYPO.s2,
    color: DS.white,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },

  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: RADIUS.lg,
    padding: 4,
    marginBottom: 18,
  },

  tabButton: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  activeTabButton: {
    backgroundColor: DS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  tabText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textSecondary,
  },

  activeTabText: {
    color: TEXT_BLACK,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: DS.white,
    borderRadius: RADIUS.xl,
    paddingVertical: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: DS.border,
  },

  summaryIconWrap: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  summaryAmount: {
    ...TYPO.h5,
    color: TEXT_BLACK,
    marginBottom: 8,
  },

  summaryLabel: {
    ...TYPO.c2,
    color: DS.textSecondary,
  },

  collectionCard: {
    backgroundColor: DS.white,
    borderRadius: RADIUS.xxl,
    padding: 18,
    borderWidth: 1,
    borderColor: DS.border,
    marginBottom: 18,
  },

  collectionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  collectionTitleRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  collectionTitle: {
    ...TYPO.s2,
    color: TEXT_BLACK,
  },

  collectionAmount: {
    ...TYPO.s2,
    color: TEXT_BLACK,
    marginTop: 2,
  },

  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: DS.orangeSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    maxWidth: 160,
  },

  pendingPillText: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
    color: DS.orangeText,
  },

  collectionInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  collectionInfoText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: TEXT_BLACK,
  },

  collectionInfoAmount: {
    ...TYPO.s2,
    color: TEXT_BLACK,
  },

  collectionButton: {
    height: 54,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },

  collectionButtonText: {
    ...TYPO.s2,
    color: DS.white,
  },

  totalCard: {
    backgroundColor: DS.white,
    borderRadius: RADIUS.xxl,
    padding: 18,
    borderWidth: 1,
    borderColor: DS.border,
    marginBottom: 18,
  },

  historyGroup: {
    backgroundColor: DS.white,
    borderRadius: RADIUS.xxl,
    padding: 18,
    borderWidth: 1,
    borderColor: DS.border,
    marginBottom: 18,
  },

  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  historyDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  historyDate: {
    ...TYPO.s2,
    color: TEXT_BLACK,
  },

  historyTotal: {
    ...TYPO.s1,
    color: DS.primary,
  },

  summaryStatusRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  historyStatusCard: {
    flex: 1,
    backgroundColor: DS.greenSoft,
    borderRadius: RADIUS.lg,
    padding: 14,
  },

  historyStatusTitle: {
    ...TYPO.s2,
    color: PALETTE.green600,
    marginBottom: 6,
  },

  historyStatusText: {
    ...TYPO.c2,
    color: PALETTE.green600,
  },

  historyTransaction: {
    backgroundColor: DS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  customerName: {
    ...TYPO.s2,
    color: TEXT_BLACK,
    marginBottom: 4,
  },

  customerMeta: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },

  transactionAmount: {
    ...TYPO.s2,
    color: TEXT_BLACK,
    marginBottom: 6,
  },

  paidPill: {
    backgroundColor: DS.greenSoft,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },

  paidText: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
    color: PALETTE.green600,
  },
  loadMoreButton: {
    padding: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    ...TYPO.b4,
    color: DS.primary,
    fontWeight: WEIGHT.semibold,
  },
  settlementRequestsContainer: {
    backgroundColor: DS.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: DS.border,
  },
  settlementRequestsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settlementRequestsTitle: {
    ...TYPO.s2,
    color: TEXT_BLACK,
    fontWeight: 'bold',
  },
  settlementRequestsTotalPending: {
    ...TYPO.b4,
    color: DS.textSecondary,
    marginTop: 4,
  },
  settlementRequestsCount: {
    ...TYPO.c2,
    color: DS.textSecondary,
  },
  emptyRequestsWrapper: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyRequestsText: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },
  pendingRequestsList: {
    gap: 12,
  },
  pendingRequestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  pendingRequestInfo: {
    gap: 4,
  },
  pendingRequestMethod: {
    ...TYPO.s2,
    color: TEXT_BLACK,
    fontWeight: '600',
  },
  pendingRequestMessage: {
    ...TYPO.c2,
    color: DS.orange,
  },
  pendingRequestAmount: {
    ...TYPO.s2,
    color: TEXT_BLACK,
    fontWeight: 'bold',
  }
});
