import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppHeader from "../components/common/AppHeader";
import ScreenContainer from "../components/common/ScreenContainer";
import { AUTH_USER_KEY } from "../constants/auth";
import { DS, PALETTE, RADIUS, TYPO, WEIGHT } from "../constants/designSystem";
import { useDateRange } from "../context/DateRangeContext";
import api from "../services/api";
import { DriverDeliveriesResponse } from "../types";

const formatTime = (value?: string | null) => {
  if (!value) return "";
  try {
    const date = new Date(value);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
};

export default function DeliveredCylindersScreen() {
  const router = useRouter();
  const { rangeKey } = useDateRange();
  const [driverId, setDriverId] = useState<number | null>(null);
  const [data, setData] = useState<DriverDeliveriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDriverId = async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const id = Number(parsed?.id);

        if (id && !Number.isNaN(id)) {
          setDriverId(id);
        } else {
          setError("Driver not found in session");
          setLoading(false);
        }
      } catch {
        setError("Failed to load driver session");
        setLoading(false);
      }
    };

    loadDriverId();
  }, []);

  const fetchDeliveredDeliveries = useCallback(async () => {
    if (!driverId) {
      return;
    }

    try {
      setError("");
      const response = await api.get(
        `/drivers/${driverId}/app-deliveries?flag=delivered`,
      );

      if (response.data?.success) {
        setData(response.data.data);
      } else {
        setError("Failed to load delivered cylinders");
      }
    } catch (err: any) {
      console.error(
        "fetchDeliveredDeliveries error:",
        err?.response?.data || err.message,
      );
      setError("Failed to load delivered cylinders");
    }
  }, [driverId]);

  useEffect(() => {
    const load = async () => {
      if (!driverId) {
        return;
      }

      setLoading(true);
      await fetchDeliveredDeliveries();
      setLoading(false);
    };

    load();
  }, [fetchDeliveredDeliveries, driverId, rangeKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDeliveredDeliveries();
    setRefreshing(false);
  };

  const deliveredCount = useMemo(() => {
    return data?.deliveries?.length ?? 0;
  }, [data]);

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
          <Text style={styles.pageTitle}>Delivered Cylinders</Text>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={DS.primary} />
            <Text style={styles.infoText}>Loading delivered cylinders...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchDeliveredDeliveries}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryIconWrap}>
                  <Image
                    source={require("../../assets/images/Cylinder.png")}
                    style={{ width: 42, height: 48, resizeMode: "contain" }}
                  />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { marginTop: 0, marginRight: 6 },
                    ]}
                  >
                    Total Deliveries Today :
                  </Text>
                  <Text style={[styles.summaryValue, { marginRight: 6 }]}>
                    {deliveredCount}
                  </Text>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={22}
                    color={DS.green}
                  />
                </View>
              </View>
            </View>

            {data?.deliveries?.length ? (
              data.deliveries.map((item) => (
                <View key={item.saleId} style={styles.deliveryCard}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardInfoWrap}>
                      <Text style={styles.name}>{item.customerName}</Text>

                      {item.consumerNumber ? (
                        <View style={styles.consumerNumberRow}>
                          <Text style={styles.consumerNumberText}>
                            Consumer No: {item.consumerNumber}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.addressRow}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color={DS.textSecondary}
                        />
                        <Text style={styles.address}>{item.address}</Text>
                      </View>

                      <Text style={styles.meta}>
                        {item.product} · Qty: {item.quantity} · ₹
                        {item.totalAmount}
                      </Text>
                    </View>

                    <View style={styles.rightWrap}>
                      <View style={styles.paymentBadge}>
                        <Text style={styles.paymentBadgeText}>
                          {item.paymentMode === "CARD"
                            ? "Online"
                            : item.paymentMode}
                        </Text>
                      </View>

                      <Text style={styles.timeText}>
                        {formatTime(item.deliveredAt || item.createdAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.infoText}>
                  No delivered cylinders found
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
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
  summaryCard: {
    backgroundColor: DS.greenSoft,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PALETTE.green100,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  summaryValue: {
    ...TYPO.s1,
    color: PALETTE.green600,
  },
  summaryLabel: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 2,
  },
  deliveryCard: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardInfoWrap: {
    flex: 1,
  },
  name: {
    ...TYPO.s2,
    color: DS.textPrimary,
    marginBottom: 6,
  },
  consumerNumberRow: {
    marginBottom: 6,
  },
  consumerNumberText: {
    ...TYPO.b3,
    color: PALETTE.blue600,
    fontWeight: "500",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  address: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginLeft: 4,
    flexShrink: 1,
  },
  meta: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 2,
  },
  rightWrap: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  paymentBadge: {
    backgroundColor: DS.greenSoft,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 48,
    alignItems: "center",
  },
  paymentBadgeText: {
    ...TYPO.c2,
    fontWeight: WEIGHT.semibold,
    color: PALETTE.green600,
  },
  timeText: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 10,
  },
  centerBox: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
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
  emptyBox: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    padding: 18,
    alignItems: "center",
  },
});
