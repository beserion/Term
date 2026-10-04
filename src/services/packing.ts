import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApi } from './api';
import { useSettingsStore } from '../store/settingsStore';

/**
 * Terminal Koli & Palet Paketleme Servisleri ve DTO Tanımları
 */

export interface TerminalCreateBoxDto {
  requestId: number;
  boxName?: string;
  dimensions?: string;
  grossWeight?: number;
}

export interface TerminalCreatePalletDto {
  requestId: number;
  vesselName?: string;
  dimensions?: string;
  grossWeight?: number;
}

export interface TerminalAssignItemDto {
  orderDetailId: number;
  palletId?: number | null;
  boxId?: number | null;
  qty: number;
  stockCode?: string;
  stockName?: string;
  unit?: string;
}

export interface TerminalAssignBoxToPalletDto {
  boxId: number;
  palletId: number;
}

export interface TerminalProcessBarcodeDto {
  barcode: string;
}

export interface WMS_PackingLineVM {
  id: number;
  boxId?: number | null;
  palletId?: number | null;
  orderDetailId?: number;
  stockCode?: string;
  stockName?: string;
  impaCode?: string;
  unit?: string;
  qty: number;
  grossWeight?: number;
}

export interface WMS_BoxVM {
  id: number;
  requestId?: number;
  boxName: string;
  dimensions?: string;
  grossWeight?: number;
  palletId?: number | null;
  lines?: WMS_PackingLineVM[];
  items?: WMS_PackingLineVM[];
  itemCount?: number;
}

export interface WMS_PalletVM {
  id: number;
  requestId?: number;
  vesselName: string;
  dimensions?: string;
  grossWeight?: number;
  boxes?: WMS_BoxVM[];
  lines?: WMS_PackingLineVM[];
  items?: WMS_PackingLineVM[];
  boxCount?: number;
}

export interface PackingPendingItemVM {
  orderDetailId: number;
  stockId?: number;
  impaCode?: string;
  stockCode: string;
  stockName: string;
  unit?: string;
  totalQty: number;
  packedQty: number;
  remainingQty: number;
}

export interface WMS_PackingBoardVM {
  requestId?: number;
  orderId?: number;
  documentNo?: string;
  partnerName?: string;
  rfqNo?: string;
  vesselName?: string;
  pendingItems?: PackingPendingItemVM[];
  boxes?: WMS_BoxVM[];
  pallets?: WMS_PalletVM[];
}

export interface TerminalAssignBulkItemLineDto {
  orderDetailId: number;
  qty: number;
  stockCode?: string;
}

export interface TerminalAssignItemsBulkDto {
  requestId?: number;
  boxId?: number | null;
  palletId?: number | null;
  items: TerminalAssignBulkItemLineDto[];
}

export interface TerminalCompleteSupplierPackingDto {
  orderId: number;
  supplierId: number;
}

export interface TerminalPrintBoxLabelRequestDto {
  boxId: number;
  printerId?: number;
  quantity?: number;
}

export interface TerminalPrintPalletLabelRequestDto {
  palletId: number;
  printerId?: number;
  quantity?: number;
}

export interface PackingOrder {
  id: number;
  orderId?: number;
  documentNo: string;
  orderDate?: string;
  partnerId?: number;
  partnerName?: string;
  status?: string;
  rfqNo?: string;
  vesselName?: string;
  productCount?: number;
  totalPackedRatio?: number;
  packedRatio?: number;
  boxCount?: number;
  palletCount?: number;
  isReceiptCompleted?: boolean;
  isPackingCompleted?: boolean;
  isConvertedOrder?: boolean;
}

export interface PackingSupplier {
  orderId: number;
  requestId?: number;
  partnerId: number;
  partnerName: string;
  productCount?: number;
  totalQty?: number;
  packedCount?: number;
  packedQty?: number;
  isCompleted?: boolean;
  isReceiptCompleted?: boolean;
  isPackingCompleted?: boolean;
}

/** Tedarikçinin yerel paketleme durumunu kaydeder */
export async function savePackingSupplierStatus(orderId: number, supplierId: number, data: {
  isCompleted: boolean;
  packedCount: number;
  totalCount: number;
  packedQty: number;
  totalQty: number;
  lineQuantities?: Record<string, number>;
}): Promise<void> {
  try {
    const key = `@packing_supplier_status_${orderId}`;
    const existingStr = await AsyncStorage.getItem(key);
    const map = existingStr ? JSON.parse(existingStr) : {};
    map[String(supplierId)] = {
      ...data,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(map));

    if (data.lineQuantities) {
      await AsyncStorage.setItem(`@packing_state_${orderId}_${supplierId}`, JSON.stringify(data.lineQuantities));
    }
  } catch (e) {
    console.error('Error saving packing status to AsyncStorage:', e);
  }
}

