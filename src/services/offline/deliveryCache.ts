import AsyncStorage from "@react-native-async-storage/async-storage";
import { DriverDeliveriesResponse, DriverDeliveryItem } from "../../types";
import { OfflineAction } from "./offlineQueue";

const CACHE_KEY_PREFIX = "@lpg_driver_deliveries_cache_";
const BATCHES_CACHE_KEY_PREFIX = "@lpg_driver_batches_cache_";
const CUSTOMERS_CACHE_KEY_PREFIX = "@lpg_cached_customers_agency_";
const LEGACY_CUSTOMERS_CACHE_KEY = "@lpg_cached_customers_v1";

export type CachedDeliveryItem = DriverDeliveryItem & {
  isOfflineQueued?: boolean;
};

export type CachedDeliveriesResponse = Omit<DriverDeliveriesResponse, "deliveries"> & {
  deliveries: CachedDeliveryItem[];
  isFromCache?: boolean;
  cachedAt?: string;
};

export interface CachedCustomer {
  id: number;
  name: string;
  phone: string;
  address?: string;
  consumerNumber?: string;
  productType?: string;
  quantity?: number;
  agencyId?: number;
  lastUsedAt: number;
}

class DeliveryCacheManager {
  /**
   * Save fresh deliveries fetched from server to local cache
   */
  public async saveDeliveries(
    driverId: number,
    data: DriverDeliveriesResponse,
  ): Promise<void> {
    try {
      const payload: CachedDeliveriesResponse = {
        ...data,
        isFromCache: true,
        cachedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        `${CACHE_KEY_PREFIX}${driverId}`,
        JSON.stringify(payload),
      );
    } catch (err) {
      console.error("Failed to cache deliveries:", err);
    }
  }

  /**
   * Retrieve cached deliveries for driver
   */
  public async getCachedDeliveries(
    driverId: number,
  ): Promise<CachedDeliveriesResponse | null> {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${driverId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.error("Failed to read cached deliveries:", err);
      return null;
    }
  }

  /**
   * Overlay any pending offline queue actions over the delivery list.
   * This ensures that if the driver is looking at cached data or if the server
   * hasn't received the synced updates yet, the UI correctly reflects the driver's work.
   */
  public mergePendingActions(
    base: CachedDeliveriesResponse,
    pendingActions: OfflineAction[],
  ): CachedDeliveriesResponse {
    if (!base || !base.deliveries) return base;

    const deliveries = [...base.deliveries];
    const stats = { ...(base.stats || { allocated: 0, delivered: 0, empties: 0, inHand: 0, pendingCollection: 0, newDelivery: 0 }) };

    for (const action of pendingActions) {
      if (action.type === "CONFIRM_DELIVERY" && action.metadata.saleId) {
        const saleId = action.metadata.saleId;
        const index = deliveries.findIndex((d) => d.saleId === saleId);

        if (index >= 0) {
          const original = deliveries[index];
          if (original.status !== "Delivered") {
            stats.delivered = (stats.delivered || 0) + 1;
            stats.empties = (stats.empties || 0) + (action.metadata.emptyCylinderQty || 0);
            stats.inHand = Math.max(0, (stats.inHand || 0) - (original.quantity || 1));
          }

          deliveries[index] = {
            ...original,
            rawStatus: "DELIVERED",
            status: "Delivered",
            showMarkDelivered: false,
            paymentMode: action.payload?.payment_method || original.paymentMode,
            deliveredAt: action.metadata.createdAt || new Date().toISOString(),
            isOfflineQueued: true,
          };
        }
      } else if (action.type === "CREATE_SALE") {
        // Optimistic spot sale
        const existingSpotIndex = deliveries.findIndex(
          (d) => d.saleId === action.metadata.saleId,
        );

        const saleItem: CachedDeliveryItem = {
          saleId: action.metadata.saleId || -Date.now(),
          customerName: action.metadata.customerName || "Customer",
          consumerNumber: null,
          address: action.payload?.address || "Delivery Address",
          product: action.payload?.cylinder_type || "Domestic",
          quantity: Number(action.payload?.quantity || 1),
          rawStatus: "DELIVERED",
          status: "Delivered",
          totalAmount: Number(action.metadata.amount || 0),
          createdAt: action.metadata.createdAt || new Date().toISOString(),
          deliveredAt: action.metadata.createdAt || new Date().toISOString(),
          paymentMode: action.payload?.payment_method || "CASH",
          cylinderType: action.payload?.cylinder_type || "DOMESTIC",
          showMarkDelivered: false,
          isOfflineQueued: true,
        };

        if (existingSpotIndex >= 0) {
          deliveries[existingSpotIndex] = saleItem;
        } else {
          deliveries.unshift(saleItem);
          stats.allocated = (stats.allocated || 0) + saleItem.quantity;
          stats.delivered = (stats.delivered || 0) + saleItem.quantity;
          stats.empties = (stats.empties || 0) + Number(action.payload?.empty_cylinder_qty || 0);
        }
      }
    }

    return {
      ...base,
      deliveries,
      stats,
    };
  }

