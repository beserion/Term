import { getApi } from './api';
import { Platform } from 'react-native';

export interface Warehouse {
  id: number;
  warehouseCode?: string;
  warehouseName?: string;
}

export interface Stock {
  id: number;
  stockCode?: string;
  stockName?: string;
  stockNameTr?: string;
  barCode?: string;
  qrCode?: string;
  description?: string;
  remarks?: string;
  companyId?: number;
  shelfAddress?: string;
  unit?: string;
  qty?: number;
  photo?: string;
  imageUrl?: string;
  brand?: string;
  model?: string;
  impaCode?: string;
  partNo?: string;
}

export interface GoodsReceiptLine {
  stockId: number;
  qty: number;
}

export interface GoodsReceiptDto {
  documentDate: string;
  documentNo: string;
  warehouseId: number;
  lines: Array<{
    stockId: number;
    receivedQty: number;
    qty?: number;
    orderedQty?: number;
  }>;
}

export interface GoodsIssueLine {
  stockId: number;
  qty: number;
}

export interface GoodsIssueDto {
  documentDate: string;
  documentNo: string;
  warehouseId: number;
  lines: Array<{
    stockId: number;
    issuedQty: number;
    qty?: number;
    requestedQty?: number;
  }>;
}

export interface StockTransferDto {
  documentDate: string;
  documentNo: string;
  fromWarehouseId: number;
  toWarehouseId: number;
  lines: Array<{
    stockId: number;
    transferQty: number;
    qty?: number;
    receivedQty?: number;
  }>;
}

export interface CycleCountListItemDto {
  id: number;
  documentNo?: string;
  countDate?: string;
  warehouseId?: number;
  warehouseName?: string;
  status?: string;
  remarks?: string;
}

export interface CycleCountDto {
  cycleCountId?: number;
  documentNo: string;
  countDate: string;
  warehouseId: number;
  lines: Array<{
    stockId: number;
    countedQty: number;
    shelfAddress?: string;
    photo?: string;
  }>;
}

/** Tüm depoları getirir */
export async function getWarehouses(): Promise<Warehouse[]> {
  const api = await getApi();
  let response;
  try {
    response = await api.get('Inventory/warehouses');
  } catch {
    try {
      response = await api.get('/terminal/Inventory/Warehouses');
    } catch {
      response = await api.get('/api/Inventory/warehouses');
    }
  }
  const data = response.data;
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
  }
  return [];
}

let cachedStocks: Stock[] | null = null;
let lastStocksFetchTime = 0;
const STOCKS_CACHE_TTL = 5 * 60 * 1000; // 5 dakika önbellek

/** Tüm stokları getirir (Terminal için tüm envanter - 5 dk önbellekli) */
export async function getStocks(forceRefresh: boolean = false): Promise<Stock[]> {
  const now = Date.now();
  if (!forceRefresh && cachedStocks && (now - lastStocksFetchTime < STOCKS_CACHE_TTL)) {
    return cachedStocks;
  }

  const api = await getApi();
  let response;
  try {
    response = await api.get('/terminal/Inventory/Stocks');
  } catch {
    try {
      response = await api.get('Inventory/stocks');
    } catch {
      response = await api.get('/api/Inventory/stocks');
    }
  }
  const data = response.data;
  let rawList: any[] = [];
  if (Array.isArray(data)) {
    rawList = data;
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) rawList = data.data;
    else if (Array.isArray(data.items)) rawList = data.items;
  }
  const result = rawList.map((item) => {
    const idVal = item.id || item.stockId;
    const photoVal = item.photo || item.imageUrl || item.image || item.photoUrl || item.picture || item.filePath || item.fileName || item.pictureUrl || item.imagePath;
    const shelfVal = item.shelfAddress || item.ShelfAddress || item.rafAdresi || item.RafAdresi || item.raf || item.Raf || item.locationCode || item.LocationCode || item.location || item.Location || item.shelf || item.Shelf || item.rack || item.Rack || item.bin || item.Bin;
    return {
      ...item,
      id: idVal,
      photo: photoVal,
      imageUrl: photoVal,
      shelfAddress: shelfVal ? String(shelfVal).trim() : undefined,
    };
  });
  cachedStocks = result;
  return result;
}

