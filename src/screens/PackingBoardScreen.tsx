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
import { getStockByBarcode, getStocks, getShelfAddressForCode, getStockDetailsForCode, Stock } from '../services/inventory';
import {
  getPackingBoardData,
  createBox,
  createPallet,
  assignItemToBoxOrPallet,
  assignBoxToPallet,
  unassignBoxFromPallet,
  assignItemsBulk,
  completeSupplierPacking,
  savePackingSupplierStatus,
  removeItemFromPacking,
  moveItemBetweenBoxes,
  MoveItemDto,
  WMS_PackingBoardVM,
  WMS_BoxVM,
  WMS_PalletVM,
  WMS_PackingLineVM,
  isWarehouseSupplier,
  requestItemSubstitution,
  getItemSubstitutionStatus,
  TerminalSubstitutionRequestDto,
} from '../services/packing';
import { useSettingsStore } from '../store/settingsStore';
import { printBoxLabel, PrintBoxItem } from '../services/printHelper';
import { OperatorBadge } from '../components/OperatorBadge';
import { useOperatorStore } from '../store/operatorStore';
import { useNotificationStore } from '../store/notificationStore';
import { terminalNotificationService } from '../services/terminalNotificationService';

interface PackingLineItem {
  id: number;
  orderDetailId: number;
  stockId?: number;
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
  unitPrice?: number;
  purchasePrice?: number;
  currency?: string;
  substitutionStatus?: 'Pending' | 'Approved' | 'Rejected' | null;
  substituteStockId?: number;
  substituteStockCode?: string;
  substituteStockName?: string;
  substituteBrand?: string;
  substitutePurchasePrice?: number;
  substituteSalePrice?: number;
  substituteCurrency?: string;
  substituteRequestedQty?: number;
  substituteNote?: string;
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
  const [isPackingDone, setIsPackingDone] = useState<boolean>(!!routePackingCompleted);

  const targetReqId = Number(requestId || orderId || 0);

  const activeWarehouseName = useSettingsStore((s) => s.activeWarehouseName);
  const { activeOperator, loadOperators, findOperatorByCodeOrId, setActiveOperator } = useOperatorStore();

  useEffect(() => {
    loadOperators();
  }, [loadOperators]);

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

  // Palet seçildiğinde Palet Konsolidasyon / Koli sekmesi ('boxes' veya 'items')
  const [palletTab, setPalletTab] = useState<'boxes' | 'items'>('boxes');

  // Seçili paletteki koliler
  const boxesInSelectedPallet = useMemo(() => {
    if (selectedTarget?.type !== 'pallet') return [];
    const fromBoxes = (boardData?.boxes || []).filter((b) => b.palletId === selectedTarget.id);
    if (fromBoxes.length > 0) return fromBoxes;
    const p = (boardData?.pallets || []).find((x) => x.id === selectedTarget.id);
    return p?.boxes || [];
  }, [boardData, selectedTarget]);

  // Henüz hiçbir palete atanmamış (açıkta bekleyen) koliler
  const unassignedBoxes = useMemo(() => {
    return (boardData?.boxes || []).filter((b) => !b.palletId || b.palletId === 0);
  }, [boardData]);

  // Seçili paletin toplam ağırlığı ve kalem sayısı
  const selectedPalletStats = useMemo(() => {
    if (selectedTarget?.type !== 'pallet') return { totalWeight: 0, totalItems: 0 };
    const totalWeight = boxesInSelectedPallet.reduce((sum, b) => sum + (Number(b.grossWeight) || 0), 0);
    const totalItems = boxesInSelectedPallet.reduce((sum, b) => sum + (b.lines?.length || b.items?.length || 0), 0);
    return { totalWeight, totalItems };
  }, [selectedTarget, boxesInSelectedPallet]);

  // Koliyi Palete Bağlama (Palet Konsolidasyonu)
  const handleAssignBoxToPallet = async (
    boxId: number,
    targetPalletId: number,
    boxName: string,
    palletName: string
  ) => {
    try {
      FeedbackService.playLightImpact();
      // 1. İyimser yerel güncelleme (0ms anlık tepki)
      setBoardData((prev) => {
        if (!prev) return prev;
        const updatedBoxes = (prev.boxes || []).map((b) =>
          b.id === boxId ? { ...b, palletId: targetPalletId } : b
        );
        const targetBox = prev.boxes?.find((b) => b.id === boxId);
        const updatedPallets = (prev.pallets || []).map((p) => {
          if (p.id === targetPalletId) {
            const currentBoxes = p.boxes || [];
            const exists = currentBoxes.some((b) => b.id === boxId);
            const newBoxes = exists
              ? currentBoxes
              : targetBox
              ? [...currentBoxes, { ...targetBox, palletId: targetPalletId }]
              : currentBoxes;
            return { ...p, boxes: newBoxes, boxCount: newBoxes.length };
          } else if (p.boxes?.some((b) => b.id === boxId)) {
            const newBoxes = p.boxes.filter((b) => b.id !== boxId);
            return { ...p, boxes: newBoxes, boxCount: newBoxes.length };
          }
          return p;
        });
        return { ...prev, boxes: updatedBoxes, pallets: updatedPallets };
      });

      // 2. Canlı API çağrısı
      await assignBoxToPallet({ boxId, palletId: targetPalletId });

      FeedbackService.playSuccess();
      showToast({
        message: `${boxName} başarıyla ${palletName} paletine dahil edildi.`,
        type: 'success',
      });

      // 3. Arka planda sunucu senkronizasyonu
      if (targetReqId) {
        getPackingBoardData(targetReqId).then((fresh) => {
          if (fresh) setBoardData(fresh);
        }).catch(() => {});
      }
    } catch (err: any) {
      FeedbackService.playError();
      showToast({
        message: err?.message || 'Koli palete eklenemedi.',
        type: 'error',
      });
      if (targetReqId) {
        getPackingBoardData(targetReqId).then((fresh) => fresh && setBoardData(fresh)).catch(() => {});
      }
    }
  };