/** Tedarikçinin yerel paketleme durumunu okur */
export async function getPackingSupplierStatus(orderId: number, supplierId: number): Promise<any> {
  try {
    const key = `@packing_supplier_status_${orderId}`;
    const existingStr = await AsyncStorage.getItem(key);
    if (!existingStr) return null;
    const map = JSON.parse(existingStr);
    return map[String(supplierId)] || null;
  } catch {
    return null;
  }
}

/** Aktif paketlenebilir sipariş listesini getirir (Sadece siparişe dönüşenler) */
export async function getActivePackingOrders(search?: string): Promise<PackingOrder[]> {
  const api = await getApi();
  
  try {
    // Hem paketleme siparişlerini hem de onaylanmış gerçek sipariş listesini alıyoruz
    const [packingRes, ordersListRes] = await Promise.all([
      api.get('/terminal/Packing/Orders').catch(() => ({ data: [] })),
      api.get('/terminal/Orders/List').catch(() => ({ data: [] })),
    ]);

    let packingData: any[] = [];
    if (Array.isArray(packingRes.data)) packingData = packingRes.data;
    else if (Array.isArray(packingRes.data?.data)) packingData = packingRes.data.data;

    let ordersListData: any[] = [];
    if (Array.isArray(ordersListRes.data)) ordersListData = ordersListRes.data;
    else if (Array.isArray(ordersListRes.data?.data)) ordersListData = ordersListRes.data.data;

    // Gerçek siparişleri haritala (Siparişe dönüşmüş teklifler / REQ_Orders kayıtları)
    const realOrdersById = new Map<number, any>();
    const realOrdersByOrderNo = new Map<string, any>();
    const realOrdersByRfq = new Map<string, any>();

    ordersListData.forEach((ord: any) => {
      const oId = Number(ord.orderId || ord.id || 0);
      if (oId > 0) realOrdersById.set(oId, ord);
      if (ord.orderNo) realOrdersByOrderNo.set(String(ord.orderNo).trim().toLowerCase(), ord);
      if (ord.rfqNo) realOrdersByRfq.set(String(ord.rfqNo).trim().toLowerCase(), ord);
    });

    let validList: any[] = [];

    if (packingData.length > 0 && ordersListData.length > 0) {
      // /terminal/Packing/Orders içinden SADECE gerçek sipariş listesinde karşılığı olanları al (Siparişe dönüşmemiş teklifler elenir)
      validList = packingData.filter((p: any) => {
        const pOrderId = Number(p.orderId || 0);
        const pOrderNo = (p.orderNo || '').trim().toLowerCase();
        const pRfq = (p.rfqNo || '').trim().toLowerCase();

        if (pOrderId > 0 && realOrdersById.has(pOrderId)) return true;
        if (pOrderNo && realOrdersByOrderNo.has(pOrderNo)) return true;
        if (pRfq && realOrdersByRfq.has(pRfq)) return true;
        return false;
      });
    } else if (packingData.length > 0) {
      // Orders/List boş dönmüşse fakat packingData varsa
      validList = packingData.filter((p: any) => p.orderId && p.orderId > 0);
    } else {
      validList = ordersListData;
    }

    if (validList.length > 0) {
      let mapped: PackingOrder[] = await Promise.all(
        validList.map(async (o: any) => {
          const ratio = Number(o.packedRatio ?? 0);
          const isDone = o.isPackingCompleted ?? (ratio >= 100);
          const statusText = isDone ? 'Paketlendi' : (ratio > 0 ? `%${ratio} Paketlendi` : 'Paketlenecek');

          // Eğer ordersListData'dan eşleşen gerçek sipariş varsa doğru orderId ve bilgileri al
          const pOrderId = Number(o.orderId || 0);
          const pOrderNo = (o.orderNo || '').trim().toLowerCase();
          const pRfq = (o.rfqNo || '').trim().toLowerCase();
          const matchedReal = realOrdersById.get(pOrderId) || realOrdersByOrderNo.get(pOrderNo) || realOrdersByRfq.get(pRfq);

          const realId = matchedReal?.orderId || o.orderId || o.id;
          const realDocNo = matchedReal?.orderNo || o.orderNo || `ORD-${realId}`;
          const realRfq = matchedReal?.rfqNo || o.rfqNo;
          const realVessel = matchedReal?.vesselName || o.vesselName;
          const realPartner = matchedReal?.partnerName || o.partnerName || 'Müşteri Belirtilmemiş';

          // Yerel hafızadaki tamamlanma durumunu kontrol et
          let isLocallyCompleted = false;
          try {
            const locFlag = await AsyncStorage.getItem(`@packing_order_completed_${realId}`);
            if (locFlag === 'true') isLocallyCompleted = true;
          } catch {
            // ignore
          }

          const fullyDone = isDone || isLocallyCompleted || ratio >= 100;

          return {
            id: o.requestId || realId,
            orderId: realId,
            documentNo: realDocNo,
            partnerId: o.partnerId || matchedReal?.partnerId,
            partnerName: realPartner,
            status: statusText,
            rfqNo: realRfq,
            vesselName: realVessel,
            productCount: o.productCount || matchedReal?.productCount || 0,
            totalPackedRatio: ratio,
            packedRatio: ratio,
            boxCount: o.boxCount || 0,
            palletCount: o.palletCount || 0,
            isReceiptCompleted: o.isReceiptCompleted !== undefined ? o.isReceiptCompleted : (matchedReal?.isReceiptCompleted ?? true),
            isPackingCompleted: fullyDone,
            isConvertedOrder: true,
          };
        })
      );

      // KULLANICI İSTEĞİ: Sipariş komple paketlendiğinde paketleme listesinden çıkması gerekiyor.
      // İşlemi bittiği için bu listede gözükmesine gerek yok.
      mapped = mapped.filter((o) => !o.isPackingCompleted && (o.packedRatio === undefined || o.packedRatio < 100));

      if (search) {
        const searchLower = search.toLowerCase().trim();
        mapped = mapped.filter(
          (o) =>
            (o.documentNo && o.documentNo.toLowerCase().includes(searchLower)) ||
            (o.partnerName && o.partnerName.toLowerCase().includes(searchLower)) ||
            (o.rfqNo && o.rfqNo.toLowerCase().includes(searchLower)) ||
            (o.vesselName && o.vesselName.toLowerCase().includes(searchLower))
        );
      }
      return mapped;
    }
  } catch (err) {
    console.warn('Error fetching packing orders:', err);
  }

  // Fallback: Eski ActiveOrders ve Orders/List birleştirmesi
  const [activeRes, ordersListRes] = await Promise.all([
    api.get('/terminal/Packing/ActiveOrders').catch(() => ({ data: null })),
    api.get('/terminal/Orders/List').catch(() => ({ data: null })),
  ]);
  
  const activeOrders: any[] = Array.isArray(activeRes.data)
    ? activeRes.data
    : (activeRes.data?.data || activeRes.data?.orders || []);

  const ordersList: any[] = Array.isArray(ordersListRes.data)
    ? ordersListRes.data
    : (ordersListRes.data?.data || []);

  const rfqToActiveMap = new Map<string, any>();
  for (const a of activeOrders) {
    if (a.rfqNo) {
      rfqToActiveMap.set(String(a.rfqNo).trim().toLowerCase(), a);
    }
  }

  const sortedOrders = [...ordersList].sort((a, b) => Number(b.orderId || 0) - Number(a.orderId || 0));

  let mapped: PackingOrder[] = await Promise.all(
    sortedOrders.map(async (o) => {
      const rfqKey = o.rfqNo ? String(o.rfqNo).trim().toLowerCase() : '';
      const matchedActive = rfqKey ? rfqToActiveMap.get(rfqKey) : null;
      const effectiveReqId = matchedActive?.id || o.orderId;
      const effectiveVessel = o.vesselName || matchedActive?.vesselName || '';
      const effectiveCount = o.productCount || matchedActive?.productCount || matchedActive?.itemCount || 0;
      const effectiveRatio = matchedActive?.packedRatio || 0;
      let isDone = matchedActive?.isPackingCompleted ?? (effectiveRatio >= 100);

      try {
        const locFlag = await AsyncStorage.getItem(`@packing_order_completed_${o.orderId}`);
        if (locFlag === 'true') isDone = true;
      } catch {
        // ignore
      }

      return {
        id: effectiveReqId,
        orderId: o.orderId,
        documentNo: o.orderNo || `ORD-${o.orderId}`,
        orderDate: o.transactionDate || '',
        partnerId: o.partnerId,
        partnerName: o.partnerName || 'Müşteri Belirtilmemiş',
        status: o.orderStatus || 'Sipariş Oluşturuldu',
        rfqNo: o.rfqNo,
        vesselName: effectiveVessel,
        productCount: effectiveCount,
        totalPackedRatio: effectiveRatio,
        packedRatio: effectiveRatio,
        isPackingCompleted: isDone,
        isConvertedOrder: true,
      };
    })
  );

  // KULLANICI İSTEĞİ: Sipariş komple paketlendiğinde paketleme listesinden çıkması gerekiyor.
  mapped = mapped.filter((o) => !o.isPackingCompleted && (o.packedRatio === undefined || o.packedRatio < 100));

  if (search) {
    const searchLower = search.toLowerCase().trim();
    mapped = mapped.filter(
      (o) =>
        (o.documentNo && o.documentNo.toLowerCase().includes(searchLower)) ||
        (o.partnerName && o.partnerName.toLowerCase().includes(searchLower)) ||
        (o.rfqNo && o.rfqNo.toLowerCase().includes(searchLower)) ||
        (o.vesselName && o.vesselName.toLowerCase().includes(searchLower)) ||
        (o.status && o.status.toLowerCase().includes(searchLower))
    );
  }

  return mapped;
}

