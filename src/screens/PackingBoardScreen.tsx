import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { TopAppBar } from '../components/TopAppBar';
import { CustomIcon } from '../components/CustomIcon';
import { Colors, Spacing, Typography, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { FeedbackService } from '../services/feedback';
import { useUIStore } from '../store/uiStore';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { Badge } from '../components/Badge';
import {
  getSupplierOrderDetail,
  getOrderDetail,
  OrderLine,
} from '../services/orders';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStockByBarcode, getStocks, getShelfAddressForCode, getStockDetailsForCode } from '../services/inventory';
import {
  getPackingBoardData,
  createBox,
  createPallet,
  assignItemToBoxOrPallet,
  assignItemsBulk,
  completeSupplierPacking,
  savePackingSupplierStatus,
  WMS_PackingBoardVM,
  WMS_BoxVM,
  WMS_PalletVM,
  WMS_PackingLineVM,
  isWarehouseSupplier,
} from '../services/packing';
import { useSettingsStore } from '../store/settingsStore';
import { printBoxLabel, PrintBoxItem } from '../services/printHelper';

interface PackingLineItem {
  id: number;
  orderDetailId: number;
  stockCode: string;
  stockName: string;
  stockNameTr?: string;
  brand?: string;
  model?: string;
  impaCode?: string;
  unit: string;
  orderedQty: number;
  pickedQty: number;
  alreadyPackedQty?: number;
  isFullyPacked?: boolean;
  shelfAddress?: string;
}

