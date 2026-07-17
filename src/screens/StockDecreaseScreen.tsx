import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Modal, FlatList } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, getStocks, Stock, createGoodsIssue } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { Numpad } from '../components/Numpad';
import { FeedbackService } from '../services/feedback';
import { WarehouseSelectModal } from '../components/WarehouseSelectModal';
import { flexMatch, normalizeText } from '../utils/searchHelper';

export function StockDecreaseScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [product, setProduct] = useState<Stock | null>(route.params?.product || null);
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [numpadVisible, setNumpadVisible] = useState(false);
  const [warehouseModalVisible, setWarehouseModalVisible] = useState(false);
  const [showSoftKeyboard, setShowSoftKeyboard] = useState(false);
  const barcodeInputRef = React.useRef<TextInput>(null);
  
  const { activeWarehouseId, activeWarehouseName } = useSettingsStore();
  const showToast = useUIStore((s) => s.showToast);
  const showErrorLock = useUIStore((s) => s.showErrorLock);

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = React.useRef<TextInput>(null);

  useEffect(() => {
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

    // 1. Önce lokal stocks listesinden barkod veya kod tam eşleşmesi arayalım (normalize edilmiş olarak)
    const normalizedScanned = normalizeText(scannedBarcode);
    const matchedLocal = stocks.find(
      s => (s.barCode && normalizeText(s.barCode) === normalizedScanned) || 
           (s.stockCode && normalizeText(s.stockCode) === normalizedScanned)
    );

    if (matchedLocal) {
      setProduct(matchedLocal);
      FeedbackService.playLightImpact();
      return;
    }

    try {
      const data = await getStockByBarcode(scannedBarcode);
      if (data && data.id && data.id !== 0) {
        setProduct(data);
        FeedbackService.playLightImpact();
      } else {
        setProduct(null);
        setSearchQuery(scannedBarcode);
        setShowSearchModal(true);
        showToast({ message: 'Barkod bulunamadı. Eşleştirmek için arayın.', type: 'info' });
        FeedbackService.playError();
      }
    } catch (err: any) {
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

  const handleDecrease = async () => {
    if (!product) return;
    
    if (!activeWarehouseId) {
      showToast({ message: 'Lütfen ayarlardan terminal deposunu seçin', type: 'error' });
      return;
    }
    
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      FeedbackService.playError();
      showErrorLock('Geçerli bir miktar girmelisiniz!');
      return;
    }
    
    if (product.qty !== undefined && qty > product.qty) {
      FeedbackService.playError();
      showErrorLock(`Yetersiz stok! En fazla ${product.qty} adet çıkış yapabilirsiniz.`);
      return;
    }
    
    executeDecrease(qty);
  };

  const executeDecrease = async (qty: number) => {
    try {
      await createGoodsIssue({
        documentDate: new Date().toISOString(),
        documentNo: note.trim() || 'TRM-' + Date.now(),
        warehouseId: activeWarehouseId!,
        lines: [
          { stockId: product!.id, issuedQty: qty, qty: qty, requestedQty: qty }
        ]
      });
      FeedbackService.playSuccess();
      showToast({ message: `${product!.stockName} stoğu ${qty} azaltıldı`, type: 'success' });
      
      // Güncel stok miktarını API'den tekrar çek
      if (product!.barCode) {
        try {
          const freshProduct = await getStockByBarcode(product!.barCode);
          if (freshProduct && freshProduct.id && freshProduct.id !== 0) {
            setProduct(freshProduct);
          } else {
            setProduct(null);
          }
        } catch (fetchErr) {
          console.error("Güncel stok çekilemedi:", fetchErr);
          setProduct(null);
        }
      } else {
        setProduct(null);
      }

      setQuantity('');
      setNote('');
      setBarcode('');
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    } catch (err: any) {
      let errorMsg = err.message;
      
      if (err.response) {
        if (err.response.data?.message) {
          errorMsg = err.response.data.message;
        } else if (typeof err.response.data === 'string') {
          errorMsg = err.response.data;
        } else {
          errorMsg = JSON.stringify(err.response.data, null, 2);
        }
      }
      
      console.error("=== STOCK DECREASE API ERROR ===");
      console.error(errorMsg);
      console.error("=================================");
      FeedbackService.playError();
      showErrorLock(`API HATASI:\n\n${errorMsg}`);
    }
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Mal Çıkış (Stok Düşümü)" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Terminal Depo Bilgisi */}
        <TouchableOpacity 
          style={styles.warehouseAlert} 
          onPress={() => setWarehouseModalVisible(true)}
          activeOpacity={0.8}
        >
          <CustomIcon name="office-building-marker" size={20} color={Colors.onErrorContainer} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warehouseAlertLabel}>Aktif Terminal Deposu</Text>
            <Text style={styles.warehouseAlertName}>
              {activeWarehouseId ? activeWarehouseName : 'DEPO SEÇİLMEMİŞ! Dokunup seçin.'}
            </Text>
          </View>
          <CustomIcon name="chevron-down" size={20} color={Colors.onErrorContainer} />
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
              showSoftInputOnFocus={true}
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

        {/* Ürün Bilgisi */}
        {product && (
          <View style={styles.productCard}>
            <View style={styles.productHeader}>
              <CustomIcon name="package-variant" size={24} color={Colors.error} />
              <Text style={styles.productName}>{product.stockName}</Text>
            </View>
            <View style={styles.stockInfo}>
              <Text style={styles.stockLabel}>Kart Miktarı</Text>
              <Text style={styles.stockValue}>{product.qty || 0} {product.unit || 'Adet'}</Text>
            </View>

            {/* Miktar */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Çıkarılacak Miktar</Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() => {
                    const q = Math.max(0, (parseInt(quantity) || 0) - 1);
                    setQuantity(q > 0 ? String(q) : '');
                  }}
                >
                  <CustomIcon name="minus" size={24} color={Colors.error} />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.quantityInputTouchable} 
                  onPress={() => setNumpadVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quantityInputText, !quantity && styles.quantityInputPlaceholder]}>
                    {quantity || '0'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() => setQuantity(String((parseInt(quantity) || 0) + 1))}
                >
                  <CustomIcon name="plus" size={24} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Not */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Belge No / Not (İsteğe bağlı)</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Açıklama ekleyin..."
                placeholderTextColor={Colors.outline}
                multiline
              />
            </View>
            {/* Onayla */}
            <TouchableOpacity
              style={styles.decreaseButton}
              onPress={handleDecrease}
              activeOpacity={0.8}
            >
              <CustomIcon name="minus-circle" size={20} color={Colors.onPrimary} />
              <Text style={styles.decreaseButtonText}>Stok Azalt</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {product && (
        <Numpad 
          visible={numpadVisible}
          onClose={() => setNumpadVisible(false)}
          onType={(val) => setQuantity(prev => prev + val)}
          onDelete={() => setQuantity(prev => prev.slice(0, -1))}
          onSubmit={handleDecrease}
          submitLabel="STOK AZALT"
          submitColor={Colors.error}
        />
      )}

      <WarehouseSelectModal
        visible={warehouseModalVisible}
        onClose={() => setWarehouseModalVisible(false)}
      />

      {/* TAM EKRAN ÜRÜN ARAMA VE SEÇİM MODALİ */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        onRequestClose={() => setShowSearchModal(false)}
        onShow={() => {
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 150);
        }}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowSearchModal(false);
                  navigation.navigate('StockAddEdit');
                }}
                style={styles.modalAddHeaderBtn}
              >
                <CustomIcon name="plus-circle" size={26} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowSearchModal(false)}
                style={styles.modalCloseBtn}
              >
                <CustomIcon name="close" size={24} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>
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
              showSoftInputOnFocus={true}
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
                    {item.stockCode || 'KODSUZ'} {item.barCode ? `| ${item.barCode}` : '| BARKODSUZ'}
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
                <TouchableOpacity
                  style={styles.modalAddButton}
                  onPress={() => {
                    setShowSearchModal(false);
                    navigation.navigate('StockAddEdit');
                  }}
                >
                  <CustomIcon name="plus" size={16} color={Colors.onPrimaryContainer || '#21005d'} />
                  <Text style={styles.modalAddButtonText}>Yeni Stok Kartı Ekle</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.marginMobile, gap: Spacing.lg, paddingBottom: 40 },
  warehouseAlert: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.errorContainer, padding: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.surfaceContainerHigh,
  },
  warehouseAlertLabel: { ...Typography.labelSm, color: Colors.onErrorContainer },
  warehouseAlertName: { ...Typography.titleMd, color: Colors.onErrorContainer, fontWeight: 'bold' },
  scanRow: { flexDirection: 'row', gap: Spacing.sm },
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
    paddingHorizontal: 12,
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
    width: 40, height: 40,
    borderRadius: BorderRadius.xs, backgroundColor: Colors.errorContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  productCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs, padding: 8,
    borderWidth: 1, borderColor: Colors.errorContainer, ...Shadow.card,
  },
  productHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8,
  },
  productName: { fontSize: 15, fontWeight: 'bold', color: Colors.onSurface, flex: 1 },
  stockInfo: {
    backgroundColor: Colors.errorContainer, borderRadius: BorderRadius.xs,
    padding: 6, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  stockLabel: { ...Typography.labelSm, color: Colors.onErrorContainer },
  stockValue: { fontSize: 16, color: Colors.error, fontWeight: '700' },
  inputGroup: { marginBottom: 8 },
  inputLabel: {
    ...Typography.labelSm, color: Colors.onSurfaceVariant, marginBottom: 4,
  },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyButton: {
    width: 38, height: 38,
    borderRadius: BorderRadius.xs, borderWidth: 1, borderColor: Colors.outlineVariant,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface,
  },
  quantityInputTouchable: {
    flex: 1, height: 38,
    borderRadius: BorderRadius.xs, borderWidth: 1, borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  quantityInputText: {
    fontSize: 16, fontWeight: 'bold', color: Colors.error,
  },
  quantityInputPlaceholder: {
    color: Colors.outline,
  },
  noteInput: {
    height: 50, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xs, borderWidth: 1, borderColor: Colors.outlineVariant,
    paddingHorizontal: 8, paddingTop: 4,
    ...Typography.bodyMd, color: Colors.onSurface, textAlignVertical: 'top',
  },
  decreaseButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.error, borderRadius: BorderRadius.xs,
    minHeight: 38,
  },
  decreaseButtonText: { ...Typography.labelLg, color: Colors.onError, fontWeight: 'bold', fontSize: 14 },
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
  modalAddButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryContainer || '#e8def8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    gap: 6,
  },
  modalAddButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.onPrimaryContainer || '#21005d',
  },
  modalAddHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
