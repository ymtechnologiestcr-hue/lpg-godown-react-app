import AsyncStorage from "@react-native-async-storage/async-storage";
import { showToast } from "../../components/common/ToastManager";
import { AUTH_TOKEN_KEY } from "../../constants/auth";
import api, { API_BASE_URL } from "../api";
import { networkMonitor } from "../network/networkMonitor";
import { offlineQueue, OfflineAction } from "./offlineQueue";

export type SyncResult = {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  remainingPending: number;
};

type SyncListener = (isSyncing: boolean, lastResult?: SyncResult) => void;
type RefreshCallback = () => void;

class SyncEngine {
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private onSyncCompleteCallbacks: Set<RefreshCallback> = new Set();
  private autoSyncCooldown = false;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Subscribe to network monitor to trigger auto-sync on recovery
    networkMonitor.subscribe((state) => {
      if (state.isOnline && !state.isSlowNetwork && !state.isSimulatedOffline) {
        // Debounce auto-sync to avoid flapping
        if (!this.autoSyncCooldown) {
          this.autoSyncCooldown = true;
          setTimeout(() => {
            this.autoSyncCooldown = false;
            this.syncPendingActions();
          }, 1500);
        }
      }
    });
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.isSyncing);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onSyncComplete(cb: RefreshCallback): () => void {
    this.onSyncCompleteCallbacks.add(cb);
    return () => {
      this.onSyncCompleteCallbacks.delete(cb);
    };
  }

  private setSyncing(syncing: boolean, result?: SyncResult) {
    this.isSyncing = syncing;
    for (const listener of this.listeners) {
      try {
        listener(syncing, result);
      } catch (e) {
        console.error("Error in sync listener:", e);
      }
    }
  }

  private notifyComplete() {
    for (const cb of this.onSyncCompleteCallbacks) {
      try {
        cb();
      } catch (e) {
        console.error("Error in onSyncComplete callback:", e);
      }
    }
  }

  /**
   * Process all pending offline actions in FIFO order
   */
  public async syncPendingActions(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        remainingPending: await offlineQueue.getPendingCount(),
      };
    }

    const networkState = networkMonitor.getState();
    if (!networkState.isOnline || networkState.isSimulatedOffline) {
      return {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        remainingPending: await offlineQueue.getPendingCount(),
      };
    }

    const pendingActions = await offlineQueue.getPendingActions();
    if (pendingActions.length === 0) {
      return {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        remainingPending: 0,
      };
    }

    this.setSyncing(true);

    let successCount = 0;
    let failureCount = 0;

    try {
      for (const action of pendingActions) {
        // Check if network died mid-sync
        const currentNet = networkMonitor.getState();
        if (!currentNet.isOnline || currentNet.isSimulatedOffline) {
          break;
        }

        await offlineQueue.updateAction(action.id, {
          status: "SYNCING",
          lastAttemptAt: new Date().toISOString(),
        });

        const success = await this.executeAction(action);

        if (success) {
          successCount++;
          await offlineQueue.markCompleted(action.id);
        } else {
          failureCount++;
          const newRetryCount = action.retryCount + 1;
          const isMaxExceeded = newRetryCount >= action.maxRetries;

          await offlineQueue.updateAction(action.id, {
            status: isMaxExceeded ? "FAILED" : "PENDING",
            retryCount: newRetryCount,
          });

          // If failure was due to network disconnection, abort loop
          const updatedNet = networkMonitor.getState();
          if (!updatedNet.isOnline) {
            break;
          }
        }
      }
    } finally {
      const remainingPending = await offlineQueue.getPendingCount();
      const result: SyncResult = {
        totalProcessed: successCount + failureCount,
        successCount,
        failureCount,
        remainingPending,
      };

      this.setSyncing(false, result);

      if (successCount > 0) {
        showToast(
          `Synced ${successCount} offline action${successCount > 1 ? "s" : ""} successfully`,
          "success",
        );
        this.notifyComplete();
      }

      return result;
    }
  }

  /**
   * Execute an individual offline action with proper error inspection & idempotency
   */
  private async executeAction(action: OfflineAction): Promise<boolean> {
    try {
      if (action.type === "UPLOAD_FILE" && action.uploadData) {
        return await this.executeFileUpload(action);
      }

      // Standard API request
      const response = await api.request({
        url: action.endpoint,
        method: action.method,
        data: action.payload,
        timeout: 25000,
      });

      if (response.status >= 200 && response.status < 300) {
        return true;
      }
      return false;
    } catch (err: any) {
      console.error(`Sync failed for action [${action.type}] ${action.endpoint}:`, err?.response?.data || err.message);

      const status = err?.response?.status;
      const responseMessage = (err?.response?.data?.message || "").toLowerCase();

      // IDEMPOTENCY HANDLING:
      // If server responds with 400/409 saying the sale is already delivered/completed,
      // it means the server actually recorded it earlier (or another concurrent request succeeded).
      // We should consider this action COMPLETED so it doesn't stay stuck forever!
      const isAlreadyCompleted =
        status === 400 || status === 409
          ? responseMessage.includes("already delivered") ||
            responseMessage.includes("already completed") ||
            responseMessage.includes("already processed") ||
            responseMessage.includes("already exists") ||
            responseMessage.includes("sale not found") // If sale was already completed and moved out
          : false;

      if (isAlreadyCompleted) {
        console.warn(`Idempotency matched for action ${action.id}: treating as completed`);
        return true;
      }

      // Check if it's a network error/timeout
      const isNetworkError =
        !err.response ||
        err.code === "ECONNABORTED" ||
        err.message?.includes("Network Error") ||
        err.message?.includes("timeout");

      if (isNetworkError) {
        networkMonitor.reportRequestFailure(err);
      }

      await offlineQueue.updateAction(action.id, {
        errorMessage: err?.response?.data?.message || err.message || "Request failed",
      });

      return false;
    }
  }

  /**
   * Handle multipart file uploads when syncing (e.g. proof of delivery or invoice photo)
   */
  private async executeFileUpload(action: OfflineAction): Promise<boolean> {
    const upload = action.uploadData;
    if (!upload || !upload.fileUri) return false;

    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const formData = new FormData();

      const filename = upload.filename || upload.fileUri.split("/").pop() || "upload.jpg";
      const mimeType = upload.mimeType || "image/jpeg";
      const fieldName = upload.fieldName || "file";

      formData.append(fieldName, {
        uri: upload.fileUri,
        name: filename,
        type: mimeType,
      } as any);

      if (upload.extraFields) {
        for (const [key, val] of Object.entries(upload.extraFields)) {
          formData.append(key, val);
        }
      }

      const fullUrl = action.endpoint.startsWith("http")
        ? action.endpoint
        : `${API_BASE_URL}${action.endpoint.startsWith("/") ? "" : "/"}${action.endpoint}`;

      const res = await fetch(fullUrl, {
        method: action.method || "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`Upload failed with status ${res.status}: ${errorText}`);
      }

      return true;
    } catch (e: any) {
      console.error("File upload sync error:", e);
      await offlineQueue.updateAction(action.id, {
        errorMessage: e.message || "File upload failed",
      });
      return false;
    }
  }
}

export const syncEngine = new SyncEngine();

