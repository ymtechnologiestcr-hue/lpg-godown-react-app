import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import AppHeader from "../components/common/AppHeader";
import ScreenContainer from "../components/common/ScreenContainer";
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from "../constants/auth";
import {
  DS,
  EYEBROW,
  PALETTE,
  RADIUS,
  TYPO,
  WEIGHT,
} from "../constants/designSystem";
import { useDateRange } from "../context/DateRangeContext";
import api from "../services/api";

type DriverProfileDelivery = {
  saleId: number;
  customerName: string;
  address: string;
  cylinderType: string;
  quantity: number;
  totalAmount: number;
  paymentMode: string;
  deliveredAt: string;
};

type DriverProfileDay = {
  date: string;
  totalAmount: number;
  totalDeliveries: number;
  deliveries: DriverProfileDelivery[];
};

type DriverProfileResponse = {
  driver: {
    id: number;
    name: string;
    phone: string;
    vehicleNumber: string;
  };
  performance: {
    today: number;
    thisWeek: number;
    total: number;
  };
  items: DriverProfileDay[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

type BookingItem = {
  saleId: number;
  customerName: string;
  phone: string;
  address: string;
  status: "PENDING" | "ASSIGNED" | "DELIVERED" | "CANCELLED";
  totalAmount: number;
  totalQty: number;
  cylinderType: "DOMESTIC" | "COMMERCIAL";
  productSummary: string;
  createdAt: string;
  deliveredAt?: string | null;
};

type BookingsResponse = {
  total: number;
  items: BookingItem[];
};

type ProfileScreenProps = {
  onRoleChange?: () => void;
};

const formatTime = (value?: string | null) => {
  if (!value) return "";

  try {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const formatDateLabel = (dateString: string) => {
  try {
    const date = new Date(dateString);
    const today = new Date();

    const formatted = date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    if (date.toDateString() === today.toDateString()) {
      return `Today — ${formatted}`;
    }

    return formatted;
  } catch {
    return dateString;
  }
};

const getPaymentLabel = (mode?: string) => {
  if (!mode) return "N/A";

  const value = mode.toUpperCase();

  if (value === "CARD" || value === "ONLINE") return "Online";
  if (value === "CASH") return "Cash";
  if (value === "UPI") return "UPI";
  if (value === "CREDIT") return "Credit";

  return value;
};

const getInitials = (name?: string) => {
  if (!name) return "DR";

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const getStatusLabel = (status: string) => {
  if (status === "PENDING") return "Pending";
  if (status === "DELIVERED") return "Delivered";
  if (status === "CANCELLED") return "Cancelled";
  return status;
};

export default function ProfileScreen({ onRoleChange }: ProfileScreenProps) {
  const { rangeKey } = useDateRange();
  const [driverId, setDriverId] = useState<number | null>(null);
  const [screenMode, setScreenMode] = useState<"PROFILE" | "BOOKINGS">(
    "PROFILE",
  );

  const [data, setData] = useState<DriverProfileResponse | null>(null);
  const [bookings, setBookings] = useState<BookingsResponse>({
    total: 0,
    items: [],
  });

  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(
    null,
  );
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchProfileHistory = useCallback(
    async (pageNumber = 1) => {
      try {
        setError("");

        if (!driverId) {
          setError("Driver session not found");
          return;
        }

        const response = await api.get(
          `/drivers/${driverId}/profile-history?page=${pageNumber}&limit=4`,
        );

        if (response.data?.success) {
          setData(response.data.data);
        } else {
          setError("Failed to load profile history");
        }
      } catch (err: any) {
        console.error(
          "fetchProfileHistory error:",
          err?.response?.data || err.message,
        );
        setError("Failed to load profile history");
      }
    },
    [driverId],
  );

  const fetchBookings = useCallback(async () => {
    try {
      setBookingsLoading(true);

      if (!driverId) {
        return;
      }

      const response = await api.get(`/drivers/${driverId}/bookings`);

      if (response.data?.success) {
        setBookings({
          total: response.data.data?.total || 0,
          items: response.data.data?.items || [],
        });
      }
    } catch (err: any) {
      console.error("fetchBookings error:", err?.response?.data || err.message);
    } finally {
      setBookingsLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    const loadDriverId = async () => {
      try {
        const userText = await AsyncStorage.getItem(AUTH_USER_KEY);
        const user = userText ? JSON.parse(userText) : null;
        const userId = Number(user?.id);

        if (!Number.isNaN(userId) && userId > 0) {
          setDriverId(userId);
        } else {
          setError("Driver session not found");
        }
      } catch {
        setError("Driver session not found");
      }
    };

    loadDriverId();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!driverId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      await Promise.all([fetchProfileHistory(page), fetchBookings()]);
      setLoading(false);
    };

    load();
  }, [driverId, fetchProfileHistory, fetchBookings, page, rangeKey]);

  const handleSignOut = async () => {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
    if (onRoleChange) onRoleChange();
    router.replace("/login");
  };

  const onRefresh = async () => {
    setRefreshing(true);

    if (screenMode === "BOOKINGS") {
      await fetchBookings();
    } else {
      await Promise.all([fetchProfileHistory(page), fetchBookings()]);
    }

    setRefreshing(false);
  };

  const openBookings = async () => {
    setScreenMode("BOOKINGS");
    await fetchBookings();
  };

  const openCancelModal = (booking: BookingItem) => {
    setSelectedBooking(booking);
    setCancelModalVisible(true);
  };

  const cancelBooking = async () => {
    if (!selectedBooking) return;

    try {
      setCancelLoading(true);

      const response = await api.put(
        `/drivers/bookings/${selectedBooking.saleId}/cancel`,
        {
          driver_id: driverId,
        },
      );

      if (response.data?.success) {
        setCancelModalVisible(false);
        setSelectedBooking(null);
        await fetchBookings();
      }
    } catch (err: any) {
      console.error("cancelBooking error:", err?.response?.data || err.message);
    } finally {
      setCancelLoading(false);
    }
  };

  if (screenMode === "BOOKINGS") {
    return (
      <ScreenContainer
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <AppHeader />

        <View style={styles.content}>
          <View style={styles.bookingHeaderRow}>
            <TouchableOpacity
              style={styles.backSquare}
              onPress={() => setScreenMode("PROFILE")}
            >
              <Ionicons name="arrow-back" size={28} color={DS.textPrimary} />
            </TouchableOpacity>

            <View>
              <Text style={styles.bookingPageTitle}>My Bookings</Text>
              <Text style={styles.bookingCount}>{bookings.total} total</Text>
            </View>
          </View>

          {bookingsLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={DS.primary} />
              <Text style={styles.infoText}>Loading bookings...</Text>
            </View>
          ) : bookings.items.length ? (
            bookings.items.map((item) => (
              <BookingCard
                key={item.saleId}
                item={item}
                onCancel={() => openCancelModal(item)}
              />
            ))
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No bookings found</Text>
            </View>
          )}
        </View>

        <CancelBookingModal
          visible={cancelModalVisible}
          loading={cancelLoading}
          onCancel={cancelBooking}
          onKeep={() => {
            setCancelModalVisible(false);
            setSelectedBooking(null);
          }}
        />
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

      <View style={styles.content}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={DS.primary} />
            <Text style={styles.infoText}>Loading profile history...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.profileTopRow}>
                <View style={styles.profileAvatar}>
                  <Image
                    source={require("../../assets/images/driverimage.jpeg")}
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: RADIUS.xxl,
                    }}
                  />
                </View>

                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>
                    {data?.driver?.name || "Driver"}
                  </Text>

                  <View style={styles.profileMetaRow}>
                    <Ionicons
                      name="briefcase-outline"
                      size={18}
                      color={DS.textSecondary}
                    />
                    <Text style={styles.profileMeta}>
                      Delivery Driver
                    </Text>
                  </View>

                  <View style={styles.profileMetaRow}>
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={DS.textSecondary}
                    />
                    <Text style={styles.profileMeta}>
                      {data?.driver?.phone || "N/A"}
                    </Text>
                  </View>

                  <View style={styles.profileMetaRow}>
                    <Ionicons
                      name="car-outline"
                      size={18}
                      color={DS.textSecondary}
                    />
                    <Text style={styles.profileMeta}>
                      {data?.driver?.vehicleNumber || "N/A"}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.signOutButton}
                onPress={handleSignOut}
              >
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>

            {/* <Text style={styles.sectionTitle}>PERFORMANCE</Text> */}

            {/* <View style={styles.performanceWrapVertical}>
              <PerformanceRow
                icon="checkmark-circle-outline"
                label="Today"
                value={data?.performance?.today ?? 0}
                color={PALETTE.green600}
                bg={DS.greenSoft}
              />

              <PerformanceRow
                icon="calendar-outline"
                label="This Week"
                value={data?.performance?.thisWeek ?? 0}
                color={DS.primary}
                bg={DS.primarySoft}
              />

              <PerformanceRow
                icon="trophy-outline"
                label="Total"
                value={data?.performance?.total ?? 0}
                color={DS.orangeText}
                bg={DS.orangeSoft}
              />
            </View> */}

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.myBookingsCard}
              onPress={openBookings}
            >
              <View style={styles.myBookingLeft}>
                <View style={styles.myBookingIcon}>
                  <Image
                    source={require("../../assets/images/Cylinder.png")}
                    style={{
                      width: "80%",
                      height: "100%",
                      borderRadius: RADIUS.lg,
                    }}
                  />
                </View>

                <View>
                  <Text style={styles.myBookingTitle}>My Bookings</Text>
                  <Text style={styles.myBookingSub}>
                    View all your booking history
                  </Text>
                </View>
              </View>

              <View style={styles.myBookingRight}>
                <Text style={styles.myBookingCount}>{bookings.total}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={26}
                  color={DS.textSecondary}
                />
              </View>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>DELIVERY HISTORY</Text>

            {data?.items?.length ? (
              data.items.map((dayItem, index) => (
                <View key={`${dayItem.date}-${index}`} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayLeft}>
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={DS.textSecondary}
                      />
                      <Text style={styles.dayDateText}>
                        {formatDateLabel(dayItem.date)}
                      </Text>
                    </View>

                    <View style={styles.dayRight}>
                      <Text style={styles.dayAmount}>
                        ₹{dayItem.totalAmount.toLocaleString("en-IN")}
                      </Text>
                      <Text style={styles.dayDeliveries}>
                        {dayItem.totalDeliveries} deliveries
                      </Text>
                    </View>
                  </View>

                  {dayItem.deliveries.map((item) => {
                    const paymentLabel = getPaymentLabel(item.paymentMode);
                    const isCommercial = item.cylinderType === "COMMERCIAL";

                    return (
                      <View key={item.saleId} style={styles.deliveryRow}>
                        <View style={styles.rowLeft}>
                          <View
                            style={[
                              styles.iconWrap,
                              {
                                backgroundColor: isCommercial
                                  ? DS.orangeSoft
                                  : DS.primarySoft,
                              },
                            ]}
                          >
                            <Image
                              source={require("../../assets/images/Cylinder.png")}
                              style={{
                                width: 24,
                                height: 24,
                                tintColor: isCommercial
                                  ? DS.orange
                                  : DS.primary,
                              }}
                              resizeMode="contain"
                            />
                          </View>

                          <View style={styles.rowTextWrap}>
                            <Text style={styles.customerName} numberOfLines={1}>
                              {item.customerName}
                            </Text>

                            <Text style={styles.metaText} numberOfLines={1}>
                              {formatTime(item.deliveredAt)} · {item.address}
                            </Text>

                            <Text style={styles.subMetaText}>
                              {isCommercial ? "Commercial" : "Domestic"} ×{" "}
                              {item.quantity}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.rowRight}>
                          <Text style={styles.amountText}>
                            ₹{item.totalAmount.toLocaleString("en-IN")}
                          </Text>

                          <View
                            style={[
                              styles.paymentBadge,
                              paymentLabel === "Cash"
                                ? styles.cashBadge
                                : paymentLabel === "UPI"
                                  ? styles.upiBadge
                                  : paymentLabel === "Credit"
                                    ? styles.creditBadge
                                    : styles.onlineBadge,
                            ]}
                          >
                            <Text
                              style={[
                                styles.paymentBadgeText,
                                paymentLabel === "Cash"
                                  ? styles.cashText
                                  : paymentLabel === "UPI"
                                    ? styles.upiText
                                    : paymentLabel === "Credit"
                                      ? styles.creditText
                                      : styles.onlineText,
                              ]}
                            >
                              {paymentLabel}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No delivery history found</Text>
              </View>
            )}

            <View style={styles.paginationWrap}>
              <TouchableOpacity
                style={[
                  styles.pageButton,
                  !data?.pagination?.hasPrevPage && styles.pageButtonDisabled,
                ]}
                disabled={!data?.pagination?.hasPrevPage}
                onPress={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={DS.textSecondary}
                />
                <Text style={styles.pageButtonText}>Newer</Text>
              </TouchableOpacity>

              <Text style={styles.pageIndicator}>
                Page {data?.pagination?.page || 1} of{" "}
                {data?.pagination?.totalPages || 1}
              </Text>

              <TouchableOpacity
                style={[
                  styles.pageButton,
                  !data?.pagination?.hasNextPage && styles.pageButtonDisabled,
                ]}
                disabled={!data?.pagination?.hasNextPage}
                onPress={() => setPage((prev) => prev + 1)}
              >
                <Text style={styles.pageButtonText}>Older</Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={DS.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function BookingCard({
  item,
  onCancel,
}: {
  item: BookingItem;
  onCancel: () => void;
}) {
  const isPending = item.status === "PENDING";
  const isDelivered = item.status === "DELIVERED";
  const isCommercial = item.cylinderType === "COMMERCIAL";

  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingTopRow}>
        <View
          style={[
            styles.bookingIcon,
            {
              backgroundColor: isCommercial ? DS.greenSoft : DS.primarySoft,
            },
          ]}
        >
          <Ionicons
            name="cube-outline"
            size={24}
            color={isCommercial ? DS.green : DS.primary}
          />
        </View>

        <View style={styles.bookingInfo}>
          <Text style={styles.bookingName} numberOfLines={1}>
            {item.customerName}
          </Text>

          <View style={styles.bookingAddressRow}>
            <Ionicons
              name="location-outline"
              size={16}
              color={DS.textSecondary}
            />
            <Text style={styles.bookingAddress} numberOfLines={1}>
              {item.address}
            </Text>
          </View>

          <Text style={styles.bookingProduct}>
            {isCommercial ? "Commercial" : "Domestic"} × {item.totalQty}
            {isDelivered && item.deliveredAt
              ? `  ◷ ${formatTime(item.deliveredAt)}`
              : ""}
          </Text>
        </View>

        <View style={styles.bookingRight}>
          <View
            style={[
              styles.bookingStatusBadge,
              isPending
                ? styles.pendingBadge
                : isDelivered
                  ? styles.deliveredBadge
                  : styles.cancelledBadge,
            ]}
          >
            <Text
              style={[
                styles.bookingStatusText,
                isPending
                  ? styles.pendingText
                  : isDelivered
                    ? styles.deliveredText
                    : styles.cancelledText,
              ]}
            >
              {getStatusLabel(item.status)}
            </Text>
          </View>

          <Text style={styles.bookingAmount}>
            ₹{item.totalAmount.toLocaleString("en-IN")}
          </Text>
        </View>
      </View>

      {isPending ? (
        <TouchableOpacity style={styles.cancelBookingButton} onPress={onCancel}>
          <Text style={styles.cancelBookingText}>× Cancel Booking</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function CancelBookingModal({
  visible,
  loading,
  onCancel,
  onKeep,
}: {
  visible: boolean;
  loading: boolean;
  onCancel: () => void;
  onKeep: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.cancelOverlay}>
        <View style={styles.cancelModalBox}>
          <Text style={styles.cancelTitle}>Cancel this booking?</Text>

          <Text style={styles.cancelDescription}>
            This action cannot be undone. The booking will be marked as
            cancelled.
          </Text>

          <TouchableOpacity
            style={styles.cancelConfirmButton}
            onPress={onCancel}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={DS.white} />
            ) : (
              <Text style={styles.cancelConfirmText}>Yes, Cancel</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.keepBookingButton}
            onPress={onKeep}
            disabled={loading}
          >
            <Text style={styles.keepBookingText}>Keep Booking</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PerformanceRow({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <View style={styles.performanceRowCard}>
      <View style={styles.performanceRowLeft}>
        <View style={[styles.performanceIconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>

        <Text style={styles.performanceRowLabel}>{label}</Text>
      </View>

      <Text style={[styles.performanceRowValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 100,
  },

  roleSwitchWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 18,
  },
  signOutButton: {
    minHeight: 42,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: PALETTE.red100,
    backgroundColor: DS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    width: "100%",
  },
  signOutButtonText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.red,
  },

  roleButton: {
    flexGrow: 1,
    flexBasis: "30%",
    height: 54,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  roleButtonActive: {
    borderColor: DS.primary,
    backgroundColor: DS.primarySoft,
  },

  roleButtonText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textSecondary,
    textAlign: "center",
  },

  roleButtonTextActive: {
    color: DS.primary,
  },

  profileCard: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    padding: 18,
    marginBottom: 22,
  },

  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  profileAvatar: {
    width: 74,
    height: 74,
    borderRadius: RADIUS.xxl,
    backgroundColor: DS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 18,
  },

  profileInitials: {
    ...TYPO.s1,
    color: DS.primary,
  },

  profileInfo: {
    flex: 1,
  },

  profileName: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginBottom: 6,
  },

  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },

  profileMeta: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },

  sectionTitle: {
    ...EYEBROW,
    color: DS.textTertiary,
    marginBottom: 12,
  },

  performanceWrapVertical: {
    gap: 10,
    marginBottom: 24,
  },

  performanceRowCard: {
    height: 76,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  performanceRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  performanceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  performanceRowLabel: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },

  performanceRowValue: {
    ...TYPO.h5,
  },

  myBookingsCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 26,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  myBookingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },

  myBookingIcon: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    // backgroundColor: DS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  myBookingTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  myBookingSub: {
    ...TYPO.b4,
    color: DS.textSecondary,
    marginTop: 3,
  },

  myBookingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  myBookingCount: {
    ...TYPO.h5,
    color: DS.primary,
  },

  dayCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 14,
  },

  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "flex-start",
  },

  dayLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },

  dayDateText: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },

  dayRight: {
    alignItems: "flex-end",
  },

  dayAmount: {
    ...TYPO.s1,
    color: DS.primary,
  },

  dayDeliveries: {
    ...TYPO.c2,
    color: DS.textSecondary,
    marginTop: 2,
  },

  deliveryRow: {
    backgroundColor: DS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  rowLeft: {
    flexDirection: "row",
    gap: 10,
    flex: 1,
  },

  rowTextWrap: {
    flex: 1,
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },

  customerName: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },

  metaText: {
    ...TYPO.c2,
    color: DS.textSecondary,
    marginTop: 2,
  },

  subMetaText: {
    ...TYPO.c2,
    color: DS.textSecondary,
    marginTop: 2,
  },

  rowRight: {
    alignItems: "flex-end",
    marginLeft: 10,
  },

  amountText: {
    ...TYPO.s2,
    color: DS.textPrimary,
    marginBottom: 6,
  },

  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },

  paymentBadgeText: {
    ...TYPO.c2,
    fontWeight: WEIGHT.semibold,
  },

  cashBadge: {
    backgroundColor: DS.greenSoft,
  },

  cashText: {
    color: PALETTE.green600,
  },

  upiBadge: {
    backgroundColor: DS.primarySoft,
  },

  upiText: {
    color: DS.primary,
  },

  onlineBadge: {
    backgroundColor: DS.orangeSoft,
  },

  onlineText: {
    color: DS.orangeText,
  },

  creditBadge: {
    backgroundColor: DS.orangeSoft,
  },

  creditText: {
    color: DS.orangeText,
  },

  paginationWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginTop: 4,
  },

  pageButton: {
    minWidth: 84,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: DS.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  pageButtonDisabled: {
    opacity: 0.4,
  },

  pageButtonText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textSecondary,
  },

  pageIndicator: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textSecondary,
  },

  bookingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginBottom: 28,
  },

  backSquare: {
    width: 70,
    height: 70,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DS.card,
  },

  bookingPageTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },

  bookingCount: {
    ...TYPO.b2,
    color: DS.textSecondary,
    marginTop: 3,
  },

  bookingCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 14,
  },

  bookingTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  bookingIcon: {
    width: 58,
    height: 58,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  bookingInfo: {
    flex: 1,
  },

  bookingName: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  bookingAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },

  bookingAddress: {
    ...TYPO.b4,
    flex: 1,
    color: DS.textSecondary,
  },

  bookingProduct: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
    marginTop: 12,
  },

  bookingRight: {
    alignItems: "flex-end",
    marginLeft: 10,
  },

  bookingStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    marginBottom: 24,
  },

  bookingStatusText: {
    ...TYPO.c2,
    fontWeight: WEIGHT.semibold,
  },

  pendingBadge: {
    backgroundColor: DS.orangeSoft,
  },

  pendingText: {
    color: DS.orangeText,
  },

  deliveredBadge: {
    backgroundColor: DS.greenSoft,
  },

  deliveredText: {
    color: PALETTE.green600,
  },

  cancelledBadge: {
    backgroundColor: DS.redSoft,
  },

  cancelledText: {
    color: DS.red,
  },

  bookingAmount: {
    ...TYPO.s1,
    color: DS.primary,
  },

  cancelBookingButton: {
    height: 62,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: PALETTE.red100,
    backgroundColor: DS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },

  cancelBookingText: {
    ...TYPO.s2,
    color: DS.red,
  },

  cancelOverlay: {
    flex: 1,
    backgroundColor: "rgba(11,13,18,0.55)",
    justifyContent: "center",
  },

  cancelModalBox: {
    backgroundColor: DS.card,
    padding: 28,
  },

  cancelTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
    textAlign: "center",
  },

  cancelDescription: {
    ...TYPO.b1,
    color: DS.textSecondary,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 28,
  },

  cancelConfirmButton: {
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  cancelConfirmText: {
    ...TYPO.s1,
    color: DS.white,
  },

  keepBookingButton: {
    height: 56,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  keepBookingText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  emptyBox: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 30,
    alignItems: "center",
    marginBottom: 16,
  },

  emptyText: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },

  centerBox: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  infoText: {
    ...TYPO.b3,
    marginTop: 10,
    color: DS.textSecondary,
  },

  errorText: {
    ...TYPO.b3,
    color: DS.red,
  },
});
