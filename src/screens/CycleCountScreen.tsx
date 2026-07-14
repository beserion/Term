import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, FlatList, Image, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, Stock, createCycleCount, getCycleCounts, CycleCountListItemDto, uploadImage } from '../services/inventory';
import { Config } from '../config';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { Numpad } from '../components/Numpad';
import { WarehouseSelectModal } from '../components/WarehouseSelectModal';
import { FeedbackService } from '../services/feedback';
import * as ImagePicker from 'expo-image-picker';

interface CountedItem {
  product: Stock;
  countedQty: number;
  photo?: string;
}

export function CycleCountScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [barcode, setBarcode] = useState('');
  const [countedItems, setCountedItems] = useState<CountedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingStockId, setUploadingStockId] = useState<number | null>(null);

  // Edit Quantity Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CountedItem | null>(null);
  const [editQtyStr, setEditQtyStr] = useState('');

  const [showSoftKeyboard, setShowSoftKeyboard] = useState(false);
  const barcodeInputRef = React.useRef<TextInput>(null);

  const { activeWarehouseId, activeWarehouseName } = useSettingsStore();
  const showToast = useUIStore((s) => s.showToast);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    Config.getApiBaseUrl().then((url) => {
      const origin = url.replace(/\/api$/, '');
      setBaseUrl(origin);
    });
  }, []);

  const resolveImageUri = (uri?: string) => {
    if (!uri) return undefined;
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:')) {
      return uri;
    }
    const path = uri.startsWith('/') ? uri : `/${uri}`;
    return `${baseUrl}${path}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Sayım Listesi Seçim Durumları
  const [cycleCounts, setCycleCounts] = useState<CycleCountListItemDto[]>([]);
  const [selectedCycleCount, setSelectedCycleCount] = useState<CycleCountListItemDto | null>(null);
  const [showCycleCountModal, setShowCycleCountModal] = useState(false);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  const fetchCycleCounts = async () => {
    setIsLoadingCounts(true);
    try {
      const data = await getCycleCounts();
      setCycleCounts(data);
      if (data.length > 0) {
        setShowCycleCountModal(true);
      } else {
        showToast({ message: 'Aktif/Bekleyen sayım fişi bulunamadı. Yeni fiş başlatılacak.', type: 'info' });
      }
    } catch (err) {
      console.error(err);
      showToast({ message: 'Sayım listeleri yüklenemedi.', type: 'error' });
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    fetchCycleCounts();
  }, []);

  const lastScanTimeRef = React.useRef<number>(0);
  const lastScanBarcodeRef = React.useRef<string>('');
  const isScanningRef = React.useRef<boolean>(false);

  const handleScan = async (scannedBarcode: string) => {
    if (!scannedBarcode.trim() || isScanningRef.current) return;

    const now = Date.now();
    // 800ms içinde aynı barkodun mükerrer okunmasını engelle
    if (scannedBarcode === lastScanBarcodeRef.current && (now - lastScanTimeRef.current) < 800) {
      return;
    }

    isScanningRef.current = true;
    lastScanBarcodeRef.current = scannedBarcode;
    lastScanTimeRef.current = now;

    // Barkod okunduğu anda girişi anında sıfırla ki seri okuma yapılabilsin
    setBarcode('');

    try {
      const data = await getStockByBarcode(scannedBarcode);
      if (!data || !data.id || data.id === 0) {
        throw new Error('Ürün kaydı bulunamadı');
      }

      // Listede var mı kontrol et
      setCountedItems(prev => {
        const existing = prev.find(item => item.product.id === data.id);
        if (existing) {
          // Varsa miktarını 1 artır
          return prev.map(item =>
            item.product.id === data.id
              ? { ...item, countedQty: item.countedQty + 1 }
              : item
          );
        } else {
          // Yoksa yeni ekle (Miktar 1)
          return [{ product: data, countedQty: 1 }, ...prev];
        }
      });
      showToast({ message: `${data.stockName} okundu`, type: 'success' });
      FeedbackService.playSuccess();
    } catch {
      showToast({ message: 'Barkod bulunamadı: ' + scannedBarcode, type: 'error' });
      FeedbackService.playError();
    } finally {
      setBarcode('');
      isScanningRef.current = false;
    }
  };

  useBarcode(handleScan);

  useEffect(() => {
    if (barcode.trim().length >= 4) {
      const timeout = setTimeout(() => {
        handleScan(barcode.trim());
      }, 300); // 300ms daha seri algılama sağlar
      return () => clearTimeout(timeout);
    }
  }, [barcode]);

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const qty = parseFloat(editQtyStr);

    if (isNaN(qty) || qty < 0) {
      showToast({ message: 'Geçerli bir miktar girin', type: 'error' });
      return;
    }

    setCountedItems(prev => prev.map(item =>
      item.product.id === editingItem.product.id
        ? { ...item, countedQty: qty }
        : item
    ));
    setShowEditModal(false);
    setEditingItem(null);
  };

  const handleRemoveItem = (stockId: number) => {
    setCountedItems(prev => prev.filter(item => item.product.id !== stockId));
  };

  const handleTakePhoto = async (stockId: number) => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      showToast({ message: 'Kamera izni reddedildi!', type: 'error' });
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const photoAsset = result.assets[0];
        setUploadingStockId(stockId);
        try {
          const uploadedUrl = await uploadImage(photoAsset.uri);
          if (uploadedUrl) {
            setCountedItems(prev => prev.map(item => 
              item.product.id === stockId
                ? { ...item, photo: uploadedUrl }
                : item
            ));
            showToast({ message: 'Fotoğraf sunucuya yüklendi', type: 'success' });
          } else {
            showToast({ message: 'Fotoğraf yüklendi fakat sunucudan adres alınamadı.', type: 'error' });
          }
        } catch (uploadErr: any) {
          console.error(uploadErr);
          showToast({ message: 'Fotoğraf yüklenirken hata oluştu: ' + uploadErr.message, type: 'error' });
        } finally {
          setUploadingStockId(null);
        }
      }
    } catch (error) {
      console.error(error);
      showToast({ message: 'Fotoğraf çekilirken hata oluştu.', type: 'error' });
    }
  };

  const handleRemovePhoto = (stockId: number) => {
    setCountedItems(prev => prev.map(item => 
      item.product.id === stockId
        ? { ...item, photo: undefined }
        : item
    ));
    showToast({ message: 'Fotoğraf kaldırıldı', type: 'info' });
  };

  const handleSubmit = async () => {
    if (!activeWarehouseId) {
      showToast({ message: 'Lütfen ayarlardan depo seçin', type: 'error' });
      return;
    }
    if (countedItems.length === 0) {
      showToast({ message: 'Sayım listesi boş', type: 'info' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createCycleCount({
        cycleCountId: selectedCycleCount?.id,
        documentNo: selectedCycleCount?.documentNo || 'CYC-' + Date.now(),
        countDate: new Date().toISOString(),
        warehouseId: activeWarehouseId,
        lines: countedItems.map(item => ({
          stockId: item.product.id,
          countedQty: item.countedQty,
          photo: item.photo
        }))
      });
      showToast({ message: 'Sayım fişi başarıyla güncellendi ve tamamlandı', type: 'success' });
      setCountedItems([]); // Temizle
      setSelectedCycleCount(null); // Sıfırla
      fetchCycleCounts(); // Listeyi güncelle
    } catch (err: any) {
      let errorMsg = err.message;
      if (err.response?.data) {
        errorMsg = typeof err.response.data === 'object' ? JSON.stringify(err.response.data, null, 2) : err.response.data;
      }
      console.error("=== CYCLE COUNT API ERROR ===");
      console.error(errorMsg);
      showToast({ message: 'Sayım kaydedilemedi. Detaylar terminalde.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Depo Sayım (Cycle-Count)" onBack={() => navigation.goBack()} />


      <TouchableOpacity
        style={styles.cycleCountSelectBtn}
        onPress={() => setShowCycleCountModal(true)}
        activeOpacity={0.8}
      >
        <CustomIcon name="clipboard-text-play-outline" size={24} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.warehouseAlertLabel}>Aktif Sayım Fişi</Text>
          <Text style={styles.warehouseAlertName}>
            {selectedCycleCount ? `${selectedCycleCount.warehouseName || 'Depo Belirtilmemiş'} - ${selectedCycleCount.remarks || 'Açıklama Yok'}` : 'SAYIM FİŞİ SEÇİLMEMİŞ!'}
          </Text>
        </View>
        <CustomIcon name="chevron-down" size={20} color={Colors.primary} />
      </TouchableOpacity>

      {!selectedCycleCount ? (
        <View style={styles.noCountContainer}>
          <CustomIcon name="clipboard-alert-outline" size={64} color={Colors.outline} />
          <Text style={styles.noCountTitle}>Sayım Fişi Seçilmedi</Text>
          <Text style={styles.noCountText}>
            Barkod taramaya başlamak için lütfen aktif bir sayım fişi seçin.
          </Text>
          <TouchableOpacity
            style={styles.selectCountBigBtn}
            onPress={() => setShowCycleCountModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.selectCountBigBtnText}>Sayım Fişi Seç</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.scanContainer}>
            <View style={styles.scanRow}>
              <View style={styles.barcodeInputContainer}>
                <TextInput
                  style={styles.barcodeInput}
                  placeholder="Barkod okutun..."
                  placeholderTextColor={Colors.outline}
                  value={barcode}
                  onChangeText={(val) => { if (!isScanningRef.current) setBarcode(val); }}
                  onSubmitEditing={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
                  returnKeyType="search"
                  ref={barcodeInputRef}
                  autoFocus={true}
                  showSoftInputOnFocus={showSoftKeyboard}
                />
                <TouchableOpacity
                  style={styles.keyboardToggleBtn}
                  onPress={() => {
                    setShowSoftKeyboard(prev => !prev);
                    setTimeout(() => barcodeInputRef.current?.focus(), 100);
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
            </View>
            <Text style={styles.hint}>Peş peşe okutulan aynı ürünlerin miktarı otomatik toplanır.</Text>
          </View>

          <FlatList
            data={countedItems}
            keyExtractor={item => item.product.id.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <CustomIcon name="barcode-scan" size={48} color={Colors.outlineVariant} />
                <Text style={styles.emptyText}>Henüz ürün okutulmadı</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.listItem}>
                {/* Fotoğraf Butonu / Önizleme */}
                <TouchableOpacity
                  style={styles.photoContainer}
                  onPress={() => {
                    if (uploadingStockId !== null) return;
                    if (item.photo) {
                      Alert.alert(
                        'Fotoğraf İşlemleri',
                        'Ne yapmak istersiniz?',
                        [
                          { text: 'Yeniden Çek', onPress: () => handleTakePhoto(item.product.id) },
                          { text: 'Fotoğrafı Sil', onPress: () => handleRemovePhoto(item.product.id), style: 'destructive' },
                          { text: 'Vazgeç', style: 'cancel' }
                        ]
                      );
                    } else {
                      handleTakePhoto(item.product.id);
                    }
                  }}
                  disabled={uploadingStockId !== null}
                >
                  {uploadingStockId === item.product.id ? (
                    <View style={styles.photoPlaceholder}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                    </View>
                  ) : item.photo ? (
                    <Image source={{ uri: resolveImageUri(item.photo) }} style={styles.photoThumbnail} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <CustomIcon name="camera" size={18} color={Colors.outline} />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemCode}>
                    {item.product.stockCode || '-'}
                    {item.product.brand ? (
                      <> | <Text style={styles.listItemBrand}>{item.product.brand}</Text></>
                    ) : null}
                    {item.product.model ? ` | ${item.product.model}` : ''}
                  </Text>
                  <Text style={styles.listItemName}>{item.product.stockName}</Text>
                  {item.product.stockNameTr ? (
                    <Text style={styles.listItemNameTr}>{item.product.stockNameTr}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.qtyBadge}
                  onPress={() => {
                    setEditingItem(item);
                    setEditQtyStr(item.countedQty.toString());
                    setShowEditModal(true);
                  }}
                >
                  <Text style={styles.qtyBadgeText}>{item.countedQty}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleRemoveItem(item.product.id)}
                >
                  <CustomIcon name="trash-can-outline" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )}
          />

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Toplam Kalem:</Text>
              <Text style={styles.summaryValue}>{countedItems.length}</Text>
            </View>
            <TouchableOpacity
              style={[styles.submitButton, (countedItems.length === 0 || uploadingStockId !== null) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={countedItems.length === 0 || isSubmitting || uploadingStockId !== null}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Kaydediliyor...' : 'Sayımı Kaydet'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Miktar Düzenleme Modalı */}
      <Numpad
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingItem(null);
        }}
        onType={(val) => {
          if (val === '.' && editQtyStr.includes('.')) return;
          setEditQtyStr(prev => prev + val);
        }}
        onDelete={() => setEditQtyStr(prev => prev.slice(0, -1))}
        onSubmit={handleSaveEdit}
        submitLabel="MİKTARI KAYDET"
        submitColor={Colors.primary}
        title={editingItem?.product.stockName || 'Miktarı Düzenle'}
        value={editQtyStr}
      />


      {/* Sayım Fişi Seçim Modalı */}
      <Modal
        visible={showCycleCountModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCycleCountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Aktif Sayım Fişi Seçin</Text>
            <Text style={styles.modalSubTitle}>Sayıma devam etmek istediğiniz aktif bir fiş seçin:</Text>

            <FlatList
              data={cycleCounts}
              keyExtractor={(item) => item.id.toString()}
              style={{ maxHeight: 380, marginBottom: Spacing.md }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cycleCountItem}
                  onPress={() => {
                    setSelectedCycleCount(item);
                    setShowCycleCountModal(false);
                    showToast({ message: `Sayım fişi seçildi: ${item.documentNo}`, type: 'success' });
                  }}
                >
                  <CustomIcon name="clipboard-text-outline" size={24} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cycleCountItemDoc} numberOfLines={2}>
                      {item.remarks}
                    </Text>
                    <Text style={styles.cycleCountItemDesc}>
                      {item.warehouseName || `Depo ID: ${item.warehouseId}`} | {item.status || 'Aktif'}
                    </Text>
                    {item.countDate ? (
                      <Text style={styles.cycleCountItemDate}>
                        {formatDate(item.countDate)}
                      </Text>
                    ) : null}
                  </View>
                  <CustomIcon name="chevron-right" size={20} color={Colors.outline} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>Aktif sayım fişi bulunamadı.</Text>
              }
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCycleCountModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Kapat</Text>
              </TouchableOpacity>
            </View>
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
  photoContainer: {
    marginRight: 2,
  },
  photoThumbnail: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  photoPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  warehouseAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 58, 138, 0.05)',
    padding: Spacing.md,
    margin: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 138, 0.2)',
    gap: Spacing.md,
  },
  warehouseAlertLabel: {
    ...Typography.labelSm,
    color: Colors.primary,
    marginBottom: 2,
  },
  warehouseAlertName: {
    ...Typography.titleMd,
    color: Colors.onSurface,
  },
  scanContainer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  scanRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  barcodeInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingRight: Spacing.xs,
  },
  barcodeInput: {
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
  hint: {
    ...Typography.labelSm,
    color: Colors.outline,
    marginTop: 2,
  },
  listContent: {
    padding: Spacing.sm,
    gap: 6,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    ...Shadow.sm,
    gap: 8,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemCode: {
    fontSize: 10,
    color: Colors.outline,
  },
  listItemBrand: {
    fontWeight: '600',
    color: '#b85c00',
  },
  listItemName: {
    fontSize: 13,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  listItemNameTr: {
    fontSize: 12,
    color: '#1d4ed8',
    fontStyle: 'italic',
    marginTop: 1,
  },
  qtyBadge: {
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
    minWidth: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  qtyBadgeText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    opacity: 0.5,
  },
  emptyText: {
    ...Typography.bodyMd,
    marginTop: Spacing.sm,
  },
  footer: {
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    ...Shadow.nav,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  summaryValue: {
    ...Typography.titleMedium,
    color: Colors.primary,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: Colors.outline,
  },
  submitButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 8,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: 2,
  },
  modalSubTitle: {
    fontSize: 11,
    color: Colors.outline,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 56,
    ...Typography.titleLg,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  modalCancelButton: {
    padding: Spacing.md,
  },
  modalCancelText: {
    ...Typography.labelLg,
    color: Colors.outline,
  },
  modalSaveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalSaveText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  },
  cycleCountSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    gap: Spacing.md,
  },
  cycleCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    gap: 6,
  },
  cycleCountItemDoc: {
    fontSize: 13,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  cycleCountItemDesc: {
    fontSize: 10,
    color: Colors.outline,
    marginTop: 1,
  },
  emptyListText: {
    ...Typography.bodyLg,
    color: Colors.outline,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  newCountBtn: {
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  newCountBtnText: {
    ...Typography.labelLg,
    color: Colors.onSecondaryContainer,
    fontWeight: 'bold',
  },
  modalCancelBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    ...Typography.labelLg,
    color: Colors.outline,
  },
  cycleCountItemRemarks: {
    ...Typography.bodySm,
    color: Colors.primary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  cycleCountItemDate: {
    ...Typography.bodySm,
    color: Colors.outline,
    marginTop: 2,
  },
  noCountContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  noCountTitle: {
    ...Typography.titleLg,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  noCountText: {
    ...Typography.bodyLg,
    color: Colors.outline,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  selectCountBigBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  selectCountBigBtnText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  }
});
