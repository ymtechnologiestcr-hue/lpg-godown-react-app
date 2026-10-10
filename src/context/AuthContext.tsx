import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { APP_ROLE_KEY, AppRole } from '../constants/appRole';
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  AuthUser,
  isSupportedMobileRole,
} from '../constants/auth';

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  role: AppRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const storedUserText = await AsyncStorage.getItem(AUTH_USER_KEY);

      if (!storedToken || !storedUserText) {
        setToken(null);
        setUser(null);
        setRole(null);
        setIsAuthenticated(false);
        return;
      }

      const parsedUser = JSON.parse(storedUserText) as AuthUser;
      if (!parsedUser?.role || !isSupportedMobileRole(parsedUser.role)) {
        await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY, APP_ROLE_KEY]);
        setToken(null);
        setUser(null);
        setRole(null);
        setIsAuthenticated(false);
        return;
      }

      setToken(storedToken);
      setUser(parsedUser);
      setRole(parsedUser.role);
      setIsAuthenticated(true);
    } catch {
      setToken(null);
      setUser(null);
      setRole(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (newToken: string, newUser: AuthUser) => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    await AsyncStorage.setItem(APP_ROLE_KEY, newUser.role);

    setToken(newToken);
    setUser(newUser);
    setRole(newUser.role);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY, APP_ROLE_KEY]);
    setToken(null);
    setUser(null);
    setRole(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role,
        isAuthenticated,
        isLoading,
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