  /**
   * Apply an optimistic delivery confirmation immediately to local cache
   */
  public async applyOptimisticDelivery(
    driverId: number,
    saleId: number,
    payload: {
      payment_method: string;
      empty_cylinder_qty: number;
    },
  ): Promise<CachedDeliveriesResponse | null> {
    const cached = await this.getCachedDeliveries(driverId);
    if (!cached || !cached.deliveries) return null;

    const index = cached.deliveries.findIndex((d) => d.saleId === saleId);
    if (index === -1) return cached;

    const item = cached.deliveries[index];
    const updatedDeliveries = [...cached.deliveries];

    updatedDeliveries[index] = {
      ...item,
      rawStatus: "DELIVERED",
      status: "Delivered",
      showMarkDelivered: false,
      paymentMode: payload.payment_method,
      deliveredAt: new Date().toISOString(),
      isOfflineQueued: true,
    };

    const stats = { ...(cached.stats || {}) };
    stats.delivered = (Number(stats.delivered) || 0) + 1;
    stats.empties = (Number(stats.empties) || 0) + Number(payload.empty_cylinder_qty || 0);
    stats.inHand = Math.max(0, (Number(stats.inHand) || 0) - (item.quantity || 1));

    const updatedResponse: CachedDeliveriesResponse = {
      ...cached,
      deliveries: updatedDeliveries,
      stats: stats as any,
      cachedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(
      `${CACHE_KEY_PREFIX}${driverId}`,
      JSON.stringify(updatedResponse),
    );

    return updatedResponse;
  }

  /**
   * Cache available batch allocations for offline batch selection
   */
  public async saveBatches(driverId: number, batches: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${BATCHES_CACHE_KEY_PREFIX}${driverId}`,
        JSON.stringify(batches),
      );
    } catch (e) {
      console.error("Failed to cache batches:", e);
    }
  }

  public async getCachedBatches(driverId: number): Promise<any[]> {
    try {
      const raw = await AsyncStorage.getItem(`${BATCHES_CACHE_KEY_PREFIX}${driverId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Optimistically decrement pending cylinders from the local batch cache
   * so the next sale performed immediately has the accurate count.
   */
  public async decrementBatchPending(
    driverId: number,
    allocationSalesItemId: number,
    quantity: number,
  ): Promise<void> {
    try {
      const batches = await this.getCachedBatches(driverId);
      if (!batches || !batches.length) return;
      const updated = batches
        .map((b) => {
          if (b.allocationSalesItemId === allocationSalesItemId) {
            const newPending = Math.max(0, (b.pending || 0) - quantity);
            const newDelivered = (b.delivered || 0) + quantity;
            return { ...b, pending: newPending, delivered: newDelivered };
          }
          return b;
        })
        .filter((b) => b.pending > 0);
      await this.saveBatches(driverId, updated);
    } catch (e) {
      console.warn("decrementBatchPending error:", e);
    }
  }

  /**
   * Cache customer profiles so driver can search even while offline.
   * Scoped strictly per agency to prevent cross-agency customer leakage.
   */
  public async cacheCustomer(
    customer: {
      id: number;
      name: string;
      phone: string;
      address?: string;
      consumerNumber?: string;
      productType?: string;
      quantity?: number;
      agencyId?: number;
    },
    agencyId?: number,
  ): Promise<void> {
    try {
      const targetAgencyId = agencyId || customer.agencyId;
      if (!targetAgencyId) return;

      const cacheKey = `${CUSTOMERS_CACHE_KEY_PREFIX}${targetAgencyId}`;
      const existing = await this.getCachedCustomers(targetAgencyId);
      const filtered = existing.filter((c) => c.id !== customer.id && c.phone !== customer.phone);
      const updated: CachedCustomer[] = [
        { ...customer, agencyId: targetAgencyId, lastUsedAt: Date.now() },
        ...filtered,
      ].slice(0, 100);

      await AsyncStorage.setItem(cacheKey, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to cache customer:", e);
    }
  }

  public async getCachedCustomers(agencyId?: number): Promise<CachedCustomer[]> {
    try {
      // One-time silent purge of legacy un-scoped cache
      AsyncStorage.removeItem(LEGACY_CUSTOMERS_CACHE_KEY).catch(() => {});

      if (!agencyId) return [];
      const raw = await AsyncStorage.getItem(`${CUSTOMERS_CACHE_KEY_PREFIX}${agencyId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public async findCachedCustomer(query: string, agencyId?: number): Promise<CachedCustomer | null> {
    const q = query.trim().toLowerCase();
    if (!q || !agencyId) return null;
    const customers = await this.getCachedCustomers(agencyId);
    return (
      customers.find(
        (c) =>
          c.phone?.toLowerCase().includes(q) ||
          c.consumerNumber?.toLowerCase().includes(q) ||
          c.name?.toLowerCase().includes(q),
      ) || null
    );
  }

  public async clearCustomerCache(agencyId?: number): Promise<void> {
    try {
      if (agencyId) {
        await AsyncStorage.removeItem(`${CUSTOMERS_CACHE_KEY_PREFIX}${agencyId}`);
      }
      await AsyncStorage.removeItem(LEGACY_CUSTOMERS_CACHE_KEY);
    } catch (e) {
      console.error("Failed to clear customer cache:", e);
    }
  }
}

export const deliveryCache = new DeliveryCacheManager();

