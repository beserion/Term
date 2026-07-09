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
import { getStocks, updateStockBarcode, Stock } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { FeedbackService } from '../services/feedback';

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
    padding: Spacing.marginMobile,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  searchRow: {
    position: 'relative',
  },
  searchInput: {
    height: 48,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingLeft: 44,
    paddingRight: Spacing.md,
    color: Colors.onSurface,
    ...Typography.bodyLg,
  },
  searchIcon: {
    position: 'absolute',
    left: Spacing.md,
    top: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  toggleLabel: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  listContent: {
    padding: Spacing.marginMobile,
    paddingBottom: 260, // Alt panel kapandığında/açıldığında listenin arkasında kalmaması için pay bırakıldı
    gap: Spacing.md,
  },
  stockCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    padding: Spacing.cardPadding,
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
    paddingRight: Spacing.md,
  },
  stockName: {
    ...Typography.bodyLg,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: 4,
  },
  stockTextSelected: {
    color: Colors.onPrimaryFixed,
  },
  stockCode: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginBottom: 4,
  },
  stockBarcode: {
    ...Typography.bodySm,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  boldMono: {
    ...Typography.dataMono,
    fontWeight: 'bold',
  },
  noBarcodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.errorContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: 2,
  },
  noBarcodeBadgeText: {
    ...Typography.labelSm,
    color: Colors.onErrorContainer,
    fontWeight: 'bold',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  shelfText: {
    ...Typography.labelMd,
    color: Colors.secondary,
    fontWeight: 'bold',
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  qtyText: {
    ...Typography.bodyMd,
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
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.marginMobile,
    gap: Spacing.md,
    ...Shadow.lg,
    elevation: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    paddingBottom: Spacing.sm,
  },
  panelTitle: {
    ...Typography.labelSm,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  panelSubName: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  panelCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryFixed,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  scannerPromptText: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onPrimaryFixedVariant,
  },
  autoAdvanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoAdvanceText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  barcodeTextInput: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    color: Colors.onSurface,
    ...Typography.bodyLg,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    height: 48,
    gap: Spacing.sm,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.outlineVariant,
  },
  saveButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
});
