import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_ROLES, AppRole } from '../../src/constants/appRole';
import { AUTH_USER_KEY } from '../../src/constants/auth';
import { DS, WEIGHT } from '../../src/constants/designSystem';

export default function TabsLayout() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();

  const loadRole = async () => {
    try {
      const userText = await AsyncStorage.getItem(AUTH_USER_KEY);

      if (!userText) {
        setRole(APP_ROLES.DRIVER);
        return;
      }

      const user = JSON.parse(userText);
      const savedRole = user?.role;

      if (
        savedRole === APP_ROLES.DRIVER ||
        savedRole === APP_ROLES.GODOWN_MANAGER ||
        savedRole === APP_ROLES.PURCHASE_MANAGER
      ) {
        setRole(savedRole);
      } else {
        setRole(APP_ROLES.DRIVER);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRole();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={DS.primary} />
      </View>
    );
  }

  const isDriver = role === APP_ROLES.DRIVER;
  const isGodown = role === APP_ROLES.GODOWN_MANAGER;
  const isPurchase = role === APP_ROLES.PURCHASE_MANAGER;

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: DS.primary,
        tabBarInactiveTintColor: DS.textTertiary,
        tabBarStyle: {
          height: 72 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 10 + insets.bottom,
          borderTopWidth: 1,
          borderTopColor: DS.border,
          backgroundColor: DS.card,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: WEIGHT.medium,
        },
      }}
    >
      {/* DRIVER TABS */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Deliveries',
          href: isDriver ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Feather name="truck" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="add"
        options={{
          title: 'New Booking',
          href: isDriver ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          href: isDriver ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: isDriver ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      {/* GODOWN TABS */}
      <Tabs.Screen
        name="godown-home"
        options={{
          title: 'Dashboard',
          href: isGodown ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          href: isGodown ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="drivers"
        options={{
          title: 'Drivers',
          href: isGodown ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="godown-profile"
        options={{
          title: 'Profile',
          href: isGodown ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      {/* PURCHASE MANAGER TABS */}
      <Tabs.Screen
        name="purchase-home"
        options={{
          title: 'Home',
          href: isPurchase ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="purchase-loads"
        options={{
          title: 'Loads',
          href: isPurchase ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="purchase-expenses"
        options={{
          title: 'Expenses',
          href: isPurchase ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="purchase-trips"
        options={{
          title: 'Trips',
          href: isPurchase ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="purchase-profile"
        options={{
          title: 'Profile',
          href: isPurchase ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
