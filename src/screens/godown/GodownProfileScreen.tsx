import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import AppHeader from '../../components/common/AppHeader';
import ScreenContainer from '../../components/common/ScreenContainer';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../../constants/auth';
import { DS, TYPO, EYEBROW, RADIUS, PALETTE, WEIGHT } from '../../constants/designSystem';

const activities = [
  {
    title: '50 Domestic cylinders received from HP Gas Depot',
    time: 'Today, 9:30 AM',
    icon: 'arrow-down-circle-outline',
    color: DS.green,
    bg: DS.greenSoft,
  },
  {
    title: '15 Domestic cylinders allocated to Ravi Kumar',
    time: 'Today, 10:15 AM',
    icon: 'arrow-up-circle-outline',
    color: DS.primary,
    bg: DS.blueSoft,
  },
  {
    title: '12 empty cylinders returned by Suresh Yadav',
    time: 'Today, 11:00 AM',
    icon: 'refresh-outline',
    color: DS.orange,
    bg: DS.orangeSoft,
  },
  {
    title: '20 Commercial cylinders allocated to Amit Singh',
    time: 'Today, 12:00 PM',
    icon: 'arrow-up-circle-outline',
    color: DS.primary,
    bg: DS.blueSoft,
  },
];

export default function GodownProfileScreen() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_USER_KEY).then((data) => {
      if (data) {
        setUser(JSON.parse(data));
      }
    });
  }, []);

  const handleSignOut = async () => {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
    Alert.alert('Signed out', 'You have been signed out successfully.');
    router.replace('/login');
  };

  const profileName = user?.name || "Godown Manager";
  const profileInitials = profileName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  const profilePhone = user?.phone || "+91 9876543210";

  return (
    <ScreenContainer>
      <AppHeader />

      <View style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profileInitials}</Text>
            </View>

            <View>
              <Text style={styles.name}>{profileName}</Text>
              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={14} color={DS.textSecondary} />
                <Text style={styles.phone}>{profilePhone}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoBox}>
              <Ionicons name="shield-outline" size={16} color={DS.primary} />
              <View>
                <Text style={styles.infoLabel}>ROLE</Text>
                <Text style={styles.infoValue}>Godown Manager</Text>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="business-outline" size={16} color={DS.green} />
              <View>
                <Text style={styles.infoLabel}>AGENCY</Text>
                <Text style={styles.infoValue}>Sri Gas</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Activity History</Text>

        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterButton, styles.filterActive]}>
            <Text style={[styles.filterText, styles.filterTextActive]}>Today</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>This Week</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>This Month</Text>
          </TouchableOpacity>
        </View>

        {activities.map((item, index) => (
          <View key={index} style={styles.activityCard}>
            <View style={[styles.activityIcon, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon as any} size={20} color={item.color} />
            </View>

            <View style={styles.activityTextBox}>
              <Text style={styles.activityTitle}>{item.title}</Text>
              <Text style={styles.activityTime}>{item.time}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  profileCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 18,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: DS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  avatarText: {
    ...TYPO.s1,
    color: DS.primary,
  },
  name: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  phone: {
    ...TYPO.b3,
    color: DS.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  infoBox: {
    flex: 1,
    backgroundColor: DS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    ...EYEBROW,
    color: DS.textTertiary,
  },
  infoValue: {
    ...TYPO.b4,
    color: DS.textPrimary,
    marginTop: 2,
  },
  roleSwitchWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  signOutButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: PALETTE.red100,
    borderRadius: RADIUS.md,
    backgroundColor: DS.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.red,
  },
  roleButton: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 50,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    backgroundColor: DS.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  roleButtonActive: {
    borderColor: DS.primary,
    backgroundColor: DS.primarySoft,
  },
  roleButtonText: {
    ...TYPO.c2,
    color: DS.textSecondary,
    textAlign: 'center',
  },
  roleButtonTextActive: {
    color: DS.primary,
  },
  sectionTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: 'center',
  },
  filterActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primary,
  },
  filterText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
  },
  filterTextActive: {
    color: DS.white,
  },
  activityCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityTextBox: {
    flex: 1,
  },
  activityTitle: {
    ...TYPO.b4,
    color: DS.textPrimary,
  },
  activityTime: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 5,
  },
});