/**
 * Bir tedarikçinin firmanın kendi aktif deposu / iç stok tedarikçisi olup olmadığını kontrol eder.
 * Sadece Gemini değil, ayarlarda seçili olan aktif depo (veya firma deposu) adıyla da dinamik eşleşir.
 * @param supplierName Kontrol edilecek tedarikçi veya cari adı
 * @param customWarehouseName Opsiyonel belirtilen depo adı (varsayılan: ayarlar mağazasındaki aktif depo)
 */
export function isWarehouseSupplier(supplierName?: string | null, customWarehouseName?: string | null): boolean {
  if (!supplierName) return false;

  const normalize = (str: string) =>
    str
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .replace(/Ş/g, 'ş')
      .replace(/Ğ/g, 'ğ')
      .replace(/Ü/g, 'ü')
      .replace(/Ö/g, 'ö')
      .replace(/Ç/g, 'ç')
      .toLowerCase()
      .trim();

  const normSupplier = normalize(supplierName);

  // 1. Ayarlardan gelen aktif depo adı ile dinamik eşleşme kontrolü
  const activeWh = customWarehouseName !== undefined ? customWarehouseName : useSettingsStore.getState().activeWarehouseName;
  if (activeWh) {
    const normWarehouse = normalize(activeWh);
    if (normWarehouse.length >= 2) {
      if (normSupplier.includes(normWarehouse) || normWarehouse.includes(normSupplier)) {
        return true;
      }
      // Depo adındaki anahtar kelimeleri ayıkla (stop-words hariç)
      const stopWords = ['depo', 'deposu', 'warehouse', 'store', 'ana', 'merkez', 'sube', 'şube'];
      const whWords = normWarehouse.split(/[\s\-_/]+/).filter((w) => w.length >= 3 && !stopWords.includes(w));
      for (const word of whWords) {
        if (normSupplier.includes(word)) {
          return true;
        }
      }
    }
  }

  // 2. Depo / Mağaza belirten genel anahtar kelimeler
  if (
    normSupplier === 'store' ||
    normSupplier.startsWith('store ') ||
    normSupplier.includes('merkez depo') ||
    normSupplier.includes('ana depo')
  ) {
    return true;
  }

  // 3. Mevcut proje / Gemini firma kontrolü (geriye dönük tam uyumluluk)
  if (normSupplier.includes('gemini')) {
    return true;
  }

  return false;
}