const shelfCodeCache = new Map<string, string>();

/**
 * Stok kodu ile hızlı raf adresi sorgular (/terminal/Inventory/Stocks?search=...)
 * Ağır tüm stok listesi indirmesi yapmadan doğrudan doğru rafı getirir (Örn: C-6-2).
 */
export async function getShelfAddressForCode(stockCode: string): Promise<string> {
  const cleanCode = (stockCode || '').trim();
  if (!cleanCode) return 'Tanımsız';
  const lower = cleanCode.toLowerCase();
  const strippedLower = lower.replace(/^stk-?/, '');
  
  if (shelfCodeCache.has(lower)) {
    return shelfCodeCache.get(lower)!;
  }
  try {
    const api = await getApi();
    const res = await api.get(`/terminal/Inventory/Stocks?search=${encodeURIComponent(cleanCode)}`);
    const items = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    
    // 1. Önce hem kodu uyan hem de raf adresi dolu olanı seç
    let match = items.find((x: any) => {
      const sCode = (x.stockCode || '').trim().toLowerCase();
      const codeMatches = sCode === lower || sCode.replace(/^stk-?/, '') === strippedLower;
      const hasShelf = x.shelfAddress && String(x.shelfAddress).trim().length > 0;
      return codeMatches && hasShelf;
    });

    // 2. Bulunamazsa doğrudan kod eşleşmesi
    if (!match) {
      match = items.find((x: any) => {
        const sCode = (x.stockCode || '').trim().toLowerCase();
        return sCode === lower || sCode.replace(/^stk-?/, '') === strippedLower;
      });
    }

    const rawShelf = match?.shelfAddress || match?.ShelfAddress || match?.locationCode || match?.shelf;
    const shelf = (rawShelf && String(rawShelf).trim()) ? String(rawShelf).trim() : 'Tanımsız';
    
    if (shelf !== 'Tanımsız') {
      shelfCodeCache.set(lower, shelf);
      if (strippedLower !== lower) shelfCodeCache.set(strippedLower, shelf);
    }
    return shelf;
  } catch {
    return 'Tanımsız';
  }
}

export interface StockExtendedInfo {
  shelfAddress: string;
  stockNameTr?: string;
  brand?: string;
  model?: string;
}

const stockExtendedCache = new Map<string, StockExtendedInfo>();

/** Sayfalanmış ve optimize stok arama */
export async function searchStocksPaged(search: string, page: number = 1, pageSize: number = 30): Promise<Stock[]> {
  const api = await getApi();
  const response = await api.get(`/terminal/Inventory/Stocks/Search?search=${encodeURIComponent(search)}&page=${page}&pageSize=${pageSize}`);
  const data = response.data;
  const rawList: any[] = Array.isArray(data) ? data : (data?.data || []);
  return rawList.map((item) => ({
    id: item.id || item.stockId,
    stockCode: item.stockCode,
    impaCode: item.impaCode,
    stockName: item.stockName,
    stockNameTr: item.stockNameTr,
    brand: item.brand,
    model: item.model,
    shelfAddress: item.shelfAddress ? String(item.shelfAddress).trim() : undefined,
    barCode: item.barCode,
    unit: item.unit,
    qty: item.qty,
    photo: item.photo,
    imageUrl: item.photo,
  }));
}

