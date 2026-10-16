import { getApi } from './api';
import { isPurchaseOrder, isProposalOrOffer, isRealSalesOrder, isWarehouseSupplier } from './packing';

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
  unitPrice?: number; // Satılan fiyat
  purchasePrice?: number; // Satılan ürün maliyeti
  currency?: string;
  unit?: string;
  isPicked?: boolean;
  shelfAddress?: string;
  barcode?: string;
  substitutionStatus?: 'Pending' | 'Approved' | 'Rejected' | null;
  substituteStockId?: number;
  substituteStockCode?: string;
  substituteStockName?: string;
  substituteBrand?: string; // Önerilen ürünün markası
  substitutePurchasePrice?: number; // Önerilen ürün maliyeti
  substituteSalePrice?: number;
  substituteCurrency?: string;
  substituteRequestedQty?: number;
  substituteNote?: string;
  reviewerNote?: string;
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
  supplierNames?: string[];
  poNumbers?: string[];
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
  
  // 1. Öncelikli olarak /terminal/Packing/Orders/{orderId}/Suppliers endpoint'ini dene (asıl tedarikçileri döner)
  try {
    const pRes = await api.get(`/terminal/Packing/Orders/${orderId}/Suppliers`);
    let pData: any[] = [];
    if (Array.isArray(pRes.data)) pData = pRes.data;
    else if (Array.isArray(pRes.data?.data)) pData = pRes.data.data;

    if (pData.length > 0) {
      return pData
        .filter((item: any) => !isWarehouseSupplier(item.supplierName || item.partnerName || item.PartnerName))
        .map((item: any) => {
          const pCount = item.productCount ?? item.ProductCount ?? 0;
          const tOrdered = Number(item.totalOrderedQty ?? item.TotalOrderedQty ?? item.totalQty ?? 0);
          const tReceived = Number(item.totalReceivedQty ?? item.TotalReceivedQty ?? item.receivedQty ?? 0);
          const isCompleted = item.isReceiptCompleted ?? item.IsReceiptCompleted ?? (tOrdered > 0 && tReceived >= tOrdered);

          return {
            orderId: item.orderId || item.OrderId || orderId,
            partnerId: item.supplierId || item.partnerId || item.PartnerId,
            partnerName: item.supplierName || item.partnerName || item.PartnerName || 'Tedarikçi Cari Adı Yok',
            productCount: pCount,
            totalOrderedQty: tOrdered,
            totalReceivedQty: tReceived,
            totalQty: tOrdered,
            isReceiptCompleted: !!isCompleted,
          };
        });
    }
  } catch {
    // Fallback'e devam et
  }

  // 2. Fallback: /terminal/Orders/{orderId}/Suppliers
  const response = await api.get(`/terminal/Orders/${orderId}/Suppliers`).catch(() => ({ data: [] }));
  let data: any[] = [];
  if (response.data) {
    if (Array.isArray(response.data)) {
      data = response.data;
    } else if (Array.isArray(response.data.data)) {
      data = response.data.data;
    }
  }

  return data
    .filter((item: any) => !isWarehouseSupplier(item.partnerName || item.PartnerName || item.partnername))
    .map((item: any) => {
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
  const searchParam = search ? `?search=${encodeURIComponent(search)}&page=1&pageSize=1000` : '?page=1&pageSize=1000';
  
  try {
    const resOrdersList = await api.get(`/terminal/Orders/List${searchParam}`);
    let ordersListData: any[] = [];
    if (resOrdersList.data) {
      if (Array.isArray(resOrdersList.data)) ordersListData = resOrdersList.data;
      else if (Array.isArray(resOrdersList.data.data)) ordersListData = resOrdersList.data.data;
    }

    if (ordersListData.length > 0) {
      // 1. PO satınalma siparişlerini RFQ bazında topla (Alt tedarikçiler - Gemini hariç)
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

      // 2. Mal Kabule SADECE gerçek satış siparişleri (ORD-...) düşsün.
      // Talep ve teklifler (RFQ, OFR, PO vb.) kesinlikle elenir.
      const salesOrders = ordersListData.filter((ord: any) => isRealSalesOrder(ord.orderNo, ord.orderStatus || ord.status));

      let mappedOrders: Order[] = salesOrders.map((item: any) => {
        const id = item.orderId || item.OrderId || item.id;
        const totalOrdered = Number(item.totalOrderedQty ?? item.TotalOrderedQty ?? 0);
        const totalReceived = Number(item.totalReceivedQty ?? item.TotalReceivedQty ?? 0);
        const isReceiptCompleted = item.isReceiptCompleted ?? item.IsReceiptCompleted ?? (totalOrdered > 0 && totalReceived >= totalOrdered);
        const isPackingCompleted = item.isPackingCompleted ?? item.IsPackingCompleted ?? false;

        const rfqKey = item.rfqNo ? String(item.rfqNo).trim().toLowerCase() : '';
        const poInfo = rfqKey ? poInfoByRfq.get(rfqKey) : null;

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
          lines: item.details || [],
          supplierNames: poInfo?.supplierNames || [],
          poNumbers: poInfo?.poNumbers || [],
        };
      });

      if (search) {
        const q = search.toLowerCase().trim();
        mappedOrders = mappedOrders.filter(
          (o) =>
            (o.documentNo && o.documentNo.toLowerCase().includes(q)) ||
            (o.partnerName && o.partnerName.toLowerCase().includes(q)) ||
            (o.rfqNo && o.rfqNo.toLowerCase().includes(q)) ||
            (o.vesselName && o.vesselName.toLowerCase().includes(q)) ||
            (o.supplierNames && o.supplierNames.some((s) => s.toLowerCase().includes(q))) ||
            (o.poNumbers && o.poNumbers.some((p) => p.toLowerCase().includes(q)))
        );
      }

      return mappedOrders;
    }
  } catch (err) {
    console.warn('/terminal/Orders/List error, falling back to Orderlist:', err);
  }

  // Fallback: /terminal/Orderlist
  const resOrderlist = await api.get('/terminal/Orderlist?startRow=0&endRow=500').catch(() => ({ data: null }));
  let orderlistData: any[] = [];
  if (resOrderlist.data) {
    if (Array.isArray(resOrderlist.data.order)) orderlistData = resOrderlist.data.order;
    else if (Array.isArray(resOrderlist.data.data)) orderlistData = resOrderlist.data.data;
    else if (Array.isArray(resOrderlist.data)) orderlistData = resOrderlist.data;
  }

  // SADECE onaylanmış ve gerçek siparişleri al; talep ve teklifleri kesin olarak ele
  const validOrderlist = orderlistData.filter((item: any) =>
    isRealSalesOrder(item.orderNo, item.orderStatus)
  );

  let mappedOrders = validOrderlist.map((item: any) => {
    const id = item.orderId || item.OrderId || item.id;
    return {
      id: Number(id),
      documentNo: item.orderNo || `ORD-${id}`,
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
      purchasePrice: Number(item.purchasePrice || item.prchPrice || 0),
      currency: item.currency || 'EUR',
      isPicked: recQty >= ordQty && ordQty > 0,
      shelfAddress: shelf,
      barcode: item.barcode || undefined,
      substitutionStatus: item.substitutionStatus || undefined,
      substituteStockId: item.substituteStockId ? Number(item.substituteStockId) : undefined,
      substituteStockCode: item.substituteStockCode || undefined,
      substituteStockName: item.substituteStockName || undefined,
      substituteRequestedQty: item.substituteRequestedQty ? Number(item.substituteRequestedQty) : undefined,
      substituteNote: item.substituteNote || undefined,
      reviewerNote: item.reviewerNote || undefined,
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
      purchasePrice: Number(item.purchasePrice || item.prchPrice || 0),
      currency: item.currency || 'EUR',
      isPicked: recQty >= ordQty && ordQty > 0,
      shelfAddress: shelf,
      barcode: item.barcode || undefined,
      substitutionStatus: item.substitutionStatus || undefined,
      substituteStockId: item.substituteStockId ? Number(item.substituteStockId) : undefined,
      substituteStockCode: item.substituteStockCode || undefined,
      substituteStockName: item.substituteStockName || undefined,
      substituteBrand: item.substituteBrand || undefined,
      substitutePurchasePrice: item.substitutePurchasePrice ? Number(item.substitutePurchasePrice) : (item.substitutePrchPrice ? Number(item.substitutePrchPrice) : undefined),
      substituteSalePrice: item.substituteSalePrice ? Number(item.substituteSalePrice) : undefined,
      substituteCurrency: item.substituteCurrency || undefined,
      substituteRequestedQty: item.substituteRequestedQty ? Number(item.substituteRequestedQty) : undefined,
      substituteNote: item.substituteNote || undefined,
      reviewerNote: item.reviewerNote || undefined,
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