/** Geriye dönük tam uyumluluk için alias */
export const isGeminiSupplier = isWarehouseSupplier;

/** Bir sipariş/talebe ait tedarikçileri ve ürün kalem sayılarını getirir */
export async function getPackingSuppliers(requestId: number, orderId?: number, rfqNo?: string): Promise<PackingSupplier[]> {
  const api = await getApi();
  const targetOrderId = orderId || requestId;

  // 1. Yeni backend endpoint: /terminal/Packing/Orders/{orderId}/Suppliers
  try {
    const res = await api.get(`/terminal/Packing/Orders/${targetOrderId}/Suppliers`);
    let data: any[] = [];
    if (Array.isArray(res.data)) data = res.data;
    else if (Array.isArray(res.data?.data)) data = res.data.data;

    if (data.length > 0) {
      const mapped = await Promise.all(
        data.map(async (s: any) => {
          const supplierId = s.supplierId;
          const supplierName = s.supplierName || 'Tedarikçi Cari Adı Yok';
          const isOwnWh = isWarehouseSupplier(supplierName);
          const pCount = s.productCount || 0;
          let totalQ = Number(s.totalQty || 0);
          const packedQ = Number(s.packedQty || 0);
          const packedC = Number(s.packedCount || 0);
          let isReceipt = isOwnWh ? true : s.isReceiptCompleted;

          // 1. Yerel AsyncStorage flag'i kontrol et (Yalnızca tedarikçiye özel anahtarlar - sipariş geneli bayrak kontrol edilmez!)
          if (!isReceipt && targetOrderId && supplierId) {
            try {
              const keysToCheck = [
                `@order_receipt_completed_${targetOrderId}_${supplierId}`,
                `@order_receipt_completed_${orderId}_${supplierId}`,
                `@order_receipt_completed_${requestId}_${supplierId}`,
              ];
              for (const k of keysToCheck) {
                const val = await AsyncStorage.getItem(k);
                if (val === 'true') {
                  isReceipt = true;
                  break;
                }
              }
            } catch {}
          }

          // 2. Eğer sunucudan isReceiptCompleted false döndüyse ve detaylarda tüm ürünler teslim alınmışsa doğru kabul et
          if (!isReceipt && targetOrderId && supplierId) {
            try {
              const detRes = await api.get(`/terminal/Orders/${targetOrderId}/Supplier/${supplierId}/Details`);
              const dLines = Array.isArray(detRes.data) ? detRes.data : (detRes.data?.data || []);
              if (dLines.length > 0) {
                const detOrdered = dLines.reduce((sum: number, dl: any) => sum + Number(dl.orderedQty ?? dl.qty ?? 0), 0);
                const detReceived = dLines.reduce((sum: number, dl: any) => sum + Number(dl.receivedQty ?? 0), 0);
                if (totalQ <= 0 && detOrdered > 0) {
                  totalQ = detOrdered;
                }
                const allReceived = dLines.every((dl: any) => {
                  const ord = Number(dl.orderedQty ?? dl.qty ?? 0);
                  const rec = Number(dl.receivedQty ?? 0);
                  return rec >= ord && ord > 0;
                });
                if (allReceived || (detOrdered > 0 && detReceived >= detOrdered) || (detReceived > 0 && detOrdered === 0)) {
                  isReceipt = true;
                  AsyncStorage.setItem(`@order_receipt_completed_${targetOrderId}_${supplierId}`, 'true').catch(() => {});
                }
              }
            } catch {}
          }

          const isDone = s.isPackingCompleted ?? (totalQ > 0 && packedQ >= totalQ);

          return {
            orderId: targetOrderId,
            requestId: requestId,
            partnerId: supplierId,
            partnerName: supplierName,
            productCount: pCount,
            totalQty: totalQ,
            packedCount: packedC,
            packedQty: packedQ,
            isCompleted: !!isDone,
            isPackingCompleted: !!isDone,
            isReceiptCompleted: isOwnWh ? true : (isReceipt !== undefined ? !!isReceipt : true),
          };
        })
      );
      return mapped;
    }
  } catch (err) {
    console.warn(`Error fetching /terminal/Packing/Orders/${targetOrderId}/Suppliers, trying fallback:`, err);
  }

  // Fallback: Eski /terminal/Orders/${targetOrderId}/Suppliers
  let rawSuppliers: any[] = [];
  if (targetOrderId) {
    try {
      const res = await api.get(`/terminal/Orders/${targetOrderId}/Suppliers`);
      if (Array.isArray(res.data)) rawSuppliers = res.data;
      else if (Array.isArray(res.data?.data)) rawSuppliers = res.data.data;
    } catch {
      // ignore
    }
  }

  if (rawSuppliers.length === 0 && requestId && requestId !== targetOrderId) {
    try {
      const res = await api.get(`/terminal/Orders/${requestId}/Suppliers`);
      if (Array.isArray(res.data)) rawSuppliers = res.data;
      else if (Array.isArray(res.data?.data)) rawSuppliers = res.data.data;
    } catch {
      // ignore
    }
  }

  const suppliers: PackingSupplier[] = await Promise.all(
    rawSuppliers.map(async (item: any) => {
      const pId = item.partnerId || item.PartnerId;
      const productCount = item.productCount || 0;
      const totalQty = item.totalQty || 0;
      const lookupOrderId = targetOrderId || item.orderId;

      return {
        orderId: lookupOrderId || requestId,
        requestId: requestId,
        partnerId: pId,
        partnerName: item.partnerName || item.PartnerName || item.partnername || 'Tedarikçi Cari Adı Yok',
        productCount,
        totalQty,
        packedCount: 0,
        packedQty: 0,
        isCompleted: false,
        isReceiptCompleted: true,
      };
    })
  );

  return suppliers;
}

