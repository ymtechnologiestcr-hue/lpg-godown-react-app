import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Platform,
  Share,
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
import { API_SERVER_ROOT } from "../../services/api";
import {
  approveStockInLoad,
  getStockInLoadDetail,
} from "../../services/godownService";

const resolveImageUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${API_SERVER_ROOT}${value}`;
  return value;
};

const getDownloadFileName = (url: string, fallbackName: string) => {
  const cleanUrl = url.split("?")[0];
  const lastSegment = cleanUrl.split("/").pop();
  if (!lastSegment) return fallbackName;
  return lastSegment.includes(".") ? lastSegment : fallbackName;
};

export default function GodownLoadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rangeKey } = useDateRange();
  const [loadData, setLoadData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  const fetchLoadDetail = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getStockInLoadDetail(id);
      setLoadData(data);
    } catch (error) {
      console.log("Stock in detail error:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLoadDetail();
  }, [fetchLoadDetail]);

  useEffect(() => {
    fetchLoadDetail();
  }, [rangeKey, fetchLoadDetail]);

  const handleApprove = async () => {
    if (loadData?.status !== "WAITING_APPROVAL") {
      return;
    }

    try {
      setApproving(true);
      await approveStockInLoad(id);
      DeviceEventEmitter.emit("STOCK_IN_APPROVED", Number(id));
      router.back();
    } catch (error) {
      console.log("Approve stock in error:", error);
    } finally {
      setApproving(false);
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

  const invoiceImageUrl = resolveImageUrl(loadData.invoiceImageUrl);

  const handleDownloadInvoice = async () => {
    if (!invoiceImageUrl) {
      Alert.alert("Download unavailable", "Invoice photo is not available.");
      return;
    }

    const fallbackName = `invoice-${loadData.invoice || id}.jpg`;
    const fileName = getDownloadFileName(invoiceImageUrl, fallbackName);

    try {
      if (Platform.OS === "web") {
        const response = await fetch(invoiceImageUrl);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = objectUrl;
        anchor.download = fileName;
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      // Download to app documents directory
      const localUri = `${FileSystem.documentDirectory ?? ""}${fileName}`;
      const downloadedFile = await FileSystem.downloadAsync(
        invoiceImageUrl,
        localUri,
      );

      // Share the file so user can save it to Downloads or other locations
      await Share.share({
        url: downloadedFile.uri,
        title: "Invoice Photo",
        message: "Save invoice to Downloads",
      });
    } catch (error) {
      console.log("Invoice download error:", error);
      Alert.alert(
        "Download failed",
        "Could not download the invoice photo. Please try again.",
      );
    }
  };

  return (
    <ScreenContainer>
      <AppHeader />

      <View style={styles.content}>
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
            <Text style={styles.totalValue}>{loadData.qty}</Text>
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
          <InfoRow icon="cube-outline" label="DEPOT" value={loadData.depot} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ITEM-WISE STOCK</Text>
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHead}>
            <Text style={styles.tableHeadText}>ITEM</Text>
            <Text style={styles.tableHeadText}>QTY</Text>
          </View>

          {loadData.items?.map((item: any) => (
            <StockRow
              key={item.transaction_id}
              label={item.item}
              value={item.quantity}
            />
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalRowText}>TOTAL</Text>
            <Text style={styles.totalRowValue}>{loadData.qty}</Text>
          </View>
        </View>

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

        <View style={styles.photoHeader}>
          <Text style={styles.sectionTitleSmall}>INVOICE PHOTO</Text>

          <TouchableOpacity
            style={[
              styles.downloadPill,
              !invoiceImageUrl && styles.downloadPillDisabled,
            ]}
            onPress={handleDownloadInvoice}
            disabled={!invoiceImageUrl}
          >
            <Ionicons
              name="download-outline"
              size={14}
              color={DS.textPrimary}
            />
            <Text style={styles.downloadText}>DOWNLOAD</Text>
          </TouchableOpacity>
        </View>

        {invoiceImageUrl ? (
          <Image
            source={{ uri: invoiceImageUrl }}
            style={styles.invoiceImage}
          />
        ) : (
          <View style={styles.invoiceEmptyBox}>
            <Ionicons name="image-outline" size={26} color={DS.textSecondary} />
            <Text style={styles.invoiceEmptyText}>
              Invoice photo not uploaded
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomAction}>
        <TouchableOpacity
          style={styles.approveButton}
          onPress={handleApprove}
          disabled={
            approving ||
            loadData.status === "APPROVED" ||
            loadData.status !== "WAITING_APPROVAL"
          }
        >
          <Ionicons name="checkmark" size={18} color={DS.white} />
          <Text style={styles.approveText}>
            {loadData.status === "APPROVED"
              ? "Approved"
              : loadData.status !== "WAITING_APPROVAL"
                ? "Waiting for submit"
                : approving
                  ? "Approving..."
                  : `Approve All Stock (${loadData.qty})`}
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

function StockRow({ label, value }: any) {
  return (
    <View style={styles.stockRow}>
      <Text style={styles.stockLabel}>{label}</Text>
      <Text style={styles.stockValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderBox: {
    height: 400,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 130,
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
    fontWeight: WEIGHT.semibold,
    color: DS.textSecondary,
    letterSpacing: 0.8,
  },
  infoCard: {
    backgroundColor: DS.card,
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
    borderRadius: RADIUS.sm,
    backgroundColor: DS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoLabel: {
    ...EYEBROW,
    color: DS.textSecondary,
  },
  infoValue: {
    ...TYPO.b4,
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
  tableCard: {
    backgroundColor: DS.card,
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
    ...EYEBROW,
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
  },
  stockValue: {
    ...TYPO.s2,
    color: DS.textPrimary,
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
  invoiceCard: {
    backgroundColor: DS.card,
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
  downloadPillDisabled: {
    opacity: 0.55,
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
  invoiceEmptyBox: {
    height: 190,
    borderRadius: RADIUS.sm,
    marginTop: 8,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  invoiceEmptyText: {
    ...TYPO.c2,
    color: DS.textSecondary,
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
  approveButton: {
    height: 52,
    backgroundColor: DS.buttonGreen,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  approveText: {
    ...TYPO.s2,
    color: DS.white,
  },
});
