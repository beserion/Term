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
  scanLocation,
  transferLocation,
  getStocks,
  Stock,
  LocationStockItem,
} from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { FeedbackService } from '../services/feedback';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { Numpad } from '../components/Numpad';
import { ScalePressable } from '../components/ScalePressable';
import { flexMatch } from '../utils/searchHelper';

export function BinTransferScreen() {
  const navigation = useNavigation<any>();
  const showToast = useUIStore((s) => s.showToast);
  const { activeWarehouseId } = useSettingsStore();

  // Wizard Step: 1 = Source Bin, 2 = Product & Qty, 3 = Target Bin
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Source Bin
  const [fromLocationCode, setFromLocationCode] = useState('');
  const [sourceItems, setSourceItems] = useState<LocationStockItem[]>([]);
  const [loadingSource, setLoadingSource] = useState(false);

  // Step 2: Product & Quantity
  const [selectedItem, setSelectedItem] = useState<LocationStockItem | Stock | null>(null);
  const [quantity, setQuantity] = useState('');
  const [numpadVisible, setNumpadVisible] = useState(false);

  // Step 3: Target Bin
  const [toLocationCode, setToLocationCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Camera & Search Modal
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'from' | 'to'>('from');
  const [stocksList, setStocksList] = useState<Stock[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    getStocks()
      .then((data) => setStocksList(data || []))
      .catch(() => setStocksList([]));
  }, []);

  const handleScanSourceBin = async (code: string) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim();
    setLoadingSource(true);
    try {
      const res = await scanLocation(cleanCode);
      setFromLocationCode(res.locationCode || cleanCode);
      setSourceItems(res.items || []);
      setStep(2);
      FeedbackService.playSuccess();
      showToast({ message: `Kaynak raf "${res.locationCode}" belirlendi.`, type: 'success' });
    } catch (err: any) {
      FeedbackService.playError();
      showToast({ message: err.message || 'Kaynak raf sorgulanamadı.', type: 'error' });
    } finally {
      setLoadingSource(false);
    }
  };

  const handleSelectProduct = (item: LocationStockItem | Stock) => {
    setSelectedItem(item);
    setQuantity(String(item.quantity || '1'));
    setStep(3);
    FeedbackService.playSuccess();
  };

  const handleScanTargetBin = (code: string) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim();
    if (cleanCode === fromLocationCode) {
      FeedbackService.playError();
      showToast({ message: 'Hedef raf, kaynak raf ile aynı olamaz!', type: 'error' });
      return;
    }
    setToLocationCode(cleanCode);
    FeedbackService.playSuccess();
  };

  useBarcode((scannedCode) => {
    if (!scannedCode) return;
    if (step === 1) {
      setFromLocationCode(scannedCode);
      handleScanSourceBin(scannedCode);
    } else if (step === 2) {
      // Find matching item in source items or global stock
      const matchedSource = sourceItems.find(
        (i) => i.barCode === scannedCode || i.stockCode === scannedCode
      );
      if (matchedSource) {
        handleSelectProduct(matchedSource);
      } else {
        const matchedGlobal = stocksList.find(
          (s) => s.barCode === scannedCode || s.stockCode === scannedCode
        );
        if (matchedGlobal) {
          handleSelectProduct(matchedGlobal);
        } else {
          showToast({ message: 'Okutulan ürün kaynak rafta bulunamadı.', type: 'error' });
          FeedbackService.playError();
        }
      }
    } else if (step === 3) {
      handleScanTargetBin(scannedCode);
    }
  });

  const handleExecuteTransfer = async () => {
    if (!selectedItem) {
      showToast({ message: 'Lütfen ürün seçin.', type: 'error' });
      return;
    }
    if (!fromLocationCode || !toLocationCode) {
      showToast({ message: 'Lütfen kaynak ve hedef raf adreslerini belirleyin.', type: 'error' });
      return;
    }
    const qtyNum = parseInt(quantity, 10);
    if (!qtyNum || qtyNum <= 0) {
      showToast({ message: 'Geçerli bir transfer miktarı girin.', type: 'error' });
      return;
    }

    const stockId = 'stockId' in selectedItem ? selectedItem.stockId : selectedItem.id;

    setSubmitting(true);
    try {
      await transferLocation({
        stockId,
        fromLocationCode,
        toLocationCode,
        quantity: qtyNum,
        warehouseId: activeWarehouseId || undefined,
      });

      FeedbackService.playSuccess();
      showToast({ message: `Raf transferi başarıyla tamamlandı (${fromLocationCode} ➔ ${toLocationCode}).`, type: 'success' });
      
      // Reset form
      setStep(1);
      setFromLocationCode('');
      setToLocationCode('');
      setSelectedItem(null);
      setQuantity('');
      setSourceItems([]);
    } catch (err: any) {
      FeedbackService.playError();
      showToast({ message: err.message || 'Raf transferi gerçekleştirilemedi.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Raf-Raf Transferi" onBack={() => navigation.goBack()} />

      {/* Step Indicator Header */}
      <View style={styles.stepHeader}>
        <TouchableOpacity
          style={[styles.stepItem, step === 1 && styles.stepItemActive]}
          onPress={() => setStep(1)}
        >
          <Text style={[styles.stepNumber, step === 1 && styles.stepNumberActive]}>1</Text>
          <Text style={[styles.stepLabel, step === 1 && styles.stepLabelActive]}>Kaynak Raf</Text>
        </TouchableOpacity>

        <View style={styles.stepDivider} />

        <TouchableOpacity
          style={[styles.stepItem, step === 2 && styles.stepItemActive]}
          onPress={() => { if (fromLocationCode) setStep(2); }}
        >
          <Text style={[styles.stepNumber, step === 2 && styles.stepNumberActive]}>2</Text>
          <Text style={[styles.stepLabel, step === 2 && styles.stepLabelActive]}>Ürün & Miktar</Text>
        </TouchableOpacity>

        <View style={styles.stepDivider} />

        <TouchableOpacity
          style={[styles.stepItem, step === 3 && styles.stepItemActive]}
          onPress={() => { if (selectedItem) setStep(3); }}
        >
          <Text style={[styles.stepNumber, step === 3 && styles.stepNumberActive]}>3</Text>
          <Text style={[styles.stepLabel, step === 3 && styles.stepLabelActive]}>Hedef Raf</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* STEP 1: Kaynak Raf */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>1. Kaynak Raf Adresini Okutun</Text>

            <View style={styles.scanRow}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Kaynak Raf (örn: A-01-02)"
                  placeholderTextColor={Colors.outline}
                  value={fromLocationCode}
                  onChangeText={setFromLocationCode}
                  onSubmitEditing={() => handleScanSourceBin(fromLocationCode)}
                  autoCapitalize="characters"
                  ref={inputRef}
                  autoFocus={true}
                />
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.secondaryContainer }]}
                onPress={() => {
                  setCameraTarget('from');
                  setShowCameraScanner(true);
                }}
              >
                <CustomIcon name="camera" size={20} color={Colors.onSecondaryContainer} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleScanSourceBin(fromLocationCode)}
              >
                <CustomIcon name="chevron-right" size={24} color={Colors.onPrimary} />
              </TouchableOpacity>
            </View>

            {loadingSource && <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />}
          </View>
        )}

        {/* STEP 2: Ürün ve Miktar */}
        {step === 2 && (
          <View style={styles.card}>
            <View style={styles.summaryBadge}>
              <CustomIcon name="warehouse" size={18} color={Colors.primary} />
              <Text style={styles.summaryText}>Kaynak Raf: <Text style={{ fontWeight: 'bold' }}>{fromLocationCode}</Text></Text>
            </View>

            <Text style={styles.cardTitle}>2. Transfer Edilecek Ürünü Seçin</Text>

            {sourceItems.length > 0 ? (
              sourceItems.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.productOption,
                    ('stockId' in item ? item.stockId : (item as any).id) ===
                      (selectedItem ? ('stockId' in selectedItem ? selectedItem.stockId : selectedItem.id) : null) &&
                      styles.productOptionSelected,
                  ]}
                  onPress={() => handleSelectProduct(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{item.stockName}</Text>
                    <Text style={styles.productCode}>Kod: {item.stockCode || '-'} | Barkod: {item.barCode || '-'}</Text>
                  </View>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyNum}>{item.quantity}</Text>
                    <Text style={styles.qtyUnit}>{item.unit || 'Adet'}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Kaynak rafta tanımlı ürün yok. Arama ekranından ürün seçebilirsiniz.</Text>
                <TouchableOpacity
                  style={styles.searchBtn}
                  onPress={() => setShowSearchModal(true)}
                >
                  <CustomIcon name="magnify" size={18} color={Colors.onPrimary} />
                  <Text style={styles.searchBtnText}>Tüm Stoklarda Ara</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* STEP 3: Hedef Raf ve Onay */}
        {step === 3 && (
          <View style={styles.card}>
            <View style={styles.routeSummary}>
              <View style={styles.routeNode}>
                <Text style={styles.routeNodeLabel}>Kaynak</Text>
                <Text style={styles.routeNodeValue}>{fromLocationCode}</Text>
              </View>
              <CustomIcon name="swap-horizontal" size={24} color={Colors.primary} />
              <View style={styles.routeNode}>
                <Text style={styles.routeNodeLabel}>Hedef</Text>
                <Text style={[styles.routeNodeValue, !toLocationCode && { color: Colors.outline }]}>
                  {toLocationCode || 'Okutulmadı'}
                </Text>
              </View>
            </View>

            {selectedItem && (
              <View style={styles.selectedItemBox}>
                <Text style={styles.selectedItemTitle}>{'stockName' in selectedItem ? selectedItem.stockName : ''}</Text>
                <View style={styles.qtyRow}>
                  <Text style={styles.qtyRowLabel}>Transfer Miktarı:</Text>
                  <TouchableOpacity
                    style={styles.qtyInputBox}
                    onPress={() => setNumpadVisible(true)}
                  >
                    <Text style={styles.qtyInputVal}>{quantity || '0'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={styles.cardTitle}>3. Hedef Raf Adresini Okutun</Text>

            <View style={styles.scanRow}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Hedef Raf (örn: B-03-01)"
                  placeholderTextColor={Colors.outline}
                  value={toLocationCode}
                  onChangeText={setToLocationCode}
                  onSubmitEditing={() => handleScanTargetBin(toLocationCode)}
                  autoCapitalize="characters"
                  autoFocus={true}
                />
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.secondaryContainer }]}
                onPress={() => {
                  setCameraTarget('to');
                  setShowCameraScanner(true);
                }}
              >
                <CustomIcon name="camera" size={20} color={Colors.onSecondaryContainer} />
              </TouchableOpacity>
            </View>

            <ScalePressable
              style={[
                styles.submitBtn,
                (!toLocationCode || !quantity || submitting) && styles.submitBtnDisabled,
              ]}
              onPress={handleExecuteTransfer}
              disabled={!toLocationCode || !quantity || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <>
                  <CustomIcon name="truck-fast" size={22} color={Colors.onPrimary} style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Transferi Onayla</Text>
                </>
              )}
            </ScalePressable>
          </View>
        )}
      </ScrollView>

      {/* Numpad Modal */}
      <Numpad
        visible={numpadVisible}
        onClose={() => setNumpadVisible(false)}
        onType={(val) => setQuantity((prev) => prev + val)}
        onDelete={() => setQuantity((prev) => prev.slice(0, -1))}
        onSubmit={() => setNumpadVisible(false)}
        submitLabel="TAMAM"
      />

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={(code) => {
          if (cameraTarget === 'from') {
            setFromLocationCode(code);
            handleScanSourceBin(code);
          } else {
            handleScanTargetBin(code);
          }
        }}
      />

      {/* Search Modal */}
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
                  handleSelectProduct(item);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.stockName}</Text>
                  <Text style={styles.productCode}>{item.stockCode || 'KODSUZ'}</Text>
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
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.5,
  },
  stepItemActive: {
    opacity: 1,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.outline,
    color: Colors.surface,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepNumberActive: {
    backgroundColor: Colors.primary,
    color: Colors.onPrimary,
  },
  stepLabel: {
    fontSize: 13,
    color: Colors.onSurface,
  },
  stepLabelActive: {
    fontWeight: 'bold',
    color: Colors.primary,
  },
  stepDivider: {
    width: 20,
    height: 1,
    backgroundColor: Colors.outlineVariant,
  },
  content: {
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.card,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  scanRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  input: {
    fontSize: 14,
    color: Colors.onSurface,
  },
  actionBtn: {
    width: 44,
    height: 44,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.secondaryContainer,
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  summaryText: {
    fontSize: 13,
    color: Colors.onSecondaryContainer,
  },
  productOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  productOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(30, 58, 138, 0.05)',
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
  qtyBadge: {
    alignItems: 'flex-end',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  qtyNum: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onPrimary,
  },
  qtyUnit: {
    fontSize: 9,
    color: Colors.onPrimary,
  },
  emptyBox: {
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.outline,
    textAlign: 'center',
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  searchBtnText: {
    color: Colors.onPrimary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  routeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  routeNode: {
    alignItems: 'center',
  },
  routeNodeLabel: {
    fontSize: 11,
    color: Colors.outline,
  },
  routeNodeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  selectedItemBox: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  selectedItemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  qtyRowLabel: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  qtyInputBox: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  qtyInputVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
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
});
