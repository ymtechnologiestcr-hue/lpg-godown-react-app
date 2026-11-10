import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DS, PALETTE, RADIUS, TYPO } from "../../constants/designSystem";
import { useNetwork } from "../../context/NetworkContext";
import { OfflineAction } from "../../services/offline/offlineQueue";

export default function OfflineSyncModal() {
  const {
    status,
    isOnline,
    isSlowNetwork,
    latencyMs,
    queue,
    pendingCount,
    failedCount,
    isSyncing,
    isOfflineModalOpen,
    setOfflineModalOpen,
    syncNow,
    retryAction,
    retryAllFailed,
    removeAction,
    simulateOffline,
    simulateSlow,
    resetSimulation,
    checkConnection,
  } = useNetwork();

  const [isCheckingPing, setIsCheckingPing] = useState(false);
  const [showSimControls, setShowSimControls] = useState(false);

  const handleManualPing = async () => {
    setIsCheckingPing(true);
    await checkConnection();
    setIsCheckingPing(false);
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const getStatusBadge = (action: OfflineAction) => {
    switch (action.status) {
      case "SYNCING":
        return (
          <View style={[styles.badge, styles.badgeSyncing]}>
            <ActivityIndicator size="small" color={PALETTE.blue600} style={styles.badgeSpinner} />
            <Text style={[styles.badgeText, { color: PALETTE.blue700 }]}>Syncing...</Text>
          </View>
        );
      case "FAILED":
        return (
          <View style={[styles.badge, styles.badgeFailed]}>
            <Ionicons name="alert-circle" size={12} color={PALETTE.red600} />
            <Text style={[styles.badgeText, { color: PALETTE.red700 }]}>
              Failed ({action.retryCount}/{action.maxRetries})
            </Text>
          </View>
        );
      case "COMPLETED":
        return (
          <View style={[styles.badge, styles.badgeCompleted]}>
            <Ionicons name="checkmark-circle" size={12} color={PALETTE.green600} />
            <Text style={[styles.badgeText, { color: PALETTE.green700 }]}>Synced</Text>
          </View>
        );
      case "PENDING":
      default:
        return (
          <View style={[styles.badge, styles.badgePending]}>
            <Ionicons name="time-outline" size={12} color={PALETTE.yellow700} />
            <Text style={[styles.badgeText, { color: PALETTE.yellow700 }]}>Queued</Text>
          </View>
        );
    }
  };

  return (
    <Modal
      visible={isOfflineModalOpen}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setOfflineModalOpen(false)}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Offline & Sync Manager</Text>
            <Text style={styles.headerSubtitle}>
              {pendingCount} item{pendingCount !== 1 ? "s" : ""} waiting to sync
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setOfflineModalOpen(false)}
          >
            <Ionicons name="close" size={24} color={DS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Network Status Card */}
        <View style={styles.networkStatusCard}>
          <View style={styles.networkStatusRow}>
            <View
              style={[
                styles.statusDot,
                status === "ONLINE"
                  ? styles.dotOnline
                  : status === "SLOW"
                  ? styles.dotSlow
                  : styles.dotOffline,
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.networkStatusTitle}>
                {status === "ONLINE"
                  ? "Network Connected"
                  : status === "SLOW"
                  ? "Slow Internet Detected"
                  : "No Internet Connection"}
              </Text>
              <Text style={styles.networkStatusSub}>
                {status === "ONLINE"
                  ? `Good latency (${latencyMs ? `${latencyMs}ms` : "Fast"})`
                  : status === "SLOW"
                  ? `High latency (${latencyMs ? `${latencyMs}ms` : ">2.5s"}) • Offline Mode Active`
                  : "Changes are automatically preserved locally"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.pingBtn}
              onPress={handleManualPing}
              disabled={isCheckingPing}
            >
              {isCheckingPing ? (
                <ActivityIndicator size="small" color={DS.primary} />
              ) : (
                <View style={styles.pingInner}>
                  <Ionicons name="refresh" size={14} color={DS.primary} />
                  <Text style={styles.pingText}>Test</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Action List */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {queue.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="cloud-done-outline" size={36} color={PALETTE.green600} />
              </View>
              <Text style={styles.emptyTitle}>All Deliveries Synced</Text>
              <Text style={styles.emptySub}>
                There are no pending offline actions. Whenever you deliver or create a sale
                with low/no network, it will be safely collected here.
              </Text>
            </View>
          ) : (
            queue.map((action) => (
              <View key={action.id} style={styles.actionCard}>
                <View style={styles.actionCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle} numberOfLines={1}>
                      {action.metadata.title || "Pending Delivery"}
                    </Text>
                    {action.metadata.subtitle ? (
                      <Text style={styles.actionSubtitle}>
                        {action.metadata.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {getStatusBadge(action)}
                </View>

                {action.errorMessage ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={14} color={PALETTE.red600} />
                    <Text style={styles.errorText} numberOfLines={2}>
                      {action.errorMessage}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actionFooter}>
                  <Text style={styles.timestampText}>
                    Queued at {formatTime(action.createdAt)}
                  </Text>

                  <View style={styles.actionButtonsRow}>
                    {action.status === "FAILED" && (
                      <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={() => retryAction(action.id)}
                      >
                        <Ionicons name="refresh" size={12} color={DS.primary} />
                        <Text style={styles.retryText}>Retry</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => removeAction(action.id)}
                    >
                      <Ionicons name="trash-outline" size={14} color={DS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}

          {/* Test & Simulation Section */}
          <View style={styles.simulationSection}>
            <TouchableOpacity
              style={styles.simulationHeader}
              onPress={() => setShowSimControls((p) => !p)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="construct-outline" size={16} color={DS.textSecondary} />
                <Text style={styles.simulationTitle}> Developer Network Simulator</Text>
              </View>
              <Ionicons
                name={showSimControls ? "chevron-up" : "chevron-down"}
                size={18}
                color={DS.textSecondary}
              />
            </TouchableOpacity>

            {showSimControls && (
              <View style={styles.simulationBody}>
                <Text style={styles.simDescription}>
                  Simulate low network or offline environments to verify optimistic offline
                  delivery collection and auto-sync without turning off real Wi-Fi/data.
                </Text>

                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Simulate Slow Network (2G / High Latency)</Text>
                  <Switch
                    value={isSlowNetwork && !status.includes("OFFLINE")}
                    onValueChange={(val) => {
                      if (val) simulateSlow(true);
                      else resetSimulation();
                    }}
                    trackColor={{ false: PALETTE.grey300, true: PALETTE.yellow500 }}
                  />
                </View>

                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Simulate Total Offline Mode</Text>
                  <Switch
                    value={!isOnline}
                    onValueChange={(val) => {
                      if (val) simulateOffline(true);
                      else resetSimulation();
                    }}
                    trackColor={{ false: PALETTE.grey300, true: PALETTE.red500 }}
                  />
                </View>

                <TouchableOpacity
                  style={styles.resetSimBtn}
                  onPress={resetSimulation}
                >
                  <Text style={styles.resetSimText}>Reset Network to Real Hardware</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer Sync Button */}
        <View style={styles.footer}>
          {failedCount > 0 && (
            <TouchableOpacity
              style={styles.retryAllBtn}
              onPress={retryAllFailed}
              disabled={isSyncing}
            >
              <Text style={styles.retryAllText}>Retry Failed ({failedCount})</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.syncNowBtn,
              (!isOnline || pendingCount === 0 || isSyncing) && styles.syncNowDisabled,
            ]}
            onPress={syncNow}
            disabled={!isOnline || pendingCount === 0 || isSyncing}
          >
            {isSyncing ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ActivityIndicator color={DS.white} size="small" style={{ marginRight: 8 }} />
                <Text style={styles.syncNowText}>Syncing Deliveries...</Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="cloud-upload-outline" size={18} color={DS.white} style={{ marginRight: 8 }} />
                <Text style={styles.syncNowText}>
                  {!isOnline ? "Waiting for Connection..." : "Sync All Now"}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    backgroundColor: DS.card,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPO.s1.fontSize,
    fontWeight: "700",
    color: DS.textPrimary,
  },
  headerSubtitle: {
    fontSize: TYPO.c1.fontSize,
    color: DS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  networkStatusCard: {
    margin: 16,
    padding: 14,
    backgroundColor: DS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
  },
  networkStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  dotOnline: {
    backgroundColor: PALETTE.green500,
  },
  dotSlow: {
    backgroundColor: PALETTE.yellow500,
  },
  dotOffline: {
    backgroundColor: PALETTE.red500,
  },
  networkStatusTitle: {
    fontSize: TYPO.b3.fontSize,
    fontWeight: "600",
    color: DS.textPrimary,
  },
  networkStatusSub: {
    fontSize: TYPO.c1.fontSize,
    color: DS.textSecondary,
    marginTop: 2,
  },
  pingBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: DS.primarySoft,
  },
  pingInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  pingText: {
    fontSize: 12,
    color: DS.primary,
    fontWeight: "600",
    marginLeft: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PALETTE.green50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: TYPO.s1.fontSize,
    fontWeight: "700",
    color: DS.textPrimary,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: TYPO.b3.fontSize,
    color: DS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  actionCard: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: DS.border,
  },
  actionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  actionTitle: {
    fontSize: TYPO.s2.fontSize,
    fontWeight: "600",
    color: DS.textPrimary,
  },
  actionSubtitle: {
    fontSize: TYPO.c1.fontSize,
    color: DS.textSecondary,
    marginTop: 3,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  badgePending: {
    backgroundColor: PALETTE.yellow50,
  },
  badgeSyncing: {
    backgroundColor: PALETTE.blue50,
  },
  badgeFailed: {
    backgroundColor: PALETTE.red50,
  },
  badgeCompleted: {
    backgroundColor: PALETTE.green50,
  },
  badgeSpinner: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PALETTE.red50,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    marginTop: 8,
  },
  errorText: {
    fontSize: 11,
    color: PALETTE.red700,
    marginLeft: 6,
    flex: 1,
  },
  actionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: DS.border,
  },
  timestampText: {
    fontSize: 11,
    color: DS.textSecondary,
  },
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    marginRight: 8,
  },
  retryText: {
    fontSize: 11,
    fontWeight: "600",
    color: DS.primary,
    marginLeft: 4,
  },
  deleteBtn: {
    padding: 4,
  },
  simulationSection: {
    marginTop: 20,
    backgroundColor: DS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    overflow: "hidden",
  },
  simulationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  simulationTitle: {
    fontSize: TYPO.b3.fontSize,
    fontWeight: "600",
    color: DS.textSecondary,
  },
  simulationBody: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: DS.border,
  },
  simDescription: {
    fontSize: TYPO.c1.fontSize,
    color: DS.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  simRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  simLabel: {
    fontSize: TYPO.b3.fontSize,
    color: DS.textPrimary,
    flex: 1,
    paddingRight: 10,
  },
  resetSimBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: PALETTE.grey100,
  },
  resetSimText: {
    fontSize: TYPO.c1.fontSize,
    fontWeight: "600",
    color: DS.textSecondary,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: DS.border,
    backgroundColor: DS.card,
  },
  retryAllBtn: {
    backgroundColor: PALETTE.red50,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PALETTE.red100,
  },
  retryAllText: {
    color: PALETTE.red700,
    fontWeight: "600",
    fontSize: TYPO.b3.fontSize,
  },
  syncNowBtn: {
    backgroundColor: DS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  syncNowDisabled: {
    opacity: 0.6,
  },
  syncNowText: {
    color: DS.white,
    fontSize: TYPO.s2.fontSize,
    fontWeight: "600",
  },
});
