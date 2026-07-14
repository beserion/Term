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
  companyId?: number;
  shelfAddress?: string;
  unit?: string;
  qty?: number;
  photo?: string;
  imageUrl?: string;
  brand?: string;
  model?: string;
  impaCode?: string;
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
  const response = await api.get('/terminal/Inventory/Warehouses');
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

/** Tüm stokları getirir */
export async function getStocks(): Promise<Stock[]> {
  const api = await getApi();
  const response = await api.get('/terminal/Inventory/Stocks');
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

/** Barkod/QR ile tekil stok kartını getirir */
export async function getStockByBarcode(barcode: string): Promise<Stock> {
  const api = await getApi();
  // .NET backend "application/json" beklerken body type "string" olduğundan JSON.stringify() ile sarıyoruz.
  const response = await api.post('/terminal/Inventory/Stock/QrCode', JSON.stringify(barcode), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (response.data && response.data.data) {
    return response.data.data;
  }
  
  return response.data;
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
  const response = await api.post('/Inventory/goods-receipt', data);
  
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Stok ekleme işlemi başarısız oldu.');
    err.response = response;
    throw err;
  }
}

/** Mal Çıkış / Stok Düşme (Goods Issue) */
export async function createGoodsIssue(payload: GoodsIssueDto): Promise<void> {
  const api = await getApi();
  const response = await api.post('/Inventory/goods-issue', payload);
  
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Stok azaltma işlemi başarısız oldu.');
    err.response = response;
    throw err;
  }
}

/** Stok Transferi (Stock Transfer) */
export async function createStockTransfer(payload: StockTransferDto): Promise<void> {
  const api = await getApi();
  const response = await api.post('/Inventory/stock-transfer', payload);
  
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

    cycleCountId = startResponse.data?.id || startResponse.data?.data?.id || startResponse.data?.cycleCountId;
  }

  if (!cycleCountId) {
    throw new Error('Sayım başlatılamadı, geçerli bir Sayım ID alınamadı.');
  }

  // 2. Her bir kalemi SaveItem uç noktasına gönder
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
}

export interface PrintLabelDto {
  printerId: number;
  barcode?: string;
  qrCode?: string;
  quantity: number;
}

/** Yazıcı Listesini Al */
export async function getPrinters(): Promise<PrinterDto[]> {
  const api = await getApi();
  const response = await api.get('/terminal/Settings/Printers');
  
  console.log("=== GET_PRINTERS RESPONSE RAW ===", JSON.stringify(response.data));

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
      // Dizi değilse ama bir objeyse (örneğin dictionary ise) diziye dönüştür
      rawList = Object.entries(response.data.data).map(([key, value]) => ({
        id: key,
        name: value
      }));
    }
  }

  // Özellikleri (id, printerId, value, vb.) ve (name, printerName, text, vb.) esnek şekilde normalize et
  return rawList.map((item: any) => {
    const id = Number(item.printerId ?? item.id ?? item.value ?? item.key ?? 0);
    const name = String(item.printerName ?? item.name ?? item.text ?? item.value ?? 'Bilinmeyen Yazıcı');
    return { id, name };
  });
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

/** Resmi sunucuya yükler ve kaydedilen dosya yolunu/URL'ini döner */
export async function uploadImage(imageUri: string): Promise<string> {
  const api = await getApi();
  const formData = new FormData();
  
  const filename = imageUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;
  
  formData.append('file', {
    uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
    name: filename,
    type,
  } as any);

  const response = await api.post('/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

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


