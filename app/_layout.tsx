import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, Stack, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ToastManager from "../src/components/common/ToastManager";
import { APP_ROLES, AppRole } from "../src/constants/appRole";
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  getHomeRouteByRole,
  isSupportedMobileRole,
} from "../src/constants/auth";
import { DateRangeProvider } from "../src/context/DateRangeContext";

type SessionUser = {
  role: AppRole;
};

export default function RootLayout() {
  const segments = useSegments();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        const userText = await AsyncStorage.getItem(AUTH_USER_KEY);

        if (!token || !userText) {
          setIsAuthenticated(false);
          setRole(null);
          return;
        }

        const user = JSON.parse(userText) as SessionUser;

        if (!user?.role || !isSupportedMobileRole(user.role)) {
          await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
          setIsAuthenticated(false);
          setRole(null);
          return;
        }

        setIsAuthenticated(true);
        setRole(user.role);
      } catch {
        setIsAuthenticated(false);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const inLogin = segments[0] === "login";
  const inWelcome = segments[0] === "welcome";
  const isAtRoot =
    !segments[0] ||
    ((segments[0] as string) === "(tabs)" &&
      (!segments[1] || (segments[1] as string) === "index"));

  if (loading) {
    return (
      <SafeAreaProvider>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator />
        </View>
      </SafeAreaProvider>
    );
  }

  if (!isAuthenticated && !inLogin && !inWelcome) {
    return <Redirect href="/welcome" />;
  }

  if (isAuthenticated && role) {
    if (inLogin || inWelcome) {
      return <Redirect href={getHomeRouteByRole(role) as any} />;
    }
    if (isAtRoot && role !== APP_ROLES.DRIVER) {
      return <Redirect href={getHomeRouteByRole(role) as any} />;
    }
  }

  return (
    <SafeAreaProvider>
      <DateRangeProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <ToastManager />
      </DateRangeProvider>
    </SafeAreaProvider>
  );
}
