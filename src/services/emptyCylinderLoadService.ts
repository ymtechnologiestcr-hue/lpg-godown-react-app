import axios from 'axios';

import api, { API_BASE_URL } from './api';
import type {
  EmptyCylinderLoad,
  EmptyCylinderLoadDetail,
  PurchaseManagerOption,
} from '../types';

import { AUTH_TOKEN_KEY } from '../constants/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Reliable fetch wrapper for FormData uploads on React Native to bypass Axios bugs.
const fetchUpload = async (url: string, formData: FormData) => {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  const res = await fetch(`${API_BASE_URL}${url}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err: any = new Error(json?.message || "Upload failed");
    err.isAxiosError = true;
    err.response = { status: res.status, data: json };
    throw err;
  }
  return json;
};

// Upload the IOC invoice/photo and return the server-hosted URL. Mirrors the
// odometer upload but targets the supporting-document endpoint.
export const uploadEmptyLoadInvoice = async (localUri: string): Promise<string> => {
  const filename = localUri.split('/').pop() ?? 'invoice.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const mimeType = match ? `image/${match[1]}` : 'image/jpeg';

  const formData = new FormData();
  formData.append('file', { uri: localUri, name: filename, type: mimeType } as unknown as Blob);

  const res = await fetchUpload('/upload/supporting-document', formData);
  return res.url;
};

export const getPurchaseManagers = async (): Promise<PurchaseManagerOption[]> => {
  const res = await api.get<{ success: boolean; data: PurchaseManagerOption[] }>(
    '/empty-cylinder-loads/purchase-managers'
  );
  return res.data.data ?? [];
};

export const createEmptyCylinderLoad = async (payload: {
  assigned_by?: number | null;
  purchase_manager_id: number;
  vehicle_number?: string | null;
  erv_number?: string | null;
  items: { product_id: number; quantity: number }[];
}) => {
  const res = await api.post('/empty-cylinder-loads', payload);
  return res.data;
};

export const getEmptyCylinderLoads = async (params?: {
  purchaseManagerId?: number;
  status?: string;
}): Promise<EmptyCylinderLoad[]> => {
  const res = await api.get<{ success: boolean; data: EmptyCylinderLoad[] }>(
    '/empty-cylinder-loads',
    { params }
  );
  return res.data.data ?? [];
};

export const getEmptyCylinderLoadDetail = async (
  loadId: string | number
): Promise<EmptyCylinderLoadDetail> => {
  const res = await api.get<{ success: boolean; data: EmptyCylinderLoadDetail }>(
    `/empty-cylinder-loads/${loadId}`
  );
  return res.data.data;
};

export const acceptEmptyCylinderLoad = async (loadId: string | number) => {
  const res = await api.put(`/empty-cylinder-loads/${loadId}/accept`);
  return res.data;
};

export const rejectEmptyCylinderLoad = async (
  loadId: string | number,
  reason: string
) => {
  const res = await api.put(`/empty-cylinder-loads/${loadId}/reject`, { reason });
  return res.data;
};

export const completeEmptyCylinderLoad = async (
  loadId: string | number,
  invoiceUrl?: string | null
) => {
  const res = await api.put(`/empty-cylinder-loads/${loadId}/complete`, {
    invoiceUrl: invoiceUrl ?? null,
  });
  return res.data;
};
