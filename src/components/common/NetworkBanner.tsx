import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PALETTE, RADIUS } from "../../constants/designSystem";
import { useNetwork } from "../../context/NetworkContext";

export default function NetworkBanner() {
  const insets = useSafeAreaInsets();
  const {
    status,
    isOnline,
    isSlowNetwork,
    pendingCount,
    failedCount,
    isSyncing,
    setOfflineModalOpen,
    syncNow,
  } = useNetwork();

  // If completely online with no pending/failed actions and not syncing, hide banner
  if (
    status === "ONLINE" &&
    !isSlowNetwork &&
    pendingCount === 0 &&
    failedCount === 0 &&
    !isSyncing
  ) {
    return null;
  }

  const isOffline = status === "OFFLINE" || !isOnline;

  const getBannerConfig = () => {
    if (isSyncing) {
      return {
        bg: PALETTE.primary700,
        icon: null,
        showSpinner: true,
        text: `Syncing ${pendingCount} delivery action${pendingCount > 1 ? "s" : ""}...`,
        actionText: "View",
        onAction: () => setOfflineModalOpen(true),
      };
    }

    if (failedCount > 0) {
      return {
        bg: PALETTE.red600,
        icon: "alert-circle" as const,
        showSpinner: false,
        text: `${failedCount} action${failedCount > 1 ? "s" : ""} failed to sync`,
        actionText: "Fix",
        onAction: () => setOfflineModalOpen(true),
      };
    }

    if (isOffline) {
      return {
        bg: PALETTE.red700,
        icon: "cloud-offline" as const,
        showSpinner: false,
        text: pendingCount > 0
          ? `Offline: ${pendingCount} delivery action${pendingCount > 1 ? "s" : ""} saved locally`
          : "No Internet Connection • Offline Mode Active",
        actionText: pendingCount > 0 ? "View" : "Status",
        onAction: () => setOfflineModalOpen(true),
      };
    }

    if (isSlowNetwork) {
      return {
        bg: PALETTE.yellow700,
        icon: "cellular" as const,
        showSpinner: false,
        text: pendingCount > 0
          ? `Slow Internet: ${pendingCount} saved locally`
          : "Slow Internet Detected • Offline Mode Active",
        actionText: pendingCount > 0 ? "Sync" : "View",
        onAction: () => {
          if (pendingCount > 0 && isOnline) {
            syncNow();
          } else {
            setOfflineModalOpen(true);
          }
        },
      };
    }

    // Default with pending items while online
    if (pendingCount > 0) {
      return {
        bg: PALETTE.primary600,
        icon: "cloud-upload" as const,
        showSpinner: false,
        text: `${pendingCount} offline action${pendingCount > 1 ? "s" : ""} ready to sync`,
        actionText: "Sync Now",
        onAction: () => syncNow(),
      };
    }

    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: config.bg,
          paddingTop: Math.max(insets.top, 8),
        },
      ]}
    >
      <TouchableOpacity
        style={styles.contentWrap}
        activeOpacity={0.85}
        onPress={() => setOfflineModalOpen(true)}
      >
        <View style={styles.leftRow}>
          {config.showSpinner ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={styles.icon} />
          ) : (
            <Ionicons name={config.icon!} size={16} color="#FFFFFF" style={styles.icon} />
          )}
          <Text style={styles.bannerText} numberOfLines={1}>
            {config.text}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={(e) => {
            e.stopPropagation();
            config.onAction();
          }}
        >
          <Text style={styles.actionBtnText}>{config.actionText}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    paddingVertical: 7,
    paddingHorizontal: 14,
    zIndex: 9999,
  },
  contentWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  icon: {
    marginRight: 8,
  },
  bannerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  actionBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
