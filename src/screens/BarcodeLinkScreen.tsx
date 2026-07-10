import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStocks, updateStockBarcode, printLabel, Stock } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { FeedbackService } from '../services/feedback';
import { useSettingsStore } from '../store/settingsStore';
import { sendCpclToPrinter } from '../services/printHelper';

export function BarcodeLinkScreen() {
  const navigation = useNavigation<any>();
  const showToast = useUIStore((s) => s.showToast);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyNoBarcode, setOnlyNoBarcode] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Stock | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printAfterAssign, setPrintAfterAssign] = useState(false);

  const { activePrinterId, activePrinterName } = useSettingsStore();

  // Otomatik yazdırma işlemi yardımcı fonksiyonu
  const printAndSendLabel = async (barcodeToPrint: string) => {
    try {
      const result = await printLabel({
        printerId: activePrinterId!,
        barcode: barcodeToPrint,
        qrCode: barcodeToPrint,
        quantity: 1
      });
      if (result.cpclData && result.printerIp) {
        await sendCpclToPrinter(result.printerIp, result.printerPort || 6101, result.cpclData);
        showToast({ message: 'Etiket yazıcıya gönderildi.', type: 'success' });
      }
    } catch (err: any) {
      showToast({ message: 'Otomatik etiket yazdırma hatası: ' + err.message, type: 'error' });
    }
  };

  // Verileri yükle
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getStocks();
      setStocks(data || []);
    } catch (error: any) {
      showToast({ message: 'Stoklar yüklenemedi: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filtreleme mantığı
  const filteredStocks = stocks.filter((item) => {
    const matchSearch =
      !searchTerm ||
      (item.stockName && item.stockName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.stockCode && item.stockCode.toLowerCase().includes(searchTerm.toLowerCase()));

    if (onlyNoBarcode) {
      return matchSearch && (!item.barCode || item.barCode.trim() === '');
    }
    return matchSearch;
  });

  // Barkod kaydetme işlemi
  const handleSaveBarcode = async (barcodeToSave: string) => {
    if (!selectedProduct) return;
    const cleanBarcode = barcodeToSave.trim();
    if (!cleanBarcode) {
      showToast({ message: 'Lütfen geçerli bir barkod girin veya okutun.', type: 'error' });
      FeedbackService.playError();
      return;
    }

    try {
      setSaving(true);
      await updateStockBarcode(selectedProduct.id, cleanBarcode);
      
      // Lokal state güncellemesi
      setStocks((prev) =>
        prev.map((item) =>
          item.id === selectedProduct.id ? { ...item, barCode: cleanBarcode } : item
        )
      );

      showToast({ message: `${selectedProduct.stockName} ürününe barkod başarıyla atandı!`, type: 'success' });
      FeedbackService.playSuccess();

      // Otomatik etiket yazdırma seçeneği aktifse
      if (printAfterAssign) {
        if (activePrinterId !== null) {
          printAndSendLabel(cleanBarcode);
        } else {
          showToast({ message: 'Barkod atandı fakat aktif yazıcı seçili olmadığı için etiket basılamadı.', type: 'info' });
        }
      }

      // Temizleme ve otomatik ilerleme
      setBarcodeInput('');
      
      if (autoAdvance) {
        // Filtrelenmiş listede sıradaki ürünü bul
        const currentIndex = filteredStocks.findIndex((item) => item.id === selectedProduct.id);
        const nextIndex = currentIndex + 1;
        if (nextIndex < filteredStocks.length) {
          // Sıradaki ürünü seç
          setSelectedProduct(filteredStocks[nextIndex]);
        } else {
          setSelectedProduct(null);
          showToast({ message: 'Tüm filtrelenmiş ürünler tamamlandı!', type: 'info' });
        }
      } else {
        setSelectedProduct(null);
      }
    } catch (error: any) {
      showToast({ message: 'Barkod kaydedilemedi: ' + error.message, type: 'error' });
      FeedbackService.playError();
    } finally {
      setSaving(false);
    }
  };

  // Barkod Okuyucu Hook'u (Seçili ürün varsa dinle)
  useBarcode(
    (scannedBarcode) => {
      if (selectedProduct && !saving) {
        handleSaveBarcode(scannedBarcode);
      }
    },
    !!selectedProduct && !saving
  );

  const renderStockItem = ({ item }: { item: Stock }) => {
    const isSelected = selectedProduct?.id === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.stockCard,
          isSelected && styles.stockCardSelected,
        ]}
        onPress={() => {
          setSelectedProduct(isSelected ? null : item);
          setBarcodeInput('');
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTextContainer}>
            <Text style={[styles.stockName, isSelected && styles.stockTextSelected]}>
              {item.stockName || 'İsimsiz Ürün'}
            </Text>
            <Text style={styles.stockCode}>
              Kod: <Text style={styles.boldMono}>{item.stockCode || '-'}</Text>
            </Text>
            {item.barCode ? (
              <Text style={styles.stockBarcode}>
                Barkod: <Text style={styles.boldMono}>{item.barCode}</Text>
              </Text>
            ) : (
              <View style={styles.noBarcodeBadge}>
                <Text style={styles.noBarcodeBadgeText}>BARKODSUZ</Text>
              </View>
            )}
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.shelfText}>{item.shelfAddress || 'Raf Yok'}</Text>
            <Text style={styles.qtyText}>{item.qty || 0} {item.unit || 'Adet'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopAppBar
        title="Hızlı Barkod Eşleme"
        onBack={() => navigation.goBack()}
        onAction={fetchProducts}
        actionIcon="loading"
      />

      <View style={styles.filterSection}>
        {/* Arama Barı */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün adı veya koduna göre ara..."
            placeholderTextColor={Colors.outline}
            value={searchTerm}
            onChangeText={setSearchTerm}
            clearButtonMode="while-editing"
          />
          <View style={styles.searchIcon}>
            <CustomIcon name="magnify" size={20} color={Colors.outline} />
          </View>
        </View>

        {/* Filtre Switchleri */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleOption}>
            <Text style={styles.toggleLabel}>Sadece Barkodsuzları Göster</Text>
            <Switch
              value={onlyNoBarcode}
              onValueChange={setOnlyNoBarcode}
              thumbColor={onlyNoBarcode ? Colors.primary : Colors.outlineVariant}
              trackColor={{ false: Colors.surfaceContainer, true: Colors.primaryFixedDim }}
            />
          </View>
        </View>
      </View>

      {/* Ürün Listesi */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Ürünler yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStocks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderStockItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <CustomIcon name="check-circle" size={48} color={Colors.success} />
              <Text style={styles.emptyText}>Gösterilecek ürün bulunamadı.</Text>
            </View>
          }
        />
      )}

      {/* Seçili Ürün Eşleştirme Alt Paneli */}
      {selectedProduct && (
        <View style={styles.matchingPanel}>
          <View style={styles.panelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>Barkod Eşleştiriliyor</Text>
              <Text style={styles.panelSubName} numberOfLines={1}>
                {selectedProduct.stockName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setSelectedProduct(null);
                setBarcodeInput('');
              }}
              style={styles.panelCloseButton}
            >
              <CustomIcon name="close" size={20} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Hızlı Bilgi ve Lazer Okutma Uyarısı */}
          <View style={styles.scannerPromptCard}>
            <CustomIcon name="barcode-scan" size={24} color={Colors.primary} />
            <Text style={styles.scannerPromptText}>
              Cihazın lazerini kullanarak barkod okutun veya aşağıya manuel yazın.
            </Text>
          </View>

          {/* Otomatik İlerleme Switch */}
          <View style={styles.autoAdvanceRow}>
            <Text style={styles.autoAdvanceText}>
              Okutunca otomatik kaydet ve sıradakine geç
            </Text>
            <Switch
              value={autoAdvance}
              onValueChange={setAutoAdvance}
              thumbColor={autoAdvance ? Colors.primary : Colors.outlineVariant}
              trackColor={{ false: Colors.surfaceContainer, true: Colors.primaryFixedDim }}
            />
          </View>
 
          {/* Otomatik Etiket Yazdırma Switch */}
          <View style={[styles.autoAdvanceRow, { borderTopWidth: 1, borderTopColor: Colors.outlineVariant, paddingTop: Spacing.sm, marginTop: 2 }]}>
            <View style={{ flex: 1, paddingRight: Spacing.sm }}>
              <Text style={styles.autoAdvanceText}>
                Barkod atanınca 1 adet etiket yazdır
              </Text>
              {activePrinterName ? (
                <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: 'bold', marginTop: 2 }}>
                  Aktif Yazıcı: {activePrinterName}
                </Text>
              ) : (
                <Text style={{ fontSize: 11, color: Colors.error, fontWeight: 'bold', marginTop: 2 }}>
                  Seçili yazıcı yok
                </Text>
              )}
            </View>
            <Switch
              value={printAfterAssign}
              onValueChange={(val) => {
                if (val && activePrinterId === null) {
                  showToast({ message: 'Lütfen önce ayarlardan bir yazıcı seçin.', type: 'info' });
                  return;
                }
                setPrintAfterAssign(val);
              }}
              thumbColor={printAfterAssign ? Colors.primary : Colors.outlineVariant}
              trackColor={{ false: Colors.surfaceContainer, true: Colors.primaryFixedDim }}
            />
          </View>

          {/* Manuel Barkod Giriş Satırı */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.barcodeTextInput}
              placeholder="Manuel barkod girin..."
              placeholderTextColor={Colors.outline}
              value={barcodeInput}
              onChangeText={setBarcodeInput}
              onSubmitEditing={() => handleSaveBarcode(barcodeInput)}
              returnKeyType="done"
              autoFocus={true}
            />
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={() => handleSaveBarcode(barcodeInput)}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <>
                  <CustomIcon name="content-save" size={18} color={Colors.onPrimary} />
                  <Text style={styles.saveButtonText}>Kaydet</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filterSection: {
    backgroundColor: Colors.surface,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    gap: Spacing.xs,
    ...Shadow.sm,
  },
  searchRow: {
    position: 'relative',
  },
  searchInput: {
    height: 36,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingLeft: 36,
    paddingRight: Spacing.md,
    color: Colors.onSurface,
    fontSize: 13,
  },
  searchIcon: {
    position: 'absolute',
    left: 10,
    top: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  toggleLabel: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  listContent: {
    padding: 8,
    paddingBottom: 260,
    gap: 6,
  },
  stockCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.card,
  },
  stockCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.primaryFixed,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTextContainer: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  stockName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: 2,
  },
  stockTextSelected: {
    color: Colors.onPrimaryFixed,
  },
  stockCode: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginBottom: 2,
  },
  stockBarcode: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  boldMono: {
    ...Typography.dataMono,
    fontWeight: 'bold',
    fontSize: 11,
  },
  noBarcodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.errorContainer,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
    marginTop: 1,
  },
  noBarcodeBadgeText: {
    fontSize: 8,
    color: Colors.onErrorContainer,
    fontWeight: 'bold',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  shelfText: {
    fontSize: 11,
    color: Colors.secondary,
    fontWeight: 'bold',
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  qtyText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    ...Typography.bodyMd,
    color: Colors.outline,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.bodyLg,
    color: Colors.outline,
  },
  matchingPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    padding: 10,
    gap: 8,
    ...Shadow.card,
    elevation: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    paddingBottom: 4,
  },
  panelTitle: {
    fontSize: 9,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  panelSubName: {
    fontSize: 15,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  panelCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryFixed,
    padding: 6,
    borderRadius: BorderRadius.xs,
    gap: 6,
  },
  scannerPromptText: {
    flex: 1,
    fontSize: 11,
    color: Colors.onPrimaryFixedVariant,
  },
  autoAdvanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoAdvanceText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  barcodeTextInput: {
    flex: 1,
    height: 38,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    color: Colors.onSurface,
    fontSize: 13,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 12,
    height: 38,
    gap: 4,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.outlineVariant,
  },
  saveButtonText: {
    fontSize: 13,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
});
