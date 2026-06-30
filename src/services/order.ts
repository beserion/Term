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
  const response = await api.get('/Order/list?startRow=0&endRow=100');
  
  if (response.data && response.data.data) {
    return response.data.data;
  }
  return response.data || [];
}

export async function getOrderDetails(id: number): Promise<Order> {
  const api = await getApi();
  const response = await api.get(`/Order/details?id=${id}`);
  
  if (response.data && response.data.data) {
    return response.data.data;
  }
  return response.data;
}
