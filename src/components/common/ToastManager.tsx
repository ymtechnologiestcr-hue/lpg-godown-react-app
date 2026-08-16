import { useEffect, useState, useRef } from "react";
import { Animated, StyleSheet, Text, Platform } from "react-native";
import { DS, RADIUS, TYPO } from "../../constants/designSystem";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
let listeners: ((toast: ToastMessage) => void)[] = [];

export const showToast = (message: string, type: ToastType = "success") => {
  const toast: ToastMessage = { id: ++toastId, message, type };
  listeners.forEach((listener) => listener(toast));
};

export default function ToastManager() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const listener = (newToast: ToastMessage) => {
      setToast(newToast);
      
      opacity.setValue(0);
      translateY.setValue(-20);
      
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -20,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setToast(null);
        });
      }, 3500);
    };

    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
      if (timeout) clearTimeout(timeout);
    };
  }, [opacity, translateY]);

  if (!toast) return null;

  const backgroundColor = 
    toast.type === "success" ? DS.green : 
    toast.type === "error" ? DS.red : 
    DS.primary;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY }] },
        { backgroundColor }
      ]}
    >
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 65 : 45,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  text: {
    ...TYPO.h5,
    color: DS.white,
    textAlign: "center",
  },
});
