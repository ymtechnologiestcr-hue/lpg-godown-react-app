export type DriverStats = {
  // Total the driver is holding for the period: freshly allocated plus any
  // cylinders carried forward from previous days.
  allocated: number;
  allocatedToday?: number;
  carriedForward?: number;
  delivered: number;
  pendingCollection: number;
  empties: number;
  emptiesOriginal?: number;
  inHand: number;
  inHandOriginal?: number;
  systemStock?: number;
  newDelivery: number;
};

export type DriverDeliveryItem = {
  saleId: number;
  customerName: string;
  consumerNumber?: string | null;
  address: string;
  product: string;
  quantity: number;
  rawStatus: 'PENDING' | 'ASSIGNED' | 'DELIVERED' | 'CANCELLED';
  status: 'Pending' | 'Delivered' | 'Cancelled';
  totalAmount: number;
  createdAt: string;
  deliveredAt?: string | null;
  paymentMode?: string;
  cylinderType?: string;
  showMarkDelivered: boolean;
};

export type DriverDeliveriesResponse = {
  flag?: string | null;
  stats: DriverStats;
  deliveries: DriverDeliveryItem[];
};

export type SettlementItem = {
  id: number;
  settlementId: number;
  customerName: string;
  amount: number;
  createdAt: string;
  method: "CASH" | "UPI";
  status: "PENDING" | "SETTLED";
};

export type CollectionSummaryResponse = {
  summary: {
    cashCollected: number;
    upiCollected: number;
    totalCollected: number;
  };
  settlements: {
    cash: {
      amount: number;
      count: number;
      transactions: SettlementItem[];
    };
    upi: {
      amount: number;
      count: number;
      transactions: SettlementItem[];
    };
  };
};

export type InHandReturnRequest = {
  id: number;
  productId: number;
  stockAreaId: number;
  quantity: number;
  productName: string;
  createdAt: string;
  isApproved: number;
};

export type InHandDefectiveRequest = {
  id: number;
  productId: number;
  stockAreaId: number;
  quantity: number;
  productName: string;
  createdAt: string;
  isApproved: number;
};

export type InHandSummaryResponse = {
  summary: {
    allocated: number;
    delivered: number;
    inHand: number;
  };

  returnRequests: InHandReturnRequest[];

  defectiveRequests: InHandDefectiveRequest[];
};
export type CollectionHistoryTransaction = {
  saleId: number;
  customerName: string;
  amount: number;
  paymentMode: string;
  deliveredAt: string;
  status: "Paid";
};

export type CollectionHistoryDayItem = {
  date: string;
  totalAmount: number;
  summary: {
    cash: {
      amount: number;
      status: "PENDING" | "SETTLED";
      settledAt: string | null;
    };
    upi: {
      amount: number;
      status: "PENDING" | "SETTLED";
      settledAt: string | null;
    };
  };
  transactions: CollectionHistoryTransaction[];
};

