import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { DS, RADIUS, TYPO, WEIGHT } from '../../constants/designSystem';

type PaymentOption = 'CASH' | 'UPI' | 'ONLINE';

type Props = {
  visible: boolean;
  dueAmount: number;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    method: PaymentOption;
    amount: number;
    denominations?: any;
  }) => void;
  settlements?: any;
};

// Removed generateDenominations as requested
export default function SettleAmountModal({
  visible,
  dueAmount,
  loading = false,
  onClose,
  onSubmit,
  settlements,
}: Props) {
  const [selectedOption, setSelectedOption] = useState<PaymentOption>('CASH');
  const [amountText, setAmountText] = useState('');



  useEffect(() => {
    if (visible) {
      setSelectedOption('CASH');
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setAmountText(dueAmount.toString());
    }
  }, [visible, dueAmount]);

  const enteredAmount = Number(amountText) || 0;
  const balance = Math.max(0, dueAmount - enteredAmount);

  const isCashPending = settlements?.cashPending?.status === 'PENDING';
  const isUpiPending = settlements?.upiPending?.status === 'PENDING';
  const isMethodPending =
    (selectedOption === 'CASH' && isCashPending) ||
    (selectedOption === 'UPI' && isUpiPending);

  const displayMessage =
    selectedOption === 'CASH'
      ? settlements?.cashPending?.displayMessage
      : selectedOption === 'UPI'
      ? settlements?.upiPending?.displayMessage
      : null;

  const isSubmitDisabled = loading || enteredAmount <= 0;

  const handleSubmit = () => {
    const payload: any = {
      method: selectedOption,
      amount: enteredAmount,
    };

    onSubmit(payload);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContent}>
              <View style={styles.handle} />

              <View style={styles.headerRow}>
                <Text style={styles.title}>Settle Amount</Text>
                <Text style={styles.dueText}>Due: ₹{dueAmount}</Text>
              </View>

              <Text style={styles.sectionTitle}>PAYMENT OPTION</Text>
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    selectedOption === 'CASH' && styles.optionCardActive,
                  ]}
                  onPress={() => setSelectedOption('CASH')}
                >
                  <Ionicons name="wallet-outline" size={24} color={DS.textSecondary} />
                  <Text style={styles.optionText}>Cash</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    selectedOption === 'UPI' && styles.optionCardActive,
                  ]}
                  onPress={() => setSelectedOption('UPI')}
                >
                  <Ionicons name="phone-portrait-outline" size={24} color={DS.textSecondary} />
                  <Text style={styles.optionText}>UPI</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    selectedOption === 'ONLINE' && styles.optionCardActive,
                  ]}
                  onPress={() => setSelectedOption('ONLINE')}
                >
                  <Ionicons name="card-outline" size={24} color={DS.textSecondary} />
                  <Text style={styles.optionText}>Card / Online</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>AMOUNT TO SETTLE</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={amountText}
                onChangeText={setAmountText}
                placeholder="Enter amount"
                placeholderTextColor={DS.textTertiary}
              />

              <View style={styles.balanceBox}>
                <Text style={styles.balanceLabel}>Balance after settlement</Text>
                <Text style={styles.balanceAmount}>₹{balance}</Text>
              </View>

              {isMethodPending && displayMessage ? (
                <View style={styles.pendingTag}>
                  <Ionicons name="information-circle" size={16} color={DS.orangeText} />
                  <Text style={styles.pendingText}>
                    {displayMessage === 'Pending for approval'
                      ? `${displayMessage} (₹${
                          selectedOption === 'CASH'
                            ? settlements?.cashPending?.amount || 0
                            : settlements?.upiPending?.amount || 0
                        })`
                      : displayMessage}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitDisabled && styles.disabled]}
                disabled={isSubmitDisabled}
                onPress={handleSubmit}
              >
                {loading ? (
                  <ActivityIndicator color={DS.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={DS.white} />
                    <Text style={styles.submitText}>
                      Settle ₹{enteredAmount}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: DS.card,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: DS.borderStrong,
    alignSelf: 'center',
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  dueText: {
    ...TYPO.s2,
    color: DS.primary,
  },
  sectionTitle: {
    ...TYPO.label,
    color: DS.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  optionCardActive: {
    borderColor: DS.primary,
    backgroundColor: DS.primarySoft,
  },
  optionText: {
    ...TYPO.b4,
    color: DS.textPrimary,
    fontWeight: WEIGHT.semibold,
  },
  amountInput: {
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    paddingHorizontal: 16,
    ...TYPO.h5,
    color: DS.textPrimary,
    backgroundColor: DS.card,
    marginBottom: 24,
  },
  balanceBox: {
    backgroundColor: DS.greenSoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  balanceLabel: {
    ...TYPO.b3,
    color: DS.greenText,
    fontWeight: WEIGHT.semibold,
  },
  balanceAmount: {
    ...TYPO.s2,
    color: DS.greenText,
  },
  pendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: DS.orangeSoft,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    marginBottom: 20,
  },
  pendingText: {
    ...TYPO.b3,
    color: DS.orangeText,
    fontWeight: WEIGHT.medium,
  },
  submitBtn: {
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: '#1E65F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    ...TYPO.s1,
    color: DS.white,
  },
  disabled: {
    opacity: 0.7,
  },
});