/** Seçilen siparişe ait paketleme tahtası verisini getirir */
export async function getPackingBoardData(requestId: number): Promise<WMS_PackingBoardVM> {
  const api = await getApi();
  console.log(`[PACKING] BoardData isteniyor, requestId: ${requestId}`);
  const response = await api.get(`/terminal/Packing/BoardData/${requestId}`);
  
  console.log(`[PACKING] BoardData Yanıtı:`, JSON.stringify(response.data).substring(0, 500));

  const data = response.data?.data || response.data?.result || response.data?.board || response.data || {};
  
  // Esnek dizi tespiti (pendingItems, PendingItems, unpackedItems, UnpackedItems, details, Details, lines, Lines, items, Items, products)
  const rawPending = Array.isArray(data.unpackedItems) ? data.unpackedItems :
                    (Array.isArray(data.UnpackedItems) ? data.UnpackedItems :
                    (Array.isArray(data.pendingItems) ? data.pendingItems :
                    (Array.isArray(data.PendingItems) ? data.PendingItems :
                    (Array.isArray(data.details) ? data.details :
                    (Array.isArray(data.Details) ? data.Details :
                    (Array.isArray(data.lines) ? data.lines :
                    (Array.isArray(data.Lines) ? data.Lines :
                    (Array.isArray(data.items) ? data.items :
                    (Array.isArray(data.Items) ? data.Items :
                    (Array.isArray(data.products) ? data.products :
                    (Array.isArray(data.Products) ? data.Products :
                    (Array.isArray(data) ? data : []))))))))))));

  const rawBoxes = Array.isArray(data.boxes) ? data.boxes : (Array.isArray(data.Boxes) ? data.Boxes : []);
  const rawPallets = Array.isArray(data.pallets) ? data.pallets : (Array.isArray(data.Pallets) ? data.Pallets : []);

  const pendingItems: PackingPendingItemVM[] = rawPending.map((item: any, index: number) => {
    const total = Number(item.totalQty || item.TotalQty || item.orderedQty || item.OrderedQty || item.qty || item.Qty || item.quantity || item.Quantity || 0);
    const packed = Number(item.packedQty || item.PackedQty || 0);
    const rem = item.remainingQty !== undefined ? Number(item.remainingQty) :
               (item.RemainingQty !== undefined ? Number(item.RemainingQty) : Math.max(0, total - packed));

    const code = item.impaCode || item.IMPACode || item.stockCode || item.StockCode || item.productCode || item.ProductCode || item.code || item.Code || `KOD-${index + 1}`;

    return {
      orderDetailId: item.orderDetailId || item.OrderDetailId || item.id || item.Id || item.detailId || item.DetailId || index + 1,
      stockId: item.stockId || item.StockId || item.productId || item.ProductId,
      impaCode: item.impaCode || item.IMPACode || '',
      stockCode: code,
      stockName: item.stockName || item.StockName || item.productName || item.ProductName || item.name || item.Name || 'Ürün Adı Yok',
      unit: item.unit || item.Unit || 'ADET',
      totalQty: total,
      packedQty: packed,
      remainingQty: rem,
    };
  });

  console.log(`[PACKING] İşlenen Bekleyen Ürün Sayısı: ${pendingItems.length}`);


  const boxes: WMS_BoxVM[] = rawBoxes.map((box: any, bIndex: number) => {
    const rawLines = Array.isArray(box.items) ? box.items :
                    (Array.isArray(box.Items) ? box.Items :
                    (Array.isArray(box.lines) ? box.lines :
                    (Array.isArray(box.Lines) ? box.Lines : [])));

    const lines: WMS_PackingLineVM[] = rawLines.map((l: any, lIndex: number) => ({
      id: l.id || l.Id || lIndex,
      boxId: box.id || box.Id,
      palletId: l.palletId || l.PalletId,
      orderDetailId: l.orderDetailId || l.OrderDetailId || l.requestDetailId || l.RequestDetailId,
      impaCode: l.impaCode || l.IMPACode || l.impa || l.IMPA || undefined,
      stockCode: l.stockCode || l.StockCode || l.impaCode || l.IMPACode || l.productCode || 'KOD',
      stockName: l.stockName || l.StockName || l.productName || 'Ürün',
      unit: l.unit || l.Unit || 'ADET',
      qty: Number(l.qty || l.Qty || 0),
      grossWeight: Number(l.grossWeight || l.GrossWeight || 0),
    }));

    return {
      id: box.id || box.Id || bIndex + 1,
      requestId: box.requestId || box.RequestId || requestId,
      boxName: box.boxName || box.BoxName || `Koli-${bIndex + 1}`,
      dimensions: box.dimensions || box.Dimensions || '',
      grossWeight: Number(box.grossWeight || box.GrossWeight || 0),
      palletId: box.palletId || box.PalletId || null,
      lines: lines,
      itemCount: lines.length,
    };
  });

  const pallets: WMS_PalletVM[] = rawPallets.map((pallet: any, pIndex: number) => {
    const rawBoxesInPallet = Array.isArray(pallet.boxes) ? pallet.boxes : (Array.isArray(pallet.Boxes) ? pallet.Boxes : []);
    const palletBoxes: WMS_BoxVM[] = rawBoxesInPallet.map((b: any, pbIndex: number) => {
      const bLinesRaw = Array.isArray(b.items) ? b.items : (Array.isArray(b.Items) ? b.Items : (Array.isArray(b.lines) ? b.lines : (Array.isArray(b.Lines) ? b.Lines : [])));
      const bLines: WMS_PackingLineVM[] = bLinesRaw.map((l: any, lIndex: number) => ({
        id: l.id || l.Id || lIndex,
        boxId: b.id || b.Id,
        palletId: pallet.id || pallet.Id,
        orderDetailId: l.orderDetailId || l.OrderDetailId,
        impaCode: l.impaCode || l.IMPACode || l.impa || l.IMPA || undefined,
        stockCode: l.stockCode || l.StockCode || l.impaCode || l.IMPACode || 'KOD',
        stockName: l.stockName || l.StockName || 'Ürün',
        unit: l.unit || l.Unit || 'ADET',
        qty: Number(l.qty || l.Qty || 0),
        grossWeight: Number(l.grossWeight || l.GrossWeight || 0),
      }));

      return {
        id: b.id || b.Id || pbIndex + 1,
        requestId: b.requestId || b.RequestId || requestId,
        boxName: b.boxName || b.BoxName || `Koli-${pbIndex + 1}`,
        dimensions: b.dimensions || b.Dimensions || '',
        grossWeight: Number(b.grossWeight || b.GrossWeight || 0),
        palletId: pallet.id || pallet.Id,
        lines: bLines,
        itemCount: bLines.length,
      };
    });

    const rawLinesInPallet = Array.isArray(pallet.looseItems) ? pallet.looseItems :
                            (Array.isArray(pallet.LooseItems) ? pallet.LooseItems :
                            (Array.isArray(pallet.items) ? pallet.items :
                            (Array.isArray(pallet.Items) ? pallet.Items :
                            (Array.isArray(pallet.lines) ? pallet.lines :
                            (Array.isArray(pallet.Lines) ? pallet.Lines : [])))));

    const palletLines: WMS_PackingLineVM[] = rawLinesInPallet.map((l: any, plIndex: number) => ({
      id: l.id || l.Id || plIndex,
      palletId: pallet.id || pallet.Id,
      orderDetailId: l.orderDetailId || l.OrderDetailId,
      impaCode: l.impaCode || l.IMPACode || l.impa || l.IMPA || undefined,
      stockCode: l.stockCode || l.StockCode || l.impaCode || l.IMPACode || 'KOD',
      stockName: l.stockName || l.StockName || 'Dökme Ürün',
      unit: l.unit || l.Unit || 'ADET',
      qty: Number(l.qty || l.Qty || 0),
      grossWeight: Number(l.grossWeight || l.GrossWeight || 0),
    }));

    return {
      id: pallet.id || pallet.Id || pIndex + 1,
      requestId: pallet.requestId || pallet.RequestId || requestId,
      vesselName: pallet.vesselName || pallet.VesselName || pallet.name || `Palet-${pIndex + 1}`,
      dimensions: pallet.dimensions || pallet.Dimensions || '',
      grossWeight: Number(pallet.grossWeight || pallet.GrossWeight || 0),
      boxes: palletBoxes,
      lines: palletLines,
      boxCount: palletBoxes.length,
    };
  });

  return {
    requestId: data.requestId || data.RequestId || requestId,
    documentNo: data.documentNo || data.DocumentNo,
    partnerName: data.partnerName || data.PartnerName,
    rfqNo: data.rfqNo || data.RfqNo,
    pendingItems,
    boxes,
    pallets,
  };
}