/** Barkod veya stok kodu ile tekil hızlı stok kartı sorgulama (ByCode) */
export async function getStockByCode(stockCode: string): Promise<Stock | null> {
  const cleanCode = (stockCode || '').trim();
  if (!cleanCode) return null;
  const api = await getApi();
  try {
    const response = await api.get(`/terminal/Inventory/Stocks/ByCode/${encodeURIComponent(cleanCode)}`);
    const item = response.data?.data || response.data;
    if (item && (item.id || item.stockCode)) {
      return {
        id: item.id || item.stockId,
        stockCode: item.stockCode,
        impaCode: item.impaCode,
        stockName: item.stockName,
        stockNameTr: item.stockNameTr,
        brand: item.brand,
        model: item.model,
        shelfAddress: item.shelfAddress ? String(item.shelfAddress).trim() : undefined,
        barCode: item.barCode,
        unit: item.unit,
        qty: item.qty,
        photo: item.photo,
        imageUrl: item.photo,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Stok kodu ile raf adresi, Türkçe ürün adı, marka ve model bilgilerini getirir.
 */
export async function getStockDetailsForCode(stockCode: string): Promise<StockExtendedInfo> {
  const cleanCode = (stockCode || '').trim();
  if (!cleanCode) return { shelfAddress: 'Tanımsız' };
  const lower = cleanCode.toLowerCase();
  const strippedLower = lower.replace(/^stk-?/, '');

  if (stockExtendedCache.has(lower)) {
    return stockExtendedCache.get(lower)!;
  }

  try {
    // 1. Doğrudan ByCode endpoint'i ile O(1) hızlı arama
    const stock = await getStockByCode(cleanCode);
    if (stock) {
      const shelf = (stock.shelfAddress && String(stock.shelfAddress).trim().length > 0) ? String(stock.shelfAddress).trim() : 'Tanımsız';
      const result: StockExtendedInfo = {
        shelfAddress: shelf,
        stockNameTr: stock.stockNameTr,
        brand: stock.brand,
        model: stock.model,
      };
      stockExtendedCache.set(lower, result);
      if (strippedLower !== lower) stockExtendedCache.set(strippedLower, result);
      shelfCodeCache.set(lower, shelf);
      return result;
    }
  } catch {
    // fallback
  }

  try {
    const api = await getApi();
    const res = await api.get(`/terminal/Inventory/Stocks?search=${encodeURIComponent(cleanCode)}`);
    const items = Array.isArray(res.data) ? res.data : (res.data?.data || []);

    let match = items.find((x: any) => {
      const sCode = (x.stockCode || '').trim().toLowerCase();
      const codeMatches = sCode === lower || sCode.replace(/^stk-?/, '') === strippedLower;
      const hasShelf = x.shelfAddress && String(x.shelfAddress).trim().length > 0;
      return codeMatches && hasShelf;
    });

    if (!match) {
      match = items.find((x: any) => {
        const sCode = (x.stockCode || '').trim().toLowerCase();
        return sCode === lower || sCode.replace(/^stk-?/, '') === strippedLower;
      });
    }

    const rawShelf = match?.shelfAddress || match?.ShelfAddress || match?.locationCode || match?.shelf;
    const shelf = (rawShelf && String(rawShelf).trim()) ? String(rawShelf).trim() : 'Tanımsız';
    const stockNameTr = match?.stockNameTr || match?.StockNameTr || undefined;
    const brand = match?.brand || match?.Brand || undefined;
    const model = match?.model || match?.Model || undefined;

    const result: StockExtendedInfo = {
      shelfAddress: shelf,
      stockNameTr: stockNameTr && String(stockNameTr).trim() ? String(stockNameTr).trim() : undefined,
      brand: brand && String(brand).trim() ? String(brand).trim() : undefined,
      model: model && String(model).trim() ? String(model).trim() : undefined,
    };

    stockExtendedCache.set(lower, result);
    if (strippedLower !== lower) stockExtendedCache.set(strippedLower, result);
    shelfCodeCache.set(lower, shelf);

    return result;
  } catch {
    return { shelfAddress: 'Tanımsız' };
  }
}

/** Barkod/QR ile tekil stok kartını getirir */
export async function getStockByBarcode(barcode: string): Promise<Stock> {
  const cleanCode = (barcode || '').trim();
  if (cleanCode) {
    try {
      const stock = await getStockByCode(cleanCode);
      if (stock && stock.id) return stock;
    } catch {
      // fallback
    }
  }

  const api = await getApi();
  const response = await api.post('/terminal/Inventory/Stock/QrCode', JSON.stringify(cleanCode), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  const raw = (response.data && response.data.data) ? response.data.data : response.data;
  const images = response.data && response.data.images;
  const firstImage = (Array.isArray(images) && images.length > 0) ? images[0] : undefined;

  if (raw && typeof raw === 'object') {
    const photoVal = raw.photo || raw.imageUrl || raw.image || raw.photoUrl || raw.picture || raw.filePath || raw.fileName || raw.pictureUrl || raw.imagePath || firstImage;
    const shelfVal = raw.shelfAddress || raw.ShelfAddress || raw.rafAdresi || raw.RafAdresi || raw.raf || raw.Raf || raw.locationCode || raw.LocationCode || raw.location || raw.Location || raw.shelf || raw.Shelf || raw.rack || raw.Rack || raw.bin || raw.Bin;
    return {
      ...raw,
      id: raw.id || raw.stockId,
      photo: photoVal,
      imageUrl: photoVal,
      shelfAddress: shelfVal ? String(shelfVal).trim() : undefined,
    };
  }
  
  return raw;
}

/** Belirli bir depodaki tüm mevcut stok miktarlarını getirir */
export async function getStockOnHand(warehouseId: number): Promise<any> {
  const api = await getApi();
  const response = await api.get(`/terminal/Inventory/StockOnHand/${warehouseId}`);
  return response.data;
}

/** Belirli bir depodaki belirli stok ürününün miktarını getirir */
export async function getStockOnHandForProduct(warehouseId: number, stockId: number): Promise<any> {
  const api = await getApi();
  const response = await api.get(`/terminal/Inventory/StockOnHand/${warehouseId}/${stockId}`);
  return response.data;
}

/** Mal Kabul / Stok Ekleme (Goods Receipt) */
export async function createGoodsReceipt(data: GoodsReceiptDto): Promise<void> {
  const api = await getApi();
  if (!data.documentNo) data.documentNo = '';
  let response;
  try {
    response = await api.post('/terminal/Inventory/goods-receipt', data);
  } catch {
    response = await api.post('/Inventory/goods-receipt', data);
  }
  
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Stok ekleme işlemi başarısız oldu.');
    err.response = response;
    throw err;
  }
}

/** Mal Çıkış / Stok Düşme (Goods Issue) */
export async function createGoodsIssue(payload: GoodsIssueDto): Promise<void> {
  const api = await getApi();
  let response;
  try {
    response = await api.post('/terminal/Inventory/goods-issue', payload);
  } catch {
    response = await api.post('/Inventory/goods-issue', payload);
  }
  
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Stok azaltma işlemi başarısız oldu.');
    err.response = response;
    throw err;
  }
}

/** Stok Transferi (Stock Transfer) */
export async function createStockTransfer(payload: StockTransferDto): Promise<void> {
  const api = await getApi();
  let response;
  try {
    response = await api.post('/terminal/Inventory/stock-transfer', payload);
  } catch {
    response = await api.post('/Inventory/stock-transfer', payload);
  }
  
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Stok transferi işlemi başarısız oldu.');
    err.response = response;
    throw err;
  }
}

/** Depo Sayım (Cycle-Count) Başlatma, Kaydetme ve Tamamlama sıralı akışı */
export async function createCycleCount(payload: CycleCountDto): Promise<any> {
  const api = await getApi();
  
  let cycleCountId = payload.cycleCountId;

  // Eğer seçili bir sayım ID'si yoksa yeni sayım başlatmayı dener
  if (!cycleCountId) {
    const startResponse = await api.post('/terminal/Inventory/CycleCount/Start', {
      warehouseId: payload.warehouseId,
      documentNo: payload.documentNo,
      countDate: payload.countDate
    });

    cycleCountId = startResponse.data?.id || startResponse.data?.data?.id || startResponse.data?.cycleCountId || startResponse.data?.data?.cycleCountId;
  }

  if (!cycleCountId) {
    throw new Error('Sayım başlatılamadı, geçerli bir Sayım ID alınamadı.');
  }

  // 2. Kalemleri topluca SaveItemsBulk uç noktasına gönder (tek HTTP isteği)
  try {
    const bulkResponse = await api.post('/terminal/Inventory/CycleCount/SaveItemsBulk', {
      cycleCountId,
      lines: payload.lines.map(l => ({
        stockId: l.stockId,
        countedQty: l.countedQty,
        shelfAddress: l.shelfAddress,
        photo: l.photo
      }))
    });

    if (bulkResponse.data && bulkResponse.data.success === false) {
      throw new Error(bulkResponse.data.message || 'Toplu sayım kaydedilemedi.');
    }
  } catch (bulkErr) {
    console.warn('SaveItemsBulk failed, falling back to sequential SaveItem:', bulkErr);
    // Fallback: her bir kalemi SaveItem uç noktasına gönder
    for (const line of payload.lines) {
      const saveResponse = await api.post('/terminal/Inventory/CycleCount/SaveItem', {
        cycleCountId,
        stockId: line.stockId,
        countedQty: line.countedQty,
        shelfAddress: line.shelfAddress,
        photo: line.photo
      });

      if (saveResponse.data && saveResponse.data.success === false) {
        const errMessage = saveResponse.data.message || 'Ürün sayım satırı kaydedilemedi.';
        throw new Error(`Satır Kayıt Hatası:\n${errMessage}`);
      }
    }
  }

  // 3. Sayımı Tamamla
  const completeResponse = await api.post('/terminal/Inventory/CycleCount/Complete', {
    cycleCountId,
    stockId: 0,
    countedQty: 0
  });

  return completeResponse.data;
}

/** Depo Sayımını Tamamla */
export async function completeCycleCount(id: number): Promise<void> {
  const api = await getApi();
  await api.post('/terminal/Inventory/CycleCount/Complete', {
    cycleCountId: id,
    stockId: 0,
    countedQty: 0
  });
}

/** Tüm aktif/bekleyen sayım listelerini getirir */
export async function getCycleCounts(): Promise<CycleCountListItemDto[]> {
  const api = await getApi();
  const response = await api.get('/terminal/Inventory/CycleCount/List');
  const data = response.data;
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
  }
  return [];
}

export interface PrinterDto {
  id: number;
  name: string;
  ipAddress?: string;
  port?: number;
  location?: string;
}

export interface PrintLabelDto {
  printerId: number;
  barcode?: string;
  qrCode?: string;
  quantity: number;
}

/** Yazıcı Listesini Al */
export async function getPrinters(): Promise<PrinterDto[]> {
  try {
    const api = await getApi();
    const response = await api.get('/terminal/Settings/Printers');
    
    let rawList: any[] = [];
    if (response.data) {
      if (Array.isArray(response.data)) {
        rawList = response.data;
      } else if (Array.isArray(response.data.data)) {
        rawList = response.data.data;
      } else if (response.data.success && Array.isArray(response.data.data)) {
        rawList = response.data.data;
      } else if (response.data.items && Array.isArray(response.data.items)) {
        rawList = response.data.items;
      } else if (typeof response.data.data === 'object' && response.data.data !== null) {
        rawList = Object.entries(response.data.data).map(([key, value]) => ({
          id: key,
          name: value
        }));
      }
    }

    const list: PrinterDto[] = rawList.map((item: any) => {
      const id = Number(item.printerId ?? item.id ?? item.value ?? item.key ?? 0);
      const name = String(item.printerName ?? item.name ?? item.text ?? item.value ?? 'Bilinmeyen Yazıcı');
      const ipAddress = item.ipAddress || item.ip || item.host || '';
      const port = Number(item.port || 6101);
      const location = String(item.location || '');
      return { id, name, ipAddress, port, location };
    });

    return list.length > 0 ? list : [{ id: 1, name: 'Zebra ZT410 (Varsayılan)', ipAddress: '192.168.1.100', port: 6101 }];
  } catch {
    console.log('[getPrinters] Sunucu yanıt vermedi, varsayılan yazıcı listesi yükleniyor.');
    return [{ id: 1, name: 'Zebra ZT410 (Varsayılan)', ipAddress: '192.168.1.100', port: 6101 }];
  }
}

export interface PrintLabelResponse {
  success: boolean;
  message: string;
  cpclData: string;
  printerIp: string;
  printerPort: number;
}

/** Etiket Yazdırma */
export async function printLabel(payload: PrintLabelDto): Promise<PrintLabelResponse> {
  const api = await getApi();
  const response = await api.post('/terminal/Settings/PrintLabel', payload);
  if (response.data && response.data.success === false) {
    throw new Error(response.data.message || 'Etiket yazdırılamadı.');
  }
  return response.data;
}

/** Stok ürünün barkodunu günceller/tanımlar */
export async function updateStockBarcode(stockId: number, barcode: string, photo?: string): Promise<void> {
  const api = await getApi();
  const response = await api.post('/terminal/Inventory/Stock/UpdateBarcode', {
    stockId,
    barcode,
    photo
  });
  
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Barkod güncellenemedi.');
    err.response = response;
    throw err;
  }
}

