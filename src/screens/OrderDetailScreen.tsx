import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { TopAppBar } from '../components/TopAppBar';
import { SummaryCard } from '../components/SummaryCard';
import { FilterChips } from '../components/FilterChips';
import { ProductCard } from '../components/ProductCard';
import { EmptyState } from '../components/Toast';
import { Colors, Spacing } from '../theme';
import { getOrderDetail, receiveOrderItem, deleteOrderItem, OrderDetail, OrderItem } from '../services/orders';
import { useUIStore } from '../store/uiStore';

export function OrderDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orderId } = route.params || {};
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [selectedFilter, setSelectedFilter] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const showToast = useUIStore((s) => s.showToast);

  const fetchDetail = useCallback(async () => {
    try {
      const data = await getOrderDetail(orderId);
      setDetail(data);
    } catch {
      // Demo veri
      setDetail({
        id: orderId,
        orderNo: '2026-5531',
        companyName: 'UMUT BİLGİSAYAR',
        status: 'Pending',
        totalItems: 17,
        totalQuantity: 116,
        suppliers: ['AL NALBURIYE', 'AS TEKNİK'],
        items: [
          { id: '1', productName: 'Ağır Hizmet Çelik Braket - 100mm', requiredQuantity: 24, receivedQuantity: 24, status: 'Received', supplier: 'AL NALBURIYE' },
          { id: '2', productName: 'Galvanizli Altıgen Civata M8x50', requiredQuantity: 500, receivedQuantity: 0, status: 'Pending', supplier: 'AL NALBURIYE' },
          { id: '3', productName: 'Endüstriyel Yağlayıcı 5L', requiredQuantity: 12, receivedQuantity: 12, status: 'Received', supplier: 'AS TEKNİK' },
        ],
      });
    } finally {
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const filterLabels = detail
    ? ['Tümü', ...(detail.suppliers || [])]
    : ['Tümü'];

  const filteredItems = detail?.items?.filter((item) => {
    if (selectedFilter === 0) return true;
    return item.supplier === detail.suppliers[selectedFilter - 1];
  }) || [];

  const handleReceive = async (item: OrderItem) => {
    try {
      await receiveOrderItem(orderId, item.id);
      showToast({ message: `${item.productName} teslim alındı`, type: 'success' });
      fetchDetail();
    } catch {
      showToast({ message: 'İşlem başarısız', type: 'error' });
    }
  };

  const handleDelete = async (item: OrderItem) => {
    try {
      await deleteOrderItem(orderId, item.id);
      showToast({ message: `${item.productName} silindi`, type: 'success' });
      fetchDetail();
    } catch {
      showToast({ message: 'Silme işlemi başarısız', type: 'error' });
    }
  };

  const renderItem = ({ item }: { item: OrderItem }) => (
    <ProductCard
      productName={item.productName}
      requiredQuantity={item.requiredQuantity}
      status={item.status}
      onReceive={() => handleReceive(item)}
      onDelete={() => handleDelete(item)}
    />
  );

  return (
    <View style={styles.container}>
      <TopAppBar
        title="Sipariş Detayı"
        onBack={() => navigation.goBack()}
        showBack={true}
      />

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchDetail(); }}
            colors={[Colors.primary]}
          />
        }
        ListHeaderComponent={
          <>
            {/* Özet Kartı */}
            {detail && (
              <View style={styles.summaryWrapper}>
                <SummaryCard
                  leftLabel="Toplam Kalem"
                  leftValue={detail.totalItems}
                  rightLabel="Toplam Miktar"
                  rightValue={detail.totalQuantity}
                />
              </View>
            )}

            {/* Filtre Chip'leri */}
            <View style={styles.filterWrapper}>
              <FilterChips
                items={filterLabels}
                selectedIndex={selectedFilter}
                onSelect={setSelectedFilter}
              />
            </View>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="package-variant"
            title="Ürün bulunamadı"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  summaryWrapper: {
    paddingHorizontal: Spacing.marginMobile,
    paddingTop: Spacing.stackGap,
    paddingBottom: Spacing.gutter,
  },
  filterWrapper: {
    paddingBottom: Spacing.gutter,
  },
  listContent: {
    paddingBottom: 40,
  },
  separator: {
    height: Spacing.gutter,
    paddingHorizontal: Spacing.marginMobile,
  },
});
