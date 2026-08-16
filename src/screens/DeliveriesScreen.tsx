import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  Keyboard,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";

import AppHeader from "../components/common/AppHeader";
import ScreenContainer from "../components/common/ScreenContainer";
import ConfirmDeliveryModal from "../components/ui/ConfirmDeliveryModal";
import DeliveryCard from "../components/ui/DeliveryCard";
import { AUTH_USER_KEY } from "../constants/auth";
import { DS, PALETTE, RADIUS, TYPO } from "../constants/designSystem";
import { useDateRange } from "../context/DateRangeContext";
import api from "../services/api";
import { DriverDeliveriesResponse, DriverDeliveryItem } from "../types";

type FinderMode = "NUMBER" | "SCAN" | "QR";

type TransactionType = "SALE" | "RETURN";
type ReturnCategory = "COMMERCIAL" | "DOMESTIC";
type ReturnPaymentMethod = "CASH" | "UPI" | "CARD";
type ReturnReason = "DISCONNECTION" | "TRANSFER" | "SURRENDER" | "OTHER";

type ReturnProduct = {
  id: number;
  name: string;
  type: string;
  price: number;
  categoryName: string;
};

const RETURN_REASONS: { key: ReturnReason; label: string }[] = [
  { key: "DISCONNECTION", label: "Disconnection" },
  { key: "TRANSFER", label: "Transfer" },
  { key: "SURRENDER", label: "Surrender" },
  { key: "OTHER", label: "Other" },
];

type FoundCustomer = {
  id: number;
  name: string;
  phone: string;
  address?: string;
  consumerNumber?: string;
  productType?: string;
  type?: string;
  quantity?: number;
};

type BatchItem = {
  allocationSaleId: number;
  allocationSalesItemId: number;
  batchNo: string;
  productId: number;
  productName: string;
  productType: "DOMESTIC" | "COMMERCIAL";
  productPrice: number;
  size?: string;
  totalAllocated: number;
  delivered: number;
  returned: number;
  defective: number;
  pending: number;
  allocatedAt: string;
};

const formatBatchType = (type?: string) => {
  if (type === "DOMESTIC") return "Domestic";
  if (type === "COMMERCIAL") return "Commercial";
  return type || "Domestic";
};

const formatSize = (batch: BatchItem) => {
  if (batch.size) return batch.size;
  const match = batch.productName?.match(/\d+\.?\d*\s?kg/i);
  return match?.[0] || "";
};

