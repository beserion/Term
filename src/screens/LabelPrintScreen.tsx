import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, printLabel, getPrinters, getStocks, PrinterDto, Stock } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { Numpad } from '../components/Numpad';
import { useSettingsStore } from '../store/settingsStore';
import { Modal } from 'react-native';
import { FeedbackService } from '../services/feedback';
import { sendCpclToPrinter } from '../services/printHelper';
import { flexMatch, normalizeText } from '../utils/searchHelper';
import { CameraScannerModal } from '../components/CameraScannerModal';



export function LabelPrintScreen() {
  const navigation = useNavigation<any>();
  const showToast = useUIStore((s) => s.showToast);
  const { activePrinterId, activePrinterName, setActivePrinter } = useSettingsStore();

  const [barcode, setBarcode] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [product, setProduct] = useState<Stock | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [autoPrint, setAutoPrint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showSoftKeyboard, setShowSoftKeyboard] = useState(false);
  const [numpadVisible, setNumpadVisible] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const manualBarcodeRef = React.useRef<TextInput>(null);
  const [scanning, setScanning] = useState(true);
  const [printers, setPrinters] = useState<PrinterDto[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = React.useRef<TextInput>(null);

  useEffect(() => {
    const initData = async () => {
      setLoadingPrinters(true);
      try {
        const list = await getPrinters();
        setPrinters(list);
        if (list.length > 0) {
          const exists = list.some(p => p.id === activePrinterId);
          if (!exists || activePrinterId === null) {
            setActivePrinter(list[0].id, list[0].name);
          }
        }
      } catch (err) {
        console.error("Yazıcılar yüklenemedi:", err);
        showToast({ message: 'Yazıcı listesi yüklenemedi.', type: 'error' });
      } finally {
        setLoadingPrinters(false);
      }

      try {
        const stockList = await getStocks();
        setStocks(stockList || []);
      } catch (err) {
        console.error("Stoklar yüklenemedi:", err);
      }
    };
    initData();
  }, []);

  // Giriş alanına barkod girildiğinde (Keystroke veya manuel) otomatik algılama ve arama
  useEffect(() => {
    const term = manualBarcode.trim();
    if (term.length >= 4) {
      const isNumeric = /^\d+$/.test(term);
      if (isNumeric) {
        const timeout = setTimeout(() => {
          handleScan(term);
          setManualBarcode('');
        }, 300);
        return () => clearTimeout(timeout);
      } else {
        setSearchQuery(term);
        setShowSearchModal(true);
        setManualBarcode('');
      }
    }
  }, [manualBarcode]);

  // Barkod arama ve yükleme işlemi
  const handleScan = async (scannedBarcode: string) => {
    if (!scannedBarcode || scannedBarcode.trim() === '') return;

    setLoading(true);
    setBarcode(scannedBarcode);

    // 1. Önce lokal stocks listesinden barkod veya kod tam eşleşmesi arayalım (normalize edilmiş olarak)
    const normalizedScanned = normalizeText(scannedBarcode);
    const matchedLocal = stocks.find(
      s => (s.barCode && normalizeText(s.barCode) === normalizedScanned) || 
           (s.stockCode && normalizeText(s.stockCode) === normalizedScanned)
    );

    if (matchedLocal) {
      setProduct(matchedLocal);
      showToast({ message: 'Ürün bulundu: ' + matchedLocal.stockName, type: 'success' });
      FeedbackService.playSuccess();
      setLoading(false);
      if (autoPrint) {
        await triggerPrint(scannedBarcode);
      }
      return;
    }

    try {
      const data = await getStockByBarcode(scannedBarcode);
      if (data && data.id && data.id !== 0) {
        setProduct(data);
        showToast({ message: 'Ürün bulundu: ' + data.stockName, type: 'success' });
        FeedbackService.playSuccess();

        // Eğer otomatik yazdırma aktifse hemen yazdır
        if (autoPrint) {
          await triggerPrint(scannedBarcode);
        }
      } else {
        // Ürün bulunamadı, Hızlı Kurulum sayfasındaki gibi barkod bulunamadığında arama modalını aç
        setProduct(null);
        setSearchQuery(scannedBarcode);
        setShowSearchModal(true);
        showToast({
          message: 'Ürün bulunamadı, eşleştirmek için arama yapın.',
          type: 'info',
        });
        FeedbackService.playError();
      }
    } catch (err) {
      setProduct(null);
      setSearchQuery(scannedBarcode);
      setShowSearchModal(true);
      showToast({
        message: 'Ürün bulunamadı, listeden seçebilirsiniz.',
        type: 'error',
      });
      FeedbackService.playError();
    } finally {
      setLoading(false);
    }
  };

  // Zebra DataWedge dinle
  useBarcode(handleScan, scanning);

  // Manuel barkod arama tetikleyicisi
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
    } else {
      showToast({ message: 'Lütfen arama terimi girin.', type: 'info' });
    }
  };

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
    setBarcode(selectedItem.barCode || selectedItem.stockCode || String(selectedItem.id));
    setShowSearchModal(false);
    showToast({ message: 'Ürün seçildi: ' + selectedItem.stockName, type: 'success' });
    FeedbackService.playSuccess();
  };

  // Etiket Yazdırma tetikleyicisi
  const triggerPrint = async (barcodeToPrint: string) => {
    if (!barcodeToPrint) return;
    if (activePrinterId === null) {
      showToast({ message: 'Lütfen önce bir yazıcı seçin.', type: 'info' });
      setShowPrinterModal(true);
      return;
    }

    setPrinting(true);
    try {
      // 1. API'den CPCL verisini ve yazıcı IP/Port bilgilerini al
      const result = await printLabel({
        printerId: activePrinterId,
        barcode: barcodeToPrint,
        qrCode: barcodeToPrint,
        quantity: quantity
      });

      if (!result.cpclData || !result.printerIp) {
        throw new Error('API\'den CPCL veri veya IP adresi dönmedi.');
      }

      // 2. TCP Soketi üzerinden yazıcıya CPCL verisini doğrudan gönder
      await sendCpclToPrinter(result.printerIp, result.printerPort || 6101, result.cpclData);

      showToast({
        message: `${quantity} adet etiket yazıcıya başarıyla gönderildi.`,
        type: 'success',
      });
      FeedbackService.playSuccess();
    } catch (err: any) {
      showToast({
        message: 'Etiket yazdırılamadı: ' + (err.message || 'Bilinmeyen hata'),
        type: 'error',
      });
      FeedbackService.playError();
    } finally {
      setPrinting(false);
    }
  };

  // Miktar artır / azalt
  const adjustQuantity = (amount: number) => {
    setQuantity((prev) => Math.max(1, Math.min(999, prev + amount)));
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Etiket Yazdırma" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Scanner Durumu ve Bilgilendirme */}
        <View style={styles.infoBanner}>
          <CustomIcon name="barcode-scan" size={24} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Barkod Bekleniyor</Text>
          </View>
        </View>

        {/* Manuel Barkod Girişi */}
        <View style={styles.manualInputRow}>
          <View style={styles.barcodeInputContainer}>
            <TextInput
              style={styles.manualInput}
              placeholder="Manuel barkod girin..."
              placeholderTextColor={Colors.outline}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              onSubmitEditing={handleManualSearch}
              returnKeyType="search"
              ref={manualBarcodeRef}
              autoFocus={true}
              showSoftInputOnFocus={true}
            />
            <TouchableOpacity 
              style={styles.keyboardToggleBtn}
              onPress={() => {
                setShowSoftKeyboard(prev => !prev);
                setTimeout(() => manualBarcodeRef.current?.focus(), 100);
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

        {/* Ürün veya Barkod Detay Kartı */}
        {(barcode !== '' || loading) && (
          <View style={styles.card}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Ürün bilgileri çekiliyor...</Text>
              </View>
            ) : (
              <View>
                {product ? (
                  <View>
                    <View style={styles.productHeader}>
                      <CustomIcon name="package-variant-closed" size={32} color={Colors.primary} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <Text style={styles.productName}>{product.stockName}</Text>
                        <Text style={styles.productCode}>{product.stockCode || '-'}</Text>
                      </View>
                    </View>

                    <View style={styles.separator} />

                    <View style={styles.detailGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>OKUTULAN BARKOD</Text>
                        <Text style={styles.detailValue}>{barcode}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>RAF ADRESİ</Text>
                        <Text style={styles.detailValue}>{product.shelfAddress || 'Tanımsız'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>FİZİKSEL STOK</Text>
                        <Text style={styles.detailValue}>
                          {product.qty || 0} {product.unit || 'Adet'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View>
                    <View style={styles.productHeader}>
                      <CustomIcon name="alert-circle-outline" size={32} color={Colors.warning} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <Text style={styles.productName}>Bilinmeyen Ürün</Text>
                        <Text style={styles.productCode}>Sistemde kayıt bulunamadı</Text>
                      </View>
                    </View>
                    <View style={styles.separator} />
                    <View style={styles.detailGrid}>
                      <View style={styles.detailItemFull}>
                        <Text style={styles.detailLabel}>OKUTULAN BARKOD</Text>
                        <Text style={styles.detailValue}>{barcode}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Yazdırma Seçenekleri ve Adet Ayarı */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Yazdırma Ayarları</Text>

          {/* Adet Seçici */}
          <View style={styles.quantityRow}>
            <Text style={styles.quantityLabel}>Kopya Sayısı:</Text>
            <View style={styles.quantitySelector}>
              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() => adjustQuantity(-1)}
                activeOpacity={0.7}
              >
                <CustomIcon name="minus" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setNumpadVisible(true)}
                activeOpacity={0.7}
                style={styles.quantityValueTouchable}
              >
                <Text style={styles.quantityValue}>{quantity}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() => adjustQuantity(1)}
                activeOpacity={0.7}
              >
                <CustomIcon name="plus" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Otomatik Yazdırma Switch'i */}
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Otomatik Yazdır</Text>
              <Text style={styles.settingDesc}>
                Barkod okutulduğu anda belirlenen adet kadar otomatik yazdırır.
              </Text>
            </View>
            <Switch
              value={autoPrint}
              onValueChange={setAutoPrint}
              trackColor={{ false: Colors.surfaceVariant, true: Colors.primaryFixedDim }}
              thumbColor={autoPrint ? Colors.primary : Colors.outline}
            />
          </View>

          <View style={styles.separator} />

          {/* Yazıcı Seçimi */}
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Hedef Yazıcı</Text>
              <Text style={styles.settingDesc}>
                Etiketlerin gönderileceği aktif yazıcı.
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.printerSelectorBtn}
              onPress={() => setShowPrinterModal(true)}
              activeOpacity={0.7}
            >
              <CustomIcon name="printer" size={20} color={Colors.primary} />
              <Text style={styles.printerSelectorBtnText} numberOfLines={1}>
                {activePrinterName || 'Seçilmemiş'}
              </Text>
              <CustomIcon name="chevron-down" size={16} color={Colors.outline} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Yazdır Butonu */}
        <TouchableOpacity
          style={[
            styles.printButton,
            (!barcode || printing || loading) && styles.printButtonDisabled,
          ]}
          disabled={!barcode || printing || loading}
          onPress={() => triggerPrint(barcode)}
          activeOpacity={0.8}
        >
          {printing ? (
            <ActivityIndicator color={Colors.onPrimary} size="small" />
          ) : (
            <View style={styles.printButtonContent}>
              <CustomIcon name="printer" size={24} color={Colors.onPrimary} />
              <Text style={styles.printButtonText}>Yazdır ({quantity} Adet)</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Numpad
        visible={numpadVisible}
        onClose={() => setNumpadVisible(false)}
        onType={(val: string) => {
          setQuantity(prev => {
            const currentStr = String(prev);
            const nextStr = (prev === 1 && currentStr.length === 1) ? val : (currentStr + val);
            const nextVal = parseInt(nextStr) || 1;
            return Math.min(999, Math.max(1, nextVal));
          });
        }}
        onDelete={() => {
          setQuantity(prev => {
            const nextStr = String(prev).slice(0, -1);
            return parseInt(nextStr) || 1;
          });
        }}
        onSubmit={() => setNumpadVisible(false)}
        submitLabel="TAMAM"
        submitColor={Colors.primary}
        title="Kopya Sayısı"
        value={String(quantity)}
      />

      {/* Yazıcı Seçim Modalı (Bottom Sheet) */}
      <Modal 
        visible={showPrinterModal} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setShowPrinterModal(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Yazıcı Seçin</Text>
              <TouchableOpacity onPress={() => setShowPrinterModal(false)} style={styles.pickerCloseBtn}>
                <CustomIcon name="close" size={24} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerListContent}>
              {loadingPrinters ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
              ) : printers.length === 0 ? (
                <Text style={{ textAlign: 'center', color: Colors.outline, marginTop: Spacing.xl }}>Yazıcı bulunamadı</Text>
              ) : (
                printers.map((p) => {
                  const isSelected = activePrinterId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                      onPress={() => {
                        setActivePrinter(p.id, p.name);
                        setShowPrinterModal(false);
                        showToast({ message: 'Aktif yazıcı güncellendi', type: 'success' });
                      }}
                      activeOpacity={0.7}
                    >
                      <CustomIcon
                        name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                        size={24}
                        color={isSelected ? Colors.primary : Colors.outline}
                      />
                      <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryFixed,
    padding: 8,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.primaryFixedDim,
  },
  infoTitle: {
    fontSize: 14,
    color: Colors.onPrimaryFixed,
    fontWeight: 'bold',
  },
  infoDesc: {
    ...Typography.bodySm,
    color: Colors.onPrimaryFixedVariant,
    marginTop: 2,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  barcodeInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingRight: Spacing.xs,
  },
  manualInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Colors.onSurface,
  },
  keyboardToggleBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadow.card,
  },
  cardTitle: {
    fontSize: 14,
    color: Colors.onSurface,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productName: {
    fontSize: 15,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  productCode: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.surfaceContainerHigh,
    marginVertical: 6,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailItem: {
    width: '47%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 6,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  detailItemFull: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 6,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  detailLabel: {
    fontSize: 9,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: Typography.dataMono.fontFamily,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityLabel: {
    fontSize: 13,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValueTouchable: {
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    fontSize: 15,
    color: Colors.onSurface,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  settingTitle: {
    fontSize: 13,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  settingDesc: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  printerSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.sm,
    height: 32,
    gap: Spacing.xs,
    maxWidth: 160,
  },
  printerSelectorBtnText: {
    fontSize: 12,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  printButton: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.xs,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  printButtonDisabled: {
    backgroundColor: Colors.outlineVariant,
    opacity: 0.6,
  },
  printButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  printButtonText: {
    fontSize: 14,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    maxHeight: '60%',
    minHeight: '40%',
    paddingBottom: Spacing.xl,
    ...Shadow.card,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  pickerTitle: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  pickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerList: {
    flex: 1,
  },
  pickerListContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  pickerItemActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFixed,
  },
  pickerItemText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  pickerItemTextActive: {
    fontWeight: 'bold',
    color: Colors.onPrimaryFixed,
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
