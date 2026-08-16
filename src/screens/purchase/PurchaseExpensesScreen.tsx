import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import ScreenContainer from '../../components/common/ScreenContainer';
import { DS, TYPO, EYEBROW, RADIUS, PALETTE, WEIGHT } from '../../constants/designSystem';
import {
  createPurchaseExpense,
  getActivePurchaseTrip,
  getPurchaseBootstrap,
  getPurchaseExpenses,
  uploadSupportingDocument,
} from '../../services/purchaseService';
import type { PurchaseExpense, PurchaseTripOverview } from '../../types';

const expenseCategories = [
  'Diesel',
  'Vehicle Maintenance',
  'Driver Bata',
  'Food',
  'Toll',
  'Other',
] as const;

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN')}`;

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const formatExpenseDate = (iso: string) => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const day = date.getDate();
  const month = MONTH_LABELS[date.getMonth()];
  const rawHours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const meridiem = rawHours >= 12 ? 'pm' : 'am';
  const hours = (rawHours % 12 || 12).toString().padStart(2, '0');

  return `${day} ${month}, ${hours}:${minutes} ${meridiem}`;
};

export default function PurchaseExpensesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<PurchaseExpense[]>([]);
  const [activeTrip, setActiveTrip] = useState<PurchaseTripOverview | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Diesel');
  const [amount, setAmount] = useState('');
  const [billUri, setBillUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setSelectedCategory('Diesel');
    setAmount('');
    setBillUri(null);
  };

  const fetchData = async (withRefresh = false) => {
    try {
      if (withRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const bootstrap = await getPurchaseBootstrap();
      setUserId(bootstrap.manager.id);

      const [expenseList, trip] = await Promise.all([
        getPurchaseExpenses(bootstrap.manager.id),
        getActivePurchaseTrip(bootstrap.manager.id),
      ]);

      setExpenses(expenseList);
      setActiveTrip(trip);
    } catch (error) {
      console.log('Purchase expenses error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    const subscription = DeviceEventEmitter.addListener(
      'PURCHASE_FLOW_UPDATED',
      () => {
        fetchData(true);
      }
    );

    return () => subscription.remove();
  }, []);

  const handlePickBill = async (source: 'camera' | 'gallery') => {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.6,
        });

        if (!result.canceled) {
          setBillUri(result.assets[0]?.uri ?? null);
        }

        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
      });

      if (!result.canceled) {
        setBillUri(result.assets[0]?.uri ?? null);
      }
    } catch (error) {
      console.log('Pick expense bill error:', error);
    }
  };

  const handleSubmit = async () => {
    if (!activeTrip || !userId) {
      Alert.alert('No active trip', 'Start a purchase trip before adding expenses.');
      return;
    }

    const numericAmount = Number(amount);
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Enter amount', 'Please enter an expense amount greater than 0.');
      return;
    }

    try {
      setSubmitting(true);

      // Bill is optional. When attached, upload it first and store the server URL.
      let uploadedBillUrl: string | null = null;
      if (billUri) {
        try {
          uploadedBillUrl = await uploadSupportingDocument(billUri);
        } catch (uploadError) {
          console.log('Upload expense bill error:', uploadError);
          Alert.alert('Upload failed', 'Could not upload the bill image. Please try again.');
          return;
        }
      }

      await createPurchaseExpense({
        category: selectedCategory,
        amount: numericAmount,
        createdBy: userId,
        billUrl: uploadedBillUrl,
      });

      resetForm();
      setShowModal(false);
      DeviceEventEmitter.emit('PURCHASE_FLOW_UPDATED');
    } catch (error: any) {
      console.log('Create purchase expense error:', error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Something went wrong while submitting the expense.';
      Alert.alert('Could not submit expense', message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);
  const canAddExpense = activeTrip?.status === 'IN_PROGRESS';

  return (
    <>
      <ScreenContainer
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />
        }
      >
        <View style={styles.content}>
          <View style={styles.headerCard}>
            <View>
              <Text style={styles.headerLabel}>ALL EXPENSES</Text>
              <Text style={styles.headerAmount}>{formatCurrency(totalAmount)}</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.addExpenseButton,
                !canAddExpense ? styles.addExpenseButtonDisabled : null,
              ]}
              disabled={!canAddExpense}
              onPress={() => setShowModal(true)}
            >
              <Ionicons name="add" size={16} color={DS.white} />
              <Text style={styles.addExpenseText}>Add Expense</Text>
            </TouchableOpacity>
          </View>

          {!canAddExpense ? (
            <View style={styles.noticeCard}>
              <Ionicons name="information-circle-outline" size={18} color={DS.primary} />
              <Text style={styles.noticeText}>
                Expenses can only be added after a trip starts and before it is submitted for approval.
              </Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color={DS.primary} />
            </View>
          ) : expenses.length ? (
            expenses.map((expense) => (
              <View key={expense.id} style={styles.expenseCard}>
                <View style={styles.expenseIconWrap}>
                  <Ionicons name="document-text-outline" size={20} color={DS.primary} />
                </View>

                <View style={styles.expenseBody}>
                  <Text style={styles.expenseTitle}>{expense.category}</Text>
                  <Text style={styles.expenseMeta}>
                    {expense.tripId ? `Trip #${expense.tripId} • ` : ''}
                    {formatExpenseDate(expense.createdAt)}
                  </Text>
                </View>

                <View style={styles.expenseRight}>
                  <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
                  <View style={styles.pendingPill}>
                    <Text style={styles.pendingText}>{expense.status}</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={28} color={DS.primary} />
              <Text style={styles.emptyTitle}>No expenses recorded</Text>
              <Text style={styles.emptySubtitle}>
                Add diesel, driver bata, toll and other purchase-trip expenses from here.
              </Text>
            </View>
          )}
        </View>
      </ScreenContainer>

      <Modal animationType="slide" transparent visible={showModal} onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Record Expense</Text>

              <Text style={styles.sectionLabel}>CATEGORY</Text>
              <View style={styles.categoryGrid}>
                {expenseCategories.map((category) => {
                  const active = category === selectedCategory;

                  return (
                    <TouchableOpacity
                      key={category}
                      activeOpacity={0.85}
                      style={[styles.categoryChip, active ? styles.categoryChipActive : null]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text style={[styles.categoryChipText, active ? styles.categoryChipTextActive : null]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>AMOUNT</Text>
              <View style={styles.amountField}>
                <Text style={styles.rupeeMark}>₹</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  style={styles.amountInput}
                />
              </View>

              <Text style={styles.sectionLabel}>UPLOAD BILL</Text>
              <View style={styles.uploadCard}>
                {billUri ? (
                  <Image source={{ uri: billUri }} style={styles.billPreview} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons name="camera-outline" size={28} color={DS.textTertiary} />
                    <Text style={styles.uploadHint}>Tap to capture / upload</Text>
                  </View>
                )}
              </View>

              <View style={styles.uploadActionRow}>
                <TouchableOpacity style={styles.uploadActionButton} onPress={() => handlePickBill('camera')}>
                  <Ionicons name="camera-outline" size={18} color={DS.primary} />
                  <Text style={styles.uploadActionText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.uploadActionButton} onPress={() => handlePickBill('gallery')}>
                  <Ionicons name="images-outline" size={18} color={DS.primary} />
                  <Text style={styles.uploadActionText}>Gallery</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.submitButton,
                  !amount || Number(amount) <= 0 || submitting
                    ? styles.submitButtonDisabled
                    : null,
                ]}
                disabled={submitting}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : 'Submit Expense'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  resetForm();
                  setShowModal(false);
                }}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 110,
  },
  headerCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLabel: {
    ...EYEBROW,
    color: DS.textTertiary,
    letterSpacing: 0.8,
  },
  headerAmount: {
    ...TYPO.h5,
    color: DS.textPrimary,
    marginTop: 4,
  },
  addExpenseButton: {
    backgroundColor: DS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addExpenseButtonDisabled: {
    backgroundColor: PALETTE.primary200,
  },
  addExpenseText: {
    ...TYPO.c2,
    color: DS.white,
  },
  noticeCard: {
    backgroundColor: DS.primarySoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.primarySoftBorder,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  noticeText: {
    ...TYPO.b3,
    flex: 1,
    color: DS.textSecondary,
  },
  loaderBox: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  expenseIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: DS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseBody: {
    flex: 1,
    marginLeft: 12,
  },
  expenseTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  expenseMeta: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  pendingPill: {
    backgroundColor: DS.orangeSoft,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 5,
  },
  pendingText: {
    ...TYPO.c3,
    color: DS.orangeText,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.3,
  },
  emptyCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    padding: 24,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,13,18,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '90%',
    backgroundColor: DS.card,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: 16,
    paddingBottom: 22,
  },
  modalHandle: {
    width: 48,
    height: 5,
    backgroundColor: DS.grey300,
    borderRadius: 99,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  modalTitle: {
    ...TYPO.h5,
    color: DS.textPrimary,
    marginBottom: 18,
  },
  sectionLabel: {
    ...EYEBROW,
    color: DS.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 6,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    minWidth: '31%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.card,
    paddingHorizontal: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  categoryChipActive: {
    borderColor: DS.primary,
    backgroundColor: DS.primarySoft,
  },
  categoryChipText: {
    ...TYPO.c2,
    color: DS.textSecondary,
    textAlign: 'center',
  },
  categoryChipTextActive: {
    color: DS.primary,
  },
  amountField: {
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.surface,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rupeeMark: {
    ...TYPO.h5,
    color: DS.textSecondary,
  },
  amountInput: {
    flex: 1,
    marginLeft: 8,
    color: DS.textPrimary,
    fontSize: 24,
    fontWeight: WEIGHT.semibold,
  },
  uploadCard: {
    minHeight: 116,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    borderStyle: 'dashed',
    backgroundColor: DS.surface,
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    minHeight: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadHint: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 8,
  },
  billPreview: {
    width: '100%',
    height: 150,
  },
  uploadActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  uploadActionButton: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.primarySoftBorder,
    backgroundColor: DS.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadActionText: {
    ...TYPO.b4,
    color: DS.primary,
  },
  submitButton: {
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: DS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: PALETTE.primary200,
  },
  submitButtonText: {
    ...TYPO.s2,
    color: DS.white,
  },
  modalCloseButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  modalCloseText: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },
});