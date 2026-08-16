import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  ScrollView,
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
  PALETTE,
  RADIUS,
  TYPO,
  WEIGHT,
} from "../../constants/designSystem";
import { useDateRange } from "../../context/DateRangeContext";
import {
  cancelStockOutLoad,
  getStockOutLoadDetail,
} from "../../services/godownService";

export default function GodownLoadOutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rangeKey } = useDateRange();

  const [loadData, setLoadData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchLoadDetail = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getStockOutLoadDetail(id);
      setLoadData(data);
    } catch (error) {
      console.log("Stock out detail error:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLoadDetail();
  }, [fetchLoadDetail, rangeKey]);

  const handleCancel = async () => {
    try {
      setCancelling(true);

      await cancelStockOutLoad(id);

      DeviceEventEmitter.emit("STOCK_OUT_CANCELLED", Number(id));
      DeviceEventEmitter.emit("NEW_STOCK_OUT");

      router.back();
    } catch (error: any) {
      console.log("Cancel stock out error:", error?.response?.data || error);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <AppHeader />
        <View style={styles.loaderBox}>
          <ActivityIndicator color={DS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!loadData) {
    return (
      <ScreenContainer>
        <AppHeader />
        <View style={styles.content}>
          <Text>No load data found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const emptyTotal = Number(loadData.empty_qty || 0);
  const defectiveTotal = Number(loadData.defective_qty || 0);
  const totalQty = Number(loadData.qty || emptyTotal + defectiveTotal);
  const isCancelled = loadData.status === "CANCELLED";

  return (
    <ScreenContainer>
      <AppHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={23} color={DS.textPrimary} />
          </TouchableOpacity>

          <View style={styles.titleBox}>
            <Text style={styles.title}>{loadData.load}</Text>
            <Text style={styles.date}>
              {loadData.date
                ? new Date(loadData.date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "N/A"}
            </Text>
          </View>

          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>{totalQty}</Text>
            <Text style={styles.totalLabel}>CYLINDERS</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <InfoRow
            icon="car-outline"
            label="VEHICLE"
            value={loadData.vehicle}
          />
          <InfoRow
            icon="person-outline"
            label="DRIVER"
            value={loadData.driver}
          />
          <InfoRow
            icon="cube-outline"
            label="DEPOT"
            value={loadData.depot || "HP Gas Depot - Sector 12"}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ITEM-WISE STOCK</Text>

          <TouchableOpacity style={styles.editPill}>
            <Ionicons name="pencil-outline" size={14} color={DS.textPrimary} />
            <Text style={styles.editText}>EDIT</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHead}>
            <Text style={styles.tableHeadText}>ITEM</Text>
            <Text style={styles.tableHeadText}>QTY</Text>
          </View>

          {loadData.items?.map((item: any) => (
            <StockRow
              key={`empty-${item.transaction_id}`}
              label={`${item.item} Empty (${item.type})`}
              value={item.quantity}
            />
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalRowText}>TOTAL EMPTIES</Text>
            <Text style={styles.totalRowValue}>{emptyTotal}</Text>
          </View>
        </View>

        {loadData.defective_items?.length > 0 && (
          <>
            <View style={styles.defectiveTopHeader}>
              <View style={styles.defectiveTitleLeft}>
                <Ionicons name="warning-outline" size={15} color={DS.red} />
                <Text style={styles.defectiveTopTitle}>DEFECTIVE ITEMS</Text>
              </View>

              <Text style={styles.defectiveTopTotal}>
                {defectiveTotal} TOTAL
              </Text>
            </View>

            <View style={styles.defectiveTableCard}>
              <View style={styles.defectiveTableHead}>
                <Text style={styles.defectiveHeadText}>DEFECTIVE ITEM</Text>
                <Text style={styles.defectiveHeadText}>QTY</Text>
              </View>

              {loadData.defective_items.map((item: any) => (
                <StockRow
                  key={`defective-${item.transaction_id}`}
                  label={`${item.item} Defective (${item.type})`}
                  value={item.quantity}
                  danger
                />
              ))}

              <View style={styles.defectiveTotalRow}>
                <Text style={styles.defectiveTotalText}>TOTAL DEFECTIVES</Text>
                <Text style={styles.defectiveTotalValue}>{defectiveTotal}</Text>
              </View>
            </View>
          </>
        )}

        <Text style={styles.sectionTitleSmall}>INVOICE DETAILS</Text>

        <View style={styles.invoiceCard}>
          <View style={styles.invoiceRow}>
            <View style={styles.invoiceLeft}>
              <Ionicons
                name="document-text-outline"
                size={16}
                color={DS.textSecondary}
              />
              <Text style={styles.invoiceLabel}>Invoice No.</Text>
            </View>

            <Text style={styles.invoiceValue}>{loadData.invoice}</Text>
          </View>

          <View style={styles.invoiceRow}>
            <View style={styles.invoiceLeft}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={DS.textSecondary}
              />
              <Text style={styles.invoiceLabel}>Invoice Date</Text>
            </View>

            <Text style={styles.invoiceValue}>
              {loadData.date
                ? new Date(loadData.date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "N/A"}
            </Text>
          </View>
        </View>

        {/* <View style={styles.photoHeader}>
          <Text style={styles.sectionTitleSmall}>INVOICE PHOTO</Text>

          <TouchableOpacity style={styles.downloadPill}>
            <Ionicons name="download-outline" size={14} color={DS.textPrimary} />
            <Text style={styles.downloadText}>DOWNLOAD</Text>
          </TouchableOpacity>
        </View>

        <Image
          source={{
            uri: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=900&auto=format&fit=crop',
          }}
          style={styles.invoiceImage}
        /> */}
      </ScrollView>

      <View style={styles.bottomAction}>
        <TouchableOpacity
          style={[
            styles.cancelButton,
            isCancelled && styles.cancelledButtonDisabled,
          ]}
          onPress={handleCancel}
          disabled={cancelling || isCancelled}
        >
          <Text style={styles.cancelButtonText}>
            {isCancelled
              ? "Cancelled"
              : cancelling
                ? "Cancelling..."
                : "Cancel"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={23} color={DS.primary} />
      </View>

      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function StockRow({ label, value, danger }: any) {
  return (
    <View style={[styles.stockRow, danger && styles.defectiveStockRow]}>
      <Text style={[styles.stockLabel, danger && styles.defectiveStockLabel]}>
        {label}
      </Text>

      <Text style={[styles.stockValue, danger && styles.defectiveStockValue]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderBox: {
    height: 400,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 170,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  titleBox: {
    flex: 1,
    marginLeft: 18,
  },
  title: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  date: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 2,
  },
  totalBox: {
    alignItems: "flex-end",
  },
  totalValue: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },
  totalLabel: {
    ...TYPO.c3,
    color: DS.textSecondary,
    letterSpacing: 0.6,
  },
  infoCard: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 18,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: DS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoLabel: {
    ...TYPO.c3,
    color: DS.textSecondary,
    letterSpacing: 0.6,
  },
  infoValue: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
    marginTop: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.8,
  },
  sectionTitleSmall: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 18,
  },
  editPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: DS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editText: {
    ...TYPO.c2,
    color: DS.textPrimary,
  },
  tableCard: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    marginTop: 8,
  },
  tableHead: {
    backgroundColor: DS.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  tableHeadText: {
    ...TYPO.c3,
    color: DS.textSecondary,
  },
  stockRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: DS.divider,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stockLabel: {
    ...TYPO.b4,
    color: DS.textPrimary,
    flex: 1,
  },
  stockValue: {
    ...TYPO.s2,
    color: DS.textPrimary,
    marginLeft: 12,
  },
  totalRow: {
    minHeight: 52,
    backgroundColor: DS.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalRowText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
  },
  totalRowValue: {
    ...TYPO.s1,
    color: DS.primary,
  },
  defectiveTopHeader: {
    marginTop: 18,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  defectiveTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  defectiveTopTitle: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.8,
  },
  defectiveTopTotal: {
    ...TYPO.c2,
    fontWeight: WEIGHT.semibold,
    color: DS.red,
  },
  defectiveTableCard: {
    backgroundColor: DS.redSoft,
    borderWidth: 1,
    borderColor: PALETTE.red100,
    borderRadius: RADIUS.md,
    overflow: "hidden",
  },
  defectiveTableHead: {
    backgroundColor: DS.redSoft,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.red100,
  },
  defectiveHeadText: {
    ...TYPO.c3,
    color: DS.red,
    letterSpacing: 0.6,
  },
  defectiveStockRow: {
    backgroundColor: DS.redSoft,
    borderBottomColor: PALETTE.red100,
  },
  defectiveStockLabel: {
    color: DS.textPrimary,
  },
  defectiveStockValue: {
    color: DS.red,
  },
  defectiveTotalRow: {
    minHeight: 52,
    backgroundColor: DS.redSoft,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: PALETTE.red100,
  },
  defectiveTotalText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
  },
  defectiveTotalValue: {
    ...TYPO.s1,
    color: DS.red,
  },
  invoiceCard: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    padding: 14,
    gap: 12,
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  invoiceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  invoiceLabel: {
    ...TYPO.b3,
    color: DS.textSecondary,
  },
  invoiceValue: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
  },
  photoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  downloadPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: DS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  downloadText: {
    ...TYPO.c2,
    color: DS.textPrimary,
  },
  invoiceImage: {
    height: 190,
    borderRadius: RADIUS.sm,
    marginTop: 8,
  },
  bottomAction: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 72,
    padding: 16,
    backgroundColor: DS.surface,
    borderTopWidth: 1,
    borderTopColor: DS.border,
  },
  cancelButton: {
    height: 52,
    backgroundColor: DS.red,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelledButtonDisabled: {
    backgroundColor: DS.disabledBg,
  },
  cancelButtonText: {
    ...TYPO.s2,
    color: DS.white,
  },
});
