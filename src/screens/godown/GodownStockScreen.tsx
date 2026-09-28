import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AppHeader from '../../components/common/AppHeader';
import ScreenContainer from '../../components/common/ScreenContainer';
import { DS, TYPO, EYEBROW, RADIUS, PALETTE, WEIGHT } from '../../constants/designSystem';
import { useDateRange } from '../../context/DateRangeContext';
import {
  getDefectiveLoads,
  getStockInLoads,
  getStockOutLoads,
} from '../../services/godownService';

type StockTab = 'in' | 'out' | 'defective';
type DefectiveFilter = 'ALL' | 'DEPOT' | 'GODOWN' | 'DELIVERY';

export default function GodownStockScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { rangeKey } = useDateRange();

  const [activeTab, setActiveTab] = useState<StockTab>('in');

  const [stockIn, setStockIn] = useState<any[]>([]);
  const [stockInLoading, setStockInLoading] = useState(false);

  const [stockOut, setStockOut] = useState<any[]>([]);
  const [stockOutLoading, setStockOutLoading] = useState(false);

  const [defectives, setDefectives] = useState<any[]>([]);
  const [defectiveLoading, setDefectiveLoading] = useState(false);
  const [defectiveSummary, setDefectiveSummary] = useState({
    depot: 0,
    godown: 0,
    delivery: 0,
  });

  const [defectiveFilter, setDefectiveFilter] =
    useState<DefectiveFilter>('ALL');

  const fetchStockInLoads = async () => {
    try {
      setStockInLoading(true);
      const data = await getStockInLoads();
      setStockIn(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log('Stock in loads error:', error);
    } finally {
      setStockInLoading(false);
    }
  };

  const fetchStockOutLoads = async () => {
    try {
      setStockOutLoading(true);
      const data = await getStockOutLoads();
      setStockOut(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log('Stock out loads error:', error);
    } finally {
      setStockOutLoading(false);
    }
  };

  const fetchDefectiveLoads = async () => {
    try {
      setDefectiveLoading(true);
      const data = await getDefectiveLoads();

      setDefectives(Array.isArray(data?.loads) ? data.loads : []);
      setDefectiveSummary(
        data?.summary || {
          depot: 0,
          godown: 0,
          delivery: 0,
        }
      );
    } catch (error) {
      console.log('Defective loads error:', error);
    } finally {
      setDefectiveLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStockInLoads();
      fetchStockOutLoads();
      fetchDefectiveLoads();

      if (tab === 'defective') {
        setActiveTab('defective');
      }

      const sub1 = DeviceEventEmitter.addListener('STOCK_IN_APPROVED', () => {
        fetchStockInLoads();
        setActiveTab('in');
      });

      const sub2 = DeviceEventEmitter.addListener('STOCK_OUT_APPROVED', () => {
        fetchStockOutLoads();
        setActiveTab('out');
      });

      const sub3 = DeviceEventEmitter.addListener('NEW_STOCK_OUT', () => {
        fetchStockOutLoads();
        setActiveTab('out');
      });

      const sub4 = DeviceEventEmitter.addListener('NEW_DEFECTIVE', () => {
        fetchDefectiveLoads();
        setActiveTab('defective');
      });

      const sub5 = DeviceEventEmitter.addListener('STOCK_OUT_CANCELLED', () => {
        fetchStockOutLoads();
        setActiveTab('out');
      });

      return () => {
        sub1.remove();
        sub2.remove();
        sub3.remove();
        sub4.remove();
        sub5.remove();
      };
    }, [tab])
  );

  useEffect(() => {
    fetchStockInLoads();
    fetchStockOutLoads();
    fetchDefectiveLoads();
  }, [rangeKey]);

  const todayStockIn = stockIn.filter(
    (item) => getDateLabel(item.date) === 'TODAY'
  );
  const yesterdayStockIn = stockIn.filter(
    (item) => getDateLabel(item.date) === 'YESTERDAY'
  );
  const olderStockIn = stockIn.filter(
    (item) =>
      getDateLabel(item.date) !== 'TODAY' &&
      getDateLabel(item.date) !== 'YESTERDAY'
  );

  const filteredDefectives =
    defectiveFilter === 'ALL'
      ? defectives
      : defectives.filter(
          (item) => item.type.toUpperCase() === defectiveFilter
        );

  return (
    <ScreenContainer>
      <AppHeader />

      <View style={styles.tabRow}>
        <TopTab
          title="Stock In"
          icon="arrow-down-circle-outline"
          active={activeTab === 'in'}
          onPress={() => setActiveTab('in')}
        />

        <TopTab
          title="Stock Out"
          icon="arrow-up-circle-outline"
          active={activeTab === 'out'}
          onPress={() => setActiveTab('out')}
        />

        <TopTab
          title="Defectives"
          icon="cube-outline"
          active={activeTab === 'defective'}
          onPress={() => setActiveTab('defective')}
        />
      </View>

      {activeTab === 'in' && (
        <View style={styles.content}>
          <Text style={styles.heading}>Stock In Loads</Text>
          <Text style={styles.subHeading}>All received loads, date-wise</Text>

          {stockInLoading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color={DS.primary} />
            </View>
          ) : (
            <>
              <DateHeader title="TODAY" count={`${todayStockIn.length} loads`} />

              {todayStockIn.map((item) => (
                <LoadCard
                  key={item.id}
                  item={item}
                  unit="CYLINDERS"
                  onPress={() => router.push(`/load/${item.id}` as any)}
                />
              ))}

              {yesterdayStockIn.length > 0 && (
                <>
                  <DateHeader
                    title="YESTERDAY"
                    count={`${yesterdayStockIn.length} loads`}
                  />

                  {yesterdayStockIn.map((item) => (
                    <LoadCard
                      key={item.id}
                      item={item}
                      unit="CYLINDERS"
                      onPress={() => router.push(`/load/${item.id}` as any)}
                    />
                  ))}
                </>
              )}

              {olderStockIn.length > 0 && (
                <>
                  <DateHeader
                    title="OLDER"
                    count={`${olderStockIn.length} loads`}
                  />

                  {olderStockIn.map((item) => (
                    <LoadCard
                      key={item.id}
                      item={item}
                      unit="CYLINDERS"
                      onPress={() => router.push(`/load/${item.id}` as any)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </View>
      )}

      {activeTab === 'out' && (
        <View style={styles.content}>
          <View style={styles.headingRow}>
            <View style={styles.headingTextBox}>
              <Text style={styles.heading}>Stock Out Loads</Text>
              <Text style={styles.subHeading}>
                All empty cylinder dispatches, date-wise
              </Text>
            </View>

            <TouchableOpacity
              style={styles.greenButton}
              onPress={() => router.push('/new-dispatch' as any)}
            >
              <Ionicons name="add" size={22} color={DS.white} />
              <Text style={styles.greenButtonText}>New Dispatch</Text>
            </TouchableOpacity>
          </View>

          {stockOutLoading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color={DS.primary} />
            </View>
          ) : (
            <>
              {groupLoadsByDate(stockOut).map((group) => (
                <View key={`stock-out-group-${group.title}`}>
                  <DateHeader
                    title={group.title}
                    count={`${group.items.length} loads`}
                  />

                  {group.items.map((item, index) => (
                    <LoadCard
                      key={`stock-out-${group.title}-${item.id}-${index}`}
                      item={item}
                      unit="EMPTIES"
                      onPress={() => router.push(`/load-out/${item.id}` as any)}
                    />
                  ))}
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {activeTab === 'defective' && (
        <View style={styles.content}>
          <View style={styles.headingRow}>
            <View style={styles.headingTextBox}>
              <Text style={styles.heading}>Defectives Loads</Text>
              <Text style={styles.subHeading}>
                All defective cylinder dispatches, date-wise
              </Text>
            </View>

            <TouchableOpacity
              style={styles.greenButton}
              onPress={() => router.push('/new-defective' as any)}
            >
              <Ionicons name="add" size={22} color={DS.white} />
              <Text style={styles.greenButtonText}>New Defective</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.defectiveStats}>
            <StatBox
              value={String(defectiveSummary.depot)}
              label="DEPOT"
              color={DS.primary}
              bg={DS.blueSoft}
              icon="car-outline"
            />

            <StatBox
              value={String(defectiveSummary.godown)}
              label="GODOWN"
              color={DS.orange}
              bg={DS.orangeSoft}
              icon="business-outline"
            />

            <StatBox
              value={String(defectiveSummary.delivery)}
              label="DELIVERY"
              color={DS.green}
              bg={DS.greenSoft}
              icon="bicycle-outline"
            />
          </View>

          <View style={styles.filterRow}>
            {(['ALL', 'DEPOT', 'GODOWN', 'DELIVERY'] as DefectiveFilter[]).map(
              (item) => {
                const active = defectiveFilter === item;

                return (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.filterPill,
                      active && styles.filterPillActive,
                    ]}
                    onPress={() => setDefectiveFilter(item)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        active && styles.filterTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </View>

          {defectiveLoading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color={DS.primary} />
            </View>
          ) : (
            <>
              <DateHeader
                title="TODAY"
                count={`${filteredDefectives.length} entries`}
              />

              {filteredDefectives.map((item, index) => (
                <View
                  key={`${item.id}-${item.type}-${item.time || ''}-${index}`}
                  style={styles.defectiveCard}
                >
                  <View style={styles.defectiveTop}>
                    <View
                      style={[
                        styles.defectiveIconBox,
                        { backgroundColor: getDefectiveBg(item.type) },
                      ]}
                    >
                      <Ionicons
                        name={getDefectiveIcon(item.type) as any}
                        size={22}
                        color={getDefectiveColor(item.type)}
                      />
                    </View>

                    <View style={styles.defectiveMiddle}>
                      <Text
                        style={[
                          styles.defectiveTag,
                          {
                            color: getDefectiveColor(item.type),
                            backgroundColor: getDefectiveBg(item.type),
                            borderColor: getDefectiveColor(item.type),
                          },
                        ]}
                      >
                        {item.tag}
                      </Text>

                      <Text style={styles.defectiveTitle}>{item.title}</Text>
                      <Text style={styles.defectiveDesc}>{item.desc}</Text>
                    </View>

                    <View style={styles.defectiveQtyBox}>
                      <Text style={styles.defectiveQty}>⚠ {item.qty}</Text>
                      <Text style={styles.defectiveQtyLabel}>DEFECTIVE</Text>
                    </View>
                  </View>

                  <View style={styles.defectiveFooter}>
                    <View style={styles.footerItem}>
                      <Ionicons
                        name="person-outline"
                        size={16}
                        color={DS.textSecondary}
                      />
                      <Text style={styles.footerText}>{item.person}</Text>
                    </View>

                    <View style={styles.footerItem}>
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={DS.textSecondary}
                      />
                      <Text style={styles.footerText}>{item.time}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

function TopTab({
  title,
  icon,
  active,
  onPress,
}: {
  title: string;
  icon: any;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.topTab, active && styles.topTabActive]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={15}
        color={active ? DS.primary : DS.textSecondary}
      />
      <Text style={[styles.topTabText, active && styles.topTabTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function DateHeader({ title, count }: { title: string; count: string }) {
  return (
    <View style={styles.dateHeader}>
      <Text style={styles.dateTitle}>{title}</Text>
      <View style={styles.dateLine} />
      <Text style={styles.dateCount}>{count}</Text>
    </View>
  );
}

function LoadCard({
  item,
  unit,
  onPress,
}: {
  item: any;
  unit: string;
  onPress: () => void;
}) {
  const approved = item.status === 'APPROVED';
  const cancelled = item.status === 'CANCELLED';
  const tripActive = Boolean(
    item.isTripActive || item.status === 'TRIP_IN_PROGRESS'
  );
  const badgeLabel = tripActive
    ? 'TRIP IN PROGRESS'
    : item.status === 'WAITING_APPROVAL'
    ? 'WAITING APPROVAL'
    : item.status;

  return (
    <TouchableOpacity
      style={styles.loadCard}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.loadTop}>
        <View style={styles.loadLeft}>
          <View style={styles.loadIconBox}>
            <Ionicons name="car-outline" size={22} color={DS.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.loadTitleRow}>
              <Text style={styles.loadTitle}>{item.load}</Text>

              <Text
                style={[
                  styles.statusBadge,
                  approved
                    ? styles.approvedBadge
                    : cancelled
                    ? styles.cancelledBadge
                    : tripActive
                    ? styles.tripActiveBadge
                    : styles.pendingBadge,
                ]}
              >
                {badgeLabel}
              </Text>
            </View>

            <Text style={styles.vehicleText}>{item.vehicle}</Text>
          </View>
        </View>

        <View style={styles.qtyBox}>
          <Text style={styles.qtyText}>{item.qty}</Text>
          <Text style={styles.loadUnit}>{unit}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Ionicons
            name="person-outline"
            size={13}
            color={DS.textSecondary}
          />
          <Text style={styles.cardFooterText}>{item.driver}</Text>
        </View>

        <View style={styles.footerItem}>
          <Ionicons
            name="document-text-outline"
            size={13}
            color={DS.textSecondary}
          />
          <Text style={styles.cardFooterText}>{item.invoice}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StatBox({
  value,
  label,
  color,
  bg,
  icon,
}: {
  value: string;
  label: string;
  color: string;
  bg: string;
  icon: any;
}) {
  return (
    <View style={[styles.statBox, { borderColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const getDateLabel = (dateValue: string) => {
  if (!dateValue) return 'TODAY';

  if (dateValue === 'TODAY' || dateValue === 'YESTERDAY') {
    return dateValue;
  }

  const input = new Date(dateValue);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const inputDate = input.toDateString();
  const todayDate = today.toDateString();
  const yesterdayDate = yesterday.toDateString();

  if (inputDate === todayDate) return 'TODAY';
  if (inputDate === yesterdayDate) return 'YESTERDAY';

  return 'OLDER';
};

const formatDateHeader = (dateValue: string) => {
  if (!dateValue) return '';

  const label = getDateLabel(dateValue);

  if (label === 'TODAY') return 'TODAY';
  if (label === 'YESTERDAY') return 'YESTERDAY';

  const date = new Date(dateValue);

  return date
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();
};

const groupLoadsByDate = (loads: any[]) => {
  const groups: Record<string, any[]> = {};

  loads.forEach((item) => {
    const rawDate = item.date || item.created_at;
    const key = formatDateHeader(rawDate);

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(item);
  });

  const orderValue = (title: string) => {
    if (title === 'TODAY') return 0;
    if (title === 'YESTERDAY') return 1;
    return 2;
  };

  return Object.keys(groups)
    .sort((a, b) => {
      const oa = orderValue(a);
      const ob = orderValue(b);

      if (oa !== ob) return oa - ob;

      const aDate = groups[a]?.[0]?.date || groups[a]?.[0]?.created_at;
      const bDate = groups[b]?.[0]?.date || groups[b]?.[0]?.created_at;

      return new Date(bDate).getTime() - new Date(aDate).getTime();
    })
    .map((title) => ({
      title,
      items: groups[title],
    }));
};

const getDefectiveColor = (type: string) => {
  if (type === 'depot') return DS.primary;
  if (type === 'delivery') return DS.green;
  return DS.orange;
};

const getDefectiveBg = (type: string) => {
  if (type === 'depot') return DS.blueSoft;
  if (type === 'delivery') return DS.greenSoft;
  return DS.orangeSoft;
};

const getDefectiveIcon = (type: string) => {
  if (type === 'delivery') return 'bicycle-outline';
  if (type === 'godown') return 'business-outline';
  return 'car-outline';
};

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    backgroundColor: DS.white,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  topTab: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  topTabActive: {
    borderBottomColor: DS.primary,
  },
  topTabText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textSecondary,
  },
  topTabTextActive: {
    color: DS.primary,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  loaderBox: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  headingTextBox: {
    flex: 1,
    paddingRight: 4,
  },
  heading: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },
  subHeading: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 4,
    marginBottom: 14,
  },
  greenButton: {
    height: 48,
    minWidth: 150,
    paddingHorizontal: 16,
    backgroundColor: DS.buttonGreen,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  greenButtonText: {
    ...TYPO.s2,
    color: DS.white,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  dateTitle: {
    ...EYEBROW,
    letterSpacing: 0.6,
    color: DS.textSecondary,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: DS.border,
    marginHorizontal: 8,
  },
  dateCount: {
    ...TYPO.c1,
    color: DS.textSecondary,
  },
  loadCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.md,
    marginBottom: 10,
    overflow: 'hidden',
  },
  loadTop: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loadLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  loadIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: DS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  loadTitle: {
    ...TYPO.s2,
    color: DS.textPrimary,
  },
  vehicleText: {
    ...TYPO.c1,
    color: DS.textSecondary,
    marginTop: 3,
  },
  statusBadge: {
    ...TYPO.c3,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  pendingBadge: {
    color: DS.orangeText,
    backgroundColor: DS.orangeSoft,
  },
  approvedBadge: {
    color: PALETTE.green600,
    backgroundColor: DS.greenSoft,
  },
  cancelledBadge: {
    color: DS.red,
    backgroundColor: DS.redSoft,
  },
  tripActiveBadge: {
    color: DS.primary,
    backgroundColor: DS.primarySoft,
  },
  qtyBox: {
    alignItems: 'center',
    marginLeft: 8,
  },
  qtyText: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },
  loadUnit: {
    ...EYEBROW,
    fontSize: 9,
    letterSpacing: 0.8,
    color: DS.textSecondary,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: DS.divider,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardFooterText: {
    ...TYPO.c2,
    color: DS.textPrimary,
  },
  defectiveStats: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 12,
    backgroundColor: DS.card,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    ...TYPO.h5,
    color: DS.textPrimary,
  },
  statLabel: {
    ...EYEBROW,
    fontSize: 10,
    letterSpacing: 0.5,
    color: DS.textSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
  },
  filterPillActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primary,
  },
  filterText: {
    ...TYPO.c2,
    color: DS.textSecondary,
  },
  filterTextActive: {
    color: DS.white,
  },
  defectiveCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: RADIUS.lg,
    marginBottom: 14,
    overflow: 'hidden',
  },
  defectiveTop: {
    minHeight: 120,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  defectiveIconBox: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  defectiveMiddle: {
    flex: 1,
    paddingRight: 72,
  },
  defectiveTag: {
    ...TYPO.c2,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.3,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  defectiveTitle: {
    ...TYPO.s1,
    color: DS.textPrimary,
  },
  defectiveDesc: {
    ...TYPO.b3,
    color: DS.textSecondary,
    marginTop: 4,
  },
  defectiveQtyBox: {
    position: 'absolute',
    right: 18,
    top: 18,
    alignItems: 'center',
  },
  defectiveQty: {
    ...TYPO.h4,
    color: DS.red,
  },
  defectiveQtyLabel: {
    ...EYEBROW,
    fontSize: 10,
    color: DS.textSecondary,
    letterSpacing: 1,
    marginTop: 2,
  },
  defectiveFooter: {
    borderTopWidth: 1,
    borderTopColor: DS.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  footerText: {
    ...TYPO.b4,
    fontWeight: WEIGHT.semibold,
    color: DS.textPrimary,
  },
});