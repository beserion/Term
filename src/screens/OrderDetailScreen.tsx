import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { getOrderDetail, getSupplierOrderDetail, Order, OrderLine, saveOrderSupplierReceipt } from '../services/orders';
import { getStockByBarcode } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useBarcode } from '../hooks/useBarcode';
import { useSettingsStore } from '../store/settingsStore';
import { FeedbackService } from '../services/feedback';
import { ShipmentItemSkeleton } from '../components/skeletons/ShipmentItemSkeleton';
import { Badge } from '../components/Badge';
import { CameraScannerModal } from '../components/CameraScannerModal';

export function OrderDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orderId, supplierId, supplierName } = route.params || {};
  const [detail, setDetail] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  
  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<OrderLine | null>(null);
  const [qtyInput, setQtyInput] = useState('');

  // Uyuşmazlık Modali States
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [discrepancyList, setDiscrepancyList] = useState<Array<{ name: string, ordered: number, picked: number, type: 'missing' | 'extra' }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const showToast = useUIStore((s) => s.showToast);
  const showErrorLock = useUIStore((s) => s.showErrorLock);
  const { activeWarehouseId } = useSettingsStore();

  const fetchDetail = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = supplierId
        ? await getSupplierOrderDetail(orderId, supplierId)
        : await getOrderDetail(orderId);
      setDetail(data);
      if (data.lines) {
        // Telefon hafızasında (AsyncStorage) kayıtlı toplanan miktarları yükle
        const storageKey = `@order_picking_${orderId}_${supplierId || 0}`;
        const savedDataStr = await AsyncStorage.getItem(storageKey);
        const savedPickedMap = savedDataStr ? JSON.parse(savedDataStr) : {};

        setLines(data.lines.map(line => {
          const key = String(line.id);
          const pickedQty = savedPickedMap[key] !== undefined ? savedPickedMap[key] : 0;
          return {
            ...line,
            pickedQty,
            isPicked: pickedQty === line.quantity
          };
        }));
      }
    } catch {
      showToast({ message: 'Sipariş detayı yüklenemedi', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [orderId, supplierId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleScan = async (scannedCode: string) => {
    if (!lines || lines.length === 0) return;
    
    // 1. Önce yerel olarak Sipariş kalemlerinde ara
    let matchedIndex = lines.findIndex(l => l.stockCode === scannedCode || l.stockId.toString() === scannedCode);
    
    // 2. Yerelde bulunamazsa, API'den (barkod/karekod sorgusu) ara
    if (matchedIndex === -1) {
      try {
        const stockData = await getStockByBarcode(scannedCode);
        if (stockData && stockData.stockCode) {
          matchedIndex = lines.findIndex(l => l.stockCode === stockData.stockCode);
        }
      } catch (err) {
        // API hatası durumunda devam et, altta bulunamadı uyarısı verilecek
      }
    }
    
    if (matchedIndex !== -1) {
      const line = lines[matchedIndex];
      setSelectedLine(line);
      setQtyInput(line.pickedQty ? String(line.pickedQty) : '');
      setShowModal(true);
      FeedbackService.playSuccess();
    } else {
      FeedbackService.playError();
      showErrorLock('Okuttuğunuz ürün bu tedarikçinin sipariş kalemlerinde bulunamadı!');
    }
  };

  useBarcode(handleScan);

  useEffect(() => {
    if (barcode.trim().length >= 4) {
      const timeout = setTimeout(() => {
        handleScan(barcode.trim());
        setBarcode('');
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [barcode]);

  const handleSaveQty = async () => {
    if (!selectedLine) return;
    const parsedQty = parseInt(qtyInput, 10);
    const finalQty = isNaN(parsedQty) || parsedQty < 0 ? 0 : parsedQty;
    
    const updatedLines = lines.map(line => {
      const isIdMatch = String(line.id) === String(selectedLine.id);
      const isCodeMatch = line.stockCode && line.stockCode === selectedLine.stockCode;
      
      if (isIdMatch || isCodeMatch) {
        return {
          ...line,
          pickedQty: finalQty,
          isPicked: finalQty === line.quantity
        };
      }
      return line;
    });
    
    setLines(updatedLines);
    setShowModal(false);
    FeedbackService.playSuccess();
    showToast({ 
      message: `${selectedLine.stockName} miktarı güncellendi: ${finalQty}/${selectedLine.quantity}`, 
      type: 'success' 
    });

    // Telefon hafızasını güncelle
    try {
      const storageKey = `@order_picking_${orderId}_${supplierId || 0}`;
      const savedDataStr = await AsyncStorage.getItem(storageKey);
      const savedPickedMap = savedDataStr ? JSON.parse(savedDataStr) : {};
      savedPickedMap[String(selectedLine.id)] = finalQty;
      await AsyncStorage.setItem(storageKey, JSON.stringify(savedPickedMap));
    } catch (err) {
      console.error('AsyncStorage kaydetme hatası:', err);
    }
  };

  const handleClearPicking = async () => {
    try {
      const storageKey = `@order_picking_${orderId}_${supplierId || 0}`;
      await AsyncStorage.removeItem(storageKey);
      setLines(prev => prev.map(line => ({ ...line, pickedQty: 0, isPicked: false })));
      showToast({ message: 'Tüm toplanan miktarlar sıfırlandı.', type: 'info' });
      FeedbackService.playLightImpact();
    } catch (err) {
      console.error('AsyncStorage temizleme hatası:', err);
    }
  };

  const handleCompletePicking = () => {
    if (!activeWarehouseId) {
      showToast({ message: 'Lütfen ayarlardan terminal deposunu seçin', type: 'error' });
      return;
    }

    const discrepancies: typeof discrepancyList = [];
    lines.forEach(line => {
      const picked = line.pickedQty || 0;
      const ordered = line.quantity;
      if (picked < ordered) {
        discrepancies.push({
          name: line.stockName,
          ordered,
          picked,
          type: 'missing'
        });
      } else if (picked > ordered) {
        discrepancies.push({
          name: line.stockName,
          ordered,
          picked,
          type: 'extra'
        });
      }
    });

    if (discrepancies.length > 0) {
      setDiscrepancyList(discrepancies);
      setShowDiscrepancyModal(true);
    } else {
      executeSaveReceipt();
    }
  };

  const executeSaveReceipt = async () => {
    setShowDiscrepancyModal(false);
    setSubmitting(true);
    try {
      const payload = {
        orderId: Number(orderId),
        supplierId: Number(supplierId),
        warehouseId: Number(activeWarehouseId),
        remarks: 'Terminal Toplama Fişi',
        lines: lines
          .filter(line => (line.pickedQty || 0) > 0)
          .map(line => ({
            orderDetailId: Number(line.id),
            receivedQty: Number(line.pickedQty)
          }))
      };

      await saveOrderSupplierReceipt(payload);

      // Başarılı kayıttan sonra yerel hafızayı temizle
      const storageKey = `@order_picking_${orderId}_${supplierId || 0}`;
      await AsyncStorage.removeItem(storageKey);

      showToast({ message: 'Sipariş kabulü başarıyla kaydedildi.', type: 'success' });
      FeedbackService.playSuccess();
      navigation.goBack();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Sipariş kabulü kaydedilemedi.';
      showToast({ message: msg, type: 'error' });
      FeedbackService.playError();
    } finally {
      setSubmitting(false);
    }
  };

  const totalRequired = lines.reduce((acc, l) => acc + l.quantity, 0);
  const totalPicked = lines.reduce((acc, l) => acc + (l.pickedQty || 0), 0);
  const isComplete = totalRequired > 0 && totalPicked === totalRequired;

  const getCardStyle = (item: OrderLine) => {
    const picked = item.pickedQty || 0;
    const required = item.quantity;
    
    if (picked === 0) {
      return styles.productCard;
    }
    if (picked < required) {
      return [styles.productCard, styles.productCardUnder];
    }
    if (picked > required) {
      return [styles.productCard, styles.productCardOver];
    }
    return [styles.productCard, styles.productCardMatch];
  };

  const getStatusIconInfo = (item: OrderLine) => {
    const picked = item.pickedQty || 0;
    const required = item.quantity;
    
    if (picked === 0) {
      return { name: "package-variant-closed" as const, color: Colors.primary };
    }
    if (picked < required) {
      return { name: "minus-circle-outline" as const, color: Colors.error };
    }
    if (picked > required) {
      return { name: "plus-circle-outline" as const, color: Colors.warning };
    }
    return { name: "check-circle" as const, color: Colors.success };
  };

  const getQtyPickedStyle = (item: OrderLine) => {
    const picked = item.pickedQty || 0;
    const required = item.quantity;
    
    if (picked === 0) {
      return styles.qtyPicked;
    }
    if (picked < required) {
      return [styles.qtyPicked, { color: Colors.error }];
    }
    if (picked > required) {
      return [styles.qtyPicked, { color: Colors.warning }];
    }
    return [styles.qtyPicked, { color: Colors.success }];
  };

  const renderItem = ({ item }: { item: OrderLine }) => {
    const iconInfo = getStatusIconInfo(item);
    
    return (
      <TouchableOpacity 
        style={getCardStyle(item)}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedLine(item);
          setQtyInput(item.pickedQty ? String(item.pickedQty) : '');
          setShowModal(true);
        }}
      >
        <View style={styles.productIconBox}>
          <CustomIcon 
            name={iconInfo.name} 
            size={24} 
            color={iconInfo.color} 
          />
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productCode}>{item.stockCode}</Text>
          <Text style={styles.productName}>{item.stockName}</Text>
        </View>
        <View style={styles.qtyBox}>
          <Text style={getQtyPickedStyle(item)}>
            {item.pickedQty || 0}
          </Text>
          <Text style={styles.qtyTotal}> / {item.quantity}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TopAppBar
        title={detail ? `Sipariş: ${detail.documentNo}` : "Sipariş Detayı"}
        onBack={() => navigation.goBack()}
        showBack={true}
        onAction={handleClearPicking}
        actionIcon="trash-can-outline"
      />

      {/* Progress & Scan Area */}
      <View style={styles.headerArea}>
        {(supplierName || detail?.partnerName) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, backgroundColor: Colors.background, padding: 8, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.outlineVariant }}>
            <CustomIcon name="storefront" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={{ ...Typography.labelMd, color: Colors.onSurface, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              Tedarikçi: {supplierName || detail?.partnerName}
            </Text>
          </View>
        ) : null}
        <View style={styles.progressRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.progressLabel}>Toplama Durumu</Text>
            <Text style={styles.progressValue}>{totalPicked} / {totalRequired} Ürün</Text>
          </View>
          <Badge
            label={isComplete ? 'TAMAMLANDI' : 'DEVAM EDİYOR'}
            type={isComplete ? 'success' : 'warning'}
            icon={isComplete ? 'check-circle' : 'progress-clock'}
          />
        </View>

        <View style={styles.scanRow}>
          <TextInput
            style={styles.barcodeInput}
            placeholder="Ürün barkodunu okutun..."
            placeholderTextColor={Colors.outline}
            value={barcode}
            onChangeText={setBarcode}
            onSubmitEditing={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
            returnKeyType="search"
            showSoftInputOnFocus={true}
          />
          <TouchableOpacity
            style={[styles.scanButton, { backgroundColor: Colors.secondaryContainer, marginRight: 4 }]}
            onPress={() => setShowCameraScanner(true)}
            activeOpacity={0.7}
          >
            <CustomIcon name="camera" size={20} color={Colors.onSecondaryContainer} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
            activeOpacity={0.7}
          >
            <CustomIcon name="barcode-scan" size={22} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {refreshing && lines.length === 0 ? (
        <FlatList
          data={[1, 2, 3, 4]}
          renderItem={() => <ShipmentItemSkeleton />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={lines}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchDetail}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            !refreshing ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <CustomIcon name="clipboard-alert-outline" size={48} color={Colors.outline} />
                <Text style={{ marginTop: 10, color: Colors.outline }}>Bu siparişte kalem bulunmuyor.</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Toplama Kaydetme Butonu (Footer) */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, totalPicked === 0 && styles.saveBtnDisabled]}
          onPress={handleCompletePicking}
          disabled={totalPicked === 0 || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.onPrimary} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CustomIcon name="content-save" size={18} color={Colors.onPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Toplamayı Tamamla</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Miktar Düzenleme Modali */}
      <Modal visible={showModal} animationType="fade" transparent={true} onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Miktar Girin</Text>
            {selectedLine && (
              <View style={styles.modalProductInfo}>
                <Text style={styles.modalProductCode}>{selectedLine.stockCode}</Text>
                <Text style={styles.modalProductName}>{selectedLine.stockName}</Text>
                <Text style={styles.modalProductMeta}>
                  Sipariş Miktarı: <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{selectedLine.quantity}</Text> {selectedLine.unit || 'Adet'}
                </Text>
              </View>
            )}
            
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={qtyInput}
              onChangeText={setQtyInput}
              autoFocus={true}
              placeholder="0"
              placeholderTextColor={Colors.outline}
              selectTextOnFocus={true}
              onSubmitEditing={handleSaveQty}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveButton} 
                onPress={handleSaveQty}
              >
                <Text style={styles.modalSaveText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Uyuşmazlık Uyarı Modalı */}
      <Modal
        visible={showDiscrepancyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDiscrepancyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.discrepancyModalContent}>
            <View style={styles.discrepancyHeader}>
              <CustomIcon name="alert-circle-outline" size={24} color={Colors.warning} style={{ marginRight: 6 }} />
              <Text style={styles.discrepancyTitle}>Miktar Uyuşmazlığı Uyarı</Text>
            </View>
            <Text style={styles.discrepancySubtitle}>
              Sipariş miktarları ile toplanan miktarlar arasında farklar tespit edildi. Yine de kaydetmek istiyor musunuz?
            </Text>

            <FlatList
              data={discrepancyList}
              keyExtractor={(item, index) => String(index)}
              style={{ maxHeight: 150, marginVertical: Spacing.sm }}
              renderItem={({ item }) => (
                <View style={styles.discrepancyItem}>
                  <Text style={styles.discrepancyItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.discrepancyItemQtyBox}>
                    <Text style={styles.discrepancyItemQty}>
                      {item.picked} / {item.ordered}
                    </Text>
                    <Badge
                      label={item.type === 'missing' ? 'EKSİK' : 'FAZLA'}
                      type={item.type === 'missing' ? 'error' : 'warning'}
                    />
                  </View>
                </View>
              )}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowDiscrepancyModal(false)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Geri Dön</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, { backgroundColor: Colors.warning }]}
                onPress={executeSaveReceipt}
                disabled={submitting}
              >
                <Text style={styles.modalSaveText}>Yine de Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CameraScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={(scannedCode) => {
          setBarcode(scannedCode);
          handleScan(scannedCode);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerArea: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    ...Shadow.sm,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressLabel: {
    ...Typography.labelSm,
    color: Colors.outline,
  },
  progressValue: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
  },
  statusBadgeComplete: {
    backgroundColor: 'rgba(52, 168, 83, 0.1)',
  },
  statusText: {
    ...Typography.labelSm,
    color: Colors.primary,
  },
  statusTextComplete: {
    color: Colors.success,
  },
  scanRow: {
    flexDirection: 'row',
  },
  barcodeInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    height: 38,
    fontSize: 13,
    color: Colors.onSurface,
  },
  scanButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 8,
    gap: 6,
    paddingBottom: 40,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 6,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.sm,
  },
  productCardUnder: {
    backgroundColor: Colors.errorContainer,
    borderColor: Colors.error,
  },
  productCardOver: {
    backgroundColor: Colors.warningContainer,
    borderColor: Colors.warning,
  },
  productCardMatch: {
    backgroundColor: Colors.successContainer,
    borderColor: Colors.success,
  },
  productIconBox: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  productInfo: {
    flex: 1,
  },
  productCode: {
    fontSize: 10,
    color: Colors.outline,
  },
  productName: {
    fontSize: 13,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  qtyPicked: {
    fontSize: 15,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  qtyTotal: {
    fontSize: 11,
    color: Colors.outline,
    marginLeft: 2,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadow.card,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
  },
  modalProductInfo: {
    backgroundColor: Colors.background,
    padding: 8,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  modalProductCode: {
    fontSize: 10,
    color: Colors.outline,
    marginBottom: 1,
  },
  modalProductName: {
    fontSize: 14,
    color: Colors.onSurface,
    fontWeight: '500',
    marginBottom: 4,
  },
  modalProductMeta: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    height: 38,
    fontSize: 14,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalCancelButton: {
    padding: Spacing.sm,
    justifyContent: 'center',
  },
  modalCancelText: {
    ...Typography.labelLg,
    color: Colors.outline,
  },
  modalSaveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
  },
  modalSaveText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
    ...Shadow.nav,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: Colors.outline,
    opacity: 0.6,
  },
  saveBtnText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  discrepancyModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadow.card,
    width: '90%',
    alignSelf: 'center',
  },
  discrepancyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  discrepancyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  discrepancySubtitle: {
    fontSize: 13,
    color: Colors.outline,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  discrepancyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  discrepancyItemName: {
    fontSize: 13,
    color: Colors.onSurface,
    flex: 1,
    marginRight: Spacing.md,
  },
  discrepancyItemQtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  discrepancyItemQty: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.onSurfaceVariant,
  },
});
