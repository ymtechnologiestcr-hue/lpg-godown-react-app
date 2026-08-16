import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
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
import { DS, TYPO, RADIUS } from '../../constants/designSystem';

type Denominations = {
  "500": number;
  "100": number;
  "50": number;
  "20": number;
  "10": number;
  coins: number;
};

type Props = {
  visible: boolean;
  expectedAmount: number;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    denominations: Denominations;
    enteredAmount: number;
  }) => void;
};

const initialValues: Denominations = {
  "500": 0,
  "100": 0,
  "50": 0,
  "20": 0,
  "10": 0,
  coins: 0,
};

export default function CashDenominationModal({
  visible,
  expectedAmount,
  loading = false,
  onClose,
  onSubmit,
}: Props) {
  const [enteredAmountText, setEnteredAmountText] = useState("");

  useEffect(() => {
    if (visible) {
      setEnteredAmountText("");
    }
  }, [visible]);

  const enteredAmount = Number(enteredAmountText) || 0;

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
                <Text style={styles.title}>Cash Denomination</Text>
                <Text style={styles.totalText}>Total: ₹{enteredAmount}</Text>
              </View>

              <Text style={styles.subtitle}>
                Enter the total cash amount collected.
              </Text>

              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={enteredAmountText}
                onChangeText={setEnteredAmountText}
                placeholder="Enter amount"
                placeholderTextColor={DS.textTertiary}
              />

              <View style={styles.summaryBox}>
                <Text style={styles.expectedText}>Expected: ₹{Number(expectedAmount.toFixed(2))}</Text>
                <Text style={styles.enteredText}>Entered: ₹{enteredAmount}</Text>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.disabled]}
                disabled={loading}
                onPress={() => onSubmit({ denominations: initialValues, enteredAmount })}
              >
                {loading ? (
                  <ActivityIndicator color={DS.white} />
                ) : (
                  <>
                    <Ionicons
                      name="wallet-outline"
                      size={18}
                      color={DS.white}
                    />
                    <Text style={styles.submitText}>
                      Settle Cash — ₹{enteredAmount}
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
  },
  handle: {
    width: 40,
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
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  totalText: {
    ...TYPO.s2,
    color: DS.primary,
  },
  amountInput: {
    height: 50,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: DS.border,
    paddingHorizontal: 16,
    ...TYPO.h5,
    color: DS.textPrimary,
    backgroundColor: DS.card,
    marginBottom: 20,
  },
  subtitle: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 10,
    marginBottom: 14,
  },
  summaryBox: {
    marginTop: 4,
    marginBottom: 14,
    backgroundColor: DS.orangeSoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  expectedText: {
    ...TYPO.b4,
    color: DS.orangeText,
  },
  enteredText: {
    ...TYPO.b4,
    color: DS.orangeText,
  },
  submitBtn: {
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.buttonGreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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