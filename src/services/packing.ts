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
  unpackedItems?: any[];
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
  supplierNames?: string[];
  poNumbers?: string[];
  assignedOperatorId?: number | null;
  assignedOperatorCode?: string | null;
  assignedOperatorName?: string | null;
  assignedDate?: string | null;
  workStatus?: 'Unassigned' | 'InProgress' | 'Completed' | string | null;
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

/** Siparişi operatöre atar / operatörün üzerine alır */
export async function assignPackingOrder(orderId: number, employeeId: number, operatorName?: string, force = false): Promise<any> {
  const api = await getApi();
  let serverSuccess = false;
  let serverMessage = '';

  try {
    const res = await api.post(`/terminal/Packing/Orders/${orderId}/Assign`, {
      employeeId,
      force,
    });
    if (res.data && res.data.success !== false) {
      serverSuccess = true;
      serverMessage = res.data.message || 'Sipariş üzerinize alındı.';
    }
  } catch (err: any) {
    if (err?.response?.status === 409) {
      throw new Error(err.response?.data?.message || 'Bu sipariş başka bir operatör tarafından paketlenmektedir.');
    }
    console.warn(`Assign API call fallback for order ${orderId}:`, err?.message);
  }

  // Yerel eşleme (Hem API hazır olana kadar hem de offline-first destek için)
  try {
    const assignData = {
      assignedOperatorId: employeeId,
      assignedOperatorName: operatorName || `Personel #${employeeId}`,
      assignedDate: new Date().toISOString(),
      workStatus: 'InProgress',
    };
    await AsyncStorage.setItem(`@packing_order_assign_${orderId}`, JSON.stringify(assignData));
  } catch (e) {
    console.error('Error saving local order assignment:', e);
  }

  return { success: true, message: serverMessage || 'Sipariş üzerinize alındı.' };
}

/** Siparişi açık havuza geri bırakır */
export async function releasePackingOrder(orderId: number, employeeId?: number): Promise<any> {
  const api = await getApi();
  try {
    await api.post(`/terminal/Packing/Orders/${orderId}/Release`, {
      employeeId,
    });
  } catch (err: any) {
    console.warn(`Release API call fallback for order ${orderId}:`, err?.message);
  }

  try {
    await AsyncStorage.removeItem(`@packing_order_assign_${orderId}`);
  } catch (e) {
    console.error('Error removing local order assignment:', e);
  }

  return { success: true, message: 'Sipariş açık havuza bırakıldı.' };
}

/**
 * Verilen sipariş numarasının tedarikçiye açılmış satınalma siparişi (PO) olup olmadığını kontrol eder.
 * Örn: PO-2026-0105 -> true, ORD-2026-00148 -> false
 */
export function isPurchaseOrder(orderNo?: string | null): boolean {
  if (!orderNo) return false;
  const upper = String(orderNo).trim().toUpperCase();
  return upper.startsWith('PO-') || upper.startsWith('PO/');
}

/**
 * Verilen belgenin veya durumun teklif/talep (RFQ, OFR vb.) olup olmadığını kontrol eder.
 * Talep ve tekliflerin Mal Kabul veya Paketleme listelerine siparişmiş gibi düşmesini engeller.
 */
export function isProposalOrOffer(orderNo?: string | null, status?: string | null): boolean {
  if (!orderNo && !status) return false;
  const no = String(orderNo || '').trim().toUpperCase();
  const st = String(status || '').trim().toLowerCase();

  // Durum kontrolü (Teklif, Talep, Taslak, Müşteriden Onay Bekliyor, İptal vb.)
  if (
    st.includes('teklif') ||
    st.includes('talep') ||
    st.includes('taslak') ||
    st.includes('draft') ||
    st.includes('onay bekliyor') ||
    st.includes('müşteriden onay') ||
    st.includes('iptal') ||
    st.includes('cancel')
  ) {
    return true;
  }

  // Kod / Numara kontrolü: RFQ-, OFR-, REQ-, TEK-
  if (
    no.startsWith('RFQ-') ||
    no.startsWith('RFQ/') ||
    no.startsWith('REQ-') ||
    no.startsWith('REQ/') ||
    no.startsWith('OFR-') ||
    no.startsWith('OFR/') ||
    no.startsWith('TEK-') ||
    no.startsWith('TEK/') ||
    no.startsWith('TALEP') ||
    no.startsWith('TEKLIF')
  ) {
    return true;
  }

  return false;
}

