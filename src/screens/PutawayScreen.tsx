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
import { useNavigation } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import {
  putawayLocation,
  getStocks,
  getStockByBarcode,
  Stock,
} from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { FeedbackService } from '../services/feedback';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { Numpad } from '../components/Numpad';
import { ScalePressable } from '../components/ScalePressable';
import { flexMatch } from '../utils/searchHelper';

export function PutawayScreen() {
  const navigation = useNavigation<any>();
  const showToast = useUIStore((s) => s.showToast);
  const { activeWarehouseId } = useSettingsStore();

  const [product, setProduct] = useState<Stock | null>(null);
  const [locationCode, setLocationCode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const [numpadVisible, setNumpadVisible] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [stocksList, setStocksList] = useState<Stock[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const barcodeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    getStocks()
      .then((data) => setStocksList(data || []))
      .catch(() => setStocksList([]));
  }, []);

  const handleScanProduct = async (code: string) => {
    if (!code || !code.trim()) return;
    const clean = code.trim();
    const matched = stocksList.find((s) => s.barCode === clean || s.stockCode === clean);
    if (matched) {
      setProduct(matched);
      FeedbackService.playSuccess();
      showToast({ message: `Ürün seçildi: ${matched.stockName}`, type: 'success' });
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
      // If product is already selected, scan barcode is treated as target bin code
      setLocationCode(scannedCode.trim());
      FeedbackService.playSuccess();
      showToast({ message: `Hedef raf okutuldu: ${scannedCode}`, type: 'info' });
    }
  });

  const handlePutawaySubmit = async () => {
    if (!product) {
      showToast({ message: 'Lütfen raflanacak ürünü okutun veya seçin.', type: 'error' });
      return;
    }
    if (!locationCode.trim()) {
      showToast({ message: 'Lütfen hedef raf kodunu girin veya okutun.', type: 'error' });
      return;
    }
    const qtyNum = parseInt(quantity, 10);
    if (!qtyNum || qtyNum <= 0) {
      showToast({ message: 'Geçerli bir miktar girin.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await putawayLocation({
        stockId: product.id,
        locationCode: locationCode.trim(),
        quantity: qtyNum,
        warehouseId: activeWarehouseId || undefined,
      });

      FeedbackService.playSuccess();
      showToast({ message: `${product.stockName} başarıyla ${locationCode} rafına yerleştirildi.`, type: 'success' });

      // Reset
      setProduct(null);
      setLocationCode('');
      setQuantity('1');
    } catch (err: any) {
      FeedbackService.playError();
      showToast({ message: err.message || 'Raflama işlemi başarısız oldu.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Mobil Raflama (Putaway)" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ürün Seçim Alanı */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>1. Raflanacak Ürünü Seçin</Text>

          <TouchableOpacity
            style={styles.selectBox}
            onPress={() => setShowSearchModal(true)}
            activeOpacity={0.8}
          >
            <CustomIcon name="package-variant" size={28} color={Colors.primary} />
            <View style={{ flex: 1, marginHorizontal: Spacing.sm }}>
              <Text style={styles.selectBoxLabel}>Ürün Detayı</Text>
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

        {/* Target Bin & Quantity Form */}
        {product && (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>2. Yerleştirilecek Raf ve Miktar</Text>

            {/* Target Bin */}
            <Text style={styles.inputLabel}>Hedef Raf Kodu</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <CustomIcon name="warehouse" size={20} color={Colors.outline} style={{ marginLeft: 10 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Raf Kodu Okutun (örn: A-01-02)"
                  placeholderTextColor={Colors.outline}
                  value={locationCode}
                  onChangeText={setLocationCode}
                  autoCapitalize="characters"
                  ref={barcodeInputRef}
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
            <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>Yerleştirilecek Miktar</Text>
            <TouchableOpacity
              style={styles.qtyBox}
              onPress={() => setNumpadVisible(true)}
            >
              <Text style={styles.qtyBoxValue}>{quantity || '0'}</Text>
              <Text style={styles.qtyBoxUnit}>{product.unit || 'Adet'}</Text>
            </TouchableOpacity>

            <ScalePressable
              style={[styles.submitBtn, (!locationCode || !quantity || submitting) && styles.submitBtnDisabled]}
              onPress={handlePutawaySubmit}
              disabled={!locationCode || !quantity || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <>
                  <CustomIcon name="check-circle" size={22} color={Colors.onPrimary} style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Raflamayı Kaydet</Text>
                </>
              )}
            </ScalePressable>
          </View>
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
                  FeedbackService.playSuccess();
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
