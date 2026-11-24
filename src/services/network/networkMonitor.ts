import NetInfo, {
  NetInfoState,
  NetInfoStateType,
} from "@react-native-community/netinfo";
import { AppState } from "react-native";
import { API_SERVER_ROOT } from "../apiConfig";

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
const SLOW_CONFIRMATION_DELAY_MS = 800;

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
  private confirmationTimer: ReturnType<typeof setTimeout> | null = null;
  private isPinging = false;
  private connectionEpoch = 0;
  private lastConnectionKey: string | null = null;
  private lastNativeConnectivity: { connected: boolean; reachable: boolean } | null = null;
  private consecutiveSlowProbes = 0;
  private consecutiveFastProbes = 0;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Listen to native / web NetInfo changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((netState: NetInfoState) => {
      this.handleNetInfoChange(netState);
    });

    // 2. Fetch initial state
    NetInfo.fetch()
      .then((netState) => {
        this.handleNetInfoChange(netState);
        this.measureLatency();
      })
      .catch(() => {
        // The event listener remains active if the initial fetch is unavailable.
      });

    // 3. Periodic ping to actively measure latency & packet loss
    this.startPeriodicPing();
  }

  private startPeriodicPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    this.pingTimer = setInterval(() => {
      if (
        AppState.currentState === "active" &&
        this.currentState.isOnline &&
        !this.currentState.isSimulatedOffline
      ) {
        this.measureLatency();
      }
    }, PERIODIC_PING_INTERVAL_MS);
  }

  private handleNetInfoChange(netState: NetInfoState) {
    const isConnected = Boolean(netState.isConnected);
    // On some devices isInternetReachable may initially be null; treat null as isConnected
    const isReachable =
      netState.isInternetReachable != null
        ? Boolean(netState.isInternetReachable)
        : isConnected;

    const cellularGen =
      netState.type === NetInfoStateType.cellular &&
      netState.details &&
      "cellularGeneration" in netState.details
        ? (netState.details as any).cellularGeneration
        : null;

    const connectionDetails = netState.details as any;
    const connectionKey = [
      netState.type,
      cellularGen ?? "",
      connectionDetails?.ssid ?? "",
      connectionDetails?.bssid ?? "",
      connectionDetails?.ipAddress ?? "",
    ].join(":");
    const connectivityChanged =
      this.lastConnectionKey !== connectionKey ||
      this.lastNativeConnectivity?.connected !== isConnected ||
      this.lastNativeConnectivity?.reachable !== isReachable;

    if (connectivityChanged) {
      this.connectionEpoch += 1;
      this.consecutiveSlowProbes = 0;
      this.consecutiveFastProbes = 0;
      if (this.confirmationTimer) {
        clearTimeout(this.confirmationTimer);
        this.confirmationTimer = null;
      }
    }

    this.lastConnectionKey = connectionKey;
    this.lastNativeConnectivity = { connected: isConnected, reachable: isReachable };

    const isOffline = !isConnected || !isReachable;
    const nextStatus: NetworkStatus = isOffline
      ? "OFFLINE"
      : connectivityChanged
        ? "ONLINE"
        : this.currentState.isSlowNetwork
          ? "SLOW"
          : "ONLINE";

    this.updateState({
      connectionType: netState.type,
      cellularGeneration: cellularGen,
      ...(connectivityChanged ? { latencyMs: null } : {}),
      isOnline: !isOffline,
      isSlowNetwork: nextStatus === "SLOW",
      status: nextStatus,
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

    if (this.confirmationTimer) {
      clearTimeout(this.confirmationTimer);
      this.confirmationTimer = null;
    }

    // NetInfo is the authority for reachability. Avoid turning a health-check
    // failure into an offline state when the device still has internet access.
    if (!this.currentState.isOnline) {
      return null;
    }

    this.isPinging = true;
    const startTime = Date.now();
    const requestEpoch = this.connectionEpoch;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Probe the public backend health check (/api/health);
    // /auth/identify is an account lookup endpoint that requires auth parameters.
    const pingUrl = `${API_SERVER_ROOT}/api/health`;

    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller.abort();
      }, PING_TIMEOUT_MS);

      // The server root responds to GET; HEAD may return a misleading 404.
      const response = await fetch(pingUrl, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });

      const latency = Date.now() - startTime;
      if (!response.ok) {
        // A backend health error is a server problem, not evidence of a weak link.
        this.consecutiveSlowProbes = 0;
        this.consecutiveFastProbes = 0;
        if (requestEpoch === this.connectionEpoch && this.currentState.isOnline) {
          this.updateState({
            latencyMs: null,
            isSlowNetwork: false,
            status: "ONLINE",
            lastCheckedAt: Date.now(),
          });
        }
        return null;
      }

      this.applyLatencySample(latency, requestEpoch);

      return latency;
    } catch (err: any) {
      // AbortController timeout or network error indicates offline or extremely slow
      const isTimeout =
        err?.name === "AbortError" ||
        /abort|timed? ?out|timeout/i.test(String(err?.message || ""));

      if (isTimeout && requestEpoch === this.connectionEpoch) {
        // A single delayed probe may be a server hiccup. Require confirmation.
        this.applyLatencySample(PING_TIMEOUT_MS, requestEpoch);
        return PING_TIMEOUT_MS;
      }

      // A failed health endpoint is not proof that the device lost internet.
      return null;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      this.isPinging = false;
      if (requestEpoch !== this.connectionEpoch && this.currentState.isOnline) {
        setTimeout(() => {
          if (AppState.currentState === "active") this.measureLatency();
        }, 0);
      }
    }
  }

  private applyLatencySample(latencyMs: number, requestEpoch: number) {
    if (requestEpoch !== this.connectionEpoch || !this.currentState.isOnline) {
      return;
    }

    const isSlowSample = latencyMs > SLOW_LATENCY_THRESHOLD_MS;
    if (isSlowSample) {
      this.consecutiveSlowProbes += 1;
      this.consecutiveFastProbes = 0;
    } else {
      this.consecutiveFastProbes += 1;
      this.consecutiveSlowProbes = 0;
    }

    const isConfirmedSlow = isSlowSample
      ? this.currentState.isSlowNetwork || this.consecutiveSlowProbes >= 2
      : this.currentState.isSlowNetwork && this.consecutiveFastProbes < 2;

    this.updateState({
      latencyMs,
      isOnline: true,
      isSlowNetwork: isConfirmedSlow,
      status: isConfirmedSlow ? "SLOW" : "ONLINE",
      lastCheckedAt: Date.now(),
    });

    if (
      isSlowSample &&
      !isConfirmedSlow &&
      !this.confirmationTimer &&
      this.currentState.isOnline
    ) {
      this.confirmationTimer = setTimeout(() => {
        this.confirmationTimer = null;
        this.measureLatency();
      }, SLOW_CONFIRMATION_DELAY_MS);
    }
  }

  /**
   * Helper that API interceptor or caller can use to report a network timeout/failure.
   * Request timeouts can come from slow server work while the connection is
   * healthy, so use the health probe as the source of truth instead of marking
   * every failed business request as a poor network.
   */
  public reportRequestFailure(error: any) {
    const message = String(error?.message || "");
    const isNetworkError =
      error?.code === "ECONNABORTED" ||
      error?.code === "ETIMEDOUT" ||
      /network error|timed? ?out|timeout/i.test(message);

    if (isNetworkError) {
      // The ping will set ONLINE, SLOW, or OFFLINE based on actual reachability.
      this.measureLatency();
    }
  }

  public reportRequestSuccess(durationMs?: number) {
    // A successful round trip under one second is strong evidence that the
    // connection has recovered; slower business requests may include server work.
    if (
      this.currentState.isSlowNetwork &&
      durationMs !== undefined &&
      durationMs < 1000
    ) {
      this.consecutiveSlowProbes = 0;
      this.consecutiveFastProbes = 2;
      if (this.confirmationTimer) {
        clearTimeout(this.confirmationTimer);
        this.confirmationTimer = null;
      }
      this.updateState({
        isOnline: true,
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
      this.currentState.latencyMs !== nextState.latencyMs ||
      this.currentState.connectionType !== nextState.connectionType ||
      this.currentState.cellularGeneration !== nextState.cellularGeneration;

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
    if (enabled) {
      this.updateState({
        isSimulatedOffline: true,
        isSimulatedSlow: false,
      });
      return;
    }

    this.restoreNativeNetworkState();
  }

  public simulateSlowNetwork(enabled: boolean) {
    if (enabled) {
      this.updateState({
        isSimulatedSlow: true,
        isSimulatedOffline: false,
      });
      return;
    }

    this.restoreNativeNetworkState();
  }

  public resetSimulation() {
    this.restoreNativeNetworkState();
  }

  private restoreNativeNetworkState() {
    this.connectionEpoch += 1;
    this.consecutiveSlowProbes = 0;
    this.consecutiveFastProbes = 0;
    if (this.confirmationTimer) {
      clearTimeout(this.confirmationTimer);
      this.confirmationTimer = null;
    }

    const isOnline = Boolean(
      this.lastNativeConnectivity?.connected &&
        this.lastNativeConnectivity.reachable,
    );
    this.updateState({
      isSimulatedOffline: false,
      isSimulatedSlow: false,
      isOnline,
      isSlowNetwork: false,
      status: isOnline ? "ONLINE" : "OFFLINE",
      latencyMs: null,
      lastCheckedAt: Date.now(),
    });

    NetInfo.fetch()
      .then((netState) => {
        this.handleNetInfoChange(netState);
        if (this.currentState.isOnline) this.measureLatency();
      })
      .catch(() => {
        // Keep the last native reachability result if a refresh is unavailable.
      });
  }

  public destroy() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    if (this.confirmationTimer) {
      clearTimeout(this.confirmationTimer);
    }
    this.listeners.clear();
  }
}

export const networkMonitor = new NetworkMonitor();
