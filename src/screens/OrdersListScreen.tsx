import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TopAppBar } from '../components/TopAppBar';
import { SearchBar } from '../components/SearchBar';
import { OrderCard } from '../components/OrderCard';
import { EmptyState } from '../components/Toast';
import { Colors, Spacing } from '../theme';
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
      showToast({ message: 'Siparişler yüklenemedi', type: 'error' });
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

  const renderOrder = ({ item }: { item: Order }) => {
    // orderDate formatlama
    const formattedDate = item.orderDate ? new Date(item.orderDate).toLocaleDateString('tr-TR') : '-';
    
    return (
      <OrderCard
        orderNo={item.documentNo || 'No Yok'}
        companyName={item.partnerName || 'Cari Yok'}
        status={item.status || 'Bilinmiyor'}
        itemCount={0}
        buyerName={''}
        date={formattedDate}
        onPress={() => navigation.navigate('OrderDetail', { orderId: item.id, title: item.documentNo })}
      />
    );
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Siparişler" showBack={false} />

      {/* Arama */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Sipariş ara..."
        />
      </View>

      {/* Sipariş Listesi */}
      <FlatList
        data={orders}
        renderItem={renderOrder}
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
          !loading ? (
            <EmptyState
              icon="package-variant"
              title="Sipariş bulunamadı"
              subtitle={search ? 'Arama kriterlerinizi değiştirin' : 'Henüz sipariş yok'}
            />
          ) : null
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
  searchContainer: {
    paddingHorizontal: Spacing.marginMobile,
    paddingVertical: Spacing.stackGap,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: Spacing.marginMobile,
    paddingBottom: 100,
  },
  separator: {
    height: Spacing.gutter,
  },
});