/** Stok ürünün raf konumunu günceller */
export async function updateStockShelfAddress(stockId: number, shelfAddress: string): Promise<void> {
  const api = await getApi();
  const response = await api.post('/terminal/Inventory/Stock/UpdateShelf', {
    stockId,
    shelfAddress
  });
  
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Raf konumu güncellenemedi.');
    err.response = response;
    throw err;
  }
}

async function uriToBase64(uri: string): Promise<string> {
  if (uri.startsWith('data:')) {
    const parts = uri.split(',');
    return parts[1] || uri;
  }
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result ? (result.split(',')[1] || result) : '';
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/** Resmi sunucuya yükler ve kaydedilen dosya yolunu/URL'ini döner */
export async function uploadImage(imageUri: string, stockId: number = 0): Promise<string> {
  const api = await getApi();
  
  const filename = imageUri.split('/').pop()?.split('?')[0] || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? `.${match[1]}` : '.jpg';
  const base64Data = await uriToBase64(imageUri);
  console.log('[uploadImage] Base64 karakter uzunluğu:', base64Data.length);

  const payload = {
    stockId: Number(stockId || 0),
    imageBase64: base64Data,
    fileExtension: ext,
  };

  const response = await api.post('/terminal/Inventory/Stock/UploadImageBase64', payload);

  const data = response.data;
  console.log('Upload image response data:', data);

  if (typeof data === 'string') {
    return data;
  }
  if (data && typeof data === 'object') {
    return data.data || data.url || data.path || data.fileName || data.filePath || '';
  }
  return '';
}

/** Stok Kartı Ekleme (Inventory/Stock/Add) */
export async function addStock(payload: Partial<Stock>): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Inventory/Stock/Add', payload);
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Stok kartı eklenemedi.');
    err.response = response;
    throw err;
  }
  return response.data?.data || response.data;
}

