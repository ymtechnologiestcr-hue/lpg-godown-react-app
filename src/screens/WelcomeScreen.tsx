import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getHomeRouteByRole } from "../constants/auth";
import { useAuth } from "../context/AuthContext";

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, user, role, agencyName, setSplashCompleted } =
    useAuth();

  // Dynamic Agency Name:
  // Case 1: When user is logged in -> show user's agency name
  // Case 2: When user is not logged in -> show "LPG Mitra"
  const displayAgencyName =
    isAuthenticated && (user?.agency_name || user?.company_name || agencyName)
      ? (user?.agency_name || user?.company_name || agencyName)!.trim()
      : "LPG Mitra";

  const logoInitial = (displayAgencyName.trim().charAt(0) || "G").toUpperCase();

  // Animation Values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(25)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  const isNavigating = useRef(false);
  const authRef = useRef({ isAuthenticated, role });
  useEffect(() => {
    authRef.current = { isAuthenticated, role };
  }, [isAuthenticated, role]);

  const navigateNext = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;

    let hasNavigated = false;
    const performNavigation = () => {
      if (hasNavigated) return;
      hasNavigated = true;
      setSplashCompleted(true);
      const { isAuthenticated: authed, role: userRole } = authRef.current;
      if (authed && userRole) {
        router.replace(getHomeRouteByRole(userRole) as any);
      } else {
        router.replace("/login");
      }
    };

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      performNavigation();
    });

    // Safety fallback in case animation does not trigger completion
    setTimeout(performNavigation, 380);
  };

  useEffect(() => {
    // 1. Initial Screen Fade In
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: false,
    }).start();

    // 2. Logo entrance (Spring + Fade)
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: false,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Gentle pulse loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.06,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      ).start();
    });

    // 3. Text entrance (Slide Up + Fade)
    Animated.parallel([
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: false,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: false,
      }),
    ]).start();

    // 4. Footer entrance
    Animated.timing(footerOpacity, {
      toValue: 1,
      duration: 600,
      delay: 500,
      useNativeDriver: false,
    }).start();

    // 5. Auto navigate after 2.6 seconds
    const timer = setTimeout(() => {
      navigateNext();
    }, 2600);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Pressable style={styles.mainContainer} onPress={navigateNext}>
      <StatusBar barStyle="light-content" backgroundColor="#1E65FF" />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerSection}>
            {/* Logo Circle - Nested for safe scaling on Web */}
            <Animated.View
              style={[
                styles.logoWrapper,
                {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
                <View style={styles.logoCircle}>
                  <Text style={styles.logoText}>{logoInitial}</Text>
                </View>
              </Animated.View>
            </Animated.View>

            {/* Title */}
            <Animated.View
              style={[
                styles.titleWrapper,
                {
                  opacity: textOpacity,
                  transform: [{ translateY: textTranslateY }],
                },
              ]}
            >
              <Text style={styles.titleText}>{displayAgencyName}</Text>
            </Animated.View>
          </View>

          {/* Footer Section */}
          <Animated.View
            style={[styles.footerSection, { opacity: footerOpacity }]}
          >
            <Text style={styles.poweredByText}>Powered By</Text>
            <Text style={styles.companyText}>YM Technologies</Text>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#1E65FF",
  },
  container: {
    flex: 1,
    backgroundColor: "#1E65FF",
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 36,
  },
  centerSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoWrapper: {
    marginBottom: 20,
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 6 },
    // shadowOpacity: 0.25,
    // shadowRadius: 10,
    elevation: 8,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 54,
    fontWeight: "700",
    color: "#2FA25A",
  },
  titleWrapper: {
    marginTop: 8,
    alignItems: "center",
  },
  titleText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  footerSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  poweredByText: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 4,
  },
  companyText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});
