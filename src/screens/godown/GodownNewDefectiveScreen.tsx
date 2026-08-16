import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AppHeader from '../../components/common/AppHeader';
import ScreenContainer from '../../components/common/ScreenContainer';
import { DS, TYPO, EYEBROW, RADIUS, WEIGHT } from '../../constants/designSystem';
import {
  createDefectiveLoad,
  getCylinderProducts,
  getDriverLists,
} from '../../services/godownService';

type Step = 1 | 2 | 3;
type Category = 'domestic' | 'commercial';
type StockFrom = 'depot' | 'godown' | 'driver';

export default function GodownNewDefectiveScreen() {
  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState<Category>('domestic');
  const [stockFrom, setStockFrom] = useState<StockFrom>('godown');

  const [products, setProducts] = useState<any>({
    domestic: [],
    commercial: [],
  });

  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);

  const [bayLocation, setBayLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      const [productData, driverData] = await Promise.all([
        getCylinderProducts(),
        getDriverLists(),
      ]);

      setProducts(productData || { domestic: [], commercial: [] });
      setDrivers(driverData || []);

      if (driverData?.length) {
        setSelectedDriver(driverData[0]);
      }
    } catch (error) {
      console.log('New defective initial data error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const selectedProducts = useMemo(() => {
    return products?.[category] || [];
  }, [products, category]);

  const total = selectedProducts.reduce((sum: number, item: any) => {
    return sum + Number(quantities[String(item.id)] || 0);
  }, 0);

  const handleSubmit = async () => {
    try {
      if (total <= 0) return;

      if (stockFrom === 'driver' && !selectedDriver?.id) return;

      setSubmitting(true);

      const items = selectedProducts
        .map((item: any) => ({
          product_id: item.id,
          quantity: Number(quantities[String(item.id)] || 0),
        }))
        .filter((item: any) => item.quantity > 0);

      await createDefectiveLoad({
        stock_from: stockFrom,
        driver_id: stockFrom === 'driver' ? selectedDriver.id : null,
        reference_id: Date.now(),
        bay_location: bayLocation,
        notes,
        items,
      });

      DeviceEventEmitter.emit('NEW_DEFECTIVE');
      router.back();
    } catch (error) {
      console.log('Create defective error:', error);
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


      <View style={styles.content}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back to Loads</Text>
        </TouchableOpacity>

        <StepHeader step={step} />

        {step === 1 && (
          <>
            <Text style={styles.label}>CYLINDER CATEGORY</Text>

            <View style={styles.categoryRow}>
              <CategoryCard
                title="Domestic"
                active={category === 'domestic'}
                onPress={() => setCategory('domestic')}
              />

              <CategoryCard
                title="Commercial"
                active={category === 'commercial'}
                onPress={() => setCategory('commercial')}
              />
            </View>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => setStep(2)}
            >
              <Text style={styles.nextButtonText}>Next: Items</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.sectionBetween}>
              <Text style={styles.label}>{category.toUpperCase()} ITEMS</Text>

              <TouchableOpacity onPress={() => setStep(1)}>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.groupCard}>
              {selectedProducts.map((item: any) => (
                <QtyRow
                  key={item.id}
                  label={item.name}
                  value={quantities[String(item.id)] || '0'}
                  onChange={(v) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [String(item.id)]: v,
                    }))
                  }
                />
              ))}
            </View>

            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>TOTAL DEFECTIVES</Text>
              <Text style={styles.totalValue}>{total}</Text>
            </View>

            <TouchableOpacity
              style={[styles.nextButton, total === 0 && styles.disabledButton]}
              onPress={() => setStep(3)}
              disabled={total === 0}
            >
              <Text style={styles.nextButtonText}>Next: Reason</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.label}>WHERE WERE THESE DEFECTIVES FOUND?</Text>

            <ReasonCard
              title="From Depot Load"
              desc="Damaged or leaking on arrival from depot"
              icon="car-outline"
              active={stockFrom === 'depot'}
              onPress={() => setStockFrom('depot')}
              color={DS.primary}
              bg={DS.primarySoft}
            />

            <ReasonCard
              title="Found in Godown"
              desc="Identified during warehouse inspection"
              icon="business-outline"
              active={stockFrom === 'godown'}
              onPress={() => setStockFrom('godown')}
              color={DS.orange}
              bg={DS.orangeSoft}
            />

            <ReasonCard
              title="Delivery Boy Return"
              desc="Returned from customer by delivery boy"
              icon="bicycle-outline"
              active={stockFrom === 'driver'}
              onPress={() => setStockFrom('driver')}
              color={DS.green}
              bg={DS.greenSoft}
            />

            {stockFrom === 'driver' && (
              <>
                <Text style={styles.label}>SELECT DRIVER</Text>

                <View style={styles.driverWrap}>
                  {drivers.map((driver) => (
                    <TouchableOpacity
                      key={driver.id}
                      style={[
                        styles.driverPill,
                        selectedDriver?.id === driver.id &&
                          styles.driverPillActive,
                      ]}
                      onPress={() => setSelectedDriver(driver)}
                    >
                      <Text
                        style={[
                          styles.driverText,
                          selectedDriver?.id === driver.id &&
                            styles.driverTextActive,
                        ]}
                      >
                        {driver.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}


            <TouchableOpacity
              style={[styles.nextButton, submitting && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Ionicons name="checkmark" size={18} color={DS.white} />
              <Text style={styles.nextButtonText}>
                {submitting ? 'Logging...' : `Log ${total} Defectives`}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function StepHeader({ step }: { step: Step }) {
  return (
    <View style={styles.stepRow}>
      <StepItem number={1} title="CATEGORY" active={step === 1} done={step > 1} />
      <View style={styles.stepLine} />
      <StepItem number={2} title="ITEMS" active={step === 2} done={step > 2} />
      <View style={styles.stepLine} />
      <StepItem number={3} title="REASON" active={step === 3} done={false} />
    </View>
  );
}

function StepItem({
  number,
  title,
  active,
  done,
}: {
  number: number;
  title: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <View style={styles.stepItem}>
      <View
        style={[
          styles.stepCircle,
          active && styles.stepCircleActive,
          done && styles.stepCircleDone,
        ]}
      >
        <Text style={styles.stepNumber}>{done ? '✓' : number}</Text>
      </View>

      <Text style={styles.stepTitle}>{title}</Text>
    </View>
  );
}

function CategoryCard({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.categoryCard, active && styles.categoryCardActive]}
      onPress={onPress}
    >
      <Ionicons
        name="cube-outline"
        size={26}
        color={active ? DS.white : DS.textPrimary}
      />
      <Text
        style={[
          styles.categoryText,
          active && {
            color: DS.white,
          },
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function QtyRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.qtyRow}>
      <Text style={styles.qtyLabel}>{label}</Text>

      <TextInput
        keyboardType="numeric"
        value={value}
        onChangeText={onChange}
        style={styles.qtyInput}
      />
    </View>
  );
}

function ReasonCard({
  title,
  desc,
  icon,
  active,
  onPress,
  color,
  bg,
}: {
  title: string;
  desc: string;
  icon: any;
  active: boolean;
  onPress: () => void;
  color: string;
  bg: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.reasonCard, active && styles.reasonCardActive]}
      onPress={onPress}
    >
      <View style={[styles.reasonIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.reasonTitle}>{title}</Text>
        <Text style={styles.reasonDesc}>{desc}</Text>
      </View>

      <Ionicons
        name={active ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={active ? DS.primary : DS.border}
      />
    </TouchableOpacity>
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
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  backText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.primary,
    marginBottom: 22,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primary,
  },
  stepCircleDone: {
    backgroundColor: DS.green,
    borderColor: DS.green,
  },
  stepNumber: {
    ...TYPO.c2,
    fontWeight: WEIGHT.semibold,
    color: DS.white,
  },
  stepTitle: {
    ...TYPO.c2,
    color: DS.textPrimary,
    marginLeft: 6,
  },
  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: DS.border,
    marginHorizontal: 8,
  },
  label: {
    ...EYEBROW,
    color: DS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    height: 82,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  categoryCardActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primary,
  },
  categoryText: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  nextButton: {
    height: 52,
    backgroundColor: DS.buttonGreen,
    borderRadius: RADIUS.lg,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  nextButtonText: {
    ...TYPO.s2,
    color: DS.white,
  },
  disabledButton: {
    opacity: 0.45,
  },
  sectionBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  changeText: {
    ...TYPO.c2,
    color: DS.primary,
    marginTop: 14,
  },
  groupCard: {
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  qtyRow: {
    minHeight: 58,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: DS.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyLabel: {
    ...TYPO.b4,
    color: DS.textPrimary,
    flex: 1,
  },
  qtyInput: {
    width: 108,
    height: 38,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.surface,
    borderRadius: RADIUS.sm,
    textAlign: 'center',
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  totalBox: {
    marginTop: 16,
    height: 52,
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
    color: DS.red,
  },
  reasonCard: {
    minHeight: 64,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reasonCardActive: {
    borderColor: DS.primary,
    backgroundColor: DS.primarySoft,
  },
  reasonIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reasonTitle: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
  },
  reasonDesc: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 2,
  },
  input: {
    minHeight: 50,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    ...TYPO.b2,
    color: DS.textPrimary,
  },
  notesInput: {
    minHeight: 74,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingTop: 12,
    ...TYPO.b4,
    color: DS.textPrimary,
    textAlignVertical: 'top',
  },
  driverWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  driverPill: {
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: DS.white,
  },
  driverPillActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primary,
  },
  driverText: {
    ...TYPO.c2,
    color: DS.textPrimary,
  },
  driverTextActive: {
    color: DS.white,
  },
});