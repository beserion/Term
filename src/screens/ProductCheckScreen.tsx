import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Animated, Image, Modal, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, getStocks, Stock } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { FeedbackService } from '../services/feedback';
import { Config } from '../config';
import { flexMatch, normalizeText } from '../utils/searchHelper';
import { CameraScannerModal } from '../components/CameraScannerModal';

export function ProductCheckScreen() {
  const navigation = useNavigation<any>();
  const [product, setProduct] = useState<Stock | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [scanning, setScanning] = useState(true);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const showToast = useUIStore((s) => s.showToast);
  const [baseUrl, setBaseUrl] = useState('');
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = React.useRef<TextInput>(null);

  useEffect(() => {
    Config.getApiBaseUrl().then((url) => {
      const origin = url.replace(/\/api$/, '');
      setBaseUrl(origin);
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

  const resolveImageUri = (uri?: string) => {
    if (!uri) return undefined;
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:')) {
      return uri;
    }
    const path = uri.startsWith('/') ? uri : `/${uri}`;
    return `${baseUrl}${path}`;
  };

  const handleScan = async (scannedBarcode: string) => {
    if (!scannedBarcode || scannedBarcode.trim() === '') return;

    setNotFoundBarcode(null);

    // 1. Önce lokal stocks listesinden barkod veya kod tam eşleşmesi arayalım (normalize edilmiş olarak)
    const normalizedScanned = normalizeText(scannedBarcode);
    const matchedLocal = stocks.find(
      s => (s.barCode && normalizeText(s.barCode) === normalizedScanned) || 
           (s.stockCode && normalizeText(s.stockCode) === normalizedScanned)
    );

    if (matchedLocal) {
      setProduct(matchedLocal);
      setNotFoundBarcode(null);
      FeedbackService.playLightImpact();
      return;
    }

    try {
      const data = await getStockByBarcode(scannedBarcode);
      if (data && data.id && data.id !== 0) {
        setProduct(data);
        setNotFoundBarcode(null);
        FeedbackService.playLightImpact();
      } else {
        setProduct(null);
        setNotFoundBarcode(scannedBarcode);
        setSearchQuery(scannedBarcode);
        setShowSearchModal(true);
        showToast({ message: 'Barkod bulunamadı. Eşleştirmek için arayın.', type: 'info' });
        FeedbackService.playError();
      }
    } catch {
      setProduct(null);
      setNotFoundBarcode(scannedBarcode);
      setSearchQuery(scannedBarcode);
      setShowSearchModal(true);
      showToast({ message: 'Barkod bulunamadı. Listeden seçebilirsiniz.', type: 'error' });
      FeedbackService.playError();
    }
  };

  // Zebra DataWedge dinle
  useBarcode(handleScan, scanning);

  const handleManualSearch = () => {
    const term = manualBarcode.trim();
    if (term.length >= 1) {
      const isNumeric = /^\d+$/.test(term);
      if (isNumeric) {
        handleScan(term);
        setManualBarcode('');
      } else {
        setSearchQuery(term);
        setShowSearchModal(true);
        setManualBarcode('');
      }
    }
  };

  useEffect(() => {
    const term = manualBarcode.trim();
    if (term.length >= 4) {
      const isNumeric = /^\d+$/.test(term);
      if (isNumeric) {
        const timeout = setTimeout(() => {
          handleManualSearch();
        }, 500);
        return () => clearTimeout(timeout);
      } else {
        setSearchQuery(term);
        setShowSearchModal(true);
        setManualBarcode('');
      }
    }
  }, [manualBarcode]);

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
    setNotFoundBarcode(null);
    setShowSearchModal(false);
    FeedbackService.playSuccess();
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Ürün Kontrol" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>


        {/* Manuel Giriş */}
        <View style={styles.manualInputRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="Manuel barkod girin..."
            placeholderTextColor={Colors.outline}
            value={manualBarcode}
            onChangeText={setManualBarcode}
            onSubmitEditing={handleManualSearch}
            returnKeyType="search"
            keyboardType="default"
            autoFocus={true}
            showSoftInputOnFocus={true}
          />
          <TouchableOpacity
            style={[styles.searchButton, { backgroundColor: Colors.secondaryContainer, marginRight: 4 }]}
            onPress={() => setShowCameraScanner(true)}
            activeOpacity={0.7}
          >
            <CustomIcon name="camera" size={20} color={Colors.onSecondaryContainer} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchButton} onPress={handleManualSearch} activeOpacity={0.7}>
            <CustomIcon name="magnify" size={24} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Sonuç Kartı */}
        {product && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              {/* Ürün Görseli */}
              <View style={styles.imageContainer}>
                {product.photo || product.imageUrl ? (
                  <Image
                    source={{ uri: resolveImageUri(product.photo || product.imageUrl) }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <CustomIcon name="package-variant" size={28} color={Colors.outline} />
                  </View>
                )}
              </View>

              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={styles.productName}>{product.stockName}</Text>
                {product.stockNameTr ? (
                  <Text style={styles.productNameTr}>{product.stockNameTr}</Text>
                ) : null}
              </View>
            </View>

            {/* Veri Grid */}
            <View style={styles.dataGrid}>
              <View style={styles.dataCell}>
                <Text style={styles.dataCellLabel}>STOK KODU</Text>
                <Text style={styles.dataCellValue}>{product.stockCode || '-'}</Text>
              </View>
              <View style={styles.dataCell}>
                <Text style={styles.dataCellLabel}>KONUM</Text>
                <Text style={styles.dataCellValue}>{product.shelfAddress || '-'}</Text>
              </View>
              {product.brand ? (
                <View style={styles.dataCell}>
                  <Text style={styles.dataCellLabel}>MARKA</Text>
                  <Text style={[styles.dataCellValue, styles.brandValue]}>{product.brand}</Text>
                </View>
              ) : null}
              {product.model ? (
                <View style={styles.dataCell}>
                  <Text style={styles.dataCellLabel}>MODEL</Text>
                  <Text style={styles.dataCellValue}>{product.model}</Text>
                </View>
              ) : null}
              <View style={styles.dataCell}>
                <Text style={styles.dataCellLabel}>IMPA KODU</Text>
                <Text style={styles.dataCellValue}>{product.impaCode || '-'}</Text>
              </View>
              <View style={styles.dataCellFull}>
                <View style={styles.stockRow}>
                  <View>
                    <Text style={styles.dataCellLabel}>KART MİKTARI</Text>
                    <Text style={styles.stockValue}>{product.qty || 0} {product.unit || 'Adet'}</Text>
                  </View>
                  <CustomIcon name="package-variant" size={32} color={Colors.outlineVariant} />
                </View>
              </View>
            </View>

            {/* Aksiyon Butonları */}
            <View style={styles.actionButtonsRow}>
              {/* Stok Güncelle Butonu (Miktar Ekleme) */}
              <TouchableOpacity
                style={[styles.updateButton, { flex: 1, backgroundColor: Colors.secondaryContainer }]}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('StockIncrease', { product });
                  setProduct(null);
                  setNotFoundBarcode(null);
                }}
              >
                <CustomIcon name="plus-circle-outline" size={18} color={Colors.onSecondaryContainer} />
                <Text style={[styles.updateButtonText, { color: Colors.onSecondaryContainer }]}>Stok Güncelle</Text>
              </TouchableOpacity>

              {/* Kartı Düzenle Butonu (Detay Güncelleme) */}
              <TouchableOpacity
                style={[styles.updateButton, { flex: 1 }]}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('StockAddEdit', { product });
                  setProduct(null);
                  setNotFoundBarcode(null);
                }}
              >
                <CustomIcon name="pencil-box-outline" size={18} color={Colors.onPrimary} />
                <Text style={styles.updateButtonText}>Kartı Düzenle</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bulunamadı Kartı */}
        {!product && notFoundBarcode && (
          <View style={styles.notFoundCard}>
            <View style={styles.notFoundHeader}>
              <CustomIcon name="alert-circle-outline" size={24} color={Colors.error} />
              <Text style={styles.notFoundTitle}>Ürün Bulunamadı</Text>
            </View>
            <Text style={styles.notFoundText}>
              "{notFoundBarcode}" barkoduna sahip herhangi bir ürün bulunamadı.
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.8}
              onPress={() => {
                navigation.navigate('StockAddEdit', { barcode: notFoundBarcode });
                setNotFoundBarcode(null);
              }}
            >
              <CustomIcon name="plus-circle" size={18} color={Colors.onPrimary} />
              <Text style={styles.addButtonText}>Yeni Stok Kartı Ekle</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Yardım/Kılavuz Kartı (Hiçbir ürün bulunamadığında genel ekleme imkanı sunar) */}
        {!product && (
          <View style={styles.helpCard}>
            <Text style={styles.helpText}>
              Barkod okutarak veya stok kodunu manuel aratarak ürün kontrolü yapabilirsiniz.
            </Text>
            <TouchableOpacity
              style={styles.generalAddButton}
              activeOpacity={0.8}
              onPress={() => {
                navigation.navigate('StockAddEdit');
                setNotFoundBarcode(null);
              }}
            >
              <CustomIcon name="plus-circle" size={16} color={Colors.primary} />
              <Text style={styles.generalAddButtonText}>Yeni Stok Kartı Ekle (Barkodsuz/Manuel)</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

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
                  setNotFoundBarcode(null);
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

      <CameraScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={(scannedCode) => {
          setManualBarcode(scannedCode);
          handleScan(scannedCode);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 8,
    paddingBottom: 40,
    gap: 8,
  },

  // Manual Input
  manualInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  manualInput: {
    flex: 1,
    height: 38,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    fontSize: 13,
    color: Colors.onSurface,
  },
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Result Card
  resultCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadow.card,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  imageContainer: {
    marginRight: 10,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  productName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: 2,
  },
  productNameTr: {
    fontSize: 13,
    color: '#1d4ed8',
    fontStyle: 'italic',
    marginTop: 2,
  },
  brandValue: {
    color: '#b85c00',
    fontWeight: 'bold',
  },
  productCompany: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  verifiedText: {
    ...Typography.labelSm,
    color: Colors.onPrimaryFixedVariant,
  },
  // Data Grid
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  dataCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 6,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  dataCellFull: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 6,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  dataCellLabel: {
    fontSize: 9,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  dataCellValue: {
    fontSize: 13,
    fontFamily: Typography.dataMono.fontFamily,
    color: Colors.onSurface,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockValue: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '700',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.sm,
    minHeight: 38,
  },
  updateButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  notFoundCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.errorContainer,
    marginTop: 8,
    gap: 8,
    ...Shadow.card,
  },
  notFoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notFoundTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.error,
  },
  notFoundText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.sm,
    height: 38,
    marginTop: 4,
  },
  addButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  helpCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    marginTop: 8,
    alignItems: 'center',
    gap: 12,
    ...Shadow.card,
  },
  helpText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },
  generalAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 16,
    height: 36,
  },
  generalAddButtonText: {
    ...Typography.labelMd,
    color: Colors.primary,
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
