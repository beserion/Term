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
  stockNameTr?: string;
  brand?: string;
  model?: string;
  impaCode?: string;
  quantity: number;
  pickedQty?: number; // Terminalde toplanan/kabul edilen miktar
  orderedQty?: number;
  receivedQty?: number;
  unitPrice?: number;
  unit?: string;
  isPicked?: boolean;
  shelfAddress?: string;
  barcode?: string;
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
  vesselName?: string;
  productCount?: number;
  totalOrderedQty?: number;
  totalReceivedQty?: number;
  isReceiptCompleted?: boolean;
  isPackingCompleted?: boolean;
}

export interface OrderSupplier {
  orderId: number;
  partnerId: number;
  partnerName: string;
  productCount?: number;
  totalOrderedQty?: number;
  totalReceivedQty?: number;
  totalQty?: number;
  isReceiptCompleted?: boolean;
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

  return data.map((item: any) => {
    const pCount = item.productCount ?? item.ProductCount ?? 0;
    const tOrdered = Number(item.totalOrderedQty ?? item.TotalOrderedQty ?? item.totalQty ?? 0);
    const tReceived = Number(item.totalReceivedQty ?? item.TotalReceivedQty ?? 0);
    const isCompleted = item.isReceiptCompleted ?? item.IsReceiptCompleted ?? (tOrdered > 0 && tReceived >= tOrdered);

    return {
      orderId: item.orderId || item.OrderId || orderId,
      partnerId: item.partnerId || item.PartnerId,
      partnerName: item.partnerName || item.PartnerName || item.partnername || 'Tedarikçi Cari Adı Yok',
      productCount: pCount,
      totalOrderedQty: tOrdered,
      totalReceivedQty: tReceived,
      totalQty: tOrdered,
      isReceiptCompleted: !!isCompleted,
    };
  });
}

export async function getOrders(search?: string): Promise<Order[]> {
  const api = await getApi();
  const searchParam = search ? `?search=${encodeURIComponent(search)}&page=1&pageSize=50` : '?page=1&pageSize=50';
  
  try {
    const resOrdersList = await api.get(`/terminal/Orders/List${searchParam}`);
    let ordersListData: any[] = [];
    if (resOrdersList.data) {
      if (Array.isArray(resOrdersList.data)) ordersListData = resOrdersList.data;
      else if (Array.isArray(resOrdersList.data.data)) ordersListData = resOrdersList.data.data;
    }

    if (ordersListData.length > 0) {
      return ordersListData.map((item: any) => {
        const id = item.orderId || item.OrderId || item.id;
        const totalOrdered = Number(item.totalOrderedQty ?? item.TotalOrderedQty ?? 0);
        const totalReceived = Number(item.totalReceivedQty ?? item.TotalReceivedQty ?? 0);
        const isReceiptCompleted = item.isReceiptCompleted ?? item.IsReceiptCompleted ?? (totalOrdered > 0 && totalReceived >= totalOrdered);
        const isPackingCompleted = item.isPackingCompleted ?? item.IsPackingCompleted ?? false;

        return {
          id: Number(id),
          documentNo: item.orderNo || `ORD-${id}`,
          orderDate: item.transactionDate || '',
          partnerId: item.partnerId || 0,
          partnerName: item.partnerName || 'Cari Yok',
          status: item.orderStatus || 'Devam Ediyor',
          totalAmount: Number(item.ttlAmount || 0),
          warehouseId: item.outputWarehouseId,
          note: item.note,
          rfqNo: item.rfqNo ? String(item.rfqNo) : undefined,
          vesselName: item.vesselName ? String(item.vesselName) : undefined,
          productCount: Number(item.productCount || 0),
          totalOrderedQty: totalOrdered,
          totalReceivedQty: totalReceived,
          isReceiptCompleted: !!isReceiptCompleted,
          isPackingCompleted: !!isPackingCompleted,
          lines: item.details || []
        };
      });
    }
  } catch (err) {
    console.warn('/terminal/Orders/List error, falling back to Orderlist:', err);
  }

  // Fallback: /terminal/Orderlist
  const resOrderlist = await api.get('/terminal/Orderlist?startRow=0&endRow=100').catch(() => ({ data: null }));
  let orderlistData: any[] = [];
  if (resOrderlist.data) {
    if (Array.isArray(resOrderlist.data.order)) orderlistData = resOrderlist.data.order;
    else if (Array.isArray(resOrderlist.data.data)) orderlistData = resOrderlist.data.data;
    else if (Array.isArray(resOrderlist.data)) orderlistData = resOrderlist.data;
  }

  let mappedOrders = orderlistData.map((item: any) => {
    const id = item.orderId || item.OrderId || item.id;
    return {
      id: Number(id),
      documentNo: item.orderNo || item.customerRefNo || `ORD-${id}`,
      orderDate: item.transactionDate || item.orderDate || '',
      partnerId: item.partnerId || 0,
      partnerName: item.partnerName || 'Cari Yok',
      status: item.orderStatus || 'Devam Ediyor',
      totalAmount: item.ttlAmount || 0,
      warehouseId: item.outputWarehouseId,
      note: item.note,
      rfqNo: item.rfqNo ? String(item.rfqNo) : undefined,
      vesselName: item.vesselName ? String(item.vesselName) : undefined,
      productCount: Number(item.productCount || 0),
      lines: item.details || []
    };
  });

  if (search) {
    const searchLower = search.toLowerCase();
    mappedOrders = mappedOrders.filter(
      (o) =>
        (o.documentNo && o.documentNo.toLowerCase().includes(searchLower)) ||
        (o.partnerName && o.partnerName.toLowerCase().includes(searchLower)) ||
        (o.rfqNo && o.rfqNo.toLowerCase().includes(searchLower)) ||
        (o.vesselName && o.vesselName.toLowerCase().includes(searchLower))
    );
  }

  return mappedOrders;
}