/** Yeni koli oluşturur */
export async function createBox(dto: TerminalCreateBoxDto): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Packing/CreateBox', dto);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Koli oluşturulamadı.');
  }
  return response.data;
}

/** Yeni palet oluşturur */
export async function createPallet(dto: TerminalCreatePalletDto): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Packing/CreatePallet', dto);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Palet oluşturulamadı.');
  }
  return response.data;
}

/** Ürünü hedef koli veya palete aktarır/paketler */
export async function assignItemToBoxOrPallet(dto: TerminalAssignItemDto): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Packing/AssignItem', dto);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Ürün koli/palete paketlenemedi.');
  }
  return response.data;
}

/** Koliyi hedef palete bağlar */
export async function assignBoxToPallet(dto: TerminalAssignBoxToPalletDto): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Packing/AssignBoxToPallet', dto);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Koli palete bağlanamadı.');
  }
  return response.data;
}

/** Paketleşmiş ürünü koli/paletten çıkarır */
export async function removeItemFromPacking(lineId: number): Promise<any> {
  const api = await getApi();
  const response = await api.post(`/terminal/Packing/RemoveItem/${lineId}`);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Ürün paketten çıkarılamadı.');
  }
  return response.data;
}

/** Koliyi ve içindeki tüm bağlantıları siler */
export async function deleteBox(boxId: number): Promise<any> {
  const api = await getApi();
  const response = await api.post(`/terminal/Packing/DeleteBox/${boxId}`);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Koli silinemedi.');
  }
  return response.data;
}

