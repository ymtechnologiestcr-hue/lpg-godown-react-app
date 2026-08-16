import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, DeviceEventEmitter, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';

import ScreenContainer from '../../components/common/ScreenContainer';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../../constants/auth';
import { DS, TYPO, EYEBROW, RADIUS, PALETTE, WEIGHT } from '../../constants/designSystem';

export default function PurchaseProfileScreen() {
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
    DeviceEventEmitter.emit('APP_ROLE_CHANGED', null);
    Alert.alert('Signed out', 'You have been signed out successfully.');
    router.replace('/login');
  };

  const profileName = user?.name || "Purchase Driver";
  const profileInitials = profileName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  const profilePhone = user?.phone ? `+91 ${user.phone}` : "+91 98765 43210";
  const profileRole = user?.role === 'PURCHASE_MANAGER' ? 'Purchase Manager' : 'Purchase Driver';

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.headerBlue}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profileInitials}</Text>
              </View>

              <View>
                <Text style={styles.name}>{profileName}</Text>
                <Text style={styles.metaSub}>{profileRole}</Text>
                <View style={styles.verifiedPill}>
                  <Text style={styles.verifiedText}>VERIFIED</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>DRIVER DETAILS</Text>

            <InfoRow icon="call-outline" label="Phone Number" value={profilePhone} />
            <InfoRow icon="car-outline" label="Vehicle Number" value={user?.vehicleNumber || ""} />
            <InfoRow icon="card-outline" label="Driver License" value={user?.driverLicense || ""} noBorder />
          </View>

          <View style={styles.sectionCardSmallGap}>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>

            <InfoRow icon="card-outline" label="Bank Account" value="HDFC *** 7842" chevron />
            <InfoRow icon="notifications-outline" label="Notifications" value="All enabled" chevron />
            <InfoRow icon="shield-outline" label="Privacy & Security" value="" chevron />
            <InfoRow icon="help-circle-outline" label="Help & Support" value="" chevron noBorder />
          </View>

          <TouchableOpacity activeOpacity={0.86} style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Bharat Gas Logistics Driver App v2.4.1</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

function InfoRow({
  icon,
  label,
  value,
  chevron,
  noBorder,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  chevron?: boolean;
  noBorder?: boolean;
}) {
  return (
    <View style={[styles.infoRow, noBorder ? styles.infoRowNoBorder : null]}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={12} color={DS.textSecondary} />
      </View>

      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        {value ? <Text style={styles.infoValue}>{value}</Text> : null}
      </View>

      {chevron ? <Ionicons name="chevron-forward" size={14} color={DS.grey300} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  roleSwitchWrapTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  profileCard: {
    backgroundColor: DS.background,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  headerBlue: {
    backgroundColor: DS.primary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  avatarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PALETTE.primary900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...TYPO.s2,
    color: PALETTE.primary200,
  },
  name: {
    ...TYPO.s1,
    color: DS.white,
  },
  metaSub: {
    ...TYPO.c1,
    color: PALETTE.primary100,
    marginTop: 2,
  },
  verifiedPill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: PALETTE.primary900,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: {
    ...TYPO.c3,
    color: PALETTE.primary200,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.5,
  },
  sectionCard: {
    margin: 10,
    marginTop: 12,
    backgroundColor: DS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    paddingVertical: 12,
  },
  sectionCardSmallGap: {
    marginHorizontal: 10,
    marginTop: 6,
    backgroundColor: DS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    paddingVertical: 12,
  },
  sectionLabel: {
    ...EYEBROW,
    color: DS.textTertiary,
    fontSize: 11,
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  infoRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: DS.divider,
    paddingHorizontal: 12,
  },
  infoRowNoBorder: {
    borderBottomWidth: 0,
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    ...TYPO.c1,
    color: DS.textTertiary,
  },
  infoValue: {
    ...TYPO.b4,
    color: DS.textPrimary,
    marginTop: 1,
  },
  signOutButton: {
    marginHorizontal: 10,
    marginTop: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: PALETTE.red100,
    backgroundColor: DS.redSoft,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    ...TYPO.s2,
    color: DS.red,
  },
  versionText: {
    ...TYPO.c1,
    marginTop: 12,
    marginBottom: 8,
    color: DS.textTertiary,
    textAlign: 'center',
  },
  roleButton: {
    flexGrow: 1,
    flexBasis: '30%',
    height: 42,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
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
});