export async function getOrderDetail(id: number | string): Promise<Order> {
  const api = await getApi();
  const response = await api.get(`/terminal/Orders/Details?id=${id}`);
  
  const rawLines = Array.isArray(response.data) ? response.data : (response.data?.data || []);
  const partnerName = rawLines.length > 0 ? (rawLines[0].partnerName || rawLines[0].partnername || 'Cari Yok') : 'Cari Yok';

  const lines: OrderLine[] = rawLines.map((item: any, index: number) => {
    const trimmedCode = String(item.stockCode || item.productCode || item.ProductCode || '').trim();
    const stockId = item.stockId || item.productId || item.ProductId || 0;
    const shelf = (item.shelfAddress && item.shelfAddress !== 'Tanımsız') ? String(item.shelfAddress).trim() : 'Tanımsız';
    const ordQty = Number(item.orderedQty ?? item.qty ?? item.quantity ?? 0);
    const recQty = Number(item.receivedQty ?? 0);

    return {
      id: item.id || item.orderDetailId || index,
      orderId: Number(id),
      stockId: Number(stockId),
      stockCode: trimmedCode || `CODE-${index}`,
      impaCode: item.impaCode || item.IMPACode || undefined,
      stockName: item.stockName || item.productName || 'Ürün Adı Yok',
      stockNameTr: item.stockNameTr || undefined,
      brand: item.brand || undefined,
      model: item.model || undefined,
      quantity: ordQty,
      orderedQty: ordQty,
      receivedQty: recQty,
      pickedQty: 0,
      unit: item.unit || 'PCS',
      unitPrice: Number(item.unitPrice || item.price || 0),
      isPicked: recQty >= ordQty && ordQty > 0,
      shelfAddress: shelf,
      barcode: item.barcode || undefined,
    };
  });

  return {
    id: Number(id),
    documentNo: `ORD-${id}`,
    orderDate: '',
    partnerId: 0,
    partnerName: partnerName,
    status: 'Sipariş Detayı',
    totalAmount: lines.reduce((sum, l) => sum + (l.unitPrice || 0) * l.quantity, 0),
    lines,
  };
}

export async function getSupplierOrderDetail(orderId: number, supplierId: number): Promise<Order> {
  const api = await getApi();
  const response = await api.get(`/terminal/Orders/${orderId}/Supplier/${supplierId}/Details`);
  
  const rawLines = Array.isArray(response.data) ? response.data : 
                   (response.data && Array.isArray(response.data.data) ? response.data.data : []);

  const lines: OrderLine[] = rawLines.map((item: any, index: number) => {
    const trimmedCode = String(item.stockCode || item.productCode || item.ProductCode || '').trim();
    const stockId = item.stockId || item.productId || item.ProductId || 0;
    const shelf = (item.shelfAddress && item.shelfAddress !== 'Tanımsız') ? String(item.shelfAddress).trim() : 'Tanımsız';
    const ordQty = Number(item.orderedQty ?? item.qty ?? item.quantity ?? 0);
    const recQty = Number(item.receivedQty ?? 0);

    return {
      id: item.id || item.orderDetailId || index,
      orderId: orderId,
      stockId: Number(stockId),
      stockCode: trimmedCode || `CODE-${index}`,
      impaCode: item.impaCode || item.IMPACode || undefined,
      stockName: item.stockName || item.productName || 'Ürün Adı Yok',
      stockNameTr: item.stockNameTr || undefined,
      brand: item.brand || undefined,
      model: item.model || undefined,
      quantity: ordQty,
      orderedQty: ordQty,
      receivedQty: recQty,
      pickedQty: 0,
      unit: item.unit || 'PCS',
      unitPrice: Number(item.unitPrice || item.price || 0),
      isPicked: recQty >= ordQty && ordQty > 0,
      shelfAddress: shelf,
      barcode: item.barcode || undefined,
    };
  });

  return {
    id: orderId,
    documentNo: `ORD-${orderId}`,
    orderDate: '',
    partnerId: supplierId,
    partnerName: rawLines.length > 0 ? (rawLines[0].partnerName || rawLines[0].PartnerName || 'Tedarikçi') : 'Tedarikçi',
    status: 'Sipariş Detayı',
    totalAmount: lines.reduce((sum, l) => sum + (l.unitPrice || 0) * l.quantity, 0),
    lines,
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

