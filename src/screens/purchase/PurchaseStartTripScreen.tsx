import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isAxiosError } from "axios";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AUTH_USER_KEY } from "../../constants/auth";
import {
  DS,
  EYEBROW,
  PALETTE,
  RADIUS,
  TYPO,
  WEIGHT,
} from "../../constants/designSystem";
import {
  getPurchaseBootstrap,
  startPurchaseTrip,
} from "../../services/purchaseService";
import type { PurchaseBootstrap, PurchaseTripOverview } from "../../types";

export default function PurchaseStartTripScreen() {
  const [bootstrap, setBootstrap] = useState<PurchaseBootstrap | null>(null);
  const [storedUserId, setStoredUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [odometerReading, setOdometerReading] = useState("");
  const [odometerImageUri, setOdometerImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadBootstrap = async () => {
      try {
        const rawUser = await AsyncStorage.getItem(AUTH_USER_KEY);
        const parsedUser = rawUser ? JSON.parse(rawUser) : null;
        const localUserId = Number(parsedUser?.id);

        if (localUserId && !Number.isNaN(localUserId)) {
          setStoredUserId(localUserId);
        }

        const data = await getPurchaseBootstrap();
        setBootstrap(data);
      } catch (error) {
        console.log("Purchase bootstrap error:", error);
        Alert.alert(
          "Warning",
          "Could not load purchase bootstrap details. Please check your connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadBootstrap();
  }, []);

  const handleCapture = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.6,
      });

      if (!result.canceled) {
        setOdometerImageUri(result.assets[0]?.uri ?? null);
      }
    } catch (error) {
      console.log("Capture odometer error:", error);
    }
  };

  const handleSubmit = async () => {
    const managerId = Number(bootstrap?.manager?.id || storedUserId || 0);

    if (!managerId) {
      Alert.alert(
        "Unable to start trip",
        "Purchase manager account not found. Please login again.",
      );
      return;
    }

    try {
      setSubmitting(true);

      const trip = await startPurchaseTrip({
        userId: managerId,
        stockAreaId: bootstrap?.defaultStockArea?.id ?? null,
        odometerReading: Number(odometerReading || 0),
        odometerImageUri, // Pass the local URI directly to the service
      });

      DeviceEventEmitter.emit("PURCHASE_FLOW_UPDATED");
      router.replace({
        pathname: "/purchase/create-load",
        params: { tripId: String(trip.id) },
      } as any);
    } catch (error) {
      console.log("Start purchase trip error:", error);

      if (isAxiosError(error) && error.response?.status === 409) {
        const activeTrip = (error.response?.data?.data ||
          null) as PurchaseTripOverview | null;

        if (activeTrip?.id) {
          Alert.alert(
            "Trip already active",
            "An active trip already exists. Continue with that trip now.",
            [
              {
                text: "Continue",
                onPress: () => {
                  router.replace({
                    pathname: "/purchase/create-load",
                    params: { tripId: String(activeTrip.id) },
                  } as any);
                },
              },
            ],
          );
        }

        return;
      }

      Alert.alert("Error", "Could not start trip right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderScreen}>
        <ActivityIndicator color={DS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.sheet}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={18} color={DS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Start New Trip</Text>
        </View>

        <Text style={styles.label}>ODOMETER READING (KM)</Text>
        <TextInput
          value={odometerReading}
          onChangeText={setOdometerReading}
          keyboardType="number-pad"
          placeholder="0 00 000"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />

        <Text style={styles.label}>PHOTO OF ODOMETER</Text>
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.captureCard}
          onPress={handleCapture}
        >
          {odometerImageUri ? (
            <Image
              source={{ uri: odometerImageUri }}
              style={styles.capturePreview}
            />
          ) : (
            <View style={styles.capturePlaceholder}>
              <View style={styles.captureIconWrap}>
                <Ionicons
                  name="camera-outline"
                  size={22}
                  color={DS.textSecondary}
                />
              </View>
              <Text style={styles.captureText}>TAP TO CAPTURE</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.noticeCard}>
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={DS.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>VERIFICATION NOTICE</Text>
            <Text style={styles.noticeText}>
              Make sure the KM reading is clearly visible to avoid approval
              delays. Photo is optional but recommended.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.submitButton,
            !odometerReading || Number(odometerReading) <= 0
              ? styles.submitButtonDisabled
              : null,
          ]}
          disabled={
            !odometerReading || Number(odometerReading) <= 0 || submitting
          }
          onPress={handleSubmit}
        >
          <Text style={styles.submitText}>
            {submitting ? "Starting Trip..." : "Submit & Start Trip"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderScreen: {
    flex: 1,
    backgroundColor: DS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  screen: {
    flex: 1,
    backgroundColor: DS.background,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.xxl,
    padding: 20,
    borderWidth: 1,
    borderColor: DS.border,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DS.surface,
  },
  title: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  label: {
    ...EYEBROW,
    color: DS.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.surface,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
    marginBottom: 20,
  },
  captureCard: {
    minHeight: 180,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.surface,
    overflow: "hidden",
  },
  capturePlaceholder: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  captureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
  },
  captureText: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.6,
    marginTop: 12,
  },
  capturePreview: {
    width: "100%",
    height: 220,
  },
  noticeCard: {
    marginTop: 18,
    backgroundColor: DS.primarySoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.primarySoftBorder,
    padding: 14,
    flexDirection: "row",
    gap: 10,
  },
  noticeTitle: {
    ...EYEBROW,
    color: DS.primary,
    letterSpacing: 0.6,
  },
  noticeText: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 4,
  },
  submitButton: {
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: PALETTE.primary200,
  },
  submitText: {
    ...TYPO.s2,
    color: DS.white,
  },
});
