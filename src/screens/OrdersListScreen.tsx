import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TopAppBar } from '../components/TopAppBar';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/Toast';
import { CustomIcon } from '../components/CustomIcon';
import { Colors, Spacing, Typography, BorderRadius, Shadow } from '../theme';
import { useDebounce } from '../hooks/useDebounce';
import { getOrders, Order } from '../services/orders';
import { useUIStore } from '../store/uiStore';

export function OrdersListScreen() {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search);
  const showToast = useUIStore((s) => s.showToast);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOrders(debouncedSearch || undefined);
      setOrders(data);
    } catch (error: any) {
      showToast({ message: error?.message || 'Mal kabul siparişleri yüklenemedi', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const renderOrderCard = ({ item }: { item: Order }) => {
    const formattedDate = item.orderDate ? new Date(item.orderDate).toLocaleDateString('tr-TR') : null;
    const isCompleted = !!item.isReceiptCompleted;
    const hasPartial = !isCompleted && (item.totalReceivedQty || 0) > 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('OrderSuppliers', {
            orderId: item.id,
            documentNo: item.documentNo,
            partnerName: item.partnerName,
            rfqNo: item.rfqNo,
            vesselName: item.vesselName,
          })
        }
      >
        <View style={styles.cardHeader}>
          <View style={styles.docInfo}>
            <CustomIcon name="package-variant-closed" size={24} color={Colors.primary} />
            <Text style={styles.docNo}>{item.documentNo}</Text>
          </View>
          <View
            style={[
              styles.badgeContainer,
              isCompleted
                ? { backgroundColor: '#ECFDF5' }
                : hasPartial
                ? { backgroundColor: '#FFFBEB' }
                : undefined,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                isCompleted
                  ? { color: '#047857' }
                  : hasPartial
                  ? { color: '#D97706' }
                  : undefined,
              ]}
            >
              {isCompleted
                ? 'Mal Kabul Tamam'
                : hasPartial
                ? 'Kısmi Kabul'
                : item.status || 'Bekliyor'}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.partnerName} numberOfLines={1}>
            <CustomIcon name="account" size={16} color={Colors.outline} /> {item.partnerName || 'Cari Belirtilmemiş'}
          </Text>

          <View style={styles.detailRow}>
            <CustomIcon name="ship" size={14} color={item.vesselName ? Colors.primary : Colors.outline} />
            <Text style={styles.subDetail}>
              <Text style={styles.subDetailLabel}>Gemi: </Text>
              <Text style={item.vesselName ? styles.vesselText : styles.dimText}>
                {item.vesselName || 'Belirtilmemiş'}
              </Text>
            </Text>
          </View>

          <View style={styles.detailRow}>
            <CustomIcon name="clipboard-list-outline" size={14} color={item.rfqNo ? Colors.primary : Colors.outline} />
            <Text style={styles.subDetail}>
              <Text style={styles.subDetailLabel}>RFQ / Teklif No: </Text>
              <Text style={item.rfqNo ? styles.rfqText : styles.dimText}>
                {item.rfqNo || 'Belirtilmemiş'}
              </Text>
            </Text>
          </View>

          {formattedDate ? (
            <View style={styles.dateRow}>
              <CustomIcon name="calendar-month" size={14} color={Colors.outline} />
              <Text style={styles.dateText}>{formattedDate}</Text>
            </View>
          ) : null}

          <View style={styles.cardFooter}>
            <View style={styles.statItem}>
              <CustomIcon
                name={isCompleted ? 'check-circle' : 'clipboard-check-outline'}
                size={16}
                color={isCompleted ? '#047857' : Colors.secondary}
              />
              <Text style={[styles.statText, isCompleted && { color: '#047857' }]}>
                {item.productCount || 0} Kalem
                {item.totalOrderedQty ? ` (${item.totalReceivedQty || 0}/${item.totalOrderedQty} adet)` : ''}
              </Text>
            </View>

            <View style={styles.actionLink}>
              <Text style={styles.actionText}>Tedarikçileri Gör</Text>
              <CustomIcon name="chevron-right" size={20} color={Colors.primary} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TopAppBar
        title="Mal Kabul - Siparişler"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      {/* Arama */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Sipariş No, Gemi, Tedarikçi veya RFQ Ara..."
        />
      </View>

      {/* Yükleniyor Göstergesi */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Mal kabul siparişleri yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderCard}
          keyExtractor={(item) => String(item.id)}
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
              icon="package-variant-closed"
              title="Mal Kabul Siparişi Yok"
              subtitle={search ? 'Arama kriterinize uygun sipariş bulunamadı' : 'Mal kabulü bekleyen aktif sipariş bulunmuyor'}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    paddingHorizontal: Spacing.marginMobile,
    paddingVertical: Spacing.stackGap,
    backgroundColor: Colors.background,
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
    paddingHorizontal: Spacing.marginMobile,
    paddingBottom: 100,
    paddingTop: Spacing.xs,
  },
  separator: {
    height: Spacing.gutter,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    marginBottom: Spacing.xs,
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  docNo: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  badgeContainer: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    ...Typography.labelSmall,
    color: Colors.onPrimaryContainer,
    fontWeight: '600',
  },
  cardBody: {
    gap: 6,
  },
  partnerName: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subDetail: {
    ...Typography.bodySm,
    color: Colors.outline,
  },
  subDetailLabel: {
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  vesselText: {
    fontWeight: 'bold',
    color: Colors.primary,
  },
  rfqText: {
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  dimText: {
    color: Colors.outline,
    fontStyle: 'italic',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    ...Typography.bodySm,
    color: Colors.outline,
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