export function PackingBoardScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const showToast = useUIStore((s) => s.showToast);
  const showErrorLock = useUIStore((s) => s.showErrorLock);

  const {
    requestId,
    orderId,
    documentNo,
    partnerName,
    rfqNo,
    vesselName,
    supplierId,
    supplierName,
    isReceiptCompleted: routeReceiptCompleted,
    isPackingCompleted: routePackingCompleted,
  } = route.params || {};

  const [isReceiptDone, setIsReceiptDone] = useState<boolean>(routeReceiptCompleted !== false || !!routePackingCompleted);

  const activeWarehouseName = useSettingsStore((s) => s.activeWarehouseName);

  // Firmanın kendi aktif depo ürünleri tespiti (Gemini veya ayarlardaki aktif depo):
  // Seçili tedarikçi firmanın kendi aktif deposu olduğunda barkod okutma zorunludur.
  // Harici tedarikçiler için barkod zorunlu değildir.
  const isGemini = useMemo(() => {
    const targetName = supplierName || partnerName || '';
    return isWarehouseSupplier(targetName, activeWarehouseName);
  }, [supplierName, partnerName, activeWarehouseName]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [boardData, setBoardData] = useState<WMS_PackingBoardVM | null>(null);
  const [lines, setLines] = useState<PackingLineItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Barkod Okutulan Ürün ve Adet Giriş Modalı State'i
  const [scannedLineItem, setScannedLineItem] = useState<PackingLineItem | null>(null);
  const [packQtyInput, setPackQtyInput] = useState<string>('1');

  // Hedef Koli / Palet
  const [selectedTarget, setSelectedTarget] = useState<{
    type: 'box' | 'pallet';
    id: number;
    name: string;
  } | null>(null);
  const [targetModalVisible, setTargetModalVisible] = useState(false);

  // Yeni Koli Modali
  const [newBoxModalVisible, setNewBoxModalVisible] = useState(false);
  const [newBoxNameInput, setNewBoxNameInput] = useState('');

  // Yeni Palet Modali
  const [newPalletModalVisible, setNewPalletModalVisible] = useState(false);
  const [newPalletNameInput, setNewPalletNameInput] = useState('');

  // Yerel hafızaya paketleme durumunu kaydetme fonksiyonu
  const persistPackingState = async (updatedLines: PackingLineItem[]) => {
    try {
      const targetOId = Number(orderId || requestId);
      const sId = Number(supplierId || 0);
      const map: Record<string, number> = {};
      let fullyDoneCount = 0;
      let totalPackedQty = 0;
      let totalOrderedQty = 0;

      updatedLines.forEach((l) => {
        const codeKey = (l.stockCode || '').trim().toLowerCase();
        map[codeKey] = l.pickedQty || 0;
        map[String(l.id)] = l.pickedQty || 0;
        totalPackedQty += (l.alreadyPackedQty || 0) + (l.pickedQty || 0);
        totalOrderedQty += l.orderedQty;
        if ((l.alreadyPackedQty || 0) + (l.pickedQty || 0) >= l.orderedQty && l.orderedQty > 0) {
          fullyDoneCount++;
        }
      });

      const isAllDone = updatedLines.length > 0 && fullyDoneCount === updatedLines.length;

      await AsyncStorage.setItem(`@packing_state_${targetOId}_${sId}`, JSON.stringify(map));
      await savePackingSupplierStatus(targetOId, sId, {
        isCompleted: isAllDone,
        packedCount: fullyDoneCount,
        totalCount: updatedLines.length,
        packedQty: totalPackedQty,
        totalQty: totalOrderedQty,
        lineQuantities: map,
      });
    } catch (e) {
      console.error('Error persisting packing state:', e);
    }
  };

  // Verileri Yükle
  const fetchPackingData = useCallback(async () => {
    try {
      setRefreshing(true);
      const targetReqId = Number(requestId || orderId);
      const targetOId = Number(orderId || requestId);

      // 1. Tedarikçi kalemlerini Mal Kabul ile birebir aynı servisten çek
      let loadedLines: OrderLine[] = [];
      if (supplierId && targetOId) {
        try {
          const supplierOrder = await getSupplierOrderDetail(targetOId, Number(supplierId));
          if (supplierOrder?.lines && supplierOrder.lines.length > 0) {
            loadedLines = supplierOrder.lines;
          }
        } catch (e) {
          console.log('Supplier details fetch error:', e);
        }
      }

      // Tedarikçiye özel bulunamadıysa genel sipariş kalemlerini dene
      if (loadedLines.length === 0 && targetOId) {
        try {
          const generalOrder = await getOrderDetail(targetOId);
          if (generalOrder?.lines && generalOrder.lines.length > 0) {
            loadedLines = generalOrder.lines;
          }
        } catch (e) {
          console.log('General order fetch error:', e);
        }
      }

      // 2. Koli / Palet Yapısını Güvenli Çek
      let fetchedBoardData: WMS_PackingBoardVM | null = null;
      try {
        const bData = await getPackingBoardData(targetReqId);
        setBoardData(bData);
        fetchedBoardData = bData;

        let activeBox = bData.boxes && bData.boxes.length > 0 ? bData.boxes[0] : null;
        if (!activeBox && (!bData.pallets || bData.pallets.length === 0)) {
          try {
            const createRes = await createBox({ requestId: targetReqId, boxName: 'Koli-1' });
            const createdBoxId = createRes.boxId || createRes.data?.id || createRes.id || 1;
            activeBox = {
              id: createdBoxId,
              boxName: 'Koli-1',
              grossWeight: 5,
              dimensions: '40x30x30 cm',
              lines: [],
              itemCount: 0,
            };
            if (!bData.boxes) bData.boxes = [];
            bData.boxes.push(activeBox);
          } catch {
            // ignore
          }
        }

        if (activeBox) {
          setSelectedTarget((prev) => prev || {
            type: 'box',
            id: activeBox.id,
            name: activeBox.boxName || 'Koli-1',
          });
        } else if (bData.pallets && bData.pallets.length > 0) {
          const firstPallet = bData.pallets[0];
          setSelectedTarget((prev) => prev || {
            type: 'pallet',
            id: firstPallet.id,
            name: firstPallet.vesselName || `Palet-${firstPallet.id}`,
          });
        }
      } catch (boardErr) {
        console.log('Board data fetch error:', boardErr);
        setSelectedTarget((prev) => prev || {
          type: 'box',
          id: 1,
          name: 'Koli-1',
        });
      }

      // Koli ve paletlerde daha önce paketlenmiş tüm kalemleri tespit et
      const allPackedItems: WMS_PackingLineVM[] = [];
      if (fetchedBoardData?.boxes) {
        for (const b of fetchedBoardData.boxes) {
          if (b.items) allPackedItems.push(...b.items);
          if (b.lines) allPackedItems.push(...b.lines);
        }
      }
      if (fetchedBoardData?.pallets) {
        for (const p of fetchedBoardData.pallets) {
          if (p.boxes) {
            for (const pb of p.boxes) {
              if (pb.items) allPackedItems.push(...pb.items);
              if (pb.lines) allPackedItems.push(...pb.lines);
            }
          }
          if (p.items) allPackedItems.push(...p.items);
          if (p.lines) allPackedItems.push(...p.lines);
        }
      }

      // Mal Kabul Durumunu Kesinleştir
      let isReceiptDoneCalculated = routeReceiptCompleted !== false;
      try {
        const rSupFlag = await AsyncStorage.getItem(`@order_receipt_completed_${targetOId}_${supplierId}`);
        if (rSupFlag === 'true') {
          isReceiptDoneCalculated = true;
        }
      } catch {
        // ignore
      }
      // Eğer tedarikçi paketlenmiş olarak geldiyse veya Gemini firması ise mal kabul tamamdır
      if (routePackingCompleted || isGemini) {
        isReceiptDoneCalculated = true;
      }
      setIsReceiptDone(isReceiptDoneCalculated);

      // Telefon hafızasındaki (AsyncStorage) kayıtlı paketleme miktarlarını yükle
      const storageKey = `@packing_state_${targetOId}_${supplierId}`;
      let savedMap: Record<string, number> = {};
      try {
        const savedStr = await AsyncStorage.getItem(storageKey);
        if (savedStr) savedMap = JSON.parse(savedStr);
      } catch {
        // ignore
      }

      // 3. Kalemleri Formatla, Türkçe Adı, Marka, Model ve Raf Adreslerini Eşle
      const finalLines: PackingLineItem[] = loadedLines.map((l, idx) => {
        const sCode = (l.stockCode || '').trim();
        const sCodeLower = sCode.toLowerCase();
        const orderedQty = Number(l.quantity || 1);
        const cleanShelf = (l.shelfAddress && l.shelfAddress !== 'Tanımsız') ? String(l.shelfAddress).trim() : 'Tanımsız';

        const stockNameTr = l.stockNameTr;
        const brand = l.brand;
        const model = l.model;

        // Bu ürünün kolilerde ve paletlerde daha önce paketlenmiş miktarını bul
        const alreadyPacked = allPackedItems
          .filter((p: any) =>
            (p.orderDetailId && Number(p.orderDetailId) === Number(l.id)) ||
            (p.stockCode && p.stockCode.trim().toLowerCase() === sCodeLower)
          )
          .reduce((sum: number, p: any) => sum + Number(p.qty || 0), 0);

          let currentPicked = alreadyPacked >= orderedQty && orderedQty > 0 ? orderedQty : Math.min(orderedQty, alreadyPacked);

          // Yerel hafızadaki kayıtlı miktarı yükle (sayfadan çıkıp tekrar gelindiğinde sıfırlanmaması için)
          const savedQty = savedMap[sCodeLower] !== undefined ? savedMap[sCodeLower] : savedMap[String(l.id)];
          if (savedQty !== undefined && savedQty > 0) {
            currentPicked = Math.min(orderedQty, Math.max(currentPicked, savedQty));
          } else if (routePackingCompleted && currentPicked === 0) {
            // Tedarikçi paketlenmiş olarak açıldıysa ve yerel hafızada henüz kayıt yoksa sipariş kadar dolu göster
            currentPicked = orderedQty;
          }

          const isFullyPacked = (alreadyPacked + currentPicked) >= orderedQty && orderedQty > 0 || !!routePackingCompleted;

        return {
          id: l.id || idx + 1,
          orderDetailId: l.id || idx + 1,
          stockCode: sCode || 'KOD YOK',
          impaCode: l.impaCode,
          stockName: l.stockName || 'Ürün Adı Yok',
          stockNameTr,
          brand,
          model,
          unit: l.unit || 'PCS',
          orderedQty,
          pickedQty: currentPicked,
          alreadyPackedQty: alreadyPacked,
          isFullyPacked,
          shelfAddress: cleanShelf || 'Tanımsız',
        };
      });

      setLines(finalLines);
    } catch (err: any) {
      showToast({ message: err?.message || 'Ürün kalemleri yüklenemedi', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId, orderId, supplierId, routeReceiptCompleted, routePackingCompleted]);

  useEffect(() => {
    fetchPackingData();
  }, [fetchPackingData]);

  // Yeni Koli Oluşturma
  const handleCreateNewBox = async () => {
    const boxName = newBoxNameInput.trim() || `Koli-${(boardData?.boxes?.length || 0) + 1}`;
    try {
      setSubmitting(true);
      const targetReqId = Number(requestId || orderId);
      const res = await createBox({ requestId: targetReqId, boxName });
      const newBoxId = res.boxId || res.data?.id || res.id || Date.now();

      // Sunucudan güncel koli listesini hemen yeniden çek
      let freshBoxes: WMS_BoxVM[] = [];
      try {
        const freshBoard = await getPackingBoardData(targetReqId);
        setBoardData(freshBoard);
        freshBoxes = freshBoard.boxes || [];
      } catch {
        const fallbackBox: WMS_BoxVM = {
          id: newBoxId,
          requestId: targetReqId,
          boxName,
          grossWeight: 5,
          dimensions: '40x30x30 cm',
          lines: [],
          itemCount: 0,
        };
        setBoardData((prev) => {
          const currentBoxes = prev?.boxes || [];
          return {
            requestId: targetReqId,
            pendingItems: prev?.pendingItems || [],
            pallets: prev?.pallets || [],
            ...prev,
            boxes: [...currentBoxes, fallbackBox],
          };
        });
        freshBoxes = [fallbackBox];
      }

      // Yeni oluşturulan koliyi hedef olarak seç
      const foundBox = freshBoxes.find((b) => b.boxName === boxName) || { id: newBoxId, boxName };
      setSelectedTarget({ type: 'box', id: foundBox.id, name: foundBox.boxName });
      setNewBoxModalVisible(false);
      setNewBoxNameInput('');
      FeedbackService.playSuccess();
      showToast({ message: `${boxName} oluşturuldu ve hedef seçildi.`, type: 'success' });
    } catch (err: any) {
      showToast({ message: err?.message || 'Koli oluşturulamadı', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Yeni Palet Oluşturma
  const handleCreateNewPallet = async () => {
    const palletName = newPalletNameInput.trim() || `Palet-${(boardData?.pallets?.length || 0) + 1}`;
    try {
      setSubmitting(true);
      const targetReqId = Number(requestId || orderId);
      const res = await createPallet({ requestId: targetReqId, vesselName: palletName });
      const newPalletId = res.palletId || res.data?.id || res.id || Date.now();

      // Sunucudan güncel palet listesini hemen yeniden çek
      let freshPallets: WMS_PalletVM[] = [];
      try {
        const freshBoard = await getPackingBoardData(targetReqId);
        setBoardData(freshBoard);
        freshPallets = freshBoard.pallets || [];
      } catch {
        const fallbackPallet: WMS_PalletVM = {
          id: newPalletId,
          requestId: targetReqId,
          vesselName: palletName,
          dimensions: '120x80x150 cm',
          grossWeight: 150,
          boxes: [],
          lines: [],
          boxCount: 0,
        };
        setBoardData((prev) => {
          const currentPallets = prev?.pallets || [];
          return {
            requestId: targetReqId,
            pendingItems: prev?.pendingItems || [],
            boxes: prev?.boxes || [],
            ...prev,
            pallets: [...currentPallets, fallbackPallet],
          };
        });
        freshPallets = [fallbackPallet];
      }

      // Yeni oluşturulan paleti hedef olarak seç
      const foundPallet = freshPallets.find((p) => (p.vesselName || '') === palletName) || { id: newPalletId, vesselName: palletName };
      setSelectedTarget({ type: 'pallet', id: foundPallet.id, name: foundPallet.vesselName || palletName });
      setNewPalletModalVisible(false);
      setNewPalletNameInput('');
      FeedbackService.playSuccess();
      showToast({ message: `${palletName} oluşturuldu ve hedef seçildi.`, type: 'success' });
    } catch (err: any) {
      showToast({ message: err?.message || 'Palet oluşturulamadı', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Miktar Güncelleme
  const updateLineQty = (lineId: number, changeOrValue: number, isAbsolute = false) => {
    if (!isReceiptDone) {
      showToast({ message: 'Mal kabul yapılmadan paketleme yapılamaz.', type: 'error' });
      return;
    }
    setLines((prev) => {
      const next = prev.map((line) => {
        if (line.id === lineId) {
          const current = line.pickedQty || 0;
          const updated = isAbsolute ? changeOrValue : current + changeOrValue;
          const clamped = Math.max(0, updated);
          const isDone = (line.alreadyPackedQty || 0) + clamped >= line.orderedQty && line.orderedQty > 0;
          return {
            ...line,
            pickedQty: clamped,
            isFullyPacked: isDone,
          };
        }
        return line;
      });
      persistPackingState(next);
      return next;
    });
  };

  // Barkod Okutma ve Kayıt Bulma
  const handleScan = async (scannedCode: string) => {
    if (!isReceiptDone) {
      FeedbackService.playError();
      showErrorLock('Bu siparişin Mal Kabulü yapılmamıştır! Mal kabul tamamlanmadan ürünler paketlenemez.');
      return;
    }
    if (!scannedCode || !lines || lines.length === 0) return;
    const cleanCode = scannedCode.trim();

    // 1. Yerel satırlarda ara (stockCode veya id)
    let matchedIndex = lines.findIndex(
      (l) =>
        (l.stockCode && l.stockCode.toLowerCase() === cleanCode.toLowerCase()) ||
        String(l.id) === cleanCode ||
        String(l.orderDetailId) === cleanCode
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
      const totalPackedSoFar = (line.alreadyPackedQty || 0) + (line.pickedQty || 0);

      // Zaten tamamı paketlenmişse uyar
      if (line.isFullyPacked || totalPackedSoFar >= line.orderedQty) {
        FeedbackService.playLightImpact();
        showToast({
          message: `${line.stockName}: Bu ürünün sipariş miktarı (${line.orderedQty} ${line.unit || 'PCS'}) zaten tamamen paketlenmiştir!`,
          type: 'info',
        });
        return;
      }

      // Kalan miktarı hesapla ve Adet Giriş Modalı'nı aç
      const remaining = Math.max(1, line.orderedQty - totalPackedSoFar);

      FeedbackService.playSuccess();
      setScannedLineItem(line);
      setPackQtyInput(String(remaining));
    } else {
      FeedbackService.playError();
      showErrorLock('Okutulan barkod bu tedarikçinin sipariş kalemlerinde bulunamadı!');
    }
  };

  // Barkod Okutulan Ürünü Koliye / Palete Ekleme Onayı
  const handleConfirmPackQty = () => {
    if (!scannedLineItem) return;
    const enteredQty = parseInt(packQtyInput, 10);
    if (isNaN(enteredQty) || enteredQty <= 0) {
      showToast({ message: 'Lütfen geçerli bir adet giriniz (en az 1).', type: 'error' });
      return;
    }

    const targetLineId = scannedLineItem.id;
    setLines((prev) => {
      const next = prev.map((l) => {
        if (l.id === targetLineId) {
          const newPicked = (l.pickedQty || 0) + enteredQty;
          const totalAfter = (l.alreadyPackedQty || 0) + newPicked;
          const isDone = totalAfter >= l.orderedQty && l.orderedQty > 0;
          return {
            ...l,
            pickedQty: newPicked,
            isFullyPacked: isDone,
          };
        }
        return l;
      });
      persistPackingState(next);
      return next;
    });

    FeedbackService.playSuccess();
    showToast({
      message: `${enteredQty} ${scannedLineItem.unit || 'Adet'} ${scannedLineItem.stockName} ${selectedTarget?.name || 'koliye'} paketlendi.`,
      type: 'success',
    });
    setScannedLineItem(null);
    setPackQtyInput('1');
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

  // Tümünü Sipariş Kadar Doldur (Sadece Harici Tedarikçiler İçin)
  const handleFillAll = () => {
    if (!isReceiptDone) {
      Alert.alert(
        'Mal Kabul Yapılmadı',
        'Bu siparişin ürünleri henüz mal kabulden geçmemiştir. Paketleme yapabilmek için önce Mal Kabul işleminin tamamlanması gerekmektedir.'
      );
      return;
    }
    if (isGemini) {
      Alert.alert(
        'Barkod Okutulmalıdır',
        'Gemini ürünlerinde koliye koymak için ürün barkodunun okutulması zorunludur.',
        [{ text: 'Tamam' }]
      );
      return;
    }
    Alert.alert(
      'Tümünü Doldur',
      'Tüm ürünlerin paketleme miktarları sipariş miktarına eşitlensin mi?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, Doldur',
          onPress: () => {
            setLines((prev) => {
              const next = prev.map((l) => ({
                ...l,
                pickedQty: l.orderedQty,
                isFullyPacked: true,
              }));
              persistPackingState(next);
              return next;
            });
            FeedbackService.playSuccess();
            showToast({ message: 'Tüm ürünler sipariş miktarına eşitlendi.', type: 'success' });
          },
        },
      ]
    );
  };

  // Tek Dokunuşla Tamamı Koliye Ekle (Sadece Harici Tedarikçiler İçin)
  const handleQuickFill = (lineId: number, orderedQty: number) => {
    if (!isReceiptDone) {
      showToast({ message: 'Mal kabul yapılmadan paketleme yapılamaz.', type: 'error' });
      return;
    }
    if (isGemini) {
      showToast({ message: 'Gemini ürünleri için lütfen barkod okutun.', type: 'info' });
      return;
    }
    updateLineQty(lineId, orderedQty, true);
    FeedbackService.playSuccess();
  };

  // Sıfırla (Çöp Kutusu İkonu)
  const handleResetAll = () => {
    Alert.alert(
      'Sıfırla',
      'Girilen tüm paketleme miktarları sıfırlansın mı?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: () => {
            setLines((prev) => {
              const next = prev.map((l) => ({ ...l, pickedQty: 0, isFullyPacked: false }));
              persistPackingState(next);
              return next;
            });
            FeedbackService.playLightImpact();
            showToast({ message: 'Miktarlar sıfırlandı.', type: 'info' });
          },
        },
      ]
    );
  };

  // Paketlemeyi Kaydet
  const handleSavePacking = async () => {
    if (!isReceiptDone) {
      Alert.alert(
        'Mal Kabul Yapılmadı',
        'Bu siparişin ürünleri henüz mal kabulden geçmemiştir. Paketleme yapabilmek için önce Mal Kabul işleminin tamamlanması gerekmektedir.',
        [
          { text: 'Kapat', style: 'cancel' },
          {
            text: 'Mal Kabul Ekranına Git',
            onPress: () => {
              navigation.navigate('ReceivingStack', {
                screen: 'OrderDetail',
                params: {
                  orderId: Number(orderId || requestId),
                  supplierId: Number(supplierId),
                  supplierName,
                  documentNo,
                  partnerName,
                  rfqNo,
                  vesselName,
                },
              });
            },
          },
        ]
      );
      return;
    }

    if (!selectedTarget) {
      showToast({ message: 'Lütfen hedef bir koli veya palet seçin.', type: 'error' });
      return;
    }

    const hasNewItems = lines.some((l) => (l.pickedQty || 0) > 0);
    if (!hasNewItems && isAllComplete) {
      Alert.alert(
        'Paketleme Tamamlandı',
        `Bu tedarikçiye ait tüm ürünler (${totalOrdered} adet) zaten paketlenmiştir.\n\nKoli barkod etiketini Zebra yazıcıdan tekrar yazdırmak ister misiniz?`,
        [
          { text: 'Kapat', style: 'cancel' },
          {
            text: 'Etiket Yazdır',
            onPress: handleDirectPrintBox,
          },
        ]
      );
      return;
    }

    const itemsToPack = lines.filter((l) => (l.pickedQty || 0) > 0);

    // Eğer kullanıcı miktar girmeden kaydet dediyse uyar
    if (itemsToPack.length === 0) {
      if (isGemini) {
        Alert.alert(
          'Paketleme Yapılmadı',
          'Gemini ürünlerini koliye veya palete koymak için ürün barkodunu okutmanız ve adetini girmeniz gerekmektedir.',
          [{ text: 'Tamam' }]
        );
        return;
      }

      const unpackedLines = lines.filter((l) => !l.isFullyPacked);
      const unpackedTotal = unpackedLines.reduce((acc, l) => acc + l.orderedQty, 0);

      Alert.alert(
        'Paketleme Miktarı Girilmedi',
        `Henüz paketleme miktarı girmediniz. Kalan sipariş kalemleri (${unpackedTotal} adet) doğrudan "${selectedTarget.name}" içine paketlenip kaydedilsin mi?`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Tümünü Paketle ve Kaydet',
            onPress: () => {
              const filledLines = lines.map((l) => ({
                ...l,
                pickedQty: l.orderedQty,
                isFullyPacked: true,
              }));
              setLines(filledLines);
              persistPackingState(filledLines);
              executeSavePacking(filledLines);
            },
          },
        ]
      );
      return;
    }

    await executeSavePacking(lines);
  };

  // Doğrudan Aktif Hedef Koli/Palet Etiketini Yazdır
  const handleDirectPrintBox = async () => {
    if (!selectedTarget) {
      showToast({ message: 'Lütfen etiket basılacak koliyi veya paleti seçin.', type: 'error' });
      return;
    }

    // 1. Önce boardData içinden bu koli/palete ait paketlenmiş kalemleri bul
    let targetItems: PrintBoxItem[] = [];
    if (selectedTarget.type === 'box') {
      const b = boardData?.boxes?.find((x) => x.id === selectedTarget.id);
      const bLines = b?.lines || b?.items || [];
      if (bLines.length > 0) {
        targetItems = bLines.map((bl) => {
          const matched = lines.find(
            (l) => (bl.orderDetailId && l.orderDetailId === bl.orderDetailId) ||
                   (bl.stockCode && l.stockCode && l.stockCode.trim().toLowerCase() === bl.stockCode.trim().toLowerCase())
          );
          return {
            impaCode: matched?.impaCode || bl.impaCode,
            stockCode: bl.stockCode || matched?.stockCode,
            stockName: matched?.stockName || bl.stockName,
            qty: bl.qty,
            unit: bl.unit || matched?.unit,
          };
        });
      }
    } else {
      const p = boardData?.pallets?.find((x) => x.id === selectedTarget.id);
      const pLines = p?.lines || p?.items || [];
      if (pLines.length > 0) {
        targetItems = pLines.map((pl) => {
          const matched = lines.find(
            (l) => (pl.orderDetailId && l.orderDetailId === pl.orderDetailId) ||
                   (pl.stockCode && l.stockCode && l.stockCode.trim().toLowerCase() === pl.stockCode.trim().toLowerCase())
          );
          return {
            impaCode: matched?.impaCode || pl.impaCode,
            stockCode: pl.stockCode || matched?.stockCode,
            stockName: matched?.stockName || pl.stockName,
            qty: pl.qty,
            unit: pl.unit || matched?.unit,
          };
        });
      }
    }

    // 2. Eğer boardData içinde henüz kalem bulunamadıysa (örneğin kullanıcı henüz kaydetmedi ama ekrandan paketliyor)
    if (targetItems.length === 0) {
      const itemsToPack = lines.filter((l) => (l.pickedQty || 0) > 0);
      targetItems = itemsToPack.map((it) => ({
        impaCode: it.impaCode,
        stockCode: it.stockCode,
        stockName: it.stockName,
        qty: it.pickedQty,
        unit: it.unit,
      }));
    }

    const totalQtySum = targetItems.reduce((sum, it) => sum + (it.qty || 0), 0);
    const itemCount = targetItems.length;

    try {
      FeedbackService.playLightImpact();
      showToast({ message: `${selectedTarget.name} etiketi yazıcıya gönderiliyor...`, type: 'info' });
      await printBoxLabel({
        boxName: selectedTarget.name,
        boxBarcode: selectedTarget.type === 'box' ? `BOX-${selectedTarget.id}` : `PLT-${selectedTarget.id}`,
        orderNo: documentNo || (orderId ? `ORD-${orderId}` : ''),
        rfqNo: rfqNo || '',
        vesselName: vesselName || '',
        supplierName: supplierName || partnerName || '',
        itemCount,
        totalQty: totalQtySum,
        items: targetItems,
      });
      FeedbackService.playSuccess();
      showToast({ message: `${selectedTarget.name} etiketi başarıyla yazdırıldı.`, type: 'success' });
    } catch (err: any) {
      FeedbackService.playError();
      showToast({ message: err?.message || 'Etiket yazdırılamadı.', type: 'error' });
    }
  };

  // Belirli Bir Koli veya Palet Etiketini Yazdır
  const handlePrintSpecificTarget = async (type: 'box' | 'pallet', id: number, name: string) => {
    let targetItems: PrintBoxItem[] = [];
    if (type === 'box') {
      const b = boardData?.boxes?.find((x) => x.id === id);
      const bLines = b?.lines || b?.items || [];
      targetItems = bLines.map((bl) => {
        const matched = lines.find(
          (l) => (bl.orderDetailId && l.orderDetailId === bl.orderDetailId) ||
                 (bl.stockCode && l.stockCode && l.stockCode.trim().toLowerCase() === bl.stockCode.trim().toLowerCase())
        );
        return {
          impaCode: matched?.impaCode || bl.impaCode,
          stockCode: bl.stockCode || matched?.stockCode,
          stockName: matched?.stockName || bl.stockName,
          qty: bl.qty,
          unit: bl.unit || matched?.unit,
        };
      });
    } else {
      const p = boardData?.pallets?.find((x) => x.id === id);
      const pLines = p?.lines || p?.items || [];
      targetItems = pLines.map((pl) => {
        const matched = lines.find(
          (l) => (pl.orderDetailId && l.orderDetailId === pl.orderDetailId) ||
                 (pl.stockCode && l.stockCode && l.stockCode.trim().toLowerCase() === pl.stockCode.trim().toLowerCase())
        );
        return {
          impaCode: matched?.impaCode || pl.impaCode,
          stockCode: pl.stockCode || matched?.stockCode,
          stockName: matched?.stockName || pl.stockName,
          qty: pl.qty,
          unit: pl.unit || matched?.unit,
        };
      });
    }
    const totalQtySum = targetItems.reduce((sum, it) => sum + (it.qty || 0), 0);

    try {
      FeedbackService.playLightImpact();
      showToast({ message: `${name} etiketi yazıcıya gönderiliyor...`, type: 'info' });
      await printBoxLabel({
        boxName: name,
        boxBarcode: type === 'box' ? `BOX-${id}` : `PLT-${id}`,
        orderNo: documentNo || (orderId ? `ORD-${orderId}` : ''),
        rfqNo: rfqNo || '',
        vesselName: vesselName || '',
        supplierName: supplierName || partnerName || '',
        itemCount: targetItems.length,
        totalQty: totalQtySum,
        items: targetItems,
      });
      FeedbackService.playSuccess();
      showToast({ message: `${name} etiketi başarıyla yazdırıldı.`, type: 'success' });
    } catch (err: any) {
      FeedbackService.playError();
      showToast({ message: err?.message || 'Etiket yazdırılamadı.', type: 'error' });
    }
  };

  const executeSavePacking = async (linesToSave: PackingLineItem[]) => {
    const itemsToPack = linesToSave.filter((l) => (l.pickedQty || 0) > 0);
    if (itemsToPack.length === 0) {
      showToast({ message: 'Paketlenecek ürün kalemi bulunamadı.', type: 'info' });
      return;
    }

    if (!selectedTarget) {
      showToast({ message: 'Lütfen hedef bir koli veya palet seçin.', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      FeedbackService.playLightImpact();

      // Sunucuya toplu aktarım (Bulk Assign)
      try {
        const targetReqId = Number(requestId || orderId);
        const targetOId = Number(orderId || requestId);

        await assignItemsBulk({
          requestId: targetReqId,
          boxId: selectedTarget.type === 'box' ? selectedTarget.id : null,
          palletId: selectedTarget.type === 'pallet' ? selectedTarget.id : null,
          items: itemsToPack.map((item) => {
            const matchedPending = boardData?.pendingItems?.find(
              (p) => p.stockCode && p.stockCode.trim().toLowerCase() === item.stockCode.trim().toLowerCase()
            );
            return {
              orderDetailId: matchedPending?.orderDetailId || item.orderDetailId,
              stockCode: item.stockCode,
              qty: item.pickedQty,
            };
          }),
        });

        // Eğer tüm kalemler paketlendiyse sunucuda tedarikçi paketlemesini tamamla
        const isAllComplete = linesToSave.every(
          (l) => (l.alreadyPackedQty || 0) + (l.pickedQty || 0) >= l.orderedQty && l.orderedQty > 0
        );
        if (isAllComplete && supplierId && targetOId) {
          completeSupplierPacking(targetOId, Number(supplierId)).catch((e) =>
            console.warn('completeSupplierPacking err:', e)
          );
        }
      } catch (srvErr) {
        console.warn('Server assignItemsBulk warning, trying fallback:', srvErr);
        try {
          await Promise.all(
            itemsToPack.map((item) => {
              const matchedPending = boardData?.pendingItems?.find(
                (p) => p.stockCode && p.stockCode.trim().toLowerCase() === item.stockCode.trim().toLowerCase()
              );
              return assignItemToBoxOrPallet({
                orderDetailId: matchedPending?.orderDetailId || item.orderDetailId,
                boxId: selectedTarget.type === 'box' ? selectedTarget.id : null,
                palletId: selectedTarget.type === 'pallet' ? selectedTarget.id : null,
                qty: item.pickedQty,
                stockCode: item.stockCode,
                stockName: item.stockName,
                unit: item.unit,
              });
            })
          );
        } catch (fbErr) {
          console.warn('Fallback assignItem warning:', fbErr);
        }
      }

      // Yerel hafızaya her zaman kalıcı kaydet
      await persistPackingState(linesToSave);

      FeedbackService.playSuccess();
      showToast({
        message: `${itemsToPack.length} kalem ürün ${selectedTarget.name} içine paketlendi ve kaydedildi.`,
        type: 'success',
      });

      const targetName = selectedTarget.name;
      const targetType = selectedTarget.type;
      const targetId = selectedTarget.id;
      const totalQtySum = itemsToPack.reduce((sum, it) => sum + (it.pickedQty || 0), 0);
      const itemCount = itemsToPack.length;
      const printItems: PrintBoxItem[] = itemsToPack.map((it) => ({
        impaCode: it.impaCode,
        stockCode: it.stockCode,
        stockName: it.stockName,
        qty: it.pickedQty,
        unit: it.unit,
      }));

      Alert.alert(
        'Paketleme Kaydedildi',
        `${itemCount} kalem (${totalQtySum} adet) ürün "${targetName}" içine paketlendi.\n\nKoli barkod etiketini Zebra yazıcıdan yazdırmak ister misiniz?`,
        [
          {
            text: 'Hayır, Geri Dön',
            style: 'cancel',
            onPress: () => {
              navigation.goBack();
            },
          },
          {
            text: 'Yazdır ve Çık',
            style: 'default',
            onPress: async () => {
              try {
                showToast({ message: 'Etiket yazıcıya gönderiliyor...', type: 'info' });
                await printBoxLabel({
                  boxName: targetName,
                  boxBarcode: targetType === 'box' ? `BOX-${targetId}` : `PLT-${targetId}`,
                  orderNo: documentNo || (orderId ? `ORD-${orderId}` : ''),
                  rfqNo: rfqNo || '',
                  vesselName: vesselName || '',
                  supplierName: supplierName || partnerName || '',
                  itemCount,
                  totalQty: totalQtySum,
                  items: printItems,
                });
                FeedbackService.playSuccess();
                showToast({ message: 'Etiket yazıcıya gönderildi.', type: 'success' });
              } catch (printErr: any) {
                FeedbackService.playError();
                showToast({
                  message: `Etiket yazdırılamadı: ${printErr?.message || 'Yazıcı bağlantı hatası'}`,
                  type: 'error',
                });
              } finally {
                navigation.goBack();
              }
            },
          },
        ],
        { cancelable: false }
      );
    } catch (err: any) {
      FeedbackService.playError();
      const errMsg = err.response?.data?.message || err.message || 'Paketleme kaydedilemedi.';
      showToast({ message: errMsg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // İstatistikler
  const totalOrdered = lines.reduce((acc, l) => acc + l.orderedQty, 0);
  const totalReceived = lines.reduce((acc, l) => acc + (l.pickedQty || 0), 0);
  const completedLinesCount = lines.filter((l) => (l.pickedQty || 0) >= l.orderedQty && l.orderedQty > 0).length;
  const isAllComplete = lines.length > 0 && completedLinesCount === lines.length;

  // Ürün Kartı Render (Mal Kabul ile Birebir Aynı Tasarım)
  const renderItem = ({ item }: { item: PackingLineItem }) => {
    const received = item.pickedQty || 0;
    const ordered = item.orderedQty;

    let cardBorderColor: string = Colors.outlineVariant;
    let cardBgColor: string = Colors.surface;
    let statusLabel = 'Bekliyor';
    let statusType: 'primary' | 'success' | 'warning' | 'error' = 'primary';

    if (item.isFullyPacked || (received > 0 && received === ordered)) {
      cardBorderColor = Colors.success;
      cardBgColor = '#F2F9F4';
      statusLabel = 'Paketlendi';
      statusType = 'success';
    } else if (received > ordered) {
      cardBorderColor = Colors.secondary;
      cardBgColor = '#F4F5FB';
      statusLabel = 'Fazla';
      statusType = 'primary';
    } else if (received > 0 && received < ordered) {
      cardBorderColor = Colors.warning;
      cardBgColor = '#FFFBF2';
      statusLabel = 'Kısmi';
      statusType = 'warning';
    } else {
      cardBorderColor = Colors.outlineVariant;
      cardBgColor = Colors.surface;
      statusLabel = 'Bekliyor';
      statusType = 'primary';
    }

    return (
      <View style={[styles.itemCard, { borderColor: cardBorderColor, backgroundColor: cardBgColor }]}>
        {/* Üst Bilgi Satırı: Stok Kodu, Raf ve Rozet */}
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

        {/* Ürün İsimleri ve Detayları - Kartın Tam Genişliğinde */}
        <View style={styles.productNamesContainer}>
          <Text style={styles.stockName}>{item.stockName}</Text>

          {/* Türkçe Ürün Adı */}
          {!!item.stockNameTr && item.stockNameTr.trim().toLowerCase() !== item.stockName?.trim().toLowerCase() && (
            <View style={styles.trNameRow}>
              <View style={styles.trNameBadge}>
                <Text style={styles.trNameBadgeText}>TR</Text>
              </View>
              <Text style={styles.trNameText} numberOfLines={3}>
                {item.stockNameTr}
              </Text>
            </View>
          )}

          {/* Marka & Model Bilgisi */}
          {(!!item.brand || !!item.model) && (
            <View style={styles.brandModelRow}>
              {!!item.brand && (
                <View style={styles.brandBadge}>
                  <CustomIcon name="tag-outline" size={11} color="#4338CA" />
                  <Text style={styles.brandBadgeText} numberOfLines={1}>
                    Marka: {item.brand}
                  </Text>
                </View>
              )}
              {!!item.model && (
                <View style={styles.modelBadge}>
                  <CustomIcon name="cube-outline" size={11} color="#0369A1" />
                  <Text style={styles.modelBadgeText} numberOfLines={1}>
                    Model: {item.model}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Sipariş Edilen & Gelen Satırı */}
        <View style={styles.itemActionRow}>
          <View style={styles.expectedBox}>
            <Text style={styles.expectedLabel}>Sipariş Edilen</Text>
            <Text style={styles.expectedValue}>
              {ordered} <Text style={styles.unitText}>{item.unit || 'PCS'}</Text>
            </Text>
          </View>

          {/* Stepper Kontrolü veya Paketlendi Göstergesi */}
          <View style={styles.stepperContainer}>
            <Text style={styles.stepperLabel}>{item.isFullyPacked ? 'Paketlenen' : 'Gelen Miktar'}</Text>
            {!isReceiptDone ? (
              <View style={styles.lockedStepperBox}>
                <CustomIcon name="lock-outline" size={15} color="#B45309" />
                <Text style={styles.lockedStepperText}>Kilitli</Text>
              </View>
            ) : item.isFullyPacked ? (
              <View style={styles.fullyPackedBadge}>
                <CustomIcon name="check-circle" size={16} color={Colors.success} />
                <Text style={styles.fullyPackedText}>{received} {item.unit || 'PCS'}</Text>
              </View>
            ) : isGemini ? (
              <View style={styles.geminiQtyWrapper}>
                <TouchableOpacity
                  style={styles.geminiQtyBadge}
                  onPress={() => {
                    showToast({ message: 'Gemini ürünleri için lütfen barkod okutun.', type: 'info' });
                  }}
                  activeOpacity={0.8}
                >
                  <CustomIcon name="barcode-scan" size={14} color={received > 0 ? Colors.primary : Colors.outline} />
                  <Text style={styles.geminiQtyText}>
                    {received} / {ordered} {item.unit || 'PCS'}
                  </Text>
                </TouchableOpacity>
                {received > 0 && (
                  <TouchableOpacity
                    style={styles.geminiResetBtn}
                    onPress={() => {
                      Alert.alert(
                        'Miktarı Sıfırla',
                        `${item.stockName} için koliye eklenen miktar sıfırlansın mı?`,
                        [
                          { text: 'Vazgeç', style: 'cancel' },
                          {
                            text: 'Sıfırla',
                            style: 'destructive',
                            onPress: () => {
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.id === item.id ? { ...l, pickedQty: 0, isFullyPacked: false } : l
                                )
                              );
                              FeedbackService.playLightImpact();
                            },
                          },
                        ]
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <CustomIcon name="trash-can-outline" size={13} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.stepperControls}>
                <TouchableOpacity
                  style={[styles.stepBtn, received <= 0 && styles.stepBtnDisabled]}
                  onPress={() => updateLineQty(item.id, -1)}
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
                    const clean = val.replace(/[^0-9]/g, '');
                    const num = clean ? parseInt(clean, 10) : 0;
                    updateLineQty(item.id, num, true);
                  }}
                  selectTextOnFocus={true}
                />

                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => updateLineQty(item.id, 1)}
                  activeOpacity={0.7}
                >
                  <CustomIcon name="plus" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Hızlı Aksiyon: Tamamı Geldi / Barkod Okutma Uyarısı */}
        <View style={styles.itemFooterRow}>
          {!isReceiptDone ? (
            <View style={styles.itemReceiptLockNotice}>
              <CustomIcon name="lock-outline" size={13} color="#B45309" />
              <Text style={styles.itemReceiptLockNoticeText}>
                Mal kabul tamamlanmadan paketleme yapılamaz
              </Text>
            </View>
          ) : item.isFullyPacked ? (
            <View style={[styles.quickFillBtn, styles.quickFillBtnActive]}>
              <CustomIcon name="check-circle" size={16} color={Colors.success} />
              <Text style={[styles.quickFillText, { color: Colors.success }]}>
                Tamamı Paketlendi ({ordered} {item.unit || 'PCS'})
              </Text>
            </View>
          ) : isGemini ? (
            <TouchableOpacity
              style={styles.geminiScanPromptBtn}
              onPress={() => setShowCameraScanner(true)}
              activeOpacity={0.7}
            >
              <CustomIcon name="barcode-scan" size={15} color={Colors.primary} />
              <Text style={styles.geminiScanPromptText}>
                Koliye Koymak İçin Barkod Okutun
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.quickFillBtn, received === ordered && styles.quickFillBtnActive]}
              onPress={() => handleQuickFill(item.id, ordered)}
              activeOpacity={0.7}
            >
              <CustomIcon
                name={received === ordered ? 'check-circle' : 'clipboard-check-outline'}
                size={16}
                color={received === ordered ? Colors.success : Colors.primary}
              />
              <Text style={[styles.quickFillText, received === ordered && { color: Colors.success }]}>
                {received === ordered ? 'Tamamı Geldi' : `Tamamı Geldi (${ordered} ${item.unit || 'PCS'})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TopAppBar
        title={documentNo ? `Paketleme: ${documentNo}` : 'Koli & Palet Paketleme'}
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
              {supplierName || partnerName || 'Tedarikçi'}
            </Text>
          </View>
          <Badge
            label={!isReceiptDone ? 'MAL KABUL BEKLİYOR' : isAllComplete ? 'TAMAMLANDI' : 'PAKETLEME BEKLİYOR'}
            type={!isReceiptDone ? 'warning' : isAllComplete ? 'success' : 'primary'}
            icon={!isReceiptDone ? 'lock-outline' : isAllComplete ? 'check-circle' : 'package-variant'}
          />
        </View>

        {/* Gemi & RFQ Bilgisi */}
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

        {/* MAL KABUL BEKLİYOR UYARISI VE GEÇİŞ BUTONU */}
        {!isReceiptDone && (
          <View style={styles.receiptWarningBanner}>
            <View style={styles.receiptWarningHeader}>
              <CustomIcon name="alert-circle-outline" size={20} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.receiptWarningTitle}>Mal Kabul Bekleniyor</Text>
                <Text style={styles.receiptWarningDesc}>
                  Bu sipariş henüz mal kabulden geçmemiştir. Ürünleri paketleyebilmek için önce mal kabul işlemini tamamlayınız.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.receiptGoBtn}
              onPress={() => {
                navigation.navigate('ReceivingStack', {
                  screen: 'OrderDetail',
                  params: {
                    orderId: Number(orderId || requestId),
                    supplierId: Number(supplierId),
                    supplierName,
                    documentNo,
                    partnerName,
                    rfqNo,
                    vesselName,
                  },
                });
              }}
              activeOpacity={0.8}
            >
              <CustomIcon name="truck-check-outline" size={16} color="#fff" />
              <Text style={styles.receiptGoBtnText}>Mal Kabul Ekranına Git</Text>
              <CustomIcon name="chevron-right" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {isAllComplete ? (
          <View style={styles.allCompleteBanner}>
            <CustomIcon name="check-decagram" size={18} color="#047857" />
            <Text style={styles.allCompleteText}>
              Bu tedarikçinin tüm ürünleri paketlenmiştir ({totalOrdered} Adet).
            </Text>
          </View>
        ) : null}

        {/* Hedef Koli / Palet Seçici */}
        <View style={styles.targetRow}>
          <TouchableOpacity
            style={styles.targetSelectorBtn}
            onPress={() => setTargetModalVisible(true)}
            activeOpacity={0.7}
          >
            <CustomIcon
              name={selectedTarget?.type === 'pallet' ? 'truck-delivery-outline' : 'package-variant-closed'}
              size={18}
              color={Colors.primary}
            />
            <Text style={styles.targetSelectorText} numberOfLines={1}>
              Hedef: <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{selectedTarget?.name || 'Koli Seçin'}</Text>
            </Text>
            <CustomIcon name="chevron-down" size={18} color={Colors.outline} />
          </TouchableOpacity>

          <View style={styles.quickTargetActions}>
            {selectedTarget && (
              <TouchableOpacity
                style={styles.printTargetBtn}
                onPress={handleDirectPrintBox}
                activeOpacity={0.7}
              >
                <CustomIcon name="printer" size={13} color="#fff" />
                <Text style={styles.newBoxBtnText}>Yazdır</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.newBoxBtn}
              onPress={() => {
                setNewBoxNameInput(`Koli-${(boardData?.boxes?.length || 0) + 1}`);
                setNewBoxModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <CustomIcon name="plus" size={14} color="#fff" />
              <Text style={styles.newBoxBtnText}>Koli</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.newPalletBtn}
              onPress={() => {
                setNewPalletNameInput(`Palet-${(boardData?.pallets?.length || 0) + 1}`);
                setNewPalletModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <CustomIcon name="plus" size={14} color="#fff" />
              <Text style={styles.newBoxBtnText}>Palet</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Gemini Depo Mal Çıkış Barkod Zorunluluğu Uyarısı */}
        {isGemini && !isAllComplete && (
          <View style={styles.geminiWarningBadge}>
            <CustomIcon name="alert-circle" size={16} color="#B45309" />
            <Text style={styles.geminiWarningText}>
              Gemini ürünleri için koliye koyarken barkod okutulması zorunludur!
            </Text>
          </View>
        )}

        {/* İstatistikler (Kalem ve Toplam) */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Kalem</Text>
            <Text style={styles.statValue}>
              {completedLinesCount} / {lines.length} Kalem
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Toplam</Text>
            <Text style={styles.statValue}>
              {totalReceived} / {totalOrdered} Adet
            </Text>
          </View>
        </View>

        {/* Hızlı Aksiyon: Tümünü Sipariş Kadar Doldur (Sadece Harici Tedarikçiler İçin) */}
        {!isAllComplete && !isGemini && (
          <View style={styles.quickActionRow}>
            <TouchableOpacity
              style={styles.bulkFillBtn}
              onPress={handleFillAll}
              activeOpacity={0.8}
            >
              <CustomIcon
                name="clipboard-check-outline"
                size={16}
                color={Colors.onSecondaryContainer}
              />
              <Text style={styles.bulkFillText}>
                Tümünü Sipariş Kadar Doldur
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Barkod Okuma Satırı */}
        <View style={styles.scanRow}>
          <TextInput
            style={styles.barcodeInput}
            placeholder="Urun barkodunu okutun veya yazın..."
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
      {loading && lines.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Ürün kalemleri yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={lines}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchPackingData}
              colors={[Colors.primary]}
            />
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
          <Text style={styles.footerSummaryLabel}>Toplam</Text>
          <Text style={styles.footerSummaryValue}>
            {totalReceived} <Text style={styles.footerSummaryTotal}>/ {totalOrdered}</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            !isReceiptDone && styles.saveBtnLocked,
            isAllComplete && isReceiptDone && styles.saveBtnComplete,
          ]}
          onPress={handleSavePacking}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.onPrimary} />
          ) : (
            <View style={styles.saveBtnContent}>
              <CustomIcon
                name={!isReceiptDone ? 'lock-outline' : isAllComplete ? 'check-all' : 'content-save'}
                size={20}
                color={Colors.onPrimary}
              />
              <Text style={styles.saveBtnText}>
                {!isReceiptDone
                  ? 'Mal Kabul Bekliyor (Paketleme Kilitli)'
                  : isAllComplete
                  ? 'Tümü Paketlendi (Tamamlandı)'
                  : 'Paketlemeyi Kaydet'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* HEDEF KOLİ / PALET SEÇİM MODALI */}
      <Modal visible={targetModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hedef Koli / Palet Seçin</Text>

            <ScrollView style={{ maxHeight: 320, marginVertical: Spacing.sm }}>
              {/* KOLİLER BAŞLIK VE EKLE BUTONU */}
              <View style={styles.targetSectionHeaderRow}>
                <Text style={styles.targetSectionTitle}>KOLİLER ({boardData?.boxes?.length || 0})</Text>
                <TouchableOpacity
                  style={styles.inlineAddBtn}
                  onPress={() => {
                    setTargetModalVisible(false);
                    setNewBoxNameInput(`Koli-${(boardData?.boxes?.length || 0) + 1}`);
                    setNewBoxModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <CustomIcon name="plus" size={13} color={Colors.primary} />
                  <Text style={styles.inlineAddBtnText}>Yeni Koli Ekle</Text>
                </TouchableOpacity>
              </View>

              {boardData?.boxes && boardData.boxes.length > 0 ? (
                boardData.boxes.map((b) => (
                  <View
                    key={`box-${b.id}`}
                    style={[
                      styles.targetOption,
                      selectedTarget?.type === 'box' && selectedTarget.id === b.id && styles.activeTargetOption,
                    ]}
                  >
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                      onPress={() => {
                        setSelectedTarget({ type: 'box', id: b.id, name: b.boxName });
                        setTargetModalVisible(false);
                      }}
                    >
                      <CustomIcon name="package-variant-closed" size={18} color={Colors.primary} />
                      <Text style={styles.targetOptionText}>{b.boxName}</Text>
                      {selectedTarget?.type === 'box' && selectedTarget.id === b.id ? (
                        <CustomIcon name="check-circle" size={18} color={Colors.primary} />
                      ) : null}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalRowPrintBtn}
                      onPress={() => handlePrintSpecificTarget('box', b.id, b.boxName)}
                      activeOpacity={0.7}
                    >
                      <CustomIcon name="printer" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.noOptionText}>Henüz oluşturulmuş koli yok</Text>
              )}

              {/* PALETLER BAŞLIK VE EKLE BUTONU */}
              <View style={[styles.targetSectionHeaderRow, { marginTop: 16 }]}>
                <Text style={styles.targetSectionTitle}>PALETLER ({boardData?.pallets?.length || 0})</Text>
                <TouchableOpacity
                  style={styles.inlineAddBtn}
                  onPress={() => {
                    setTargetModalVisible(false);
                    setNewPalletNameInput(`Palet-${(boardData?.pallets?.length || 0) + 1}`);
                    setNewPalletModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <CustomIcon name="plus" size={13} color={Colors.primary} />
                  <Text style={styles.inlineAddBtnText}>Yeni Palet Ekle</Text>
                </TouchableOpacity>
              </View>

              {boardData?.pallets && boardData.pallets.length > 0 ? (
                boardData.pallets.map((p) => {
                  const pName = p.vesselName || `Palet-${p.id}`;
                  return (
                    <View
                      key={`pallet-${p.id}`}
                      style={[
                        styles.targetOption,
                        selectedTarget?.type === 'pallet' && selectedTarget.id === p.id && styles.activeTargetOption,
                      ]}
                    >
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                        onPress={() => {
                          setSelectedTarget({ type: 'pallet', id: p.id, name: pName });
                          setTargetModalVisible(false);
                        }}
                      >
                        <CustomIcon name="truck-delivery-outline" size={18} color={Colors.primary} />
                        <Text style={styles.targetOptionText}>{pName}</Text>
                        {selectedTarget?.type === 'pallet' && selectedTarget.id === p.id ? (
                          <CustomIcon name="check-circle" size={18} color={Colors.primary} />
                        ) : null}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.modalRowPrintBtn}
                        onPress={() => handlePrintSpecificTarget('pallet', p.id, pName)}
                        activeOpacity={0.7}
                      >
                        <CustomIcon name="printer" size={16} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.noOptionText}>Henüz oluşturulmuş palet yok</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setTargetModalVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* YENİ KOLİ EKLEME MODALI */}
      <Modal visible={newBoxModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni Koli Tanımla</Text>
            <Text style={styles.inputLabel}>Koli Adı / No</Text>
            <TextInput
              style={styles.modalTextInput}
              value={newBoxNameInput}
              onChangeText={setNewBoxNameInput}
              placeholder="Örn: Koli-2"
              autoFocus
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setNewBoxModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreateNewBox}
                disabled={submitting}
              >
                <Text style={styles.modalSubmitBtnText}>
                  {submitting ? 'Oluşturuluyor...' : 'Oluştur'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* YENİ PALET EKLEME MODALI */}
      <Modal visible={newPalletModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni Palet Tanımla</Text>
            <Text style={styles.inputLabel}>Palet Adı / No</Text>
            <TextInput
              style={styles.modalTextInput}
              value={newPalletNameInput}
              onChangeText={setNewPalletNameInput}
              placeholder="Örn: Palet-2"
              autoFocus
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setNewPalletModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: Colors.secondary }]}
                onPress={handleCreateNewPallet}
                disabled={submitting}
              >
                <Text style={styles.modalSubmitBtnText}>
                  {submitting ? 'Oluşturuluyor...' : 'Oluştur'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* BARKOD OKUTULAN ÜRÜN ADET GİRİŞ VE PAKETLEME MODALI */}
      <Modal
        visible={!!scannedLineItem}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setScannedLineItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qtyModalCard}>
            {/* Modal Header */}
            <View style={styles.qtyModalHeader}>
              <View style={styles.qtyModalTitleRow}>
                <CustomIcon name="package-variant-closed" size={18} color={Colors.primary} />
                <Text style={styles.qtyModalTitle}>Koliye / Palete Ürün Ekle</Text>
              </View>
              <TouchableOpacity
                onPress={() => setScannedLineItem(null)}
                style={styles.modalRowCloseBtn}
                activeOpacity={0.7}
              >
                <CustomIcon name="close" size={18} color={Colors.outline} />
              </TouchableOpacity>
            </View>

            {/* Hedef Koli / Palet Rozeti */}
            <View style={styles.qtyTargetBadge}>
              <CustomIcon
                name={selectedTarget?.type === 'pallet' ? 'truck-delivery-outline' : 'package-variant-closed'}
                size={16}
                color={Colors.primary}
              />
              <Text style={styles.qtyTargetText}>
                Hedef: <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{selectedTarget?.name || 'Koli-1'}</Text>
              </Text>
            </View>

            {/* Ürün Detayları */}
            <View style={styles.qtyProductCard}>
              <View style={styles.qtyProductTopRow}>
                <Text style={styles.qtyStockCode}>{scannedLineItem?.stockCode}</Text>
                {scannedLineItem?.shelfAddress && scannedLineItem.shelfAddress !== 'Tanımsız' ? (
                  <View style={styles.qtyShelfTag}>
                    <CustomIcon name="map-marker-outline" size={12} color="#047857" />
                    <Text style={styles.qtyShelfText}>Raf: {scannedLineItem.shelfAddress}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.qtyStockName} numberOfLines={2}>{scannedLineItem?.stockName}</Text>
            </View>

            {/* Miktar İstatistikleri (Sipariş, Paketlenmiş, Kalan) */}
            <View style={styles.qtyStatsRow}>
              <View style={styles.qtyStatCol}>
                <Text style={styles.qtyStatLabel}>Sipariş</Text>
                <Text style={styles.qtyStatVal}>{scannedLineItem?.orderedQty} {scannedLineItem?.unit || 'PCS'}</Text>
              </View>
              <View style={styles.qtyStatDivider} />
              <View style={styles.qtyStatCol}>
                <Text style={styles.qtyStatLabel}>Paketlenen</Text>
                <Text style={styles.qtyStatVal}>
                  {(scannedLineItem?.alreadyPackedQty || 0) + (scannedLineItem?.pickedQty || 0)} {scannedLineItem?.unit || 'PCS'}
                </Text>
              </View>
              <View style={styles.qtyStatDivider} />
              <View style={styles.qtyStatCol}>
                <Text style={styles.qtyStatLabel}>Kalan</Text>
                <Text style={[styles.qtyStatVal, { color: Colors.primary, fontWeight: 'bold' }]}>
                  {Math.max(0, (scannedLineItem?.orderedQty || 0) - ((scannedLineItem?.alreadyPackedQty || 0) + (scannedLineItem?.pickedQty || 0)))} {scannedLineItem?.unit || 'PCS'}
                </Text>
              </View>
            </View>

            {/* Adet Giriş Alanı */}
            <Text style={styles.qtyInputTitle}>Bu Koliye Eklenecek Adet:</Text>
            <View style={styles.qtyInputRow}>
              <TouchableOpacity
                style={styles.qtyAdjustBtn}
                onPress={() => {
                  const current = parseInt(packQtyInput, 10) || 1;
                  if (current > 1) setPackQtyInput(String(current - 1));
                }}
                activeOpacity={0.7}
              >
                <CustomIcon name="minus" size={20} color={Colors.primary} />
              </TouchableOpacity>

              <TextInput
                style={styles.largeQtyInput}
                keyboardType="numeric"
                value={packQtyInput}
                onChangeText={(val) => {
                  const clean = val.replace(/[^0-9]/g, '');
                  setPackQtyInput(clean);
                }}
                autoFocus={true}
                selectTextOnFocus={true}
                maxLength={6}
              />

              <TouchableOpacity
                style={styles.qtyAdjustBtn}
                onPress={() => {
                  const current = parseInt(packQtyInput, 10) || 0;
                  setPackQtyInput(String(current + 1));
                }}
                activeOpacity={0.7}
              >
                <CustomIcon name="plus" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Hızlı Butonlar */}
            <View style={styles.quickQtyPillsRow}>
              <TouchableOpacity
                style={styles.qtyPill}
                onPress={() => setPackQtyInput('1')}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyPillText}>1 Adet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qtyPill}
                onPress={() => {
                  const curr = parseInt(packQtyInput, 10) || 0;
                  setPackQtyInput(String(curr + 5));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyPillText}>+5</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qtyPill}
                onPress={() => {
                  const curr = parseInt(packQtyInput, 10) || 0;
                  setPackQtyInput(String(curr + 10));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyPillText}>+10</Text>
              </TouchableOpacity>
              {(() => {
                const rem = Math.max(0, (scannedLineItem?.orderedQty || 0) - ((scannedLineItem?.alreadyPackedQty || 0) + (scannedLineItem?.pickedQty || 0)));
                return (
                  <TouchableOpacity
                    style={[styles.qtyPill, styles.qtyPillHighlight]}
                    onPress={() => setPackQtyInput(String(rem > 0 ? rem : 1))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.qtyPillHighlightText}>Kalanın Tamamı ({rem})</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>

            {/* Aksiyon Butonları */}
            <View style={styles.qtyModalActions}>
              <TouchableOpacity
                style={styles.qtyCancelBtn}
                onPress={() => setScannedLineItem(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyCancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.qtyConfirmBtn}
                onPress={handleConfirmPackQty}
                activeOpacity={0.8}
              >
                <CustomIcon name="check-circle" size={18} color="#fff" />
                <Text style={styles.qtyConfirmBtnText}>Koliye Koy / Paketle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* KAMERA BARKOD OKUYUCU */}
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
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  targetSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  targetSelectorText: {
    color: Colors.onSurface,
    fontSize: 12,
    includeFontPadding: false,
  },
  quickTargetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBoxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.xs,
  },
  newPalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondary,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.xs,
  },
  printTargetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.xs,
  },
  modalRowPrintBtn: {
    padding: 6,
    borderRadius: BorderRadius.xs,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBoxBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10.5,
    includeFontPadding: false,
  },
  geminiWarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  geminiWarningText: {
    color: '#B45309',
    fontWeight: '600',
    flex: 1,
    fontSize: 10.5,
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
  bulkFillBtnDisabled: {
    opacity: 0.5,
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
  centerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.bodyMd,
    color: Colors.outline,
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
  productNamesContainer: {
    width: '100%',
    gap: 4,
    marginTop: 2,
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
    height: 38,
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
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  modalTitle: {
    ...Typography.titleMedium,
    color: Colors.primary,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  targetSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 6,
  },
  targetSectionTitle: {
    ...Typography.labelSmall,
    color: Colors.outline,
    fontWeight: 'bold',
  },
  inlineAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.xs,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
  },
  inlineAddBtnText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 11,
  },
  targetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F8FAFC',
    marginVertical: 3,
  },
  activeTargetOption: {
    backgroundColor: '#EBF2FE',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  targetOptionText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    flex: 1,
  },
  noOptionText: {
    ...Typography.bodySm,
    color: Colors.outline,
    paddingVertical: 8,
  },
  modalCloseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.secondaryContainer,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  modalCloseBtnText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  inputLabel: {
    ...Typography.bodySm,
    color: Colors.onSurface,
    marginTop: Spacing.xs,
    marginBottom: 4,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.sm,
  },
  modalCancelBtnText: {
    ...Typography.labelMedium,
    color: Colors.outline,
  },
  modalSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.sm,
  },
  modalSubmitBtnText: {
    ...Typography.labelMedium,
    color: '#fff',
    fontWeight: 'bold',
  },
  allCompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  allCompleteText: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#047857',
    flex: 1,
  },
  fullyPackedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    height: 38,
  },
  fullyPackedText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#047857',
  },
  saveBtnComplete: {
    backgroundColor: '#047857',
  },
  geminiQtyWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  geminiQtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 138, 0.2)',
  },
  geminiQtyText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  geminiResetBtn: {
    padding: 8,
    borderRadius: BorderRadius.xs,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  geminiScanPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 138, 0.2)',
    borderStyle: 'dashed',
  },
  geminiScanPromptText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.primary,
  },
  qtyModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '92%',
    maxWidth: 420,
    ...Shadow.card,
  },
  qtyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  qtyModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyModalTitle: {
    ...Typography.titleMedium,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  modalRowCloseBtn: {
    padding: 6,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.background,
  },
  qtyTargetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  qtyTargetText: {
    fontSize: 12.5,
    color: Colors.onSurface,
  },
  qtyProductCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginBottom: Spacing.sm,
  },
  qtyProductTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  qtyStockCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  qtyShelfTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  qtyShelfText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#047857',
  },
  qtyStockName: {
    ...Typography.bodyMedium,
    color: Colors.onSurface,
  },
  qtyStatsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  qtyStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  qtyStatLabel: {
    fontSize: 11,
    color: Colors.outline,
    marginBottom: 2,
  },
  qtyStatVal: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  qtyStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.outlineVariant,
  },
  qtyInputTitle: {
    ...Typography.labelMedium,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: Spacing.xs,
  },
  qtyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.sm,
  },
  qtyAdjustBtn: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 138, 0.25)',
  },
  largeQtyInput: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.primary,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  quickQtyPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  qtyPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  qtyPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  qtyPillHighlight: {
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    borderColor: Colors.primary,
  },
  qtyPillHighlightText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  qtyModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  qtyCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.outline,
  },
  qtyConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#059669',
  },
  qtyConfirmBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  trNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginTop: 2,
  },
  trNameBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  trNameBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  trNameText: {
    fontSize: 12.5,
    color: '#4B5563',
    flex: 1,
    fontWeight: '500',
  },
  brandModelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  brandBadgeText: {
    fontSize: 11,
    color: '#4338CA',
    fontWeight: '600',
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  modelBadgeText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '600',
  },
  lockedStepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  lockedStepperText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#B45309',
  },
  itemReceiptLockNotice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  itemReceiptLockNoticeText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
  },
  receiptWarningBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    gap: 10,
  },
  receiptWarningHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  receiptWarningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#B45309',
  },
  receiptWarningDesc: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 16,
  },
  receiptGoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D97706',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.sm,
  },
  receiptGoBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  saveBtnLocked: {
    backgroundColor: '#D97706',
  },
});
