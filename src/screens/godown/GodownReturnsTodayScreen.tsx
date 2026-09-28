import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
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
  approveReturnByCondition,
  approveTransferEmptyReturn,
  getReturnsToday,
  getTransferEmptyReturns,
} from "../../services/godownService";

export default function GodownReturnsTodayScreen() {
  const { rangeKey } = useDateRange();
  const [returns, setReturns] = useState<any[]>([]);
  const [transferReturns, setTransferReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [approvingKey, setApprovingKey] = useState<string | null>(null);
  const [approvingTransferId, setApprovingTransferId] = useState<number | null>(
    null,
  );

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const [data, transfers] = await Promise.all([
        getReturnsToday(),
        getTransferEmptyReturns().catch(() => []),
      ]);
      setReturns(Array.isArray(data) ? data : []);
      setTransferReturns(Array.isArray(transfers) ? transfers : []);
    } catch (error) {
      console.log("Returns today error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTransfer = async (id: number) => {
    try {
      setApprovingTransferId(id);
      await approveTransferEmptyReturn(id);
      await fetchReturns();
    } catch (error) {
      console.log("Approve transfer empty return error:", error);
    } finally {
      setApprovingTransferId(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchReturns();
    }, []),
  );

  useEffect(() => {
    fetchReturns();
  }, [rangeKey]);

  const handleApprove = async (
    driverId: number,
    condition: "empty" | "normal" | "defective",
  ) => {
    try {
      setApprovingKey(`${driverId}-${condition}`);

      await approveReturnByCondition({
        driver_id: driverId,
        condition,
      });

      await fetchReturns();
      setOpenKey(null);
    } catch (error) {
      console.log("Approve return error:", error);
    } finally {
      setApprovingKey(null);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader />

      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={DS.textPrimary} />
        </TouchableOpacity>

        <View>
          <Text style={styles.title}>Returns Today</Text>
          <Text style={styles.subtitle}>
            {returns.filter((x) => x.total > 0).length} drivers returned
            cylinders
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator color={DS.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          {returns.filter((driver) => driver.total > 0).length === 0 &&
            transferReturns.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No returns request now</Text>
              </View>
            )}
          {returns
            .filter((driver) => driver.total > 0)
            .map((driver) => (
              <View key={driver.driver_id} style={styles.driverCard}>
                <View style={styles.driverHeader}>
                  <View style={styles.avatar}>
                    <Ionicons
                      name="person-outline"
                      size={22}
                      color={DS.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>{driver.driver_name}</Text>
                    <Text style={styles.driverTime}>
                      Today, {formatTime(driver.time)}
                    </Text>
                  </View>

                  <View style={styles.totalBox}>
                    <Text style={styles.totalValue}>{driver.total}</Text>
                    <Text style={styles.totalLabel}>TOTAL</Text>
                  </View>
                </View>

                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeadText, { flex: 1.6 }]}>
                    ITEM
                  </Text>
                  <Text style={styles.emptyHead}>EMPTY</Text>
                  <Text style={styles.normalHead}>NORMAL</Text>
                  <Text style={styles.defHead}>DEF.</Text>
                </View>

                {groupItems(driver.items).map((item: any) => (
                  <View key={item.name} style={styles.itemRow}>
                    <View style={styles.itemLeft}>
                      <Ionicons
                        name="cube-outline"
                        size={16}
                        color={DS.textSecondary}
                      />

                      <View>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemSub}>{item.category}</Text>
                      </View>
                    </View>

                    <Text style={styles.emptyValue}>{item.empty}</Text>
                    <Text style={styles.normalValue}>{item.normal}</Text>
                    <Text style={styles.defValue}>{item.defective}</Text>
                  </View>
                ))}

                <Text style={styles.approveLabel}>APPROVE BY CONDITION</Text>

                <ApproveBox
                  title="Empty Cylinders"
                  count={driver.empty}
                  condition="empty"
                  color={DS.orange}
                  bg={DS.orangeSoft}
                  open={openKey === `${driver.driver_id}-empty`}
                  loading={approvingKey === `${driver.driver_id}-empty`}
                  onToggle={() =>
                    setOpenKey(
                      openKey === `${driver.driver_id}-empty`
                        ? null
                        : `${driver.driver_id}-empty`,
                    )
                  }
                  onApprove={() => handleApprove(driver.driver_id, "empty")}
                />

                <ApproveBox
                  title="Normal Cylinder"
                  count={driver.normal}
                  condition="normal"
                  color={DS.primary}
                  bg={DS.blueSoft}
                  open={openKey === `${driver.driver_id}-normal`}
                  loading={approvingKey === `${driver.driver_id}-normal`}
                  onToggle={() =>
                    setOpenKey(
                      openKey === `${driver.driver_id}-normal`
                        ? null
                        : `${driver.driver_id}-normal`,
                    )
                  }
                  onApprove={() => handleApprove(driver.driver_id, "normal")}
                />

                <ApproveBox
                  title="Defective Cylinder"
                  count={driver.defective}
                  condition="defective"
                  color={DS.red}
                  bg={DS.redSoft}
                  open={openKey === `${driver.driver_id}-defective`}
                  loading={approvingKey === `${driver.driver_id}-defective`}
                  onToggle={() =>
                    setOpenKey(
                      openKey === `${driver.driver_id}-defective`
                        ? null
                        : `${driver.driver_id}-defective`,
                    )
                  }
                  onApprove={() => handleApprove(driver.driver_id, "defective")}
                />
              </View>
            ))}

          {transferReturns.length > 0 && (
            <>
              <Text style={styles.sectionHeading}>Transfer Empty Returns</Text>

              {transferReturns.map((item) => (
                <View key={`transfer-${item.id}`} style={styles.driverCard}>
                  <View style={styles.driverHeader}>
                    <View style={styles.avatar}>
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={22}
                        color={DS.primary}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverName}>{item.productName}</Text>
                      <Text style={styles.driverTime}>
                        Transfer #{item.transferId}
                        {item.toCustomer ? ` · ${item.toCustomer}` : ""}
                      </Text>
                    </View>

                    <View style={styles.totalBox}>
                      <Text style={styles.totalValue}>{item.quantity}</Text>
                      <Text style={styles.totalLabel}>EMPTY</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleApproveTransfer(item.id)}
                    disabled={approvingTransferId === item.id}
                  >
                    <Text style={styles.approveButtonText}>
                      {approvingTransferId === item.id
                        ? "Approving..."
                        : `Approve ${item.quantity} empty`}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

function ApproveBox({
  title,
  count,
  condition,
  color,
  bg,
  open,
  loading,
  onToggle,
  onApprove,
}: any) {
  return (
    <View
      style={[
        styles.approveBox,
        {
          borderColor: color,
          backgroundColor: open ? bg : DS.white,
        },
      ]}
    >
      <TouchableOpacity style={styles.approveTop} onPress={onToggle}>
        <View style={[styles.conditionIcon, { backgroundColor: bg }]}>
          <Ionicons
            name={
              condition === "empty"
                ? "refresh-outline"
                : condition === "normal"
                  ? "cube-outline"
                  : "warning-outline"
            }
            size={22}
            color={color}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.conditionTitle}>{title}</Text>
          <Text style={styles.conditionSub}>{count} to approve</Text>
        </View>

        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={DS.textSecondary}
        />
      </TouchableOpacity>

      {open && (
        <>
          <View style={styles.approveInnerRow}>
            <Text style={styles.innerText}>{title}</Text>
            <Text style={[styles.innerValue, { color }]}>{count}</Text>
          </View>

          <TouchableOpacity
            style={styles.approveButton}
            onPress={onApprove}
            disabled={loading || count <= 0}
          >
            <Text style={styles.approveButtonText}>
              {loading ? "Approving..." : `Approve ${count} ${condition}`}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const groupItems = (items: any[]) => {
  const map: any = {};

  items.forEach((item) => {
    if (!map[item.name]) {
      map[item.name] = {
        name: item.name,
        category: item.category,
        empty: 0,
        normal: 0,
        defective: 0,
      };
    }

    map[item.name][item.condition] += Number(item.quantity || 0);
  });

  return Object.values(map);
};

const formatTime = (date?: string | null) => {
  if (!date) return "--";

  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const styles = StyleSheet.create({
  pageHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: DS.white,
  },
  title: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  subtitle: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  sectionHeading: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginTop: 6,
    marginBottom: 12,
  },
  loaderBox: {
    height: 400,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    ...TYPO.b2,
    color: DS.textSecondary,
  },
  driverCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 14,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: DS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  driverName: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  driverTime: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 2,
  },
  totalBox: {
    alignItems: "center",
  },
  totalValue: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },
  totalLabel: {
    ...EYEBROW,
    fontSize: 9,
    letterSpacing: 0.6,
    color: DS.textSecondary,
  },
  tableHeader: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  tableHeadText: {
    ...EYEBROW,
    fontSize: 10,
    letterSpacing: 0.5,
    color: DS.textSecondary,
  },
  emptyHead: {
    ...EYEBROW,
    width: 50,
    fontSize: 10,
    letterSpacing: 0.5,
    color: DS.orangeText,
    textAlign: "center",
  },
  normalHead: {
    ...EYEBROW,
    width: 55,
    fontSize: 10,
    letterSpacing: 0.5,
    color: DS.primary,
    textAlign: "center",
  },
  defHead: {
    ...EYEBROW,
    width: 42,
    fontSize: 10,
    letterSpacing: 0.5,
    color: DS.red,
    textAlign: "center",
  },
  itemRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: DS.divider,
  },
  itemLeft: {
    flex: 1.6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemName: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
  },
  itemSub: {
    ...TYPO.c3,
    color: DS.textSecondary,
    marginTop: 1,
  },
  emptyValue: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    width: 50,
    textAlign: "center",
    color: DS.orangeText,
  },
  normalValue: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    width: 55,
    textAlign: "center",
    color: DS.primary,
  },
  defValue: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    width: 42,
    textAlign: "center",
    color: DS.red,
  },
  approveLabel: {
    ...EYEBROW,
    fontSize: 10,
    color: DS.textSecondary,
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  approveBox: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginBottom: 10,
    overflow: "hidden",
  },
  approveTop: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  conditionIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  conditionTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  conditionSub: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 2,
  },
  approveInnerRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  innerText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
  },
  innerValue: {
    ...TYPO.s2,
  },
  approveButton: {
    marginHorizontal: 12,
    marginBottom: 12,
    height: 44,
    backgroundColor: DS.textPrimary,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  approveButtonText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.white,
  },
});
