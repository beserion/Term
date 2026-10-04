import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import {
  getOrderDetail,
  getSupplierOrderDetail,
  Order,
  OrderLine,
  saveOrderSupplierReceipt,
} from '../services/orders';
import { getStockByBarcode, getStocks, getShelfAddressForCode } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useBarcode } from '../hooks/useBarcode';
import { useSettingsStore } from '../store/settingsStore';
import { FeedbackService } from '../services/feedback';
import { ShipmentItemSkeleton } from '../components/skeletons/ShipmentItemSkeleton';
import { Badge } from '../components/Badge';
import { CameraScannerModal } from '../components/CameraScannerModal';

export function OrderDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orderId, supplierId, supplierName, documentNo, partnerName, rfqNo, vesselName } = route.params || {};

  const [detail, setDetail] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // Uyuşmazlık Modali States
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [discrepancyList, setDiscrepancyList] = useState<
    Array<{ name: string; ordered: number; received: number; type: 'missing' | 'extra' }>
  >([]);
  const [submitting, setSubmitting] = useState(false);

  // Hızlı miktar modalı (opsiyonel büyük tuş takımı veya tekli düzenleme için)
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<OrderLine | null>(null);
  const [modalQtyInput, setModalQtyInput] = useState('');

  const showToast = useUIStore((s) => s.showToast);
  const showErrorLock = useUIStore((s) => s.showErrorLock);
  const { activeWarehouseId } = useSettingsStore();

  const storageKey = `@order_receipt_${orderId}_${supplierId || 0}`;

  // Detay Verilerini Getir
  const fetchDetail = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = supplierId
        ? await getSupplierOrderDetail(orderId, supplierId)
        : await getOrderDetail(orderId);
      setDetail(data);

      if (data.lines) {
        // Telefon hafızasındaki (AsyncStorage) kayıtlı kabul miktarlarını yükle
        const savedDataStr = await AsyncStorage.getItem(storageKey);
        const savedMap = savedDataStr ? JSON.parse(savedDataStr) : {};

        // Sunucudan gelen zenginleştirilmiş satırları doğrudan eşle (N+1 döngüsü olmadan)
        const updatedLines = data.lines.map((line) => {
          const key = String(line.id);
          const pickedQty = savedMap[key] !== undefined ? savedMap[key] : (line.receivedQty || 0);
          return {
            ...line,
            pickedQty,
            isPicked: pickedQty === line.quantity && line.quantity > 0,
            shelfAddress: (line.shelfAddress && line.shelfAddress !== 'Tanımsız') ? line.shelfAddress : 'Tanımsız',
          };
        });
        setLines(updatedLines);

        // Eğer sunucudaki tüm satırlar zaten teslim alınmışsa tedarikçi bazında hafızaya işaretle
        const serverAllReceived = data.lines.length > 0 && data.lines.every((l) => (l.receivedQty || 0) >= l.quantity && l.quantity > 0);
        if (serverAllReceived) {
          AsyncStorage.setItem(`@order_receipt_completed_${orderId}_${supplierId || 0}`, 'true').catch(() => {});
        }
      }
    } catch {
      showToast({ message: 'Sipariş detayları yüklenemedi', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [orderId, supplierId, storageKey]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Yerel hafızaya miktar haritasını kaydet
  const persistLinesToStorage = async (updatedLines: OrderLine[]) => {
    try {
      const map: Record<string, number> = {};
      updatedLines.forEach((l) => {
        map[String(l.id)] = l.pickedQty || 0;
      });
      await AsyncStorage.setItem(storageKey, JSON.stringify(map));
    } catch (err) {
      console.error('AsyncStorage kaydetme hatası:', err);
    }
  };

  // Miktarı doğrudan güncelle
  const updateLineQty = (lineId: number, newQty: number) => {
    const validQty = Math.max(0, isNaN(newQty) ? 0 : newQty);
    setLines((prev) => {
      const updated = prev.map((line) => {
        if (line.id === lineId) {
          return {
            ...line,
            pickedQty: validQty,
            isPicked: validQty === line.quantity,
          };
        }
        return line;
      });
      persistLinesToStorage(updated);
      return updated;
    });
  };

  // Tüm satırların miktarını tek dokunuşla sipariş miktarına eşitle
  const handleFillAll = () => {
    Alert.alert(
      'Tümünü Doldur',
      'Tüm ürünlerin gelen miktarları beklenen sipariş miktarına eşitlensin mi?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, Doldur',
          onPress: () => {
            setLines((prev) => {
              const updated = prev.map((line) => ({
                ...line,
                pickedQty: line.quantity,
                isPicked: true,
              }));
              persistLinesToStorage(updated);
              return updated;
            });
            FeedbackService.playSuccess();
            showToast({ message: 'Tüm ürünler tam miktar olarak işaretlendi.', type: 'success' });
          },
        },
      ]
    );
  };

  // Sıfırla
  const handleResetAll = () => {
    Alert.alert(
      'Miktarları Sıfırla',
      'Girilen tüm gelen miktarlar sıfırlanacak. Emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(storageKey);
              setLines((prev) =>
                prev.map((line) => ({
                  ...line,
                  pickedQty: 0,
                  isPicked: false,
                }))
              );
              FeedbackService.playLightImpact();
              showToast({ message: 'Gelen miktarlar sıfırlandı.', type: 'info' });
            } catch (err) {
              console.error('Sıfırlama hatası:', err);
            }
          },
        },
      ]
    );
  };

  // Barkod Okutma
  const handleScan = async (scannedCode: string) => {
    if (!scannedCode || !lines || lines.length === 0) return;
    const cleanCode = scannedCode.trim();

    // 1. Yerel satırlarda ara (stockCode, stockId veya barkod)
    let matchedIndex = lines.findIndex(
      (l) =>
        (l.stockCode && l.stockCode.toLowerCase() === cleanCode.toLowerCase()) ||
        String(l.stockId) === cleanCode
    );

    // 2. Bulunamazsa API barkod sorgusundan ara
    if (matchedIndex === -1) {
      try {
        const stockData = await getStockByBarcode(cleanCode);
        if (stockData && stockData.stockCode) {
          const sc = stockData.stockCode.toLowerCase();
          matchedIndex = lines.findIndex(
            (l) => l.stockCode && l.stockCode.toLowerCase() === sc
          );
        }
      } catch {
        // Yok say
      }
    }

    if (matchedIndex !== -1) {
      const line = lines[matchedIndex];
      const currentQty = line.pickedQty || 0;
      const nextQty = currentQty + 1;
      updateLineQty(line.id, nextQty);
      FeedbackService.playSuccess();
      showToast({
        message: `${line.stockName}: +1 eklendi (${nextQty}/${line.quantity})`,
        type: 'success',
      });
    } else {
      FeedbackService.playError();
      showErrorLock('Okutulan barkod bu tedarikçinin sipariş kalemlerinde bulunamadı!');
    }
  };

  useBarcode(handleScan);

  useEffect(() => {
    if (barcode.trim().length >= 4) {
      const timeout = setTimeout(() => {
        handleScan(barcode.trim());
        setBarcode('');
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [barcode]);

  // Mal Kabulü Kaydetme İşlemi
  const handleSaveReceipt = () => {
    if (isAlreadyFullyReceived) {
      Alert.alert(
        'Mal Kabul Tamamlandı',
        'Bu tedarikçiye ait tüm ürünlerin mal kabulü daha önce tamamlanmıştır. Tekrar mal kabul fişi oluşturulamaz.',
        [{ text: 'Tamam', onPress: () => navigation.goBack() }]
      );
      return;
    }

    if (!activeWarehouseId) {
      showToast({ message: 'Lütfen ayarlardan aktif terminal deposunu seçin', type: 'error' });
      return;
    }

    const totalReceived = lines.reduce((acc, l) => acc + (l.pickedQty || 0), 0);
    if (totalReceived === 0) {
      showToast({ message: 'Lütfen en az bir ürün için gelen miktar giriniz.', type: 'info' });
      return;
    }

    // Uyuşmazlık kontrolü
    const discrepancies: typeof discrepancyList = [];
    lines.forEach((line) => {
      const received = line.pickedQty || 0;
      const ordered = line.quantity;
      if (received < ordered) {
        discrepancies.push({
          name: line.stockName,
          ordered,
          received,
          type: 'missing',
        });
      } else if (received > ordered) {
        discrepancies.push({
          name: line.stockName,
          ordered,
          received,
          type: 'extra',
        });
      }
    });

    if (discrepancies.length > 0) {
      setDiscrepancyList(discrepancies);
      setShowDiscrepancyModal(true);
    } else {
      executeSaveReceipt();
    }
  };

  const executeSaveReceipt = async () => {
    setShowDiscrepancyModal(false);
    setSubmitting(true);
    try {
      const payload = {
        orderId: Number(orderId),
        supplierId: Number(supplierId),
        warehouseId: Number(activeWarehouseId),
        remarks: 'Terminal Mal Kabul Fişi',
        lines: lines
          .filter((line) => (line.pickedQty || 0) > 0)
          .map((line) => ({
            orderDetailId: Number(line.id),
            receivedQty: Number(line.pickedQty),
          })),
      };

      await saveOrderSupplierReceipt(payload);

      // Başarılı kayıttan sonra yerel hafızayı temizle ve yalnızca ilgili tedarikçi için mal kabul yapıldı olarak işaretle
      await AsyncStorage.removeItem(storageKey);
      await AsyncStorage.setItem(`@order_receipt_completed_${orderId}_${supplierId || 0}`, 'true');
      await AsyncStorage.removeItem(`@order_receipt_completed_${orderId}`).catch(() => {});

      showToast({ message: 'Mal kabul işlemi başarıyla kaydedildi.', type: 'success' });
      FeedbackService.playSuccess();
      navigation.goBack();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Mal kabul kaydedilemedi.';
      showToast({ message: msg, type: 'error' });
      FeedbackService.playError();
    } finally {
      setSubmitting(false);
    }
  };

  // İstatistikler
  const totalOrdered = lines.reduce((acc, l) => acc + l.quantity, 0);
  const totalReceived = lines.reduce((acc, l) => acc + (l.pickedQty || 0), 0);
  const completedLinesCount = lines.filter((l) => (l.pickedQty || 0) >= l.quantity && l.quantity > 0).length;
  const isAllComplete = lines.length > 0 && completedLinesCount === lines.length;
  const isAlreadyFullyReceived = lines.length > 0 && lines.every((l) => (l.receivedQty || 0) >= l.quantity && l.quantity > 0);

  const renderItem = ({ item }: { item: OrderLine }) => {
    const received = item.pickedQty || 0;
    const ordered = item.quantity;

    let cardBorderColor: string = Colors.outlineVariant;
    let cardBgColor: string = Colors.surface;
    let statusLabel = 'Bekliyor';
    let statusType: 'primary' | 'success' | 'warning' | 'error' = 'primary';

    if (received > 0) {
      if (received === ordered) {
        cardBorderColor = Colors.success;
        cardBgColor = '#F2F9F4';
        statusLabel = 'Tam Kabul';
        statusType = 'success';
      } else if (received < ordered) {
        cardBorderColor = Colors.warning;
        cardBgColor = '#FFFBF2';
        statusLabel = 'Kısmi Kabul';
        statusType = 'warning';
      } else {
        cardBorderColor = Colors.secondary;
        cardBgColor = '#F4F5FB';
        statusLabel = 'Fazla Kabul';
        statusType = 'primary';
      }
    }

    return (
      <View style={[styles.itemCard, { borderColor: cardBorderColor, backgroundColor: cardBgColor }]}>
        {/* Ürün Üst Bilgi Satırı */}
        <View style={styles.itemHeader}>
          <View style={styles.codeAndShelfRow}>
            <Text style={styles.stockCode}>{item.stockCode || 'KOD YOK'}</Text>
            {(() => {
              const hasShelf = !!(item.shelfAddress && item.shelfAddress.trim() && item.shelfAddress.trim() !== 'Tanımsız');
              const shelfVal = hasShelf ? item.shelfAddress!.trim() : 'Tanımsız';
              return (
                <View style={[styles.shelfTag, hasShelf ? styles.shelfTagActive : styles.shelfTagEmpty]}>
                  <CustomIcon
                    name="map-marker-outline"
                    size={12}
                    color={hasShelf ? '#047857' : '#6B7280'}
                  />
                  <Text style={[styles.shelfTagBold, hasShelf ? styles.shelfTagTextActive : styles.shelfTagTextEmpty]}>
                    Raf: {shelfVal}
                  </Text>
                </View>
              );
            })()}
          </View>
          <Badge label={statusLabel} type={statusType} />
        </View>

        {/* Ürün Adı - Kartın Tam Genişliğinde */}
        <Text style={styles.stockName}>{item.stockName}</Text>
        {item.stockNameTr && item.stockNameTr.toLowerCase().trim() !== item.stockName.toLowerCase().trim() ? (
          <Text style={styles.stockNameTr}>{item.stockNameTr}</Text>
        ) : null}
        {(item.brand || item.model) ? (
          <View style={styles.brandModelRow}>
            {item.brand ? (
              <Text style={styles.brandText}>Marka: <Text style={styles.brandValue}>{item.brand}</Text></Text>
            ) : null}
            {item.model ? (
              <Text style={styles.brandText}>Model: <Text style={styles.brandValue}>{item.model}</Text></Text>
            ) : null}
          </View>
        ) : null}

        {/* Sipariş ve Miktar Düzenleme Alanı */}
        <View style={styles.itemActionRow}>
          <View style={styles.expectedBox}>
            <Text style={styles.expectedLabel}>Sipariş Edilen</Text>
            <Text style={styles.expectedValue}>
              {ordered} <Text style={styles.unitText}>{item.unit || 'Adet'}</Text>
            </Text>
          </View>

          {/* Hızlı Miktar Girişi / Stepper */}
          <View style={styles.stepperContainer}>
            <Text style={styles.stepperLabel}>Gelen Miktar</Text>
            <View style={styles.stepperControls}>
              <TouchableOpacity
                style={[styles.stepBtn, received <= 0 && styles.stepBtnDisabled]}
                onPress={() => updateLineQty(item.id, received - 1)}
                disabled={received <= 0}
                activeOpacity={0.7}
              >
                <CustomIcon name="minus" size={18} color={received > 0 ? Colors.primary : Colors.outline} />
              </TouchableOpacity>

              <TextInput
                style={styles.qtyInput}
                keyboardType="numeric"
                value={String(received)}
                onChangeText={(val) => {
                  const num = parseInt(val, 10);
                  updateLineQty(item.id, isNaN(num) ? 0 : num);
                }}
                selectTextOnFocus={true}
              />

              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => updateLineQty(item.id, received + 1)}
                activeOpacity={0.7}
              >
                <CustomIcon name="plus" size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Hızlı Aksiyon: Tamamı Geldi Butonu */}
        <View style={styles.itemFooterRow}>
          <TouchableOpacity
            style={[styles.quickFillBtn, received === ordered && styles.quickFillBtnActive]}
            onPress={() => updateLineQty(item.id, ordered)}
            activeOpacity={0.7}
          >
            <CustomIcon
              name={received === ordered ? 'check-circle' : 'clipboard-check-outline'}
              size={16}
              color={received === ordered ? Colors.success : Colors.primary}
            />
            <Text style={[styles.quickFillText, received === ordered && { color: Colors.success }]}>
              {received === ordered ? 'Tamamı Alındı' : `Tamamı Geldi (${ordered} ${item.unit || 'Adet'})`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TopAppBar
        title={documentNo ? `Mal Kabul: ${documentNo}` : 'Mal Kabul Girişi'}
        onBack={() => navigation.goBack()}
        showBack={true}
        actionIcon="trash-can-outline"
        onAction={handleResetAll}
      />

      {/* Üst Bilgi Kartı */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.supplierBadge}>
            <CustomIcon name="storefront" size={16} color={Colors.primary} />
            <Text style={styles.supplierText} numberOfLines={1}>
              {supplierName || detail?.partnerName || 'Tedarikçi'}
            </Text>
          </View>
          <Badge
            label={isAllComplete ? 'TAMAMLANDI' : 'KABUL BEKLİYOR'}
            type={isAllComplete ? 'success' : 'warning'}
            icon={isAllComplete ? 'check-circle' : 'progress-clock'}
          />
        </View>

        {(vesselName || rfqNo) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {vesselName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CustomIcon name="ship" size={14} color={Colors.primary} />
                <Text style={{ ...Typography.bodySm, color: Colors.primary, fontWeight: '600' }} numberOfLines={1}>
                  {vesselName}
                </Text>
              </View>
            ) : null}
            {rfqNo ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CustomIcon name="clipboard-list-outline" size={14} color={Colors.outline} />
                <Text style={{ ...Typography.bodySm, color: Colors.outline }}>
                  RFQ: <Text style={{ fontWeight: '600', color: Colors.onSurface }}>{rfqNo}</Text>
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Kalem Durumu</Text>
            <Text style={styles.statValue}>
              {completedLinesCount} / {lines.length} Kalem
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Toplam Miktar</Text>
            <Text style={styles.statValue}>
              {totalReceived} / {totalOrdered} Adet
            </Text>
          </View>
        </View>

        {/* Hızlı Aksiyon Çubuğu */}
        <View style={styles.quickActionRow}>
          <TouchableOpacity style={styles.bulkFillBtn} onPress={handleFillAll} activeOpacity={0.8}>
            <CustomIcon name="clipboard-check-outline" size={16} color={Colors.onSecondaryContainer} />
            <Text style={styles.bulkFillText}>Tümünü Sipariş Kadar Doldur</Text>
          </TouchableOpacity>
        </View>

        {/* Barkod Okuma Satırı */}
        <View style={styles.scanRow}>
          <TextInput
            style={styles.barcodeInput}
            placeholder="Ürün barkodunu okutun veya yazın..."
            placeholderTextColor={Colors.outline}
            value={barcode}
            onChangeText={setBarcode}
            onSubmitEditing={() => {
              if (barcode.trim()) {
                handleScan(barcode.trim());
                setBarcode('');
              }
            }}
            returnKeyType="search"
            showSoftInputOnFocus={true}
          />
          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={() => setShowCameraScanner(true)}
            activeOpacity={0.7}
          >
            <CustomIcon name="camera" size={20} color={Colors.onSecondaryContainer} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.scanSubmitBtn}
            onPress={() => {
              if (barcode.trim()) {
                handleScan(barcode.trim());
                setBarcode('');
              }
            }}
            activeOpacity={0.7}
          >
            <CustomIcon name="barcode-scan" size={20} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Ürün Listesi */}
      {refreshing && lines.length === 0 ? (
        <FlatList
          data={[1, 2, 3, 4]}
          renderItem={() => <ShipmentItemSkeleton />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={lines}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchDetail} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            !refreshing ? (
              <View style={styles.emptyContainer}>
                <CustomIcon name="package-variant-closed" size={48} color={Colors.outline} />
                <Text style={styles.emptyText}>Bu tedarikçiye ait ürün kalemi bulunamadı.</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Alt Kaydet Butonu */}
      <View style={styles.footer}>
        <View style={styles.footerSummary}>
          <Text style={styles.footerSummaryLabel}>Toplam Gelen:</Text>
          <Text style={styles.footerSummaryValue}>
            {totalReceived} <Text style={styles.footerSummaryTotal}>/ {totalOrdered}</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            totalReceived === 0 && !isAlreadyFullyReceived && styles.saveBtnDisabled,
            isAlreadyFullyReceived && { backgroundColor: Colors.success },
          ]}
          onPress={isAlreadyFullyReceived ? () => navigation.goBack() : handleSaveReceipt}
          disabled={(totalReceived === 0 && !isAlreadyFullyReceived) || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.onPrimary} />
          ) : (
            <View style={styles.saveBtnContent}>
              <CustomIcon name={isAlreadyFullyReceived ? "check-circle" : "content-save"} size={20} color={Colors.onPrimary} />
              <Text style={styles.saveBtnText}>
                {isAlreadyFullyReceived ? "Mal Kabul Tamamlandı (Geri Dön)" : "Mal Kabulü Kaydet"}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Miktar Uyuşmazlığı Uyarı Modalı */}
      <Modal
        visible={showDiscrepancyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDiscrepancyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.discrepancyModalContent}>
            <View style={styles.discrepancyHeader}>
              <CustomIcon name="alert-circle-outline" size={26} color={Colors.warning} />
              <Text style={styles.discrepancyTitle}>Miktar Uyuşmazlığı Bildirimi</Text>
            </View>
            <Text style={styles.discrepancySubtitle}>
              Sipariş edilen miktarlar ile kabul edilen miktarlar arasında farklar var. Devam edilsin mi?
            </Text>

            <FlatList
              data={discrepancyList}
              keyExtractor={(_, idx) => String(idx)}
              style={styles.discrepancyList}
              renderItem={({ item }) => (
                <View style={styles.discrepancyItem}>
                  <Text style={styles.discrepancyItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.discrepancyItemQtyBox}>
                    <Text style={styles.discrepancyItemQty}>
                      {item.received} / {item.ordered}
                    </Text>
                    <Badge
                      label={item.type === 'missing' ? 'EKSİK' : 'FAZLA'}
                      type={item.type === 'missing' ? 'error' : 'warning'}
                    />
                  </View>
                </View>
              )}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowDiscrepancyModal(false)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Geri Dön ve Düzelt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, { backgroundColor: Colors.warning }]}
                onPress={executeSaveReceipt}
                disabled={submitting}
              >
                <Text style={styles.modalSaveText}>Yine de Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CameraScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={(scannedCode) => {
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
  headerCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    ...Shadow.sm,
    gap: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supplierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: Spacing.sm,
  },
  supplierText: {
    color: Colors.onSurface,
    fontWeight: 'bold',
    fontSize: 13.5,
    includeFontPadding: false,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.outlineVariant,
  },
  statLabel: {
    fontSize: 10.5,
    color: Colors.outline,
    fontWeight: '600',
    includeFontPadding: false,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: 'bold',
    marginTop: 2,
    includeFontPadding: false,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bulkFillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.secondaryContainer,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
  },
  bulkFillText: {
    ...Typography.labelMedium,
    color: Colors.onSecondaryContainer,
    fontWeight: 'bold',
  },
  scanRow: {
    flexDirection: 'row',
    gap: 6,
  },
  barcodeInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    height: 40,
    fontSize: 13,
    color: Colors.onSurface,
  },
  cameraBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanSubmitBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: Spacing.marginMobile,
    paddingBottom: 110,
  },
  itemCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    ...Shadow.sm,
    gap: Spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  codeAndShelfRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  shelfTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  shelfTagActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  shelfTagEmpty: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  shelfTagBold: {
    fontWeight: 'bold',
    fontSize: 11,
    includeFontPadding: false,
  },
  shelfTagTextActive: {
    color: '#047857',
  },
  shelfTagTextEmpty: {
    color: '#6B7280',
  },
  stockCode: {
    ...Typography.dataMono,
    fontSize: 11,
    color: Colors.primary,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  stockName: {
    fontSize: 13.5,
    lineHeight: 18,
    color: Colors.onSurface,
    fontWeight: '700',
    marginTop: 2,
    includeFontPadding: false,
    width: '100%',
  },
  stockNameTr: {
    fontSize: 12,
    color: '#0D9488',
    fontStyle: 'italic',
    width: '100%',
    marginTop: 1,
  },
  brandModelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  brandText: {
    fontSize: 11,
    color: Colors.outline,
  },
  brandValue: {
    fontWeight: '600',
    color: Colors.onSurface,
  },
  itemActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  expectedBox: {
    flex: 1,
  },
  expectedLabel: {
    fontSize: 10.5,
    color: Colors.outline,
    includeFontPadding: false,
  },
  expectedValue: {
    fontSize: 13.5,
    color: Colors.onSurface,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  unitText: {
    fontSize: 11,
    fontWeight: 'normal',
    color: Colors.outline,
    includeFontPadding: false,
  },
  stepperContainer: {
    alignItems: 'flex-end',
  },
  stepperLabel: {
    fontSize: 10.5,
    color: Colors.outline,
    marginBottom: 4,
    includeFontPadding: false,
    paddingHorizontal: 4,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    height: 38,
  },
  stepBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.3,
  },
  qtyInput: {
    width: 54,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.primary,
    padding: 0,
    includeFontPadding: false,
  },
  itemFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: Spacing.xs,
  },
  quickFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.xs,
    backgroundColor: 'rgba(30, 58, 138, 0.06)',
  },
  quickFillBtnActive: {
    backgroundColor: 'rgba(52, 168, 83, 0.1)',
  },
  quickFillText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 11,
    includeFontPadding: false,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...Typography.bodyMd,
    color: Colors.outline,
    marginTop: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.marginMobile,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadow.card,
  },
  footerSummary: {
    marginRight: Spacing.md,
  },
  footerSummaryLabel: {
    fontSize: 10.5,
    color: Colors.outline,
    includeFontPadding: false,
    paddingHorizontal: 4,
  },
  footerSummaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    includeFontPadding: false,
  },
  footerSummaryTotal: {
    fontSize: 12,
    color: Colors.outline,
    fontWeight: 'normal',
    includeFontPadding: false,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: Colors.outlineVariant,
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontSize: 13.5,
    color: Colors.onPrimary,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  discrepancyModalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  discrepancyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.xs,
  },
  discrepancyTitle: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  discrepancySubtitle: {
    ...Typography.bodyMd,
    color: Colors.outline,
    marginBottom: Spacing.md,
  },
  discrepancyList: {
    maxHeight: 200,
    marginVertical: Spacing.sm,
  },
  discrepancyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  discrepancyItemName: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    flex: 1,
    marginRight: 8,
  },
  discrepancyItemQtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discrepancyItemQty: {
    ...Typography.bodyMd,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    ...Typography.labelMedium,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    ...Typography.labelMedium,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
