import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { TopAppBar } from '../components/TopAppBar';
import { EmptyState } from '../components/Toast';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getShipmentDetail, ShipmentDetail, ShipmentItem } from '../services/shipments';

export function ShipmentDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { shipmentId } = route.params || {};
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDetail = async () => {
    try {
      const data = await getShipmentDetail(shipmentId);
      setDetail(data);
    } catch {
      setDetail({
        id: shipmentId,
        title: 'KPS 26 İREM SULTAN RFQ-6998',
        type: 'Manuel',
        assignedTo: 'DİLAY ATEŞ',
        date: '17 Haz 2026',
        status: 'Not Completed',
        invoiceStatus: 'Awaiting Invoice',
        items: [
          { id: '1', productName: 'Çelik Braket 100mm', barcode: '8690001001', quantity: 24, linked: true },
          { id: '2', productName: 'Civata M8x50', barcode: '8690001002', quantity: 500, linked: false },
          { id: '3', productName: 'Yağlayıcı 5L', barcode: '8690001003', quantity: 12, linked: true },
        ],
      });
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
          <MaterialCommunityIcons
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
      <TopAppBar title="Sevkiyat Detayı" onBack={() => navigation.goBack()} />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingHorizontal: Spacing.marginMobile, paddingBottom: 40 },
  separator: { height: Spacing.stackGap },
  headerCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md, padding: Spacing.cardPadding,
    marginBottom: Spacing.lg, ...Shadow.card,
  },
  headerTitle: { ...Typography.headlineSm, color: Colors.onSurface, marginBottom: 4 },
  headerMeta: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginBottom: 2 },
  headerDate: { ...Typography.dataMono, color: Colors.outline },
  itemCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.sm, padding: Spacing.cardPadding,
    borderWidth: 1, borderColor: Colors.surfaceContainerHighest,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemName: { ...Typography.labelLg, color: Colors.onSurface, marginBottom: 2 },
  itemBarcode: { ...Typography.dataMono, color: Colors.outline, fontSize: 12 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemQty: { ...Typography.dataMono, color: Colors.onSurface },
});
