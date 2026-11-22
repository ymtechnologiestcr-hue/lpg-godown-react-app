import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export default function DashboardLoadingState() {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel="Loading dashboard">
      <View style={styles.heading}>
        <Animated.View style={[styles.logo, { opacity: pulse, transform: [{ scale: pulse }] }]}>
          <Ionicons name="flame" size={22} color="#C81924" />
        </Animated.View>
        <Text style={styles.title}>Getting your dashboard ready</Text>
        <Text style={styles.subtitle}>Syncing your latest data…</Text>
      </View>

      <View style={styles.cardRow}>
        {[0, 1].map((item) => (
          <View key={item} style={styles.card}>
            <Animated.View style={[styles.iconSkeleton, { opacity: pulse }]} />
            <Animated.View style={[styles.valueSkeleton, { opacity: pulse }]} />
            <Animated.View style={[styles.labelSkeleton, { opacity: pulse }]} />
          </View>
        ))}
      </View>
      <View style={styles.activityCard}>
        <Animated.View style={[styles.activityIcon, { opacity: pulse }]} />
        <View style={styles.activityCopy}>
          <Animated.View style={[styles.activityTitle, { opacity: pulse }]} />
          <Animated.View style={[styles.activitySubtitle, { opacity: pulse }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 300,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  heading: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#243449',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  subtitle: {
    color: '#8793A3',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    height: 92,
    borderRadius: 16,
    padding: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  iconSkeleton: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: '#F3E9EA',
    marginBottom: 10,
  },
  valueSkeleton: {
    width: '52%',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E8EDF2',
    marginBottom: 7,
  },
  labelSkeleton: {
    width: '78%',
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F0F2F5',
  },
  activityCard: {
    minHeight: 62,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF0F3',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    marginTop: 12,
  },
  activityIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EAF4FA',
    marginRight: 11,
  },
  activityCopy: {
    flex: 1,
    gap: 7,
  },
  activityTitle: {
    width: '65%',
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E8EDF2',
  },
  activitySubtitle: {
    width: '42%',
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F0F2F5',
  },
});
