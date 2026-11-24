import { Redirect, Stack, useSegments } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import GlobalLoader from "../src/components/common/GlobalLoader";
import NetworkBanner from "../src/components/common/NetworkBanner";
import ToastManager from "../src/components/common/ToastManager";
import OfflineSyncModal from "../src/components/ui/OfflineSyncModal";
import { APP_ROLES } from "../src/constants/appRole";
import { getHomeRouteByRole } from "../src/constants/auth";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { DateRangeProvider } from "../src/context/DateRangeContext";
import { GlobalLoaderProvider } from "../src/context/GlobalLoaderContext";
import { NetworkProvider } from "../src/context/NetworkContext";
import { queryClient } from "../src/services/queryClient";

function QueryInvalidationListener() {
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      "PURCHASE_FLOW_UPDATED",
      () => {
        void queryClient.invalidateQueries({ queryKey: ["purchase"] });
        void queryClient.invalidateQueries({
          queryKey: ["empty-cylinder-loads"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["purchase-managers"],
        });
      },
    );

    return () => subscription.remove();
  }, []);

  return null;
}

function KeyboardAwareStack() {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Stack screenOptions={{ headerShown: false, animation: "fade_from_bottom" }} />
    </KeyboardAvoidingView>
  );
}

function RootNavigation() {
  const segments = useSegments();
  const {
    isAuthenticated,
    role,
    isLoading,
    isSplashCompleted,
    isLoginTransitionActive,
  } = useAuth();

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

  // Authenticated users should never be left on welcome or login, even after a cold start.
  if (isAuthenticated && role) {
    if (
      inWelcome ||
      (inLogin && !isLoginTransitionActive) ||
      (isAtRoot && role !== APP_ROLES.DRIVER)
    ) {
      return <Redirect href={getHomeRouteByRole(role) as any} />;
    }
  }

  // Keep the welcome route available to signed-out users until they continue.
  if (inWelcome) {
    return (
      <>
        <GlobalLoader />
        <KeyboardAwareStack />
        <ToastManager />
      </>
    );
  }

  // 1. Initial app start: if splash has not completed, redirect to /welcome
  if (!isAuthenticated && !isSplashCompleted) {
    return <Redirect href="/welcome" />;
  }

  // 2. After splash: unauthenticated users redirect to /login
  if (!isAuthenticated && !inLogin) {
    return <Redirect href="/login" />;
  }

  return (
    <>
      <GlobalLoader />
      <NetworkBanner />
      <KeyboardAwareStack />
      <ToastManager />
      <OfflineSyncModal />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <QueryInvalidationListener />
      <SafeAreaProvider>
        <GlobalLoaderProvider>
          <AuthProvider>
            <DateRangeProvider>
              <NetworkProvider>
                <RootNavigation />
              </NetworkProvider>
            </DateRangeProvider>
          </AuthProvider>
        </GlobalLoaderProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

