import { getApi } from './api';

/**
 * Sipariş API Servisleri
 * Endpoint'ler sonra Swagger'dan güncellenecek
 */

export interface Order {
  id: string | number;
  orderNo: string;
  companyName: string;
  status: 'Pending' | 'Confirmed' | 'Received' | 'Cancelled';
  itemCount: number;
  buyerName?: string;
  date: string;
}

export interface OrderDetail {
  id: string | number;
  orderNo: string;
  companyName: string;
  status: string;
  totalItems: number;
  totalQuantity: number;
  suppliers: string[];
  items: OrderItem[];
}

export interface OrderItem {
  id: string | number;
  productName: string;
  requiredQuantity: number;
  receivedQuantity: number;
  status: 'Pending' | 'Received';
  supplier?: string;
}

/** Siparişleri listele */
export async function getOrders(search?: string): Promise<Order[]> {
  const api = await getApi();
  const params = search ? { search } : {};
  const response = await api.get<Order[]>('/orders', { params });
  return response.data;
}

/** Sipariş detayını getir */
export async function getOrderDetail(orderId: string | number): Promise<OrderDetail> {
  const api = await getApi();
  const response = await api.get<OrderDetail>(`/orders/${orderId}`);
  return response.data;
}

/** Sipariş kalemini teslim al */
export async function receiveOrderItem(orderId: string | number, itemId: string | number, quantity?: number): Promise<void> {
  const api = await getApi();
  await api.post(`/orders/${orderId}/items/${itemId}/receive`, { quantity });
}

/** Sipariş kalemini sil */
export async function deleteOrderItem(orderId: string | number, itemId: string | number): Promise<void> {
  const api = await getApi();
  await api.delete(`/orders/${orderId}/items/${itemId}`);
}
