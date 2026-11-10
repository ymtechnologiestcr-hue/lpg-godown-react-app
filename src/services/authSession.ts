import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AGENCY_NAME_KEY,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
} from "../constants/auth";
import { APP_ROLE_KEY } from "../constants/appRole";

type SessionExpiredListener = () => void;

const listeners = new Set<SessionExpiredListener>();
let sessionExpired = false;
let expirationTask: Promise<void> | null = null;

export const isAuthSessionExpired = () => sessionExpired;

export const subscribeToSessionExpired = (
  listener: SessionExpiredListener,
) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const markAuthSessionActive = () => {
  sessionExpired = false;
  expirationTask = null;
};

export const expireAuthSession = () => {
  if (expirationTask) return expirationTask;

  sessionExpired = true;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("Failed to notify expired auth session:", error);
    }
  });

  expirationTask = AsyncStorage.multiRemove([
    AUTH_TOKEN_KEY,
    AUTH_USER_KEY,
    APP_ROLE_KEY,
    AGENCY_NAME_KEY,
  ]).then(() => undefined);

  return expirationTask;
};
