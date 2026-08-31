import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
      setOrders(data);
    } catch (error: any) {
      showToast({ message: error?.message || 'Aktif paketleme siparişleri yüklenemedi', type: 'error' });
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

  const renderPackingOrderCard = ({ item }: { item: PackingOrder }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('PackingBoard', {
          requestId: item.id,
          documentNo: item.documentNo,
          partnerName: item.partnerName,
          rfqNo: item.rfqNo,
        })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.docInfo}>
            <CustomIcon name="package-variant-closed" size={24} color={Colors.primary} />
            <Text style={styles.docNo}>{item.documentNo}</Text>
          </View>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{item.status || 'Paketlenecek'}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.partnerName} numberOfLines={1}>
            <CustomIcon name="account" size={16} color={Colors.outline} /> {item.partnerName || 'Cari Belirtilmemiş'}
          </Text>
          
          {item.rfqNo ? (
            <Text style={styles.subDetail}>
              <Text style={styles.subDetailLabel}>RFQ / Teklif No: </Text>{item.rfqNo}
            </Text>
          ) : null}

          <View style={styles.cardFooter}>
            <View style={styles.statItem}>
              <CustomIcon name="format-list-bulleted" size={16} color={Colors.secondary} />
              <Text style={styles.statText}>{item.productCount || 0} Kalem Ürün</Text>
            </View>

            <View style={styles.actionLink}>
              <Text style={styles.actionText}>Paketle</Text>
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
              title="Paketlenecek Sipariş Yok"
              subtitle={search ? 'Arama kriterinize uygun sipariş bulunamadı' : 'Paketlemeye hazır aktif sipariş bulunmuyor'}
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
    gap: 4,
  },
  partnerName: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  subDetail: {
    ...Typography.bodySm,
    color: Colors.outline,
  },
  subDetailLabel: {
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
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
