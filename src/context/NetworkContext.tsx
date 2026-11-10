import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  networkMonitor,
  NetworkQualityState,
  NetworkStatus,
} from "../services/network/networkMonitor";
import {
  offlineQueue,
  OfflineAction,
} from "../services/offline/offlineQueue";
import { syncEngine, SyncResult } from "../services/offline/syncEngine";

interface NetworkContextValue {
  networkState: NetworkQualityState;
  status: NetworkStatus;
  isOnline: boolean;
  isSlowNetwork: boolean;
  latencyMs: number | null;
  queue: OfflineAction[];
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  isOfflineModalOpen: boolean;
  setOfflineModalOpen: (open: boolean) => void;
  syncNow: () => Promise<SyncResult>;
  retryAction: (id: string) => Promise<SyncResult>;
  retryAllFailed: () => Promise<SyncResult>;
  removeAction: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  simulateOffline: (enabled: boolean) => void;
  simulateSlow: (enabled: boolean) => void;
  resetSimulation: () => void;
  checkConnection: () => Promise<number | null>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [networkState, setNetworkState] = useState<NetworkQualityState>(
    networkMonitor.getState(),
  );
  const [queue, setQueue] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(syncEngine.getIsSyncing());
  const [isOfflineModalOpen, setOfflineModalOpen] = useState(false);

  useEffect(() => {
    // 1. Subscribe to network changes
    const unsubNetwork = networkMonitor.subscribe((state) => {
      setNetworkState(state);
    });

    // 2. Subscribe to offline queue changes
    const unsubQueue = offlineQueue.subscribe((updatedQueue) => {
      setQueue(updatedQueue);
    });

    // 3. Subscribe to sync engine status
    const unsubSync = syncEngine.subscribe((syncing) => {
      setIsSyncing(syncing);
    });

    // 4. Handle app state transitions (background -> active)
    const handleAppStateChange = (nextStatus: AppStateStatus) => {
      if (nextStatus === "active") {
        networkMonitor.measureLatency().then(() => {
          syncEngine.syncPendingActions();
        });
      }
    };

    const appStateSub = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      unsubNetwork();
      unsubQueue();
      unsubSync();
      appStateSub.remove();
    };
  }, []);

  const pendingCount = useMemo(() => {
    return queue.filter(
      (a) => a.status === "PENDING" || (a.status === "FAILED" && a.retryCount < a.maxRetries),
    ).length;
  }, [queue]);

  const failedCount = useMemo(() => {
    return queue.filter((a) => a.status === "FAILED").length;
  }, [queue]);

  const syncNow = useCallback(async () => {
    return await syncEngine.syncPendingActions();
  }, []);

  const retryAction = useCallback(async (id: string) => {
    await offlineQueue.retryAction(id);
    return syncEngine.syncPendingActions();
  }, []);

  const retryAllFailed = useCallback(async () => {
    await offlineQueue.retryAllFailed();
    return syncEngine.syncPendingActions();
  }, []);

  const removeAction = useCallback(async (id: string) => {
    await offlineQueue.removeAction(id);
  }, []);

  const clearCompleted = useCallback(async () => {
    await offlineQueue.clearCompleted();
  }, []);

  const simulateOffline = useCallback((enabled: boolean) => {
    networkMonitor.simulateOffline(enabled);
  }, []);

  const simulateSlow = useCallback((enabled: boolean) => {
    networkMonitor.simulateSlowNetwork(enabled);
  }, []);

  const resetSimulation = useCallback(() => {
    networkMonitor.resetSimulation();
  }, []);

  const checkConnection = useCallback(async () => {
    return await networkMonitor.measureLatency();
  }, []);

  const value = useMemo(
    () => ({
      networkState,
      status: networkState.status,
      isOnline: networkState.isOnline,
      isSlowNetwork: networkState.isSlowNetwork,
      latencyMs: networkState.latencyMs,
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
      clearCompleted,
      simulateOffline,
      simulateSlow,
      resetSimulation,
      checkConnection,
    }),
    [
      networkState,
      queue,
      pendingCount,
      failedCount,
      isSyncing,
      isOfflineModalOpen,
      syncNow,
      retryAction,
      retryAllFailed,
      removeAction,
      clearCompleted,
      simulateOffline,
      simulateSlow,
      resetSimulation,
      checkConnection,
    ],
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextValue => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
};
