import { Ionicons } from "@expo/vector-icons";
import { isAxiosError } from "axios";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  DS,
  EYEBROW,
  PALETTE,
  RADIUS,
  TYPO,
  WEIGHT,
} from "../../constants/designSystem";
import { submitPurchaseTrip } from "../../services/purchaseService";
import { showToast } from "../../components/common/ToastManager";

// Closes an empty-cylinder trip in one step: end odometer (required) plus the
// optional IOC invoice. There is no approval gate — this completes the trip and
// the godown load together, so the godown manager sees it as completed at once.
export default function PurchaseEndEmptyTripScreen() {
  const { tripId, loadId, startKm } = useLocalSearchParams<{
    tripId?: string;
    loadId?: string;
    startKm?: string;
  }>();

  const numericTripId = Number(tripId);
  const numericLoadId = Number(loadId);
  const numericStartKm = Number(startKm || 0);

  const [odometerReading, setOdometerReading] = useState("");
  const [odometerImageUri, setOdometerImageUri] = useState<string | null>(null);
  const [invoiceUri, setInvoiceUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async (
    source: "camera" | "gallery",
    setter: (uri: string | null) => void,
  ) => {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 0.6,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.6,
            });

      if (!result.canceled) {
        setter(result.assets[0]?.uri ?? null);
      }
    } catch (error) {
      console.log("Pick image error:", error);
    }
  };

  const parsedReading = Number(odometerReading || 0);
  const readingBelowStart =
    numericStartKm > 0 && parsedReading > 0 && parsedReading < numericStartKm;
  const canSubmit =
    !!numericTripId &&
    parsedReading > 0 &&
    !!odometerImageUri &&
    !readingBelowStart;

  const handleSubmit = async () => {
    if (!numericTripId) {
      Alert.alert(
        "Error",
        "Trip not found. Please reopen the load and try again.",
      );
      return;
    }

    if (!odometerImageUri) {
      Alert.alert(
        "Photo required",
        "Capture the closing odometer photo to end the trip.",
      );
      return;
    }

    try {
      setSubmitting(true);

      // ONE API CALL DOES IT ALL!
      await submitPurchaseTrip({
        tripId: numericTripId,
        emptyLoadId: numericLoadId,
        endOdometerReading: parsedReading,
        endOdometerImageUri: odometerImageUri,
        invoiceUri: invoiceUri, // Pass the local URI directly
      });

      DeviceEventEmitter.emit("PURCHASE_FLOW_UPDATED");

      showToast("Empty cylinder trip and load completed successfully", "success");
      router.replace("/purchase-home" as any);
    } catch (error) {
      const message =
        isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : "Could not end the trip right now. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.sheet}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={18} color={DS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>
            End Empty Trip · #{numericTripId || "-"}
          </Text>
        </View>

        {numericStartKm > 0 ? (
          <View style={styles.startKmRow}>
            <Text style={styles.startKmLabel}>START READING</Text>
            <Text style={styles.startKmValue}>
              {numericStartKm.toLocaleString("en-IN")} km
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>CLOSING ODOMETER READING (KM)</Text>
        <TextInput
          value={odometerReading}
          onChangeText={setOdometerReading}
          keyboardType="number-pad"
          placeholder="0 00 000"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />

        {readingBelowStart ? (
          <Text style={styles.errorText}>
            Closing reading cannot be lower than the start reading.
          </Text>
        ) : null}

        <Text style={styles.label}>PHOTO OF ODOMETER (REQUIRED)</Text>
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.captureCard}
          onPress={() => pickImage("camera", setOdometerImageUri)}
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

        <Text style={[styles.label, styles.labelSpaced]}>
          IOC INVOICE (OPTIONAL)
        </Text>
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.captureCard}
          onPress={() => {
            Alert.alert("Upload Invoice", "Choose photo source", [
              {
                text: "Camera",
                onPress: () => pickImage("camera", setInvoiceUri),
              },
              {
                text: "Gallery",
                onPress: () => pickImage("gallery", setInvoiceUri),
              },
              { text: "Cancel", style: "cancel" },
            ]);
          }}
        >
          {invoiceUri ? (
            <Image
              source={{ uri: invoiceUri }}
              style={styles.capturePreview}
            />
          ) : (
            <View style={styles.capturePlaceholder}>
              <View style={styles.captureIconWrap}>
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color={DS.textSecondary}
                />
              </View>
              <Text style={styles.captureText}>TAP TO ADD INVOICE</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.noticeCard}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={DS.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>ENDING THE TRIP</Text>
            <Text style={styles.noticeText}>
              This completes the trip and the godown load immediately — no
              approval is needed. Expenses you added stay pending until the
              cashier approves them.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.submitButton,
            !canSubmit ? styles.submitButtonDisabled : null,
          ]}
          disabled={!canSubmit || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color={DS.white} />
          ) : (
            <Text style={styles.submitText}>Submit &amp; End Trip</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
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
    flexShrink: 1,
  },
  startKmRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: DS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.divider,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  startKmLabel: {
    ...EYEBROW,
    color: DS.textTertiary,
    letterSpacing: 0.6,
  },
  startKmValue: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  label: {
    ...EYEBROW,
    color: DS.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: 20,
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
  errorText: {
    ...TYPO.c1,
    color: DS.red,
    marginTop: -12,
    marginBottom: 16,
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
