// src/screens/AddDeliveryScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AppHeader from "../components/common/AppHeader";
import ScreenContainer from "../components/common/ScreenContainer";
import { AUTH_USER_KEY } from "../constants/auth";
import { DS, EYEBROW, PALETTE, RADIUS, TYPO } from "../constants/designSystem";
import api from "../services/api";

type Customer = {
  id: number;
  name: string;
  phone: string;
  addressId: number | null;
  address: string;
};

type ProductItem = {
  id: number;
  name: string;
  type: "DOMESTIC" | "COMMERCIAL";
  price: number;
  categoryName?: string;
};

type BookingItem = ProductItem & {
  qty: number;
};

export default function AddDeliveryScreen() {
  const [driverId, setDriverId] = useState<number | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [phone, setPhone] = useState("");
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [customerExists, setCustomerExists] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [geoLocationTag, setGeoLocationTag] = useState("");
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 20.5937, // Default center on India
    longitude: 78.9629,
    latitudeDelta: 10.0,
    longitudeDelta: 10.0,
  });
  const [markerCoordinate, setMarkerCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [products, setProducts] = useState<BookingItem[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);

  useEffect(() => {
    const loadDriverId = async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const id = Number(parsed?.id);
        setDriverId(Number.isNaN(id) ? null : id);
      } catch {
        setDriverId(null);
      }
    };

    loadDriverId();
  }, []);

  const findCustomer = useCallback(async () => {
    const cleanPhone = phone.trim();

    if (!cleanPhone || cleanPhone.length < 10) {
      Alert.alert("Required", "Please enter valid phone number");
      return;
    }

    try {
      setCheckingCustomer(true);

      const response = await api.get(
        `/drivers/bookings/customer?phone=${encodeURIComponent(cleanPhone)}`,
      );

      if (response.data?.success) {
        const exists = Boolean(response.data.data?.exists);

        setCustomerExists(exists);

        if (exists) {
          const customer = response.data.data.customer;

          setSelectedCustomer({
            id: Number(customer.id),
            name: customer.name,
            phone: customer.phone,
            addressId: customer.addressId,
            address: customer.address || "",
          });
        } else {
          setSelectedCustomer(null);
          setName("");
          setAddress("");
          setGeoLocationTag("");
        }
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to find customer",
      );
    } finally {
      setCheckingCustomer(false);
    }
  }, [phone]);

  useEffect(() => {
    if (phone.trim().length === 10) {
      findCustomer();
    } else {
      setCustomerExists(false);
      setSelectedCustomer(null);
    }
  }, [phone, findCustomer]);

  const continueFromStepOne = async () => {
    if (!phone.trim() || phone.trim().length < 10) {
      Alert.alert("Required", "Please enter valid phone number");
      return;
    }

    if (customerExists && selectedCustomer) {
      await fetchCommercialProducts();
      setStep(3);
      return;
    }

    setStep(2);
  };

  const createCustomerAndContinue = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Customer name is required");
      return;
    }

    if (!address.trim()) {
      Alert.alert("Required", "Address is required");
      return;
    }

    try {
      setCreatingCustomer(true);

      const response = await api.post("/drivers/bookings/customer", {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        geo_location_tag: geoLocationTag.trim(),
      });

      if (response.data?.success) {
        const customer = response.data.data.customer;

        setSelectedCustomer({
          id: Number(customer.id),
          name: customer.name,
          phone: customer.phone,
          addressId: customer.addressId,
          address: customer.address,
        });

        await fetchCommercialProducts();
        setStep(3);
      } else {
        Alert.alert("Error", response.data?.message || "Failed to create user");
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to create customer",
      );
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleTagLocation = async () => {
    try {
      setIsFetchingLocation(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Permission to access location was denied",
        );
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyBmrEg7SfI6pHlfcoAhOBG5GbHXxFz9pqk`,
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        setGeoLocationTag(data.results[0].formatted_address);
        setAddress(data.results[0].formatted_address);
      } else {
        const coords = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setGeoLocationTag(coords);
        setAddress(coords);
      }

      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      setMarkerCoordinate({ latitude, longitude });
      setShowMap(true);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch location");
      setGeoLocationTag("Location Error");
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleMapPress = async (event: any) => {
    const { coordinate } = event.nativeEvent;
    if (!coordinate) return;

    setMarkerCoordinate(coordinate);
    try {
      setIsFetchingLocation(true);
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinate.latitude},${coordinate.longitude}&key=AIzaSyBmrEg7SfI6pHlfcoAhOBG5GbHXxFz9pqk`,
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        setGeoLocationTag(data.results[0].formatted_address);
        setAddress(data.results[0].formatted_address);
      } else {
        const coords = `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
        setGeoLocationTag(coords);
        setAddress(coords);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to fetch address for selected location");
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const fetchCommercialProducts = async () => {
    try {
      setProductLoading(true);

      const response = await api.get(
        `/drivers/products/search?type=COMMERCIAL&search=`,
      );

      if (response.data?.success) {
        const mapped = (response.data.data || []).map((item: ProductItem) => ({
          ...item,
          qty: 0,
        }));

        setProducts(mapped);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to fetch commercial products",
      );
      setProducts([]);
    } finally {
      setProductLoading(false);
    }
  };

  const updateQty = (productId: number, type: "PLUS" | "MINUS") => {
    setProducts((prev) =>
      prev.map((item) => {
        if (item.id !== productId) return item;

        return {
          ...item,
          qty:
            type === "PLUS"
              ? item.qty + 1
              : Math.max(Number(item.qty || 0) - 1, 0),
        };
      }),
    );
  };

  const selectedItems = products.filter((item) => item.qty > 0);

  const totalQty = selectedItems.reduce((sum, item) => sum + item.qty, 0);

  const totalAmount = selectedItems.reduce(
    (sum, item) => sum + item.qty * Number(item.price || 0),
    0,
  );

  const canConfirmBooking = selectedCustomer && selectedItems.length > 0;

  const confirmBooking = async () => {
    if (!driverId) {
      Alert.alert("Error", "Unable to identify driver session");
      return;
    }

    if (!selectedCustomer) {
      Alert.alert("Required", "Customer is required");
      return;
    }

    if (!selectedCustomer.addressId) {
      Alert.alert("Required", "Customer address is required");
      return;
    }

    if (!selectedItems.length) {
      Alert.alert("Required", "Please select at least one cylinder");
      return;
    }

    try {
      setCreatingBooking(true);

      const response = await api.post("/drivers/bookings", {
        driver_id: driverId,
        customer_id: selectedCustomer.id,
        address_id: selectedCustomer.addressId,
        items: selectedItems.map((item) => ({
          product_id: item.id,
          quantity: item.qty,
        })),
      });

      if (response.data?.success) {
        Alert.alert("Success", "Booking created successfully");

        setStep(1);
        setPhone("");
        setCustomerExists(false);
        setSelectedCustomer(null);
        setName("");
        setAddress("");
        setGeoLocationTag("");
        setProducts([]);
      } else {
        Alert.alert("Error", response.data?.message || "Booking failed");
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to create booking",
      );
    } finally {
      setCreatingBooking(false);
    }
  };

  const customerBoxText = useMemo(() => {
    if (checkingCustomer) return "Checking customer...";
    if (customerExists && selectedCustomer) return selectedCustomer.name;
    if (phone.trim().length >= 10) return "New customer — let's add details";
    return "Enter phone number to search";
  }, [checkingCustomer, customerExists, selectedCustomer, phone]);

  return (
    <ScreenContainer>
      <AppHeader />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <>
            <Text style={styles.title}>New Booking</Text>
            <Text style={styles.stepText}>Step 1 of 3</Text>

            <View style={styles.phoneCard}>
              <View style={styles.labelRow}>
                <Ionicons
                  name="call-outline"
                  size={26}
                  color={DS.textPrimary}
                />
                <Text style={styles.label}>Customer Phone Number</Text>
              </View>

              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="10-digit number"
                placeholderTextColor={DS.textSecondary}
                maxLength={10}
              />

              <View
                style={[
                  styles.customerFoundBox,
                  customerExists
                    ? styles.customerFoundBoxGreen
                    : styles.customerFoundBoxBlue,
                ]}
              >
                <Ionicons
                  name={
                    customerExists ? "person-add-outline" : "person-add-outline"
                  }
                  size={28}
                  color={customerExists ? DS.green : DS.primary}
                />

                <View style={{ flex: 1 }}>
                  <Text style={styles.customerFoundTitle}>
                    {customerBoxText}
                  </Text>

                  {customerExists && selectedCustomer?.address ? (
                    <Text style={styles.customerFoundSub}>
                      {selectedCustomer.address}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={continueFromStepOne}
              disabled={checkingCustomer}
            >
              {checkingCustomer ? (
                <ActivityIndicator color={DS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backSquare}
                onPress={() => setStep(1)}
              >
                <Ionicons name="arrow-back" size={28} color={DS.textPrimary} />
              </TouchableOpacity>

              <View>
                <Text style={styles.title}>New Booking</Text>
                <Text style={styles.stepText}>Step 2 of 3</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Customer Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter name"
              placeholderTextColor={DS.textSecondary}
            />

            <Text style={styles.inputLabel}>Address *</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Delivery address"
              placeholderTextColor={DS.textSecondary}
            />

            <Text style={styles.inputLabel}>Geo-Location Tag</Text>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={handleTagLocation}
              disabled={isFetchingLocation}
            >
              {isFetchingLocation ? (
                <ActivityIndicator color={DS.primary} />
              ) : (
                <Ionicons
                  name="location-outline"
                  size={28}
                  color={DS.textPrimary}
                />
              )}
              <Text style={styles.locationButtonText} numberOfLines={2}>
                {isFetchingLocation
                  ? "Fetching location..."
                  : geoLocationTag || "Tag Current Location"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!name.trim() || !address.trim()) && styles.disabledButton,
              ]}
              disabled={!name.trim() || !address.trim() || creatingCustomer}
              onPress={createCustomerAndContinue}
            >
              {creatingCustomer ? (
                <ActivityIndicator color={DS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backSquare}
                onPress={() => {
                  if (customerExists) {
                    setStep(1);
                  } else {
                    setStep(2);
                  }
                }}
              >
                <Ionicons name="arrow-back" size={28} color={DS.textPrimary} />
              </TouchableOpacity>

              <View>
                <Text style={styles.title}>New Booking</Text>
                <Text style={styles.stepText}>Step 3 of 3</Text>
              </View>
            </View>

            <View style={styles.bookingForCard}>
              <Text style={styles.bookingForLabel}>Booking for</Text>
              <Text style={styles.bookingName}>{selectedCustomer?.name}</Text>
              <Text style={styles.bookingSub}>
                {selectedCustomer?.phone} · {selectedCustomer?.address}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Commercial Cylinders</Text>

            {productLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={DS.primary} />
                <Text style={styles.loadingText}>Loading products...</Text>
              </View>
            ) : (
              products.map((item) => (
                <View key={item.id} style={styles.productCard}>
                  <View>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.productPrice}>
                      ₹{Number(item.price || 0)} / cyl
                    </Text>
                  </View>

                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => updateQty(item.id, "MINUS")}
                    >
                      <Text style={styles.qtyButtonText}>-</Text>
                    </TouchableOpacity>

                    <Text style={styles.qtyText}>{item.qty}</Text>

                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => updateQty(item.id, "PLUS")}
                    >
                      <Text style={styles.qtyButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total ({totalQty} cyl)</Text>
              <Text style={styles.totalAmount}>
                ₹{totalAmount.toLocaleString("en-IN")}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                !canConfirmBooking && styles.disabledGreenButton,
              ]}
              disabled={!canConfirmBooking || creatingBooking}
              onPress={confirmBooking}
            >
              {creatingBooking ? (
                <ActivityIndicator color={DS.white} />
              ) : (
                <Text style={styles.confirmButtonText}>✓ Confirm Booking</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cancelBox}>
            <Text style={styles.cancelTitle}>Cancel this booking?</Text>
            <Text style={styles.cancelText}>
              This action cannot be undone. The booking will be marked as
              cancelled.
            </Text>

            <TouchableOpacity
              style={styles.cancelConfirmButton}
              onPress={() => setCancelModalVisible(false)}
            >
              <Text style={styles.cancelConfirmText}>Yes, Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.keepButton}
              onPress={() => setCancelModalVisible(false)}
            >
              <Text style={styles.keepButtonText}>Keep Booking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
  },

  title: {
    ...TYPO.h4,
    color: DS.textPrimary,
  },

  stepText: {
    ...TYPO.b2,
    color: DS.textSecondary,
    marginTop: 4,
    marginBottom: 28,
  },

  phoneCard: {
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 16,
    backgroundColor: DS.card,
    marginBottom: 28,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  label: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  phoneInput: {
    borderWidth: 2,
    borderColor: DS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    height: 56,
    ...TYPO.h5,
    color: DS.textPrimary,
    marginBottom: 18,
  },

  customerFoundBox: {
    minHeight: 72,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  customerFoundBoxBlue: {
    backgroundColor: DS.primarySoft,
    borderColor: DS.primarySoftBorder,
  },

  customerFoundBoxGreen: {
    backgroundColor: DS.greenSoft,
    borderColor: PALETTE.green100,
  },

  customerFoundTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  customerFoundSub: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 4,
  },

  primaryButton: {
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    ...TYPO.s2,
    color: DS.white,
  },

  disabledButton: {
    backgroundColor: PALETTE.primary200,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginBottom: 28,
  },

  backSquare: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DS.card,
  },

  inputLabel: {
    ...TYPO.s2,
    color: DS.textPrimary,
    marginBottom: 10,
  },

  input: {
    height: 56,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    ...TYPO.b2,
    color: DS.textPrimary,
    backgroundColor: DS.surface,
    marginBottom: 20,
  },

  locationButton: {
    height: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginBottom: 20,
  },

  locationButtonText: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },

  bookingForCard: {
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.card,
    padding: 16,
    marginBottom: 30,
  },

  bookingForLabel: {
    ...EYEBROW,
    color: DS.textTertiary,
  },

  bookingName: {
    ...TYPO.h5,
    color: DS.textPrimary,
    marginTop: 4,
  },

  bookingSub: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 6,
  },

  sectionTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginBottom: 14,
  },

  loadingBox: {
    padding: 30,
    alignItems: "center",
  },

  loadingText: {
    ...TYPO.b4,
    marginTop: 10,
    color: DS.textSecondary,
  },

  productCard: {
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.card,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  productName: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  productPrice: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 6,
  },

  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
  },

  qtyButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DS.card,
  },

  qtyButtonText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },

  qtyText: {
    ...TYPO.s1,
    color: DS.textPrimary,
    minWidth: 30,
    textAlign: "center",
  },

  totalBox: {
    borderWidth: 1,
    borderColor: DS.primarySoftBorder,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primarySoft,
    padding: 20,
    marginTop: 16,
    marginBottom: 28,
  },

  totalLabel: {
    ...TYPO.b2,
    color: DS.textSecondary,
  },

  totalAmount: {
    ...TYPO.h3,
    color: DS.textPrimary,
    marginTop: 8,
  },

  confirmButton: {
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.buttonGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },

  disabledGreenButton: {
    backgroundColor: PALETTE.green100,
  },

  confirmButtonText: {
    ...TYPO.s2,
    color: DS.white,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11,13,18,0.55)",
    justifyContent: "center",
  },

  cancelBox: {
    backgroundColor: DS.card,
    padding: 28,
  },

  cancelTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
    textAlign: "center",
  },

  cancelText: {
    ...TYPO.b1,
    color: DS.textSecondary,
    textAlign: "center",
    marginTop: 22,
    marginBottom: 32,
  },

  cancelConfirmButton: {
    height: 56,
    backgroundColor: DS.red,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  cancelConfirmText: {
    ...TYPO.s2,
    color: DS.white,
  },
  showMapButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: DS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
  },
  showMapButtonText: {
    ...TYPO.c1,
    color: DS.primary,
    fontWeight: "bold",
  },
  mapCard: {
    marginTop: 12,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.card,
  },
  mapHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  mapTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  closeMapText: {
    ...TYPO.c2,
    color: DS.textSecondary,
  },
  map: {
    width: "100%",
    height: 250,
  },
  mapHelpText: {
    ...TYPO.c2,
    color: DS.textSecondary,
    textAlign: "center",
    padding: 10,
  },

  keepButton: {
    height: 56,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  keepButtonText: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
});
