import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, Stock, createGoodsIssue } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { Numpad } from '../components/Numpad';
import { FeedbackService } from '../services/feedback';
import { WarehouseSelectModal } from '../components/WarehouseSelectModal';

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

  const handleScan = async (scannedBarcode: string) => {
    try {
      const data = await getStockByBarcode(scannedBarcode);
      if (!data || !data.id || data.id === 0) {
        throw new Error('Ürün kaydı bulunamadı (Eksik veya boş kayıt)');
      }
      setProduct(data);
      FeedbackService.playLightImpact();
    } catch (err: any) {
      let msg = 'Barkod bulunamadı: ' + scannedBarcode;
      if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err.message) {
        msg = err.message;
      }
      FeedbackService.playError();
      showErrorLock(msg);
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
          { stockId: product!.id, issuedQty: qty }
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
    height: Spacing.touchTargetMin,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingRight: Spacing.xs,
  },
  barcodeInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.lg,
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  keyboardToggleBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    width: Spacing.touchTargetMin, height: Spacing.touchTargetMin,
    borderRadius: BorderRadius.md, backgroundColor: Colors.errorContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  productCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md, padding: Spacing.cardPadding,
    borderWidth: 1, borderColor: Colors.errorContainer, ...Shadow.card,
  },
  productHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  productName: { ...Typography.headlineSm, color: Colors.onSurface, flex: 1 },
  stockInfo: {
    backgroundColor: Colors.errorContainer, borderRadius: BorderRadius.sm,
    padding: Spacing.md, marginBottom: Spacing.lg,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  stockLabel: { ...Typography.labelMd, color: Colors.onErrorContainer },
  stockValue: { ...Typography.headlineMd, color: Colors.error, fontWeight: '700' },
  inputGroup: { marginBottom: Spacing.lg },
  inputLabel: {
    ...Typography.labelLg, color: Colors.onSurfaceVariant, marginBottom: Spacing.sm,
  },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qtyButton: {
    width: Spacing.touchTargetMin, height: Spacing.touchTargetMin,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.outlineVariant,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface,
  },
  quantityInputTouchable: {
    flex: 1, height: Spacing.touchTargetMin,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  quantityInputText: {
    ...Typography.headlineMd, color: Colors.error,
  },
  quantityInputPlaceholder: {
    color: Colors.outline,
  },
  noteInput: {
    height: 80, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    ...Typography.bodyMd, color: Colors.onSurface, textAlignVertical: 'top',
  },
  decreaseButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.error, borderRadius: BorderRadius.sm,
    minHeight: Spacing.touchTargetMin,
  },
  decreaseButtonText: { ...Typography.labelLg, color: Colors.onError, fontSize: 16 },
});
