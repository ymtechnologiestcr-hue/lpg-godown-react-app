import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Linking,
  Alert,
} from 'react-native';
import { DS, RADIUS, TYPO, WEIGHT } from '../../constants/designSystem';

type UpiApp = 'Google Pay' | 'PhonePe' | 'Paytm';

type Props = {
  visible: boolean;
  dueAmount: number;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    method: 'UPI';
    amount: number;
    paymentApp: UpiApp;
  }) => void;
};

export default function UpiPaymentModal({
  visible,
  dueAmount,
  loading = false,
  onClose,
  onSubmit,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedApp, setSelectedApp] = useState<UpiApp>('Google Pay');

  useEffect(() => {
    if (visible) {
      setStep(1);
      setSelectedApp('Google Pay');
    }
  }, [visible]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (step === 2) {
      timeout = setTimeout(() => {
        setStep(3);
      }, 2000);
    }
    return () => clearTimeout(timeout);
  }, [step]);

  const handleSubmit = () => {
    onSubmit({
      method: 'UPI',
      amount: dueAmount,
      paymentApp: selectedApp,
    });
  };

  const handlePayPress = async () => {
    setStep(2);

    // Provide a placeholder VPA since it is not provided in props yet.
    // Replace 'merchant@upi' with the actual merchant VPA.
    const vpa = 'merchant@upi';
    const name = 'Merchant';
    const params = `pa=${vpa}&pn=${name}&am=${dueAmount}&cu=INR`;
    
    let url = '';
    if (selectedApp === 'Google Pay') {
      url = `tez://upi/pay?${params}`;
    } else if (selectedApp === 'PhonePe') {
      url = `phonepe://pay?${params}`;
    } else if (selectedApp === 'Paytm') {
      url = `paytmmp://pay?${params}`;
    }

    try {
      await Linking.openURL(url);
    } catch (err) {
      console.log('Specific scheme failed, trying generic UPI scheme...', err);
      try {
        const generalUpiUrl = `upi://pay?${params}`;
        await Linking.openURL(generalUpiUrl);
      } catch (generalErr) {
        Alert.alert('Error', `Could not open ${selectedApp} or any UPI app.`);
      }
    }
  };

  const renderStep1 = () => (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Settle Collection</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={DS.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.amountBox}>
        <Text style={styles.amountLabel}>Amount to Pay</Text>
        <Text style={styles.amountValue}>₹{dueAmount.toLocaleString('en-IN')}</Text>
      </View>

      <Text style={styles.sectionTitle}>UPI APPS</Text>
      
      <View style={styles.appList}>
        {(['Google Pay', 'PhonePe', 'Paytm'] as UpiApp[]).map((app) => (
          <TouchableOpacity
            key={app}
            style={[
              styles.appCard,
              selectedApp === app && styles.appCardActive,
            ]}
            onPress={() => setSelectedApp(app)}
          >
            <View style={styles.appIconPlaceholder}>
              <Text style={styles.appIconText}>{app[0]}</Text>
            </View>
            <View style={styles.appInfo}>
              <Text style={styles.appName}>{app}</Text>
              <Text style={styles.appSub}>UPI</Text>
            </View>
            <View style={styles.radio}>
              {selectedApp === app && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.payBtn}
        onPress={handlePayPress}
      >
        <Ionicons name="wallet-outline" size={20} color={DS.white} />
        <Text style={styles.submitText}>
          Pay ₹{dueAmount.toLocaleString('en-IN')}
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderStep2 = () => (
    <View style={styles.step2Container}>
      <View style={styles.handle} />
      
      <View style={styles.processingWrap}>
        <ActivityIndicator size="large" color={DS.primary} />
        <Text style={styles.processingTitle}>Processing Payment...</Text>
        <Text style={styles.processingSub}>₹{dueAmount.toLocaleString('en-IN')}</Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.step2Container}>
      <View style={styles.handle} />
      
      <View style={styles.questionIconWrap}>
        <Ionicons name="help-outline" size={32} color={DS.primary} />
      </View>
      
      <Text style={styles.questionTitle}>Is the payment done?</Text>
      <Text style={styles.questionSub}>
        ₹{dueAmount.toLocaleString('en-IN')} requested via {selectedApp}
      </Text>

      <TouchableOpacity
        style={[styles.successBtn, loading && styles.disabled]}
        disabled={loading}
        onPress={handleSubmit}
      >
        {loading ? (
          <ActivityIndicator color={DS.white} />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color={DS.white} />
            <Text style={styles.submitText}>Yes, Payment Done</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.retryBtn}
        onPress={() => setStep(1)}
        disabled={loading}
      >
        <Ionicons name="refresh-outline" size={20} color={DS.textPrimary} />
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

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
              {step === 1 ? (
                <>
                  <View style={styles.handle} />
                  {renderStep1()}
                </>
              ) : step === 2 ? (
                renderStep2()
              ) : (
                renderStep3()
              )}
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
    marginBottom: 20,
  },
  title: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  amountBox: {
    backgroundColor: DS.primarySoft,
    borderRadius: RADIUS.md,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  amountLabel: {
    ...TYPO.b4,
    color: DS.textSecondary,
    marginBottom: 8,
  },
  amountValue: {
    ...TYPO.h4,
    color: DS.primary,
    fontWeight: WEIGHT.bold,
  },
  sectionTitle: {
    ...TYPO.label,
    color: DS.textSecondary,
    marginBottom: 12,
  },
  appList: {
    marginBottom: 24,
  },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    marginBottom: 12,
  },
  appCardActive: {
    borderColor: DS.primary,
    backgroundColor: '#F5F8FF',
  },
  appIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  appIconText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  appSub: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: DS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DS.primary,
  },
  payBtn: {
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
  step2Container: {
    alignItems: 'center',
    paddingTop: 10,
  },
  processingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  processingTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginTop: 24,
    marginBottom: 8,
  },
  processingSub: {
    ...TYPO.b3,
    color: DS.textSecondary,
  },
  questionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  questionTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
    marginBottom: 8,
    fontWeight: WEIGHT.bold,
  },
  questionSub: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginBottom: 32,
  },
  successBtn: {
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: '#34A853',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 16,
  },
  retryBtn: {
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  retryText: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  disabled: {
    opacity: 0.7,
  },
});
