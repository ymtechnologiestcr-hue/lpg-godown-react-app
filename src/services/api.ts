import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "axios";
import { showToast } from "../components/common/ToastManager";
import { AUTH_TOKEN_KEY } from "../constants/auth";
import { DATE_RANGE_STORAGE_KEY } from "../context/DateRangeContext";
import { networkMonitor } from "./network/networkMonitor";
import {
  expireAuthSession,
  isAuthSessionExpired,
} from "./authSession";

// Production builds set EXPO_PUBLIC_API_BASE_URL (must include the /api suffix,
// e.g. https://<your-app>.up.railway.app/api). Falls back to the local machine
// IP for on-device development.
// Strip any trailing slash(es) so endpoints like `/auth/identify` never join
// into a double slash (`https://host//auth/identify`), which fails to match
// the backend routes.
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:5001/api"
).replace(/\/+$/, "");
export const API_SERVER_ROOT = API_BASE_URL.replace(/\/api\/?$/, "");

const isTokenExpiryMessage = (data: any) => {
  const responseText = [data?.message, data?.error, data?.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(?:token|jwt).{0,40}(?:expired|invalid)|(?:expired|invalid).{0,40}(?:token|jwt)|session.{0,30}expired/.test(
    responseText,
  );
};

const api = create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const url = String(config.url || "");
  if (isAuthSessionExpired() && !url.includes("/auth/")) {
    throw new Error("Auth session expired. Request cancelled.");
  }

  let token: string | null = null;

  try {
    token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error("Error retrieving token:", error);
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (!url.includes('/auth/')) {
    // If there is no token and this is not an authentication route, 
    // cancel the request before it even fires to avoid useless 401s after logout.
    throw new Error("No auth token available. Request cancelled.");
  }

  const method = String(config.method || "get").toLowerCase();

  if (
    method !== "get" ||
    (!url.includes("/drivers/") && !url.includes("/godown/"))
  ) {
    return config;
  }

  const existingStartDate = (config.params as any)?.startDate;
  const existingEndDate = (config.params as any)?.endDate;

  if (existingStartDate && existingEndDate) {
    return config;
  }

  try {
    const raw = await AsyncStorage.getItem(DATE_RANGE_STORAGE_KEY);

    if (!raw) {
      return config;
    }

    const parsed = JSON.parse(raw || "{}");
    const startDate = String(parsed?.startDate || "");
    const endDate = String(parsed?.endDate || "");

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      return config;
    }

    config.params = {
      ...(config.params || {}),
      startDate,
      endDate,
    };
  } catch {
    // keep request unchanged if storage read fails
  }

  (config as any)._requestStartTime = Date.now();
  return config;
});

api.interceptors.response.use(
  async (response) => {
    const url = String(response.config?.url || "");
    if (!url.includes("/auth/") && isTokenExpiryMessage(response.data)) {
      await expireAuthSession();
      return Promise.reject(
        new Error(response.data?.message || "Auth session expired."),
      );
    }

    const startTime = (response.config as any)?._requestStartTime;
    if (startTime) {
      const duration = Date.now() - startTime;
      networkMonitor.reportRequestSuccess(duration);
    }

    // If the response explicitly contains a success message, show it
    if (response.data && response.data.success && response.data.message) {
      // Don't show toast for GET requests unless explicitly desired, but standardizing
      // on POST/PUT/DELETE for success messages (or if the backend specifically sends a message).
      const method = String(response.config.method || "get").toLowerCase();
      if (method !== "get") {
        showToast(response.data.message, "success");
      }
    }
    return response;
  },
  async (error) => {
    // Report failure/timeout to network monitor
    networkMonitor.reportRequestFailure(error);

    if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
      return Promise.reject(error);
    }

    const isRequestTimeout =
      !error.response &&
      (error?.code === "ECONNABORTED" ||
        error?.code === "ETIMEDOUT" ||
        /timed? ?out|timeout/i.test(String(error?.message || "")));
    if (isRequestTimeout) {
      return Promise.reject(error);
    }

    const url = String(error.config?.url || "");
    const isAuthRequest = url.includes("/auth/");
    const isTokenExpired = isTokenExpiryMessage(error.response?.data);
    const isMissingToken = error?.message === "No auth token available. Request cancelled.";
    const isProtectedApiFailure =
      Boolean(error.config && !isAuthRequest) || isMissingToken;

    if (
      isProtectedApiFailure &&
      (error.response?.status === 401 ||
        isTokenExpired ||
        Boolean(error.response) ||
        isMissingToken)
    ) {
      await expireAuthSession();
      return Promise.reject(error);
    }

    // Don't show global error toast for 401 (Unauthorized) errors, 
    // especially during logout to avoid annoying popups when token is cleared.
    // 401s are usually handled by redirecting to login, or local catch blocks.
    if (error.response?.status !== 401 && error.response?.data?.message) {
      showToast(error.response.data.message, "error");
    }
    return Promise.reject(error);
  },
);

export default api;
