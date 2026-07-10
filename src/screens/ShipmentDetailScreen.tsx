import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { TopAppBar } from '../components/TopAppBar';
import { EmptyState } from '../components/Toast';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { CustomIcon } from '../components/CustomIcon';
import { getShipmentDetail, ShipmentDetail, ShipmentItem } from '../services/shipments';
import { ShipmentItemSkeleton } from '../components/skeletons/ShipmentItemSkeleton';

export function ShipmentDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { shipmentId } = route.params || {};
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDetail = async () => {
    try {
      setRefreshing(true);
      const data = await getShipmentDetail(shipmentId);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [shipmentId]);

  const renderItem = ({ item }: { item: ShipmentItem }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>{item.productName}</Text>
          {item.barcode && <Text style={styles.itemBarcode}>{item.barcode}</Text>}
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemQty}>{item.quantity} adet</Text>
          <CustomIcon
            name={item.linked ? 'link-variant' : 'link-variant-off'}
            size={18}
            color={item.linked ? Colors.confirmedText : Colors.outline}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TopAppBar title="İrsaliye Detayı" onBack={() => navigation.goBack()} />

      {refreshing && !detail ? (
        <FlatList
          data={[1, 2, 3, 4]}
          renderItem={() => <ShipmentItemSkeleton />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerCard}>
              <View style={{ gap: 8 }}>
                <View style={{ height: 24, backgroundColor: Colors.surfaceContainerHighest, borderRadius: 4, width: '60%' }} />
                <View style={{ height: 16, backgroundColor: Colors.surfaceContainerHighest, borderRadius: 4, width: '40%' }} />
                <View style={{ height: 14, backgroundColor: Colors.surfaceContainerHighest, borderRadius: 4, width: '25%' }} />
              </View>
            </View>
          }
        />
      ) : (
        <FlatList
          data={detail?.items || []}
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
            detail ? (
              <View style={styles.headerCard}>
                <Text style={styles.headerTitle}>{detail.title}</Text>
                <Text style={styles.headerMeta}>{detail.type} - {detail.assignedTo}</Text>
                <Text style={styles.headerDate}>{detail.date}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={<EmptyState icon="truck-delivery" title="Ürün bulunamadı" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingHorizontal: 8, paddingBottom: 40 },
  separator: { height: 6 },
  headerCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs, padding: 8,
    marginBottom: 8, ...Shadow.card,
  },
  headerTitle: { fontSize: 14, color: Colors.onSurface, fontWeight: 'bold', marginBottom: 2 },
  headerMeta: { fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 1 },
  headerDate: { ...Typography.dataMono, fontSize: 10, color: Colors.outline },
  itemCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs, padding: 6,
    borderWidth: 1, borderColor: Colors.surfaceContainerHighest,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemName: { fontSize: 13, color: Colors.onSurface, fontWeight: '600', marginBottom: 2 },
  itemBarcode: { ...Typography.dataMono, color: Colors.outline, fontSize: 10 },
  itemRight: { alignItems: 'flex-end', gap: 2 },
  itemQty: { ...Typography.dataMono, fontSize: 12, color: Colors.onSurface },
});
