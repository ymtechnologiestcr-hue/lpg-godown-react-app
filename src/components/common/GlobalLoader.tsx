import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DS, PALETTE, RADIUS, TYPO } from "../../constants/designSystem";
import { useGlobalLoader } from "../../context/GlobalLoaderContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function GlobalLoader() {
  const { isLoading, isBlocking, message } = useGlobalLoader();
  const insets = useSafeAreaInsets();

  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const loopAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Floating pill fade animation
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const pillTranslateY = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    if (isLoading) {
      // Loop the top progress bar across the screen
      progressAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(progressAnim, {
            toValue: 2,
            duration: 0,
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
      );
      loopAnimRef.current = loop;
      loop.start();

      // Fade in floating pill
      Animated.parallel([
        Animated.timing(pillOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pillTranslateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    } else {
      if (loopAnimRef.current) {
        loopAnimRef.current.stop();
        loopAnimRef.current = null;
      }

      Animated.parallel([
        Animated.timing(pillOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pillTranslateY, {
          toValue: 15,
          duration: 200,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    }

    return () => {
      if (loopAnimRef.current) {
        loopAnimRef.current.stop();
      }
    };
  }, [isLoading, progressAnim, pillOpacity, pillTranslateY]);

  // Interpolate progress bar offset and width
  const barTranslateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH * 0.4, SCREEN_WIDTH],
  });

  const barScaleX = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.4],
  });

  return (
    <>
      {/* 1. Top Linear Progress Bar (Always non-blocking, visible for all active background APIs) */}
      {isLoading && (
        <View
          pointerEvents="none"
          style={[
            styles.progressBarContainer,
            { top: Math.max(insets.top, 0) },
          ]}
        >
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarIndicator,
                {
                  transform: [
                    { translateX: barTranslateX },
                    { scaleX: barScaleX },
                  ],
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* 2. Floating Subtle Background Pill (Non-blocking, displays in bottom-center) */}
      {isLoading && !isBlocking && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.floatingPill,
            {
              bottom: Math.max(insets.bottom, 16) + 16,
              opacity: pillOpacity,
              transform: [{ translateY: pillTranslateY }],
            },
          ]}
        >
          <View style={styles.floatingPillContent}>
            <ActivityIndicator size="small" color={DS.white} style={styles.pillSpinner} />
            <Text style={styles.pillText} numberOfLines={1}>
              {message || "Updating..."}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* 3. Full Blocking Modal Overlay (Only when blocking is explicitly requested) */}
      <Modal
        visible={isBlocking}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.blockingOverlay}>
          <View style={styles.blockingCard}>
            <ActivityIndicator size="large" color={DS.primary} style={styles.blockingSpinner} />
            <Text style={styles.blockingTitle}>
              {message || "Please wait..."}
            </Text>
            <Text style={styles.blockingSub}>Processing your request</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  progressBarContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    zIndex: 99999,
  },
  progressBarTrack: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(61, 79, 224, 0.15)",
    overflow: "hidden",
  },
  progressBarIndicator: {
    width: SCREEN_WIDTH * 0.6,
    height: "100%",
    backgroundColor: PALETTE.primary500,
    borderRadius: 2,
  },
  floatingPill: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 99990,
  },
  floatingPillContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(23, 27, 92, 0.90)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  pillSpinner: {
    marginRight: 8,
  },
  pillText: {
    ...TYPO.c1,
    color: DS.white,
    fontWeight: "600",
  },
  blockingOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 13, 18, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  blockingCard: {
    width: 200,
    backgroundColor: DS.card,
    borderRadius: RADIUS.lg,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: DS.border,
  },
  blockingSpinner: {
    marginBottom: 16,
  },
  blockingTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  blockingSub: {
    ...TYPO.c1,
    color: DS.textSecondary,
    textAlign: "center",
  },
});