/** Stok Kartı Güncelleme (Inventory/Stock/Update) */
export async function updateStock(payload: Stock): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/Inventory/Stock/Update', payload);
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Stok kartı güncellenemedi.');
    err.response = response;
    throw err;
  }
  return response.data?.data || response.data;
}

// ==========================================
// FAZ 2 MOBİL WMS LOKASYON & RAF YÖNETİMİ
// ==========================================

export interface LocationStockItem {
  stockId: number;
  stockCode?: string;
  stockName?: string;
  barCode?: string;
  quantity: number;
  unit?: string;
}

export interface LocationScanResult {
  locationCode: string;
  warehouseId?: number;
  warehouseName?: string;
  items: LocationStockItem[];
}

export interface StockLocationDetail {
  locationCode: string;
  warehouseId?: number;
  warehouseName?: string;
  quantity: number;
}

export interface LocationTransferPayload {
  stockId: number;
  stockCode?: string;
  fromLocationCode: string;
  toLocationCode: string;
  transferQty?: number;
  quantity?: number;
  warehouseId?: number;
  remarks?: string;
}

export interface LocationPutawayPayload {
  stockId: number;
  stockCode?: string;
  locationCode: string;
  qty?: number;
  quantity?: number;
  warehouseId?: number;
}

export interface LocationPickPayload {
  stockId: number;
  stockCode?: string;
  fromLocationCode?: string;
  locationCode?: string;
  transferQty?: number;
  quantity?: number;
  orderId?: number;
  warehouseId?: number;
}

