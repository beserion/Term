import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import {
  pickLocation,
  getPickingSuggestion,
  getStocks,
  getStockByBarcode,
  Stock,
  PickingSuggestionResult,
} from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { FeedbackService } from '../services/feedback';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { Numpad } from '../components/Numpad';
import { ScalePressable } from '../components/ScalePressable';
import { flexMatch } from '../utils/searchHelper';

export function PickingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const showToast = useUIStore((s) => s.showToast);
  const { activeWarehouseId } = useSettingsStore();

  const [product, setProduct] = useState<Stock | null>(route.params?.product || null);
  const [suggestion, setSuggestion] = useState<PickingSuggestionResult | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const [locationCode, setLocationCode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [orderId, setOrderId] = useState<string>(route.params?.orderId ? String(route.params.orderId) : '');
  const [submitting, setSubmitting] = useState(false);

  const [numpadVisible, setNumpadVisible] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [stocksList, setStocksList] = useState<Stock[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const locationInputRef = useRef<TextInput>(null);

  useEffect(() => {
    getStocks()
      .then((data) => setStocksList(data || []))
      .catch(() => setStocksList([]));
  }, []);

  // When product is selected, fetch smart picking suggestion
  useEffect(() => {
    if (product) {
      setLoadingSuggestion(true);
      getPickingSuggestion(product.id)
        .then((sug) => {
          setSuggestion(sug);
          if (sug.suggestedLocationCode) {
            setLocationCode(sug.suggestedLocationCode);
          }
          FeedbackService.playSuccess();
        })
        .catch((err) => {
          console.error("Akıllı toplama önerisi alınamadı:", err);
          setSuggestion(null);
        })
        .finally(() => setLoadingSuggestion(false));
    }
  }, [product]);

  const handleScanProduct = async (code: string) => {
    if (!code || !code.trim()) return;
    const clean = code.trim();
    const matched = stocksList.find((s) => s.barCode === clean || s.stockCode === clean);
    if (matched) {
      setProduct(matched);
      FeedbackService.playSuccess();
      return;
    }

    try {
      const fetched = await getStockByBarcode(clean);
      if (fetched && fetched.id) {
        setProduct(fetched);
        FeedbackService.playSuccess();
      } else {
        setSearchQuery(clean);
        setShowSearchModal(true);
      }
    } catch {
      setSearchQuery(clean);
      setShowSearchModal(true);
    }
  };

  useBarcode((scannedCode) => {
    if (!scannedCode) return;
    if (!product) {
      handleScanProduct(scannedCode);
    } else {
      // If product selected, treat barcode scan as picking location code
      setLocationCode(scannedCode.trim());
      FeedbackService.playSuccess();
      showToast({ message: `Toplama rafı okutuldu: ${scannedCode}`, type: 'info' });
    }
  });

  const handlePickSubmit = async () => {
    if (!product) {
      showToast({ message: 'Toplanacak ürünü okutun veya seçin.', type: 'error' });
      return;
    }
    if (!locationCode.trim()) {
      showToast({ message: 'Lütfen toplama yapılacağı raf adresini girin veya okutun.', type: 'error' });
      return;
    }
    const qtyNum = parseInt(quantity, 10);
    if (!qtyNum || qtyNum <= 0) {
      showToast({ message: 'Geçerli bir miktar girin.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await pickLocation({
        stockId: product.id,
        locationCode: locationCode.trim(),
        quantity: qtyNum,
        orderId: orderId ? parseInt(orderId, 10) : undefined,
        warehouseId: activeWarehouseId || undefined,
      });

      FeedbackService.playSuccess();
      showToast({ message: `${qtyNum} adet ${product.stockName} "${locationCode}" rafından başarıyla toplandı.`, type: 'success' });

      // Reset
      setProduct(null);
      setSuggestion(null);
      setLocationCode('');
      setQuantity('1');
    } catch (err: any) {
      FeedbackService.playError();
      showToast({ message: err.message || 'Sipariş toplama işlemi başarısız oldu.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Sipariş Toplama (Picking)" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ürün Seçim Alanı */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>1. Toplanacak Ürünü Seçin</Text>

          <TouchableOpacity
            style={styles.selectBox}
            onPress={() => setShowSearchModal(true)}
            activeOpacity={0.8}
          >
            <CustomIcon name="package-variant-closed" size={28} color={Colors.primary} />
            <View style={{ flex: 1, marginHorizontal: Spacing.sm }}>
              <Text style={styles.selectBoxLabel}>Ürün Bilgisi</Text>
              <Text style={styles.selectBoxTitle}>
                {product ? product.stockName : 'Barkod okutun veya dokunup seçin...'}
              </Text>
              {product && (
                <Text style={styles.selectBoxSub}>
                  Kod: {product.stockCode || '-'} {product.barCode ? `| Barkod: ${product.barCode}` : ''}
                </Text>
              )}
            </View>
            <CustomIcon name="chevron-right" size={20} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        {/* Akıllı Toplama Önerisi Kartı */}
        {product && (
          <>
            {loadingSuggestion ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: Spacing.md }} />
            ) : suggestion && suggestion.suggestedLocationCode ? (
              <View style={styles.suggestionCard}>
                <View style={styles.suggestionHeader}>
                  <CustomIcon name="flash" size={22} color="#b8860b" />
                  <Text style={styles.suggestionTitle}>Akıllı Toplama Önerisi</Text>
                </View>
                <View style={styles.suggestionBody}>
                  <View style={styles.suggestedBinBox}>
                    <Text style={styles.suggestedBinLabel}>En Uygun Raf</Text>
                    <Text style={styles.suggestedBinCode}>{suggestion.suggestedLocationCode}</Text>
                  </View>
                  <View style={styles.suggestedQtyBox}>
                    <Text style={styles.suggestedQtyLabel}>Mevcut Stok</Text>
                    <Text style={styles.suggestedQtyVal}>{suggestion.availableQuantity} Adet</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Toplama Formu */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>2. Toplama Detayları</Text>

              {/* Location Code Input */}
              <Text style={styles.inputLabel}>Toplama Yapılacak Raf Adresi</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <CustomIcon name="warehouse" size={20} color={Colors.outline} style={{ marginLeft: 10 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Raf Kodu Okutun veya Girin"
                    placeholderTextColor={Colors.outline}
                    value={locationCode}
                    onChangeText={setLocationCode}
                    autoCapitalize="characters"
                    ref={locationInputRef}
                    autoFocus={true}
                  />
                </View>
                <TouchableOpacity
                  style={styles.cameraBtn}
                  onPress={() => setShowCameraScanner(true)}
                >
                  <CustomIcon name="camera" size={20} color={Colors.onSecondaryContainer} />
                </TouchableOpacity>
              </View>

              {/* Quantity */}
              <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>Toplanacak Miktar</Text>
              <TouchableOpacity
                style={styles.qtyBox}
                onPress={() => setNumpadVisible(true)}
              >
                <Text style={styles.qtyBoxValue}>{quantity || '0'}</Text>
                <Text style={styles.qtyBoxUnit}>{product.unit || 'Adet'}</Text>
              </TouchableOpacity>

              {/* Optional Order ID */}
              <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>Sipariş No (İsteğe Bağlı)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Örn: 1002"
                placeholderTextColor={Colors.outline}
                value={orderId}
                onChangeText={setOrderId}
                keyboardType="numeric"
              />

              <ScalePressable
                style={[styles.submitBtn, (!locationCode || !quantity || submitting) && styles.submitBtnDisabled]}
                onPress={handlePickSubmit}
                disabled={!locationCode || !quantity || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <>
                    <CustomIcon name="package-down" size={22} color={Colors.onPrimary} style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Toplamayı Onayla</Text>
                  </>
                )}
              </ScalePressable>
            </View>
          </>
        )}
      </ScrollView>

      {/* Numpad */}
      <Numpad
        visible={numpadVisible}
        onClose={() => setNumpadVisible(false)}
        onType={(val) => setQuantity((prev) => prev + val)}
        onDelete={() => setQuantity((prev) => prev.slice(0, -1))}
        onSubmit={() => setNumpadVisible(false)}
        submitLabel="TAMAM"
      />

      {/* Camera Scanner */}
      <CameraScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={(code) => {
          if (!product) {
            handleScanProduct(code);
          } else {
            setLocationCode(code);
          }
        }}
      />

      {/* Search Product Modal */}
      <Modal visible={showSearchModal} animationType="slide" onRequestClose={() => setShowSearchModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitleText}>Ürün Seçin</Text>
            <TouchableOpacity onPress={() => setShowSearchModal(false)}>
              <CustomIcon name="close" size={24} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchRow}>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Ürün adı veya kodu ile ara..."
              placeholderTextColor={Colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
            />
          </View>

          <FlatList
            data={stocksList.filter((s) => flexMatch(s.stockName || '', searchQuery))}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalListItem}
                onPress={() => {
                  setShowSearchModal(false);
                  setProduct(item);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.stockName}</Text>
                  <Text style={styles.productCode}>{item.stockCode || 'KODSUZ'} {item.barCode ? `| ${item.barCode}` : ''}</Text>
                </View>
                <CustomIcon name="chevron-right" size={18} color={Colors.outline} />
              </TouchableOpacity>
            )}
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
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: Spacing.xs,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  selectBoxLabel: {
    fontSize: 11,
    color: Colors.outline,
  },
  selectBoxTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginTop: 2,
  },
  selectBoxSub: {
    fontSize: 11,
    color: Colors.outline,
    marginTop: 2,
  },
  suggestionCard: {
    backgroundColor: '#fffbeb',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#fde68a',
    ...Shadow.sm,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400e',
  },
  suggestionBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  suggestedBinBox: {
    flex: 1,
  },
  suggestedBinLabel: {
    fontSize: 11,
    color: Colors.outline,
  },
  suggestedBinCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#b8860b',
    marginTop: 2,
  },
  suggestedQtyBox: {
    alignItems: 'flex-end',
  },
  suggestedQtyLabel: {
    fontSize: 11,
    color: Colors.outline,
  },
  suggestedQtyVal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
    color: Colors.onSurface,
  },
  inputField: {
    height: 42,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Colors.onSurface,
  },
  cameraBtn: {
    width: 44,
    height: 44,
    backgroundColor: Colors.secondaryContainer,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.md,
  },
  qtyBoxValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  qtyBoxUnit: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  submitBtn: {
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    ...Shadow.sm,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.outline,
  },
  submitBtnText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  modalSearchRow: {
    padding: Spacing.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  modalSearchInput: {
    height: 40,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Colors.onSurface,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  productCode: {
    fontSize: 11,
    color: Colors.outline,
    marginTop: 2,
  },
});
