import { Feather, Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_ROLES } from '../../src/constants/appRole';
import { DS, WEIGHT } from '../../src/constants/designSystem';
import { useAuth } from '../../src/context/AuthContext';

export default function TabsLayout() {
  const { role } = useAuth();
  const insets = useSafeAreaInsets();

  const isDriver = role === APP_ROLES.DRIVER;
  const isGodown = role === APP_ROLES.GODOWN_MANAGER;
  const isPurchase = role === APP_ROLES.PURCHASE_MANAGER;

  return (
    <Tabs
      initialRouteName={isPurchase ? 'purchase-home' : isGodown ? 'godown-home' : 'index'}
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
