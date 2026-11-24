import AsyncStorage from "@react-native-async-storage/async-storage";
import { AUTH_TOKEN_KEY } from "../../constants/auth";

export const DATE_RANGE_STORAGE_KEY = "global_date_range";

export type StoredDateRange = {
  startDate: string;
  endDate: string;
};

let authTokenCache: string | null = null;
let hasLoadedAuthToken = false;
let authTokenRead: Promise<string | null> | null = null;

let dateRangeCache: StoredDateRange | null = null;
let hasLoadedDateRange = false;
let dateRangeRead: Promise<StoredDateRange | null> | null = null;

export const getCachedAuthToken = async (): Promise<string | null> => {
  if (hasLoadedAuthToken) return authTokenCache;

  if (!authTokenRead) {
    authTokenRead = AsyncStorage.getItem(AUTH_TOKEN_KEY)
      .then((storedToken) => {
        if (!hasLoadedAuthToken) {
          authTokenCache = storedToken;
          hasLoadedAuthToken = true;
        }
        return authTokenCache;
      })
      .catch(() => null)
      .finally(() => {
        authTokenRead = null;
      });
  }

  return authTokenRead;
};

export const setCachedAuthToken = (token: string | null) => {
  authTokenCache = token;
  hasLoadedAuthToken = true;
  authTokenRead = null;
};

const normalizeDateRange = (value: unknown): StoredDateRange | null => {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<StoredDateRange>;
  const startDate = String(candidate.startDate || "");
  const endDate = String(candidate.endDate || "");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
  ) {
    return null;
  }

  return startDate <= endDate
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate };
};

export const getCachedDateRange = async (): Promise<StoredDateRange | null> => {
  if (hasLoadedDateRange) return dateRangeCache;

  if (!dateRangeRead) {
    dateRangeRead = AsyncStorage.getItem(DATE_RANGE_STORAGE_KEY)
      .then((raw) => {
        if (!hasLoadedDateRange) {
          try {
            dateRangeCache = raw ? normalizeDateRange(JSON.parse(raw)) : null;
          } catch {
            dateRangeCache = null;
          }
          hasLoadedDateRange = true;
        }
        return dateRangeCache;
      })
      .catch(() => null)
      .finally(() => {
        dateRangeRead = null;
      });
  }

  return dateRangeRead;
};

export const setCachedDateRange = async (range: StoredDateRange) => {
  const normalized = normalizeDateRange(range);
  if (!normalized) return;

  dateRangeCache = normalized;
  hasLoadedDateRange = true;
  dateRangeRead = null;

  await AsyncStorage.setItem(
    DATE_RANGE_STORAGE_KEY,
    JSON.stringify(normalized),
  );
};
