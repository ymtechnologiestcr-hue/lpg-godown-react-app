import AsyncStorage from "@react-native-async-storage/async-storage";

export type OfflineActionType =
  | "CONFIRM_DELIVERY"
  | "CREATE_SALE"
  | "CREATE_RETURN"
  | "UPLOAD_FILE"
  | "GENERIC_MUTATION";

export type OfflineActionStatus = "PENDING" | "SYNCING" | "FAILED" | "COMPLETED";

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: any;
  uploadData?: {
    fileUri: string;
    fieldName?: string;
    filename?: string;
    mimeType?: string;
    extraFields?: Record<string, string>;
  };
  metadata: {
    title: string;
    subtitle?: string;
    customerName?: string;
    saleId?: number;
    amount?: number;
    emptyCylinderQty?: number;
    quantity?: number;
    createdAt: string;
    driverId?: number;
  };
  status: OfflineActionStatus;
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: string;
  errorMessage?: string;
  createdAt: string;
}

const STORAGE_KEY = "@lpg_driver_offline_actions_v1";
const DEFAULT_MAX_RETRIES = 5;

type QueueListener = (queue: OfflineAction[]) => void;

class OfflineQueueManager {
  private inMemoryQueue: OfflineAction[] = [];
  private isLoaded = false;
  private listeners: Set<QueueListener> = new Set();
  private loadPromise: Promise<OfflineAction[]> | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private async loadFromStorage(): Promise<OfflineAction[]> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            // Reset any item stuck in SYNCING from a previous killed session back to PENDING
            this.inMemoryQueue = parsed.map((item) =>
              item.status === "SYNCING" ? { ...item, status: "PENDING" } : item,
            );
          } else {
            this.inMemoryQueue = [];
          }
        } else {
          this.inMemoryQueue = [];
        }
      } catch (err) {
        console.error("Failed to load offline actions from storage:", err);
        this.inMemoryQueue = [];
      } finally {
        this.isLoaded = true;
        this.notifyListeners();
      }
      return this.inMemoryQueue;
    })();

    return this.loadPromise;
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.inMemoryQueue));
    } catch (err) {
      console.error("Failed to persist offline actions:", err);
    }
    this.notifyListeners();
  }

  public async getQueue(): Promise<OfflineAction[]> {
    if (!this.isLoaded) {
      await this.loadFromStorage();
    }
    return [...this.inMemoryQueue];
  }

  public async getPendingActions(): Promise<OfflineAction[]> {
    const queue = await this.getQueue();
    return queue.filter(
      (a) => a.status === "PENDING" || (a.status === "FAILED" && a.retryCount < a.maxRetries),
    );
  }

  public async getPendingCount(): Promise<number> {
    const pending = await this.getPendingActions();
    return pending.length;
  }

  public async getFailedCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter((a) => a.status === "FAILED").length;
  }

  /**
   * Enqueue a new offline action with deduplication
   */
  public async enqueue(actionInput: {
    type: OfflineActionType;
    endpoint: string;
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    payload: any;
    uploadData?: OfflineAction["uploadData"];
    metadata: OfflineAction["metadata"];
    maxRetries?: number;
  }): Promise<OfflineAction> {
    await this.loadFromStorage();

    const saleId = actionInput.metadata.saleId;

    // Deduplication check: If same delivery confirmation is already in the queue, update payload
    if (actionInput.type === "CONFIRM_DELIVERY" && saleId) {
      const existingIndex = this.inMemoryQueue.findIndex(
        (a) =>
          a.type === "CONFIRM_DELIVERY" &&
          a.metadata.saleId === saleId &&
          (a.status === "PENDING" || a.status === "FAILED"),
      );

      if (existingIndex >= 0) {
        const existing = this.inMemoryQueue[existingIndex];
        const updated: OfflineAction = {
          ...existing,
          payload: actionInput.payload,
          metadata: {
            ...existing.metadata,
            ...actionInput.metadata,
          },
          status: "PENDING",
          errorMessage: undefined,
        };
        this.inMemoryQueue[existingIndex] = updated;
        await this.persist();
        return updated;
      }
    }

    const newAction: OfflineAction = {
      id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type: actionInput.type,
      endpoint: actionInput.endpoint,
      method: actionInput.method,
      payload: actionInput.payload,
      uploadData: actionInput.uploadData,
      metadata: actionInput.metadata,
      status: "PENDING",
      retryCount: 0,
      maxRetries: actionInput.maxRetries ?? DEFAULT_MAX_RETRIES,
      createdAt: new Date().toISOString(),
    };

    this.inMemoryQueue.push(newAction);
    await this.persist();
    return newAction;
  }

  public async updateAction(
    id: string,
    updates: Partial<OfflineAction>,
  ): Promise<void> {
    await this.loadFromStorage();
    const index = this.inMemoryQueue.findIndex((a) => a.id === id);
    if (index >= 0) {
      this.inMemoryQueue[index] = {
        ...this.inMemoryQueue[index],
        ...updates,
      };
      await this.persist();
    }
  }

  public async removeAction(id: string): Promise<void> {
    await this.loadFromStorage();
    this.inMemoryQueue = this.inMemoryQueue.filter((a) => a.id !== id);
    await this.persist();
  }

  public async markCompleted(id: string): Promise<void> {
    await this.removeAction(id);
  }

  public async retryAction(id: string): Promise<void> {
    await this.updateAction(id, {
      status: "PENDING",
      retryCount: 0,
      errorMessage: undefined,
    });
  }

  public async retryAllFailed(): Promise<void> {
    await this.loadFromStorage();
    let hasChanges = false;
    this.inMemoryQueue = this.inMemoryQueue.map((item) => {
      if (item.status === "FAILED") {
        hasChanges = true;
        return {
          ...item,
          status: "PENDING",
          retryCount: 0,
          errorMessage: undefined,
        };
      }
      return item;
    });
    if (hasChanges) {
      await this.persist();
    }
  }

  public async clearCompleted(): Promise<void> {
    await this.loadFromStorage();
    this.inMemoryQueue = this.inMemoryQueue.filter(
      (a) => a.status === "PENDING" || a.status === "FAILED",
    );
    await this.persist();
  }

  public async clearAll(): Promise<void> {
    this.inMemoryQueue = [];
    await this.persist();
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    if (this.isLoaded) {
      listener([...this.inMemoryQueue]);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const current = [...this.inMemoryQueue];
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch (e) {
        console.error("Error notifying queue listener:", e);
      }
    }
  }
}

export const offlineQueue = new OfflineQueueManager();

