import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
  DeviceEventEmitter,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import AppHeader from '../../components/common/AppHeader';
import ScreenContainer from '../../components/common/ScreenContainer';
import { DS, TYPO, RADIUS } from '../../constants/designSystem';
import { useDateRange } from '../../context/DateRangeContext';
import { getGodownDashboardData } from '../../services/godownService';

export default function GodownHomeScreen() {
  const { rangeKey } = useDateRange();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await getGodownDashboardData();
      setDashboardData(data);
    } catch (error) {
      console.log('Godown dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('DRIVER_ALLOCATION_CREATED', () => {
      fetchDashboardData();
    });

    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [rangeKey]);

  const cards = [
    {
      title: 'Domestic\nAvailable',
      value: dashboardData?.available?.domestic?.total ?? 0,
      type: 'domestic',
      icon: 'gas-cylinder',
      iconFamily: 'MaterialCommunityIcons',
      color: DS.primary,
      bg: DS.blueSoft,
    },
    {
      title: 'Commercial\nAvailable',
      value: dashboardData?.available?.commercial?.total ?? 0,
      type: 'commercial',
      icon: 'gas-cylinder',
      iconFamily: 'MaterialCommunityIcons',
      color: DS.green,
      bg: DS.greenSoft,
    },
    {
      title: 'Domestic\nEmpty',
      value: dashboardData?.empty?.domestic?.total ?? 0,
      type: 'empty-domestic',
      icon: 'refresh-outline',
      color: DS.orange,
      bg: DS.orangeSoft,
    },
    {
      title: 'Commercial\nEmpty',
      value: dashboardData?.empty?.commercial?.total ?? 0,
      type: 'empty-commercial',
      icon: 'refresh-outline',
      color: DS.orange,
      bg: DS.orangeSoft,
    },
    {
      title: 'Allocated\nToday',
      value: dashboardData?.allocatedToday ?? 0,
      type: 'allocated',
      icon: 'car-outline',
      color: DS.primary,
      bg: DS.blueSoft,
    },
    {
      title: 'Returned\nToday',
      value: dashboardData?.returnedToday ?? 0,
      type: 'returned',
      icon: 'arrow-down-circle-outline',
      color: DS.green,
      bg: DS.greenSoft,
    },
    {
      title: 'Total\nDefectives',
      value: dashboardData?.totalDefectives ?? 0,
      type: 'defective',
      icon: 'warning-outline',
      color: DS.red,
      bg: DS.redSoft,
    },
    {
      title: 'Cashier Sale\nStock',
      value: dashboardData?.cashierSaleStock ?? 27,
      type: 'cashier-sale',
      icon: 'cash-outline',
      color: DS.green,
      bg: DS.greenSoft,
    },
  ];

  const handleCardPress = (type: string) => {
    if (type === 'allocated') {
      router.push('/drivers' as any);
      return;
    }

    if (type === 'returned') {
      router.push('/returns-today' as any);
      return;
    }

    if (type === 'defective') {
      router.push({
        pathname: '/stock',
        params: { tab: 'defective' },
      } as any);
      return;
    }

    if (type === 'cashier-sale') {
      router.push('/cashier-sale' as any);
      return;
    }

    router.push({
      pathname: '/stock-detail/[type]',
      params: { type },
    });
  };

  const getActivityTimeLabel = (createdAt?: string) => {
    if (!createdAt) {
      return 'Just now';
    }

    const timestamp = new Date(createdAt).getTime();
    if (Number.isNaN(timestamp)) {
      return 'Just now';
    }

    const diffMs = Date.now() - timestamp;
    const diffMins = Math.max(Math.floor(diffMs / 60000), 0);

    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
    }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  };

  const getActivityColor = (color?: string) => {
    if (color === 'green') {
      return DS.green;
    }
    if (color === 'orange') {
      return DS.orange;
    }
    if (color === 'danger') {
      return DS.red;
    }
    return DS.primary;
  };

  const recentActivities = Array.isArray(dashboardData?.recentActivities)
    ? dashboardData.recentActivities.slice(0, 10)
    : [];

  return (
    <ScreenContainer>
      <AppHeader />

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={DS.primary} />
          </View>
        ) : (
          <>
            <View style={styles.cardGrid}>
              {cards.map((card) => (
                <TouchableOpacity
                  key={card.type}
                  activeOpacity={0.8}
                  style={styles.card}
                  onPress={() => handleCardPress(card.type)}
                >
                  <View style={[styles.iconBox, { backgroundColor: card.bg }]}>
                    {card.iconFamily === 'MaterialCommunityIcons' ? (
                      <MaterialCommunityIcons
                        name={card.icon as any}
                        size={22}
                        color={card.color}
                      />
                    ) : (
                      <Ionicons
                        name={card.icon as any}
                        size={22}
                        color={card.color}
                      />
                    )}
                  </View>

                  <View style={styles.cardTextBox}>
                    <Text style={styles.cardValue}>{card.value}</Text>
                    <Text style={styles.cardTitle}>{card.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Recent Activity</Text>

            {recentActivities.length === 0 ? (
              <View style={styles.activityCard}>
                <View style={styles.activityTextBox}>
                  <Text style={styles.activityEmptyText}>No recent activity found.</Text>
                </View>
              </View>
            ) : (
              recentActivities.map((item: any, index: number) => (
                <View key={item.id ?? `${item.title}-${index}`} style={styles.activityCard}>
                  <Ionicons
                    name={(item.icon || 'time-outline') as any}
                    size={22}
                    color={getActivityColor(item.color)}
                  />

                  <View style={styles.activityTextBox}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activityTime}>{getActivityTimeLabel(item.createdAt)}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  loaderBox: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    minHeight: 88,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTextBox: {
    flex: 1,
  },
  cardValue: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },
  cardTitle: {
    ...TYPO.c2,
    color: DS.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginTop: 8,
    marginBottom: 12,
  },
  activityCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityTextBox: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  activityTime: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 4,
  },
  activityEmptyText: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },
});