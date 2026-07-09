import { getApi } from './api';

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
  orderDate: string;
  partnerId: number;
  partnerName?: string;
  status: string;
  totalAmount: number;
  warehouseId?: number;
  lines?: OrderLine[];
}

export async function getOrderList(): Promise<Order[]> {
  const api = await getApi();
  const response = await api.get('/terminal/Orderlist?startRow=0&endRow=100');
  
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

  return orderData.map((item: any) => ({
    id: item.id,
    documentNo: item.customerRefNo || item.documentNo || `OFR-${item.id}`,
    orderDate: item.transactionDate || item.orderDate,
    partnerId: item.partnerId || item.companyId,
    partnerName: item.partnerName,
    status: item.orderStatus || item.status || 'Bilinmiyor',
    totalAmount: item.ttlAmount || item.netAmount || 0,
    warehouseId: item.outputWarehouseId || item.warehouseId,
    lines: item.details || item.lines || []
  }));
}

export async function getOrderDetails(id: number): Promise<Order> {
  const api = await getApi();
  const response = await api.get(`/terminal/Orders/Details?id=${id}`);
  
  const rawLines = Array.isArray(response.data) ? response.data : [];
  const partnerName = rawLines.length > 0 ? rawLines[0].partnername : 'Cari Yok';

  return {
    id: Number(id),
    documentNo: `OFR-${id}`,
    orderDate: '',
    partnerId: 0,
    partnerName: partnerName,
    status: 'Sipariş Detayı',
    totalAmount: 0,
    lines: rawLines.map((item: any, index: number) => {
      const trimmedCode = item.productcode ? String(item.productcode).trim() : '';
      const stockId = parseInt(trimmedCode, 10) || index;
      return {
        id: index,
        orderId: Number(id),
        stockId: stockId,
        stockCode: trimmedCode || `CODE-${index}`,
        stockName: item.productname || 'Ürün Adı Yok',
        quantity: item.qty || 0,
        pickedQty: 0,
        unit: item.unit || undefined,
        isPicked: false
      };
    })
  };
}

