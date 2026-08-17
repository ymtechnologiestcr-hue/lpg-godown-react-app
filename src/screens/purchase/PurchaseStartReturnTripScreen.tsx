import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
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
import { startEmptyCylinderTrip } from "../../services/purchaseService";

export default function PurchaseStartReturnTripScreen() {
  const { loadId } = useLocalSearchParams<{ loadId: string }>();
  const [storedUserId, setStoredUserId] = useState<number | null>(null);
  const [odometerReading, setOdometerReading] = useState("");
  const [odometerImageUri, setOdometerImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const rawUser = await AsyncStorage.getItem(AUTH_USER_KEY);
      const parsedUser = rawUser ? JSON.parse(rawUser) : null;
      if (parsedUser?.id) setStoredUserId(Number(parsedUser.id));
    };
    loadUser();
  }, []);

  const handleCapture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.6,
    });
    if (!result.canceled) setOdometerImageUri(result.assets[0]?.uri ?? null);
  };

  const handleSubmit = async () => {
    if (!storedUserId || !loadId) { alert(`Missing data: userId=${storedUserId}, loadId=${loadId}`); return; }
    try {
      setSubmitting(true);
      const trip = await startEmptyCylinderTrip({
        userId: storedUserId,
        emptyLoadId: Number(loadId),
        odometerReading: Number(odometerReading),
        odometerImageUri,
      });

      // Navigate to the active trips screen or dashboard
      router.replace("/purchase/trips" as any);
    } catch (error: any) {
      console.log("Start return trip error:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message || "Could not start return trip.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
          <Text style={styles.title}>Start Return Trip</Text>
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

        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.submitButton,
            (!odometerReading || submitting) && styles.submitButtonDisabled,
          ]}
          disabled={!odometerReading || submitting}
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
  title: { ...TYPO.s1, color: DS.textPrimary },
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
  capturePreview: { width: "100%", height: 220 },
  submitButton: {
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  submitButtonDisabled: { backgroundColor: PALETTE.primary200 },
  submitText: { ...TYPO.s2, color: DS.white },
});

