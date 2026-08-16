import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import AppHeader from "../../components/common/AppHeader";
import ScreenContainer from "../../components/common/ScreenContainer";
import { DS, RADIUS, TYPO } from "../../constants/designSystem";
import { useDateRange } from "../../context/DateRangeContext";
import { getDeliveryDrivers } from "../../services/godownService";

const filters = ["Today", "Yesterday", "This Week"];

export default function GodownDriversScreen() {
  const { rangeKey } = useDateRange();
  const [activeFilter, setActiveFilter] = useState("Today");
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDrivers = useCallback(
    async (filterValue = activeFilter) => {
      try {
        setLoading(true);

        const apiFilter =
          filterValue === "Today"
            ? "today"
            : filterValue === "Yesterday"
              ? "yesterday"
              : "week";

        const data = await getDeliveryDrivers(apiFilter);
        setDrivers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.log("Delivery drivers error:", error);
      } finally {
        setLoading(false);
      }
    },
    [activeFilter],
  );

  useFocusEffect(
    useCallback(() => {
      fetchDrivers();
    }, [fetchDrivers]),
  );

  useEffect(() => {
    fetchDrivers(activeFilter);
  }, [rangeKey, activeFilter, fetchDrivers]);

  return (
    <ScreenContainer>
      <AppHeader />

      <View style={styles.content}>
        <View style={styles.filterRow}>
          {filters.map((item) => {
            const active = item === activeFilter;

            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.filterButton,
                  active && styles.filterButtonActive,
                ]}
                onPress={() => {
                  setActiveFilter(item);
                  fetchDrivers(item);
                }}
              >
                <Text
                  style={[styles.filterText, active && styles.filterTextActive]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Delivery Drivers</Text>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={DS.primary} />
          </View>
        ) : (
          drivers.map((driver) => (
            <TouchableOpacity
              key={driver.id}
              activeOpacity={0.85}
              style={styles.driverCard}
              onPress={() =>
                router.push({
                  pathname: "/driver-allocation/[id]",
                  params: {
                    id: String(driver.id),
                    name: driver.name,
                    allocated: String(driver.allocated || 0),
                    allocatedToday: String(
                      driver.allocatedToday ?? driver.allocated ?? 0,
                    ),
                    carriedForward: String(driver.carriedForward || 0),
                    delivered: String(driver.delivered || 0),
                    empty: String(driver.empty || 0),
                    inHand: String(driver.inHand || 0),
                  },
                })
              }
            >
              <View style={styles.avatarBox}>
                <Image
                  source={require("../../../assets/images/driverimage.jpeg")}
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: RADIUS.lg,
                  }}
                />
              </View>

              <View style={styles.driverContent}>
                <Text style={styles.driverName}>{driver.name}</Text>

                {Number(driver.carriedForward || 0) > 0 ? (
                  <Text style={styles.carryForwardNote}>
                    Includes {driver.carriedForward} carried forward from
                    previous day
                  </Text>
                ) : null}

                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: DS.primary }]}>
                      {driver.allocated}
                    </Text>
                    <Text style={styles.statLabel}>Allocated</Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: DS.green }]}>
                      {driver.delivered}
                    </Text>
                    <Text style={styles.statLabel}>Delivered</Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{driver.empty}</Text>
                    <Text style={styles.statLabel}>Empty</Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: DS.orange }]}>
                      {driver.inHand}
                    </Text>
                    <Text style={styles.statLabel}>In-Hand</Text>
                  </View>
                </View>
              </View>

              <Ionicons
                name="chevron-forward"
                size={22}
                color={DS.textSecondary}
                style={{ alignSelf: "center" }}
              />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  loaderBox: { height: 300, alignItems: "center", justifyContent: "center" },
  filterRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  filterButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
  },
  filterButtonActive: { backgroundColor: DS.primary, borderColor: DS.primary },
  filterText: { ...TYPO.b4, color: DS.textPrimary },
  filterTextActive: { color: DS.white },
  sectionTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
    marginBottom: 12,
  },
  driverCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarBox: {
    width: 58,
    height: 58,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    marginTop: 2,
  },
  driverContent: { flex: 1 },
  driverName: {
    ...TYPO.s2,
    color: DS.textPrimary,
    marginBottom: 10,
  },
  carryForwardNote: {
    ...TYPO.c1,
    color: DS.orange,
    marginTop: -6,
    marginBottom: 10,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  statItem: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statValue: { ...TYPO.s2, color: DS.textPrimary },
  statLabel: { ...TYPO.c1, color: DS.textSecondary },
});
