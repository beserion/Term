import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { addStock, updateStock, printLabel, getStocks, Stock } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { FeedbackService } from '../services/feedback';
import { useSettingsStore } from '../store/settingsStore';
import { sendCpclToPrinter } from '../services/printHelper';

export function StockAddEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const { activePrinterId } = useSettingsStore();

  const existingProduct = route.params?.product as Stock | undefined;
  const initialBarcode = route.params?.barcode || '';
  const isEditMode = !!existingProduct;

  const [barcode, setBarcode] = useState(existingProduct?.barCode || initialBarcode);
  const [stockCode, setStockCode] = useState(existingProduct?.stockCode || '');
  const [stockName, setStockName] = useState(existingProduct?.stockName || '');
  const [stockNameTr, setStockNameTr] = useState(existingProduct?.stockNameTr || '');
  const [brand, setBrand] = useState(existingProduct?.brand || '');
  const [model, setModel] = useState(existingProduct?.model || '');
  const [unit, setUnit] = useState(existingProduct?.unit || 'PCS');
  const [shelfAddress, setShelfAddress] = useState(existingProduct?.shelfAddress || '');
  const [qty, setQty] = useState(existingProduct?.qty !== undefined ? String(existingProduct.qty) : '0');
  const [impaCode, setImpaCode] = useState(existingProduct?.impaCode || '');

  const [saving, setSaving] = useState(false);

  // Zebra DataWedge okuyucu entegrasyonu
  useBarcode((scannedBarcode) => {
    setBarcode(scannedBarcode.trim());
    FeedbackService.playLightImpact();
    showToast({ message: 'Barkod okundu: ' + scannedBarcode, type: 'success' });
  }, true);

  const handleSave = async () => {
    if (!stockName.trim()) {
      showToast({ message: 'Lütfen stok adını girin.', type: 'error' });
      return;
    }
    let finalBarcode = barcode.trim();
    if (!finalBarcode) {
      try {
        // 1. Mevcut tüm stokları çekip barkod listesini çıkaralım
        const allStocks = await getStocks();
        const existingBarcodes = new Set(
          allStocks.map(s => s.barCode?.trim()).filter(Boolean)
        );

        // 2. Benzersiz olan barkodu bulana kadar döngü çalıştır
        let generated = '';
        let attempts = 0;
        do {
          const timestamp = (Date.now() + attempts).toString();
          generated = '20' + timestamp.slice(-11);
          attempts++;
        } while (existingBarcodes.has(generated) && attempts < 100);

        finalBarcode = generated;
      } catch (err) {
        // Fallback: API veya bağlantı hatasında direkt zaman damgası ata
        finalBarcode = '20' + Date.now().toString().slice(-11);
      }

      setBarcode(finalBarcode);
      showToast({ message: 'Barkodsuz ürün için benzersiz barkod üretildi: ' + finalBarcode, type: 'info' });
    }

    let finalStockCode = stockCode.trim();
    if (!finalStockCode) {
      finalStockCode = 'STK-' + finalBarcode;
    }

    setSaving(true);
    try {
      const payload: any = {
        id: isEditMode ? existingProduct.id : 0,
        companyId: existingProduct?.companyId || route.params?.companyId || null,
        barCode: finalBarcode,
        stockCode: finalStockCode,
        stockName: stockName.trim(),
        stockNameTr: stockNameTr.trim() || null,
        brand: brand.trim() || null,
        model: model.trim() || null,
        unit: unit.trim() || 'PCS',
        qty: parseFloat(qty) || 0,
        shelfAddress: shelfAddress.trim() || null,
        impaCode: impaCode.trim() || null,
      };

      let result;
      if (isEditMode) {
        result = await updateStock(payload);
        FeedbackService.playSuccess();
        showToast({ message: 'Stok kartı başarıyla güncellendi.', type: 'success' });
      } else {
        result = await addStock(payload);
        FeedbackService.playSuccess();
        showToast({ message: 'Stok kartı başarıyla eklendi.', type: 'success' });
      }

      // Aktif yazıcı varsa etiket yazdırmak isteyip istemediğini sor
      if (activePrinterId) {
        const codeToPrint = payload.barCode || payload.stockCode || String(result?.id || existingProduct?.id || '0');
        Alert.alert(
          'Etiket Yazdır',
          'Ürün kaydedildi. Barkod etiketi yazdırmak ister misiniz?',
          [
            {
              text: 'Hayır',
              onPress: () => navigation.goBack(),
              style: 'cancel',
            },
            {
              text: 'Yazdır',
              onPress: async () => {
                try {
                  const printResult = await printLabel({
                    printerId: activePrinterId,
                    barcode: codeToPrint,
                    qrCode: codeToPrint,
                    quantity: 1,
                  });
                  if (printResult.cpclData && printResult.printerIp) {
                    await sendCpclToPrinter(
                      printResult.printerIp,
                      printResult.printerPort || 6101,
                      printResult.cpclData
                    );
                    showToast({ message: 'Etiket yazıcıya gönderildi.', type: 'success' });
                  }
                } catch (printErr: any) {
                  showToast({ message: 'Etiket yazdırma hatası: ' + printErr.message, type: 'error' });
                } finally {
                  navigation.goBack();
                }
              },
            },
          ],
          { cancelable: false }
        );
      } else {
        navigation.goBack();
      }
    } catch (err: any) {
      console.error(err);
      FeedbackService.playError();
      showToast({ message: 'Kaydetme başarısız: ' + (err.message || 'Bilinmeyen hata'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopAppBar
        title={isEditMode ? 'Stok Kartı Düzenle' : 'Yeni Stok Kartı Ekle'}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {saving && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Kaydediliyor...</Text>
            </View>
          )}

          <View style={styles.card}>
            {/* Barkod */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>BARKOD (OPSİYONEL)</Text>
              <View style={styles.barcodeInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Barkod okutun veya girin..."
                  placeholderTextColor={Colors.outline}
                  value={barcode}
                  onChangeText={setBarcode}
                />
                <View style={styles.barcodeIcon}>
                  <CustomIcon name="barcode-scan" size={20} color={Colors.outline} />
                </View>
              </View>
              <Text style={styles.infoText}>Barkodu fiziksel okuyucuyla okutarak da doldurabilirsiniz. Barkodsuz ürünler için boş bırakabilirsiniz.</Text>
            </View>

            {/* Stok Kodu */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>STOK KODU (OPSİYONEL)</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: STK-001"
                placeholderTextColor={Colors.outline}
                value={stockCode}
                onChangeText={setStockCode}
                autoCapitalize="characters"
              />
            </View>

            {/* Stok Adı (EN/Genel) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>STOK ADI *</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: Anchor Chain 10mm"
                placeholderTextColor={Colors.outline}
                value={stockName}
                onChangeText={setStockName}
              />
            </View>

            {/* Stok Adı (TR) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>STOK ADI (TR)</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: Çapa Zinciri 10mm"
                placeholderTextColor={Colors.outline}
                value={stockNameTr}
                onChangeText={setStockNameTr}
              />
            </View>

            {/* Marka & Model */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>MARKA</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: Bosch"
                  placeholderTextColor={Colors.outline}
                  value={brand}
                  onChangeText={setBrand}
                />
              </View>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>MODEL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: GWS 9-115"
                  placeholderTextColor={Colors.outline}
                  value={model}
                  onChangeText={setModel}
                />
              </View>
            </View>

            {/* Birim & Miktar */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>BİRİM</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: PCS, MTR, SET"
                  placeholderTextColor={Colors.outline}
                  value={unit}
                  onChangeText={setUnit}
                  autoCapitalize="characters"
                />
              </View>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>MİKTAR</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={Colors.outline}
                  keyboardType="numeric"
                  value={qty}
                  onChangeText={setQty}
                />
              </View>
            </View>

            {/* Raf Konumu & IMPA Kodu */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>RAF KONUMU</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: A-01-C"
                  placeholderTextColor={Colors.outline}
                  value={shelfAddress}
                  onChangeText={setShelfAddress}
                  autoCapitalize="characters"
                />
              </View>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>IMPA KODU</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: 752401"
                  placeholderTextColor={Colors.outline}
                  value={impaCode}
                  onChangeText={setImpaCode}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Kaydet Butonu */}
            <TouchableOpacity
              style={styles.saveButton}
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={saving}
            >
              <CustomIcon name="content-save" size={20} color={Colors.onPrimary} />
              <Text style={styles.saveButtonText}>Kartı Kaydet</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 12,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    gap: 12,
    ...Shadow.card,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  input: {
    height: 40,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.onSurface,
  },
  barcodeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barcodeIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 10,
    color: Colors.outline,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.xs,
    height: 44,
    marginTop: 8,
  },
  saveButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
});