export interface PickingSuggestionResult {
  suggestedLocationCode: string;
  stockId: number;
  availableQuantity: number;
  warehouseId?: number;
}

/** 1. Raf/Lokasyon barkodunu okutarak raf detayını ve ürün listesini getirir */
export async function scanLocation(code: string): Promise<LocationScanResult> {
  const api = await getApi();
  const response = await api.get(`/terminal/Location/Scan/${encodeURIComponent(code)}`);
  const resData = response.data;
  
  if (resData && resData.success === false) {
    throw new Error(resData.message || 'Raf sorgulanamadı.');
  }

  const loc = resData?.location || resData?.data?.location || {};
  const rawItems = resData?.items || resData?.data?.items || (Array.isArray(resData) ? resData : []);

  const items: LocationStockItem[] = rawItems.map((item: any) => ({
    stockId: item.stockId || item.id,
    stockCode: item.stockCode || '',
    stockName: item.stockName || item.name || '',
    barCode: item.barCode || item.barcode || '',
    quantity: Number(item.qty ?? item.quantity ?? 0),
    unit: item.unit || 'Adet',
  }));

  return {
    locationCode: loc.locationCode || resData?.locationCode || code,
    warehouseId: loc.warehouseId,
    warehouseName: loc.locationName || loc.warehouseName,
    items,
  };
}

