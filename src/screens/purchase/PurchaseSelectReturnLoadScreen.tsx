import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AUTH_USER_KEY } from "../../constants/auth";
import { DS, RADIUS, TYPO } from "../../constants/designSystem";
import { getEmptyCylinderLoads } from "../../services/emptyCylinderLoadService";
import type { EmptyCylinderLoad } from "../../types";

export default function PurchaseSelectReturnLoadScreen() {
  const [loads, setLoads] = useState<EmptyCylinderLoad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoads = async () => {
      try {
        const rawUser = await AsyncStorage.getItem(AUTH_USER_KEY);
        const parsedUser = rawUser ? JSON.parse(rawUser) : null;
        const localUserId = Number(parsedUser?.id);

        if (!localUserId) return;

        const data = await getEmptyCylinderLoads({
          purchaseManagerId: localUserId,
          status: "ACCEPTED",
        });

        // Filter out loads that already have an active/completed trip associated with them
        // (Assuming the backend now returns tripId in the payload)
        const availableLoads = data.filter((load) => !load.tripId);
        setLoads(availableLoads);
      } catch (error) {
        console.error("Failed to load empty cylinder loads:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLoads();
  }, []);

  const renderItem = ({ item }: { item: EmptyCylinderLoad }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: "/purchase/start-return-trip",
          params: { loadId: item.id },
        } as any)
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Load #{item.id}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.detailText}>Vehicle: {item.vehicleNumber}</Text>
        <Text style={styles.detailText}>
          Total Empties: {item.totalQuantity}
        </Text>
        <Text style={styles.detailText}>
          Total Defectives: {item.totalDefectiveQuantity}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Select Return Load</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={DS.primary} />
      ) : loads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No pending accepted loads to return.
          </Text>
        </View>
      ) : (
        <FlatList
          data={loads}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  backButton: { marginRight: 16 },
  title: { ...TYPO.s1, color: DS.textPrimary },
  listContainer: { padding: 16, gap: 12 },
  card: {
    backgroundColor: DS.white,
    borderRadius: RADIUS.md,
    padding: 16,
    borderWidth: 1,
    borderColor: DS.border,
  },
  cardHeader: { marginBottom: 8 },
  cardTitle: { ...TYPO.s2, color: DS.textPrimary },
  cardBody: { gap: 4 },
  detailText: { ...TYPO.c1, color: DS.textSecondary },
  emptyState: { padding: 32, alignItems: "center" },
  emptyStateText: { ...TYPO.b3, color: DS.textTertiary },
});
