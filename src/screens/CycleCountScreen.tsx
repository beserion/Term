import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, Stock, createCycleCount, getCycleCounts, CycleCountListItemDto } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { Numpad } from '../components/Numpad';
import { WarehouseSelectModal } from '../components/WarehouseSelectModal';
import { FeedbackService } from '../services/feedback';

interface CountedItem {
  product: Stock;
  countedQty: number;
}

export function CycleCountScreen() {
  const navigation = useNavigation<any>();
  const [barcode, setBarcode] = useState('');
  const [countedItems, setCountedItems] = useState<CountedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Quantity Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CountedItem | null>(null);
  const [editQtyStr, setEditQtyStr] = useState('');

  const [showSoftKeyboard, setShowSoftKeyboard] = useState(false);
  const barcodeInputRef = React.useRef<TextInput>(null);

  const { activeWarehouseId, activeWarehouseName } = useSettingsStore();
  const showToast = useUIStore((s) => s.showToast);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Sayım Listesi Seçim Durumları
  const [cycleCounts, setCycleCounts] = useState<CycleCountListItemDto[]>([]);
  const [selectedCycleCount, setSelectedCycleCount] = useState<CycleCountListItemDto | null>(null);
  const [showCycleCountModal, setShowCycleCountModal] = useState(false);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  const fetchCycleCounts = async () => {
    setIsLoadingCounts(true);
    try {
      const data = await getCycleCounts();
      setCycleCounts(data);
      if (data.length > 0) {
        setShowCycleCountModal(true);
      } else {
        showToast({ message: 'Aktif/Bekleyen sayım fişi bulunamadı. Yeni fiş başlatılacak.', type: 'info' });
      }
    } catch (err) {
      console.error(err);
      showToast({ message: 'Sayım listeleri yüklenemedi.', type: 'error' });
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    fetchCycleCounts();
  }, []);

  const lastScanTimeRef = React.useRef<number>(0);
  const lastScanBarcodeRef = React.useRef<string>('');
  const isScanningRef = React.useRef<boolean>(false);

  const handleScan = async (scannedBarcode: string) => {
    if (!scannedBarcode.trim() || isScanningRef.current) return;

    const now = Date.now();
    // 800ms içinde aynı barkodun mükerrer okunmasını engelle
    if (scannedBarcode === lastScanBarcodeRef.current && (now - lastScanTimeRef.current) < 800) {
      return;
    }

    isScanningRef.current = true;
    lastScanBarcodeRef.current = scannedBarcode;
    lastScanTimeRef.current = now;

    // Barkod okunduğu anda girişi anında sıfırla ki seri okuma yapılabilsin
    setBarcode('');

    try {
      const data = await getStockByBarcode(scannedBarcode);
      if (!data || !data.id || data.id === 0) {
        throw new Error('Ürün kaydı bulunamadı');
      }

      // Listede var mı kontrol et
      setCountedItems(prev => {
        const existing = prev.find(item => item.product.id === data.id);
        if (existing) {
          // Varsa miktarını 1 artır
          return prev.map(item =>
            item.product.id === data.id
              ? { ...item, countedQty: item.countedQty + 1 }
              : item
          );
        } else {
          // Yoksa yeni ekle (Miktar 1)
          return [{ product: data, countedQty: 1 }, ...prev];
        }
      });
      showToast({ message: `${data.stockName} okundu`, type: 'success' });
      FeedbackService.playSuccess();
    } catch {
      showToast({ message: 'Barkod bulunamadı: ' + scannedBarcode, type: 'error' });
      FeedbackService.playError();
    } finally {
      setBarcode('');
      isScanningRef.current = false;
    }
  };

  useBarcode(handleScan);

  useEffect(() => {
    if (barcode.trim().length >= 4) {
      const timeout = setTimeout(() => {
        handleScan(barcode.trim());
      }, 300); // 300ms daha seri algılama sağlar
      return () => clearTimeout(timeout);
    }
  }, [barcode]);

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const qty = parseFloat(editQtyStr);

    if (isNaN(qty) || qty < 0) {
      showToast({ message: 'Geçerli bir miktar girin', type: 'error' });
      return;
    }

    setCountedItems(prev => prev.map(item =>
      item.product.id === editingItem.product.id
        ? { ...item, countedQty: qty }
        : item
    ));
    setShowEditModal(false);
    setEditingItem(null);
  };

  const handleRemoveItem = (stockId: number) => {
    setCountedItems(prev => prev.filter(item => item.product.id !== stockId));
  };

  const handleSubmit = async () => {
    if (!activeWarehouseId) {
      showToast({ message: 'Lütfen ayarlardan depo seçin', type: 'error' });
      return;
    }
    if (countedItems.length === 0) {
      showToast({ message: 'Sayım listesi boş', type: 'info' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createCycleCount({
        cycleCountId: selectedCycleCount?.id,
        documentNo: selectedCycleCount?.documentNo || 'CYC-' + Date.now(),
        countDate: new Date().toISOString(),
        warehouseId: activeWarehouseId,
        lines: countedItems.map(item => ({
          stockId: item.product.id,
          countedQty: item.countedQty
        }))
      });
      showToast({ message: 'Sayım fişi başarıyla güncellendi ve tamamlandı', type: 'success' });
      setCountedItems([]); // Temizle
      setSelectedCycleCount(null); // Sıfırla
      fetchCycleCounts(); // Listeyi güncelle
    } catch (err: any) {
      let errorMsg = err.message;
      if (err.response?.data) {
        errorMsg = typeof err.response.data === 'object' ? JSON.stringify(err.response.data, null, 2) : err.response.data;
      }
      console.error("=== CYCLE COUNT API ERROR ===");
      console.error(errorMsg);
      showToast({ message: 'Sayım kaydedilemedi. Detaylar terminalde.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Depo Sayım (Cycle-Count)" onBack={() => navigation.goBack()} />


      <TouchableOpacity
        style={styles.cycleCountSelectBtn}
        onPress={() => setShowCycleCountModal(true)}
        activeOpacity={0.8}
      >
        <CustomIcon name="clipboard-text-play-outline" size={24} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.warehouseAlertLabel}>Aktif Sayım Fişi</Text>
          <Text style={styles.warehouseAlertName}>
            {selectedCycleCount ? `${selectedCycleCount.warehouseName || 'Depo Belirtilmemiş'} - ${selectedCycleCount.remarks || 'Açıklama Yok'}` : 'SAYIM FİŞİ SEÇİLMEMİŞ!'}
          </Text>
        </View>
        <CustomIcon name="chevron-down" size={20} color={Colors.primary} />
      </TouchableOpacity>

      {!selectedCycleCount ? (
        <View style={styles.noCountContainer}>
          <CustomIcon name="clipboard-alert-outline" size={64} color={Colors.outline} />
          <Text style={styles.noCountTitle}>Sayım Fişi Seçilmedi</Text>
          <Text style={styles.noCountText}>
            Barkod taramaya başlamak için lütfen aktif bir sayım fişi seçin.
          </Text>
          <TouchableOpacity
            style={styles.selectCountBigBtn}
            onPress={() => setShowCycleCountModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.selectCountBigBtnText}>Sayım Fişi Seç</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.scanContainer}>
            <View style={styles.scanRow}>
              <View style={styles.barcodeInputContainer}>
                <TextInput
                  style={styles.barcodeInput}
                  placeholder="Barkod okutun..."
                  placeholderTextColor={Colors.outline}
                  value={barcode}
                  onChangeText={(val) => { if (!isScanningRef.current) setBarcode(val); }}
                  onSubmitEditing={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
                  returnKeyType="search"
                  ref={barcodeInputRef}
                  autoFocus={true}
                  showSoftInputOnFocus={showSoftKeyboard}
                />
                <TouchableOpacity
                  style={styles.keyboardToggleBtn}
                  onPress={() => {
                    setShowSoftKeyboard(prev => !prev);
                    setTimeout(() => barcodeInputRef.current?.focus(), 100);
                  }}
                  activeOpacity={0.7}
                >
                  <CustomIcon
                    name={showSoftKeyboard ? "keyboard" : "keyboard-outline"}
                    size={22}
                    color={showSoftKeyboard ? Colors.primary : Colors.outline}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.hint}>Peş peşe okutulan aynı ürünlerin miktarı otomatik toplanır.</Text>
          </View>

          <FlatList
            data={countedItems}
            keyExtractor={item => item.product.id.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <CustomIcon name="barcode-scan" size={48} color={Colors.outlineVariant} />
                <Text style={styles.emptyText}>Henüz ürün okutulmadı</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.listItem}>
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemCode}>{item.product.stockCode || '-'}</Text>
                  <Text style={styles.listItemName} numberOfLines={2}>{item.product.stockName}</Text>
                </View>

                <TouchableOpacity
                  style={styles.qtyBadge}
                  onPress={() => {
                    setEditingItem(item);
                    setEditQtyStr(item.countedQty.toString());
                    setShowEditModal(true);
                  }}
                >
                  <Text style={styles.qtyBadgeText}>{item.countedQty}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleRemoveItem(item.product.id)}
                >
                  <CustomIcon name="trash-can-outline" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )}
          />

          <View style={styles.footer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Toplam Kalem:</Text>
              <Text style={styles.summaryValue}>{countedItems.length}</Text>
            </View>
            <TouchableOpacity
              style={[styles.submitButton, countedItems.length === 0 && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={countedItems.length === 0 || isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Kaydediliyor...' : 'Sayımı Kaydet'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Miktar Düzenleme Modalı */}
      <Numpad
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingItem(null);
        }}
        onType={(val) => {
          if (val === '.' && editQtyStr.includes('.')) return;
          setEditQtyStr(prev => prev + val);
        }}
        onDelete={() => setEditQtyStr(prev => prev.slice(0, -1))}
        onSubmit={handleSaveEdit}
        submitLabel="MİKTARI KAYDET"
        submitColor={Colors.primary}
        title={editingItem?.product.stockName || 'Miktarı Düzenle'}
        value={editQtyStr}
      />


      {/* Sayım Fişi Seçim Modalı */}
      <Modal
        visible={showCycleCountModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCycleCountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Aktif Sayım Fişi Seçin</Text>
            <Text style={styles.modalSubTitle}>Sayıma devam etmek istediğiniz aktif bir fiş seçin:</Text>

            <FlatList
              data={cycleCounts}
              keyExtractor={(item) => item.id.toString()}
              style={{ maxHeight: 380, marginBottom: Spacing.md }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cycleCountItem}
                  onPress={() => {
                    setSelectedCycleCount(item);
                    setShowCycleCountModal(false);
                    showToast({ message: `Sayım fişi seçildi: ${item.documentNo}`, type: 'success' });
                  }}
                >
                  <CustomIcon name="clipboard-text-outline" size={24} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cycleCountItemDoc} numberOfLines={2}>
                      {item.remarks}
                    </Text>
                    <Text style={styles.cycleCountItemDesc}>
                      {item.warehouseName || `Depo ID: ${item.warehouseId}`} | {item.status || 'Aktif'}
                    </Text>
                    {item.countDate ? (
                      <Text style={styles.cycleCountItemDate}>
                        {formatDate(item.countDate)}
                      </Text>
                    ) : null}
                  </View>
                  <CustomIcon name="chevron-right" size={20} color={Colors.outline} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>Aktif sayım fişi bulunamadı.</Text>
              }
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCycleCountModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  warehouseAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 58, 138, 0.05)',
    padding: Spacing.md,
    margin: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 138, 0.2)',
    gap: Spacing.md,
  },
  warehouseAlertLabel: {
    ...Typography.labelSm,
    color: Colors.primary,
    marginBottom: 2,
  },
  warehouseAlertName: {
    ...Typography.titleMd,
    color: Colors.onSurface,
  },
  scanContainer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  scanRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  barcodeInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingRight: Spacing.xs,
  },
  barcodeInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.md,
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  keyboardToggleBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    ...Typography.labelSm,
    color: Colors.outline,
    marginTop: Spacing.xs,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadow.sm,
    gap: Spacing.md,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemCode: {
    ...Typography.labelSm,
    color: Colors.outline,
  },
  listItemName: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  qtyBadge: {
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
    minWidth: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  qtyBadgeText: {
    ...Typography.titleLg,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: Spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    opacity: 0.5,
  },
  emptyText: {
    ...Typography.bodyLg,
    marginTop: Spacing.md,
  },
  footer: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    ...Shadow.nav,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  summaryLabel: {
    ...Typography.bodyLg,
    color: Colors.onSurfaceVariant,
  },
  summaryValue: {
    ...Typography.titleLg,
    color: Colors.primary,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: Colors.outline,
  },
  submitButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalTitle: {
    ...Typography.titleLg,
    marginBottom: Spacing.xs,
  },
  modalSubTitle: {
    ...Typography.bodyMd,
    color: Colors.outline,
    marginBottom: Spacing.lg,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 56,
    ...Typography.titleLg,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  modalCancelButton: {
    padding: Spacing.md,
  },
  modalCancelText: {
    ...Typography.labelLg,
    color: Colors.outline,
  },
  modalSaveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalSaveText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  },
  cycleCountSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    gap: Spacing.md,
  },
  cycleCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    gap: Spacing.md,
  },
  cycleCountItemDoc: {
    ...Typography.titleLg,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  cycleCountItemDesc: {
    ...Typography.bodySm,
    color: Colors.outline,
    marginTop: 2,
  },
  emptyListText: {
    ...Typography.bodyLg,
    color: Colors.outline,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  newCountBtn: {
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  newCountBtnText: {
    ...Typography.labelLg,
    color: Colors.onSecondaryContainer,
    fontWeight: 'bold',
  },
  modalCancelBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    ...Typography.labelLg,
    color: Colors.outline,
  },
  cycleCountItemRemarks: {
    ...Typography.bodySm,
    color: Colors.primary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  cycleCountItemDate: {
    ...Typography.bodySm,
    color: Colors.outline,
    marginTop: 2,
  },
  noCountContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  noCountTitle: {
    ...Typography.titleLg,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  noCountText: {
    ...Typography.bodyLg,
    color: Colors.outline,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  selectCountBigBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  selectCountBigBtnText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  }
});