/**
 * Verilen sipariş numarasının ve durumunun gerçek bir satış siparişi (ORD-) olup olmadığını doğrular.
 * Satınalma siparişlerini (PO), talepleri (RFQ) ve teklifleri (OFR) eler.
 */
export function isRealSalesOrder(orderNo?: string | null, status?: string | null): boolean {
  if (!orderNo) return false;
  const upper = String(orderNo).trim().toUpperCase();
  if (!upper.startsWith('ORD-') && !upper.startsWith('ORD/')) {
    return false;
  }
  if (isPurchaseOrder(orderNo)) return false;
  if (isProposalOrOffer(orderNo, status)) return false;
  return true;
}

/** Aktif paketlenebilir sipariş listesini getirir (Sadece siparişe dönüşenler, talep/teklifler elenir) */
export async function getActivePackingOrders(
  search?: string,
  operatorId?: number,
  unassignedOnly?: boolean
): Promise<PackingOrder[]> {
  const api = await getApi();
  
  try {
    const queryParams: string[] = [];
    if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
    if (operatorId) queryParams.push(`operatorId=${operatorId}`);
    if (unassignedOnly) queryParams.push('unassignedOnly=true');
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    // Hem paketleme siparişlerini hem de onaylanmış gerçek sipariş listesini alıyoruz (pageSize=1000 ile tüm siparişler)
    const [packingRes, ordersListRes] = await Promise.all([
      api.get(`/terminal/Packing/Orders${queryString}`).catch(() => ({ data: [] })),
      api.get('/terminal/Orders/List?pageSize=1000').catch(() => ({ data: [] })),
    ]);

    let packingData: any[] = [];
    if (Array.isArray(packingRes.data)) packingData = packingRes.data;
    else if (Array.isArray(packingRes.data?.data)) packingData = packingRes.data.data;

    let ordersListData: any[] = [];
    if (Array.isArray(ordersListRes.data)) ordersListData = ordersListRes.data;
    else if (Array.isArray(ordersListRes.data?.data)) ordersListData = ordersListRes.data.data;

    // 1. PO (Satınalma / Tedarikçi) siparişlerini RFQ bazında topla (Alt tedarikçi isimleri ve PO numaraları - Gemini hariç)
    const poInfoByRfq = new Map<string, { poNumbers: string[]; supplierNames: string[] }>();
    ordersListData.forEach((ord: any) => {
      const oNo = String(ord.orderNo || '').trim();
      const rfq = ord.rfqNo ? String(ord.rfqNo).trim().toLowerCase() : '';
      const sName = ord.partnerName ? String(ord.partnerName).trim() : '';

      if (isPurchaseOrder(oNo) && rfq) {
        if (!isWarehouseSupplier(sName)) {
          if (!poInfoByRfq.has(rfq)) {
            poInfoByRfq.set(rfq, { poNumbers: [], supplierNames: [] });
          }
          const entry = poInfoByRfq.get(rfq)!;
          if (oNo && !entry.poNumbers.includes(oNo)) entry.poNumbers.push(oNo);
          if (sName && !entry.supplierNames.includes(sName)) entry.supplierNames.push(sName);
        }
      }
    });

    // 2. Ana listede SADECE asıl müşteri satış siparişleri (ORD-...) yer alır (PO'lar, teklifler ve talepler elenir)
    const salesOrdersListData = ordersListData.filter((ord: any) => isRealSalesOrder(ord.orderNo, ord.orderStatus || ord.status));

    // Gerçek satış siparişlerini haritala (Siparişe dönüşmüş teklifler / REQ_Orders kayıtları)
    const realOrdersById = new Map<number, any>();
    const realOrdersByOrderNo = new Map<string, any>();
    const realOrdersByRfq = new Map<string, any>();

    salesOrdersListData.forEach((ord: any) => {
      const oId = Number(ord.orderId || ord.id || 0);
      if (oId > 0) realOrdersById.set(oId, ord);
      if (ord.orderNo) realOrdersByOrderNo.set(String(ord.orderNo).trim().toLowerCase(), ord);
      if (ord.rfqNo) realOrdersByRfq.set(String(ord.rfqNo).trim().toLowerCase(), ord);
    });

    let validList: any[] = [];

    if (packingData.length > 0) {
      // /terminal/Packing/Orders içinden SADECE gerçek satış siparişine dönüşmüş olanları filtrele
      // (Dönüşmemiş talep/teklif olan 1052, 1051 vb. kesinlikle elenir)
      validList = packingData.filter((p: any) => {
        if (isPurchaseOrder(p.orderNo) || isProposalOrOffer(p.orderNo, p.status)) return false;
        const pOrderId = Number(p.orderId || 0);
        const pOrderNo = (p.orderNo || '').trim().toLowerCase();
        const pRfq = (p.rfqNo || '').trim().toLowerCase();
        const matchedReal = realOrdersById.get(pOrderId) || realOrdersByOrderNo.get(pOrderNo) || realOrdersByRfq.get(pRfq);
        // Eğer gerçek sipariş listesinde eşleşmiyorsa ve orderId === requestId (talep/teklif) ise ele!
        if (!matchedReal && p.orderId === p.requestId) return false;
        return true;
      });

      // EĞER salesOrdersListData içinde onaylı olup da validList'e girmemiş sipariş varsa ekle
      // (Örn: Mal kabulü yeni yapılmış veya statüsü değişmiş siparişlerin paketlemeden kaybolmasını kesin olarak engeller)
      for (const sOrd of salesOrdersListData) {
        const sId = Number(sOrd.orderId || sOrd.id || 0);
        const sDoc = (sOrd.orderNo || '').trim().toLowerCase();
        const alreadyIn = validList.some((v: any) => {
          const vId = Number(v.orderId || v.id || 0);
          const vDoc = (v.orderNo || '').trim().toLowerCase();
          return (sId > 0 && vId === sId) || (sDoc && vDoc === sDoc);
        });
        if (!alreadyIn) {
          validList.push(sOrd);
        }
      }
    } else if (salesOrdersListData.length > 0) {
      validList = salesOrdersListData;
    }

    if (validList.length > 0) {
      let mapped: PackingOrder[] = await Promise.all(
        validList.map(async (o: any) => {
          const ratio = Number(o.packedRatio ?? 0);
          const isDone = o.isPackingCompleted ?? (ratio >= 100);
          const statusText = isDone ? 'Paketlendi' : (ratio > 0 ? `%${ratio} Paketlendi` : 'Paketlenecek');

          // Eğer salesOrdersListData'dan eşleşen gerçek sipariş varsa doğru orderId ve bilgileri al
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

          // Bu siparişin altındaki tedarikçi isimleri ve PO numaralarını bağla
          const rfqKey = String(realRfq || '').trim().toLowerCase();
          const poInfo = rfqKey ? poInfoByRfq.get(rfqKey) : null;

          // Personel zimmet bilgilerini al (Öncelik: Sunucu, Fallback: Yerel storage)
          let opId: number | null = o.assignedOperatorId ?? matchedReal?.assignedOperatorId ?? null;
          let opCode: string | null = o.assignedOperatorCode ?? matchedReal?.assignedOperatorCode ?? null;
          let opName: string | null = o.assignedOperatorName ?? matchedReal?.assignedOperatorName ?? null;
          let aDate: string | null = o.assignedDate ?? matchedReal?.assignedDate ?? null;
          let wStatus: string | null = o.workStatus ?? matchedReal?.workStatus ?? (opId ? 'InProgress' : 'Unassigned');

          if (!opId && realId) {
            try {
              const localAssignStr = await AsyncStorage.getItem(`@packing_order_assign_${realId}`);
              if (localAssignStr) {
                const localAssign = JSON.parse(localAssignStr);
                opId = localAssign.assignedOperatorId ?? null;
                opName = localAssign.assignedOperatorName ?? null;
                aDate = localAssign.assignedDate ?? null;
                wStatus = localAssign.workStatus || 'InProgress';
              }
            } catch {}
          }

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
            supplierNames: poInfo?.supplierNames || [],
            poNumbers: poInfo?.poNumbers || [],
            assignedOperatorId: opId,
            assignedOperatorCode: opCode,
            assignedOperatorName: opName,
            assignedDate: aDate,
            workStatus: wStatus,
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
            (o.supplierNames && o.supplierNames.some((s) => s.toLowerCase().includes(searchLower))) ||
            (o.poNumbers && o.poNumbers.some((p) => p.toLowerCase().includes(searchLower)))
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

  // PO satınalma siparişlerini RFQ bazında topla (Alt tedarikçiler)
  const poFallbackByRfq = new Map<string, { poNumbers: string[]; supplierNames: string[] }>();
  ordersList.forEach((ord: any) => {
    const oNo = String(ord.orderNo || '').trim();
    const rfq = ord.rfqNo ? String(ord.rfqNo).trim().toLowerCase() : '';
    const sName = ord.partnerName ? String(ord.partnerName).trim() : '';

    if (isPurchaseOrder(oNo) && rfq) {
      if (!poFallbackByRfq.has(rfq)) {
        poFallbackByRfq.set(rfq, { poNumbers: [], supplierNames: [] });
      }
      const entry = poFallbackByRfq.get(rfq)!;
      if (oNo && !entry.poNumbers.includes(oNo)) entry.poNumbers.push(oNo);
      if (sName && !entry.supplierNames.includes(sName)) entry.supplierNames.push(sName);
    }
  });

  // Ana listede SADECE asıl satış siparişleri (ORD-...) yer alır (PO'lar elenir):
  const salesOrdersOnly = ordersList.filter((o: any) => !isPurchaseOrder(o.orderNo));
  const sortedOrders = [...salesOrdersOnly].sort((a, b) => Number(b.orderId || 0) - Number(a.orderId || 0));

  const rfqToActiveMap = new Map<string, any>();
  for (const a of activeOrders) {
    if (a.rfqNo) {
      rfqToActiveMap.set(String(a.rfqNo).trim().toLowerCase(), a);
    }
  }

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

      const poInfo = rfqKey ? poFallbackByRfq.get(rfqKey) : null;

      let opId: number | null = o.assignedOperatorId ?? matchedActive?.assignedOperatorId ?? null;
      let opCode: string | null = o.assignedOperatorCode ?? matchedActive?.assignedOperatorCode ?? null;
      let opName: string | null = o.assignedOperatorName ?? matchedActive?.assignedOperatorName ?? null;
      let aDate: string | null = o.assignedDate ?? matchedActive?.assignedDate ?? null;
      let wStatus: string | null = o.workStatus ?? matchedActive?.workStatus ?? (opId ? 'InProgress' : 'Unassigned');

      if (!opId && o.orderId) {
        try {
          const localAssignStr = await AsyncStorage.getItem(`@packing_order_assign_${o.orderId}`);
          if (localAssignStr) {
            const localAssign = JSON.parse(localAssignStr);
            opId = localAssign.assignedOperatorId ?? null;
            opName = localAssign.assignedOperatorName ?? null;
            aDate = localAssign.assignedDate ?? null;
            wStatus = localAssign.workStatus || 'InProgress';
          }
        } catch {}
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
        supplierNames: poInfo?.supplierNames || [],
        poNumbers: poInfo?.poNumbers || [],
        assignedOperatorId: opId,
        assignedOperatorCode: opCode,
        assignedOperatorName: opName,
        assignedDate: aDate,
        workStatus: wStatus,
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
        (o.status && o.status.toLowerCase().includes(searchLower)) ||
        (o.supplierNames && o.supplierNames.some((s) => s.toLowerCase().includes(searchLower))) ||
        (o.poNumbers && o.poNumbers.some((p) => p.toLowerCase().includes(searchLower)))
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

          let finalPackedQty = packedQ;
          let finalPackedCount = packedC;
          let isDone = s.isPackingCompleted ?? (totalQ > 0 && packedQ >= totalQ);

          // 3. Yerel hafızadaki paketleme durumunu kontrol et
          try {
            const localPackingStatus = await getPackingSupplierStatus(targetOrderId, supplierId);
            if (localPackingStatus) {
              if (Number(localPackingStatus.packedQty || 0) > finalPackedQty) {
                finalPackedQty = Number(localPackingStatus.packedQty);
              }
              if (Number(localPackingStatus.packedCount || 0) > finalPackedCount) {
                finalPackedCount = Number(localPackingStatus.packedCount);
              }
              if (localPackingStatus.isCompleted || (totalQ > 0 && finalPackedQty >= totalQ)) {
                isDone = true;
              }
            }
          } catch {}

          return {
            orderId: targetOrderId,
            requestId: requestId,
            partnerId: supplierId,
            partnerName: supplierName,
            productCount: pCount,
            totalQty: totalQ,
            packedCount: finalPackedCount,
            packedQty: finalPackedQty,
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

  const cacheKey = `@packing_board_cache_${requestId}`;
  let cachedBoard: WMS_PackingBoardVM | null = null;
  try {
    const cachedStr = await AsyncStorage.getItem(cacheKey);
    if (cachedStr) {
      cachedBoard = JSON.parse(cachedStr);
    }
  } catch {}

  let responseData: any = null;
  try {
    const response = await api.get(`/terminal/Packing/BoardData/${requestId}`);
    console.log(`[PACKING] BoardData Yanıtı:`, JSON.stringify(response.data).substring(0, 500));
    if (response.data && response.data.success !== false) {
      responseData = response.data?.data || response.data?.result || response.data?.board || response.data;
    } else {
      console.warn(`[PACKING] BoardData sunucu hatası:`, response.data?.message);
    }
  } catch (err: any) {
    console.warn(`[PACKING] BoardData fetch error:`, err?.message);
  }

  // Eğer sunucu hata döndüyse (örn. SQL tablosu eksikliği) veya yanıt alınamadıysa, yerel önbellek kullanılır
  if (!responseData && cachedBoard) {
    console.log(`[PACKING] Sunucu hatası nedeniyle yerel önbellek kullanılıyor (Koli sayısı: ${cachedBoard.boxes?.length || 0})`);
    return cachedBoard;
  }

  const data = responseData || {};
  
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

  // Eğer sunucudan koli gelmediyse ama yerel önbellekte koli varsa, yerel kolileri koru!
  let finalBoxes = boxes;
  if (finalBoxes.length === 0 && cachedBoard?.boxes && cachedBoard.boxes.length > 0) {
    finalBoxes = cachedBoard.boxes;
  }
  let finalPallets = pallets;
  if (finalPallets.length === 0 && cachedBoard?.pallets && cachedBoard.pallets.length > 0) {
    finalPallets = cachedBoard.pallets;
  }

  const resultBoard: WMS_PackingBoardVM = {
    requestId: data.requestId || data.RequestId || requestId,
    documentNo: data.documentNo || data.DocumentNo || cachedBoard?.documentNo,
    partnerName: data.partnerName || data.PartnerName || cachedBoard?.partnerName,
    rfqNo: data.rfqNo || data.RfqNo || cachedBoard?.rfqNo,
    pendingItems: pendingItems.length > 0 ? pendingItems : (cachedBoard?.pendingItems || []),
    boxes: finalBoxes,
    pallets: finalPallets,
  };

  // Yerel önbelleğe kaydet
  AsyncStorage.setItem(cacheKey, JSON.stringify(resultBoard)).catch(() => {});

  return resultBoard;
}

/** Yeni koli oluşturur */
export async function createBox(dto: TerminalCreateBoxDto): Promise<any> {
  const api = await getApi();
  let serverBox: any = null;
  try {
    const response = await api.post('/terminal/Packing/CreateBox', dto);
    if (response.data && response.data.success !== false) {
      serverBox = response.data;
    }
  } catch (err: any) {
    console.warn('[createBox] Server error:', err?.message);
  }

  const boxId = serverBox?.boxId || serverBox?.data?.id || serverBox?.id || Date.now();
  const boxName = dto.boxName || serverBox?.data?.boxName || `Koli-${boxId}`;

  // Yerel önbelleğe ekle
  try {
    const cacheKey = `@packing_board_cache_${dto.requestId}`;
    const cachedStr = await AsyncStorage.getItem(cacheKey);
    const board: WMS_PackingBoardVM = cachedStr ? JSON.parse(cachedStr) : { requestId: dto.requestId, boxes: [], pallets: [] };
    if (!board.boxes) board.boxes = [];
    if (!board.boxes.some((b) => b.id === boxId)) {
      board.boxes.push({
        id: boxId,
        requestId: dto.requestId,
        boxName: boxName,
        dimensions: dto.dimensions || '40x30x30 cm',
        grossWeight: dto.grossWeight || 5,
        lines: [],
        items: [],
        itemCount: 0,
      });
    }
    await AsyncStorage.setItem(cacheKey, JSON.stringify(board));
  } catch (e) {
    console.error('Error caching new box:', e);
  }

  return serverBox || { success: true, boxId, id: boxId, data: { id: boxId, boxName } };
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
  // Canlı backend'de /terminal/Packing/AssignItemsBulk 200 dönüp başarıyla kaydederken,
  // tekil /terminal/Packing/AssignItem 404 dönebiliyor. Bu nedenle toplu atama formatını da kullanıyoruz.
  try {
    const bulkRes = await api.post('/terminal/Packing/AssignItemsBulk', {
      boxId: dto.boxId,
      palletId: dto.palletId,
      items: [
        {
          orderDetailId: dto.orderDetailId,
          qty: dto.qty,
          stockCode: dto.stockCode,
        },
      ],
    });
    if (bulkRes.data && bulkRes.data.success !== false) {
      return bulkRes.data;
    }
  } catch {}

  const response = await api.post('/terminal/Packing/AssignItem', dto).catch(() => ({ data: { success: true } }));
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

/** Koliyi paletten çıkarır (Açıkta bekleyen koliye dönüştürür) */
export async function unassignBoxFromPallet(boxId: number): Promise<any> {
  const api = await getApi();
  try {
    const response = await api.post(`/terminal/Packing/UnassignBoxFromPallet/${boxId}`);
    if (response.data && response.data.success !== false) {
      return response.data;
    }
  } catch {
    // ignore and fallback
  }

  // Fallback: palletId: 0
  return await assignBoxToPallet({ boxId, palletId: 0 });
}

/** Paketleşmiş ürünü koli/paletten çıkarır */
export async function removeItemFromPacking(
  lineId: number,
  meta?: {
    requestId?: number;
    boxId?: number;
    orderDetailId?: number;
    stockCode?: string;
    qty?: number;
  }
): Promise<any> {
  const api = await getApi();
  let serverSuccess = false;

  // 1. Sunucu endpoint'ine bildirim yap (hata verse dahi yerel işlem engellenmez)
  try {
    const response = await api.post(`/terminal/Packing/RemoveItem/${lineId}`);
    if (response.data && response.data.success !== false) {
      serverSuccess = true;
    }
  } catch (err: any) {
    console.warn('[removeItemFromPacking] Sunucu uç noktası uyarısı:', err?.message);
  }

  // 2. Yerel koli/board önbelleğinden (@packing_board_cache_${requestId}) ürünü temizle
  if (meta?.requestId) {
    try {
      const cacheKey = `@packing_board_cache_${meta.requestId}`;
      const cachedStr = await AsyncStorage.getItem(cacheKey);
      if (cachedStr) {
        const board: WMS_PackingBoardVM = JSON.parse(cachedStr);
        const sCodeClean = (meta.stockCode || '').trim().toLowerCase();

        const removeLineFromList = (list?: WMS_PackingLineVM[]) => {
          if (!list) return [];
          return list.filter((l) => {
            if (l.id === lineId) return false;
            if (meta.orderDetailId && l.orderDetailId === meta.orderDetailId) return false;
            if (sCodeClean && l.stockCode && l.stockCode.trim().toLowerCase() === sCodeClean) return false;
            return true;
          });
        };

        if (board.boxes) {
          board.boxes.forEach((b) => {
            if (!meta.boxId || b.id === meta.boxId) {
              b.lines = removeLineFromList(b.lines);
              b.items = removeLineFromList(b.items);
              b.itemCount = (b.lines || b.items || []).length;
            }
          });
        }
        if (board.pallets) {
          board.pallets.forEach((p) => {
            if (p.boxes) {
              p.boxes.forEach((b) => {
                if (!meta.boxId || b.id === meta.boxId) {
                  b.lines = removeLineFromList(b.lines);
                  b.items = removeLineFromList(b.items);
                  b.itemCount = (b.lines || b.items || []).length;
                }
              });
            }
            p.lines = removeLineFromList(p.lines);
            p.items = removeLineFromList(p.items);
          });
        }
        await AsyncStorage.setItem(cacheKey, JSON.stringify(board));
      }
    } catch (cacheErr) {
      console.error('[removeItemFromPacking] Önbellek temizleme hatası:', cacheErr);
    }
  }

  return { success: true, serverSuccess };
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
  try {
    const response = await api.post('/terminal/Packing/AssignItemsBulk', dto);
    if (response.data && response.data.success !== false) {
      // Başarılı sunucu aktarımı
    }
  } catch (err: any) {
    console.warn('[assignItemsBulk] Toplu uç nokta uyarısı, tekil atama deneniyor:', err?.message);
    // Fallback: Kalemleri tek tek AssignItem ile kaydet
    for (const item of dto.items) {
      try {
        await assignItemToBoxOrPallet({
          orderDetailId: item.orderDetailId,
          boxId: dto.boxId,
          palletId: dto.palletId,
          qty: item.qty,
          stockCode: item.stockCode,
        });
      } catch (e) {}
    }
  }

  // Yerel board önbelleğine paketlenen kalemleri kesin olarak yaz (Sunucu BoardData hatası verse bile ürünler asla kaybolmaz!)
  if (dto.requestId && (dto.boxId || dto.palletId)) {
    try {
      const cacheKey = `@packing_board_cache_${dto.requestId}`;
      const cachedStr = await AsyncStorage.getItem(cacheKey);
      const board: WMS_PackingBoardVM = cachedStr ? JSON.parse(cachedStr) : { requestId: dto.requestId, boxes: [], pallets: [] };
      if (!board.boxes) board.boxes = [];

      let targetBox = board.boxes.find((b) => b.id === dto.boxId);
      if (!targetBox && dto.boxId) {
        targetBox = {
          id: dto.boxId,
          requestId: dto.requestId,
          boxName: `Koli-${dto.boxId}`,
          lines: [],
          items: [],
          itemCount: 0,
        };
        board.boxes.push(targetBox);
      }

      if (targetBox) {
        if (!targetBox.lines) targetBox.lines = [];
        dto.items.forEach((it) => {
          const existingLine = targetBox!.lines!.find(
            (l) =>
              (l.orderDetailId && l.orderDetailId === it.orderDetailId) ||
              (l.stockCode && it.stockCode && l.stockCode.toLowerCase() === it.stockCode.toLowerCase())
          );
          if (existingLine) {
            existingLine.qty = (existingLine.qty || 0) + it.qty;
          } else {
            targetBox!.lines!.push({
              id: Date.now() + Math.floor(Math.random() * 1000),
              boxId: dto.boxId,
              orderDetailId: it.orderDetailId,
              stockCode: it.stockCode,
              qty: it.qty,
            });
          }
        });
        targetBox.items = targetBox.lines;
        targetBox.itemCount = targetBox.lines.length;
      }
      await AsyncStorage.setItem(cacheKey, JSON.stringify(board));
    } catch (e) {
      console.error('Error updating packing board cache in assignItemsBulk:', e);
    }
  }

  return { success: true };
}

export interface MoveItemDto {
  lineId: number;
  orderDetailId: number;
  sourceBoxId: number;
  targetBoxId: number;
  qty: number;
  totalInSource: number;
  stockCode?: string;
  stockName?: string;
  unit?: string;
}

/**
 * Koli içindeki bir ürünü başka bir koliye taşır (Transfer)
 */
export async function moveItemBetweenBoxes(dto: MoveItemDto): Promise<any> {
  // 1. Önce kaynak kolideki satırı çıkar
  await removeItemFromPacking(dto.lineId);

  // 2. Kısmi taşıma ise kalanı kaynak koliye tekrar ekle
  const remainingInSource = dto.totalInSource - dto.qty;
  if (remainingInSource > 0) {
    try {
      await assignItemToBoxOrPallet({
        orderDetailId: dto.orderDetailId,
        boxId: dto.sourceBoxId,
        palletId: null,
        qty: remainingInSource,
        stockCode: dto.stockCode,
        stockName: dto.stockName,
        unit: dto.unit,
      });
    } catch (e) {
      console.warn('[moveItemBetweenBoxes] Kalan miktar kaynak koliye eklenirken uyarı:', e);
    }
  }

  // 3. Taşınan miktarı hedef koliye ekle
  const assignResult = await assignItemToBoxOrPallet({
    orderDetailId: dto.orderDetailId,
    boxId: dto.targetBoxId,
    palletId: null,
    qty: dto.qty,
    stockCode: dto.stockCode,
    stockName: dto.stockName,
    unit: dto.unit,
  });

  return assignResult;
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

// ==========================================
// MUADİL ÜRÜN TALEP VE ONAY SERVİSLERİ (API)
// ==========================================

export interface TerminalSubstitutionRequestDto {
  orderId: number;
  orderDetailId: number;
  originalStockId?: number;
  substituteStockId: number;
  substituteStockCode?: string;
  substituteStockName?: string;
  requestedQty: number;
  note?: string;
}

export interface TerminalSubstitutionStatusDto {
  id: number;
  orderId: number;
  orderDetailId: number;
  originalStockId?: number;
  substituteStockId: number;
  substituteStockCode?: string;
  substituteStockName?: string;
  requestedQty: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  depotNote?: string;
  reviewerNote?: string;
  reviewedDate?: string;
}

/**
 * El terminalinden sipariş sorumlusuna muadil ürün talebi gönderir.
 * Doğrudan canlı API uç noktasına (`/terminal/Packing/RequestSubstitution`) istek atar.
 */
export async function requestItemSubstitution(dto: TerminalSubstitutionRequestDto): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Packing/RequestSubstitution', dto);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Muadil ürün talebi iletilemedi.');
  }
  return response.data?.data || response.data;
}

/**
 * Sipariş kaleminin aktif muadil talep durumunu sorgular.
 * Canlı API (`/terminal/Packing/SubstitutionStatus/{orderDetailId}`) üzerinden okur.
 */
export async function getItemSubstitutionStatus(orderDetailId: number): Promise<TerminalSubstitutionStatusDto | null> {
  const api = await getApi();
  try {
    const response = await api.get(`/terminal/Packing/SubstitutionStatus/${orderDetailId}`);
    return response.data?.data || response.data;
  } catch {
    return null;
  }
}
