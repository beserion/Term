import { getApi } from './api';

/**
 * Sevkiyat API Servisleri
 */

export interface Shipment {
  id: string | number;
  title: string;
  type: string;
  assignedTo: string;
  date: string;
  status: string;
  invoiceStatus: string;
  itemCount: number;
  linkedCount: number;
}

export interface ShipmentDetail {
  id: string | number;
  title: string;
  type: string;
  assignedTo: string;
  date: string;
  status: string;
  invoiceStatus: string;
  items: ShipmentItem[];
}

export interface ShipmentItem {
  id: string | number;
  productName: string;
  barcode?: string;
  quantity: number;
  linked: boolean;
}

/** Sevkiyatları listele */
export async function getShipments(search?: string): Promise<Shipment[]> {
  const api = await getApi();
  const params = search ? { search } : {};
  const response = await api.get<Shipment[]>('/shipments', { params });
  return response.data;
}

/** Sevkiyat detayını getir */
export async function getShipmentDetail(shipmentId: string | number): Promise<ShipmentDetail> {
  const api = await getApi();
  const response = await api.get<ShipmentDetail>(`/shipments/${shipmentId}`);
  return response.data;
}
