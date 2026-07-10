import { getApi } from './api';

/**
 * Sipariş API Servisleri
 */

export interface OrderLine {
  id: number;
  orderId: number;
  stockId: number;
  stockCode: string;
  stockName: string;
  quantity: number;
  pickedQty?: number; // Terminalde toplanan miktar
  unitPrice?: number;
  unit?: string;
  isPicked?: boolean;
}

export interface Order {
  id: number;
  documentNo: string;
  orderDate?: string;
  partnerId?: number;
  partnerName?: string;
  status?: string;
  totalAmount?: number;
  warehouseId?: number;
  lines?: OrderLine[];
  note?: string;
  rfqNo?: string;
  productCount?: number;
}

export interface OrderSupplier {
  orderId: number;
  partnerId: number;
  partnerName: string;
}

export async function getOrders(search?: string): Promise<Order[]> {
  const api = await getApi();
  // Not: summary-list endpoint'i filtre parametreleri alıyorsa geçilebilir
  const response = await api.get('/terminal/Orders/List');
  
  let orderData: any[] = [];
  if (response.data) {
    if (Array.isArray(response.data.order)) {
      orderData = response.data.order;
    } else if (Array.isArray(response.data.data)) {
      orderData = response.data.data;
    } else if (Array.isArray(response.data)) {
      orderData = response.data;
    }
  }

  // Arama filtresini client side'da da uygulayalım (eğer api filtrelemiyorsa destek olmak amacıyla)
  let mappedOrders = orderData.map((item: any) => ({
    id: item.orderId || item.OrderId || item.id,
    documentNo: item.orderNo || item.OrderNo || item.customerRefNo || item.documentNo || item.DocumentNo || `OFR-${item.orderId || item.OrderId || item.id}`,
    orderDate: item.transactionDate || item.transactiondate || item.orderDate || item.OrderDate || '',
    partnerId: item.partnerId || item.PartnerId || item.companyId || item.CompanyId,
    partnerName: item.partnerName || item.PartnerName || item.partnername || item.customerName || item.CustomerName || item.customername || 'Cari Yok',
    status: item.orderStatus || item.OrderStatus || item.status || item.Status || 'Devam Ediyor',
    totalAmount: item.ttlAmount || item.TtlAmount || item.netAmount || item.NetAmount || 0,
    warehouseId: item.outputWarehouseId || item.OutputWarehouseId || item.warehouseId || item.WarehouseId,
    note: item.note || item.Note,
    rfqNo: item.rfqNo || item.RfqNo,
    productCount: item.productCount || item.ProductCount || 0,
    lines: item.details || item.Details || item.lines || item.Lines || []
  }));

  if (search) {
    const searchLower = search.toLowerCase();
    mappedOrders = mappedOrders.filter(
      (o) =>
        (o.documentNo && o.documentNo.toLowerCase().includes(searchLower)) ||
        (o.partnerName && o.partnerName.toLowerCase().includes(searchLower)) ||
        (o.rfqNo && o.rfqNo.toLowerCase().includes(searchLower)) ||
        (o.note && o.note.toLowerCase().includes(searchLower))
    );
  }

  return mappedOrders;
}

export async function getOrderDetail(id: number | string): Promise<Order> {
  const api = await getApi();
  const response = await api.get(`/terminal/Orders/Details?id=${id}`);
  
  const rawLines = Array.isArray(response.data) ? response.data : [];
  const partnerName = rawLines.length > 0 ? (rawLines[0].partnerName || rawLines[0].partnername || 'Cari Yok') : 'Cari Yok';

  return {
    id: Number(id),
    documentNo: `OFR-${id}`,
    orderDate: '',
    partnerId: 0,
    partnerName: partnerName,
    status: 'Sipariş Detayı',
    totalAmount: 0,
    lines: rawLines.map((item: any, index: number) => {
      const trimmedCode = item.productCode || item.ProductCode || item.productcode ? String(item.productCode || item.ProductCode || item.productcode).trim() : '';
      const stockId = item.productId || item.ProductId || item.stockId || item.StockId || parseInt(trimmedCode, 10) || index;
      return {
        id: item.id || item.Id || index,
        orderId: Number(id),
        stockId: stockId,
        stockCode: trimmedCode || `CODE-${index}`,
        stockName: item.productName || item.ProductName || item.productname || 'Ürün Adı Yok',
        quantity: item.qty || item.Qty || item.quantity || item.Quantity || 0,
        pickedQty: 0,
        unit: item.unit || item.Unit || undefined,
        unitPrice: item.price || item.Price || item.unitPrice || item.UnitPrice || 0,
        isPicked: false
      };
    })
  };
}

