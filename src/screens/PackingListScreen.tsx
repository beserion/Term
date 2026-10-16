import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { TopAppBar } from '../components/TopAppBar';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/Toast';
import { CustomIcon } from '../components/CustomIcon';
import { Colors, Spacing, Typography, BorderRadius, Shadow } from '../theme';
import { useDebounce } from '../hooks/useDebounce';
import {
  getActivePackingOrders,
  PackingOrder,
  assignPackingOrder,
  releasePackingOrder,
} from '../services/packing';
import { useUIStore } from '../store/uiStore';
import { useOperatorStore, WarehouseOperator } from '../store/operatorStore';
import { OperatorBadge } from '../components/OperatorBadge';
import { OperatorSelectModal } from '../components/OperatorSelectModal';
import { FeedbackService } from '../services/feedback';
import { terminalNotificationService } from '../services/terminalNotificationService';

type FilterTab = 'myTasks' | 'unassigned' | 'all';

export function PackingListScreen() {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<PackingOrder[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search);
  const showToast = useUIStore((s) => s.showToast);

  const { activeOperator, loadOperators } = useOperatorStore();
  const [activeTab, setActiveTab] = useState<FilterTab>('myTasks');
  const [filterOperator, setFilterOperator] = useState<WarehouseOperator | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [actionInProgressOrderId, setActionInProgressOrderId] = useState<number | null>(null);

  useEffect(() => {
    loadOperators();
  }, [loadOperators]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getActivePackingOrders(debouncedSearch || undefined);
      setOrders(data.filter((o) => !o.isPackingCompleted && (o.packedRatio === undefined || o.packedRatio < 100)));
    } catch (error: any) {
      showToast({ message: error?.message || 'Aktif paketleme siparişleri yüklenemedi', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  // Canlı Bildirim Dinleyicisi (Web'den atanan görevde listeyi otomatik yeniler)
  useEffect(() => {
    const unsubscribe = terminalNotificationService.subscribe((event) => {
      if (event.type === 'task_assigned' || event.type === 'reload_tasks' || event.type === 'polled_new_task') {
        fetchOrders();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // İşi Üzerime Al / Zimmetle
  const handleClaimOrder = async (order: PackingOrder) => {
    if (!activeOperator) {
      FeedbackService.playLightImpact();
      showToast({
        message: 'Lütfen önce yukarıdaki alandan depocu/operatör seçiniz.',
        type: 'info',
      });
      return;
    }

    const orderId = order.orderId || order.id;
    const isOtherAssigned =
      order.assignedOperatorId &&
      order.assignedOperatorId !== activeOperator.id &&
      order.assignedOperatorName?.toLowerCase() !== activeOperator.fullName.toLowerCase();

    const executeAssignment = async (force: boolean) => {
      try {
        setActionInProgressOrderId(orderId);
        FeedbackService.playLightImpact();
        const res = await assignPackingOrder(orderId, activeOperator.id, activeOperator.fullName, force);

        FeedbackService.playSuccess();
        showToast({
          message: res.message || `${order.documentNo} üzerinize alındı.`,
          type: 'success',
        });

        // Yerel listeyi anında güncelle
        setOrders((prev) =>
          prev.map((o) =>
            (o.orderId || o.id) === orderId
              ? {
                  ...o,
                  assignedOperatorId: activeOperator.id,
                  assignedOperatorCode: activeOperator.employeeCode,
                  assignedOperatorName: activeOperator.fullName,
                  assignedDate: new Date().toISOString(),
                  workStatus: 'InProgress',
                }
              : o
          )
        );
      } catch (err: any) {
        FeedbackService.playError();
        showToast({
          message: err?.message || 'Sipariş üzerinize alınamadı.',
          type: 'error',
        });
      } finally {
        setActionInProgressOrderId(null);
      }
    };

    if (isOtherAssigned) {
      Alert.alert(
        'Siparişi Devral',
        `Bu sipariş şu anda "${order.assignedOperatorName}" tarafından paketlenmektedir.\n\nSiparişi devralıp kendi üzerinize almak istiyor musunuz?`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Devral',
            style: 'destructive',
            onPress: () => executeAssignment(true),
          },
        ]
      );
    } else {
      await executeAssignment(false);
    }
  };

  // İşi Açık Havuza Bırak
  const handleReleaseOrder = async (order: PackingOrder) => {
    const orderId = order.orderId || order.id;
    Alert.alert(
      'Havuza Geri Bırak',
      `"${order.documentNo}" siparişini açık iş havuzuna bırakmak istiyor musunuz?\n\nBu işlemden sonra diğer operatörler siparişi üzerlerine alabilir.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Havuza Bırak',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionInProgressOrderId(orderId);
              FeedbackService.playLightImpact();
              await releasePackingOrder(orderId, activeOperator?.id);

              FeedbackService.playSuccess();
              showToast({
                message: `${order.documentNo} açık havuza bırakıldı.`,
                type: 'info',
              });

              // Yerel listeyi anında güncelle
              setOrders((prev) =>
                prev.map((o) =>
                  (o.orderId || o.id) === orderId
                    ? {
                        ...o,
                        assignedOperatorId: null,
                        assignedOperatorCode: null,
                        assignedOperatorName: null,
                        assignedDate: null,
                        workStatus: 'Unassigned',
                      }
                    : o
                )
              );
            } catch (err: any) {
              FeedbackService.playError();
              showToast({
                message: err?.message || 'Sipariş havuza bırakılamadı.',
                type: 'error',
              });
            } finally {
              setActionInProgressOrderId(null);
            }
          },
        },
      ]
    );
  };

  // Sekme Sayaçları
  const { myOrdersCount, unassignedCount, allOrdersCount } = useMemo(() => {
    let myCount = 0;
    let unassigned = 0;

    orders.forEach((o) => {
      const isAssigned = !!o.assignedOperatorId || !!o.assignedOperatorName;
      const isMine =
        activeOperator &&
        ((o.assignedOperatorId && o.assignedOperatorId === activeOperator.id) ||
          (o.assignedOperatorName &&
            o.assignedOperatorName.trim().toLowerCase() === activeOperator.fullName.trim().toLowerCase()));

      if (isMine) myCount++;
      if (!isAssigned) unassigned++;
    });

    return {
      myOrdersCount: myCount,
      unassignedCount: unassigned,
      allOrdersCount: orders.length,
    };
  }, [orders, activeOperator]);

  // Filtrelenmiş Liste
  const filteredOrders = useMemo(() => {
    if (filterOperator) {
      return orders.filter(
        (o) =>
          o.assignedOperatorId === filterOperator.id ||
          (o.assignedOperatorName &&
            o.assignedOperatorName.trim().toLowerCase() === filterOperator.fullName.trim().toLowerCase())
      );
    }

    if (activeTab === 'myTasks') {
      if (!activeOperator) return orders;
      return orders.filter(
        (o) =>
          (o.assignedOperatorId && o.assignedOperatorId === activeOperator.id) ||
          (o.assignedOperatorName &&
            o.assignedOperatorName.trim().toLowerCase() === activeOperator.fullName.trim().toLowerCase())
      );
    }

    if (activeTab === 'unassigned') {
      return orders.filter((o) => !o.assignedOperatorId && !o.assignedOperatorName);
    }

    return orders;
  }, [orders, activeTab, filterOperator, activeOperator]);

  const renderPackingOrderCard = ({ item }: { item: PackingOrder }) => {
    const isDone = !!item.isPackingCompleted || (item.packedRatio !== undefined && item.packedRatio >= 100);
    const hasProgress = !isDone && (item.packedRatio || 0) > 0;
    const isReceiptDone = item.isReceiptCompleted !== false;

    const isAssigned = !!item.assignedOperatorId || !!item.assignedOperatorName;
    const isAssignedToMe =
      activeOperator &&
      ((item.assignedOperatorId && item.assignedOperatorId === activeOperator.id) ||
        (item.assignedOperatorName &&
          item.assignedOperatorName.trim().toLowerCase() === activeOperator.fullName.trim().toLowerCase()));

    const isAssignedOther = isAssigned && !isAssignedToMe;
    const orderId = item.orderId || item.id;
    const isBusy = actionInProgressOrderId === orderId;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isDone && { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
          !isDone && !isReceiptDone && { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
          isAssignedToMe && { borderColor: '#10B981', borderLeftWidth: 4 },
        ]}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('PackingSuppliers', {
            requestId: item.id,
            orderId: item.orderId || item.id,
            documentNo: item.documentNo,
            partnerName: item.partnerName,
            rfqNo: item.rfqNo,
            vesselName: item.vesselName,
            productCount: item.productCount,
            isReceiptCompleted: isReceiptDone,
          })
        }
      >
        <View style={styles.cardHeader}>
          <View style={styles.docInfo}>
            <CustomIcon
              name={isDone ? 'check-circle' : 'package-variant-closed'}
              size={22}
              color={isDone ? '#047857' : isAssignedToMe ? '#10B981' : Colors.primary}
            />
            <View style={styles.docTextWrapper}>
              <Text style={styles.docNo} numberOfLines={1}>
                {item.documentNo}
              </Text>
              {item.rfqNo && item.documentNo !== item.rfqNo ? (
                <Text style={styles.subRfqNo}>Talep: {item.rfqNo}</Text>
              ) : null}
            </View>
          </View>
          <View
            style={[
              styles.badgeContainer,
              isDone
                ? { backgroundColor: '#ECFDF5' }
                : hasProgress
                ? { backgroundColor: '#E0F2FE' }
                : !isReceiptDone
                ? { backgroundColor: '#FEF3C7' }
                : undefined,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                isDone
                  ? { color: '#047857' }
                  : hasProgress
                  ? { color: '#0284C7' }
                  : !isReceiptDone
                  ? { color: '#D97706' }
                  : undefined,
              ]}
            >
              {isDone
                ? 'PAKETLENDİ'
                : hasProgress
                ? `%${item.packedRatio} Paketlendi`
                : !isReceiptDone
                ? 'MAL KABUL BEKLİYOR'
                : item.status || 'Paketlenecek'}
            </Text>
          </View>
        </View>

        {/* Kurumsal Görev & Zimmet Satırı */}
        <View style={styles.assignmentRow}>
          {isAssignedToMe ? (
            <View style={styles.assignedBadgeMe}>
              <CustomIcon name="check-circle" size={13} color="#059669" />
              <Text style={styles.assignedBadgeMeText}>Bana Atandı</Text>
            </View>
          ) : isAssignedOther ? (
            <View style={styles.assignedBadgeOther}>
              <CustomIcon name="account" size={13} color="#2563EB" />
              <Text style={styles.assignedBadgeOtherText} numberOfLines={1}>
                {item.assignedOperatorName || 'Başka Personel'}
              </Text>
            </View>
          ) : (
            <View style={styles.unassignedBadge}>
              <CustomIcon name="clock-outline" size={13} color="#D97706" />
              <Text style={styles.unassignedBadgeText}>Açık Havuz (Boşta)</Text>
            </View>
          )}

          {!isDone && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isBusy ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 6 }} />
              ) : isAssignedToMe ? (
                <TouchableOpacity
                  style={styles.releaseActionBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleReleaseOrder(item);
                  }}
                  activeOpacity={0.7}
                >
                  <CustomIcon name="close" size={13} color="#EF4444" />
                  <Text style={styles.releaseActionText}>Havuza Bırak</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.claimActionBtn, isAssignedOther && styles.handoverActionBtn]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleClaimOrder(item);
                  }}
                  activeOpacity={0.7}
                >
                  <CustomIcon
                    name={isAssignedOther ? 'swap-horizontal' : 'hand-pointing-right'}
                    size={13}
                    color="#fff"
                  />
                  <Text style={styles.claimActionText}>
                    {isAssignedOther ? 'Devral' : 'İşi Üzerime Al'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          {/* Gemi Adı */}
          <View style={styles.detailRow}>
            <CustomIcon name="ship" size={16} color={Colors.primary} />
            <Text style={styles.vesselText}>
              <Text style={styles.boldLabel}>Gemi: </Text>
              {item.vesselName || 'Belirtilmemiş'}
            </Text>
          </View>

          {/* Müşteri / Cari Bilgisi */}
          <View style={styles.detailRow}>
            <CustomIcon name="account" size={16} color={Colors.outline} />
            <Text style={styles.partnerName} numberOfLines={1}>
              {item.partnerName || 'Cari Belirtilmemiş'}
            </Text>
          </View>

          {/* Alt Tedarikçi Firmalar (Varsa) */}
          {item.supplierNames && item.supplierNames.length > 0 ? (
            <View style={styles.detailRow}>
              <CustomIcon name="storefront-outline" size={16} color={Colors.primary} />
              <Text style={styles.supplierNamesText} numberOfLines={1}>
                <Text style={styles.boldLabel}>Tedarikçiler ({item.supplierNames.length}): </Text>
                {item.supplierNames.join(', ')}
              </Text>
            </View>
          ) : null}

          <View style={styles.cardFooter}>
            <View style={styles.statItem}>
              <CustomIcon name="format-list-bulleted" size={16} color={Colors.secondary} />
              <Text style={styles.statText}>
                {item.productCount || 0} Kalem
                {(item.boxCount || 0) > 0 || (item.palletCount || 0) > 0
                  ? ` • ${item.boxCount || 0} Koli${(item.palletCount || 0) > 0 ? `, ${item.palletCount} Palet` : ''}`
                  : ''}
              </Text>
            </View>

            <View style={styles.actionLink}>
              <Text style={[styles.actionText, isDone && { color: '#047857' }]}>
                {isDone ? 'İncele' : 'Tedarikçiler'}
              </Text>
              <CustomIcon
                name="chevron-right"
                size={20}
                color={isDone ? '#047857' : Colors.primary}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TopAppBar
        title="Koli & Palet Paketleme"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      {/* 1. Üst Depocu / Operatör Kartı */}
      <View style={styles.operatorContainer}>
        <OperatorBadge compact={false} />
      </View>

      {/* 2. Arama Çubuğu */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Sipariş No, RFQ veya Müşteri Ara..."
        />
      </View>

      {/* 3. Kurumsal Görev Filtre Sekmeleri (Segment Tabs) */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'myTasks' && !filterOperator && styles.activeTabButton]}
            onPress={() => {
              setFilterOperator(null);
              setActiveTab('myTasks');
            }}
            activeOpacity={0.7}
          >
            <CustomIcon
              name="account"
              size={15}
              color={activeTab === 'myTasks' && !filterOperator ? '#fff' : Colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'myTasks' && !filterOperator && styles.activeTabText,
              ]}
            >
              Bana Ait ({myOrdersCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'unassigned' && !filterOperator && styles.activeTabButton]}
            onPress={() => {
              setFilterOperator(null);
              setActiveTab('unassigned');
            }}
            activeOpacity={0.7}
          >
            <CustomIcon
              name="package-variant"
              size={15}
              color={activeTab === 'unassigned' && !filterOperator ? '#fff' : Colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'unassigned' && !filterOperator && styles.activeTabText,
              ]}
            >
              Açık Havuz ({unassignedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'all' && !filterOperator && styles.activeTabButton]}
            onPress={() => {
              setFilterOperator(null);
              setActiveTab('all');
            }}
            activeOpacity={0.7}
          >
            <CustomIcon
              name="earth"
              size={15}
              color={activeTab === 'all' && !filterOperator ? '#fff' : Colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'all' && !filterOperator && styles.activeTabText,
              ]}
            >
              Tümü ({allOrdersCount})
            </Text>
          </TouchableOpacity>

          {/* Personel Seçici Filtre Butonu */}
          <TouchableOpacity
            style={[
              styles.tabButton,
              styles.filterPersonButton,
              !!filterOperator && styles.activePersonFilterButton,
            ]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}
          >
            <CustomIcon
              name="account-search-outline"
              size={15}
              color={filterOperator ? '#fff' : Colors.primary}
            />
            <Text
              style={[
                styles.tabText,
                !!filterOperator && styles.activeTabText,
                !filterOperator && { color: Colors.primary },
              ]}
            >
              {filterOperator ? filterOperator.fullName : 'Personel Filtresi'}
            </Text>
            {filterOperator && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setFilterOperator(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 4 }}
              >
                <CustomIcon name="close-circle" size={15} color="#fff" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Yükleniyor Göstergesi veya Liste */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Paketleme siparişleri yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderPackingOrderCard}
          keyExtractor={(item, index) => `${item.id}-${item.orderId || index}`}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={
                filterOperator
                  ? 'account-question'
                  : activeTab === 'myTasks'
                  ? 'account-check-outline'
                  : 'package-variant-closed'
              }
              title={
                filterOperator
                  ? `${filterOperator.fullName} Üzerinde İş Yok`
                  : activeTab === 'myTasks'
                  ? 'Üzerinize Atanmış İş Bulunmuyor'
                  : activeTab === 'unassigned'
                  ? 'Açık Havuzda İş Bulunmuyor'
                  : 'Paketlenecek Sipariş Bulunamadı'
              }
              subtitle={
                filterOperator
                  ? 'Bu personele ait aktif paketleme görevi atanmamış.'
                  : activeTab === 'myTasks'
                  ? 'Açık Havuz sekmesinden bir siparişi üzerinize alabilirsiniz.'
                  : search
                  ? 'Arama kriterinize uygun sipariş bulunamadı.'
                  : 'Paketlemeye hazır aktif sipariş bulunmuyor.'
              }
            />
          }
        />
      )}

      {/* Personel Filtresi Seçim Modalı */}
      <OperatorSelectModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onSelect={(op) => {
          setFilterOperator(op);
          setFilterModalVisible(false);
          showToast({ message: `"${op.fullName}" işleri filtrelendi.`, type: 'info' });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  operatorContainer: {
    paddingHorizontal: Spacing.marginMobile,
    paddingTop: Spacing.stackGap,
  },
  searchContainer: {
    paddingHorizontal: Spacing.marginMobile,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: Colors.background,
  },
  filterSection: {
    paddingBottom: 8,
    backgroundColor: Colors.background,
  },
  tabsRow: {
    paddingHorizontal: Spacing.marginMobile,
    gap: 8,
    alignItems: 'center',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  activeTabButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPersonButton: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  activePersonFilterButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  tabText: {
    ...Typography.labelMedium,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 12,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    ...Typography.bodyMd,
    color: Colors.outline,
    marginTop: Spacing.md,
  },
  listContent: {
    padding: Spacing.marginMobile,
    paddingTop: 4,
    paddingBottom: 80,
  },
  separator: {
    height: Spacing.stackGap,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.cardPadding,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    marginBottom: 6,
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  docTextWrapper: {
    flex: 1,
  },
  docNo: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: 'bold',
    fontSize: 13.5,
  },
  subRfqNo: {
    fontSize: 10.5,
    color: Colors.outline,
    fontWeight: '500',
    marginTop: 1,
  },
  badgeContainer: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    ...Typography.labelSmall,
    color: Colors.onPrimaryContainer,
    fontWeight: '600',
    fontSize: 10,
  },
  // Zimmet & Operatör Satırı
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assignedBadgeMe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  assignedBadgeMeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  assignedBadgeOther: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    maxWidth: 180,
  },
  assignedBadgeOtherText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  unassignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  unassignedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  claimActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
  },
  handoverActionBtn: {
    backgroundColor: '#2563EB',
  },
  claimActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  releaseActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  releaseActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  cardBody: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vesselText: {
    ...Typography.bodyMd,
    color: Colors.primary,
    fontWeight: '600',
  },
  boldLabel: {
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  partnerName: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '500',
    flex: 1,
  },
  supplierNamesText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    ...Typography.bodySm,
    color: Colors.secondary,
    fontWeight: '600',
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontWeight: 'bold',
  },
});
