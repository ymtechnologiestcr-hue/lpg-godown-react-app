import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { APP_ROLE_KEY, AppRole } from '../constants/appRole';
import {
  AGENCY_NAME_KEY,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  AuthUser,
  isSupportedMobileRole,
} from '../constants/auth';
import { fetchUserSettings } from '../services/authService';

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  role: AppRole | null;
  agencyName: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSplashCompleted: boolean;
  setSplashCompleted: (completed: boolean) => void;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSplashCompleted, setSplashCompleted] = useState<boolean>(false);

  const checkAuth = async () => {
    try {
      const [storedToken, storedUserText, storedAgency] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(AUTH_USER_KEY),
        AsyncStorage.getItem(AGENCY_NAME_KEY),
      ]);

      if (!storedToken || !storedUserText) {
        setToken(null);
        setUser(null);
        setRole(null);
        setAgencyName(storedAgency || null);
        setIsAuthenticated(false);
        return;
      }

      const parsedUser = JSON.parse(storedUserText) as AuthUser;
      if (!parsedUser?.role || !isSupportedMobileRole(parsedUser.role)) {
        await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY, APP_ROLE_KEY, AGENCY_NAME_KEY]);
        setToken(null);
        setUser(null);
        setRole(null);
        setAgencyName(null);
        setIsAuthenticated(false);
        return;
      }

      const currentAgency =
        parsedUser.agency_name ||
        parsedUser.company_name ||
        storedAgency ||
        null;

      setToken(storedToken);
      setUser(parsedUser);
      setRole(parsedUser.role);
      setAgencyName(currentAgency);
      setIsAuthenticated(true);

      // If agency name is missing from cached user, fetch in background
      if (!currentAgency && parsedUser.id) {
        fetchUserSettings(parsedUser.id)
          .then((res) => {
            if (res?.success && res?.data) {
              const fetched = res.data.agency_name || res.data.company_name;
              if (fetched) {
                setAgencyName(fetched);
                AsyncStorage.setItem(AGENCY_NAME_KEY, fetched);
                const updated = { ...parsedUser, agency_name: fetched };
                AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
                setUser(updated);
              }
            }
          })
          .catch(() => {
            // Ignore background sync errors
          });
      }
    } catch {
      setToken(null);
      setUser(null);
      setRole(null);
      setAgencyName(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (newToken: string, newUser: AuthUser) => {
    const agency = newUser.agency_name || newUser.company_name || null;
    const items: [string, string][] = [
      [AUTH_TOKEN_KEY, newToken],
      [AUTH_USER_KEY, JSON.stringify(newUser)],
      [APP_ROLE_KEY, newUser.role],
    ];
    if (agency) {
      items.push([AGENCY_NAME_KEY, agency]);
    }

    await AsyncStorage.multiSet(items);

    setToken(newToken);
    setUser(newUser);
    setRole(newUser.role);
    setAgencyName(agency);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY, APP_ROLE_KEY, AGENCY_NAME_KEY]);
    setToken(null);
    setUser(null);
    setRole(null);
    setAgencyName(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role,
        agencyName,
        isAuthenticated,
        isLoading,
        isSplashCompleted,
        setSplashCompleted,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
