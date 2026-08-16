import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DimensionValue } from "react-native";
import {
  ActivityIndicator,
  Alert,
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
import { AUTH_USER_KEY } from "../constants/auth";
import { DS, EYEBROW, PALETTE, RADIUS, TYPO } from "../constants/designSystem";
import api from "../services/api";

type ProductType = "DOMESTIC" | "COMMERCIAL";

type AllocatedCylinderItem = {
  id: number;
  saleItemId: number;
  saleId: number;
  allocationSaleId: number;
  allocationSalesItemId: number;
  batchNo: string;
  productId: number;
  productName: string;
  productType: ProductType;
  size?: string;
  totalAllocated: number;
  delivered: number;
  returned?: number;
  defective?: number;
  pending: number;
  lastAllocatedAt: string;
  latestSaleId: number;
  allocatedDate?: string | null;
  isCarryForward?: boolean;
};

type AllocatedResponse = {
  summary: {
    totalAllocated: number;
    delivered: number;
    pending: number;
    returned?: number;
    defective?: number;
    carriedForward?: number;
    allocatedToday?: number;
  };
  items: AllocatedCylinderItem[];
};

type BatchCounterItem = {
  productId: number;
  productName: string;
  productType: ProductType;
  size: string;
  maxQuantity: number;
  quantity: number;
};

const formatProductType = (type?: string) => {
  if (type === "DOMESTIC") return "Domestic";
  if (type === "COMMERCIAL") return "Commercial";
  return type || "";
};

const getProductSize = (item: Partial<AllocatedCylinderItem>) => {
  if (item.size) return item.size;
  const match = item.productName?.match(/\d+\.?\d*\s?kg/i);
  return match?.[0] ? match[0].replace(/\s/g, " ") : "";
};

const formatDate = (date?: string) => {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "-";
  }
};

const getProgressWidth = (item: AllocatedCylinderItem): DimensionValue => {
  if (!item.totalAllocated) return "0%";
  const width = Math.min(
    100,
    Math.round((item.delivered / item.totalAllocated) * 100),
  );
  return `${width}%` as DimensionValue;
};

