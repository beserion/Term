import { getApi } from './api';

export interface Warehouse {
  id: number;
  warehouseCode?: string;
  warehouseName?: string;
}

export interface Stock {
  id: number;
  stockCode?: string;
  stockName?: string;
  barCode?: string;
  companyId?: number;
  shelfAddress?: string;
  unit?: string;
  qty?: number;
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
  }>;
}

/** Tüm depoları getirir */
export async function getWarehouses(): Promise<Warehouse[]> {
  const api = await getApi();
  const response = await api.get('/Inventory/warehouses');
  return response.data;
}

/** Tüm stokları getirir */
export async function getStocks(): Promise<Stock[]> {
  const api = await getApi();
  const response = await api.get('/Inventory/stocks');
  return response.data;
}

/** Barkod/QR ile tekil stok kartını getirir (Yeni POST qrcode endpoint) */
export async function getStockByBarcode(barcode: string): Promise<Stock> {
  const api = await getApi();
  // .NET backend "application/json" beklerken body type "string" olduğundan JSON.stringify() ile sarıyoruz.
  const response = await api.post('/Inventory/stock/qrcode', JSON.stringify(barcode), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  // Backend yeni qrcode metodunda cevabı { success: true, data: { ... } } wrapper objesi olarak dönüyor.
  if (response.data && response.data.data) {
    return response.data.data;
  }
  
  return response.data;
}

/** Belirli bir depodaki tüm mevcut stok miktarlarını getirir */
export async function getStockOnHand(warehouseId: number): Promise<any> {
  const api = await getApi();
  const response = await api.get(`/Inventory/stock-on-hand/${warehouseId}`);
  return response.data;
}

/** Belirli bir depodaki belirli stok ürününün miktarını getirir */
export async function getStockOnHandForProduct(warehouseId: number, stockId: number): Promise<any> {
  const api = await getApi();
  const response = await api.get(`/Inventory/stock-on-hand/${warehouseId}/${stockId}`);
  return response.data;
}

/** Mal Kabul / Stok Ekleme (Goods Receipt) */
export async function createGoodsReceipt(data: GoodsReceipt): Promise<void> {
  const api = await getApi();
  // documentNo şimdilik boş gönderilecek
  if (!data.documentNo) data.documentNo = '';
  await api.post('/Inventory/goods-receipt', data);
}

/** Mal Çıkış / Stok Düşme (Goods Issue) */
export async function createGoodsIssue(data: GoodsIssue): Promise<void> {
  const api = await getApi();
  if (!data.documentNo) data.documentNo = '';
  await api.post('/Inventory/goods-issue', data);
}
