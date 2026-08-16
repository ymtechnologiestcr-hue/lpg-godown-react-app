import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
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
  PALETTE,
  RADIUS,
  TYPO,
} from "../../constants/designSystem";
import {
  createDriverAllocation,
  getCylinderProducts,
} from "../../services/godownService";

export default function GodownDriverAllocationScreen() {
  const {
    id,
    name,
    allocated,
    allocatedToday,
    carriedForward,
    delivered,
    empty,
    inHand,
  } = useLocalSearchParams<{
    id?: string;
    name?: string;
    allocated?: string;
    allocatedToday?: string;
    carriedForward?: string;
    delivered?: string;
    empty?: string;
    inHand?: string;
  }>();

  // Cylinders the driver never returned on a previous day. They no longer
  // block a new allocation - they are carried forward and added on top of it.
  const carriedForwardQty = Number(carriedForward || 0);

  const [products, setProducts] = useState<any>({
    domestic: [],
    commercial: [],
  });
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getCylinderProducts();
      setProducts(data || { domestic: [], commercial: [] });
    } catch (error) {
      console.log("Products error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const allProducts = useMemo(
    () => [...(products.domestic || []), ...(products.commercial || [])],
    [products],
  );

  const total = Object.values(quantities).reduce((sum, item) => sum + item, 0);

  const setQtyFromInput = (
    productId: number,
    text: string,
    available: number,
  ) => {
    const digits = text.replace(/[^0-9]/g, "");
    const parsed = digits === "" ? 0 : parseInt(digits, 10);
    const clamped = Math.min(Math.max(0, parsed), Math.max(0, available));

    setQuantities((prev) => ({
      ...prev,
      [productId]: clamped,
    }));
  };

  const handleConfirm = async () => {
    try {
      if (!id || total <= 0) return;

      setSubmitting(true);

      const items = allProducts
        .map((item: any) => ({
          product_id: item.id,
          quantity: quantities[item.id] || 0,
        }))
        .filter((item) => item.quantity > 0);

      const result = await createDriverAllocation({
        driver_id: Number(id),
        items,
      });

      DeviceEventEmitter.emit("DRIVER_ALLOCATION_CREATED");

      const carried = Number(
        result?.data?.carriedForward ?? carriedForwardQty ?? 0,
      );

      if (carried > 0) {
        Alert.alert(
          "Allocation Confirmed",
          `${total} cylinder(s) allocated. ${carried} cylinder(s) still in hand from previous day(s) have been carried forward, so the driver now holds ${total + carried} in total.`,
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      router.back();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        "Failed to create allocation. Please try again.";
      console.log("Create allocation error:", error?.response?.data || error);
      Alert.alert("Allocation Failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={DS.textPrimary} />
          </TouchableOpacity>

          <View>
            <Text style={styles.driverName}>{name || "Driver"}</Text>
            <Text style={styles.subText}>{inHand || 0} cylinders in hand</Text>
          </View>
        </View>

        {carriedForwardQty > 0 ? (
          <View style={styles.carryForwardCard}>
            <Ionicons name="repeat-outline" size={20} color={DS.orange} />

            <View style={styles.carryForwardTextBox}>
              <Text style={styles.carryForwardTitle}>
                {carriedForwardQty} cylinder(s) carried forward
              </Text>
              <Text style={styles.carryForwardSub}>
                Not returned on a previous day. They stay with the driver and
                are added on top of whatever you allocate now.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.allocationHeader}>
          <Text style={styles.allocationTitle}>QUANTITY TO ALLOCATE</Text>
          <Text style={styles.totalText}>Total: {total}</Text>
        </View>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={DS.primary} />
          </View>
        ) : (
          <>
            <Text style={styles.categoryTitle}>DOMESTIC</Text>

            {(products.domestic || []).map((item: any) => (
              <CylinderRow
                key={item.id}
                item={{
                  id: item.id,
                  title: item.name || "Domestic",
                  subTitle: item.category || "",
                }}
                available={Number(item.availableQuantity || 0)}
                value={quantities[item.id] || 0}
                onChangeQty={(text: string) =>
                  setQtyFromInput(
                    item.id,
                    text,
                    Number(item.availableQuantity || 0),
                  )
                }
              />
            ))}

            <Text style={styles.categoryTitle}>COMMERCIAL</Text>

            {(products.commercial || []).map((item: any) => (
              <CylinderRow
                key={item.id}
                item={{
                  id: item.id,
                  title: item.name || "Commercial",
                  subTitle: item.category || "",
                }}
                available={Number(item.availableQuantity || 0)}
                value={quantities[item.id] || 0}
                onChangeQty={(text: string) =>
                  setQtyFromInput(
                    item.id,
                    text,
                    Number(item.availableQuantity || 0),
                  )
                }
              />
            ))}
          </>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>DRIVER SUMMARY</Text>

          <View style={styles.summaryRow}>
            <Summary
              value={allocated || "0"}
              label="Allocated"
              color={DS.primary}
            />
            <Summary
              value={delivered || "0"}
              label="Delivered"
              color={DS.green}
            />
            <Summary
              value={empty || "0"}
              label="Empty Collected"
              color={DS.textPrimary}
            />
            <Summary value={inHand || "0"} label="In-Hand" color={DS.orange} />
          </View>

          {carriedForwardQty > 0 ? (
            <Text style={styles.summaryFootnote}>
              Allocated includes {carriedForwardQty} carried forward
              {allocatedToday ? ` + ${allocatedToday} allocated today` : ""}.
              This allocation adds {total} more.
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.confirmButton, total === 0 && styles.confirmDisabled]}
          disabled={total === 0 || submitting}
          onPress={handleConfirm}
        >
          <Ionicons name="checkmark" size={18} color={DS.white} />
          <Text style={styles.confirmText}>
            {submitting ? "Saving..." : "Confirm Allocation"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

function CylinderRow({ item, value, available, onChangeQty }: any) {
  const outOfStock = available <= 0;
  const atLimit = !outOfStock && value >= available;

  return (
    <View style={styles.cylinderRow}>
      <View style={styles.rowTop}>
        <View style={styles.iconBox}>
          <Ionicons name="cube-outline" size={22} color={DS.textSecondary} />
        </View>

        <View style={styles.cylinderInfo}>
          <Text style={styles.cylinderTitle}>{item.title}</Text>
          <Text style={styles.cylinderSub}>{item.subTitle}</Text>
          <Text
            style={[
              styles.availableText,
              outOfStock && styles.availableTextEmpty,
            ]}
          >
            Available: {available}
          </Text>
        </View>

        <TextInput
          style={[styles.qtyInput, outOfStock && styles.qtyInputDisabled]}
          value={value ? String(value) : ""}
          onChangeText={onChangeQty}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={DS.textTertiary}
          editable={!outOfStock}
          textAlign="center"
          maxLength={6}
        />
      </View>

      {outOfStock ? (
        <Text style={styles.qtyHelperError}>
          Out of stock — cannot allocate
        </Text>
      ) : atLimit ? (
        <Text style={styles.qtyHelperError}>
          Only {available} available in stock
        </Text>
      ) : null}
    </View>
  );
}

function Summary({ value, label, color }: any) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 110 },
  loaderBox: { height: 220, alignItems: "center", justifyContent: "center" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  driverName: { ...TYPO.s1, color: DS.textPrimary },
  subText: { ...TYPO.c1, color: DS.textSecondary, marginTop: 2 },
  carryForwardCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.orange,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginBottom: 16,
  },
  carryForwardTextBox: { flex: 1 },
  carryForwardTitle: { ...TYPO.b4, color: DS.textPrimary },
  carryForwardSub: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 2,
  },
  allocationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  allocationTitle: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.8,
  },
  totalText: { ...TYPO.c2, color: DS.textPrimary },
  categoryTitle: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  cylinderRow: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginBottom: 10,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: DS.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cylinderInfo: { flex: 1 },
  cylinderTitle: { ...TYPO.b4, color: DS.textPrimary },
  cylinderSub: { ...TYPO.c1, color: DS.textSecondary, marginTop: 2 },
  availableText: { ...TYPO.c2, color: DS.primary, marginTop: 4 },
  availableTextEmpty: { color: DS.red },
  qtyInput: {
    width: 100,
    height: 44,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    backgroundColor: DS.card,
    color: DS.textPrimary,
    ...TYPO.s1,
    textAlign: "center",
    paddingVertical: 0,
    paddingHorizontal: 12,
  },
  qtyInputDisabled: {
    backgroundColor: DS.surface,
    color: DS.textTertiary,
  },
  qtyHelperError: {
    ...TYPO.c2,
    color: DS.red,
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginTop: 8,
  },
  summaryTitle: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryFootnote: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 14,
  },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryValue: { ...TYPO.s1 },
  summaryLabel: {
    ...TYPO.c3,
    color: DS.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  confirmButton: {
    height: 52,
    backgroundColor: DS.primary,
    borderRadius: RADIUS.lg,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmDisabled: { backgroundColor: PALETTE.primary200 },
  confirmText: { ...TYPO.s2, color: DS.white },
});
