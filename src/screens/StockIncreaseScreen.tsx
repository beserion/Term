import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, Stock, createGoodsReceipt } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { Numpad } from '../components/Numpad';
import { FeedbackService } from '../services/feedback';

export function StockIncreaseScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [product, setProduct] = useState<Stock | null>(route.params?.product || null);
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [numpadVisible, setNumpadVisible] = useState(false);
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

  const handleIncrease = async () => {
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
    
    try {
      await createGoodsReceipt({
        documentDate: new Date().toISOString(),
        documentNo: note.trim() || 'TRM-' + Date.now(), // minLength 1 zorunluluğu var
        warehouseId: activeWarehouseId,
        lines: [
          { stockId: product.id, receivedQty: qty }
        ]
      });
      FeedbackService.playSuccess();
      showToast({ message: `${product.stockName} stoğu ${qty} artırıldı`, type: 'success' });
      
      // Formu sıfırlayıp yeni ürüne geçişe hazırla
      setProduct(null);
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
      
      console.error("=== STOCK INCREASE API ERROR ===");
      console.error(errorMsg);
      console.error("=================================");
      FeedbackService.playError();
      showErrorLock(`API HATASI:\n\n${errorMsg}`);
    }
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Mal Kabul (Stok Arttırımı)" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Terminal Depo Bilgisi */}
        <View style={styles.warehouseAlert}>
          <MaterialCommunityIcons name="office-building-marker" size={20} color={Colors.onPrimaryContainer} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warehouseAlertLabel}>Aktif Terminal Deposu</Text>
            <Text style={styles.warehouseAlertName}>
              {activeWarehouseId ? activeWarehouseName : 'DEPO SEÇİLMEMİŞ! Ayarlardan seçin.'}
            </Text>
          </View>
          {!activeWarehouseId && (
            <TouchableOpacity onPress={() => navigation.navigate('SettingsTab')}>
              <MaterialCommunityIcons name="cog" size={24} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>

        {/* Barkod giriş */}
        <View style={styles.scanRow}>
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
            showSoftInputOnFocus={false}
          />
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
          >
            <MaterialCommunityIcons name="barcode-scan" size={24} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Ürün Bilgisi */}
        {product && (
          <View style={styles.productCard}>
            <View style={styles.productHeader}>
              <MaterialCommunityIcons name="package-variant" size={24} color={Colors.primary} />
              <Text style={styles.productName}>{product.stockName}</Text>
            </View>
            <View style={styles.stockInfo}>
              <Text style={styles.stockLabel}>Kart Miktarı</Text>
              <Text style={styles.stockValue}>{product.qty || 0} {product.unit || 'Adet'}</Text>
            </View>

            {/* Miktar */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Eklenecek Miktar</Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() => {
                    const q = Math.max(0, (parseInt(quantity) || 0) - 1);
                    setQuantity(q > 0 ? String(q) : '');
                  }}
                >
                  <MaterialCommunityIcons name="minus" size={24} color={Colors.error} />
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
                  <MaterialCommunityIcons name="plus" size={24} color={Colors.primary} />
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
              style={styles.increaseButton}
              onPress={handleIncrease}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus-circle" size={20} color={Colors.onPrimary} />
              <Text style={styles.increaseButtonText}>Stok Artır</Text>
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
          onSubmit={handleIncrease}
          submitLabel="STOK ARTIR"
          submitColor={Colors.primary}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.marginMobile, gap: Spacing.lg, paddingBottom: 40 },
  warehouseAlert: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer, padding: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.surfaceContainerHigh,
  },
  warehouseAlertLabel: { ...Typography.labelSm, color: Colors.onPrimaryContainer },
  warehouseAlertName: { ...Typography.titleMd, color: Colors.onPrimaryContainer, fontWeight: 'bold' },
  scanRow: { flexDirection: 'row', gap: Spacing.sm },
  barcodeInput: {
    flex: 1, height: Spacing.touchTargetMin,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.outlineVariant, paddingHorizontal: Spacing.lg,
    ...Typography.bodyLg, color: Colors.onSurface,
  },
  scanButton: {
    width: Spacing.touchTargetMin, height: Spacing.touchTargetMin,
    borderRadius: BorderRadius.md, backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  productCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md, padding: Spacing.cardPadding,
    borderWidth: 1, borderColor: Colors.surfaceContainer, ...Shadow.card,
  },
  productHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  productName: { ...Typography.headlineSm, color: Colors.onSurface, flex: 1 },
  stockInfo: {
    backgroundColor: Colors.secondaryContainer, borderRadius: BorderRadius.sm,
    padding: Spacing.md, marginBottom: Spacing.lg,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  stockLabel: { ...Typography.labelMd, color: Colors.onSecondaryContainer },
  stockValue: { ...Typography.headlineMd, color: Colors.primary, fontWeight: '700' },
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
    ...Typography.headlineMd, color: Colors.onSurface,
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
  increaseButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.primaryContainer, borderRadius: BorderRadius.sm,
    minHeight: Spacing.touchTargetMin,
  },
  increaseButtonText: { ...Typography.labelLg, color: Colors.onPrimary, fontSize: 16 },
});
