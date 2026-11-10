import NetInfo, {
  NetInfoState,
  NetInfoStateType,
} from "@react-native-community/netinfo";
import { API_SERVER_ROOT } from "../api";

export type NetworkStatus = "ONLINE" | "SLOW" | "OFFLINE";

export interface NetworkQualityState {
  status: NetworkStatus;
  isOnline: boolean;
  isSlowNetwork: boolean;
  latencyMs: number | null;
  connectionType: NetInfoStateType | "unknown";
  cellularGeneration: string | null;
  lastCheckedAt: number;
  isSimulatedOffline?: boolean;
  isSimulatedSlow?: boolean;
}

// Latency threshold in ms: if roundtrip latency > 2500ms, consider it "slow network"
const SLOW_LATENCY_THRESHOLD_MS = 2500;
const PING_TIMEOUT_MS = 3500;
const PERIODIC_PING_INTERVAL_MS = 25000;

type StateListener = (state: NetworkQualityState) => void;

class NetworkMonitor {
  private currentState: NetworkQualityState = {
    status: "ONLINE",
    isOnline: true,
    isSlowNetwork: false,
    latencyMs: null,
    connectionType: "unknown",
    cellularGeneration: null,
    lastCheckedAt: Date.now(),
    isSimulatedOffline: false,
    isSimulatedSlow: false,
  };

  private listeners: Set<StateListener> = new Set();
  private unsubscribeNetInfo: (() => void) | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isPinging = false;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Listen to native / web NetInfo changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((netState: NetInfoState) => {
      this.handleNetInfoChange(netState);
    });

    // 2. Fetch initial state
    NetInfo.fetch().then((netState) => {
      this.handleNetInfoChange(netState);
      this.measureLatency();
    });

