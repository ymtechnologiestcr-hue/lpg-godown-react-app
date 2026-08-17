import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { DS, RADIUS, TYPO } from "../../constants/designSystem";

export default function PurchaseTripTypeScreen() {
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

        <View style={styles.divider} />

        <Text style={styles.subtitle}>What type of trip are you starting?</Text>

        <TouchableOpacity
          style={styles.optionCard}
          activeOpacity={0.8}
          onPress={() => router.push("/purchase/start-trip" as any)}
        >
          <View style={[styles.iconWrap, { backgroundColor: DS.primarySoft }]}>
            <Ionicons name="bus-outline" size={24} color={DS.primary} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Purchase Trip</Text>
            <Text style={styles.optionDesc}>
              Load cylinders from depot and record expenses
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={DS.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          activeOpacity={0.8}
          onPress={() => router.push("/purchase/select-return-load" as any)}
        >
          <View style={[styles.iconWrap, { backgroundColor: DS.primarySoft }]}>
            <Ionicons name="refresh" size={24} color={DS.primary} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Return Trip</Text>
            <Text style={styles.optionDesc}>
              Return empty or damaged cylinders back to depot
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={DS.textTertiary} />
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
    marginBottom: 20,
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
  divider: {
    height: 1,
    backgroundColor: DS.border,
    marginBottom: 24,
    marginHorizontal: -20,
  },
  subtitle: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.white,
    marginBottom: 16,
    gap: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  optionDesc: {
    ...TYPO.c1,
    color: DS.textSecondary,
  },
});
