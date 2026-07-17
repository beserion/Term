import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, FlatList } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, getStocks, Stock, createStockTransfer, getWarehouses, Warehouse } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { FeedbackService } from '../services/feedback';
import { ScalePressable } from '../components/ScalePressable';
import { WarehouseSelectModal } from '../components/WarehouseSelectModal';
import { Numpad } from '../components/Numpad';
import { flexMatch } from '../utils/searchHelper';

export function StockTransferScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [product, setProduct] = useState<Stock | null>(route.params?.product || null);
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  
  // Hedef Depo Modal States
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [targetWarehouseId, setTargetWarehouseId] = useState<number | null>(null);
  
  const [warehouseModalVisible, setWarehouseModalVisible] = useState(false);
  const [showSoftKeyboard, setShowSoftKeyboard] = useState(false);
  const [numpadVisible, setNumpadVisible] = useState(false);
  const barcodeInputRef = React.useRef<TextInput>(null);
  
  const { activeWarehouseId, activeWarehouseName } = useSettingsStore();
  const showToast = useUIStore((s) => s.showToast);

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = React.useRef<TextInput>(null);

  // Depoları ve Stokları çek
  useEffect(() => {
    getWarehouses()
      .then((data) => {
        if (Array.isArray(data)) {
          setWarehouses(data);
        } else if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
          setWarehouses((data as any).data);
        } else if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
          setWarehouses((data as any).items);
        } else {
          setWarehouses([]);
        }
      })
      .catch(() => {
        setWarehouses([]);
      });

    const loadStocks = async () => {
      try {
        const list = await getStocks();
        setStocks(list || []);
      } catch (err) {
        console.error("Stoklar yüklenemedi:", err);
      }
    };
    loadStocks();
  }, []);

  const handleScan = async (scannedBarcode: string) => {
    if (!scannedBarcode || scannedBarcode.trim() === '') return;

    // 1. Önce lokal stocks listesinden barkod veya kod tam eşleşmesi arayalım
    const matchedLocal = stocks.find(
      s => s.barCode?.trim() === scannedBarcode.trim() || s.stockCode?.trim() === scannedBarcode.trim()
    );

    if (matchedLocal) {
      setProduct(matchedLocal);
      FeedbackService.playSuccess();
      return;
    }

    try {
      const data = await getStockByBarcode(scannedBarcode);
      if (data && data.id && data.id !== 0) {
        setProduct(data);
        FeedbackService.playSuccess();
      } else {
        setProduct(null);
        setSearchQuery(scannedBarcode);
        setShowSearchModal(true);
        showToast({ message: 'Barkod bulunamadı. Eşleştirmek için arayın.', type: 'info' });
        FeedbackService.playError();
      }
    } catch {
      setProduct(null);
      setSearchQuery(scannedBarcode);
      setShowSearchModal(true);
      showToast({ message: 'Barkod bulunamadı. Listeden seçebilirsiniz.', type: 'error' });
      FeedbackService.playError();
    }
  };

  useBarcode(handleScan);

  useEffect(() => {
    const term = barcode.trim();
    if (term.length >= 4) {
      const isNumeric = /^\d+$/.test(term);
      if (isNumeric) {
        const timeout = setTimeout(() => {
          handleScan(term);
          setBarcode('');
        }, 500);
        return () => clearTimeout(timeout);
      } else {
        setSearchQuery(term);
        setShowSearchModal(true);
        setBarcode('');
      }
    }
  }, [barcode]);

  // Arama modalındaki filtreleme mantığı (flexMatch kullanarak)
  const filteredStocks = stocks.filter((item) => {
    if (!searchQuery.trim()) return true;
    const searchString = [
      item.stockName,
      item.stockNameTr,
      item.stockCode,
      item.brand,
      item.model,
      item.impaCode
    ].filter(Boolean).join(' ');
    return flexMatch(searchString, searchQuery);
  });

  const handleSelectProductFromSearch = (selectedItem: Stock) => {
    setProduct(selectedItem);
    setShowSearchModal(false);
    FeedbackService.playSuccess();
  };

  const handleTransfer = async () => {
    if (!product) return;
    
    if (!activeWarehouseId) {
      showToast({ message: 'Lütfen ayarlardan çıkış (terminal) deposunu seçin', type: 'error' });
      return;
    }
    if (!targetWarehouseId) {
      showToast({ message: 'Lütfen hedef depoyu seçin', type: 'error' });
      return;
    }
    if (activeWarehouseId === targetWarehouseId) {
      showToast({ message: 'Çıkış deposu ile Hedef depo aynı olamaz', type: 'info' });
      return;
    }
    
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      showToast({ message: 'Geçerli bir miktar girin', type: 'error' });
      return;
    }
    
    try {
      await createStockTransfer({
        documentDate: new Date().toISOString(),
        documentNo: note.trim() || 'TRN-' + Date.now(),
        fromWarehouseId: activeWarehouseId,
        toWarehouseId: targetWarehouseId,
        lines: [
          { stockId: product.id, transferQty: qty, qty: qty, receivedQty: qty }
        ]
      });
      FeedbackService.playSuccess();
      showToast({ message: `${product.stockName} transferi başarıyla kaydedildi`, type: 'success' });
      
      setQuantity('');
      setNote('');
      setProduct(null); // Transfer sonrası ekranı temizle
    } catch (err: any) {
      FeedbackService.playError();
      let errorMsg = err.message;
      if (err.response?.data) {
        errorMsg = typeof err.response.data === 'object' ? JSON.stringify(err.response.data, null, 2) : err.response.data;
      }
      console.error("=== STOCK TRANSFER API ERROR ===");
      console.error(errorMsg);
      showToast({ message: 'Transfer başarısız. Detaylar terminalde.', type: 'error' });
    }
  };

  const getTargetWarehouseName = () => {
    if (!targetWarehouseId) return 'Hedef Depo Seçin';
    const w = warehouses.find(x => x.id === targetWarehouseId);
    return w ? (w.warehouseName || w.warehouseCode) : 'Bilinmeyen Depo';
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Depo Transferi" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Çıkış Deposu (Terminal Depo) */}
        <TouchableOpacity 
          style={styles.warehouseAlert} 
          onPress={() => setWarehouseModalVisible(true)}
          activeOpacity={0.8}
        >
          <CustomIcon name="export" size={20} color={Colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warehouseAlertLabel}>Çıkış Deposu (Terminal)</Text>
            <Text style={styles.warehouseAlertName}>
              {activeWarehouseId ? activeWarehouseName : 'DEPO SEÇİLMEMİŞ! Dokunup seçin.'}
            </Text>
          </View>
          <CustomIcon name="chevron-down" size={20} color={Colors.error} />
        </TouchableOpacity>

        {/* Hedef Depo Seçimi */}
        <TouchableOpacity 
          style={[styles.warehouseAlert, { backgroundColor: 'rgba(52, 168, 83, 0.1)', borderColor: 'rgba(52, 168, 83, 0.3)' }]}
          onPress={() => setShowWarehouseModal(true)}
          activeOpacity={0.7}
        >
          <CustomIcon name="import" size={20} color={Colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.warehouseAlertLabel, { color: Colors.success }]}>Hedef Depo (Varış)</Text>
            <Text style={styles.warehouseAlertName}>{getTargetWarehouseName()}</Text>
          </View>
          <CustomIcon name="chevron-down" size={24} color={Colors.onSurface} />
        </TouchableOpacity>

        {/* Barkod giriş */}
        <View style={styles.scanRow}>
          <View style={styles.barcodeInputContainer}>
            <TextInput
              style={styles.barcodeInput}
              placeholder="Barkod okutun veya girin..."
              placeholderTextColor={Colors.outline}
              value={barcode}
              onChangeText={setBarcode}
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
          <TouchableOpacity 
            style={styles.scanButton}
            onPress={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
          >
            <CustomIcon name="barcode-scan" size={24} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Ürün Detayı */}
        {product && (
          <View style={styles.productCard}>
            <View style={styles.productHeader}>
              <View style={styles.iconBoxContainer}>
                <CustomIcon name="swap-horizontal" size={28} color={Colors.primary} />
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.stockCode}>{product.stockCode || '-'}</Text>
                <Text style={styles.stockName}>{product.stockName}</Text>
              </View>
            </View>

            <View style={styles.qtyContainer}>
              <Text style={styles.qtyLabel}>Mevcut Miktar</Text>
              <Text style={styles.qtyValue}>{product.qty || 0}</Text>
            </View>
            <View style={styles.divider} />

            {/* Form */}
            <Text style={styles.inputLabel}>Transfer Miktarı</Text>
            <TouchableOpacity 
              style={styles.quantityInputTouchable} 
              onPress={() => setNumpadVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.quantityInputText, !quantity && styles.quantityInputPlaceholder]}>
                {quantity || '0'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Not / Belge No</Text>
            <TextInput
              style={styles.input}
              placeholder="İsteğe bağlı..."
              placeholderTextColor={Colors.outline}
              value={note}
              onChangeText={setNote}
            />

            <ScalePressable 
              style={[styles.actionButton, (!quantity || !targetWarehouseId) && styles.actionButtonDisabled]}
              onPress={handleTransfer}
              disabled={!quantity || !targetWarehouseId}
            >
              <CustomIcon name="truck-fast" size={24} color={Colors.onPrimary} style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>Transferi Başlat</Text>
            </ScalePressable>
          </View>
        )}
      </ScrollView>

      {/* Hedef Depo Seçim Modalı */}
      <Modal visible={showWarehouseModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Hedef Depo Seçin</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {(Array.isArray(warehouses) ? warehouses : []).map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setTargetWarehouseId(w.id);
                    setShowWarehouseModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{w.warehouseName || w.warehouseCode}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowWarehouseModal(false)}>
              <Text style={styles.modalCloseText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <WarehouseSelectModal
        visible={warehouseModalVisible}
        onClose={() => setWarehouseModalVisible(false)}
      />

      {product && (
        <Numpad 
          visible={numpadVisible}
          onClose={() => setNumpadVisible(false)}
          onType={(val) => setQuantity(prev => prev + val)}
          onDelete={() => setQuantity(prev => prev.slice(0, -1))}
          onSubmit={handleTransfer}
          submitLabel="TRANSFERİ BAŞLAT"
          submitColor={Colors.primary}
        />
      )}

      {/* TAM EKRAN ÜRÜN ARAMA VE SEÇİM MODALİ */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitleText}>Ürün Seçin</Text>
              {searchQuery ? (
                <Text style={styles.modalSubtitleText}>Arama: "{searchQuery}" için sonuçlar</Text>
              ) : (
                <Text style={styles.modalSubtitleText}>Esnek arama yapmak için yazın</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setShowSearchModal(false)}
              style={styles.modalCloseBtn}
            >
              <CustomIcon name="close" size={24} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          {/* Modal Arama Çubuğu */}
          <View style={styles.modalSearchRow}>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Ürün adı veya stok kodu ile ara..."
              placeholderTextColor={Colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
              ref={searchInputRef}
              autoFocus={true}
              clearButtonMode="while-editing"
            />
            <View style={styles.modalSearchIcon}>
              <CustomIcon name="magnify" size={20} color={Colors.outline} />
            </View>
          </View>

          {/* Yoğun Ürün Listesi */}
          <FlatList
            data={filteredStocks}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.modalListContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalListItem}
                onPress={() => handleSelectProductFromSearch(item)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                  <Text style={styles.modalItemName}>{item.stockName}</Text>
                  {item.stockNameTr ? (
                    <Text style={styles.modalItemNameTr}>{item.stockNameTr}</Text>
                  ) : null}
                  <Text style={styles.modalItemCode}>
                    {item.stockCode} {item.barCode ? `| ${item.barCode}` : '| BARKODSUZ'}
                    {item.brand ? (
                      <> | <Text style={styles.modalItemBrand}>{item.brand}</Text></>
                    ) : null}
                    {item.model ? ` | ${item.model}` : ''}
                  </Text>
                </View>
                <CustomIcon name="chevron-right" size={16} color={Colors.outline} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>Aranan ürün bulunamadı.</Text>
              </View>
            }
          />
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
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  warehouseAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(186, 26, 26, 0.08)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.2)',
    gap: Spacing.md,
  },
  warehouseAlertLabel: {
    ...Typography.labelSm,
    color: Colors.error,
    marginBottom: 2,
  },
  warehouseAlertName: {
    ...Typography.titleMd,
    color: Colors.onSurface,
  },
  scanRow: {
    flexDirection: 'row',
    gap: 6,
  },
  barcodeInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingRight: Spacing.xs,
  },
  barcodeInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Colors.onSurface,
  },
  keyboardToggleBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    width: 40,
    height: 40,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  productCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xs,
    padding: 8,
    ...Shadow.card,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  iconBoxContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
  },
  stockCode: {
    fontSize: 11,
    color: Colors.outline,
    marginBottom: 2,
  },
  stockName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  qtyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 6,
    borderRadius: BorderRadius.xs,
  },
  qtyLabel: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  qtyValue: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.outlineVariant,
    marginVertical: 8,
  },
  inputLabel: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginBottom: 2,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    height: 38,
    fontSize: 14,
    color: Colors.onSurface,
    marginBottom: 8,
  },
  quantityInputTouchable: {
    height: 38,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quantityInputText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  quantityInputPlaceholder: {
    color: Colors.outline,
  },
  actionButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xs,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadow.sm,
  },
  actionButtonDisabled: {
    backgroundColor: Colors.outline,
    elevation: 0,
    shadowOpacity: 0,
  },
  actionButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 10,
  },
  modalTitle: {
    ...Typography.titleMedium,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  modalItemText: {
    fontSize: 13,
  },
  modalCloseButton: {
    marginTop: 10,
    padding: 8,
    alignItems: 'center',
    backgroundColor: Colors.outlineVariant,
    borderRadius: BorderRadius.xs,
  },
  modalCloseText: {
    ...Typography.labelLg,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
  },
  modalTitleText: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  modalSubtitleText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  modalSearchInput: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingLeft: 40,
    paddingRight: 12,
    fontSize: 14,
    color: Colors.onSurface,
  },
  modalSearchIcon: {
    position: 'absolute',
    left: Spacing.lg + 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalListContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadow.sm,
  },
  modalItemName: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  modalItemNameTr: {
    ...Typography.bodySm,
    color: '#1d4ed8',
    fontStyle: 'italic',
    marginTop: 1,
  },
  modalItemBrand: {
    fontWeight: 'bold',
    color: '#b85c00',
  },
  modalItemCode: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 3,
  },
  emptyList: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListText: {
    color: Colors.outline,
    ...Typography.bodyMd,
  },
});