/** Paleti ve içindeki bağlantıları siler */
export async function deletePallet(palletId: number): Promise<any> {
  const api = await getApi();
  const response = await api.post(`/terminal/Packing/DeletePallet/${palletId}`);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Palet silinemedi.');
  }
  return response.data;
}

/** Barkod okutur ve türünü (Box, Pallet, Stock) tespit eder */
export async function processBarcode(barcodeDto: TerminalProcessBarcodeDto): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Packing/ProcessBarcode', barcodeDto);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Barkod işlenemedi.');
  }
  return response.data;
}

/** Kalemleri topluca koliye veya palete aktarır (Bulk Assign) */
export async function assignItemsBulk(dto: TerminalAssignItemsBulkDto): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Packing/AssignItemsBulk', dto);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Toplu paketleme işlemi kaydedilemedi.');
  }
  return response.data;
}

/** Tedarikçi paketleme sürecini tamamlandı olarak kaydeder */
export async function completeSupplierPacking(orderId: number, supplierId: number): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Packing/CompleteSupplierPacking', { orderId, supplierId });
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Tedarikçi paketleme tamamlanamadı.');
  }
  return response.data;
}

/** Koli Zebra etiketini sunucu üzerinden oluşturur ve CPCL / yazıcı bilgilerini döner */
export async function printBoxLabelServer(dto: TerminalPrintBoxLabelRequestDto): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Packing/PrintBoxLabel', dto);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Koli etiketi oluşturulamadı.');
  }
  return response.data;
}

/** Palet Zebra etiketini sunucu üzerinden oluşturur ve CPCL / yazıcı bilgilerini döner */
export async function printPalletLabelServer(dto: TerminalPrintPalletLabelRequestDto): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Packing/PrintPalletLabel', dto);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Palet etiketi oluşturulamadı.');
  }
  return response.data;
}
