import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { getPackingSuppliers, PackingSupplier, isWarehouseSupplier } from '../services/packing';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { EmptyState } from '../components/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function PackingSuppliersScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { requestId, orderId, documentNo, partnerName, rfqNo, vesselName, productCount } = route.params || {};

  const [suppliers, setSuppliers] = useState<PackingSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const showToast = useUIStore((s) => s.showToast);
  const activeWarehouseName = useSettingsStore((s) => s.activeWarehouseName);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPackingSuppliers(requestId, orderId, rfqNo);

      const targetId = orderId || requestId;
      const checkedData = await Promise.all(
        data.map(async (s) => {
          const isInternal = isWarehouseSupplier(s.partnerName, activeWarehouseName);
          let receiptFlag = isInternal || s.isReceiptCompleted;
          if (!receiptFlag && targetId && s.partnerId) {
            try {
              const keysToCheck = [
                `@order_receipt_completed_${targetId}_${s.partnerId}`,
                `@order_receipt_completed_${orderId}_${s.partnerId}`,
                `@order_receipt_completed_${requestId}_${s.partnerId}`,
              ];
              for (const k of keysToCheck) {
                const val = await AsyncStorage.getItem(k);
                if (val === 'true') {
                  receiptFlag = true;
                  break;
                }
              }
            } catch {}
          }
          return {
            ...s,
            isReceiptCompleted: isInternal ? true : receiptFlag,
          };
        })
      );

      setSuppliers(checkedData);

      // Eğer siparişteki tüm tedarikçiler paketlendiyse bu siparişin paketlemesi komple bitmiştir
      if (checkedData.length > 0 && checkedData.every((s) => s.isCompleted)) {
        if (targetId) {
          AsyncStorage.setItem(`@packing_order_completed_${targetId}`, 'true').catch(() => {});
        }
      }
    } catch (error: any) {
      showToast({ message: error?.message || 'Tedarikçi listesi yüklenemedi', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId, orderId, rfqNo]);

  useFocusEffect(
    useCallback(() => {
      fetchSuppliers();
    }, [fetchSuppliers])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSuppliers();
  };

  const renderSupplierCard = ({ item }: { item: PackingSupplier }) => {
    const isDone = !!item.isCompleted;
    const isInternal = isWarehouseSupplier(item.partnerName, activeWarehouseName);
    const isReceiptDone = isInternal || item.isReceiptCompleted !== false;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isDone && styles.cardCompleted,
          !isDone && !isReceiptDone && styles.cardWarning,
        ]}
        onPress={() => {
          // 1. Eğer tedarikçi zaten paketlendiyse -> Paketlemeyi İnceleme ekranına (PackingBoard) git
          if (isDone) {
            navigation.navigate('PackingBoard', {
              requestId: item.requestId || requestId,
              orderId: item.orderId || orderId,
              documentNo,
              partnerName,
              rfqNo,
              vesselName,
              supplierId: item.partnerId,
              supplierName: item.partnerName,
              isReceiptCompleted: true,
              isPackingCompleted: true,
            });
            return;
          }

          // 2. Eğer henüz paketlenmemiş VE mal kabulü de yapılmamışsa (Kendi aktif depo ürünleri hariç!) -> Mal Kabul ekranına git
          if (!isReceiptDone && !isInternal) {
            navigation.navigate('ReceivingStack', {
              screen: 'OrderDetail',
              params: {
                orderId: item.orderId || orderId,
                supplierId: item.partnerId,
                supplierName: item.partnerName,
                documentNo,
                partnerName,
                rfqNo,
                vesselName,
              },
            });
            return;
          }

          // 3. Mal kabulü tamamlanmış veya kendi aktif depo firması -> Doğrudan PackingBoard
          navigation.navigate('PackingBoard', {
            requestId: item.requestId || requestId,
            orderId: item.orderId || orderId,
            documentNo,
            partnerName,
            rfqNo,
            vesselName,
            supplierId: item.partnerId,
            supplierName: item.partnerName,
            isReceiptCompleted: true,
            isPackingCompleted: false,
          });
        }}
        activeOpacity={0.7}
      >
        {/* 1. Kartın En Üstündeki Tam Genişlik Durum Rozeti */}
        <View
          style={[
            styles.cardTopBanner,
            isDone
              ? styles.cardTopBannerCompleted
              : !isReceiptDone
              ? styles.cardTopBannerWarning
              : styles.cardTopBannerReady,
          ]}
        >
          <CustomIcon
            name={
              isDone
                ? 'check-decagram'
                : !isReceiptDone
                ? 'alert-circle'
                : 'package-variant'
            }
            size={16}
            color={
              isDone
                ? '#047857'
                : !isReceiptDone
                ? '#B45309'
                : Colors.primary
            }
          />
          <Text
            style={[
              styles.cardTopBannerText,
              isDone
                ? styles.cardTopBannerTextCompleted
                : !isReceiptDone
                ? styles.cardTopBannerTextWarning
                : styles.cardTopBannerTextReady,
            ]}
          >
            {isDone
              ? 'PAKETLENDİ'
              : !isReceiptDone
              ? 'MAL KABUL BEKLİYOR'
              : (item.packedCount && item.packedCount > 0)
              ? `%${Math.round(((item.packedQty || 0) / (item.totalQty || 1)) * 100)} PAKETLENDİ`
              : 'PAKETLEMEYE HAZIR'}
          </Text>
        </View>

        {/* 2. Kart Gövdesi: Tam Genişlik Tedarikçi Adı ve Detaylar */}
        <View style={styles.cardInner}>
          <View style={styles.supplierTitleContainer}>
            <View style={styles.supplierIconRow}>
              <View
                style={[
                  styles.miniSupplierIconBox,
                  isDone
                    ? styles.miniSupplierIconBoxCompleted
                    : !isReceiptDone
                    ? styles.miniSupplierIconBoxWarning
                    : undefined,
                ]}
              >
                <CustomIcon
                  name="storefront"
                  size={18}
                  color={isDone ? '#047857' : !isReceiptDone ? '#D97706' : Colors.primary}
                />
              </View>
              <Text style={styles.supplierTitleText}>
                {item.partnerName || 'Tedarikçi Cari Adı Yok'}
              </Text>
            </View>
          </View>

          {/* Kalem ve Adet İstatistiği */}
          <View style={styles.itemCountBadge}>
            <CustomIcon
              name={
                isDone
                  ? 'check-circle'
                  : !isReceiptDone
                  ? 'shield-alert-outline'
                  : 'package-variant-closed'
              }
              size={15}
              color={
                isDone
                  ? '#047857'
                  : !isReceiptDone
                  ? '#D97706'
                  : Colors.secondary
              }
            />
            <Text
              style={[
                styles.itemCountText,
                isDone && styles.itemCountTextCompleted,
                !isDone && !isReceiptDone && styles.itemCountTextWarning,
              ]}
            >
              {isDone
                ? `Tüm Ürünler Paketlendi (${item.productCount || 0} Kalem)`
                : !isReceiptDone
                ? `${item.productCount || 0} Kalem (Mal Kabul Yapılmadı)`
                : (item.packedCount && item.packedCount > 0)
                ? `${item.packedCount}/${item.productCount || 0} Kalem (${item.packedQty || 0}/${item.totalQty || 0} Adet)`
                : item.productCount !== undefined
                ? `${item.productCount} Kalem Ürün Paketlenecek`
                : 'Kalem Bilgisi Yükleniyor...'}
            </Text>
          </View>

          {/* Alt Aksiyon Butonu */}
          <View style={styles.cardActionRow}>
            <View
              style={[
                styles.actionBtn,
                isDone && styles.actionBtnCompleted,
                !isDone && !isReceiptDone && styles.actionBtnWarning,
              ]}
            >
              <Text
                style={[
                  styles.actionBtnText,
                  isDone && styles.actionBtnTextCompleted,
                  !isDone && !isReceiptDone && styles.actionBtnTextWarning,
                ]}
              >
                {isDone
                  ? 'Paketlemeyi İncele'
                  : !isReceiptDone
                  ? 'Mal Kabul Ekranına Git'
                  : 'Paketlemeye Başla'}
              </Text>
              <CustomIcon
                name={
                  isDone
                    ? 'eye-outline'
                    : !isReceiptDone
                    ? 'clipboard-arrow-right-outline'
                    : 'chevron-right'
                }
                size={18}
                color={
                  isDone
                    ? '#047857'
                    : !isReceiptDone
                    ? '#B45309'
                    : Colors.primary
                }
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
        title={documentNo ? `Paketleme: ${documentNo}` : 'Tedarikçi Seçimi'}
        onBack={() => navigation.goBack()}
        showBack={true}
      />

      {/* Sipariş Özet Kartı */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <CustomIcon name="package-variant-closed" size={20} color={Colors.primary} />
          <Text style={styles.summaryDocNo}>{documentNo || `Sipariş #${requestId}`}</Text>
        </View>

        {vesselName ? (
          <View style={styles.summaryRow}>
            <CustomIcon name="ship" size={15} color={Colors.primary} />
            <Text style={styles.summaryVessel}>
              Gemi: <Text style={{ fontWeight: 'bold', color: Colors.onSurface }}>{vesselName}</Text>
            </Text>
          </View>
        ) : null}

        {partnerName ? (
          <View style={styles.summaryRow}>
            <CustomIcon name="account" size={15} color={Colors.outline} />
            <Text style={styles.summaryPartner} numberOfLines={1}>
              {partnerName}
            </Text>
          </View>
        ) : null}

        {rfqNo && rfqNo !== documentNo ? (
          <View style={styles.summaryRow}>
            <CustomIcon name="file-document-outline" size={15} color={Colors.outline} />
            <Text style={styles.summaryRfq}>
              Teklif / RFQ: <Text style={{ fontWeight: '600', color: Colors.onSurface }}>{rfqNo}</Text>
            </Text>
          </View>
        ) : null}

        <Text style={styles.instructionText}>
          Aşağıdaki listeden paketlemek istediğiniz tedarikçiyi seçerek koli ve paletleme ekranına geçin.
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
            <View style={styles.emptyWrapper}>
              <EmptyState
                icon="storefront"
                title="Tedarikçi Bulunamadı"
                subtitle="Bu siparişe bağlı doğrudan tedarikçi kaydı bulunamadı. Tüm ürünleri doğrudan paketleyebilirsiniz."
              />
              <TouchableOpacity
                style={styles.directPackBtn}
                onPress={() =>
                  navigation.navigate('PackingBoard', {
                    requestId,
                    orderId,
                    documentNo,
                    partnerName,
                    rfqNo,
                    vesselName,
                  })
                }
              >
                <CustomIcon name="package-variant-closed" size={18} color="#fff" />
                <Text style={styles.directPackBtnText}>Tüm Ürünleri Doğrudan Paketle</Text>
              </TouchableOpacity>
            </View>
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
    gap: 6,
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryVessel: {
    ...Typography.bodyMd,
    color: Colors.primary,
    fontWeight: '600',
  },
  summaryPartner: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '500',
    flex: 1,
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
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardCompleted: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  cardWarning: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  cardTopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    width: '100%',
  },
  cardTopBannerCompleted: {
    backgroundColor: '#DCFCE7',
    borderBottomColor: '#A7F3D0',
  },
  cardTopBannerWarning: {
    backgroundColor: '#FEF3C7',
    borderBottomColor: '#FDE68A',
  },
  cardTopBannerReady: {
    backgroundColor: '#EFF6FF',
    borderBottomColor: '#DBEAFE',
  },
  cardTopBannerText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  cardTopBannerTextCompleted: {
    color: '#047857',
  },
  cardTopBannerTextWarning: {
    color: '#B45309',
  },
  cardTopBannerTextReady: {
    color: '#1D4ED8',
  },
  cardInner: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  supplierTitleContainer: {
    width: '100%',
  },
  supplierIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
  },
  miniSupplierIconBox: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 138, 0.12)',
  },
  miniSupplierIconBoxCompleted: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  miniSupplierIconBoxWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  supplierTitleText: {
    ...Typography.titleMedium,
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.onSurface,
    lineHeight: 22,
    flex: 1,
  },
  itemCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    paddingLeft: 42,
  },
  itemCountText: {
    ...Typography.bodySm,
    color: Colors.secondary,
    fontWeight: '600',
  },
  itemCountTextCompleted: {
    color: '#047857',
  },
  itemCountTextWarning: {
    color: '#D97706',
    fontWeight: '600',
  },
  cardActionRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
    paddingTop: Spacing.xs,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.secondaryContainer,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    width: '100%',
  },
  actionBtnCompleted: {
    backgroundColor: '#DCFCE7',
  },
  actionBtnWarning: {
    backgroundColor: '#FEF3C7',
  },
  actionBtnText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  actionBtnTextCompleted: {
    color: '#047857',
  },
  actionBtnTextWarning: {
    color: '#B45309',
  },
  emptyWrapper: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  directPackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  directPackBtnText: {
    ...Typography.labelMedium,
    color: '#fff',
    fontWeight: 'bold',
  },
});
