import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DS, TYPO, RADIUS, PALETTE } from '../../constants/designSystem';

type Props = {
  name: string;
  consumerNumber?: string | null;
  address: string;
  type: string;
  qty: number;
  status: 'Delivered' | 'Pending' | 'Cancelled';
  showMarkDelivered?: boolean;
  onMarkDelivered?: () => void;
  loading?: boolean;
};

export default function DeliveryCard({
  name,
  consumerNumber,
  address,
  type,
  qty,
  status,
  showMarkDelivered = false,
  onMarkDelivered,
  loading = false,
}: Props) {
  const isDelivered = status === 'Delivered';
  const isCancelled = status === 'Cancelled';

  return (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <View style={styles.infoWrap}>
          <Text style={styles.name}>{name}</Text>

          {consumerNumber ? (
            <View style={styles.consumerNumberRow}>
              <Text style={styles.consumerNumberText}>Consumer No: {consumerNumber}</Text>
            </View>
          ) : null}

          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={DS.textSecondary} />
            <Text style={styles.address}>{address}</Text>
          </View>

          <Text style={styles.qty}>
            {type} · Qty: {qty}
          </Text>
        </View>

        <View
          style={[
            styles.badge,
            isDelivered
              ? styles.deliveredBadge
              : isCancelled
              ? styles.cancelledBadge
              : styles.pendingBadge,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              isDelivered
                ? styles.deliveredText
                : isCancelled
                ? styles.cancelledText
                : styles.pendingText,
            ]}
          >
            {status}
          </Text>
        </View>
      </View>

      {showMarkDelivered && (
        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={onMarkDelivered}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={DS.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={DS.white} />
              <Text style={styles.buttonText}>Mark Delivered</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    padding: 16,
    marginBottom: 14,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoWrap: {
    flex: 1,
  },
  name: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginBottom: 4,
  },
  consumerNumberRow: {
    marginBottom: 6,
  },
  consumerNumberText: {
    ...TYPO.b3,
    color: PALETTE.blue600,
    fontWeight: '500',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  address: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginLeft: 4,
    flexShrink: 1,
  },
  qty: {
    ...TYPO.b3,
    color: DS.textSecondary,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  deliveredBadge: {
    backgroundColor: DS.greenSoft,
  },
  pendingBadge: {
    backgroundColor: DS.orangeSoft,
  },
  cancelledBadge: {
    backgroundColor: DS.redSoft,
  },
  badgeText: {
    ...TYPO.c2,
  },
  deliveredText: {
    color: PALETTE.green600,
  },
  pendingText: {
    color: DS.orangeText,
  },
  cancelledText: {
    color: DS.red,
  },
  button: {
    marginTop: 14,
    backgroundColor: DS.buttonGreen,
    borderRadius: RADIUS.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    ...TYPO.s2,
    color: DS.white,
  },
});