  // Koliyi Paletten Çıkarma (Bağlantısını Koparma)
  const handleUnassignBoxFromPallet = (
    boxId: number,
    palletId: number,
    boxName: string,
    palletName: string
  ) => {
    Alert.alert(
      'Koliyi Paletten Çıkar',
      `"${boxName}" kolisi "${palletName}" paletinden çıkarılsın mı?\n\n(Koli silinmez, açıkta bekleyen koliye dönüşür.)`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkar',
          style: 'destructive',
          onPress: async () => {
            try {
              FeedbackService.playLightImpact();
              // İyimser yerel güncelleme
              setBoardData((prev) => {
                if (!prev) return prev;
                const updatedBoxes = (prev.boxes || []).map((b) =>
                  b.id === boxId ? { ...b, palletId: null } : b
                );
                const updatedPallets = (prev.pallets || []).map((p) => {
                  if (p.id === palletId) {
                    const newBoxes = (p.boxes || []).filter((b) => b.id !== boxId);
                    return { ...p, boxes: newBoxes, boxCount: newBoxes.length };
                  }
                  return p;
                });
                return { ...prev, boxes: updatedBoxes, pallets: updatedPallets };
              });

              await unassignBoxFromPallet(boxId);

              FeedbackService.playSuccess();
              showToast({ message: `${boxName} paletten çıkarıldı.`, type: 'info' });

              if (targetReqId) {
                getPackingBoardData(targetReqId).then((fresh) => fresh && setBoardData(fresh)).catch(() => {});
              }
            } catch (err: any) {
              FeedbackService.playError();
              showToast({ message: err?.message || 'Koli paletten çıkarılamadı.', type: 'error' });
            }
          },
        },
      ]
    );
  };

  // Yeni Koli Modali
  const [newBoxModalVisible, setNewBoxModalVisible] = useState(false);
  const [newBoxNameInput, setNewBoxNameInput] = useState('');

  // Yeni Palet Modali
  const [newPalletModalVisible, setNewPalletModalVisible] = useState(false);
  const [newPalletNameInput, setNewPalletNameInput] = useState('');

  // Koli İçerik Görüntüleme ve Yönetim Modalı State'i
  const [boxDetailsModalVisible, setBoxDetailsModalVisible] = useState(false);
  const [inspectingBox, setInspectingBox] = useState<WMS_BoxVM | null>(null);

  // Koli İçi Ürün Transfer Modalı State'i
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [itemToTransfer, setItemToTransfer] = useState<{
    line: WMS_PackingLineVM;
    sourceBox: WMS_BoxVM;
  } | null>(null);
  const [transferQtyInput, setTransferQtyInput] = useState<string>('1');
  const [transferTargetBoxId, setTransferTargetBoxId] = useState<number | null>(null);
  const [transferring, setTransferring] = useState<boolean>(false);

  // Muadil Ürün Öneri Modalı State'leri
  const [substitutionModalVisible, setSubstitutionModalVisible] = useState(false);
  const [substitutionLine, setSubstitutionLine] = useState<PackingLineItem | null>(null);
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [subSearchResults, setSubSearchResults] = useState<Stock[]>([]);
  const [searchingStocks, setSearchingStocks] = useState(false);
  const [selectedSubstituteStock, setSelectedSubstituteStock] = useState<Stock | null>(null);
  const [substituteQty, setSubstituteQty] = useState('');
  const [substituteNote, setSubstituteNote] = useState('');
  const [sendingSubstitution, setSendingSubstitution] = useState(false);

  const handleOpenSubstitutionModal = (line: PackingLineItem) => {
    setSubstitutionLine(line);
    setSelectedSubstituteStock(null);
    setSubSearchQuery('');
    setSubSearchResults([]);
    const missing = Math.max(1, line.orderedQty - ((line.alreadyPackedQty || 0) + (line.pickedQty || 0)));
    setSubstituteQty(String(missing));
    setSubstituteNote('');
    setSubstitutionModalVisible(true);
  };

  const handleSearchSubstituteStocks = async (text: string) => {
    setSubSearchQuery(text);
    if (!text || text.trim().length < 2) {
      setSubSearchResults([]);
      return;
    }
    setSearchingStocks(true);
    try {
      const allStocks = await getStocks();
      const q = text.trim().toLowerCase();
      const matched = allStocks
        .filter((s) => {
          const c = (s.stockCode || '').toLowerCase();
          const n = (s.stockName || '').toLowerCase();
          const b = (s.barCode || '').toLowerCase();
          return c.includes(q) || n.includes(q) || b.includes(q);
        })
        .slice(0, 20);
      setSubSearchResults(matched);
    } catch (e) {
      console.warn('Stok arama hatası:', e);
    } finally {
      setSearchingStocks(false);
    }
  };

  const handleSendSubstitutionRequest = async () => {
    if (!substitutionLine) return;
    if (!selectedSubstituteStock) {
      showToast({ message: 'Lütfen listeden önerilecek muadil ürünü seçin!', type: 'error' });
      return;
    }
    const qtyNum = Number(substituteQty);
    if (!qtyNum || qtyNum <= 0) {
      showToast({ message: 'Lütfen geçerli bir muadil miktar girin!', type: 'error' });
      return;
    }

    setSendingSubstitution(true);
    try {
      const dto: TerminalSubstitutionRequestDto = {
        orderId: Number(orderId || boardData?.orderId || 0),
        orderDetailId: Number(substitutionLine.orderDetailId),
        originalStockId: substitutionLine.stockId,
        substituteStockId: selectedSubstituteStock.id,
        substituteStockCode: selectedSubstituteStock.stockCode,
        substituteStockName: selectedSubstituteStock.stockName,
        requestedQty: qtyNum,
        note: substituteNote.trim(),
      };

      await requestItemSubstitution(dto);

      setLines((prev) =>
        prev.map((l) =>
          l.id === substitutionLine.id
            ? {
                ...l,
                substitutionStatus: 'Pending',
                substituteStockId: selectedSubstituteStock.id,
                substituteStockCode: selectedSubstituteStock.stockCode,
                substituteStockName: selectedSubstituteStock.stockName,
                substituteRequestedQty: qtyNum,
                substituteNote: substituteNote.trim(),
              }
            : l
        )
      );

      FeedbackService.playSuccess();
      showToast({ message: 'Muadil ürün talebi sipariş sorumlusuna iletildi.', type: 'success' });
      setSubstitutionModalVisible(false);
      setSubstitutionLine(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Muadil ürün talebi gönderilemedi.';
      showToast({ message: msg, type: 'error' });
      FeedbackService.playError();
    } finally {
      setSendingSubstitution(false);
    }
  };


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
        const totalLinePacked = (l.alreadyPackedQty || 0) + (l.pickedQty || 0);
        map[codeKey] = totalLinePacked;
        map[String(l.id)] = totalLinePacked;
        totalPackedQty += totalLinePacked;
        totalOrderedQty += l.orderedQty;
        if (totalLinePacked >= l.orderedQty && l.orderedQty > 0) {
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
        const alreadyPackedFromServer = allPackedItems
          .filter((p: any) =>
            (p.orderDetailId && Number(p.orderDetailId) === Number(l.id)) ||
            (p.stockCode && p.stockCode.trim().toLowerCase() === sCodeLower)
          )
          .reduce((sum: number, p: any) => sum + Number(p.qty || 0), 0);

        // Sunucu ve yerel hafıza (AsyncStorage) verilerini senkronize et
        const hasLocalKey = (sCodeLower in savedMap) || (String(l.id) in savedMap);
        const localSavedQty = Number(savedMap[sCodeLower] ?? savedMap[String(l.id)] ?? 0);
        // Yerel kayıt varsa kullanıcının yaptığı paketleme/çıkarma işlemi esastır
        const alreadyPacked = hasLocalKey ? localSavedQty : alreadyPackedFromServer;

        // Paketleme miktarı
        const currentPicked = alreadyPacked >= orderedQty && orderedQty > 0 ? orderedQty : Math.min(orderedQty, alreadyPacked);

        const isFullyPacked = currentPicked >= orderedQty && orderedQty > 0;

        // fetchedBoardData?.unpackedItems içinde de muadil bilgisi olabilir, kontrol et:
        const boardUnpacked = fetchedBoardData?.unpackedItems?.find(
          (u: any) =>
            (u.orderDetailId && Number(u.orderDetailId) === Number(l.id)) ||
            (u.stockCode && u.stockCode.trim().toLowerCase() === sCodeLower)
        );

        const subStatus = (l as any).substitutionStatus || boardUnpacked?.substitutionStatus || ((l as any).substituteStockId ? 'Pending' : null);
        const subStockId = (l as any).substituteStockId || boardUnpacked?.substituteStockId || null;
        const subStockCode = (l as any).substituteStockCode || boardUnpacked?.substituteStockCode || null;
        const subStockName = (l as any).substituteStockName || boardUnpacked?.substituteStockName || null;
        const subRequestedQty = (l as any).substituteRequestedQty ?? boardUnpacked?.substituteRequestedQty ?? null;
        const subNote = (l as any).substituteNote || boardUnpacked?.substituteNote || (boardUnpacked as any)?.depotNote || null;

        const isSubApproved = subStatus === 'Approved';
        const activeStockCode = isSubApproved && subStockCode ? subStockCode : (sCode || 'KOD YOK');
        const activeStockName = isSubApproved && subStockName ? subStockName : (l.stockName || 'Ürün Adı Yok');
        const activeStockId = isSubApproved && subStockId ? subStockId : ((l as any).stockId || (l as any).stock?.id);
        const activeOrderedQty = isSubApproved && Number(subRequestedQty || 0) > 0 ? Number(subRequestedQty) : orderedQty;

        const purchasePrice = Number(l.purchasePrice ?? boardUnpacked?.purchasePrice ?? 0);
        const unitPrice = Number(l.unitPrice ?? boardUnpacked?.unitPrice ?? 0);
        const currency = l.currency || boardUnpacked?.currency || 'EUR';

        const subBrand = (l as any).substituteBrand || boardUnpacked?.substituteBrand || null;
        const subPrchPrice = (l as any).substitutePurchasePrice ?? boardUnpacked?.substitutePurchasePrice ?? null;
        const subCurrency = (l as any).substituteCurrency || boardUnpacked?.substituteCurrency || currency;

        return {
          id: l.id || idx + 1,
          orderDetailId: l.id || idx + 1,
          stockId: activeStockId,
          stockCode: activeStockCode,
          impaCode: l.impaCode,
          stockName: activeStockName,
          stockNameTr,
          brand,
          model,
          unit: l.unit || 'PCS',
          orderedQty: activeOrderedQty,
          pickedQty: currentPicked,
          alreadyPackedQty: alreadyPacked,
          isFullyPacked,
          shelfAddress: cleanShelf || 'Tanımsız',
          unitPrice,
          purchasePrice,
          currency,
          substitutionStatus: subStatus,
          substituteStockId: subStockId,
          substituteStockCode: subStockCode,
          substituteStockName: subStockName,
          substituteBrand: subBrand,
          substitutePurchasePrice: subPrchPrice ? Number(subPrchPrice) : undefined,
          substituteCurrency: subCurrency,
          substituteRequestedQty: subRequestedQty,
          substituteNote: subNote,
        };
      });

      setLines(finalLines);

      // Gerçek duruma göre tedarikçinin tamamlanma durumunu güncelle
      const allLinesDone = finalLines.length > 0 && finalLines.every((l) => l.isFullyPacked);
      setIsPackingDone(allLinesDone);

      // Yerel hafızadaki haritayı kolilerdeki gerçek miktarla senkronize et (önceki kayıtları koru)
      const syncMap: Record<string, number> = { ...savedMap };
      finalLines.forEach((l) => {
        const cKey = (l.stockCode || '').trim().toLowerCase();
        const val = Math.max(l.alreadyPackedQty || 0, syncMap[cKey] || 0);
        syncMap[cKey] = val;
        syncMap[String(l.id)] = val;
      });
      await AsyncStorage.setItem(storageKey, JSON.stringify(syncMap)).catch(() => {});
      await savePackingSupplierStatus(targetOId, Number(supplierId || 0), {
        isCompleted: allLinesDone,
        packedCount: finalLines.filter((l) => l.isFullyPacked).length,
        totalCount: finalLines.length,
        packedQty: finalLines.reduce((sum, l) => sum + (l.alreadyPackedQty || 0), 0),
        totalQty: finalLines.reduce((sum, l) => sum + l.orderedQty, 0),
        lineQuantities: syncMap,
      });

      if (!allLinesDone) {
        await AsyncStorage.removeItem(`@packing_order_completed_${targetOId}`).catch(() => {});
      }
    } catch (err: any) {
      showToast({ message: err?.message || 'Ürün kalemleri yüklenemedi', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId, orderId, supplierId, routeReceiptCompleted]);

  useEffect(() => {
    fetchPackingData();
  }, [fetchPackingData]);

  // Canlı SignalR Bildirimlerine ve Görev Yenilemelerine Abone Ol
  useEffect(() => {
    const unsubscribe = terminalNotificationService.subscribe((event) => {
      if (
        event.type === 'substitution_resolved' ||
        event.type === 'reload_tasks' ||
        event.type === 'reload_warehouse' ||
        event.type === 'notification'
      ) {
        console.log('[PackingBoard] Canlı bildirim/SignalR alındı, veriler yenileniyor:', event.type);
        fetchPackingData();
      }
    });
    return () => unsubscribe();
  }, [fetchPackingData]);

  // Ekranda muadil onayı bekleyen (Pending) ürün varsa her 10 saniyede bir durumunu yokla
  useEffect(() => {
    const pendingLines = lines.filter((l) => l.substitutionStatus === 'Pending');
    if (pendingLines.length === 0) return;

    const interval = setInterval(async () => {
      try {
        let hasChanged = false;
        for (const line of pendingLines) {
          const subDto = await getItemSubstitutionStatus(Number(line.orderDetailId || line.id));
          if (subDto && subDto.status && subDto.status !== 'Pending') {
            hasChanged = true;
            const isAppr = subDto.status === 'Approved' || (subDto as any).status === 1;
            FeedbackService.playSuccess();
            showToast({
              message: `🔔 ${line.stockName} için önerilen muadil ${isAppr ? 'ONAYLANDI' : 'REDDEDİLDİ'}!`,
              type: isAppr ? 'success' : 'error',
              duration: 5000,
            });
            break;
          }
        }
        if (hasChanged) {
          await fetchPackingData();
        }
      } catch {}
    }, 10000);

    return () => clearInterval(interval);
  }, [lines, fetchPackingData]);

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
      setPalletTab('boxes');
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

  // Barkod ve QR Kod Okutma Motoru (Akıllı Palet & Koli Ayrıştırma)
  const handleScan = async (scannedCode: string) => {
    if (!scannedCode || !scannedCode.trim()) return;

    let cleanCode = scannedCode.trim();

    // 0. Personel / Operatör Kartı Barkodu Kontrolü (Model 2)
    const matchedOperator = findOperatorByCodeOrId(cleanCode);
    if (matchedOperator) {
      setActiveOperator(matchedOperator);
      FeedbackService.playSuccess();
      showToast({ message: `Depocu: ${matchedOperator.fullName} seçildi`, type: 'success' });
      return;
    }

    // 1. QR Kod URL Formatı Ayrıştırma (Örn: https://gemini.bluehub.tr/PublicPacking/Box?code=BOX-12)
    if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://')) {
      try {
        const match = cleanCode.match(/[?&]code=([^&]+)/i);
        if (match && match[1]) {
          cleanCode = decodeURIComponent(match[1]).trim();
        }
      } catch {
        // ignore
      }
    }

    const normCode = cleanCode.toLowerCase();

    // 2. PALET QR / BARKODU KONTROLÜ
    // PLT-12, PALET-12 veya Palet Adı
    const pltIdMatch = normCode.match(/^(?:plt|palet)[-_]?(\d+)$/i);
    const matchedPallet = (boardData?.pallets || []).find((p) => {
      if (pltIdMatch && Number(pltIdMatch[1]) === p.id) return true;
      if (normCode === `plt-${p.id}` || normCode === `palet-${p.id}`) return true;
      if ((p.vesselName || '').trim().toLowerCase() === normCode) return true;
      if (String(p.id) === normCode) return true;
      return false;
    });

    if (matchedPallet || pltIdMatch || normCode.startsWith('plt-') || normCode.startsWith('palet-')) {
      if (matchedPallet) {
        setSelectedTarget({
          type: 'pallet',
          id: matchedPallet.id,
          name: matchedPallet.vesselName || `Palet-${matchedPallet.id}`,
        });
        setPalletTab('boxes');
        FeedbackService.playSuccess();
        showToast({
          message: `${matchedPallet.vesselName || 'Palet-' + matchedPallet.id} seçildi. Şimdi kolileri okutabilirsiniz.`,
          type: 'info',
        });
        return;
      } else {
        FeedbackService.playError();
        showErrorLock(`Okutulan palet (${cleanCode}) bu siparişte bulunamadı!`);
        return;
      }
    }

    // 3. KOLİ QR / BARKODU KONTROLÜ
    // BOX-12, BOX_12, Koli-1 veya Koli Adı
    const boxIdMatch = normCode.match(/^box[-_]?(\d+)$/i);
    const matchedBox = (boardData?.boxes || []).find((b) => {
      if (boxIdMatch && Number(boxIdMatch[1]) === b.id) return true;
      if (normCode === `box-${b.id}` || normCode === `box${b.id}`) return true;
      if ((b.boxName || '').trim().toLowerCase() === normCode) return true;
      if (String(b.id) === normCode) return true;
      return false;
    });

    // Eğer kod açıkça bir koli QR'ı formatındaysa (BOX-...) veya koli adıyla eşleştiyse:
    if (matchedBox || boxIdMatch || normCode.startsWith('box-') || normCode.startsWith('box_')) {
      if (!matchedBox) {
        FeedbackService.playError();
        showErrorLock(`Okutulan koli (${cleanCode}) bu siparişe/talebe ait değil veya bulunamadı!`);
        return;
      }

      // Koli bulundu!
      // A) Eğer Hedef Seçimi PALET ise: Koliyi Palete Ekle!
      if (selectedTarget?.type === 'pallet') {
        const targetPalletId = selectedTarget.id;
        const targetPalletName = selectedTarget.name;

        // Koli zaten bu palette mi?
        if (matchedBox.palletId === targetPalletId) {
          FeedbackService.playLightImpact();
          showToast({
            message: `${matchedBox.boxName} zaten ${targetPalletName} paletinde yer alıyor.`,
            type: 'info',
          });
          return;
        }

        // Koli başka bir palette mi?
        if (matchedBox.palletId && matchedBox.palletId !== targetPalletId) {
          const otherPallet = (boardData?.pallets || []).find((p) => p.id === matchedBox.palletId);
          const otherPalletName = otherPallet?.vesselName || `Palet-${matchedBox.palletId}`;

          Alert.alert(
            'Koli Başka Palette',
            `"${matchedBox.boxName}" kolisi şu anda "${otherPalletName}" paletine ait.\n\n${targetPalletName} paletine taşınsın mı?`,
            [
              { text: 'Vazgeç', style: 'cancel' },
              {
                text: 'Evet, Taşı',
                onPress: () =>
                  handleAssignBoxToPallet(
                    matchedBox.id,
                    targetPalletId,
                    matchedBox.boxName,
                    targetPalletName
                  ),
              },
            ]
          );
          return;
        }

        // Koli açıkta (boşta) -> Doğrudan palete ekle!
        await handleAssignBoxToPallet(
          matchedBox.id,
          targetPalletId,
          matchedBox.boxName,
          targetPalletName
        );
        return;
      }

      // B) Eğer Hedef Koli ise veya hedef seçilmediyse: Okutulan koliyi aktif hedef yap
      setSelectedTarget({
        type: 'box',
        id: matchedBox.id,
        name: matchedBox.boxName,
      });
      FeedbackService.playSuccess();
      showToast({
        message: `${matchedBox.boxName} aktif hedef koli olarak seçildi.`,
        type: 'info',
      });
      return;
    }

    // 4. ÜRÜN BARKODU KONTROLÜ
    // Koli veya Palet değilse sipariş ürün kalemlerinde aranır
    if (!isReceiptDone) {
      FeedbackService.playError();
      showErrorLock('Bu siparişin Mal Kabulü yapılmamıştır! Mal kabul tamamlanmadan ürünler paketlenemez.');
      return;
    }

    if (!lines || lines.length === 0) {
      FeedbackService.playError();
      showErrorLock('Sipariş kalemleri listesi boş veya yüklenemedi.');
      return;
    }

    const cleanLower = cleanCode.toLowerCase();
    // Yerel satırlarda ara (stockCode, substituteStockCode, impaCode veya id)
    let matchedIndex = lines.findIndex(
      (l) =>
        (l.stockCode && l.stockCode.toLowerCase() === cleanLower) ||
        (l.substituteStockCode && l.substituteStockCode.toLowerCase() === cleanLower) ||
        (l.impaCode && l.impaCode.toLowerCase() === cleanLower) ||
        String(l.id) === cleanCode ||
        String(l.orderDetailId) === cleanCode ||
        (l.substituteStockId && String(l.substituteStockId) === cleanCode)
    );

    // Bulunamazsa API barkod sorgusundan ara
    if (matchedIndex === -1) {
      try {
        const stockData = await getStockByBarcode(cleanCode);
        if (stockData) {
          const sc = (stockData.stockCode || '').toLowerCase();
          const impa = (stockData.impaCode || '').toLowerCase();
          matchedIndex = lines.findIndex(
            (l) =>
              (sc && l.stockCode && l.stockCode.toLowerCase() === sc) ||
              (sc && l.substituteStockCode && l.substituteStockCode.toLowerCase() === sc) ||
              (impa && l.impaCode && l.impaCode.toLowerCase() === impa) ||
              (stockData.id && l.substituteStockId === stockData.id) ||
              (stockData.id && l.stockId === stockData.id)
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
      showErrorLock('Okutulan barkod bu sipariş kalemlerinde bulunamadı!');
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
    // 1. Mal Kabul Durumu Kontrolü - Kullanıcıyı bloklamadan esnek onay sunar
    if (!isReceiptDone) {
      Alert.alert(
        'Mal Kabul Uyarısı',
        'Bu siparişin ürünleri terminalde henüz mal kabulden geçmemiş görünüyor.\n\nMal kabulünü onaylayıp paketlemeyi doğrudan kaydetmek istiyor musunuz?',
        [
          { text: 'Vazgeç', style: 'cancel' },
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
          {
            text: 'Kilidi Aç ve Kaydet',
            style: 'default',
            onPress: async () => {
              try {
                const targetOId = Number(orderId || requestId);
                const sId = Number(supplierId || 0);
                await AsyncStorage.setItem(`@order_receipt_completed_${targetOId}_${sId}`, 'true');
              } catch (e) {}
              setIsReceiptDone(true);
              showToast({ message: 'Paketleme kilidi açıldı, devam ediliyor...', type: 'info' });
              proceedSaveLogic(lines);
            },
          },
        ]
      );
      return;
    }

    proceedSaveLogic(lines);
  };

  const proceedSaveLogic = async (currentLines: PackingLineItem[]) => {
    // 2. Hedef Koli/Palet Kontrolü - Yoksa otomatik Koli-1 oluştur veya seç
    let activeTarget = selectedTarget;
    if (!activeTarget) {
      if (boardData?.boxes && boardData.boxes.length > 0) {
        activeTarget = { type: 'box', id: boardData.boxes[0].id, name: boardData.boxes[0].boxName };
        setSelectedTarget(activeTarget);
      } else {
        try {
          const targetReqId = Number(requestId || orderId);
          const createRes = await createBox({ requestId: targetReqId, boxName: 'Koli-1' });
          const newId = createRes.boxId || createRes.data?.id || createRes.id || 1;
          activeTarget = { type: 'box', id: newId, name: 'Koli-1' };
          setSelectedTarget(activeTarget);
        } catch (e) {
          showToast({ message: 'Lütfen hedef bir koli veya palet seçin.', type: 'error' });
          return;
        }
      }
    }

    const hasNewItems = currentLines.some((l) => (l.pickedQty || 0) > 0);
    if (!hasNewItems && isAllComplete) {
      Alert.alert(
        'Paketleme Tamamlandı',
        `Bu tedarikçiye ait tüm ürünler (${totalOrdered} adet) zaten paketlenmiştir. Ne yapmak istersiniz?`,
        [
          { text: 'Kapat', style: 'cancel' },
          {
            text: 'Etiket Yazdır',
            onPress: handleDirectPrintBox,
          },
          {
            text: 'Kolileri İncele / Taşı',
            onPress: () => {
              const b = boardData?.boxes?.find((x) => x.id === activeTarget?.id) || boardData?.boxes?.[0] || null;
              setInspectingBox(b);
              setBoxDetailsModalVisible(true);
            },
          },
        ]
      );
      return;
    }

    const itemsToPack = currentLines.filter((l) => (l.pickedQty || 0) > 0);

    // Eğer kullanıcı henüz miktar girmeden kaydet dediyse
    if (itemsToPack.length === 0) {
      const unpackedLines = currentLines.filter((l) => !l.isFullyPacked);
      const unpackedTotal = unpackedLines.reduce((acc, l) => acc + l.orderedQty, 0);

      Alert.alert(
        'Paketleme Miktarı Onayı',
        `Henüz paketleme adeti seçilmedi. Kalan sipariş kalemleri (${unpackedTotal} adet) doğrudan "${activeTarget.name}" içine paketlenip kaydedilsin mi?`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Tümünü Paketle ve Kaydet',
            onPress: () => {
              const filledLines = currentLines.map((l) => ({
                ...l,
                pickedQty: l.orderedQty,
                isFullyPacked: true,
              }));
              setLines(filledLines);
              persistPackingState(filledLines);
              executeSavePacking(filledLines, activeTarget!);
            },
          },
        ]
      );
      return;
    }

    await executeSavePacking(currentLines, activeTarget!);
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

  const executeSavePacking = async (linesToSave: PackingLineItem[], targetToUse?: { type: 'box' | 'pallet'; id: number; name: string }) => {
    const itemsToPack = linesToSave.filter((l) => (l.pickedQty || 0) > 0);
    if (itemsToPack.length === 0) {
      showToast({ message: 'Paketlenecek ürün kalemi bulunamadı.', type: 'info' });
      return;
    }

    const target = targetToUse || selectedTarget;
    if (!target) {
      showToast({ message: 'Lütfen hedef bir koli veya palet seçin.', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      FeedbackService.playLightImpact();

      const targetReqId = Number(requestId || orderId);
      const targetOId = Number(orderId || requestId);

      // Sunucuya aktarım (Bulk Assign with sequential fallback)
      await assignItemsBulk({
        requestId: targetReqId,
        boxId: target.type === 'box' ? target.id : null,
        palletId: target.type === 'pallet' ? target.id : null,
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
      const isAllDone = linesToSave.every(
        (l) => (l.alreadyPackedQty || 0) + (l.pickedQty || 0) >= l.orderedQty && l.orderedQty > 0
      );
      if (isAllDone && supplierId && targetOId) {
        completeSupplierPacking(targetOId, Number(supplierId)).catch((e) =>
          console.warn('completeSupplierPacking err:', e)
        );
        useNotificationStore.getState().addNotification({
          type: 'PACKING_COMPLETED',
          title: `Paketleme Tamamlandı: ${supplierName || documentNo || 'Sipariş'}`,
          message: `${documentNo || `ORD-${targetOId}`} siparişinin ${supplierName ? `(${supplierName}) ` : ''}paketlemesi tamamlandı. Sevkiyata hazır!`,
          orderId: targetOId,
          documentNo: documentNo || `ORD-${targetOId}`,
          rfqNo: rfqNo,
          supplierId: Number(supplierId),
          supplierName: supplierName,
          targetRole: 'RESPONSIBLE',
        }).catch(() => {});
      }

      // Yerel hafızaya her zaman kalıcı kaydet
      await persistPackingState(linesToSave);

      // Ekranda hemen güncellenmiş paketleme miktarlarını göster
      setLines((prev) =>
        prev.map((l) => {
          const itemPacked = itemsToPack.find(
            (it) => it.orderDetailId === l.orderDetailId || (it.stockCode && it.stockCode.trim().toLowerCase() === (l.stockCode || '').trim().toLowerCase())
          );
          if (itemPacked) {
            const newTotal = (l.alreadyPackedQty || 0) + (itemPacked.pickedQty || 0);
            return {
              ...l,
              alreadyPackedQty: newTotal,
              pickedQty: 0,
              isFullyPacked: newTotal >= l.orderedQty && l.orderedQty > 0,
            };
          }
          return l;
        })
      );

      FeedbackService.playSuccess();
      showToast({
        message: `${itemsToPack.length} kalem ürün ${target.name} içine paketlendi ve kaydedildi.`,
        type: 'success',
      });

      const targetName = target.name;
      const targetType = target.type;
      const targetId = target.id;
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
        `${itemCount} kalem (${totalQtySum} adet) ürün "${targetName}" içine paketlendi. Ne yapmak istersiniz?`,
        [
          {
            text: 'Paketlemeye Devam Et',
            style: 'default',
            onPress: () => {
              fetchPackingData();
            },
          },
          {
            text: 'Geri Dön',
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

  // Koliden Ürün Çıkarma (Unpack)
  const handleRemoveItem = async (lineOrId: WMS_PackingLineVM | number, boxOrName?: WMS_BoxVM | string) => {
    let lineItem: WMS_PackingLineVM | undefined;
    let sourceBox: WMS_BoxVM | undefined;

    if (typeof lineOrId === 'object' && lineOrId !== null) {
      lineItem = lineOrId;
      sourceBox = typeof boxOrName === 'object' ? boxOrName : inspectingBox || undefined;
    } else {
      const lId = lineOrId;
      sourceBox = typeof boxOrName === 'object' ? boxOrName : inspectingBox || undefined;
      const allLines = sourceBox?.lines || sourceBox?.items || [];
      lineItem = allLines.find((l) => l.id === lId);
      if (!lineItem && boardData?.boxes) {
        for (const b of boardData.boxes) {
          const found = (b.lines || b.items || []).find((l) => l.id === lId);
          if (found) {
            lineItem = found;
            sourceBox = b;
            break;
          }
        }
      }
      if (!lineItem) {
        lineItem = {
          id: lId,
          qty: 1,
          stockName: typeof boxOrName === 'string' ? boxOrName : 'Ürün',
          stockCode: '',
        };
      }
    }

    const stockName = lineItem.stockName || lineItem.stockCode || 'Ürün';
    const qty = Number(lineItem.qty || 1);
    const lineId = lineItem.id;
    const stockCode = (lineItem.stockCode || '').trim();
    const sCodeLower = stockCode.toLowerCase();
    const orderDetailId = lineItem.orderDetailId;
    const boxId = sourceBox?.id || inspectingBox?.id;

    Alert.alert(
      'Koliden Çıkar',
      `"${stockName}" (${qty} adet) ürününü bu koliden çıkarmak istediğinize emin misiniz?\n\nÜrün koliden çıkarılarak tekrar bekleyen paketleme listesine aktarılacaktır.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Koliden Çıkar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              FeedbackService.playLightImpact();

              const targetReqId = Number(requestId || orderId || 0);
              const targetOId = Number(orderId || requestId || 0);
              const sId = Number(supplierId || 0);

              // 1. Sunucu ve yerel koli önbelleğinden çıkar
              await removeItemFromPacking(lineId, {
                requestId: targetReqId,
                boxId,
                orderDetailId,
                stockCode,
                qty,
              });

              // 2. Telefon hafızasındaki (@packing_state) paketlenmiş miktarı kesin olarak düşür
              const storageKey = `@packing_state_${targetOId}_${sId}`;
              try {
                const savedStr = await AsyncStorage.getItem(storageKey);
                if (savedStr) {
                  const savedMap: Record<string, number> = JSON.parse(savedStr);
                  const currentVal = Math.max(
                    Number(savedMap[sCodeLower] || 0),
                    Number(orderDetailId ? savedMap[String(orderDetailId)] || 0 : 0),
                    Number(savedMap[String(lineId)] || 0)
                  );
                  const newVal = Math.max(0, currentVal - qty);
                  if (sCodeLower) savedMap[sCodeLower] = newVal;
                  if (orderDetailId) savedMap[String(orderDetailId)] = newVal;
                  savedMap[String(lineId)] = newVal;
                  const updatedLinesAfterRemove = lines.map((l) => {
                    const isMatch =
                      (orderDetailId && l.orderDetailId === orderDetailId) ||
                      (sCodeLower && l.stockCode && l.stockCode.trim().toLowerCase() === sCodeLower);
                    if (isMatch) {
                      const newP = Math.max(0, (l.alreadyPackedQty || 0) - qty);
                      return { ...l, alreadyPackedQty: newP, pickedQty: newP, isFullyPacked: false };
                    }
                    return l;
                  });

                  await AsyncStorage.setItem(storageKey, JSON.stringify(savedMap));

                  await savePackingSupplierStatus(targetOId, sId, {
                    isCompleted: false,
                    packedCount: updatedLinesAfterRemove.filter((l) => l.isFullyPacked).length,
                    totalCount: updatedLinesAfterRemove.length,
                    packedQty: updatedLinesAfterRemove.reduce((sum, l) => sum + (l.alreadyPackedQty || 0), 0),
                    totalQty: updatedLinesAfterRemove.reduce((sum, l) => sum + l.orderedQty, 0),
                    lineQuantities: savedMap,
                  });
                }
              } catch (storageErr) {
                console.warn('Storage decrement err:', storageErr);
              }

              // 3. Sipariş tamamlanma bayrağını temizle
              if (targetOId) {
                await AsyncStorage.removeItem(`@packing_order_completed_${targetOId}`).catch(() => {});
              }

              // 4. İnceleme modalındaki kutudan anında çıkar
              setInspectingBox((prev) => {
                if (!prev) return null;
                const newLines = (prev.lines || prev.items || []).filter(
                  (l: any) =>
                    l.id !== lineId &&
                    !(orderDetailId && l.orderDetailId === orderDetailId) &&
                    !(sCodeLower && l.stockCode && l.stockCode.trim().toLowerCase() === sCodeLower)
                );
                return { ...prev, lines: newLines, items: newLines, itemCount: newLines.length };
              });

              // 5. Tahtadaki tüm kutu ve paletlerden bu satırı anında temizle
              setBoardData((prev) => {
                if (!prev) return prev;
                const filterFn = (l: any) =>
                  l.id !== lineId &&
                  !(orderDetailId && l.orderDetailId === orderDetailId) &&
                  !(sCodeLower && l.stockCode && l.stockCode.trim().toLowerCase() === sCodeLower);

                const updateBox = (b: WMS_BoxVM) => {
                  if (boxId && b.id !== boxId) return b;
                  const bLines = (b.lines || b.items || []).filter(filterFn);
                  return { ...b, lines: bLines, items: bLines, itemCount: bLines.length };
                };
                const newBoxes = (prev.boxes || []).map(updateBox);
                const newPallets = (prev.pallets || []).map((p) => ({
                  ...p,
                  boxes: (p.boxes || []).map(updateBox),
                  lines: (p.lines || p.items || []).filter(filterFn),
                  items: (p.items || []).filter(filterFn),
                }));
                return { ...prev, boxes: newBoxes, pallets: newPallets };
              });

              // 6. Ekrandaki kalem listesini güncelle (paketlenen miktar anında azalır)
              setLines((prev) =>
                prev.map((l) => {
                  const isMatch =
                    (orderDetailId && l.orderDetailId === orderDetailId) ||
                    (sCodeLower && l.stockCode && l.stockCode.trim().toLowerCase() === sCodeLower);
                  if (isMatch) {
                    const newPacked = Math.max(0, (l.alreadyPackedQty || 0) - qty);
                    return {
                      ...l,
                      alreadyPackedQty: newPacked,
                      pickedQty: newPacked,
                      isFullyPacked: false,
                    };
                  }
                  return l;
                })
              );

              setIsPackingDone(false);
              FeedbackService.playSuccess();
              showToast({ message: `${stockName} (${qty} adet) koliden çıkarıldı.`, type: 'success' });
              setBoxDetailsModalVisible(false);

              // 7. Verileri tazele
              await fetchPackingData();
            } catch (err: any) {
              FeedbackService.playError();
              showToast({ message: err?.message || 'Ürün koliden çıkarılamadı.', type: 'error' });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // Koli İçi Transfer Modalı Açma
  const handleOpenTransferModal = (line: WMS_PackingLineVM, sourceBox: WMS_BoxVM) => {
    setItemToTransfer({ line, sourceBox });
    setTransferQtyInput(String(line.qty || 1));
    // Başlangıç hedef koli olarak listedeki ilk diğer koliyi seç
    const otherBox = boardData?.boxes?.find((b) => b.id !== sourceBox.id);
    setTransferTargetBoxId(otherBox ? otherBox.id : null);
    setTransferModalVisible(true);
  };

  // Koli İçi Transfer Gerçekleştirme
  const handleExecuteTransfer = async () => {
    if (!itemToTransfer) return;
    const qtyToMove = parseFloat(transferQtyInput);
    if (!qtyToMove || qtyToMove <= 0) {
      showToast({ message: 'Lütfen geçerli bir taşınacak adet girin.', type: 'error' });
      return;
    }
    if (qtyToMove > itemToTransfer.line.qty) {
      showToast({ message: `Maksimum ${itemToTransfer.line.qty} adet taşıyabilirsiniz.`, type: 'error' });
      return;
    }
    if (!transferTargetBoxId) {
      showToast({ message: 'Lütfen hedef bir koli seçin veya yeni koli oluşturun.', type: 'error' });
      return;
    }
    if (transferTargetBoxId === itemToTransfer.sourceBox.id) {
      showToast({ message: 'Hedef koli kaynak koli ile aynı olamaz.', type: 'error' });
      return;
    }

    try {
      setTransferring(true);
      FeedbackService.playLightImpact();

      await moveItemBetweenBoxes({
        lineId: itemToTransfer.line.id,
        orderDetailId: itemToTransfer.line.orderDetailId || 0,
        sourceBoxId: itemToTransfer.sourceBox.id,
        targetBoxId: transferTargetBoxId,
        qty: qtyToMove,
        totalInSource: itemToTransfer.line.qty,
        stockCode: itemToTransfer.line.stockCode,
        stockName: itemToTransfer.line.stockName,
        unit: itemToTransfer.line.unit,
      });

      FeedbackService.playSuccess();
      showToast({
        message: `${qtyToMove} adet ${itemToTransfer.line.stockName} başarıyla hedef koliye taşındı.`,
        type: 'success',
      });

      setTransferModalVisible(false);
      setItemToTransfer(null);
      setBoxDetailsModalVisible(false);
      await fetchPackingData();
    } catch (err: any) {
      FeedbackService.playError();
      showToast({ message: err?.message || 'Transfer gerçekleştirilemedi.', type: 'error' });
    } finally {
      setTransferring(false);
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
          <View style={styles.brandModelRow}>
            {!!item.brand ? (
              <View style={styles.brandBadge}>
                <CustomIcon name="tag-outline" size={11} color="#4338CA" />
                <Text style={styles.brandBadgeText} numberOfLines={1}>
                  Marka: {item.brand}
                </Text>
              </View>
            ) : (
              <View style={[styles.brandBadge, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                <CustomIcon name="tag-outline" size={11} color="#94A3B8" />
                <Text style={[styles.brandBadgeText, { color: '#64748B' }]} numberOfLines={1}>
                  Marka: Belirtilmemiş
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

          {/* Satılan Ürün Maliyeti ve Satış Fiyatı */}
          <View style={styles.priceCostRow}>
            <View style={styles.costBadge}>
              <CustomIcon name="calculator" size={11} color="#B45309" />
              <Text style={styles.costBadgeLabel}>Maliyet: </Text>
              <Text style={styles.costBadgeValue}>
                {item.purchasePrice !== undefined && item.purchasePrice > 0
                  ? `${Number(item.purchasePrice).toFixed(2)} ${item.currency || 'EUR'}`
                  : '0.00 ' + (item.currency || 'EUR')}
              </Text>
            </View>
            <View style={styles.priceBadge}>
              <CustomIcon name="currency-usd" size={12} color="#047857" />
              <Text style={styles.priceBadgeLabel}>Satış: </Text>
              <Text style={styles.priceBadgeValue}>
                {item.unitPrice !== undefined && item.unitPrice > 0
                  ? `${Number(item.unitPrice).toFixed(2)} ${item.currency || 'EUR'}`
                  : '0.00 ' + (item.currency || 'EUR')}
              </Text>
            </View>
          </View>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.fullyPackedBadge}>
                  <CustomIcon name="check-circle" size={16} color={Colors.success} />
                  <Text style={styles.fullyPackedText}>{received} {item.unit || 'PCS'}</Text>
                </View>
                <TouchableOpacity
                  style={{
                    padding: 6,
                    borderRadius: 6,
                    backgroundColor: '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => {
                    handleRemoveItem({
                      id: item.orderDetailId || item.id,
                      orderDetailId: item.orderDetailId || item.id,
                      stockCode: item.stockCode,
                      stockName: item.stockName,
                      qty: item.alreadyPackedQty || item.pickedQty || 1,
                      unit: item.unit,
                    } as any);
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <CustomIcon name="trash-can-outline" size={16} color={Colors.error} />
                </TouchableOpacity>
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
                      handleRemoveItem({
                        id: item.orderDetailId || item.id,
                        orderDetailId: item.orderDetailId || item.id,
                        stockCode: item.stockCode,
                        stockName: item.stockName,
                        qty: item.alreadyPackedQty || item.pickedQty || 1,
                        unit: item.unit,
                      } as any);
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

        {/* Muadil Ürün Durum Bildirimleri */}
        {item.substitutionStatus === 'Pending' && (
          <View style={styles.substitutionStatusBoxPending}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CustomIcon name="clock-outline" size={14} color="#B45309" />
              <Text style={styles.substitutionStatusTextPending} numberOfLines={1}>
                Muadil Onayı Bekliyor: {item.substituteStockCode || 'Muadil'} ({item.substituteRequestedQty} {item.unit || 'PCS'})
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginLeft: 20 }}>
              <View style={[styles.subDetailChip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                <Text style={[styles.subDetailChipText, { color: '#92400E' }]}>
                  Önerilen Marka: {item.substituteBrand || 'Belirtilmemiş'}
                </Text>
              </View>
              {item.substitutePurchasePrice !== undefined && item.substitutePurchasePrice > 0 && (
                <View style={[styles.subDetailChip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                  <Text style={[styles.subDetailChipText, { color: '#92400E', fontWeight: '700' }]}>
                    Önerilen Maliyet: {Number(item.substitutePurchasePrice).toFixed(2)} {item.substituteCurrency || item.currency || 'EUR'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
        {item.substitutionStatus === 'Approved' && (
          <View style={styles.substitutionStatusBoxApproved}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CustomIcon name="check-circle-outline" size={14} color="#047857" />
              <Text style={styles.substitutionStatusTextApproved} numberOfLines={1}>
                Muadil Onaylandı: {item.substituteStockCode} ({item.substituteRequestedQty} {item.unit || 'PCS'})
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginLeft: 20 }}>
              <View style={[styles.subDetailChip, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
                <Text style={[styles.subDetailChipText, { color: '#065F46' }]}>
                  Onaylanan Marka: {item.substituteBrand || 'Belirtilmemiş'}
                </Text>
              </View>
              {item.substitutePurchasePrice !== undefined && item.substitutePurchasePrice > 0 && (
                <View style={[styles.subDetailChip, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
                  <Text style={[styles.subDetailChipText, { color: '#065F46', fontWeight: '700' }]}>
                    Muadil Maliyet: {Number(item.substitutePurchasePrice).toFixed(2)} {item.substituteCurrency || item.currency || 'EUR'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
        {item.substitutionStatus === 'Rejected' && (
          <View style={styles.substitutionStatusBoxRejected}>
            <CustomIcon name="close-circle-outline" size={14} color="#DC2626" />
            <Text style={styles.substitutionStatusTextRejected} numberOfLines={1}>
              Muadil Reddedildi: {item.substituteNote || 'Onaylanmadı'}
            </Text>
          </View>
        )}

        {/* Hızlı Aksiyon: Tamamı Geldi / Barkod Okutma Uyarısı / Muadil Butonu */}
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
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              {isGemini ? (
                <TouchableOpacity
                  style={[styles.geminiScanPromptBtn, { flex: 1 }]}
                  onPress={() => setShowCameraScanner(true)}
                  activeOpacity={0.7}
                >
                  <CustomIcon name="barcode-scan" size={15} color={Colors.primary} />
                  <Text style={styles.geminiScanPromptText}>
                    Barkod Okutun
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.quickFillBtn, { flex: 1 }, received === ordered && styles.quickFillBtnActive]}
                  onPress={() => handleQuickFill(item.id, ordered)}
                  activeOpacity={0.7}
                >
                  <CustomIcon
                    name={received === ordered ? 'check-circle' : 'clipboard-check-outline'}
                    size={16}
                    color={received === ordered ? Colors.success : Colors.primary}
                  />
                  <Text style={[styles.quickFillText, received === ordered && { color: Colors.success }]} numberOfLines={1}>
                    {received === ordered ? 'Tamamı Geldi' : `Tamamı (${ordered})`}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Muadil Ürün Öner / Talep Et Butonu */}
              <TouchableOpacity
                style={styles.substituteActionBtn}
                onPress={() => handleOpenSubstitutionModal(item)}
                activeOpacity={0.7}
              >
                <CustomIcon name="swap-horizontal" size={15} color={Colors.primary} />
                <Text style={styles.substituteActionBtnText}>Muadil Öner</Text>
              </TouchableOpacity>
            </View>
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
        {/* Depocu / Operatör Seçici (Model 2) */}
        <OperatorBadge style={{ marginBottom: Spacing.sm }} />

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
                <Text style={{ ...Typography.bodySm, fontWeight: '600', color: Colors.onSurface }}>
                  {rfqNo}
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
            <TouchableOpacity
              style={[styles.inspectBoxesBtn, { backgroundColor: '#4338CA' }]}
              onPress={() => {
                const b = boardData?.boxes?.find((x) => x.id === selectedTarget?.id) || boardData?.boxes?.[0] || null;
                setInspectingBox(b);
                setBoxDetailsModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <CustomIcon name="package-variant" size={13} color="#fff" />
              <Text style={styles.newBoxBtnText}>İçerik / Taşı</Text>
            </TouchableOpacity>

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

        {/* Gemini Depo Mal Çıkış Bilgisi */}
        {isGemini && !isAllComplete && (
          <View style={styles.geminiWarningBadge}>
            <CustomIcon name="information-outline" size={16} color="#B45309" />
            <Text style={styles.geminiWarningText}>
              Depo ürünleri için barkod okutabilir veya satırlara tıklayarak miktar girebilirsiniz.
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

        {/* Hızlı Aksiyon: Tümünü Sipariş Kadar Doldur */}
        {!isAllComplete && (
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
            placeholder={
              selectedTarget?.type === 'pallet'
                ? 'Koli QR / Ürün barkodu okutun...'
                : 'Ürün barkodunu okutun veya yazın...'
            }
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

      {/* PALET KONSOLİDASYON SEKMESİ (SADECE HEDEF PALETKEN GÖSTERİLİR) */}
      {selectedTarget?.type === 'pallet' && (
        <View style={styles.palletTabBar}>
          <TouchableOpacity
            style={[styles.palletTabBtn, palletTab === 'boxes' && styles.palletTabBtnActive]}
            onPress={() => setPalletTab('boxes')}
            activeOpacity={0.7}
          >
            <CustomIcon
              name="package-variant-closed"
              size={16}
              color={palletTab === 'boxes' ? Colors.primary : Colors.outline}
            />
            <Text
              style={[
                styles.palletTabText,
                palletTab === 'boxes' && styles.palletTabTextActive,
              ]}
            >
              Paletteki Koliler ({boxesInSelectedPallet.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.palletTabBtn, palletTab === 'items' && styles.palletTabBtnActive]}
            onPress={() => setPalletTab('items')}
            activeOpacity={0.7}
          >
            <CustomIcon
              name="format-list-bulleted"
              size={16}
              color={palletTab === 'items' ? Colors.primary : Colors.outline}
            />
            <Text
              style={[
                styles.palletTabText,
                palletTab === 'items' && styles.palletTabTextActive,
              ]}
            >
              Dökme Ürünler ({lines.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ANA İÇERİK ALANI */}
      {selectedTarget?.type === 'pallet' && palletTab === 'boxes' ? (
        /* PALETLEME & KONSOLİDASYON GÖRÜNÜMÜ */
        <ScrollView
          style={styles.palletBoxesScroll}
          contentContainerStyle={styles.palletBoxesScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchPackingData}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Palet Özet Kartı */}
          <View style={styles.palletSummaryCard}>
            <View style={styles.palletSummaryHeader}>
              <View style={styles.palletSummaryTitleRow}>
                <CustomIcon name="truck-delivery-outline" size={24} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.palletSummaryTitle}>{selectedTarget.name}</Text>
                  <Text style={styles.palletSummarySub}>Palet Konsolidasyon & Koli Yönetimi</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.palletPrintBtn}
                onPress={() => handlePrintSpecificTarget('pallet', selectedTarget.id, selectedTarget.name)}
                activeOpacity={0.7}
              >
                <CustomIcon name="printer" size={14} color="#fff" />
                <Text style={styles.palletPrintBtnText}>Etiket Bas</Text>
              </TouchableOpacity>
            </View>

            {/* İstatistik Rozetleri */}
            <View style={styles.palletBadgeGroup}>
              <View style={styles.palletBadge}>
                <Text style={styles.palletBadgeLabel}>Koli Sayısı</Text>
                <Text style={styles.palletBadgeVal}>{boxesInSelectedPallet.length} Koli</Text>
              </View>
              <View style={styles.palletBadgeDivider} />
              <View style={styles.palletBadge}>
                <Text style={styles.palletBadgeLabel}>Toplam Kalem</Text>
                <Text style={styles.palletBadgeVal}>{selectedPalletStats.totalItems} Kalem</Text>
              </View>
              <View style={styles.palletBadgeDivider} />
              <View style={styles.palletBadge}>
                <Text style={styles.palletBadgeLabel}>Toplam Ağırlık</Text>
                <Text style={styles.palletBadgeVal}>
                  {selectedPalletStats.totalWeight > 0 ? `${selectedPalletStats.totalWeight.toFixed(1)} kg` : '-'}
                </Text>
              </View>
            </View>
          </View>

          {/* QR Okutma Rehberi / İpucu Kutusu */}
          <View style={styles.palletScanBanner}>
            <CustomIcon name="barcode-scan" size={20} color="#1D4ED8" />
            <Text style={styles.palletScanBannerText}>
              Koli üzerindeki QR kodu kamerayla veya lazerle okuttuğunuzda koli doğrudan bu palete eklenir.
            </Text>
          </View>

          {/* BU PALETTEKİ KOLİLER LİSTESİ */}
          <View style={styles.palletSectionHeaderRow}>
            <Text style={styles.palletSectionTitle}>
              BU PALETTEKİ KOLİLER ({boxesInSelectedPallet.length})
            </Text>
          </View>

          {boxesInSelectedPallet.length === 0 ? (
            <View style={styles.palletEmptyCard}>
              <CustomIcon name="package-variant-closed" size={32} color={Colors.outline} />
              <Text style={styles.palletEmptyText}>Bu palette henüz koli bulunmuyor.</Text>
              <Text style={styles.palletEmptySubText}>
                Koli QR kodunu okutarak veya aşağıdaki listeden butona basarak kolileri ekleyebilirsiniz.
              </Text>
            </View>
          ) : (
            boxesInSelectedPallet.map((box) => (
              <View key={`in-pallet-box-${box.id}`} style={styles.palletBoxCard}>
                <View style={styles.palletBoxCardHeader}>
                  <CustomIcon name="package-variant-closed" size={20} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.palletBoxName}>{box.boxName}</Text>
                    <Text style={styles.palletBoxSubText}>
                      {(box.lines?.length || box.items?.length || 0)} Kalem Ürün
                      {box.grossWeight ? ` • ${box.grossWeight} kg` : ''}
                    </Text>
                  </View>
                  <View style={styles.palletBoxActions}>
                    <TouchableOpacity
                      style={styles.palletBoxInspectBtn}
                      onPress={() => {
                        setInspectingBox(box);
                        setBoxDetailsModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <CustomIcon name="format-list-bulleted" size={13} color={Colors.primary} />
                      <Text style={styles.palletBoxInspectBtnText}>İçerik</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.palletBoxPrintBtn}
                      onPress={() => handlePrintSpecificTarget('box', box.id, box.boxName)}
                      activeOpacity={0.7}
                    >
                      <CustomIcon name="printer" size={14} color={Colors.onSurfaceVariant} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.palletBoxRemoveBtn}
                      onPress={() =>
                        handleUnassignBoxFromPallet(box.id, selectedTarget.id, box.boxName, selectedTarget.name)
                      }
                      activeOpacity={0.7}
                    >
                      <CustomIcon name="close" size={14} color="#EF4444" />
                      <Text style={styles.palletBoxRemoveText}>Çıkar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}

          {/* PALETLENMEMİŞ (AÇIKTAKİ) KOLİLER */}
          <View style={[styles.palletSectionHeaderRow, { marginTop: 18 }]}>
            <Text style={styles.palletSectionTitle}>
              AÇIKTA BEKLEYEN KOLİLER ({unassignedBoxes.length})
            </Text>
          </View>

          {unassignedBoxes.length === 0 ? (
            <View style={[styles.palletEmptyCard, { paddingVertical: 14 }]}>
              <Text style={{ fontSize: 12, color: Colors.outline }}>
                Açıkta bekleyen paletlenmemiş koli bulunmuyor.
              </Text>
            </View>
          ) : (
            unassignedBoxes.map((box) => (
              <View key={`unassigned-box-${box.id}`} style={styles.unassignedBoxCard}>
                <View style={styles.palletBoxCardHeader}>
                  <CustomIcon name="package-variant" size={20} color="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.palletBoxName}>{box.boxName}</Text>
                    <Text style={styles.palletBoxSubText}>
                      {(box.lines?.length || box.items?.length || 0)} Kalem Ürün
                      {box.grossWeight ? ` • ${box.grossWeight} kg` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.palletBoxAddBtn}
                    onPress={() =>
                      handleAssignBoxToPallet(box.id, selectedTarget.id, box.boxName, selectedTarget.name)
                    }
                    activeOpacity={0.7}
                  >
                    <CustomIcon name="plus" size={14} color="#fff" />
                    <Text style={styles.palletBoxAddText}>Palete Ekle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : loading && lines.length === 0 ? (
        /* ÜRÜN LİSTESİ YÜKLENİYOR */
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Ürün kalemleri yükleniyor...</Text>
        </View>
      ) : (
        /* STANDART ÜRÜN LİSTESİ (KOLİ PAKETLEME VEYA PALETE DÖKME ÜRÜN) */
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

      {/* Alt Footer */}
      <View style={styles.footer}>
        {selectedTarget?.type === 'pallet' && palletTab === 'boxes' ? (
          <>
            <View style={styles.footerSummary}>
              <Text style={styles.footerSummaryLabel}>Paletteki Koli</Text>
              <Text style={styles.footerSummaryValue}>
                {boxesInSelectedPallet.length} <Text style={styles.footerSummaryTotal}>Koli</Text>
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#4338CA' }]}
              onPress={() => handlePrintSpecificTarget('pallet', selectedTarget.id, selectedTarget.name)}
              activeOpacity={0.8}
            >
              <View style={styles.saveBtnContent}>
                <CustomIcon name="printer" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Palet Etiketi Yazdır</Text>
              </View>
            </TouchableOpacity>
          </>
        ) : (
          <>
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
          </>
        )}
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
                      <View style={{ flex: 1 }}>
                        <Text style={styles.targetOptionText}>{b.boxName}</Text>
                        <Text style={{ fontSize: 11, color: Colors.outline }}>
                          {(b.lines?.length || b.items?.length || 0)} Kalem Ürün
                        </Text>
                      </View>
                      {selectedTarget?.type === 'box' && selectedTarget.id === b.id ? (
                        <CustomIcon name="check-circle" size={18} color={Colors.primary} />
                      ) : null}
                    </TouchableOpacity>

                    {/* Koli İçerik ve Taşıma Butonu */}
                    <TouchableOpacity
                      style={styles.modalRowDetailsBtn}
                      onPress={() => {
                        setTargetModalVisible(false);
                        setInspectingBox(b);
                        setBoxDetailsModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <CustomIcon name="format-list-bulleted" size={14} color={Colors.primary} />
                      <Text style={styles.modalRowDetailsBtnText}>İçerik</Text>
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
                          setPalletTab('boxes');
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

      {/* KOLİ İÇERİĞİ VE YÖNETİM MODALI */}
      <Modal
        visible={boxDetailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBoxDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.boxModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <CustomIcon name="package-variant-closed" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {inspectingBox?.boxName || 'Koli İçeriği'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setBoxDetailsModalVisible(false)}
                style={styles.modalRowCloseBtn}
                activeOpacity={0.7}
              >
                <CustomIcon name="close" size={20} color={Colors.outline} />
              </TouchableOpacity>
            </View>

            {/* Koli Değiştirme Sekmeleri */}
            {boardData?.boxes && boardData.boxes.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.boxTabsScroll}>
                {boardData.boxes.map((b) => (
                  <TouchableOpacity
                    key={`tab-box-${b.id}`}
                    style={[styles.boxTabPill, inspectingBox?.id === b.id && styles.activeBoxTabPill]}
                    onPress={() => setInspectingBox(b)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.boxTabPillText, inspectingBox?.id === b.id && styles.activeBoxTabPillText]}>
                      {b.boxName} ({(b.lines?.length || b.items?.length || 0)})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Koli Kalemleri Listesi */}
            {(() => {
              const currentBoxLines = inspectingBox?.lines || inspectingBox?.items || [];
              if (currentBoxLines.length === 0) {
                return (
                  <View style={styles.emptyBoxContainer}>
                    <CustomIcon name="package-variant" size={40} color={Colors.outline} />
                    <Text style={styles.emptyBoxText}>Bu koliye henüz ürün eklenmemiş.</Text>
                  </View>
                );
              }
              return (
                <ScrollView style={{ maxHeight: 380, marginVertical: Spacing.sm }} showsVerticalScrollIndicator={false}>
                  {currentBoxLines.map((line, lIdx) => (
                    <View key={`bline-${line.id || lIdx}`} style={styles.boxItemCard}>
                      <View style={styles.boxItemTopRow}>
                        <Text style={styles.boxItemStockCode}>{line.stockCode || 'KOD'}</Text>
                        <View style={styles.boxItemQtyBadge}>
                          <Text style={styles.boxItemQtyText}>{line.qty} {line.unit || 'PCS'}</Text>
                        </View>
                      </View>
                      <Text style={styles.boxItemStockName} numberOfLines={2}>{line.stockName || 'Ürün'}</Text>

                      {/* Aksiyonlar: Taşı & Çıkar */}
                      <View style={styles.boxItemActionsRow}>
                        <TouchableOpacity
                          style={styles.boxItemMoveBtn}
                          onPress={() => handleOpenTransferModal(line, inspectingBox!)}
                          activeOpacity={0.7}
                        >
                          <CustomIcon name="swap-horizontal" size={14} color="#fff" />
                          <Text style={styles.boxItemMoveBtnText}>Başka Koliye Taşı</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.boxItemRemoveBtn}
                          onPress={() => handleRemoveItem(line, inspectingBox!)}
                          activeOpacity={0.7}
                        >
                          <CustomIcon name="trash-can-outline" size={14} color={Colors.error} />
                          <Text style={styles.boxItemRemoveBtnText}>Koliden Çıkar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              );
            })()}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: Spacing.sm }}>
              {inspectingBox && (
                <TouchableOpacity
                  style={[styles.boxModalActionBtn, { backgroundColor: '#059669', flex: 1 }]}
                  onPress={() => handlePrintSpecificTarget('box', inspectingBox.id, inspectingBox.boxName)}
                  activeOpacity={0.8}
                >
                  <CustomIcon name="printer" size={16} color="#fff" />
                  <Text style={styles.boxModalActionBtnText}>Etiket Yazdır</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalCloseBtn, { marginTop: 0, flex: 1 }]}
                onPress={() => setBoxDetailsModalVisible(false)}
              >
                <Text style={styles.modalCloseBtnText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ÜRÜNÜ BAŞKA KOLİYE TAŞIMA (TRANSFER) MODALI */}
      <Modal
        visible={transferModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTransferModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.boxModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <CustomIcon name="swap-horizontal" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Ürünü Başka Koliye Taşı
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setTransferModalVisible(false)}
                style={styles.modalRowCloseBtn}
                activeOpacity={0.7}
              >
                <CustomIcon name="close" size={20} color={Colors.outline} />
              </TouchableOpacity>
            </View>

            {/* Taşınacak Ürün Bilgisi */}
            <View style={styles.transferProductCard}>
              <Text style={styles.transferStockCode}>{itemToTransfer?.line.stockCode}</Text>
              <Text style={styles.transferStockName} numberOfLines={2}>{itemToTransfer?.line.stockName}</Text>
              <View style={styles.transferOriginBadge}>
                <CustomIcon name="package-variant-closed" size={14} color={Colors.primary} />
                <Text style={styles.transferOriginText}>
                  Mevcut Koli: <Text style={{ fontWeight: 'bold' }}>{itemToTransfer?.sourceBox.boxName}</Text> ({itemToTransfer?.line.qty} {itemToTransfer?.line.unit || 'PCS'})
                </Text>
              </View>
            </View>

            {/* Taşınacak Miktar */}
            <Text style={styles.inputLabel}>Taşınacak Miktar:</Text>
            <View style={styles.qtyInputRow}>
              <TouchableOpacity
                style={styles.qtyAdjustBtn}
                onPress={() => {
                  const curr = parseFloat(transferQtyInput) || 1;
                  if (curr > 1) setTransferQtyInput(String(curr - 1));
                }}
                activeOpacity={0.7}
              >
                <CustomIcon name="minus" size={20} color={Colors.primary} />
              </TouchableOpacity>

              <TextInput
                style={styles.largeQtyInput}
                keyboardType="numeric"
                value={transferQtyInput}
                onChangeText={(val) => {
                  const clean = val.replace(/[^0-9]/g, '');
                  setTransferQtyInput(clean);
                }}
                selectTextOnFocus={true}
                maxLength={6}
              />

              <TouchableOpacity
                style={styles.qtyAdjustBtn}
                onPress={() => {
                  const curr = parseFloat(transferQtyInput) || 0;
                  const max = itemToTransfer?.line.qty || 1;
                  if (curr < max) setTransferQtyInput(String(curr + 1));
                }}
                activeOpacity={0.7}
              >
                <CustomIcon name="plus" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Hızlı Miktar Butonları */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.sm }}>
              <TouchableOpacity
                style={styles.qtyPill}
                onPress={() => setTransferQtyInput('1')}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyPillText}>1 Adet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.qtyPill, styles.qtyPillHighlight]}
                onPress={() => setTransferQtyInput(String(itemToTransfer?.line.qty || 1))}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyPillHighlightText}>Tümünü Taşı ({itemToTransfer?.line.qty})</Text>
              </TouchableOpacity>
            </View>

            {/* Hedef Koli Seçimi */}
            <Text style={styles.inputLabel}>Hedef Koli Seçin:</Text>
            <ScrollView style={{ maxHeight: 150, marginBottom: Spacing.sm }}>
              {boardData?.boxes && boardData.boxes.length > 0 ? (
                boardData.boxes
                  .filter((b) => b.id !== itemToTransfer?.sourceBox.id)
                  .map((b) => (
                    <TouchableOpacity
                      key={`target-b-${b.id}`}
                      style={[
                        styles.transferBoxOption,
                        transferTargetBoxId === b.id && styles.activeTransferBoxOption,
                      ]}
                      onPress={() => setTransferTargetBoxId(b.id)}
                      activeOpacity={0.7}
                    >
                      <CustomIcon name="package-variant-closed" size={16} color={Colors.primary} />
                      <Text style={styles.transferBoxOptionText}>
                        {b.boxName} ({(b.lines?.length || b.items?.length || 0)} Kalem)
                      </Text>
                      {transferTargetBoxId === b.id && (
                        <CustomIcon name="check-circle" size={16} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))
              ) : null}

              {/* Hızlı Yeni Koli Aç ve Oraya Taşı */}
              <TouchableOpacity
                style={styles.transferCreateNewBoxBtn}
                onPress={async () => {
                  try {
                    const targetReqId = Number(requestId || orderId);
                    const newBoxName = `Koli-${(boardData?.boxes?.length || 0) + 1}`;
                    const createRes = await createBox({ requestId: targetReqId, boxName: newBoxName });
                    const newId = createRes.boxId || createRes.data?.id || createRes.id || ((boardData?.boxes?.length || 0) + 1);
                    setTransferTargetBoxId(newId);
                    await fetchPackingData();
                    showToast({ message: `${newBoxName} oluşturuldu ve hedef seçildi.`, type: 'info' });
                  } catch (e) {
                    showToast({ message: 'Yeni koli oluşturulamadı.', type: 'error' });
                  }
                }}
                activeOpacity={0.7}
              >
                <CustomIcon name="plus" size={14} color={Colors.primary} />
                <Text style={styles.transferCreateNewBoxText}>+ Yeni Koli Aç ve Hedef Seç</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Butonlar */}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setTransferModalVisible(false);
                  setItemToTransfer(null);
                }}
                disabled={transferring}
              >
                <Text style={styles.modalCancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: Colors.primary }]}
                onPress={handleExecuteTransfer}
                disabled={transferring}
              >
                {transferring ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Transferi Tamamla</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MUADİL ÜRÜN ÖNERİ VE ONAY TALEBİ MODALİ */}
      <Modal
        visible={substitutionModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!sendingSubstitution) {
            setSubstitutionModalVisible(false);
            setSubstitutionLine(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            {/* Başlık */}
            <View style={styles.boxModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <CustomIcon name="swap-horizontal" size={20} color={Colors.primary} />
                <View>
                  <Text style={styles.modalTitle} numberOfLines={1}>Muadil Ürün Talebi</Text>
                  <Text style={styles.modalSubtitle}>Sipariş sorumlusunun onayına gönderilir</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!sendingSubstitution) {
                    setSubstitutionModalVisible(false);
                    setSubstitutionLine(null);
                  }
                }}
                disabled={sendingSubstitution}
                style={styles.modalRowCloseBtn}
                activeOpacity={0.7}
              >
                <CustomIcon name="close" size={20} color={Colors.outline} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Asıl Ürün Bilgisi */}
              {substitutionLine && (
                <View style={styles.subOriginalCard}>
                  <Text style={styles.subOriginalBadge}>ASIL (SİPARİŞTEKİ) ÜRÜN</Text>
                  <Text style={styles.subOriginalCode}>{substitutionLine.stockCode}</Text>
                  <Text style={styles.subOriginalName} numberOfLines={2}>{substitutionLine.stockName}</Text>
                  
                  {/* Marka & Maliyet & Satış Fiyatı */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                    <View style={styles.subBadgeChip}>
                      <CustomIcon name="tag-outline" size={11} color="#4338CA" />
                      <Text style={styles.subBadgeChipText}>Marka: {substitutionLine.brand || 'Belirtilmemiş'}</Text>
                    </View>
                    <View style={[styles.subBadgeChip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                      <CustomIcon name="calculator" size={11} color="#B45309" />
                      <Text style={[styles.subBadgeChipText, { color: '#92400E' }]}>
                        Maliyet: {Number(substitutionLine.purchasePrice || 0).toFixed(2)} {substitutionLine.currency || 'EUR'}
                      </Text>
                    </View>
                    <View style={[styles.subBadgeChip, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                      <CustomIcon name="currency-usd" size={12} color="#047857" />
                      <Text style={[styles.subBadgeChipText, { color: '#065F46' }]}>
                        Satış: {Number(substitutionLine.unitPrice || 0).toFixed(2)} {substitutionLine.currency || 'EUR'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.subOriginalStatsRow}>
                    <Text style={styles.subOriginalStat}>Sipariş: <Text style={{ fontWeight: 'bold' }}>{substitutionLine.orderedQty} {substitutionLine.unit || 'PCS'}</Text></Text>
                    <Text style={[styles.subOriginalStat, { color: Colors.warning }]}>Eksik: <Text style={{ fontWeight: 'bold' }}>{Math.max(1, substitutionLine.orderedQty - ((substitutionLine.alreadyPackedQty || 0) + (substitutionLine.pickedQty || 0)))} {substitutionLine.unit || 'PCS'}</Text></Text>
                  </View>
                </View>
              )}

              {/* Muadil Ürün Arama */}
              <Text style={styles.subSectionTitle}>ÖNERİLECEK MUADİL ÜRÜNÜ SEÇİN</Text>
              <View style={styles.subSearchBox}>
                <CustomIcon name="magnify" size={20} color={Colors.outline} />
                <TextInput
                  style={styles.subSearchInput}
                  placeholder="Barkod, stok kodu veya ürün adı ile arayın..."
                  placeholderTextColor={Colors.outline}
                  value={subSearchQuery}
                  onChangeText={handleSearchSubstituteStocks}
                  autoCapitalize="characters"
                />
                {searchingStocks && <ActivityIndicator size="small" color={Colors.primary} />}
                {subSearchQuery.length > 0 && !searchingStocks && (
                  <TouchableOpacity
                    onPress={() => {
                      setSubSearchQuery('');
                      setSubSearchResults([]);
                    }}
                    style={{ padding: 4 }}
                  >
                    <CustomIcon name="close-circle" size={18} color={Colors.outline} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Sonuç Yok Uyarısı */}
              {subSearchQuery.trim().length >= 2 && !searchingStocks && subSearchResults.length === 0 && !selectedSubstituteStock && (
                <View style={styles.subSearchEmptyBox}>
                  <CustomIcon name="alert-circle-outline" size={18} color={Colors.outline} />
                  <Text style={styles.subSearchEmptyText}>Arama kriterine uygun stok bulunamadı.</Text>
                </View>
              )}

              {/* Arama Sonuçları */}
              {subSearchResults.length > 0 && !selectedSubstituteStock && (
                <View style={styles.subSearchResultsWrapper}>
                  <View style={styles.subSearchResultsHeader}>
                    <Text style={styles.subSearchResultsCountText}>
                      Bulunan Muadil Ürünler ({subSearchResults.length})
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setSubSearchResults([]);
                        setSubSearchQuery('');
                      }}
                      style={{ paddingHorizontal: 6, paddingVertical: 2 }}
                    >
                      <Text style={styles.subSearchResultsClearText}>Kapat</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    style={styles.subSearchResultsList}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                  >
                    {subSearchResults.map((stk) => (
                      <TouchableOpacity
                        key={stk.id}
                        style={styles.subSearchResultItem}
                        onPress={() => {
                          setSelectedSubstituteStock(stk);
                          setSubSearchResults([]);
                          setSubSearchQuery('');
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.subResultCode}>{stk.stockCode}</Text>
                          <Text style={styles.subResultName} numberOfLines={2}>{stk.stockName}</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                            <Text style={styles.subResultShelf}>Raf: {stk.shelfAddress || 'Tanımsız'}</Text>
                            <Text style={styles.subResultStock}>
                              Depo Stok: <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{stk.qty || 0} {stk.unit || 'PCS'}</Text>
                            </Text>
                            {!!stk.brand && (
                              <Text style={[styles.subResultShelf, { color: '#4338CA' }]}>Marka: {stk.brand}</Text>
                            )}
                            {(stk.purchasePrice !== undefined || (stk as any).prchPrice !== undefined) && (
                              <Text style={[styles.subResultShelf, { color: '#B45309', fontWeight: '700' }]}>
                                Maliyet: {Number(stk.purchasePrice ?? (stk as any).prchPrice ?? 0).toFixed(2)} {stk.currency || 'EUR'}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.subResultAddBadge}>
                          <CustomIcon name="plus" size={16} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Seçilen Muadil Ürün Kartı */}
              {selectedSubstituteStock && (
                <View style={styles.subSelectedCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subSelectedBadge}>✓ SEÇİLEN MUADİL ÜRÜN</Text>
                      <Text style={styles.subSelectedCode}>{selectedSubstituteStock.stockCode}</Text>
                      <Text style={styles.subSelectedName} numberOfLines={2}>{selectedSubstituteStock.stockName}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedSubstituteStock(null)}
                      style={{ padding: 4 }}
                    >
                      <CustomIcon name="close-circle" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>

                  {/* Marka & Maliyet */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                    <View style={styles.subBadgeChip}>
                      <CustomIcon name="tag-outline" size={11} color="#4338CA" />
                      <Text style={styles.subBadgeChipText}>Marka: {selectedSubstituteStock.brand || 'Belirtilmemiş'}</Text>
                    </View>
                    {(selectedSubstituteStock.purchasePrice !== undefined || (selectedSubstituteStock as any).prchPrice !== undefined) && (
                      <View style={[styles.subBadgeChip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                        <CustomIcon name="calculator" size={11} color="#B45309" />
                        <Text style={[styles.subBadgeChipText, { color: '#92400E', fontWeight: '700' }]}>
                          Maliyet: {Number(selectedSubstituteStock.purchasePrice ?? (selectedSubstituteStock as any).prchPrice ?? 0).toFixed(2)} {selectedSubstituteStock.currency || 'EUR'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.subSelectedStatsRow}>
                    <Text style={styles.subSelectedStat}>Raf: {selectedSubstituteStock.shelfAddress || 'Tanımsız'}</Text>
                    <Text style={styles.subSelectedStat}>Mevcut Stok: <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{selectedSubstituteStock.qty || 0} {selectedSubstituteStock.unit || 'PCS'}</Text></Text>
                  </View>
                </View>
              )}

              {/* Talep Edilen Muadil Miktar */}
              <View style={{ marginTop: Spacing.sm }}>
                <Text style={styles.subSectionTitle}>TALEP EDİLEN MUADİL MİKTAR</Text>
                <TextInput
                  style={styles.subQtyInput}
                  keyboardType="numeric"
                  value={substituteQty}
                  onChangeText={setSubstituteQty}
                  placeholder="0"
                  placeholderTextColor={Colors.outline}
                />
              </View>

              {/* Sorumluya İletilecek Not & Hızlı Etiketler */}
              <View style={{ marginTop: Spacing.sm }}>
                <Text style={styles.subSectionTitle}>SORUMLUYA NOT / DEĞİŞİKLİK GEREKÇESİ</Text>
                <View style={styles.quickChipsRow}>
                  {['Orijinal Stok Kalmadı', 'Kırık / Hasarlı', 'Teknik Muadili', 'Müşteri Acil Bekliyor'].map((chip) => (
                    <TouchableOpacity
                      key={chip}
                      style={[
                        styles.quickChip,
                        substituteNote.includes(chip) && styles.quickChipActive,
                      ]}
                      onPress={() => {
                        if (substituteNote.includes(chip)) {
                          setSubstituteNote((prev) =>
                            prev.split(',').map((s) => s.trim()).filter((s) => s && s !== chip).join(', ')
                          );
                        } else {
                          setSubstituteNote((prev) => (prev ? `${prev}, ${chip}` : chip));
                        }
                      }}
                    >
                      <Text style={[styles.quickChipText, substituteNote.includes(chip) && styles.quickChipTextActive]}>
                        {chip}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.subNoteInput}
                  placeholder="Sipariş sorumlusuna iletilecek açıklama..."
                  placeholderTextColor={Colors.outline}
                  value={substituteNote}
                  onChangeText={setSubstituteNote}
                  multiline={true}
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            {/* Aksiyon Butonları */}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setSubstitutionModalVisible(false);
                  setSubstitutionLine(null);
                }}
                disabled={sendingSubstitution}
              >
                <Text style={styles.modalCancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  { backgroundColor: Colors.primary },
                  (!selectedSubstituteStock || sendingSubstitution) && { opacity: 0.6 },
                ]}
                onPress={handleSendSubstitutionRequest}
                disabled={!selectedSubstituteStock || sendingSubstitution}
              >
                {sendingSubstitution ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Sorumluya Onaya Gönder</Text>
                )}
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
  modalSubtitle: {
    ...Typography.bodySm,
    color: Colors.outline,
    marginTop: -4,
    marginBottom: Spacing.xs,
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
  inspectBoxesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4338CA',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.xs,
  },
  modalRowDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
  },
  modalRowDetailsBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  boxModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  boxTabsScroll: {
    marginBottom: Spacing.sm,
    maxHeight: 38,
  },
  boxTabPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.xs,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  activeBoxTabPill: {
    backgroundColor: '#E0E7FF',
    borderColor: '#4338CA',
  },
  boxTabPillText: {
    fontSize: 12,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  activeBoxTabPillText: {
    color: '#4338CA',
    fontWeight: 'bold',
  },
  emptyBoxContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyBoxText: {
    fontSize: 13,
    color: Colors.outline,
  },
  boxItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  boxItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  boxItemStockCode: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  boxItemQtyBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  boxItemQtyText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#15803D',
  },
  boxItemStockName: {
    fontSize: 12.5,
    color: Colors.onSurface,
    marginBottom: 8,
  },
  boxItemActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  boxItemMoveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4338CA',
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
  },
  boxItemMoveBtnText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#fff',
  },
  boxItemRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
  },
  boxItemRemoveBtnText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: Colors.error,
  },
  boxModalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: BorderRadius.sm,
  },
  boxModalActionBtnText: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: '#fff',
  },
  transferProductCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  transferStockCode: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  transferStockName: {
    fontSize: 12.5,
    color: Colors.onSurface,
    marginVertical: 3,
  },
  transferOriginBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  transferOriginText: {
    fontSize: 11.5,
    color: Colors.primary,
  },
  transferBoxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.xs,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginBottom: 6,
  },
  activeTransferBoxOption: {
    backgroundColor: '#E0E7FF',
    borderColor: '#4338CA',
  },
  transferBoxOptionText: {
    fontSize: 12.5,
    color: Colors.onSurface,
    flex: 1,
    marginLeft: 6,
  },
  transferCreateNewBoxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  transferCreateNewBoxText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  substituteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: BorderRadius.xs,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  substituteActionBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  substitutionStatusBoxPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  substitutionStatusTextPending: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#B45309',
    flex: 1,
  },
  substitutionStatusBoxApproved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  substitutionStatusTextApproved: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#047857',
    flex: 1,
  },
  substitutionStatusBoxRejected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  substitutionStatusTextRejected: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#DC2626',
    flex: 1,
  },
  subOriginalCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  subOriginalBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.outline,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subOriginalCode: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  subOriginalName: {
    fontSize: 12.5,
    color: Colors.onSurfaceVariant,
    marginVertical: 2,
  },
  subOriginalStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  subOriginalStat: {
    fontSize: 12,
    color: Colors.onSurface,
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginBottom: 8,
  },
  subSearchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.onSurface,
    padding: 0,
  },
  subSearchResultsWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.xs,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    marginTop: 4,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  subSearchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  subSearchResultsCountText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  subSearchResultsClearText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.error,
  },
  subSearchResultsList: {
    maxHeight: 190,
    backgroundColor: '#ffffff',
  },
  subSearchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subResultCode: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  subResultName: {
    fontSize: 12,
    color: Colors.onSurface,
  },
  subResultShelf: {
    fontSize: 11,
    color: '#047857',
  },
  subResultStock: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  subResultAddBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subSearchEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subSearchEmptyText: {
    fontSize: 12,
    color: Colors.outline,
  },
  subSelectedCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: BorderRadius.xs,
    padding: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: 8,
  },
  subSelectedBadge: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 2,
  },
  subSelectedCode: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  subSelectedName: {
    fontSize: 12,
    color: Colors.onSurface,
    marginTop: 2,
  },
  subSelectedStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
  },
  subSelectedStat: {
    fontSize: 11.5,
    color: Colors.onSurface,
  },
  subQtyInput: {
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.primary,
    backgroundColor: '#fff',
  },
  subNoteInput: {
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.xs,
    padding: 10,
    fontSize: 12.5,
    color: Colors.onSurface,
    backgroundColor: '#fff',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  quickChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  quickChipActive: {
    backgroundColor: '#E0E7FF',
    borderColor: Colors.primary,
  },
  quickChipText: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  quickChipTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  // PALET KONSOLİDASYON MODU STİLLERİ
  palletTabBar: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: BorderRadius.sm,
    padding: 3,
    marginHorizontal: Spacing.md,
    marginTop: 6,
    marginBottom: 6,
  },
  palletTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: BorderRadius.xs,
  },
  palletTabBtnActive: {
    backgroundColor: '#fff',
    ...Shadow.sm,
  },
  palletTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.outline,
  },
  palletTabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  palletBoxesScroll: {
    flex: 1,
  },
  palletBoxesScrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 24,
  },
  palletSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadow.sm,
  },
  palletSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  palletSummaryTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  palletSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  palletSummarySub: {
    fontSize: 11,
    color: Colors.outline,
    marginTop: 1,
  },
  palletPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4338CA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
  },
  palletPrintBtnText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#fff',
  },
  palletBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.xs,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  palletBadge: {
    flex: 1,
    alignItems: 'center',
  },
  palletBadgeDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
  palletBadgeLabel: {
    fontSize: 10.5,
    color: Colors.outline,
    marginBottom: 2,
  },
  palletBadgeVal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  palletScanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: BorderRadius.xs,
    padding: 10,
    marginBottom: 12,
  },
  palletScanBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 16,
    fontWeight: '500',
  },
  palletSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  palletSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.outline,
    letterSpacing: 0.5,
  },
  palletEmptyCard: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  palletEmptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurface,
    marginTop: 6,
  },
  palletEmptySubText: {
    fontSize: 11,
    color: Colors.outline,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
  palletBoxCard: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
    ...Shadow.sm,
  },
  unassignedBoxCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    marginBottom: 8,
  },
  palletBoxCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  palletBoxName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  palletBoxSubText: {
    fontSize: 11.5,
    color: Colors.outline,
    marginTop: 2,
  },
  palletBoxActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  palletBoxInspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BorderRadius.xs,
  },
  palletBoxInspectBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  palletBoxPrintBtn: {
    padding: 6,
    borderRadius: BorderRadius.xs,
    backgroundColor: '#F1F5F9',
  },
  palletBoxRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BorderRadius.xs,
  },
  palletBoxRemoveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  palletBoxAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
  },
  palletBoxAddText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#fff',
  },
  priceCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  costBadgeLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#92400E',
  },
  costBadgeValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309',
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  priceBadgeLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#065F46',
  },
  priceBadgeValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#047857',
  },
  subBadgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  subBadgeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3730A3',
  },
  subDetailChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  subDetailChipText: {
    fontSize: 10.5,
  },
});

