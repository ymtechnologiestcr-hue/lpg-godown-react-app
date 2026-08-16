import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
  ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { DS, TYPO, RADIUS } from '../../constants/designSystem';

type PaymentMethod = 'CASH' | 'UPI' | 'ONLINE' | 'CREDIT';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    payment_method: PaymentMethod;
    empty_cylinder_qty: number;
  }) => void;
  loading?: boolean;
  sale: {
    customerName: string;
    address: string;
    product: string;
    quantity: number;
    totalAmount: number;
  } | null;
};

export default function ConfirmDeliveryModal({
  visible,
  onClose,
  onSubmit,
  loading = false,
  sale,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [emptyQty, setEmptyQty] = useState(1);

  useEffect(() => {
    if (visible) {
      setPaymentMethod('CASH');
      setEmptyQty(1);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Confirm Delivery</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={DS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          {sale ? (
            <>
              <View style={styles.infoCard}>
                <Text style={styles.name}>{sale.customerName}</Text>
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={14} color={DS.textSecondary} />
                  <Text style={styles.address}>{sale.address}</Text>
                </View>
                <Text style={styles.meta}>
                  {sale.product} · Qty: {sale.quantity} · {sale.totalAmount}
                </Text>
              </View>

              <Text style={styles.label}>Payment Method</Text>
              <View style={styles.paymentRow}>
                {(['CASH', 'UPI', 'ONLINE', 'CREDIT'] as PaymentMethod[]).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.payBtn,
                      paymentMethod === method && styles.payBtnActive,
                    ]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.payText,
                        paymentMethod === method && styles.payTextActive,
                      ]}
                    >
                      {method === 'CASH'
                        ? 'Cash'
                        : method === 'UPI'
                        ? 'UPI'
                        : method === 'ONLINE'
                        ? 'Online'
                        : 'Credit'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput
                style={styles.input}
                value={String(sale.totalAmount)}
                editable={false}
              />

              <Text style={styles.label}>Empty Cylinders Collected</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setEmptyQty((prev) => Math.max(0, prev - 1))}
                >
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>

                <View style={styles.qtyValueBox}>
                  <Text style={styles.qtyValue}>{emptyQty}</Text>
                </View>

                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setEmptyQty((prev) => prev + 1)}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.disabled]}
                disabled={loading}
                onPress={() =>
                  onSubmit({
                    payment_method: paymentMethod,
                    empty_cylinder_qty: emptyQty,
                  })
                }
              >
                {loading ? (
                  <ActivityIndicator color={DS.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color={DS.white} />
                    <Text style={styles.submitText}>Save & Mark Delivered</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: DS.card,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '88%',
  },
  scrollArea: {
    marginTop: 8,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  handle: {
    width: 64,
    height: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: DS.borderStrong,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  infoCard: {
    backgroundColor: DS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginTop: 14,
    marginBottom: 16,
  },
  name: {
    ...TYPO.s2,
    color: DS.textPrimary,
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  address: {
    marginLeft: 4,
    color: DS.textSecondary,
    ...TYPO.b3,
  },
  meta: {
    color: DS.textSecondary,
    ...TYPO.b3,
  },
  label: {
    ...TYPO.b4,
    color: DS.textPrimary,
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  payBtn: {
    flex: 1,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primary,
  },
  payText: {
    color: DS.textPrimary,
    ...TYPO.c2,
    fontSize: 12,
    lineHeight: 16,
  },
  payTextActive: {
    color: DS.white,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    backgroundColor: DS.surface,
    color: DS.textPrimary,
    marginBottom: 16,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  qtyValueBox: {
    minWidth: 56,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DS.card,
  },
  qtyValue: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  submitBtn: {
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.buttonGreen,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitText: {
    ...TYPO.s2,
    color: DS.white,
  },
  disabled: {
    opacity: 0.7,
  },
});