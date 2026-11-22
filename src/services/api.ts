import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "axios";
import { showToast } from "../components/common/ToastManager";
import { AUTH_TOKEN_KEY } from "../constants/auth";
import { DATE_RANGE_STORAGE_KEY } from "../context/DateRangeContext";
import { API_BASE_URL } from "./apiConfig";
import { globalLoader } from "./loader/globalLoaderService";
import { networkMonitor } from "./network/networkMonitor";
import {
  expireAuthSession,
  isAuthSessionExpired,
} from "./authSession";

export { API_BASE_URL, API_SERVER_ROOT } from "./apiConfig";

export const isRequestCancellation = (error: any) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

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
  // Driver mutations can take longer than 10s while the server commits the
  // sale, updates stock, and records payment. A short timeout turns a slow
  // response into an unsafe offline replay even when the request succeeded.
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const url = String(config.url || "");
  if (isAuthSessionExpired() && !url.includes("/auth/")) {
    throw new Error("Auth session expired. Request cancelled.");
  }

  // Start global loader unless explicitly bypassed
  const skipLoader = (config as any)?.skipGlobalLoader;
  if (!skipLoader) {
    (config as any)._stopLoader = globalLoader.startRequest({
      message: (config as any)?.loaderMessage,
      blocking: (config as any)?.blockingLoader,
    });
  }

  let token: string | null = null;

  try {
    token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    // On cold app launches, AsyncStorage might take a few moments to resolve.
    // Retry up to 2 times (total ~300ms) before giving up and canceling.
    if (!token && !isAuthSessionExpired() && !url.includes("/auth/")) {
      await new Promise((r) => setTimeout(r, 120));
      token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        await new Promise((r) => setTimeout(r, 180));
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }
    }
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
    // Stop global loader for this request
    if (typeof (response.config as any)?._stopLoader === "function") {
      (response.config as any)._stopLoader();
    }

    const url = String(response.config?.url || "");
    if (!url.includes("/auth/") && isTokenExpiryMessage(response.data)) {
      await expireAuthSession();
      return Promise.reject(
        new Error(response.data?.message || "Auth session expired."),
      );
    }

    const startTime = (response.config as any)?._requestStartTime;
    if (startTime) networkMonitor.reportRequestSuccess(Date.now() - startTime);

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
    // Stop global loader for this request
    if (typeof (error.config as any)?._stopLoader === "function") {
      (error.config as any)._stopLoader();
    }

    if (isRequestCancellation(error)) {
      return Promise.reject(error);
    }

    // User/navigation cancellation is not evidence of a bad connection.
    networkMonitor.reportRequestFailure(error);

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

    // Only expire auth session when explicitly 401 Unauthorized or confirmed token expiry
    if (
      isProtectedApiFailure &&
      (error.response?.status === 401 || isTokenExpired)
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
