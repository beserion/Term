import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { TopAppBar } from '../components/TopAppBar';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/Toast';
import { CustomIcon } from '../components/CustomIcon';
import { Colors, Spacing, Typography, BorderRadius, Shadow } from '../theme';
import { useDebounce } from '../hooks/useDebounce';
import { getActivePackingOrders, PackingOrder } from '../services/packing';
import { useUIStore } from '../store/uiStore';

export function PackingListScreen() {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<PackingOrder[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search);
  const showToast = useUIStore((s) => s.showToast);

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

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const renderPackingOrderCard = ({ item }: { item: PackingOrder }) => {
    const isDone = !!item.isPackingCompleted || (item.packedRatio !== undefined && item.packedRatio >= 100);
    const hasProgress = !isDone && (item.packedRatio || 0) > 0;
    const isReceiptDone = item.isReceiptCompleted !== false;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isDone && { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
          !isDone && !isReceiptDone && { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
        ]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('PackingSuppliers', {
          requestId: item.id,
          orderId: item.orderId || item.id,
          documentNo: item.documentNo,
          partnerName: item.partnerName,
          rfqNo: item.rfqNo,
          vesselName: item.vesselName,
          productCount: item.productCount,
          isReceiptCompleted: isReceiptDone,
        })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.docInfo}>
            <CustomIcon
              name={isDone ? 'check-circle' : 'package-variant-closed'}
              size={22}
              color={isDone ? '#047857' : Colors.primary}
            />
            <View style={styles.docTextWrapper}>
              <Text style={styles.docNo} numberOfLines={1}>{item.documentNo}</Text>
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

          <View style={styles.cardFooter}>
            <View style={styles.statItem}>
              <CustomIcon name="format-list-bulleted" size={16} color={Colors.secondary} />
              <Text style={styles.statText}>
                {item.productCount || 0} Kalem
                {((item.boxCount || 0) > 0 || (item.palletCount || 0) > 0) ? (
                  ` • ${item.boxCount || 0} Koli${(item.palletCount || 0) > 0 ? `, ${item.palletCount} Palet` : ''}`
                ) : ''}
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

      {/* Arama Çubuğu */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Sipariş No, RFQ veya Müşteri Ara..."
        />
      </View>

      {/* Yükleniyor Göstergesi */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Paketleme siparişleri yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
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
              icon="package-variant-closed"
              title="Paketlenecek Sipariş Bulunamadı"
              subtitle={
                search
                  ? 'Arama kriterinize uygun sipariş bulunamadı'
                  : 'Paketlemeye hazır aktif sipariş bulunmuyor'
              }
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
    paddingTop: Spacing.stackGap,
    paddingBottom: 8,
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
    marginBottom: Spacing.xs,
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