export async function getOrderSuppliers(orderId: number): Promise<OrderSupplier[]> {
  const api = await getApi();
  const response = await api.get(`/terminal/Orders/${orderId}/Suppliers`);
  
  let data: any[] = [];
  if (response.data) {
    if (Array.isArray(response.data)) {
      data = response.data;
    } else if (Array.isArray(response.data.data)) {
      data = response.data.data;
    }
  }

  return data.map((item: any) => ({
    orderId: item.orderId || item.OrderId || orderId,
    partnerId: item.partnerId || item.PartnerId,
    partnerName: item.partnerName || item.PartnerName || item.partnername || 'Tedarikçi Cari Adı Yok'
  }));
}

export async function getSupplierOrderDetail(orderId: number, supplierId: number): Promise<Order> {
  const api = await getApi();
  const response = await api.get(`/terminal/Orders/${orderId}/Supplier/${supplierId}/Details`);
  
  const rawLines = Array.isArray(response.data) ? response.data : 
                   (response.data && Array.isArray(response.data.data) ? response.data.data : []);

  return {
    id: orderId,
    documentNo: `OFR-${orderId}`,
    orderDate: '',
    partnerId: supplierId,
    partnerName: rawLines.length > 0 ? (rawLines[0].partnerName || rawLines[0].PartnerName || rawLines[0].partnername || 'Tedarikçi') : 'Tedarikçi',
    status: 'Sipariş Detayı',
    totalAmount: rawLines.reduce((sum: number, item: any) => sum + (item.ttlAmount || item.TtlAmount || (item.price || item.Price || 0) * (item.qty || item.Qty || 0) || 0), 0),
    lines: rawLines.map((item: any, index: number) => {
      const trimmedCode = item.productCode || item.ProductCode || item.productcode ? String(item.productCode || item.ProductCode || item.productcode).trim() : '';
      const stockId = item.productId || item.ProductId || item.stockId || item.StockId || parseInt(trimmedCode, 10) || index;
      return {
        id: item.id || item.Id || index,
        orderId: orderId,
        stockId: stockId,
        stockCode: trimmedCode || `CODE-${index}`,
        stockName: item.productName || item.ProductName || item.productname || 'Ürün Adı Yok',
        quantity: item.qty || item.Qty || item.quantity || item.Quantity || 0,
        pickedQty: 0,
        unit: item.unit || item.Unit || undefined,
        unitPrice: item.price || item.Price || item.unitPrice || item.UnitPrice || 0,
        isPicked: false
      };
    })
  };
}

export interface TerminalOrderReceiptLineDto {
  orderDetailId: number;
  receivedQty: number;
}

export interface TerminalOrderReceiptDto {
  orderId: number;
  supplierId: number;
  warehouseId: number;
  documentNo?: string;
  remarks?: string;
  lines: TerminalOrderReceiptLineDto[];
}

/** Sipariş toplama/kabul makbuzunu sunucuya kaydeder */
export async function saveOrderSupplierReceipt(payload: TerminalOrderReceiptDto): Promise<any> {
  const api = await getApi();
  const response = await api.post('/terminal/save-order-supplier-receipt', payload);
  
  if (response.data && response.data.success === false) {
    const err: any = new Error(response.data.message || 'Sipariş kabulü kaydedilemedi.');
    err.response = response;
    throw err;
  }
  return response.data;
}

