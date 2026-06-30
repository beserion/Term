import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TopAppBar } from '../components/TopAppBar';
import { SearchBar } from '../components/SearchBar';
import { ShipmentCard } from '../components/ShipmentCard';
import { EmptyState } from '../components/Toast';
import { Colors, Spacing } from '../theme';
import { useDebounce } from '../hooks/useDebounce';
import { getShipments, Shipment } from '../services/shipments';
import { useUIStore } from '../store/uiStore';

export function ShipmentsListScreen() {
  const navigation = useNavigation<any>();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search);
  const showToast = useUIStore((s) => s.showToast);

  const fetchShipments = useCallback(async () => {
    try {
      const data = await getShipments(debouncedSearch || undefined);
      setShipments(data);
    } catch {
      // Demo veri
      setShipments([
        {
          id: '1',
          title: 'KPS 26 İREM SULTAN RFQ-6998',
          type: 'Manuel',
          assignedTo: 'DİLAY ATEŞ',
          date: '17 Haz 2026',
          status: 'Not Completed',
          invoiceStatus: 'Awaiting Invoice',
          itemCount: 5,
          linkedCount: 0,
        },
        {
          id: '2',
          title: 'LNR 42 ALPHA PRIME RFQ-7012',
          type: 'Otomatik',
          assignedTo: 'SYS GEN',
          date: '18 Haz 2026',
          status: 'In Transit',
          invoiceStatus: 'Invoice Cleared',
          itemCount: 12,
          linkedCount: 12,
        },
        {
          id: '3',
          title: 'TRX 99 OMEGA STATION RFQ-7105',
          type: 'Manuel',
          assignedTo: 'JOHN DOE',
          date: '19 Haz 2026',
          status: 'Pending Review',
          invoiceStatus: 'Awaiting Invoice',
          itemCount: 3,
          linkedCount: 1,
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const renderShipment = ({ item }: { item: Shipment }) => (
    <ShipmentCard
      title={item.title}
      type={item.type}
      assignedTo={item.assignedTo}
      date={item.date}
      statuses={[item.status, item.invoiceStatus]}
      itemCount={item.itemCount}
      linkedCount={item.linkedCount}
      onPress={() => navigation.navigate('ShipmentDetail', { shipmentId: item.id, title: item.title })}
    />
  );

  return (
    <View style={styles.container}>
      <TopAppBar title="Sevkiyatlar" showBack={false} />

      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Başlık veya RFQ ara..."
        />
      </View>

      <FlatList
        data={shipments}
        renderItem={renderShipment}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchShipments(); }}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="truck-delivery"
              title="Sevkiyat bulunamadı"
              subtitle={search ? 'Arama kriterlerinizi değiştirin' : 'Henüz sevkiyat yok'}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchContainer: {
    paddingHorizontal: Spacing.marginMobile,
    paddingVertical: Spacing.stackGap,
  },
  listContent: {
    paddingHorizontal: Spacing.marginMobile,
    paddingBottom: 100,
  },
  separator: { height: Spacing.gutter },
});