    // 3. Periodic ping to actively measure latency & packet loss
    this.startPeriodicPing();
  }

  private startPeriodicPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    this.pingTimer = setInterval(() => {
      if (this.currentState.isOnline && !this.currentState.isSimulatedOffline) {
        this.measureLatency();
      }
    }, PERIODIC_PING_INTERVAL_MS);
  }

  private handleNetInfoChange(netState: NetInfoState) {
    const isConnected = Boolean(netState.isConnected);
    // On some devices isInternetReachable may initially be null; treat null as isConnected
    const isReachable =
      netState.isInternetReachable !== null
        ? Boolean(netState.isInternetReachable)
        : isConnected;

    const cellularGen =
      netState.type === NetInfoStateType.cellular &&
      netState.details &&
      "cellularGeneration" in netState.details
        ? (netState.details as any).cellularGeneration
        : null;

    // 2G or weak cellular generation is inherently slow
    const is2GOrSlowCellular =
      cellularGen === "2g" || cellularGen === "3g";

    let calculatedStatus: NetworkStatus = "ONLINE";
    if (!isConnected || !isReachable) {
      calculatedStatus = "OFFLINE";
    } else if (is2GOrSlowCellular) {
      calculatedStatus = "SLOW";
    } else if (
      this.currentState.latencyMs !== null &&
      this.currentState.latencyMs > SLOW_LATENCY_THRESHOLD_MS
    ) {
      calculatedStatus = "SLOW";
    }

    this.updateState({
      connectionType: netState.type,
      cellularGeneration: cellularGen,
      isOnline: calculatedStatus !== "OFFLINE",
      isSlowNetwork: calculatedStatus === "SLOW",
      status: calculatedStatus,
      lastCheckedAt: Date.now(),
    });

    // When connection comes back online, measure latency immediately
    if (isConnected && isReachable) {
      this.measureLatency();
    }
  }

  /**
   * Actively ping the backend server to test true reachability and measure roundtrip latency.
   */
  public async measureLatency(): Promise<number | null> {
    if (this.isPinging) {
      return this.currentState.latencyMs;
    }
    if (this.currentState.isSimulatedOffline) {
      this.updateState({
        status: "OFFLINE",
        isOnline: false,
        isSlowNetwork: false,
        latencyMs: null,
      });
      return null;
    }
    if (this.currentState.isSimulatedSlow) {
      this.updateState({
        status: "SLOW",
        isOnline: true,
        isSlowNetwork: true,
        latencyMs: 3200,
      });
      return 3200;
    }

    this.isPinging = true;
    const startTime = Date.now();

    // Probe the public server root; /auth/identify is an account lookup endpoint,
    // not a health check, and can return 401 when no credentials are supplied.
    const pingUrl = `${API_SERVER_ROOT}/`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, PING_TIMEOUT_MS);

      // The server root responds to GET; HEAD may return a misleading 404.
      await fetch(pingUrl, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      const isSlow = latency > SLOW_LATENCY_THRESHOLD_MS;

      this.updateState({
        latencyMs: latency,
        isOnline: true,
        isSlowNetwork: isSlow,
        status: isSlow ? "SLOW" : "ONLINE",
        lastCheckedAt: Date.now(),
      });

      return latency;
    } catch (err: any) {
      // AbortController timeout or network error indicates offline or extremely slow
      const isTimeout =
        err?.name === "AbortError" ||
        err?.message?.includes("aborted") ||
        err?.message?.includes("timeout");

      if (isTimeout) {
        // Request timed out (> 3500ms): Treat as SLOW network (or near dead)
        this.updateState({
          latencyMs: PING_TIMEOUT_MS,
          isOnline: true,
          isSlowNetwork: true,
          status: "SLOW",
          lastCheckedAt: Date.now(),
        });
        return PING_TIMEOUT_MS;
      }

      // Complete fetch failure: might be totally offline
      this.updateState({
        latencyMs: null,
        isOnline: false,
        isSlowNetwork: false,
        status: "OFFLINE",
        lastCheckedAt: Date.now(),
      });
      return null;
    } finally {
      this.isPinging = false;
    }
  }

  /**
   * Helper that API interceptor or caller can use to report a network timeout/failure.
   * If an API call fails with network error, immediately degrade network status to SLOW or OFFLINE.
   */
  public reportRequestFailure(error: any) {
    const isNetworkError =
      error?.code === "ECONNABORTED" ||
      error?.message?.toLowerCase().includes("network error") ||
      error?.message?.toLowerCase().includes("timeout");

    if (isNetworkError) {
      // Degrade state immediately to protect driver from hanging
      this.updateState({
        isSlowNetwork: true,
        status: "SLOW",
        lastCheckedAt: Date.now(),
      });
      // Fire a ping to verify actual connectivity
      this.measureLatency();
    }
  }

  public reportRequestSuccess(durationMs?: number) {
    if (durationMs && durationMs > SLOW_LATENCY_THRESHOLD_MS) {
      this.updateState({
        isSlowNetwork: true,
        status: "SLOW",
        latencyMs: durationMs,
        lastCheckedAt: Date.now(),
      });
    } else if (this.currentState.status === "SLOW" && durationMs && durationMs < 1000) {
      // Recovered quickly
      this.updateState({
        isSlowNetwork: false,
        status: "ONLINE",
        latencyMs: durationMs,
        lastCheckedAt: Date.now(),
      });
    }
  }

  public getState(): NetworkQualityState {
    return { ...this.currentState };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(partial: Partial<NetworkQualityState>) {
    const nextState = {
      ...this.currentState,
      ...partial,
    };

    // Honor simulation overrides if set
    if (nextState.isSimulatedOffline) {
      nextState.status = "OFFLINE";
      nextState.isOnline = false;
      nextState.isSlowNetwork = false;
    } else if (nextState.isSimulatedSlow) {
      nextState.status = "SLOW";
      nextState.isOnline = true;
      nextState.isSlowNetwork = true;
    }

    const hasChanged =
      this.currentState.status !== nextState.status ||
      this.currentState.isOnline !== nextState.isOnline ||
      this.currentState.isSlowNetwork !== nextState.isSlowNetwork ||
      this.currentState.latencyMs !== nextState.latencyMs;

    this.currentState = nextState;

    if (hasChanged) {
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState);
      } catch (e) {
        console.error("Error in network monitor listener:", e);
      }
    }
  }

  /**
   * Simulation tools for testing in development or demonstration
   */
  public simulateOffline(enabled: boolean) {
    this.updateState({
      isSimulatedOffline: enabled,
      isSimulatedSlow: false,
    });
  }

  public simulateSlowNetwork(enabled: boolean) {
    this.updateState({
      isSimulatedSlow: enabled,
      isSimulatedOffline: false,
    });
  }

  public resetSimulation() {
    this.updateState({
      isSimulatedOffline: false,
      isSimulatedSlow: false,
    });
    this.measureLatency();
  }

  public destroy() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    this.listeners.clear();
  }
}

export const networkMonitor = new NetworkMonitor();