export default function DeliveriesScreen() {
  const router = useRouter();
  const { rangeKey } = useDateRange();
  const [driverId, setDriverId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<DriverDeliveriesResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<"TODAY" | "COMMERCIAL">("TODAY");

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState<DriverDeliveryItem | null>(
    null,
  );
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [finderVisible, setFinderVisible] = useState(false);
  const [finderMode, setFinderMode] = useState<FinderMode>("NUMBER");
  const [consumerNumber, setConsumerNumber] = useState("");
  const [findingCustomer, setFindingCustomer] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [foundCustomer, setFoundCustomer] = useState<FoundCustomer | null>(
    null,
  );

  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [availableBatches, setAvailableBatches] = useState<BatchItem[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [pendingCreateSaleOpen, setPendingCreateSaleOpen] = useState(false);

  const [createSaleVisible, setCreateSaleVisible] = useState(false);
  const [createSaleLoading, setCreateSaleLoading] = useState(false);

  const [salePaymentMethod, setSalePaymentMethod] = useState<
    "CASH" | "UPI" | "ONLINE" | "CREDIT"
  >("CASH");
  const [saleAmount, setSaleAmount] = useState("950");
  const [emptyCylinderQty, setEmptyCylinderQty] = useState(1);
  const [saleQty, setSaleQty] = useState(1);
  const [otp, setOtp] = useState("");

  // Sale vs Return toggle (chosen inside the batch/return modal).
  const [transactionType, setTransactionType] =
    useState<TransactionType>("SALE");

  // Return flow state.
  const [returnCategory, setReturnCategory] =
    useState<ReturnCategory>("COMMERCIAL");
  const [returnProducts, setReturnProducts] = useState<ReturnProduct[]>([]);
  const [returnProductsLoading, setReturnProductsLoading] = useState(false);
  const [selectedReturnProduct, setSelectedReturnProduct] =
    useState<ReturnProduct | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnPaymentMethod, setReturnPaymentMethod] =
    useState<ReturnPaymentMethod>("CASH");
  const [returnAmount, setReturnAmount] = useState("0");
  const [returnReason, setReturnReason] =
    useState<ReturnReason>("DISCONNECTION");
  const [returnOtp, setReturnOtp] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    const loadDriverId = async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const role = parsed?.role ?? null;
        setUserRole(role);

        // Only resolve driver id for DRIVER role.
        if (role !== "DRIVER") {
          return;
        }

        const id = Number(parsed?.id);

        if (id && !Number.isNaN(id)) {
          setDriverId(id);
        } else {
          setError("Driver not found in session");
        }
      } catch {
        setError("Failed to load driver session");
      }
    };

    loadDriverId();
  }, []);

  const fetchDeliveries = useCallback(async () => {
    if (!driverId || userRole !== "DRIVER") {
      return;
    }

    try {
      setError("");

      const response = await api.get(`/drivers/${driverId}/app-deliveries`);

      if (response.data?.success) {
        setDashboard(response.data.data);
      } else {
        setError("Failed to load deliveries");
      }
    } catch (err: any) {
      console.error(
        "fetchDeliveries error:",
        err?.response?.data || err.message,
      );
      setError("Failed to load deliveries");
    }
  }, [driverId, userRole]);

  useEffect(() => {
    const load = async () => {
      if (!driverId || userRole !== "DRIVER") {
        setLoading(false);
        return;
      }

      setLoading(true);
      await fetchDeliveries();
      setLoading(false);
    };

    load();
  }, [fetchDeliveries, driverId, userRole, rangeKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDeliveries();
    setRefreshing(false);
  };

  const handleOpenConfirm = (item: DriverDeliveryItem) => {
    setSelectedSale(item);
    setConfirmVisible(true);
  };

  const handleConfirmDelivery = async (payload: {
    payment_method: "CASH" | "UPI" | "ONLINE" | "CREDIT";
    empty_cylinder_qty: number;
  }) => {
    if (!selectedSale) return;

    try {
      setConfirmLoading(true);

      await api.put(`/drivers/sale/${selectedSale.saleId}/deliver`, {
        payment_method: payload.payment_method,
        empty_cylinder_qty: payload.empty_cylinder_qty,
        empty_product_id: 8,
        created_by: 7,
      });

      setConfirmVisible(false);
      setSelectedSale(null);
      await fetchDeliveries();
    } catch (err: any) {
      console.error(
        "Confirm delivery error:",
        err?.response?.data || err.message,
      );
      Alert.alert("Error", err?.response?.data?.message || "Failed to confirm");
    } finally {
      setConfirmLoading(false);
    }
  };

  const resetCreateSaleForm = () => {
    setSalePaymentMethod("CASH");
    setSaleAmount("950");
    setEmptyCylinderQty(1);
    setSaleQty(1);
    setOtp("");
    setSelectedBatch(null);
    setAvailableBatches([]);
  };

  const resetReturnForm = (category: ReturnCategory = "COMMERCIAL") => {
    setReturnCategory(category);
    setReturnProducts([]);
    setSelectedReturnProduct(null);
    setReturnQty(1);
    setReturnPaymentMethod("CASH");
    setReturnAmount("0");
    setReturnReason("DISCONNECTION");
    setReturnOtp("");
    setReturnSubmitting(false);
  };

  const handleOpenFinder = () => {
    setFinderVisible(true);
    setFinderMode("NUMBER");
    setConsumerNumber("");
    setScanned(false);
  };

  const handleCloseFinder = () => {
    setFinderVisible(false);
    setConsumerNumber("");
    setScanned(false);
    Keyboard.dismiss();
  };

  const handleSwitchFinderMode = async (mode: FinderMode) => {
    setFinderMode(mode);
    setScanned(false);

    if (mode === "QR" && !permission?.granted) {
      await requestPermission();
    }
  };

  const fetchAvailableBatches = async () => {
    if (!driverId) {
      setAvailableBatches([]);
      return;
    }

    try {
      setBatchLoading(true);

      const response = await api.get(`/drivers/${driverId}/available-batches`);

      if (response.data?.success) {
        setAvailableBatches(response.data.data || []);
      } else {
        setAvailableBatches([]);
      }
    } catch (err: any) {
      console.error(
        "fetchAvailableBatches error:",
        err?.response?.data || err.message,
      );
      setAvailableBatches([]);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleFindCustomer = async (value?: string) => {
    const searchValue = (value || consumerNumber).trim();

    if (!searchValue) {
      Alert.alert("Required", "Please enter consumer number or phone number");
      return;
    }

    try {
      setFindingCustomer(true);

      const response = await api.get(
        `/drivers/customers/find?query=${encodeURIComponent(searchValue)}`,
      );

      if (response.data?.success && response.data?.data) {
        const customer = response.data.data;

        setFoundCustomer({
          id: Number(customer.id),
          name: customer.name || "",
          phone: customer.phone || "",
          address: customer.address || "",
          productType: customer.productType || customer.type || "Domestic",
          quantity: Number(customer.quantity || 1),
        });

        handleCloseFinder();
        resetCreateSaleForm();

        const defaultCategory: ReturnCategory = String(
          customer.productType || customer.type || "",
        )
          .toUpperCase()
          .includes("COMMERCIAL")
          ? "COMMERCIAL"
          : "DOMESTIC";
        setTransactionType("SALE");
        resetReturnForm(defaultCategory);

        await fetchAvailableBatches();
        setBatchModalVisible(true);
      } else {
        Alert.alert(
          "Not found",
          response.data?.message || "Customer not found",
        );
      }
    } catch (err: any) {
      console.error(
        "handleFindCustomer error:",
        err?.response?.data || err.message,
      );
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Customer not found",
      );
    } finally {
      setFindingCustomer(false);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;

    setScanned(true);
    setConsumerNumber(data);
    handleFindCustomer(data);

    setTimeout(() => {
      setScanned(false);
    }, 1500);
  };

  const handleBatchSelect = (batch: BatchItem) => {
    setSelectedBatch(batch);
    setSaleAmount(String(batch.productPrice || 0));
    setPendingCreateSaleOpen(true);
    setBatchModalVisible(false);
  };

  const fetchReturnProducts = useCallback(async (category: ReturnCategory) => {
    try {
      setReturnProductsLoading(true);

      const response = await api.get(
        `/drivers/products/search?type=${category}`,
      );

      if (response.data?.success) {
        setReturnProducts(response.data.data || []);
      } else {
        setReturnProducts([]);
      }
    } catch (err: any) {
      console.error(
        "fetchReturnProducts error:",
        err?.response?.data || err.message,
      );
      setReturnProducts([]);
    } finally {
      setReturnProductsLoading(false);
    }
  }, []);

  // Load the returnable products for the chosen category whenever the Return
  // tab is active in the open modal.
  useEffect(() => {
    if (!batchModalVisible || transactionType !== "RETURN") return;
    fetchReturnProducts(returnCategory);
  }, [batchModalVisible, transactionType, returnCategory, fetchReturnProducts]);

  const handleSelectReturnProduct = (product: ReturnProduct) => {
    setSelectedReturnProduct(product);
  };

  const handleSubmitReturn = async () => {
    if (!foundCustomer) return;

    if (!selectedReturnProduct) {
      Alert.alert("Required", "Please select a cylinder type");
      return;
    }

    if (returnQty <= 0) {
      Alert.alert("Required", "Quantity must be at least 1");
      return;
    }

    if (returnOtp.length !== 6) {
      Alert.alert("Required", "Please enter 6 digit OTP");
      return;
    }

    if (returnCategory === "COMMERCIAL") {
      const amountValue = Number(returnAmount || 0);
      if (Number.isNaN(amountValue) || amountValue < 0) {
        Alert.alert("Required", "Please enter a valid amount");
        return;
      }
    }

    try {
      setReturnSubmitting(true);

      await api.post("/drivers/returns", {
        driver_id: driverId,
        customer_name: foundCustomer.name,
        phone: foundCustomer.phone,
        address: foundCustomer.address,

        category: returnCategory,
        product_id: selectedReturnProduct.id,
        quantity: returnQty,

        return_reason: returnCategory === "DOMESTIC" ? returnReason : null,
        payment_method:
          returnCategory === "COMMERCIAL" ? returnPaymentMethod : null,
        amount: returnCategory === "COMMERCIAL" ? Number(returnAmount || 0) : 0,

        otp: returnOtp,
      });

      setBatchModalVisible(false);
      setPendingCreateSaleOpen(false);
      setFoundCustomer(null);
      resetReturnForm();
      setTransactionType("SALE");
      await fetchDeliveries();

      Alert.alert("Success", "Return recorded successfully");
    } catch (err: any) {
      console.error(
        "handleSubmitReturn error:",
        err?.response?.data || err.message,
      );
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to record return",
      );
    } finally {
      setReturnSubmitting(false);
    }
  };

  useEffect(() => {
    if (!pendingCreateSaleOpen || batchModalVisible) return;

    const task = InteractionManager.runAfterInteractions(() => {
      setCreateSaleVisible(true);
      setPendingCreateSaleOpen(false);
    });

    return () => task.cancel();
  }, [pendingCreateSaleOpen, batchModalVisible]);

  useEffect(() => {
    if (!selectedBatch) return;

    if (salePaymentMethod === "ONLINE") {
      setSaleAmount("0");
      return;
    }

    const unitPrice = Number(selectedBatch.productPrice || 0);
    const orderedQty = selectedBatch.productType === "COMMERCIAL" ? saleQty : 1;
    setSaleAmount(String(unitPrice * orderedQty));
  }, [selectedBatch, saleQty, salePaymentMethod]);

  const handleCreateSaleFromCustomer = async (skipOtp = false) => {
    if (!foundCustomer) return;

    if (!selectedBatch) {
      Alert.alert("Required", "Please select batch");
      return;
    }

    if (skipOtp !== true && otp.length !== 6) {
      Alert.alert("Required", "Please enter 6 digit OTP");
      return;
    }

    try {
      setCreateSaleLoading(true);

      const orderedQty =
        selectedBatch.productType === "COMMERCIAL" ? saleQty : 1;
      const isDomestic = selectedBatch.productType !== "COMMERCIAL";

      // Empty cylinders must match the delivered quantity only for DOMESTIC.
      // For COMMERCIAL the collected empties can differ from the number sold.
      if (isDomestic && emptyCylinderQty !== orderedQty) {
        Alert.alert(
          "Empty Cylinders Mismatch",
          `You are delivering ${orderedQty} cylinder${orderedQty !== 1 ? "s" : ""} but collecting ${emptyCylinderQty} empty cylinder${emptyCylinderQty !== 1 ? "s" : ""}. Please collect exactly ${orderedQty} empty cylinder${orderedQty !== 1 ? "s" : ""}.`,
        );
        setCreateSaleLoading(false);
        return;
      }

      if (selectedBatch.pending < orderedQty) {
        Alert.alert("Error", "Selected batch does not have enough cylinders");
        setCreateSaleLoading(false);
        return;
      }

      const emptyCylinderStatus =
        emptyCylinderQty > 0 ? "DELIVERED" : "PENDING";

      const unitPrice = Number(selectedBatch.productPrice || 0);
      const totalAmount = unitPrice * orderedQty;

      await api.post("/drivers/sales", {
        driver_id: driverId,
        customer_id: foundCustomer.id,
        customer_name: foundCustomer.name,
        phone: foundCustomer.phone,
        address: foundCustomer.address,

        cylinder_type: selectedBatch.productType,
        product_id: selectedBatch.productId,
        quantity: orderedQty,

        payment_method: salePaymentMethod,
        amount: totalAmount,

        empty_cylinder_collected: emptyCylinderQty > 0,
        delivered_qty: orderedQty,
        empty_cylinder_qty: Number(emptyCylinderQty || 0),
        empty_cylinder_status: emptyCylinderStatus,
        defective_qty: 0,

        allocation_sale_id: selectedBatch.allocationSaleId,
        allocation_sales_item_id: selectedBatch.allocationSalesItemId,
        batch_no: selectedBatch.batchNo,

        otp,
      });

      setCreateSaleVisible(false);
      setFoundCustomer(null);
      resetCreateSaleForm();
      await fetchDeliveries();

      Alert.alert("Success", "Sale created successfully");
    } catch (err: any) {
      console.error(
        "handleCreateSaleFromCustomer error:",
        err?.response?.data || err.message,
      );
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to create sale",
      );
    } finally {
      setCreateSaleLoading(false);
    }
  };

  const metrics = useMemo(() => {
    const emptiesRemaining = Number(dashboard?.stats?.empties ?? 0);
    const emptiesOriginal = Number(
      dashboard?.stats?.emptiesOriginal ?? emptiesRemaining,
    );

    const inHandRemaining = Number(dashboard?.stats?.inHand ?? 0);
    const inHandOriginal = Number(
      dashboard?.stats?.inHandOriginal ?? inHandRemaining,
    );

    return {
      allocated: Number(dashboard?.stats?.allocated ?? 0),
      // Left over from previous days and rolled into today's allocated total.
      carriedForward: Number(dashboard?.stats?.carriedForward ?? 0),
      delivered: Number(dashboard?.stats?.delivered ?? 0),
      pendingCollection: Number(dashboard?.stats?.pendingCollection ?? 0),
      emptiesRemaining,
      emptiesOriginal,
      inHandRemaining,
      inHandOriginal,
      systemStock: Number(dashboard?.stats?.systemStock ?? 0),
    };
  }, [dashboard]);

  const filteredDeliveries = useMemo(() => {
    const deliveries = dashboard?.deliveries || [];

    if (activeTab === "COMMERCIAL") {
      return deliveries.filter((item) => item.cylinderType === "COMMERCIAL");
    }

    return deliveries;
  }, [dashboard, activeTab]);

  return (
    <View style={styles.screenRoot}>
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
              <Text style={styles.infoText}>Loading deliveries...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={fetchDeliveries}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Allocated Cylinders */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.allocatedCard}
                onPress={() => router.push("/allocated-cylinders")}
              >
                <View style={styles.allocatedTopRow}>
                  <View
                    style={[
                      styles.allocatedIconWrap,
                      { backgroundColor: "transparent" },
                    ]}
                  >
                    <Image
                      source={require("../../assets/images/Cylinder.png")}
                      style={{ width: 42, height: 48, resizeMode: "contain" }}
                    />
                  </View>

                  <View style={styles.allocatedTitleWrap}>
                    <Text style={styles.allocatedTitle}>Allocated</Text>
                    <Text style={[styles.allocatedTitle, { marginTop: -4 }]}>
                      Cylinders
                    </Text>
                  </View>

                  <View style={styles.allocatedValueWrap}>
                    <Text style={styles.allocatedValue}>
                      {metrics.allocated}
                    </Text>
                    {/* <View style={styles.allocatedValueUnderline} /> */}
                  </View>
                </View>

                <View style={styles.allocatedBottomRow}>
                  <Text style={styles.allocatedMeta}>
                    {metrics.carriedForward > 0
                      ? `Includes ${metrics.carriedForward} carried forward`
                      : "Cylinders allocated to you"}
                  </Text>
                  <View style={styles.viewDetailsBtn}>
                    <Text style={styles.viewDetailsText}>View Details</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Today's Delivery Details */}
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="car-outline" size={20} color={DS.textPrimary} />
                <Text style={styles.sectionHeaderTitle}>
                  Today&apos;s Delivery Details
                </Text>
              </View>

              <View style={styles.detailsContainer}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.detailRow}
                  onPress={() => router.push("/delivered-cylinders")}
                >
                  <View style={styles.detailIconTransparent}>
                    <MaterialCommunityIcons
                      name="meter-gas-outline"
                      size={20}
                      color="black"
                    />
                  </View>
                  <Text style={styles.detailLabel}>Delivered Cylinders</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: PALETTE.green600, fontWeight: "bold" },
                    ]}
                  >
                    {String(metrics.delivered).padStart(2, "0")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.detailRow}
                  onPress={() => router.push("/empty-cylinders")}
                >
                  <View style={styles.detailIconTransparent}>
                    <Ionicons
                      name="arrow-undo-outline"
                      size={20}
                      color={DS.textPrimary}
                    />
                  </View>
                  <Text style={styles.detailLabel}>Empty Return Cylinders</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: DS.red, fontWeight: "bold" },
                    ]}
                  >
                    {String(metrics.emptiesRemaining).padStart(2, "0")}
                  </Text>
                </TouchableOpacity>

                <View style={styles.detailRow}>
                  <View style={styles.detailIconTransparent}>
                    <Ionicons
                      name="warning-outline"
                      size={20}
                      color={DS.textPrimary}
                    />
                  </View>
                  <Text style={styles.detailLabel}>System Stock</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: DS.textPrimary, fontWeight: "bold" },
                    ]}
                  >
                    {String(metrics.systemStock).padStart(2, "0")}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.detailRow}
                  onPress={() => router.push("/collection")}
                >
                  <View style={styles.detailIconTransparent}>
                    <MaterialCommunityIcons
                      name="currency-inr"
                      size={20}
                      color={DS.textPrimary}
                    />
                  </View>
                  <Text style={styles.detailLabel}>Total Collection</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: DS.textPrimary, fontWeight: "bold" },
                    ]}
                  >
                    ₹{metrics.pendingCollection.toLocaleString("en-IN")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Cylinder in Hand + Scanner */}
              <View style={styles.inHandCard}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.inHandTopRow}
                  onPress={() => router.push("/in-hand-cylinders")}
                >
                  <Text style={styles.inHandTitle}>Cylinder in Hand</Text>
                  <Text style={styles.inHandValue}>
                    {metrics.inHandRemaining}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.scanButton}
                  onPress={handleOpenFinder}
                >
                  <Ionicons name="scan-outline" size={24} color={DS.white} />
                  <Text style={styles.scanButtonText}>
                    Scan Customer QR code
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.segmentWrap}>
                <TouchableOpacity
                  style={[
                    styles.segmentTab,
                    activeTab === "TODAY" && styles.segmentTabActive,
                  ]}
                  onPress={() => setActiveTab("TODAY")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      activeTab === "TODAY" && styles.segmentTextActive,
                    ]}
                  >
                    Today&apos;s Deliveries
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentTab,
                    activeTab === "COMMERCIAL" && styles.segmentTabActive,
                  ]}
                  onPress={() => setActiveTab("COMMERCIAL")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      activeTab === "COMMERCIAL" && styles.segmentTextActive,
                    ]}
                  >
                    Commercial
                  </Text>
                </TouchableOpacity>
              </View>

              {filteredDeliveries.length ? (
                filteredDeliveries.map((item) => (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push(`/delivery/${item.saleId}`)}
                    key={item.saleId}
                  >
                    <DeliveryCard
                      name={item.customerName}
                      consumerNumber={item.consumerNumber}
                      address={item.address}
                      type={item.product}
                      qty={item.quantity}
                      status={item.status}
                      showMarkDelivered={item.showMarkDelivered}
                      onMarkDelivered={() => handleOpenConfirm(item)}
                    />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.infoText}>
                    {activeTab === "COMMERCIAL"
                      ? "No commercial deliveries found"
                      : "No deliveries found"}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        <ConfirmDeliveryModal
          visible={confirmVisible}
          onClose={() => {
            setConfirmVisible(false);
            setSelectedSale(null);
          }}
          onSubmit={handleConfirmDelivery}
          loading={confirmLoading}
          sale={
            selectedSale
              ? {
                  customerName: selectedSale.customerName,
                  address: selectedSale.address,
                  product: selectedSale.product,
                  quantity: selectedSale.quantity,
                  totalAmount: selectedSale.totalAmount,
                }
              : null
          }
        />
      </ScreenContainer>

      <FindCustomerModal
        visible={finderVisible}
        finderMode={finderMode}
        consumerNumber={consumerNumber}
        findingCustomer={findingCustomer}
        permission={permission}
        scanned={scanned}
        onClose={handleCloseFinder}
        onModeChange={handleSwitchFinderMode}
        onConsumerNumberChange={setConsumerNumber}
        onFind={() => handleFindCustomer()}
        onBarcodeScanned={handleBarcodeScanned}
        requestPermission={requestPermission}
      />

      <BatchSelectionModal
        visible={batchModalVisible}
        loading={batchLoading}
        customer={foundCustomer}
        batches={availableBatches}
        onBack={() => {
          setPendingCreateSaleOpen(false);
          setBatchModalVisible(false);
          setFinderVisible(true);
        }}
        onClose={() => {
          setPendingCreateSaleOpen(false);
          setBatchModalVisible(false);
        }}
        onSelect={handleBatchSelect}
        transactionType={transactionType}
        onTransactionTypeChange={setTransactionType}
        ret={{
          category: returnCategory,
          onCategoryChange: setReturnCategory,
          products: returnProducts,
          productsLoading: returnProductsLoading,
          selectedProduct: selectedReturnProduct,
          onSelectProduct: handleSelectReturnProduct,
          qty: returnQty,
          onQtyMinus: () => setReturnQty((prev) => Math.max(1, prev - 1)),
          onQtyPlus: () => setReturnQty((prev) => prev + 1),
          paymentMethod: returnPaymentMethod,
          onPaymentMethodChange: setReturnPaymentMethod,
          amount: returnAmount,
          onAmountChange: setReturnAmount,
          reason: returnReason,
          onReasonChange: setReturnReason,
          otp: returnOtp,
          onOtpChange: setReturnOtp,
          submitting: returnSubmitting,
          onSubmit: handleSubmitReturn,
        }}
      />

      <ConfirmNewSaleModal
        visible={createSaleVisible}
        customer={foundCustomer}
        batch={selectedBatch}
        paymentMethod={salePaymentMethod}
        amount={saleAmount}
        emptyCylinderQty={emptyCylinderQty}
        saleQty={saleQty}
        otp={otp}
        loading={createSaleLoading}
        onClose={() => setCreateSaleVisible(false)}
        onPaymentMethodChange={setSalePaymentMethod}
        onAmountChange={setSaleAmount}
        onEmptyMinus={() =>
          setEmptyCylinderQty((prev) => Math.max(0, prev - 1))
        }
        onEmptyPlus={() => setEmptyCylinderQty((prev) => prev + 1)}
        onSaleQtyMinus={() => setSaleQty((prev) => Math.max(1, prev - 1))}
        onSaleQtyPlus={() =>
          setSaleQty((prev) =>
            selectedBatch
              ? Math.min(prev + 1, Math.max(1, selectedBatch.pending))
              : prev + 1,
          )
        }
        onOtpChange={setOtp}
        onSubmit={() => handleCreateSaleFromCustomer(false)}
        onSkip={() => handleCreateSaleFromCustomer(true)}
      />
    </View>
  );
}