export type CollectionHistoryResponse = {
  items: CollectionHistoryDayItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export type EmptyCylinderCollectedItem = {
  id: number;
  customerName: string;
  productType: string;
  quantity: number;
  createdAt: string;
};

export type EmptyCylinderReturnRequestItem = {
  id: number;
  quantity: number;
  createdAt: string;
  isApproved: number;
};

export type EmptyCylindersTodayResponse = {
  summary: {
    collected: number;
    returned: number;
    inHand: number;
  };
  collectedFrom: EmptyCylinderCollectedItem[];
  returnRequests: EmptyCylinderReturnRequestItem[];
};

export type EmptyCylinderHistoryItem = {
  date: string;
  collected: number;
  returned: number;
};

export type EmptyCylindersHistoryResponse = {
  items: EmptyCylinderHistoryItem[];
};

export type DriverProfileHistoryDelivery = {
  saleId: number;
  customerName: string;
  address: string;
  cylinderType: string;
  quantity: number;
  totalAmount: number;
  paymentMode: string;
  deliveredAt: string;
};

export type DriverProfileHistoryDayItem = {
  date: string;
  totalAmount: number;
  totalDeliveries: number;
  deliveries: DriverProfileHistoryDelivery[];
};

export type DriverProfileHistoryResponse = {
  performance: {
    today: number;
    thisWeek: number;
    total: number;
  };
  items: DriverProfileHistoryDayItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export type ProductSearchItem = {
  id: number;
  name: string;
  type: 'DOMESTIC' | 'COMMERCIAL';
  price: number;
  categoryName: string;
};

export type PurchaseProduct = {
  id: number;
  name: string;
  category: string;
  type: 'DOMESTIC' | 'COMMERCIAL';
};

export type PurchaseBootstrap = {
  manager: {
    id: number;
    name: string;
    companyName?: string | null;
    phone?: string | null;
    vehicleLabel: string;
  };
  defaultStockArea: {
    id: number;
    name: string;
  } | null;
  products: {
    domestic: PurchaseProduct[];
    commercial: PurchaseProduct[];
  };
};

export type PurchaseTripSummary = {
  id: number;
  status: 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'APPROVED' | 'COMPLETED' | 'CANCELLED';
  startKm: number;
  startedAt: string;
  endedAt?: string | null;
  loadsCount: number;
  totalCylinders: number;
  expensesCount: number;
  totalExpenses: number;
};

export type PurchaseLoadItem = {
  productId: number;
  name: string;
  type: 'DOMESTIC' | 'COMMERCIAL';
  category: string;
  quantity: number;
};

export type PurchaseLoad = {
  id: number;
  tripId: number;
  productType: 'DOMESTIC' | 'COMMERCIAL' | 'MIXED';
  invoiceUrl?: string | null;
  invoiceSource?: 'CAMERA' | 'GALLERY' | null;
  invoiceNumber?: string | null;
  totalQuantity: number;
  itemsCount?: number;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'CANCELLED';
  tripStatus?: string;
  createdAt: string;
  items?: PurchaseLoadItem[];
};

export type PurchaseExpense = {
  id: number;
  tripId?: number;
  category: string;
  description?: string | null;
  amount: number;
  billUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  tripStatus?: string;
  createdAt: string;
};

export type PurchaseTripOverview = {
  id: number;
  purchaseManagerId: number;
  purchaseManagerName: string;
  stockAreaId?: number | null;
  stockAreaName?: string | null;
  odometerReading: number;
  endOdometerReading?: number | null;
  odometerImageUrl?: string | null;
  endOdometerImageUrl?: string | null;
  status: 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'APPROVED' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  endedAt?: string | null;
  loads: PurchaseLoad[];
  expenses: PurchaseExpense[];
};

export type PurchaseDashboard = {
  summary: {
    pendingLoadApproval: number;
    pendingExpenses: number;
    completedTrips: number;
  };
  activeTrip: PurchaseTripOverview | null;
  recentTrips: {
    id: number;
    loads: number;
    expenses: number;
    status: string;
    startedAt: string;
  }[];
};
export type EmptyCylinderLoadStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COMPLETED';

export type PurchaseManagerOption = {
  id: number;
  name: string;
  phone: string;
};

export type EmptyCylinderLoad = {
  id: number;
  vehicleNumber: string;
  ervNumber: string | null;
  assignedBy: string;
  status: EmptyCylinderLoadStatus;
  statusLabel: string;
  rejectReason: string | null;
  invoiceUrl: string | null;
  dispatchedAt: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  totalQuantity: number;
  domesticQuantity: number;
  commercialQuantity: number;
};

export type EmptyCylinderLoadItem = {
  productId: number;
  name: string;
  category: string;
  categoryName: string;
  quantity: number;
};

export type EmptyCylinderLoadDetail = EmptyCylinderLoad & {
  purchaseManager: string;
  domesticItems: EmptyCylinderLoadItem[];
  commercialItems: EmptyCylinderLoadItem[];
};
