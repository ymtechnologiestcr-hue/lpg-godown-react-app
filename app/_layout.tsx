import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ToastManager from "../src/components/common/ToastManager";
import { APP_ROLES } from "../src/constants/appRole";
import { getHomeRouteByRole } from "../src/constants/auth";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { DateRangeProvider } from "../src/context/DateRangeContext";

function RootNavigation() {
  const segments = useSegments();
  const { isAuthenticated, role, isLoading, isSplashCompleted } = useAuth();

  const inLogin = segments[0] === "login";
  const inWelcome = segments[0] === "welcome";
  const isAtRoot =
    !segments[0] ||
    ((segments[0] as string) === "(tabs)" &&
      (!segments[1] || (segments[1] as string) === "index"));

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // While on the welcome/splash screen, ALWAYS render Stack so it can animate and navigate
  if (inWelcome) {
    return (
      <>
        <Stack screenOptions={{ headerShown: false }} />
        <ToastManager />
      </>
    );
  }

  // 1. Initial app start: if splash has not completed, redirect to /welcome
  if (!isSplashCompleted) {
    return <Redirect href="/welcome" />;
  }

  // 2. After splash: unauthenticated users redirect to /login
  if (!isAuthenticated && !inLogin) {
    return <Redirect href="/login" />;
  }

  // 3. Authenticated users: redirect away from login and root to home route
  if (isAuthenticated && role) {
    if (inLogin) {
      return <Redirect href={getHomeRouteByRole(role) as any} />;
    }
    if (isAtRoot && role !== APP_ROLES.DRIVER) {
      return <Redirect href={getHomeRouteByRole(role) as any} />;
    }
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <ToastManager />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DateRangeProvider>
          <RootNavigation />
        </DateRangeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

