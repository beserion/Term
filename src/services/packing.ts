import { getApi } from './api';

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
  boxCount?: number;
}

export interface PackingPendingItemVM {
  orderDetailId: number;
  stockId?: number;
  stockCode: string;
  stockName: string;
  unit?: string;
  totalQty: number;
  packedQty: number;
  remainingQty: number;
}

export interface WMS_PackingBoardVM {
  requestId?: number;
  documentNo?: string;
  partnerName?: string;
  rfqNo?: string;
  pendingItems?: PackingPendingItemVM[];
  boxes?: WMS_BoxVM[];
  pallets?: WMS_PalletVM[];
}

export interface PackingOrder {
  id: number;
  documentNo: string;
  orderDate?: string;
  partnerId?: number;
  partnerName?: string;
  status?: string;
  rfqNo?: string;
  productCount?: number;
  totalPackedRatio?: number;
}

/** Aktif paketlenebilir sipariş/RFQ listesini getirir */
export async function getActivePackingOrders(search?: string): Promise<PackingOrder[]> {
  const api = await getApi();
  const response = await api.get('/terminal/Packing/ActiveOrders');
  
  let rawData: any[] = [];
  if (response.data) {
    if (Array.isArray(response.data)) {
      rawData = response.data;
    } else if (Array.isArray(response.data.data)) {
      rawData = response.data.data;
    } else if (Array.isArray(response.data.orders)) {
      rawData = response.data.orders;
    }
  }

  let mapped: PackingOrder[] = rawData.map((item: any, index: number) => {
    const orderId = item.id || item.Id || item.orderId || item.OrderId || index + 1;
    return {
      id: orderId,
      documentNo: item.documentNo || item.DocumentNo || item.orderNo || item.OrderNo || item.rfqNo || item.RfqNo || `SIP-${orderId}`,
      orderDate: item.orderDate || item.OrderDate || item.date || item.transactionDate || '',
      partnerId: item.partnerId || item.PartnerId,
      partnerName: item.partnerName || item.PartnerName || item.customerName || 'Müşteri Belirtilmemiş',
      status: item.status || item.Status || 'Paketlemeye Hazır',
      rfqNo: item.rfqNo || item.RfqNo,
      productCount: item.productCount || item.ProductCount || item.itemCount || item.totalItemCount || 0,
      totalPackedRatio: item.packedRatio || item.PackedRatio || 0,
    };
  });

  if (search) {
    const searchLower = search.toLowerCase().trim();
    mapped = mapped.filter(
      (o) =>
        (o.documentNo && o.documentNo.toLowerCase().includes(searchLower)) ||
        (o.partnerName && o.partnerName.toLowerCase().includes(searchLower)) ||
        (o.rfqNo && o.rfqNo.toLowerCase().includes(searchLower))
    );
  }

  return mapped;
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
