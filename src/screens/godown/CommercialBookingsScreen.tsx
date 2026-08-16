import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AppHeader from "../../components/common/AppHeader";
import ScreenContainer from "../../components/common/ScreenContainer";
import {
  DS,
  EYEBROW,
  RADIUS,
  TYPO,
  WEIGHT,
} from "../../constants/designSystem";
import { useDateRange } from "../../context/DateRangeContext";
import {
  approveCommercialBooking,
  getCommercialBookings,
} from "../../services/godownService";

type BookingItem = {
  bookingId: number;
  status: string;
  isApproved: number;
  totalAmount: number;
  createdAt: string;
  driverId: number;
  driverName: string;
  driverPhone: string;
  customerName: string;
  customerPhone: string;
  address: string;
  totalQty: number;
  items: {
    stockTransactionId: number;
    productId: number;
    productName: string;
    productType: string;
    quantity: number;
    price: number;
  }[];
};

type DriverGroup = {
  driverId: number;
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  totalBookings: number;
  totalCylinders: number;
  openBookings: number;
  bookings: BookingItem[];
};

type TabType = "ALL" | "PENDING" | "OUT" | "DONE";

export default function CommercialBookingsScreen() {
  const { rangeKey } = useDateRange();
  const [summary, setSummary] = useState({
    bookings: 0,
    cylinders: 0,
    drivers: 0,
  });

  const [drivers, setDrivers] = useState<DriverGroup[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const apiData = await getCommercialBookings({
        search,
        status: activeTab === "OUT" ? "ALL" : activeTab,
      });

      setSummary(
        apiData?.summary || {
          bookings: 0,
          cylinders: 0,
          drivers: 0,
        },
      );

      const driverRows: DriverGroup[] = apiData?.drivers || [];
      setDrivers(driverRows);

      setExpanded((prev) => {
        const next: Record<number, boolean> = {};

        driverRows.forEach((driver, index) => {
          next[driver.driverId] =
            prev[driver.driverId] !== undefined
              ? prev[driver.driverId]
              : index === 0;
        });

        return next;
      });
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to fetch bookings",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBookings();
    }, 350);

    return () => clearTimeout(timer);
  }, [fetchBookings]);

  useEffect(() => {
    fetchBookings();
  }, [rangeKey, fetchBookings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
  };

  const handleApprove = async (bookingId: number) => {
    try {
      const response = await approveCommercialBooking(bookingId);

      if (response?.success) {
        Alert.alert("Success", "Booking approved successfully");
        await fetchBookings();
      } else {
        Alert.alert("Error", response?.message || "Failed to approve booking");
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to approve booking",
      );
    }
  };

  const visibleDrivers = drivers
    .map((driver) => {
      let filteredBookings = driver.bookings || [];

      if (activeTab === "PENDING") {
        filteredBookings = filteredBookings.filter(
          (booking) => Number(booking.isApproved) === 0,
        );
      }

      if (activeTab === "DONE" || activeTab === "OUT") {
        filteredBookings = filteredBookings.filter(
          (booking) => Number(booking.isApproved) === 1,
        );
      }

      return {
        ...driver,
        bookings: filteredBookings,
      };
    })
    .filter((driver) => driver.bookings.length > 0);

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <AppHeader />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color={DS.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.pageTitle}>Commercial Bookings</Text>
        </View>

        <View style={styles.statsRow}>
          <TopStat label="BOOKINGS" value={summary.bookings} />
          <TopStat label="CYLINDERS" value={summary.cylinders} />
          <TopStat label="DRIVERS" value={summary.drivers} />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons
              name="search-outline"
              size={22}
              color={DS.textSecondary}
            />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search driver, customer, booking id"
              placeholderTextColor={DS.textSecondary}
              style={styles.searchInput}
            />
          </View>
          {/* 
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="cube-outline" size={23} color={DS.textPrimary} />
          </TouchableOpacity> */}
        </View>

        <View style={styles.tabs}>
          {(["ALL", "PENDING", "OUT", "DONE"] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText,
                ]}
              >
                {tab === "ALL"
                  ? "All"
                  : tab === "PENDING"
                    ? "Pending"
                    : tab === "OUT"
                      ? "Out"
                      : "Done"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={DS.primary} />
            <Text style={styles.loadingText}>Loading bookings...</Text>
          </View>
        ) : visibleDrivers.length ? (
          visibleDrivers.map((driver) => {
            const isOpen = expanded[driver.driverId];

            const openCount = driver.bookings.filter(
              (booking) => Number(booking.isApproved) === 0,
            ).length;

            return (
              <View
                key={driver.driverId}
                style={[styles.driverBox, isOpen && styles.driverBoxExpanded]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.driverHeader}
                  onPress={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [driver.driverId]: !prev[driver.driverId],
                    }))
                  }
                >
                  <View style={styles.driverIconBox}>
                    <Ionicons name="bus-outline" size={25} color={DS.primary} />
                  </View>

                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driver.driverName}</Text>

                    <View style={styles.phoneRow}>
                      <Ionicons
                        name="call-outline"
                        size={15}
                        color={DS.textSecondary}
                      />
                      <Text style={styles.driverPhone}>
                        {driver.driverPhone || "N/A"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.openPill}>
                    <Text style={styles.openPillText}>{openCount} open</Text>
                  </View>

                  <Text style={styles.driverCount}>
                    {driver.bookings.length}
                  </Text>

                  <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={24}
                    color={DS.textSecondary}
                  />
                </TouchableOpacity>

                {isOpen ? (
                  <View style={styles.bookingList}>
                    {driver.bookings.map((booking) => (
                      <BookingCard
                        key={booking.bookingId}
                        booking={booking}
                        onApprove={() => handleApprove(booking.bookingId)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No commercial bookings found</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function TopStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.topStatCard}>
      <Text style={styles.topStatLabel}>{label}</Text>
      <Text style={styles.topStatValue}>{value}</Text>
    </View>
  );
}

function BookingCard({
  booking,
  onApprove,
}: {
  booking: BookingItem;
  onApprove: () => void;
}) {
  const approved = Number(booking.isApproved) === 1;
  const firstItem = booking.items?.[0];

  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingTop}>
        <View>
          <Text style={styles.customerName}>{booking.customerName}</Text>
          <Text style={styles.bookingId}>BK-{booking.bookingId}</Text>
        </View>

        <View style={approved ? styles.outBadge : styles.pendingBadge}>
          <Text style={approved ? styles.outText : styles.pendingText}>
            {approved ? "OUT" : "PENDING"}
          </Text>
        </View>
      </View>

      <View style={styles.bookingMetaRow}>
        <Ionicons name="location-outline" size={18} color={DS.textSecondary} />
        <Text style={styles.bookingMetaText} numberOfLines={1}>
          {booking.address || "No address"}
        </Text>
      </View>

      <View style={styles.bookingMetaRow}>
        <Ionicons name="time-outline" size={18} color={DS.textSecondary} />

        <Text style={styles.bookingMetaText}>
          {new Date(booking.createdAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>

        <Ionicons name="cube-outline" size={18} color={DS.green} />

        <Text style={styles.productQtyText}>
          {firstItem?.productName || "Commercial"} × {booking.totalQty}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.approveButton, approved && styles.approvedButton]}
        disabled={approved}
        onPress={onApprove}
      >
        <Ionicons name="checkmark-circle-outline" size={22} color={DS.white} />
        <Text style={styles.approveButtonText}>
          {approved ? "Approved" : "Approve"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 100,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 22,
  },

  pageTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },

  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },

  topStatCard: {
    flex: 1,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 16,
  },

  topStatLabel: {
    ...EYEBROW,
    color: DS.textSecondary,
  },

  topStatValue: {
    ...TYPO.h5,
    color: DS.textPrimary,
    marginTop: 6,
  },

  searchRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },

  searchBox: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.card,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },

  searchInput: {
    ...TYPO.b2,
    flex: 1,
    color: DS.textPrimary,
  },

  filterButton: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.card,
    alignItems: "center",
    justifyContent: "center",
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: DS.grey100,
    borderRadius: RADIUS.lg,
    padding: 4,
    marginBottom: 20,
  },

  tab: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  activeTab: {
    backgroundColor: DS.card,
  },

  tabText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textSecondary,
  },

  activeTabText: {
    color: DS.textPrimary,
  },

  driverBox: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    marginBottom: 14,
    overflow: "hidden",
  },

  driverBoxExpanded: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },

  driverIconBox: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.md,
    backgroundColor: DS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  driverInfo: {
    flex: 1,
  },

  driverName: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 5,
  },

  driverPhone: {
    ...TYPO.b3,
    color: DS.textSecondary,
  },

  openPill: {
    backgroundColor: DS.red,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
  },

  openPillText: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
    color: DS.white,
  },

  driverCount: {
    ...TYPO.s2,
    color: DS.textSecondary,
    marginRight: 10,
  },

  bookingList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: DS.border,
  },

  bookingCard: {
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginTop: 14,
  },

  bookingTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  customerName: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  bookingId: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 3,
  },

  pendingBadge: {
    backgroundColor: DS.orangeSoft,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  pendingText: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
    color: DS.orangeText,
  },

  outBadge: {
    backgroundColor: DS.primarySoft,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  outText: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
    color: DS.primary,
  },

  bookingMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
  },

  bookingMetaText: {
    ...TYPO.b3,
    color: DS.textPrimary,
    flexShrink: 1,
  },

  productQtyText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
  },

  approveButton: {
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.buttonGreen,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    gap: 10,
  },

  approvedButton: {
    backgroundColor: DS.buttonGreen,
  },

  approveButtonText: {
    ...TYPO.s2,
    color: DS.white,
  },

  loaderBox: {
    paddingVertical: 50,
    alignItems: "center",
  },

  loadingText: {
    ...TYPO.b3,
    marginTop: 10,
    color: DS.textSecondary,
  },

  emptyBox: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 24,
    alignItems: "center",
  },

  emptyText: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },
});
