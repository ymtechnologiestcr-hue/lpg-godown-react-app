import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAxiosError } from 'axios';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AppHeader from '../../components/common/AppHeader';
import ScreenContainer from '../../components/common/ScreenContainer';
import { AUTH_USER_KEY } from '../../constants/auth';
import { DS, TYPO, EYEBROW, RADIUS, WEIGHT } from '../../constants/designSystem';
import { getDispatchableCylinderProducts } from '../../services/godownService';
import {
  createEmptyCylinderLoad,
  getPurchaseManagers,
} from '../../services/emptyCylinderLoadService';
import type { PurchaseManagerOption } from '../../types';

export default function GodownNewDispatchScreen() {
  const [managers, setManagers] = useState<PurchaseManagerOption[]>([]);
  const [products, setProducts] = useState<any>({
    domestic: [],
    commercial: [],
  });

  const [selectedManager, setSelectedManager] =
    useState<PurchaseManagerOption | null>(null);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [erv, setErv] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [defectiveQuantities, setDefectiveQuantities] = useState<Record<string, string>>({});
  const [assignedBy, setAssignedBy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      const [managerData, productData] = await Promise.all([
        getPurchaseManagers(),
        getDispatchableCylinderProducts(),
      ]);

      setManagers(managerData || []);
      setProducts(productData || { domestic: [], commercial: [] });

      if (managerData?.length) {
        setSelectedManager(managerData[0]);
      }

      const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const id = Number(parsed?.id);
      if (id && !Number.isNaN(id)) {
        setAssignedBy(id);
      }
    } catch (error) {
      console.log('New dispatch initial data error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const allProducts = useMemo(
    () => [...(products.domestic || []), ...(products.commercial || [])],
    [products]
  );

  const totalEmpty = allProducts.reduce(
    (sum, item) => sum + Number(quantities[String(item.id)] || 0),
    0
  );

  const totalDefective = allProducts.reduce(
    (sum, item) => sum + Number(defectiveQuantities[String(item.id)] || 0),
    0
  );

  const updateQuantity = (productId: string | number, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');

    const product = allProducts.find(
      (item: any) => String(item.id) === String(productId)
    );
    const maxAllowed = Number(product?.emptyAvailable || 0);
    const bounded = Math.min(Number(cleanValue || 0), maxAllowed);

    setQuantities((prev) => ({
      ...prev,
      [String(productId)]: String(bounded),
    }));
  };

  const updateDefectiveQuantity = (productId: string | number, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');

    const product = allProducts.find(
      (item: any) => String(item.id) === String(productId)
    );
    const maxAllowed = Number(product?.defectiveAvailable || 0);
    const bounded = Math.min(Number(cleanValue || 0), maxAllowed);

    setDefectiveQuantities((prev) => ({
      ...prev,
      [String(productId)]: String(bounded),
    }));
  };

  const handleSubmit = async () => {
    if (!selectedManager || (totalEmpty <= 0 && totalDefective <= 0)) return;

    try {
      setSubmitting(true);

      const items = allProducts
        .map((item) => ({
          product_id: item.id,
          quantity: Number(quantities[String(item.id)] || 0),
          defective_quantity: Number(defectiveQuantities[String(item.id)] || 0),
        }))
        .filter((item) => item.quantity > 0 || item.defective_quantity > 0);

      await createEmptyCylinderLoad({
        assigned_by: assignedBy,
        purchase_manager_id: selectedManager.id,
        vehicle_number: vehicleNumber.trim() || null,
        erv_number: erv.trim() || null,
        items,
      });

      DeviceEventEmitter.emit('NEW_STOCK_OUT');

      Alert.alert('Success', 'Cylinder load dispatched to purchase driver');
      router.back();
    } catch (error) {
      const message =
        isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'Failed to dispatch cylinder load';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <AppHeader />

        <View style={styles.loaderBox}>
          <ActivityIndicator color={DS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader />

      <View style={styles.topTabs}>
        <Text style={styles.inactiveTab}>Stock In</Text>
        <Text style={styles.activeTab}>Stock Out</Text>
        <Text style={styles.inactiveTab}>Defectives</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back to Loads</Text>
        </TouchableOpacity>

        <Text style={styles.label}>SELECT PURCHASE DRIVER</Text>

        {managers.length ? (
          <>
            <TouchableOpacity
              style={styles.input}
              activeOpacity={0.85}
              onPress={() => setShowDriverDropdown((prev) => !prev)}
            >
              <Text style={styles.inputText}>
                {selectedManager?.name || 'Select Purchase Driver'}
              </Text>
            </TouchableOpacity>

            {showDriverDropdown && (
              <View style={styles.dropdown}>
                {managers.map((manager) => (
                  <TouchableOpacity
                    key={manager.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedManager(manager);
                      setShowDriverDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownText}>
                      {selectedManager?.id === manager.id ? '✓ ' : ''}
                      {manager.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              No purchase drivers found. Create a purchase manager user first.
            </Text>
          </View>
        )}

        <Text style={styles.label}>ERV NUMBER</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter 10-digit ERV number"
          placeholderTextColor={DS.textTertiary}
          value={erv}
          onChangeText={setErv}
          keyboardType="numeric"
        />

        <Text style={styles.label}>VEHICLE NUMBER</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter vehicle number"
          placeholderTextColor={DS.textTertiary}
          value={vehicleNumber}
          onChangeText={setVehicleNumber}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>DOMESTIC EMPTIES</Text>

        <View style={styles.groupCard}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderItem}>ITEM</Text>
            <Text style={styles.tableHeaderQty}>EMPTY</Text>
          </View>

          {(products.domestic || []).length ? (
            (products.domestic || []).map((item: any) => (
              <QtyRow
                key={item.id}
                label={item.name}
                maxEmpty={Number(item.emptyAvailable || 0)}
                value={quantities[String(item.id)] || '0'}
                onChange={(value) => updateQuantity(item.id, value)}
              />
            ))
          ) : (
            <Text style={styles.emptyRowText}>No domestic empties in stock.</Text>
          )}
        </View>

        <Text style={styles.label}>COMMERCIAL EMPTIES</Text>

        <View style={styles.groupCard}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderItem}>ITEM</Text>
            <Text style={styles.tableHeaderQty}>EMPTY</Text>
          </View>

          {(products.commercial || []).length ? (
            (products.commercial || []).map((item: any) => (
              <QtyRow
                key={item.id}
                label={item.name}
                maxEmpty={Number(item.emptyAvailable || 0)}
                value={quantities[String(item.id)] || '0'}
                onChange={(value) => updateQuantity(item.id, value)}
              />
            ))
          ) : (
            <Text style={styles.emptyRowText}>No commercial empties in stock.</Text>
          )}
        </View>

        <Text style={styles.label}>DOMESTIC DEFECTIVES</Text>

        <View style={styles.groupCard}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderItem}>ITEM</Text>
            <Text style={styles.tableHeaderQty}>DEFECTIVE</Text>
          </View>

          {(products.domestic || []).length ? (
            (products.domestic || []).map((item: any) => (
              <QtyRow
                key={item.id}
                label={item.name}
                maxEmpty={Number(item.defectiveAvailable || 0)}
                value={defectiveQuantities[String(item.id)] || '0'}
                onChange={(value) => updateDefectiveQuantity(item.id, value)}
              />
            ))
          ) : (
            <Text style={styles.emptyRowText}>No domestic defectives in stock.</Text>
          )}
        </View>

        <Text style={styles.label}>COMMERCIAL DEFECTIVES</Text>

        <View style={styles.groupCard}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderItem}>ITEM</Text>
            <Text style={styles.tableHeaderQty}>DEFECTIVE</Text>
          </View>

          {(products.commercial || []).length ? (
            (products.commercial || []).map((item: any) => (
              <QtyRow
                key={item.id}
                label={item.name}
                maxEmpty={Number(item.defectiveAvailable || 0)}
                value={defectiveQuantities[String(item.id)] || '0'}
                onChange={(value) => updateDefectiveQuantity(item.id, value)}
              />
            ))
          ) : (
            <Text style={styles.emptyRowText}>No commercial defectives in stock.</Text>
          )}
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>TOTAL EMPTIES</Text>
          <Text style={styles.totalValue}>{totalEmpty}</Text>
        </View>
        <View style={[styles.totalBox, { marginTop: 8 }]}>
          <Text style={styles.totalLabel}>TOTAL DEFECTIVES</Text>
          <Text style={styles.totalValue}>{totalDefective}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            ((totalEmpty === 0 && totalDefective === 0) || !selectedManager) && styles.disabledButton,
          ]}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={(totalEmpty === 0 && totalDefective === 0) || !selectedManager || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={DS.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={DS.white} />
              <Text style={styles.submitText}>Confirm the Return</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

function QtyRow({
  label,
  maxEmpty,
  value,
  onChange,
}: {
  label: string;
  maxEmpty: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.qtyRow}>
      <View style={styles.qtyLabelWrap}>
        <Text style={styles.qtyLabel}>{label}</Text>
        <Text style={styles.qtyHint}>Max: {maxEmpty}</Text>
      </View>

      <TextInput
        keyboardType="numeric"
        value={value}
        onChangeText={onChange}
        editable={maxEmpty > 0}
        style={[styles.qtyInput, maxEmpty <= 0 && styles.qtyInputDisabled]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loaderBox: {
    height: 400,
    alignItems: 'center',
    justifyContent: 'center',
  },

  topTabs: {
    height: 44,
    backgroundColor: DS.white,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  activeTab: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.primary,
    borderBottomWidth: 2,
    borderBottomColor: DS.primary,
    paddingBottom: 12,
  },

  inactiveTab: {
    ...TYPO.b4,
    color: DS.textSecondary,
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 140,
  },

  backText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.primary,
    marginBottom: 22,
  },

  label: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 14,
  },

  input: {
    minHeight: 54,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: WEIGHT.medium,
    color: DS.textPrimary,
  },

  inputText: {
    ...TYPO.b2,
    color: DS.textPrimary,
  },

  dropdown: {
    backgroundColor: DS.surface,
    borderRadius: RADIUS.sm,
    marginTop: 4,
    paddingVertical: 4,
    elevation: 4,
    zIndex: 20,
  },

  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 9,
  },

  dropdownText: {
    ...TYPO.b3,
    color: DS.textPrimary,
  },

  warningBox: {
    backgroundColor: DS.orangeSoft,
    borderRadius: RADIUS.md,
    padding: 14,
  },

  warningText: {
    ...TYPO.b3,
    color: DS.orangeText,
  },

  groupCard: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },

  tableHeader: {
    height: 38,
    backgroundColor: DS.surface,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  tableHeaderItem: {
    ...EYEBROW,
    flex: 1,
    color: DS.textSecondary,
    letterSpacing: 0.6,
  },

  tableHeaderQty: {
    ...EYEBROW,
    width: 94,
    color: DS.textSecondary,
    letterSpacing: 0.6,
    textAlign: 'center',
  },

  emptyRowText: {
    ...TYPO.b3,
    color: DS.textSecondary,
    padding: 16,
  },

  qtyRow: {
    minHeight: 72,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: DS.divider,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  qtyLabel: {
    ...TYPO.b4,
    color: DS.textPrimary,
    flex: 1,
  },

  qtyLabelWrap: {
    flex: 1,
  },

  qtyHint: {
    ...TYPO.c1,
    marginTop: 2,
    color: DS.textSecondary,
  },

  qtyInput: {
    width: 94,
    height: 44,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.surface,
    borderRadius: RADIUS.sm,
    textAlign: 'center',
    ...TYPO.s2,
    color: DS.textPrimary,
  },

  qtyInputDisabled: {
    backgroundColor: DS.border,
    borderColor: DS.border,
    color: DS.textTertiary,
    opacity: 0.6,
  },

  totalBox: {
    marginTop: 18,
    height: 58,
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  totalLabel: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.8,
  },

  totalValue: {
    ...TYPO.h5,
    color: DS.primary,
  },

  submitButton: {
    height: 52,
    backgroundColor: DS.buttonGreen,
    borderRadius: RADIUS.lg,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  disabledButton: {
    opacity: 0.45,
  },

  submitText: {
    ...TYPO.s2,
    color: DS.white,
  },
});
