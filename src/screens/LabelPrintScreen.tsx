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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, printLabel, getPrinters, PrinterDto, Stock } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { Numpad } from '../components/Numpad';
import { useSettingsStore } from '../store/settingsStore';
import { Modal } from 'react-native';
import { FeedbackService } from '../services/feedback';
import { sendCpclToPrinter } from '../services/printHelper';



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
  const manualBarcodeRef = React.useRef<TextInput>(null);
  const [scanning, setScanning] = useState(true);
  const [printers, setPrinters] = useState<PrinterDto[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  useEffect(() => {
    const fetchPrinters = async () => {
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
    };
    fetchPrinters();
  }, []);

  // Giriş alanına barkod girildiğinde (Keystroke veya manuel) otomatik algılama ve arama
  useEffect(() => {
    if (manualBarcode.trim().length >= 4) {
      const timeout = setTimeout(() => {
        handleScan(manualBarcode.trim());
        setManualBarcode('');
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [manualBarcode]);

  // Barkod arama ve yükleme işlemi
  const handleScan = async (scannedBarcode: string) => {
    if (!scannedBarcode || scannedBarcode.trim() === '') return;

    setLoading(true);
    setBarcode(scannedBarcode);
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
        // Ürün bulunamadı ama barkod yazdırılabilir
        setProduct(null);
        showToast({
          message: 'Ürün sistemde bulunamadı. Barkod yine de yazdırılabilir.',
          type: 'info',
        });
        FeedbackService.playError();
        if (autoPrint) {
          await triggerPrint(scannedBarcode);
        }
      }
    } catch (err) {
      setProduct(null);
      showToast({
        message: 'Barkod bilgisi sorgulanırken hata oluştu.',
        type: 'error',
      });
      FeedbackService.playError();
      if (autoPrint) {
        await triggerPrint(scannedBarcode);
      }
    } finally {
      setLoading(false);
    }
  };

  // Zebra DataWedge dinle
  useBarcode(handleScan, scanning);

  // Manuel barkod arama tetikleyicisi
  const handleManualSearch = () => {
    if (manualBarcode.trim().length >= 3) {
      handleScan(manualBarcode.trim());
      setManualBarcode('');
    } else {
      showToast({ message: 'Lütfen en az 3 karakter girin.', type: 'info' });
    }
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
              showSoftInputOnFocus={showSoftKeyboard}
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
                        <Text style={styles.productCode}>{product.stockCode}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.marginMobile,
    paddingBottom: 40,
    gap: Spacing.lg,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryFixed,
    padding: Spacing.cardPadding,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primaryFixedDim,
  },
  infoTitle: {
    ...Typography.titleMedium,
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
    height: Spacing.touchTargetMin,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingRight: Spacing.xs,
  },
  manualInput: {
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
  searchButton: {
    width: Spacing.touchTargetMin,
    height: Spacing.touchTargetMin,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    padding: Spacing.cardPadding,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadow.card,
  },
  cardTitle: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
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
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  productCode: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.surfaceContainerHigh,
    marginVertical: Spacing.md,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  detailItem: {
    width: '47%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  detailItemFull: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  detailLabel: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailValue: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityLabel: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  quantityBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValueTouchable: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    ...Typography.titleLarge,
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
    ...Typography.bodyLg,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  settingDesc: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  printerSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.sm,
    height: 40,
    gap: Spacing.xs,
    maxWidth: 160,
  },
  printerSelectorBtnText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  printButton: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.md,
    minHeight: 56,
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
    ...Typography.titleMedium,
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
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
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
    ...Typography.titleLg,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  pickerCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  pickerItemActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFixed,
  },
  pickerItemText: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  pickerItemTextActive: {
    fontWeight: 'bold',
    color: Colors.onPrimaryFixed,
  },
});