function FindCustomerModal({
  visible,
  finderMode,
  consumerNumber,
  findingCustomer,
  permission,
  scanned,
  onClose,
  onModeChange,
  onConsumerNumberChange,
  onFind,
  onBarcodeScanned,
  requestPermission,
}: {
  visible: boolean;
  finderMode: FinderMode;
  consumerNumber: string;
  findingCustomer: boolean;
  permission: any;
  scanned: boolean;
  onClose: () => void;
  onModeChange: (mode: FinderMode) => void;
  onConsumerNumberChange: (value: string) => void;
  onFind: () => void;
  onBarcodeScanned: ({ data }: { data: string }) => void;
  requestPermission: () => void;
}) {
  // Track the keyboard height so the bottom sheet can lift above it. This is
  // more reliable than KeyboardAvoidingView inside a Modal on Android (where the
  // Modal is a separate window and 'height' behavior does not shift the sheet).
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.finderOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View
              style={[
                styles.keyboardView,
                // Lift the sheet manually by the keyboard height so it doesn't get covered
                { marginBottom: keyboardHeight },
              ]}
            >
              <View
                style={[
                  styles.finderSheet,
                  // Never fill the whole screen: cap the height so the ScrollView
                  // scrolls internally instead of the sheet stretching to the top.
                  {
                    maxHeight: Math.max(
                      windowHeight * 0.4,
                      windowHeight - keyboardHeight - 40,
                    ),
                  },
                ]}
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.finderScrollContent}
                >
                  <View style={styles.finderHandle} />

                  <View style={styles.finderHeader}>
                    <Text style={styles.finderTitle}>Find Customer</Text>

                    <TouchableOpacity onPress={onClose}>
                      <Ionicons
                        name="close-outline"
                        size={34}
                        color={DS.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.finderTabs}>
                    <TouchableOpacity
                      style={[
                        styles.finderTab,
                        finderMode === "QR" && styles.finderTabActive,
                      ]}
                      onPress={() => onModeChange("QR")}
                    >
                      <Ionicons
                        name="qr-code-outline"
                        size={22}
                        color={finderMode === "QR" ? DS.white : DS.textPrimary}
                      />
                      <Text
                        style={[
                          styles.finderTabText,
                          finderMode === "QR" && styles.finderTabTextActive,
                        ]}
                      >
                        Scan QR
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.finderTab,
                        finderMode === "NUMBER" && styles.finderTabActive,
                      ]}
                      onPress={() => onModeChange("NUMBER")}
                    >
                      <Ionicons
                        name="search-outline"
                        size={24}
                        color={
                          finderMode === "NUMBER" ? DS.white : DS.textPrimary
                        }
                      />
                      <Text
                        style={[
                          styles.finderTabText,
                          finderMode === "NUMBER" && styles.finderTabTextActive,
                        ]}
                      >
                        Enter Number
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {finderMode === "NUMBER" ? (
                    <View>
                      <Text style={styles.inputLabel}>
                        Consumer Number / Phone
                      </Text>

                      <TextInput
                        style={styles.consumerInput}
                        placeholder="e.g. 9876543210"
                        placeholderTextColor={DS.textSecondary}
                        keyboardType="phone-pad"
                        value={consumerNumber}
                        onChangeText={onConsumerNumberChange}
                      />

                      <TouchableOpacity
                        style={[
                          styles.findCustomerButton,
                          (!consumerNumber.trim() || findingCustomer) &&
                            styles.findCustomerButtonDisabled,
                        ]}
                        disabled={!consumerNumber.trim() || findingCustomer}
                        onPress={onFind}
                      >
                        {findingCustomer ? (
                          <ActivityIndicator color={DS.white} />
                        ) : (
                          <>
                            <Ionicons
                              name="search-outline"
                              size={24}
                              color={DS.white}
                            />
                            <Text style={styles.findCustomerButtonText}>
                              Find Customer
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.cameraBlock}>
                      {!permission ? (
                        <View style={styles.permissionBox}>
                          <ActivityIndicator color={DS.primary} />
                          <Text style={styles.permissionText}>
                            Checking camera permission...
                          </Text>
                        </View>
                      ) : !permission.granted ? (
                        <View style={styles.permissionBox}>
                          <Text style={styles.permissionTitle}>
                            Camera permission needed
                          </Text>
                          <Text style={styles.permissionText}>
                            Please allow camera access to scan customer QR code.
                          </Text>
                          <TouchableOpacity
                            style={styles.permissionButton}
                            onPress={requestPermission}
                          >
                            <Text style={styles.permissionButtonText}>
                              Allow Camera
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <View style={styles.cameraPreview}>
                            <CameraView
                              style={StyleSheet.absoluteFillObject}
                              facing="back"
                              barcodeScannerSettings={{
                                barcodeTypes: ["qr"],
                              }}
                              onBarcodeScanned={
                                scanned ? undefined : onBarcodeScanned
                              }
                            />

                            <View style={styles.scanFrame}>
                              <View
                                style={[styles.corner, styles.cornerTopLeft]}
                              />
                              <View
                                style={[styles.corner, styles.cornerTopRight]}
                              />
                              <View
                                style={[styles.corner, styles.cornerBottomLeft]}
                              />
                              <View
                                style={[
                                  styles.corner,
                                  styles.cornerBottomRight,
                                ]}
                              />
                            </View>
                          </View>

                          <Text style={styles.scanHelp}>
                            Point camera at the customer&apos;s QR code.
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

type ReturnProps = {
  category: ReturnCategory;
  onCategoryChange: (category: ReturnCategory) => void;
  products: ReturnProduct[];
  productsLoading: boolean;
  selectedProduct: ReturnProduct | null;
  onSelectProduct: (product: ReturnProduct) => void;
  qty: number;
  onQtyMinus: () => void;
  onQtyPlus: () => void;
  paymentMethod: ReturnPaymentMethod;
  onPaymentMethodChange: (method: ReturnPaymentMethod) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  reason: ReturnReason;
  onReasonChange: (reason: ReturnReason) => void;
  otp: string;
  onOtpChange: (value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
};

function BatchSelectionModal({
  visible,
  loading,
  customer,
  batches,
  onBack,
  onClose,
  onSelect,
  transactionType,
  onTransactionTypeChange,
  ret,
}: {
  visible: boolean;
  loading: boolean;
  customer: FoundCustomer | null;
  batches: BatchItem[];
  onBack: () => void;
  onClose: () => void;
  onSelect: (batch: BatchItem) => void;
  transactionType: TransactionType;
  onTransactionTypeChange: (type: TransactionType) => void;
  ret: ReturnProps;
}) {
  // Only cylinders that are actually in stock (undelivered/in-hand) can be sold.
  const inStockBatches = batches.filter((batch) => batch.pending > 0);
  const isReturn = transactionType === "RETURN";

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates?.height ?? 0),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.finderOverlay}>
        <View
          style={[
            styles.batchSheet,
            {
              marginBottom: keyboardHeight,
              maxHeight: Math.max(
                windowHeight * 0.4,
                windowHeight - keyboardHeight - 40,
              ),
            },
          ]}
        >
          <View style={styles.finderHandle} />

          <View style={styles.batchHeader}>
            <TouchableOpacity onPress={onBack}>
              <Ionicons name="arrow-back" size={28} color={DS.textSecondary} />
            </TouchableOpacity>

            <Text style={styles.batchTitle}>
              {isReturn ? "Collect Return" : "Select Cylinder Batch"}
            </Text>

            <TouchableOpacity onPress={onClose}>
              <Ionicons
                name="close-outline"
                size={34}
                color={DS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.batchCustomerBox}>
            <Text style={styles.batchCustomerName}>{customer?.name || ""}</Text>
            <Text style={styles.batchCustomerMeta}>
              {customer?.phone || ""}
              {/* · {customer?.productType || "Domestic"} ·
              Qty {customer?.quantity || 1} */}
            </Text>
          </View>

          {/* Sale / Return toggle */}
          <View style={styles.txnToggleWrap}>
            <TouchableOpacity
              style={[
                styles.txnToggleTab,
                !isReturn && styles.txnToggleTabActive,
              ]}
              onPress={() => onTransactionTypeChange("SALE")}
            >
              <Ionicons
                name="cart-outline"
                size={18}
                color={!isReturn ? DS.white : DS.textSecondary}
              />
              <Text
                style={[
                  styles.txnToggleText,
                  !isReturn && styles.txnToggleTextActive,
                ]}
              >
                Sale
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.txnToggleTab,
                isReturn && styles.txnToggleTabActive,
              ]}
              onPress={() => onTransactionTypeChange("RETURN")}
            >
              <Ionicons
                name="arrow-undo-outline"
                size={18}
                color={isReturn ? DS.white : DS.textSecondary}
              />
              <Text
                style={[
                  styles.txnToggleText,
                  isReturn && styles.txnToggleTextActive,
                ]}
              >
                Return
              </Text>
            </TouchableOpacity>
          </View>

          {isReturn ? (
            <ReturnForm ret={ret} />
          ) : (
            <>
              <Text style={styles.batchSubtitle}>
                Choose a batch to allocate for this delivery.
              </Text>

              {loading ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator color={DS.primary} />
                  <Text style={styles.infoText}>Loading batches...</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {inStockBatches.map((batch) => (
                    <TouchableOpacity
                      key={`${batch.batchNo}-${batch.allocationSalesItemId}`}
                      activeOpacity={0.85}
                      style={styles.batchCard}
                      onPress={() => onSelect(batch)}
                    >
                      <View style={styles.batchIconBox}>
                        <Ionicons
                          name="cube-outline"
                          size={34}
                          color={DS.primary}
                        />
                      </View>

                      <View style={styles.batchInfoBox}>
                        <View style={styles.batchProductRow}>
                          <Text
                            style={styles.batchProductName}
                            numberOfLines={1}
                          >
                            {batch.productName}
                          </Text>

                          <View style={styles.batchTypePill}>
                            <Text style={styles.batchTypeText}>
                              {formatBatchType(batch.productType)}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.batchMetaText}>
                          {formatSize(batch)} · Batch {batch.batchNo}
                        </Text>

                        <Text style={styles.batchInStockText}>
                          In stock: {batch.pending} of {batch.totalAllocated}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={30}
                        color={DS.textSecondary}
                      />
                    </TouchableOpacity>
                  ))}

                  {!inStockBatches.length && (
                    <View style={styles.emptyBox}>
                      <Text style={styles.infoText}>
                        No cylinders in stock. All allocated cylinders are sold.
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ReturnForm({ ret }: { ret: ReturnProps }) {
  const isCommercial = ret.category === "COMMERCIAL";

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.returnScrollContent}
    >
      {/* Category */}
      <Text style={styles.returnLabel}>Category</Text>
      <View style={styles.returnCategoryRow}>
        {(["COMMERCIAL", "DOMESTIC"] as const).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.returnCategoryButton,
              ret.category === cat && styles.returnCategoryButtonActive,
            ]}
            onPress={() => ret.onCategoryChange(cat)}
          >
            <Text
              style={[
                styles.returnCategoryText,
                ret.category === cat && styles.returnCategoryTextActive,
              ]}
            >
              {cat === "COMMERCIAL" ? "Commercial" : "Domestic"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cylinder type (product) */}
      <Text style={styles.returnLabel}>Cylinder Type</Text>
      {ret.productsLoading ? (
        <View style={styles.returnInlineLoader}>
          <ActivityIndicator color={DS.primary} />
        </View>
      ) : ret.products.length ? (
        ret.products.map((product) => {
          const selected = ret.selectedProduct?.id === product.id;
          return (
            <TouchableOpacity
              key={product.id}
              activeOpacity={0.85}
              style={[
                styles.returnProductCard,
                selected && styles.returnProductCardActive,
              ]}
              onPress={() => ret.onSelectProduct(product)}
            >
              <Ionicons
                name={selected ? "radio-button-on" : "radio-button-off"}
                size={22}
                color={selected ? DS.primary : DS.textSecondary}
              />
              <View style={styles.returnProductInfo}>
                <Text style={styles.returnProductName} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={styles.returnProductMeta}>
                  {product.categoryName || formatBatchType(product.type)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.infoText}>
            No {isCommercial ? "commercial" : "domestic"} products found.
          </Text>
        </View>
      )}

      {/* Quantity */}
      <Text style={styles.returnLabel}>Cylinders Returned</Text>
      <View style={styles.emptyCounterRow}>
        <TouchableOpacity
          style={styles.emptyCounterButton}
          onPress={ret.onQtyMinus}
        >
          <Text style={styles.emptyCounterText}>-</Text>
        </TouchableOpacity>
        <View style={styles.emptyCounterValueBox}>
          <Text style={styles.emptyCounterValue}>{ret.qty}</Text>
        </View>
        <TouchableOpacity
          style={styles.emptyCounterButton}
          onPress={ret.onQtyPlus}
        >
          <Text style={styles.emptyCounterText}>+</Text>
        </TouchableOpacity>
      </View>

      {isCommercial ? (
        <>
          <Text style={styles.returnLabel}>Payment Method</Text>
          <View style={styles.paymentRow}>
            {(["CASH", "UPI", "CARD"] as const).map((method) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentButton,
                  ret.paymentMethod === method && styles.paymentButtonActive,
                ]}
                onPress={() => ret.onPaymentMethodChange(method)}
              >
                <Text
                  style={[
                    styles.paymentButtonText,
                    ret.paymentMethod === method &&
                      styles.paymentButtonTextActive,
                  ]}
                >
                  {method === "CASH"
                    ? "Cash"
                    : method === "UPI"
                      ? "UPI"
                      : "Card"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.returnLabel}>Amount (₹)</Text>
          <TextInput
            style={styles.amountInput}
            keyboardType="numeric"
            value={ret.amount}
            onChangeText={ret.onAmountChange}
            placeholder="0"
            placeholderTextColor={DS.textSecondary}
          />
        </>
      ) : (
        <>
          <Text style={styles.returnLabel}>Return Reason</Text>
          <View style={styles.returnReasonWrap}>
            {RETURN_REASONS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.returnReasonButton,
                  ret.reason === item.key && styles.returnReasonButtonActive,
                ]}
                onPress={() => ret.onReasonChange(item.key)}
              >
                <Text
                  style={[
                    styles.returnReasonText,
                    ret.reason === item.key && styles.returnReasonTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.returnLabel}>Customer OTP (6-digit)</Text>
      <TextInput
        style={styles.otpInput}
        keyboardType="number-pad"
        maxLength={6}
        value={ret.otp}
        onChangeText={ret.onOtpChange}
      />

      <TouchableOpacity
        style={[
          styles.verifyButton,
          (!ret.selectedProduct ||
            ret.qty <= 0 ||
            ret.otp.length !== 6 ||
            ret.submitting) &&
            styles.verifyButtonDisabled,
        ]}
        disabled={
          !ret.selectedProduct ||
          ret.qty <= 0 ||
          ret.otp.length !== 6 ||
          ret.submitting
        }
        onPress={ret.onSubmit}
      >
        {ret.submitting ? (
          <ActivityIndicator color={DS.white} />
        ) : (
          <>
            <Ionicons
              name="checkmark-circle-outline"
              size={26}
              color={DS.white}
            />
            <Text style={styles.verifyButtonText}>Submit Return</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function ConfirmNewSaleModal({
  visible,
  customer,
  batch,
  paymentMethod,
  amount,
  emptyCylinderQty,
  saleQty,
  otp,
  loading,
  onClose,
  onPaymentMethodChange,
  onAmountChange,
  onEmptyMinus,
  onEmptyPlus,
  onSaleQtyMinus,
  onSaleQtyPlus,
  onOtpChange,
  onSubmit,
  onSkip,
}: {
  visible: boolean;
  customer: FoundCustomer | null;
  batch: BatchItem | null;
  paymentMethod: "CASH" | "UPI" | "ONLINE" | "CREDIT";
  amount: string;
  emptyCylinderQty: number;
  saleQty: number;
  otp: string;
  loading: boolean;
  onClose: () => void;
  onPaymentMethodChange: (value: "CASH" | "UPI" | "ONLINE" | "CREDIT") => void;
  onAmountChange: (value: string) => void;
  onEmptyMinus: () => void;
  onEmptyPlus: () => void;
  onSaleQtyMinus: () => void;
  onSaleQtyPlus: () => void;
  onOtpChange: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const orderedQty = batch?.productType === "COMMERCIAL" ? saleQty : 1;
  const isDomesticBatch = batch?.productType !== "COMMERCIAL";
  // Equality with the sold quantity is enforced only for DOMESTIC deliveries.
  const emptyMismatch = isDomesticBatch && emptyCylinderQty !== orderedQty;

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates?.height ?? 0),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.finderOverlay}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View
            style={[
              styles.confirmSaleSheet,
              {
                marginBottom: keyboardHeight,
                maxHeight: Math.max(
                  windowHeight * 0.4,
                  windowHeight - keyboardHeight - 40,
                ),
              },
            ]}
          >
            <ScrollView
              style={styles.confirmSaleScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.confirmSaleScrollContent}
            >
              <View style={styles.finderHandle} />

              <View style={styles.finderHeader}>
                <Text style={styles.finderTitle}>Confirm Delivery</Text>

                <TouchableOpacity onPress={onClose}>
                  <Ionicons
                    name="close-outline"
                    size={34}
                    color={DS.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.customerPreviewBox}>
                <Text style={styles.customerPreviewName}>
                  {customer?.name || ""}
                </Text>

                <View style={styles.customerAddressRow}>
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={DS.textSecondary}
                  />
                  <Text style={styles.customerPreviewAddress}>
                    {customer?.address || ""}
                  </Text>
                </View>

                <Text style={styles.customerPreviewMeta}>
                  {formatBatchType(batch?.productType)} · Qty: {orderedQty} ·{" "}
                  {customer?.phone || ""}
                </Text>
              </View>

              <Text style={styles.inputLabel}>Payment Method</Text>

              <View style={styles.paymentRow}>
                {(["CASH", "UPI", "ONLINE", "CREDIT"] as const).map(
                  (method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentButton,
                        paymentMethod === method && styles.paymentButtonActive,
                      ]}
                      onPress={() => onPaymentMethodChange(method)}
                    >
                      <Text
                        style={[
                          styles.paymentButtonText,
                          paymentMethod === method &&
                            styles.paymentButtonTextActive,
                        ]}
                      >
                        {method === "CASH"
                          ? "Cash"
                          : method === "UPI"
                            ? "UPI"
                            : method === "ONLINE"
                              ? "Online"
                              : "Credit"}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>

              <Text style={styles.inputLabel}>Amount (₹)</Text>

              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={amount}
                editable={false}
                onChangeText={onAmountChange}
              />

              {batch?.productType === "COMMERCIAL" && (
                <>
                  <Text style={styles.inputLabel}>Quantity (Commercial)</Text>
                  <View style={styles.emptyCounterRow}>
                    <TouchableOpacity
                      style={styles.emptyCounterButton}
                      onPress={onSaleQtyMinus}
                    >
                      <Text style={styles.emptyCounterText}>-</Text>
                    </TouchableOpacity>
                    <View style={styles.emptyCounterValueBox}>
                      <Text style={styles.emptyCounterValue}>{saleQty}</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.emptyCounterButton,
                        saleQty >= Math.max(1, batch.pending) &&
                          styles.emptyCounterButtonDisabled,
                      ]}
                      onPress={onSaleQtyPlus}
                      disabled={saleQty >= Math.max(1, batch.pending)}
                    >
                      <Text style={styles.emptyCounterText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.stockAvailableText}>
                    Available in stock: {batch.pending}
                  </Text>
                </>
              )}

              <Text style={styles.inputLabel}>Empty Cylinders Collected</Text>

              <View style={styles.emptyCounterRow}>
                <TouchableOpacity
                  style={styles.emptyCounterButton}
                  onPress={onEmptyMinus}
                >
                  <Text style={styles.emptyCounterText}>-</Text>
                </TouchableOpacity>

                <View
                  style={[
                    styles.emptyCounterValueBox,
                    emptyMismatch && styles.emptyCounterValueBoxError,
                  ]}
                >
                  <Text
                    style={[
                      styles.emptyCounterValue,
                      emptyMismatch && styles.emptyCounterValueError,
                    ]}
                  >
                    {emptyCylinderQty}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.emptyCounterButton}
                  onPress={onEmptyPlus}
                >
                  <Text style={styles.emptyCounterText}>+</Text>
                </TouchableOpacity>
              </View>

              {emptyMismatch && (
                <Text style={styles.emptyMismatchText}>
                  Must equal quantity sold ({orderedQty})
                </Text>
              )}

              {!isDomesticBatch && (
                <Text style={styles.otpHelp}>
                  Empty cylinders can differ from the quantity sold (
                  {orderedQty}).
                </Text>
              )}

              <Text style={styles.inputLabel}>Customer OTP (6-digit)</Text>
              <Text style={styles.otpHelp}>
                Ask the customer for the OTP sent to {customer?.phone || ""}.
              </Text>

              <TextInput
                style={styles.otpInput}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={onOtpChange}
              />

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.skipAndSaveButton,
                    loading && styles.verifyButtonDisabled,
                  ]}
                  disabled={loading}
                  onPress={onSkip}
                >
                  <Text style={styles.skipAndSaveText}>Skip & Save</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.verifyButtonHalf,
                    (otp.length !== 6 || !batch || loading || emptyMismatch) &&
                      styles.verifyButtonDisabled,
                  ]}
                  disabled={
                    otp.length !== 6 || !batch || loading || emptyMismatch
                  }
                  onPress={onSubmit}
                >
                  {loading ? (
                    <ActivityIndicator color={DS.white} />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color={DS.white}
                      />
                      <Text style={styles.verifyButtonText}>Verify</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  finderScrollContent: {
    paddingBottom: 12,
  },
  keyboardView: {
    width: "100%",
    justifyContent: "flex-end",
  },
  screenRoot: {
    flex: 1,
    backgroundColor: DS.background,
  },
  content: {
    padding: 16,
  },
  allocatedCard: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    padding: 16,
    marginBottom: 16,
  },
  allocatedTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  allocatedIconWrap: {
    width: 48,
    height: 48,
    justifyContent: "center",
    marginRight: 12,
  },
  allocatedTitleWrap: {
    flex: 1,
  },
  allocatedTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },
  allocatedValueWrap: {
    alignItems: "center",
  },
  allocatedValue: {
    ...TYPO.h2,
    color: DS.textPrimary,
  },
  allocatedValueUnderline: {
    width: "100%",
    height: 3,
    backgroundColor: DS.primary,
    marginTop: 2,
    borderRadius: 2,
  },
  allocatedBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: DS.divider,
  },
  allocatedMeta: {
    ...TYPO.b4,
    color: DS.textSecondary,
    flex: 1,
  },
  viewDetailsBtn: {
    borderWidth: 1.5,
    borderColor: DS.primary,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  viewDetailsText: {
    ...TYPO.b4,
    fontWeight: "bold",
    color: DS.primary,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  detailsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  detailIconTransparent: {
    width: 28,
    height: 28,
    alignItems: "flex-start",
    justifyContent: "center",
    marginRight: 8,
  },
  detailLabel: {
    ...TYPO.b2,
    color: DS.textPrimary,
    flex: 1,
  },
  detailValue: {
    ...TYPO.s1,
  },
  inHandCard: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 0,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  inHandTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  inHandTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },
  inHandValue: {
    ...TYPO.h4,
    fontWeight: "bold",
    color: DS.textPrimary,
  },
  scanButton: {
    minHeight: 56,
    borderRadius: RADIUS.sm,
    backgroundColor: "#1E65FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  scanButtonText: {
    ...TYPO.s1,
    color: DS.white,
  },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: DS.grey100,
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: 12,
  },
  segmentTab: {
    flex: 1,
    height: 34,
    borderRadius: RADIUS.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentTabActive: {
    backgroundColor: DS.card,
  },
  segmentText: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },
  segmentTextActive: {
    color: DS.textPrimary,
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
    color: DS.white,
  },
  emptyBox: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    padding: 18,
    alignItems: "center",
    marginTop: 10,
  },
  finderOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  finderSheet: {
    backgroundColor: DS.card,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
  },
  finderHandle: {
    width: 42,
    height: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: DS.borderStrong,
    alignSelf: "center",
    marginBottom: 18,
  },
  finderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  finderTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },
  finderTabs: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
  },
  finderTab: {
    flex: 1,
    minHeight: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  finderTabActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primary,
  },
  finderTabText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  finderTabTextActive: {
    color: DS.white,
  },
  inputLabel: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginBottom: 10,
    marginTop: 14,
  },
  consumerInput: {
    ...TYPO.s1,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    padding: 18,
    color: DS.textPrimary,
    backgroundColor: DS.card,
    marginBottom: 18,
  },
  findCustomerButton: {
    minHeight: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  findCustomerButtonDisabled: {
    backgroundColor: PALETTE.primary200,
  },
  findCustomerButtonText: {
    ...TYPO.s1,
    color: DS.white,
  },
  cameraBlock: {
    marginTop: -4,
  },
  cameraPreview: {
    height: 330,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    backgroundColor: DS.grey900,
  },
  scanFrame: {
    position: "absolute",
    left: "18%",
    right: "18%",
    top: 28,
    bottom: 86,
  },
  corner: {
    position: "absolute",
    width: 74,
    height: 74,
    borderColor: DS.white,
  },
  cornerTopLeft: {
    left: 0,
    top: 0,
    borderLeftWidth: 6,
    borderTopWidth: 6,
  },
  cornerTopRight: {
    right: 0,
    top: 0,
    borderRightWidth: 6,
    borderTopWidth: 6,
  },
  cornerBottomLeft: {
    left: 0,
    bottom: 0,
    borderLeftWidth: 6,
    borderBottomWidth: 6,
  },
  cornerBottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 6,
    borderBottomWidth: 6,
  },
  scanHelp: {
    ...TYPO.b3,
    textAlign: "center",
    color: DS.textSecondary,
    marginTop: 18,
  },
  permissionBox: {
    height: 360,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  permissionTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginBottom: 8,
  },
  permissionText: {
    ...TYPO.b3,
    color: DS.textSecondary,
    textAlign: "center",
  },
  permissionButton: {
    marginTop: 18,
    backgroundColor: DS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  permissionButtonText: {
    ...TYPO.b4,
    color: DS.white,
  },

  batchSheet: {
    backgroundColor: DS.card,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: "88%",
  },
  batchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  batchTitle: {
    ...TYPO.h5,
    flex: 1,
    marginLeft: 18,
    color: DS.textPrimary,
  },
  batchCustomerBox: {
    backgroundColor: DS.surface,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 18,
  },
  batchCustomerName: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginBottom: 6,
  },
  batchCustomerMeta: {
    ...TYPO.b3,
    color: DS.textSecondary,
  },
  batchSubtitle: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginBottom: 18,
  },
  batchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 14,
  },
  batchIconBox: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  batchInfoBox: {
    flex: 1,
  },
  batchProductRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  batchProductName: {
    ...TYPO.s1,
    color: DS.textPrimary,
    flexShrink: 1,
  },
  batchTypePill: {
    backgroundColor: DS.grey100,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  batchTypeText: {
    ...TYPO.c2,
    color: DS.textSecondary,
  },
  batchMetaText: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 6,
  },
  batchPendingText: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 4,
  },
  batchInStockText: {
    ...TYPO.b3,
    color: PALETTE.green600,
    marginTop: 4,
  },
  skipBatchButton: {
    minHeight: 56,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  skipBatchText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  confirmSaleSheet: {
    backgroundColor: DS.card,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
    maxHeight: "88%",
  },
  confirmSaleScroll: {
    flexShrink: 1,
  },
  confirmSaleScrollContent: {
    paddingBottom: 100,
  },
  customerPreviewBox: {
    backgroundColor: DS.surface,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 18,
  },
  customerPreviewName: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginBottom: 10,
  },
  customerAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  customerPreviewAddress: {
    ...TYPO.b3,
    color: DS.textSecondary,
    flex: 1,
  },
  customerPreviewMeta: {
    ...TYPO.b3,
    color: DS.textSecondary,
  },
  paymentRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  paymentButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DS.card,
    padding: 15,
  },
  paymentButtonActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primary,
  },
  paymentButtonText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  paymentButtonTextActive: {
    color: DS.white,
  },
  amountInput: {
    ...TYPO.s1,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 20,
    color: DS.textPrimary,
    marginBottom: 24,
    padding: 16,
  },
  emptyCounterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  emptyCounterButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCounterButtonDisabled: {
    opacity: 0.4,
  },
  stockAvailableText: {
    ...TYPO.b4,
    color: PALETTE.green600,
    marginTop: -10,
    marginBottom: 16,
  },
  emptyCounterText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  emptyCounterValueBox: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCounterValue: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  otpHelp: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: -6,
    marginBottom: 12,
  },
  otpInput: {
    ...TYPO.h5,
    alignSelf: "center",
    width: 220,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    textAlign: "center",
    letterSpacing: 18,
    color: DS.textPrimary,
    marginBottom: 26,
  },
  verifyButton: {
    minHeight: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.buttonGreen,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 12,
  },
  verifyButtonDisabled: {
    backgroundColor: PALETTE.green100,
  },
  verifyButtonText: {
    ...TYPO.s1,
    color: DS.white,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  skipAndSaveButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DS.card,
  },
  skipAndSaveText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  verifyButtonHalf: {
    flex: 1,
    minHeight: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.buttonGreen,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
  },
  emptyCounterValueBoxError: {
    borderColor: DS.red,
    backgroundColor: DS.redSoft,
  },
  emptyCounterValueError: {
    color: DS.red,
  },
  emptyMismatchText: {
    ...TYPO.b4,
    color: DS.red,
    marginTop: -18,
    marginBottom: 20,
  },

  // Sale / Return toggle + return form
  txnToggleWrap: {
    flexDirection: "row",
    backgroundColor: DS.grey100,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: 18,
  },
  txnToggleTab: {
    flex: 1,
    height: 42,
    borderRadius: RADIUS.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  txnToggleTabActive: {
    backgroundColor: DS.primary,
  },
  txnToggleText: {
    ...TYPO.s2,
    color: DS.textSecondary,
  },
  txnToggleTextActive: {
    color: DS.white,
  },
  returnScrollContent: {
    paddingBottom: 24,
  },
  returnLabel: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginBottom: 10,
    marginTop: 14,
  },
  returnCategoryRow: {
    flexDirection: "row",
    gap: 10,
  },
  returnCategoryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DS.card,
    paddingVertical: 14,
  },
  returnCategoryButtonActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primary,
  },
  returnCategoryText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  returnCategoryTextActive: {
    color: DS.white,
  },
  returnInlineLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
  returnProductCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
  },
  returnProductCardActive: {
    borderColor: DS.primary,
    backgroundColor: DS.primarySoft,
  },
  returnProductInfo: {
    flex: 1,
  },
  returnProductName: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  returnProductMeta: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 2,
  },
  returnReasonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  returnReasonButton: {
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: DS.card,
  },
  returnReasonButtonActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primary,
  },
  returnReasonText: {
    ...TYPO.b3,
    color: DS.textPrimary,
  },
  returnReasonTextActive: {
    color: DS.white,
  },
});
