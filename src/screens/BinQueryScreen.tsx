import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import {
  scanLocation,
  getStockLocations,
  getStocks,
  Stock,
  LocationScanResult,
  StockLocationDetail,
} from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { FeedbackService } from '../services/feedback';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { flexMatch } from '../utils/searchHelper';

export function BinQueryScreen() {
  const navigation = useNavigation<any>();
  const showToast = useUIStore((s) => s.showToast);

  const [activeTab, setActiveTab] = useState<'bin' | 'product'>('bin');
  
  // Tab 1: Bin Query States
  const [binCode, setBinCode] = useState('');
  const [binResult, setBinResult] = useState<LocationScanResult | null>(null);
  const [loadingBin, setLoadingBin] = useState(false);

  // Tab 2: Product Location Query States
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [productLocations, setProductLocations] = useState<StockLocationDetail[]>([]);
  const [loadingProductLocs, setLoadingProductLocs] = useState(false);

  // Common UI States
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [stocksList, setStocksList] = useState<Stock[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const binInputRef = useRef<TextInput>(null);
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    getStocks()
      .then((data) => setStocksList(data || []))
      .catch(() => setStocksList([]));
  }, []);

  const handleScanBin = async (codeToScan: string) => {
    if (!codeToScan || !codeToScan.trim()) return;
    const cleanCode = codeToScan.trim();
    setLoadingBin(true);
    try {
      const res = await scanLocation(cleanCode);
      setBinResult(res);
      FeedbackService.playSuccess();
      showToast({ message: `Raf "${res.locationCode}" sorgulandı.`, type: 'success' });
    } catch (err: any) {
      FeedbackService.playError();
      setBinResult(null);
      showToast({ message: err.message || 'Raf sorgulama başarısız oldu.', type: 'error' });
    } finally {
      setLoadingBin(false);
    }
  };

  const handleFetchProductLocations = async (stock: Stock) => {
    setSelectedStock(stock);
    setLoadingProductLocs(true);
    try {
      const locs = await getStockLocations(stock.id);
      setProductLocations(locs || []);
      FeedbackService.playSuccess();
    } catch (err: any) {
      FeedbackService.playError();
      setProductLocations([]);
      showToast({ message: err.message || 'Ürün raf konumları alınamadı.', type: 'error' });
    } finally {
      setLoadingProductLocs(false);
    }
  };

  // Barcode listener
  useBarcode((scannedCode) => {
    if (!scannedCode) return;
    if (activeTab === 'bin') {
      setBinCode(scannedCode);
      handleScanBin(scannedCode);
    } else {
      // Product barcode scan
      const matched = stocksList.find(
        (s) => s.barCode === scannedCode || s.stockCode === scannedCode
      );
      if (matched) {
        handleFetchProductLocations(matched);
      } else {
        setSearchQuery(scannedCode);
        setShowSearchModal(true);
      }
    }
  });

  const filteredStocks = stocksList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const text = [item.stockName, item.stockNameTr, item.stockCode, item.barCode].filter(Boolean).join(' ');
    return flexMatch(text, searchQuery);
  });

  return (
    <View style={styles.container}>
      <TopAppBar title="Raf Sorgulama (WMS)" onBack={() => navigation.goBack()} />

      {/* Segmented Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'bin' && styles.tabButtonActive]}
          onPress={() => setActiveTab('bin')}
          activeOpacity={0.8}
        >
          <CustomIcon name="barcode-scan" size={18} color={activeTab === 'bin' ? Colors.onPrimary : Colors.onSurfaceVariant} />
          <Text style={[styles.tabText, activeTab === 'bin' && styles.tabTextActive]}>Raf Sorgula</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'product' && styles.tabButtonActive]}
          onPress={() => setActiveTab('product')}
          activeOpacity={0.8}
        >
          <CustomIcon name="package-variant" size={18} color={activeTab === 'product' ? Colors.onPrimary : Colors.onSurfaceVariant} />
          <Text style={[styles.tabText, activeTab === 'product' && styles.tabTextActive]}>Ürün Konumları</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'bin' ? (
          <>
            {/* Bin Barcode Input Row */}
            <View style={styles.scanRow}>
              <View style={styles.inputContainer}>
                <CustomIcon name="barcode-scan" size={20} color={Colors.outline} style={{ marginLeft: 10 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Raf Kodu Okutun veya Girin (örn: A-01-02)"
                  placeholderTextColor={Colors.outline}
                  value={binCode}
                  onChangeText={setBinCode}
                  onSubmitEditing={() => handleScanBin(binCode)}
                  ref={binInputRef}
                  autoCapitalize="characters"
                  autoFocus={true}
                />
              </View>
              <TouchableOpacity
                style={[styles.actionIconBtn, { backgroundColor: Colors.secondaryContainer }]}
                onPress={() => setShowCameraScanner(true)}
                activeOpacity={0.7}
              >
                <CustomIcon name="camera" size={20} color={Colors.onSecondaryContainer} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionIconBtn}
                onPress={() => handleScanBin(binCode)}
                activeOpacity={0.7}
              >
                <CustomIcon name="magnify" size={22} color={Colors.onPrimary} />
              </TouchableOpacity>
            </View>

            {loadingBin && <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: Spacing.lg }} />}

            {/* Bin Query Result */}
            {binResult && (
              <View style={styles.resultCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.binBadge}>
                    <CustomIcon name="warehouse" size={20} color={Colors.primary} />
                    <Text style={styles.binCodeText}>{binResult.locationCode}</Text>
                  </View>
                  {binResult.warehouseName ? (
                    <Text style={styles.warehouseNameText}>{binResult.warehouseName}</Text>
                  ) : null}
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionHeaderTitle}>Raftaki Stoklar ({binResult.items?.length || 0})</Text>

                {(!binResult.items || binResult.items.length === 0) ? (
                  <View style={styles.emptyBox}>
                    <CustomIcon name="alert-circle-outline" size={28} color={Colors.outline} />
                    <Text style={styles.emptyText}>Bu rafta tanımlı ürün bulunmuyor (Boş Raf).</Text>
                  </View>
                ) : (
                  binResult.items.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemStockName}>{item.stockName || 'Stok Adı Yok'}</Text>
                        <Text style={styles.itemSubText}>
                          Kod: {item.stockCode || '-'} {item.barCode ? `| Barkod: ${item.barCode}` : ''}
                        </Text>
                      </View>
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <Text style={styles.unitText}>{item.unit || 'Adet'}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Product Select Card */}
            <TouchableOpacity
              style={styles.selectProductCard}
              onPress={() => setShowSearchModal(true)}
              activeOpacity={0.7}
            >
              <CustomIcon name="package-variant" size={26} color={Colors.primary} />
              <View style={{ flex: 1, marginHorizontal: Spacing.sm }}>
                <Text style={styles.selectProductLabel}>Sorgulanacak Ürün</Text>
                <Text style={styles.selectProductName}>
                  {selectedStock ? selectedStock.stockName : 'Ürün okutun veya dokunup listeden seçin...'}
                </Text>
              </View>
              <CustomIcon name="chevron-right" size={20} color={Colors.outline} />
            </TouchableOpacity>

            {loadingProductLocs && (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: Spacing.lg }} />
            )}

            {selectedStock && !loadingProductLocs && (
              <View style={styles.resultCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.stockTitle}>{selectedStock.stockName}</Text>
                  <Text style={styles.stockSubTitle}>Stok Kodu: {selectedStock.stockCode || '-'}</Text>
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionHeaderTitle}>Bulunduğu Raflar ({productLocations.length})</Text>

                {productLocations.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <CustomIcon name="alert-circle-outline" size={28} color={Colors.outline} />
                    <Text style={styles.emptyText}>Bu ürün herhangi bir raf adresinde kayıtlı değil.</Text>
                  </View>
                ) : (
                  productLocations.map((loc, idx) => (
                    <View key={idx} style={styles.locRow}>
                      <View style={styles.locLeft}>
                        <CustomIcon name="warehouse" size={20} color={Colors.primary} />
                        <View style={{ marginLeft: 8 }}>
                          <Text style={styles.locCode}>{loc.locationCode}</Text>
                          {loc.warehouseName ? <Text style={styles.locWarehouse}>{loc.warehouseName}</Text> : null}
                        </View>
                      </View>
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyText}>{loc.quantity}</Text>
                        <Text style={styles.unitText}>Adet</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Camera Scanner */}
      <CameraScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={(code) => {
          setBinCode(code);
          handleScanBin(code);
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
              ref={searchInputRef}
              autoFocus={true}
            />
          </View>

          <FlatList
            data={filteredStocks}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.modalListContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalListItem}
                onPress={() => {
                  setShowSearchModal(false);
                  handleFetchProductLocations(item);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalItemName}>{item.stockName}</Text>
                  <Text style={styles.modalItemCode}>{item.stockCode || 'KODSUZ'} {item.barCode ? `| ${item.barCode}` : ''}</Text>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 6,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadow.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.xs,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    ...Typography.labelLg,
    color: Colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  scanRow: {
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
  actionIconBtn: {
    width: 44,
    height: 44,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  binBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  binCodeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  warehouseNameText: {
    fontSize: 12,
    color: Colors.outline,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.outlineVariant,
    marginVertical: Spacing.md,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.sm,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.outline,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  itemStockName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  itemSubText: {
    fontSize: 11,
    color: Colors.outline,
    marginTop: 2,
  },
  qtyBadge: {
    alignItems: 'flex-end',
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.onSecondaryContainer,
  },
  unitText: {
    fontSize: 10,
    color: Colors.onSecondaryContainer,
  },
  selectProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.sm,
  },
  selectProductLabel: {
    fontSize: 11,
    color: Colors.outline,
  },
  selectProductName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginTop: 2,
  },
  stockTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  stockSubTitle: {
    fontSize: 12,
    color: Colors.outline,
    marginTop: 2,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  locLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locCode: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  locWarehouse: {
    fontSize: 11,
    color: Colors.outline,
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
  modalListContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
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
  modalItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  modalItemCode: {
    fontSize: 12,
    color: Colors.outline,
    marginTop: 2,
  },
});