export default function AllocatedCylindersScreen() {
  const router = useRouter();
  const [driverId, setDriverId] = useState<number | null>(null);

  const [data, setData] = useState<AllocatedResponse>({
    summary: {
      totalAllocated: 0,
      delivered: 0,
      pending: 0,
      returned: 0,
      defective: 0,
    },
    items: [],
  });

  const [selectedBatch, setSelectedBatch] =
    useState<AllocatedCylinderItem | null>(null);

  const [counterItems, setCounterItems] = useState<BatchCounterItem[]>([]);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [defectiveModalVisible, setDefectiveModalVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const fetchAllocatedCylinders = useCallback(async () => {
    if (!driverId) {
      return;
    }

    try {
      setError("");

      const response = await api.get(
        `/drivers/${driverId}/allocated-cylinders`,
      );

      if (response.data?.success) {
        setData({
          summary: response.data.data?.summary || {
            totalAllocated: 0,
            delivered: 0,
            pending: 0,
            returned: 0,
            defective: 0,
          },
          items: response.data.data?.items || [],
        });
      } else {
        setError("Failed to load allocated cylinders");
      }
    } catch (err: any) {
      console.error(
        "fetchAllocatedCylinders error:",
        err?.response?.data || err.message,
      );
      setError("Failed to load allocated cylinders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (!driverId) {
      return;
    }

    fetchAllocatedCylinders();
  }, [fetchAllocatedCylinders, driverId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllocatedCylinders();
  };

  const headerSubText = useMemo(() => {
    const base = `${data.summary.totalAllocated} units · ${data.summary.delivered} delivered · ${data.summary.pending} pending`;
    const carried = Number(data.summary.carriedForward || 0);

    return carried > 0 ? `${base} · ${carried} carried forward` : base;
  }, [data]);

  const openBatchDetail = async (item: AllocatedCylinderItem) => {
    try {
      setBatchLoading(true);

      const response = await api.get(
        `/drivers/${driverId}/allocated-batches/${item.allocationSalesItemId}`,
      );

      if (response.data?.success) {
        const detail = response.data.data;

        setSelectedBatch({
          ...item,
          ...detail,
          id: detail.allocationSalesItemId,
          saleItemId: detail.allocationSalesItemId,
          saleId: detail.allocationSaleId,
          allocationSaleId: detail.allocationSaleId,
          allocationSalesItemId: detail.allocationSalesItemId,
          batchNo: detail.batchNo,
          productId: detail.productId,
          productName: detail.productName,
          productType: detail.productType,
          size: detail.size,
          totalAllocated: detail.totalAllocated,
          delivered: detail.delivered,
          returned: detail.returned,
          defective: detail.defective,
          pending: detail.pending,
          lastAllocatedAt: detail.allocatedAt,
          latestSaleId: detail.allocationSaleId,
        });
      } else {
        Alert.alert("Error", response.data?.message || "Batch not found");
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to open batch",
      );
    } finally {
      setBatchLoading(false);
    }
  };

  const buildCounterItems = () => {
    if (!selectedBatch) return;

    setCounterItems([
      {
        productId: selectedBatch.productId,
        productName: selectedBatch.productName,
        productType: selectedBatch.productType,
        size: getProductSize(selectedBatch),
        maxQuantity: selectedBatch.pending,
        quantity: 0,
      },
    ]);
  };

  const openReturnModal = () => {
    buildCounterItems();
    setReturnModalVisible(true);
  };

  const openDefectiveModal = () => {
    buildCounterItems();
    setDefectiveModalVisible(true);
  };

  const updateCounter = (index: number, direction: "PLUS" | "MINUS") => {
    setCounterItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const nextValue =
          direction === "PLUS"
            ? Math.min(item.quantity + 1, item.maxQuantity)
            : Math.max(item.quantity - 1, 0);

        return {
          ...item,
          quantity: nextValue,
        };
      }),
    );
  };

  const totalSelected = counterItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  const submitBatchRequest = async (isDefective: 0 | 1) => {
    if (!selectedBatch) return;

    const validItems = counterItems.filter((item) => item.quantity > 0);

    if (!validItems.length) {
      Alert.alert("Required", "Please select at least one cylinder");
      return;
    }

    try {
      setSubmitting(true);

      const response = await api.post("/drivers/in-hand/request", {
        driver_id: driverId,
        is_defective: isDefective,
        allocation_sale_id: selectedBatch.allocationSaleId,
        allocation_sales_item_id: selectedBatch.allocationSalesItemId,
        batch_no: selectedBatch.batchNo,
        items: validItems.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          allocation_sale_id: selectedBatch.allocationSaleId,
          allocation_sales_item_id: selectedBatch.allocationSalesItemId,
          batch_no: selectedBatch.batchNo,
        })),
      });

      if (response.data?.success) {
        setReturnModalVisible(false);
        setDefectiveModalVisible(false);
        setCounterItems([]);
        setSelectedBatch(null);

        await fetchAllocatedCylinders();
      }
    } catch (err: any) {
      // Handled by global API interceptor
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedBatch) {
    return (
      <ScreenContainer>
        <AppHeader />

        <View style={styles.content}>
          <View style={styles.detailHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedBatch(null)}
            >
              <Ionicons name="arrow-back" size={24} color={DS.textPrimary} />
            </TouchableOpacity>

            <Text style={styles.detailTitle}>
              {selectedBatch.productType === "DOMESTIC"
                ? "LPG Domestic"
                : "LPG Commercial"}
            </Text>
          </View>

          <View style={styles.detailMainCard}>
            <View style={styles.detailTopRow}>
              <Image
                source={require("../../assets/images/Cylinder.png")}
                style={{ width: 42, height: 48, resizeMode: "contain" }}
              />

              <View style={styles.detailTitleBox}>
                <Text style={styles.detailUnits}>
                  {selectedBatch.totalAllocated} units
                </Text>

                <Text style={styles.detailSubText}>
                  {formatProductType(selectedBatch.productType)} ·{" "}
                  {getProductSize(selectedBatch)}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}># {selectedBatch.batchNo}</Text>

              <Ionicons
                name="calendar-outline"
                size={18}
                color={DS.textSecondary}
              />

              <Text style={styles.metaText}>
                {formatDate(selectedBatch.lastAllocatedAt)}
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: getProgressWidth(selectedBatch) },
                ]}
              />
            </View>

            <View style={styles.detailStatsRow}>
              <DetailStat
                label="TOTAL"
                value={selectedBatch.totalAllocated}
                color={DS.textPrimary}
                bg={DS.surface}
              />

              <DetailStat
                label="DELIVERED"
                value={selectedBatch.delivered}
                color={PALETTE.green600}
                bg={DS.greenSoft}
              />

              <DetailStat
                label="PENDING"
                value={selectedBatch.pending}
                color={DS.orangeText}
                bg={DS.orangeSoft}
              />
            </View>

            {((selectedBatch.returned ?? 0) > 0 ||
              (selectedBatch.defective ?? 0) > 0) && (
              <View style={styles.detailStatsRow}>
                <DetailStat
                  label="RETURNED"
                  value={selectedBatch.returned ?? 0}
                  color={DS.primary}
                  bg={DS.primarySoft}
                />

                <DetailStat
                  label="DEFECTIVE"
                  value={selectedBatch.defective ?? 0}
                  color={DS.red}
                  bg={DS.redSoft}
                />
              </View>
            )}
          </View>
          {/* 
          <View style={styles.smallStatsRow}>
            <View style={styles.smallStatCard}>
              <View style={styles.smallStatIconBlue}>
                <Ionicons name="home-outline" size={24} color={DS.primary} />
              </View>

              <View>
                <Text style={styles.smallStatLabel}>DOMESTIC</Text>
                <Text style={styles.smallStatValue}>
                  {selectedBatch.productType === "DOMESTIC"
                    ? selectedBatch.totalAllocated
                    : 0}
                </Text>
              </View>
            </View>

            <View style={styles.smallStatCard}>
              <View style={styles.smallStatIconOrange}>
                <Ionicons name="business-outline" size={24} color={DS.orange} />
              </View>

              <View>
                <Text style={styles.smallStatLabel}>COMMERCIAL</Text>
                <Text style={styles.smallStatValue}>
                  {selectedBatch.productType === "COMMERCIAL"
                    ? selectedBatch.totalAllocated
                    : 0}
                </Text>
              </View>
            </View>
          </View> */}

          <Text style={styles.sectionTitle}>ITEM WEIGHTS</Text>

          <View style={styles.weightList}>
            <View style={styles.weightRow}>
              <View style={styles.weightLeft}>
                <Ionicons
                  name="bag-handle-outline"
                  size={20}
                  color={DS.textSecondary}
                />
                <Text style={styles.weightText}>
                  {getProductSize(selectedBatch)}
                </Text>
              </View>

              <View style={styles.weightRight}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {formatProductType(selectedBatch.productType)}
                  </Text>
                </View>

                <Text style={styles.weightQty}>{selectedBatch.pending}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.returnOutlineButton}
            onPress={openReturnModal}
          >
            <Ionicons
              name="return-up-back-outline"
              size={22}
              color={DS.primary}
            />
            <Text style={styles.returnOutlineText}>
              Return in-hand to Godown
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.defectiveOutlineButton}
            onPress={openDefectiveModal}
          >
            <Ionicons name="warning-outline" size={22} color={DS.red} />
            <Text style={styles.defectiveOutlineText}>
              Report Defective Cylinder
            </Text>
          </TouchableOpacity>
        </View>

        <BatchCounterModal
          visible={returnModalVisible}
          title="Return to Godown"
          subtitle={`Select items and set the count from batch ${selectedBatch.batchNo}`}
          icon="return-up-back-outline"
          iconColor={DS.primary}
          buttonText="Confirm Return"
          buttonColor={DS.primary}
          items={counterItems}
          totalSelected={totalSelected}
          submitting={submitting}
          onClose={() => setReturnModalVisible(false)}
          onChange={updateCounter}
          onSubmit={() => submitBatchRequest(0)}
        />

        <BatchCounterModal
          visible={defectiveModalVisible}
          title="Report Defective"
          subtitle={`Select items and set the count from batch ${selectedBatch.batchNo}`}
          icon="warning-outline"
          iconColor={DS.red}
          buttonText="Submit Report"
          buttonColor={DS.red}
          items={counterItems}
          totalSelected={totalSelected}
          submitting={submitting}
          onClose={() => setDefectiveModalVisible(false)}
          onChange={updateCounter}
          onSubmit={() => submitBatchRequest(1)}
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
        <View style={styles.titleRow}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.8}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={30} color={DS.textPrimary} />
          </TouchableOpacity>

          <View style={styles.titleTextWrap}>
            <Text style={styles.pageTitle}>Allocated Cylinders</Text>
            <Text style={styles.pageSubTitle}>{headerSubText}</Text>
          </View>
        </View>

        {loading || batchLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={DS.primary} />
            <Text style={styles.infoText}>Loading allocated cylinders...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchAllocatedCylinders}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : data.items.length ? (
          data.items.map((item) => (
            <TouchableOpacity
              key={`${item.batchNo}-${item.allocationSalesItemId}`}
              activeOpacity={0.88}
              onPress={() => openBatchDetail(item)}
            >
              <AllocatedCard item={item} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No allocated cylinders found</Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

function AllocatedCard({ item }: { item: AllocatedCylinderItem }) {
  const size = getProductSize(item);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconBox, { backgroundColor: "transparent" }]}>
          <Image
            source={require("../../assets/images/Cylinder.png")}
            style={{ width: 42, height: 48, resizeMode: "contain" }}
          />
        </View>

        <View style={styles.productInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.productName}:
            </Text>

            <View style={styles.typePill}>
              <Text style={styles.typePillText}>
                {formatProductType(item.productType)}
              </Text>
            </View>
          </View>

          <Text style={styles.productSize}>{size}</Text>

          <View style={styles.batchRow}>
            <Text style={styles.batchText}># {item.batchNo}</Text>

            <Ionicons
              name="calendar-outline"
              size={17}
              color={DS.textSecondary}
            />

            <Text style={styles.batchText}>
              {formatDate(item.lastAllocatedAt)}
            </Text>
          </View>

          {item.isCarryForward && item.pending > 0 ? (
            <View style={styles.carryForwardPill}>
              <Ionicons name="repeat-outline" size={13} color={DS.orangeText} />
              <Text style={styles.carryForwardPillText}>Carried forward</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.unitsBox}>
          <Text style={styles.unitsValue}>{item.totalAllocated}</Text>
          <Text style={styles.unitsLabel}>units</Text>
        </View>

        <Ionicons name="chevron-forward" size={22} color={DS.textSecondary} />
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: getProgressWidth(item) }]}
        />
      </View>

      <View style={styles.statsRow}>
        <MiniStat
          icon="cube-outline"
          label="TOTAL"
          value={item.totalAllocated}
          color={DS.primary}
          bg={DS.surface}
        />

        <MiniStat
          icon="checkmark-circle-outline"
          label="DELIVERED"
          value={item.delivered}
          color={PALETTE.green600}
          bg={DS.greenSoft}
        />

        <MiniStat
          icon="time-outline"
          label="PENDING"
          value={item.pending}
          color={DS.orangeText}
          bg={DS.orangeSoft}
        />
      </View>
    </View>
  );
}

