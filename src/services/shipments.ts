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
  // Delivery/list endpoint'i startRow, endRow ve kriter parametrelerini doğrudan desteklemediği için sadeleştirildi
  const response = await api.get('/Delivery/list');
  
  let deliveryData: any[] = [];
  if (response.data) {
    if (Array.isArray(response.data.data)) {
      deliveryData = response.data.data;
    } else if (Array.isArray(response.data)) {
      deliveryData = response.data;
    }
  }

  let mappedShipments: Shipment[] = deliveryData.map((item: any) => {
    // DeliveryType enumu -> tr metin karşılığı
    let typeStr = 'Sevkiyat';
    if (item.deliveryType === 1) typeStr = 'Alım';
    else if (item.deliveryType === 2) typeStr = 'Satış';
    else if (item.deliveryType === 3) typeStr = 'Transfer';
    else if (item.deliveryType === 4) typeStr = 'İade';

    // DeliveryStatus enumu -> StatusBadge uyumlu ingilizce durum
    let statusStr = 'Pending';
    if (item.status === 0) statusStr = 'Not Completed';
    else if (item.status === 1) statusStr = 'Pending';
    else if (item.status === 2) statusStr = 'Confirmed';
    else if (item.status === 3) statusStr = 'Received';
    else if (item.status === 9) statusStr = 'Cancelled';

    const invoiceStatusStr = item.invoiceId && item.invoiceId > 0 ? 'Invoice Cleared' : 'Awaiting Invoice';
    const lines = Array.isArray(item.lines) ? item.lines : [];

    return {
      id: item.id,
      title: item.deliveryNo || item.docNo || `SEV-${item.id}`,
      type: typeStr,
      assignedTo: item.partnerName || 'Cari Belirtilmemiş',
      date: item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString('tr-TR') : '',
      status: statusStr,
      invoiceStatus: invoiceStatusStr,
      itemCount: lines.length,
      linkedCount: lines.filter((l: any) => l.productId && l.productId > 0).length,
    };
  });

  if (search) {
    const searchLower = search.toLowerCase();
    mappedShipments = mappedShipments.filter(
      (s) =>
        (s.title && s.title.toLowerCase().includes(searchLower)) ||
        (s.assignedTo && s.assignedTo.toLowerCase().includes(searchLower)) ||
        (s.type && s.type.toLowerCase().includes(searchLower))
    );
  }

  return mappedShipments;
}

/** Sevkiyat detayını getir */
export async function getShipmentDetail(shipmentId: string | number): Promise<ShipmentDetail> {
  const api = await getApi();
  
  try {
    const response = await api.get(`/Delivery/details?id=${shipmentId}`);
    if (response.data) {
      const item = response.data.data || response.data;
      
      let typeStr = 'Sevkiyat';
      if (item.deliveryType === 1) typeStr = 'Alım';
      else if (item.deliveryType === 2) typeStr = 'Satış';
      else if (item.deliveryType === 3) typeStr = 'Transfer';
      else if (item.deliveryType === 4) typeStr = 'İade';

      let statusStr = 'Pending';
      if (item.status === 0) statusStr = 'Not Completed';
      else if (item.status === 1) statusStr = 'Pending';
      else if (item.status === 2) statusStr = 'Confirmed';
      else if (item.status === 3) statusStr = 'Received';
      else if (item.status === 9) statusStr = 'Cancelled';

      const invoiceStatusStr = item.invoiceId && item.invoiceId > 0 ? 'Invoice Cleared' : 'Awaiting Invoice';
      const lines = Array.isArray(item.lines) ? item.lines : [];

      return {
        id: item.id,
        title: item.deliveryNo || item.docNo || `SEV-${item.id}`,
        type: typeStr,
        assignedTo: item.partnerName || 'Cari Belirtilmemiş',
        date: item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString('tr-TR') : '',
        status: statusStr,
        invoiceStatus: invoiceStatusStr,
        items: lines.map((l: any, idx: number) => ({
          id: l.id || idx,
          productName: l.description || 'Ürün Açıklaması Yok',
          barcode: l.productCode || undefined,
          quantity: l.qty || 0,
          linked: !!(l.productId && l.productId > 0)
        }))
      };
    }
  } catch (error) {
    console.log('Details endpoint failed, falling back to finding in list', error);
  }

  // Fallback: Get all shipments from list API and map items from delivery lines
  const response = await api.get('/Delivery/list');
  let deliveryData: any[] = [];
  if (response.data) {
    if (Array.isArray(response.data.data)) {
      deliveryData = response.data.data;
    } else if (Array.isArray(response.data)) {
      deliveryData = response.data;
    }
  }

  const found = deliveryData.find((item: any) => String(item.id) === String(shipmentId));
  if (found) {
    let typeStr = 'Sevkiyat';
    if (found.deliveryType === 1) typeStr = 'Alım';
    else if (found.deliveryType === 2) typeStr = 'Satış';
    else if (found.deliveryType === 3) typeStr = 'Transfer';
    else if (found.deliveryType === 4) typeStr = 'İade';

    let statusStr = 'Pending';
    if (found.status === 0) statusStr = 'Not Completed';
    else if (found.status === 1) statusStr = 'Pending';
    else if (found.status === 2) statusStr = 'Confirmed';
    else if (found.status === 3) statusStr = 'Received';
    else if (found.status === 9) statusStr = 'Cancelled';

    const invoiceStatusStr = found.invoiceId && found.invoiceId > 0 ? 'Invoice Cleared' : 'Awaiting Invoice';
    const lines = Array.isArray(found.lines) ? found.lines : [];

    return {
      id: found.id,
      title: found.deliveryNo || found.docNo || `SEV-${found.id}`,
      type: typeStr,
      assignedTo: found.partnerName || 'Cari Belirtilmemiş',
      date: found.deliveryDate ? new Date(found.deliveryDate).toLocaleDateString('tr-TR') : '',
      status: statusStr,
      invoiceStatus: invoiceStatusStr,
      items: lines.map((l: any, idx: number) => ({
        id: l.id || idx,
        productName: l.description || 'Ürün Açıklaması Yok',
        barcode: l.productCode || undefined,
        quantity: l.qty || 0,
        linked: !!(l.productId && l.productId > 0)
      }))
    };
  }

  throw new Error('Sevkiyat bulunamadı');
}
