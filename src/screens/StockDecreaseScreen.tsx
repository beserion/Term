import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, Stock, createGoodsIssue } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';

export function StockDecreaseScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [product, setProduct] = useState<Stock | null>(route.params?.product || null);
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  
  const { activeWarehouseId, activeWarehouseName } = useSettingsStore();
  const showToast = useUIStore((s) => s.showToast);

  const handleScan = async (scannedBarcode: string) => {
    try {
      const data = await getStockByBarcode(scannedBarcode);
      if (!data || !data.id || data.id === 0) {
        throw new Error('Ürün kaydı bulunamadı (Eksik veya boş kayıt)');
      }
      setProduct(data);
    } catch {
      showToast({ message: 'Barkod bulunamadı: ' + scannedBarcode, type: 'error' });
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
      showToast({ message: 'Geçerli bir miktar girin', type: 'error' });
      return;
    }
    
    if (product.qty !== undefined && qty > product.qty) {
      Alert.alert('Uyarı', 'Azaltılacak miktar mevcut stoktan fazla. Devam etmek istiyor musunuz?', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Devam', onPress: () => executeDecrease(qty) },
      ]);
      return;
    }
    executeDecrease(qty);
  };

  const executeDecrease = async (qty: number) => {
    try {
      await createGoodsIssue({
        documentDate: new Date().toISOString(),
        documentNo: note.trim() || 'TRM-' + Date.now(), // minLength 1
        warehouseId: activeWarehouseId!,
        lines: [
          { stockId: product!.id, issuedQty: qty }
        ]
      });
      showToast({ message: `${product!.stockName} stoğu ${qty} azaltıldı`, type: 'success' });
      if (product!.qty !== undefined) {
         setProduct({ ...product!, qty: product!.qty - qty });
      }
      setQuantity('');
      setNote('');
    } catch (err: any) {
      let errorMsg = err.message;
      if (err.response?.data) {
        errorMsg = typeof err.response.data === 'object' ? JSON.stringify(err.response.data, null, 2) : err.response.data;
      }
      console.error("=== STOCK DECREASE API ERROR ===");
      console.error(errorMsg);
      console.error("=================================");
      showToast({ message: 'Hata oluştu. Detaylar terminale yazdırıldı.', type: 'error' });
    }
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Mal Çıkış (Stok Düşümü)" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Terminal Depo Bilgisi */}
        <View style={styles.warehouseAlert}>
          <MaterialCommunityIcons name="office-building-marker" size={20} color={Colors.onErrorContainer} />
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
              <MaterialCommunityIcons name="package-variant" size={24} color={Colors.error} />
              <Text style={styles.productName}>{product.stockName}</Text>
            </View>
            <View style={styles.stockInfo}>
              <Text style={styles.stockLabel}>Kart Miktarı</Text>
              <Text style={styles.stockValue}>{product.qty || 0} {product.unit || 'Adet'}</Text>
            </View>

            {/* Miktar */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Düşülecek Miktar</Text>
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
                <TextInput
                  style={styles.quantityInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.outline}
                  textAlign="center"
                />
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
              style={styles.decreaseButton}
              onPress={handleDecrease}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="minus-circle" size={20} color={Colors.onPrimary} />
              <Text style={styles.decreaseButtonText}>Stok Düş</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  barcodeInput: {
    flex: 1, height: Spacing.touchTargetMin,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.outlineVariant, paddingHorizontal: Spacing.lg,
    ...Typography.bodyLg, color: Colors.onSurface,
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
  quantityInput: {
    flex: 1, height: Spacing.touchTargetMin,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.outlineVariant,
    ...Typography.headlineMd, color: Colors.onSurface, backgroundColor: Colors.surface,
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
