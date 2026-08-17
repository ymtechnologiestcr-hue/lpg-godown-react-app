import axios from "axios";
import type {
  PurchaseBootstrap,
  PurchaseDashboard,
  PurchaseExpense,
  PurchaseLoad,
  PurchaseTripOverview,
  PurchaseTripSummary,
} from "../types";
import api, { API_BASE_URL } from "./api";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { AUTH_TOKEN_KEY } from "../constants/auth";

// Reliable fetch wrapper for FormData uploads on React Native to bypass Axios bugs.
const fetchUpload = async (url: string, formData: FormData) => {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  const res = await fetch(`${API_BASE_URL}${url}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // DO NOT explicitly set Content-Type; fetch will set it with the correct boundary natively.
    },
    body: formData,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    // Throw an error that mimics Axios so UI components can check error.response?.status
    const err: any = new Error(json?.message || "Upload failed");
    err.isAxiosError = true;
    err.response = { status: res.status, data: json };
    throw err;
  }

  return json;
};

// Upload a generic image file (e.g. invoice, bill) to the backend and return the server-hosted URL.
// localUri is the device-local URI returned by expo-image-picker.
export const uploadSupportingDocument = async (
  localUri: string,
): Promise<string> => {
  const filename = localUri.split("/").pop() ?? "document.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const mimeType = match ? `image/${match[1]}` : "image/jpeg";

  const formData = new FormData();

  if (Platform.OS === "web") {
    // Web requires a real Blob
    const response = await fetch(localUri);
    const blob = await response.blob();
    formData.append("image", blob, filename);
  } else {
    // Native expects this specific object shape
    formData.append("image", {
      uri: localUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);
  }

  const res = await fetchUpload("/upload/supporting-document", formData);
  return res.url;
};

export const startEmptyCylinderTrip = async (payload: {
  userId: number;
  emptyLoadId: number;
  odometerReading: number;
  odometerImageUri: string | null;
}) => {
  const formData = new FormData();

  formData.append("action", "START_EMPTY");
  formData.append("userId", String(payload.userId));
  formData.append("emptyLoadId", String(payload.emptyLoadId));
  formData.append("odometerReading", String(payload.odometerReading));

  if (payload.odometerImageUri) {
    const filename = payload.odometerImageUri.split("/").pop() ?? "odometer.jpg";
    if (Platform.OS === "web") {
      const response = await fetch(payload.odometerImageUri);
      const blob = await response.blob();
      formData.append("image", blob, filename);
    } else {
      formData.append("image", {
        uri: payload.odometerImageUri,
        name: filename,
        type: "image/jpeg",
      } as any);
    }
  }

  const res = await fetchUpload("/upload/odometer", formData);
  return res.data;
};

export const getPurchaseBootstrap = async () => {
  const res = await api.get<{ success: boolean; data: PurchaseBootstrap }>(
    "/purchase/bootstrap",
  );
  return res.data.data;
};

export const getPurchaseDashboard = async (userId: number) => {
  const res = await api.get<{ success: boolean; data: PurchaseDashboard }>(
    "/purchase/dashboard",
    { params: { userId } },
  );
  return res.data.data;
};

// --- START TRIP ---
export const startPurchaseTrip = async (payload: {
  userId: number;
  stockAreaId?: number | null;
  odometerReading: number;
  odometerImageUri: string | null;
}) => {
  const formData = new FormData();

  // ADD ACTION FLAG
  formData.append("action", "START");
  formData.append("userId", String(payload.userId));
  formData.append("odometerReading", String(payload.odometerReading));

  if (payload.stockAreaId) {
    formData.append("stockAreaId", String(payload.stockAreaId));
  }

  if (payload.odometerImageUri) {
    const filename =
      payload.odometerImageUri.split("/").pop() ?? "odometer.jpg";
    if (Platform.OS === "web") {
      const response = await fetch(payload.odometerImageUri);
      const blob = await response.blob();
      formData.append("image", blob, filename);
    } else {
      formData.append("image", {
        uri: payload.odometerImageUri,
        name: filename,
        type: "image/jpeg",
      } as any);
    }
  }

  const res = await fetchUpload("/upload/odometer", formData);
  return res.data;
};

// --- END TRIP ---
export const submitPurchaseTrip = async (payload: {
  tripId: number;
  endOdometerReading: number;
  endOdometerImageUri: string;
  invoiceUri?: string | null;
  emptyLoadId?: number | null;
}) => {
  const formData = new FormData();

  // ADD ACTION FLAG
  formData.append("action", "END");
  formData.append("tripId", String(payload.tripId));
  formData.append("odometerReading", String(payload.endOdometerReading));
  if (payload.emptyLoadId) {
    formData.append("emptyLoadId", String(payload.emptyLoadId));
  }

  // Required closing odometer photo (Field name: "image")
  const odoFilename =
    payload.endOdometerImageUri.split("/").pop() ?? "odometer.jpg";
  if (Platform.OS === "web") {
    const response = await fetch(payload.endOdometerImageUri);
    const blob = await response.blob();
    formData.append("image", blob, odoFilename);
  } else {
    formData.append("image", {
      uri: payload.endOdometerImageUri,
      name: odoFilename,
      type: "image/jpeg",
    } as any);
  }

  // Optional Invoice photo (Field name: "invoice")
  if (payload.invoiceUri) {
    const invFilename = payload.invoiceUri.split("/").pop() ?? "invoice.jpg";
    if (Platform.OS === "web") {
      const response = await fetch(payload.invoiceUri);
      const blob = await response.blob();
      formData.append("invoice", blob, invFilename);
    } else {
      formData.append("invoice", {
        uri: payload.invoiceUri,
        name: invFilename,
        type: "image/jpeg",
      } as any);
    }
  }

  const res = await fetchUpload("/upload/odometer", formData);
  return res.data;
};

export const getActivePurchaseTrip = async (userId: number) => {
  const res = await api.get<{
    success: boolean;
    data: PurchaseTripOverview | null;
  }>("/purchase/trips/active", { params: { userId } });
  return res.data.data;
};

export const getPurchaseTrips = async (userId: number) => {
  const res = await api.get<{ success: boolean; data: PurchaseTripSummary[] }>(
    "/purchase/trips",
    { params: { userId } },
  );
  return res.data.data;
};

export const getPurchaseLoads = async (userId: number) => {
  const res = await api.get<{ success: boolean; data: PurchaseLoad[] }>(
    "/purchase/loads",
    { params: { userId } },
  );
  return res.data.data;
};

export const getPurchaseLoadDetail = async (loadId: string | number) => {
  const res = await api.get<{ success: boolean; data: PurchaseLoad }>(
    `/purchase/loads/${loadId}`,
  );
  return res.data.data;
};

export const createPurchaseLoad = async (payload: {
  tripId: number;
  createdBy: number;
  stockAreaId?: number | null;
  items: { productId: number; quantity: number }[];
}) => {
  const res = await api.post<{ success: boolean; data: PurchaseLoad }>(
    "/purchase/loads",
    payload,
  );
  return res.data.data;
};

export const updatePurchaseLoad = async (
  loadId: string | number,
  payload: {
    stockAreaId?: number | null;
    items: { productId: number; quantity: number }[];
  },
) => {
  const res = await api.put<{ success: boolean; data: PurchaseLoad }>(
    `/purchase/loads/${loadId}`,
    payload,
  );
  return res.data.data;
};

export const attachPurchaseLoadInvoice = async (
  loadId: string | number,
  payload: {
    invoiceNumber?: string | null;
    invoiceUrl?: string | null;
    invoiceSource?: "CAMERA" | "GALLERY" | null;
  },
) => {
  const res = await api.put<{ success: boolean; data: PurchaseLoad }>(
    `/purchase/loads/${loadId}/invoice`,
    payload,
  );
  return res.data.data;
};

export const cancelPurchaseLoad = async (loadId: string | number) => {
  const res = await api.put(`/purchase/loads/${loadId}/cancel`);
  return res.data;
};

export const getPurchaseExpenses = async (userId: number) => {
  const res = await api.get<{ success: boolean; data: PurchaseExpense[] }>(
    "/purchase/expenses",
    { params: { userId } },
  );
  return res.data.data;
};

export const createPurchaseExpense = async (payload: {
  category: string;
  description?: string | null;
  amount: number;
  createdBy: number;
  billUrl: string | null;
}) => {
  const res = await api.post<{ success: boolean; data: PurchaseExpense }>(
    "/expenses",
    payload,
  );
  return res.data.data;
};