function MiniStat({
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
    <View style={[styles.miniStat, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={color} />

      <View>
        <Text style={styles.miniLabel}>{label}</Text>
        <Text style={[styles.miniValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

function DetailStat({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.detailStatCard, { backgroundColor: bg }]}>
      <Text style={styles.detailStatLabel}>{label}</Text>
      <Text style={[styles.detailStatValue, { color }]}>{value}</Text>
    </View>
  );
}

function BatchCounterModal({
  visible,
  title,
  subtitle,
  icon,
  iconColor,
  buttonText,
  buttonColor,
  items,
  totalSelected,
  submitting,
  onClose,
  onChange,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  icon: any;
  iconColor: string;
  buttonText: string;
  buttonColor: string;
  items: BatchCounterItem[];
  totalSelected: number;
  submitting: boolean;
  onClose: () => void;
  onChange: (index: number, direction: "PLUS" | "MINUS") => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />

        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <Ionicons name={icon} size={24} color={iconColor} />
              <Text style={styles.modalTitle}>{title}</Text>
            </View>

            <TouchableOpacity onPress={onClose}>
              <Ionicons
                name="close-outline"
                size={26}
                color={DS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>{subtitle}</Text>

          <View style={styles.counterList}>
            {items.map((item, index) => (
              <View
                key={`${item.productId}-${index}`}
                style={styles.counterRow}
              >
                <View style={styles.counterLeft}>
                  {/* <Ionicons
                    name="bag-handle-outline"
                    size={22}
                    color={DS.textSecondary}
                  /> */}

                  <View>
                    <Text style={styles.counterName}>{item.size}</Text>
                    <Text style={styles.counterMeta}>
                      {formatProductType(item.productType)} · max{" "}
                      {item.maxQuantity}
                    </Text>
                  </View>
                </View>

                <View style={styles.counterRight}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => onChange(index, "MINUS")}
                  >
                    <Text style={styles.counterButtonText}>−</Text>
                  </TouchableOpacity>

                  <Text style={styles.counterValue}>{item.quantity}</Text>

                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => onChange(index, "PLUS")}
                  >
                    <Text style={styles.counterButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.totalSelectedRow}>
            <Text style={styles.totalSelectedText}>Total selected</Text>
            <Text style={styles.totalSelectedValue}>{totalSelected}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.modalSubmitButton,
              {
                backgroundColor:
                  totalSelected > 0 ? buttonColor : PALETTE.primary200,
              },
            ]}
            disabled={submitting || totalSelected <= 0}
            onPress={onSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={DS.white} />
            ) : (
              <Text style={styles.modalSubmitText}>{buttonText}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    marginBottom: 18,
  },

  backButton: {
    width: 42,
    alignItems: "flex-start",
  },

  titleTextWrap: {
    flex: 1,
  },

  pageTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },

  pageSubTitle: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 3,
  },

  card: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: DS.border,
    padding: 16,
    marginBottom: 18,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconBox: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  productInfo: {
    flex: 1,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  productName: {
    ...TYPO.s1,
    color: DS.textPrimary,
    flexShrink: 1,
  },

  typePill: {
    backgroundColor: DS.grey100,
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  typePillText: {
    ...TYPO.c2,
    // color: DS.textSecondary,
    fontWeight: "500",
    fontSize: 12,
  },

  productSize: {
    ...TYPO.b2,
    color: DS.textSecondary,
    marginTop: 7,
  },

  batchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
  },

  carryForwardPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: DS.orangeSoft,
  },

  carryForwardPillText: {
    ...TYPO.c2,
    color: DS.orangeText,
  },

  batchText: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },

  unitsBox: {
    alignItems: "center",
    marginLeft: 8,
  },

  unitsValue: {
    ...TYPO.h3,
    color: DS.textPrimary,
  },

  unitsLabel: {
    ...TYPO.c2,
    color: DS.textSecondary,
    marginTop: -4,
  },

  progressTrack: {
    height: 10,
    backgroundColor: DS.grey100,
    borderRadius: RADIUS.pill,
    overflow: "hidden",
    marginTop: 22,
  },

  progressFill: {
    height: "100%",
    backgroundColor: DS.green,
    borderRadius: RADIUS.pill,
  },

  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },

  miniStat: {
    flex: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: 13,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  miniLabel: {
    ...EYEBROW,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 0.2,
    color: DS.textSecondary,
  },

  miniValue: {
    ...TYPO.c2,
    fontSize: 8,
    lineHeight: 12,
    marginTop: 1,
  },

  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },

  detailTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },

  detailMainCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 22,
    marginBottom: 26,
  },

  detailTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  detailIconBox: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 18,
  },

  detailTitleBox: {
    flex: 1,
  },

  detailUnits: {
    ...TYPO.h3,
    color: DS.textPrimary,
  },

  detailSubText: {
    ...TYPO.b2,
    color: DS.textSecondary,
    marginTop: 4,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
  },

  metaText: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },

  detailStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },

  detailStatCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: "center",
  },

  detailStatLabel: {
    ...EYEBROW,
    color: DS.textSecondary,
  },

  detailStatValue: {
    ...TYPO.h5,
    marginTop: 4,
  },

  smallStatsRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 26,
  },

  smallStatCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: DS.card,
  },

  smallStatIconBlue: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DS.primarySoft,
  },

  smallStatIconOrange: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DS.orangeSoft,
  },

  smallStatLabel: {
    ...EYEBROW,
    color: DS.textSecondary,
  },

  smallStatValue: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },

  sectionTitle: {
    ...EYEBROW,
    color: DS.textSecondary,
    marginBottom: 14,
  },

  weightList: {
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: DS.card,
    marginBottom: 34,
  },

  weightRow: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  weightLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  weightText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  weightRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  typeBadge: {
    backgroundColor: DS.grey100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },

  typeBadgeText: {
    ...TYPO.c2,
    color: DS.textSecondary,
  },

  weightQty: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  returnOutlineButton: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: DS.primarySoftBorder,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },

  returnOutlineText: {
    ...TYPO.s1,
    color: DS.primary,
  },

  defectiveOutlineButton: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: PALETTE.red100,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.redSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 12,
  },

  defectiveOutlineText: {
    ...TYPO.s1,
    color: DS.red,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },

  modalSheet: {
    backgroundColor: DS.card,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 22,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  modalTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },

  modalSubtitle: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 16,
    marginBottom: 28,
  },

  counterList: {
    gap: 12,
  },

  counterRow: {
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  counterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },

  counterName: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  counterMeta: {
    ...TYPO.b4,
    color: DS.textSecondary,
    marginTop: 2,
  },

  counterRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },

  counterButton: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  counterButtonText: {
    ...TYPO.h4,
    color: DS.textPrimary,
  },

  counterValue: {
    ...TYPO.h5,
    minWidth: 30,
    textAlign: "center",
    color: DS.textPrimary,
  },

  totalSelectedRow: {
    borderTopWidth: 1,
    borderColor: DS.border,
    marginHorizontal: -18,
    marginTop: 28,
    paddingHorizontal: 18,
    paddingTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  totalSelectedText: {
    ...TYPO.s1,
    color: DS.textSecondary,
  },

  totalSelectedValue: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },

  modalSubmitButton: {
    minHeight: 56,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 20,
  },

  modalSubmitText: {
    ...TYPO.s1,
    color: DS.white,
  },

  centerBox: {
    paddingVertical: 60,
    alignItems: "center",
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

  retryButton: {
    marginTop: 12,
    backgroundColor: DS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
  },

  retryButtonText: {
    ...TYPO.b4,
    color: DS.white,
  },

  emptyBox: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 30,
    alignItems: "center",
  },

  emptyText: {
    ...TYPO.b3,
    color: DS.textSecondary,
  },
});