/** 2. Ürünün depodaki hangi raflarda ne kadar olduğunu getirir */
export async function getStockLocations(stockId: number): Promise<StockLocationDetail[]> {
  const api = await getApi();
  const response = await api.get(`/terminal/Location/StockLocations/${stockId}`);
  const resData = response.data;
  const rawList = Array.isArray(resData) ? resData : (Array.isArray(resData?.data) ? resData.data : []);
  
  return rawList.map((item: any) => ({
    locationCode: item.locationCode || item.shelfAddress || '',
    warehouseId: item.warehouseId,
    warehouseName: item.warehouseName || item.warehouseCode,
    quantity: Number(item.qty ?? item.quantity ?? 0)
  }));
}

/** 3. Raf-Raf Transferi (Bin Relocation) */
export async function transferLocation(payload: LocationTransferPayload): Promise<any> {
  const api = await getApi();
  const transferQty = payload.transferQty ?? payload.quantity ?? 0;
  
  const body = {
    stockId: payload.stockId,
    stockCode: payload.stockCode || '',
    fromLocationCode: (payload.fromLocationCode || '').trim().toUpperCase(),
    toLocationCode: (payload.toLocationCode || '').trim().toUpperCase(),
    transferQty: transferQty,
    warehouseId: payload.warehouseId || 1,
    remarks: payload.remarks || ''
  };

  const response = await api.post('/terminal/Location/Transfer', body);
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Raf transferi gerçekleştirilemedi.');
    err.response = response;
    throw err;
  }
  return response.data;
}

/** 4. Mobil Raflama (Putaway) */
export async function putawayLocation(payload: LocationPutawayPayload): Promise<any> {
  const api = await getApi();
  const qty = payload.qty ?? payload.quantity ?? 0;

  const body = {
    stockId: payload.stockId,
    stockCode: payload.stockCode || '',
    locationCode: (payload.locationCode || '').trim().toUpperCase(),
    qty: qty,
    warehouseId: payload.warehouseId || 1,
  };

  const response = await api.post('/terminal/Location/Putaway', body);
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Mobil raflama işlemi başarısız oldu.');
    err.response = response;
    throw err;
  }
  return response.data;
}

/** 5. Sipariş Toplama (Picking) */
export async function pickLocation(payload: LocationPickPayload): Promise<any> {
  const api = await getApi();
  const fromLocationCode = (payload.fromLocationCode || payload.locationCode || '').trim().toUpperCase();
  const transferQty = payload.transferQty ?? payload.quantity ?? 0;

  const body = {
    stockId: payload.stockId,
    stockCode: payload.stockCode || '',
    fromLocationCode: fromLocationCode,
    transferQty: transferQty,
    warehouseId: payload.warehouseId || 1,
  };

  const response = await api.post('/terminal/Location/Pick', body);
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Sipariş toplama işlemi başarısız oldu.');
    err.response = response;
    throw err;
  }
  return response.data;
}

/** 6. Akıllı Toplama Önerisi (Picking Suggestion) */
export async function getPickingSuggestion(stockId: number): Promise<PickingSuggestionResult> {
  const api = await getApi();
  const response = await api.get(`/terminal/Location/PickingSuggestion/${stockId}`);
  const resData = response.data;
  const suggestions = resData?.suggestions || resData?.data?.suggestions || [];
  const top = suggestions.length > 0 ? suggestions[0] : null;

  return {
    suggestedLocationCode: top ? top.locationCode : (resData?.suggestedLocationCode || ''),
    stockId: resData?.stockId || stockId,
    availableQuantity: top ? Number(top.availableQty ?? 0) : Number(resData?.availableQuantity ?? 0),
    warehouseId: resData?.warehouseId
  };
}





