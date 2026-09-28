import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { APP_ROLES, AppRole } from '../../src/constants/appRole';
import { AUTH_USER_KEY, getHomeRouteByRole } from '../../src/constants/auth';
import { DS } from '../../src/constants/designSystem';
import DeliveriesScreen from '../../src/screens/DeliveriesScreen';

export default function Page() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(AUTH_USER_KEY)
      .then((raw) => {
        if (!isMounted) return;
        if (raw) {
          try {
            const user = JSON.parse(raw);
            setRole(user?.role || null);
          } catch {}
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={DS.primary} />
      </View>
    );
  }

  if (role && role !== APP_ROLES.DRIVER) {
    return <Redirect href={getHomeRouteByRole(role) as any} />;
  }

  return <DeliveriesScreen />;
}