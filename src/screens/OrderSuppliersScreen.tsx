import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { getOrderSuppliers, OrderSupplier } from '../services/orders';
import { useUIStore } from '../store/uiStore';
import { EmptyState } from '../components/Toast';

export function OrderSuppliersScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orderId, documentNo, partnerName, rfqNo, vesselName } = route.params || {};

  const [suppliers, setSuppliers] = useState<OrderSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const showToast = useUIStore((s) => s.showToast);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOrderSuppliers(orderId);
      setSuppliers(data);
    } catch (error: any) {
      showToast({ message: error?.message || 'Tedarikçi listesi yüklenemedi', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSuppliers();
  };

  const renderSupplierCard = ({ item }: { item: OrderSupplier }) => {
    const isCompleted = !!item.isReceiptCompleted;
    return (
      <TouchableOpacity
        style={[
          styles.card,
          isCompleted && { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
        ]}
        onPress={() =>
          navigation.navigate('OrderDetail', {
            orderId,
            supplierId: item.partnerId,
            supplierName: item.partnerName,
            documentNo,
            partnerName,
            rfqNo,
            vesselName,
          })
        }
        activeOpacity={0.7}
      >
        {/* Üst Kısım: İkon ve Tam Genişlik Tedarikçi Firma Adı */}
        <View style={styles.cardTopRow}>
          <View
            style={[
              styles.iconBox,
              isCompleted && { backgroundColor: '#ECFDF5', borderColor: '#059669' },
            ]}
          >
            <CustomIcon
              name={isCompleted ? 'check-decagram' : 'storefront'}
              size={24}
              color={isCompleted ? '#059669' : Colors.primary}
            />
          </View>
          <View style={styles.info}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.supplierName, { flex: 1, marginRight: 6 }]}>
                {item.partnerName || 'Tedarikçi Cari Adı Yok'}
              </Text>
              {isCompleted ? (
                <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#047857' }}>TAMAMLANDI</Text>
                </View>
              ) : null}
            </View>
            
            {/* Kaç ürün alınacak bilgisi */}
            <View style={styles.itemCountBadge}>
              <CustomIcon
                name={isCompleted ? 'check-circle' : 'clipboard-check-outline'}
                size={15}
                color={isCompleted ? '#059669' : Colors.secondary}
              />
              <Text style={[styles.itemCountText, isCompleted && { color: '#047857' }]}>
                {item.productCount !== undefined
                  ? `${item.productCount} Kalem Ürün${item.totalOrderedQty ? ` (${item.totalReceivedQty || 0}/${item.totalOrderedQty} Adet)` : ''}`
                  : 'Kalem Bilgisi Yükleniyor...'}
              </Text>
            </View>
          </View>
        </View>

        {/* Alt Kısım: Alta yerleştirilmiş Mal Kabul Butonu */}
        <View style={styles.cardActionRow}>
          <View
            style={[
              styles.actionBtn,
              isCompleted && { backgroundColor: '#D1FAE5' },
            ]}
          >
            <Text
              style={[
                styles.actionBtnText,
                isCompleted && { color: '#065F46' },
              ]}
            >
              {isCompleted ? 'Mal Kabulü İncele / Düzenle' : 'Mal Kabul Yap'}
            </Text>
            <CustomIcon
              name="chevron-right"
              size={18}
              color={isCompleted ? '#065F46' : Colors.primary}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TopAppBar
        title={documentNo ? `Mal Kabul: ${documentNo}` : 'Tedarikçi Seçimi'}
        onBack={() => navigation.goBack()}
        showBack={true}
      />

      {/* Sipariş Özet Kartı */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <CustomIcon name="package-variant-closed" size={20} color={Colors.primary} />
          <Text style={styles.summaryDocNo}>{documentNo || `Sipariş #${orderId}`}</Text>
        </View>
        {partnerName ? (
          <Text style={styles.summaryPartner} numberOfLines={1}>
            <CustomIcon name="account" size={14} color={Colors.outline} /> {partnerName}
          </Text>
        ) : null}
        {vesselName ? (
          <Text style={styles.summaryVessel} numberOfLines={1}>
            <CustomIcon name="ship" size={14} color={Colors.primary} /> Gemi: <Text style={{ fontWeight: '600', color: Colors.onSurface }}>{vesselName}</Text>
          </Text>
        ) : null}
        {rfqNo ? (
          <Text style={styles.summaryRfq}>
            Teklif / RFQ: <Text style={{ fontWeight: '600', color: Colors.onSurface }}>{rfqNo}</Text>
          </Text>
        ) : null}
        <Text style={styles.instructionText}>
          Aşağıdaki listeden mal teslimatı yapan tedarikçiyi seçerek ürünleri ve gelen miktarları kaydedin.
        </Text>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Tedarikçiler ({suppliers.length})</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Tedarikçiler yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={suppliers}
          renderItem={renderSupplierCard}
          keyExtractor={(item) => String(item.partnerId)}
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
              icon="storefront"
              title="Tedarikçi Bulunamadı"
              subtitle="Bu siparişe bağlı aktif bir tedarikçi kaydı bulunmuyor."
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
  summaryCard: {
    margin: Spacing.marginMobile,
    marginBottom: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.sm,
    gap: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryDocNo: {
    ...Typography.titleMedium,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  summaryPartner: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  summaryVessel: {
    ...Typography.bodySm,
    color: Colors.primary,
    fontWeight: '500',
  },
  summaryRfq: {
    ...Typography.bodySm,
    color: Colors.outline,
  },
  instructionText: {
    ...Typography.bodySm,
    color: Colors.outline,
    marginTop: 4,
    lineHeight: 18,
  },
  listHeader: {
    paddingHorizontal: Spacing.marginMobile,
    paddingVertical: Spacing.xs,
  },
  listTitle: {
    ...Typography.labelMedium,
    color: Colors.outline,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  loadingContainer: {
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
    paddingBottom: 40,
    paddingTop: Spacing.xs,
  },
  separator: {
    height: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.sm,
    gap: Spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#EBF2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 138, 0.12)',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  supplierName: {
    ...Typography.titleMedium,
    fontSize: 15,
    color: Colors.onSurface,
    fontWeight: 'bold',
    lineHeight: 21,
  },
  itemCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  itemCountText: {
    ...Typography.bodySm,
    color: Colors.secondary,
    fontWeight: '600',
  },
  supplierMeta: {
    ...Typography.bodySm,
    color: Colors.outline,
  },
  cardActionRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
    paddingTop: Spacing.xs,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.secondaryContainer,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    width: '100%',
  },
  actionBtnText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontWeight: 'bold',
  },
});
