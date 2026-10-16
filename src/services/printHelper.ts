import TcpSocket from 'react-native-tcp-socket';
import { printLabel, getPrinters } from './inventory';
import { useSettingsStore } from '../store/settingsStore';

export function toAscii(text: string): string {
  if (!text) return '';
  return text
    .replace(/Ğ/g, 'G')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 'S')
    .replace(/ş/g, 's')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/Ö/g, 'O')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'C')
    .replace(/ç/g, 'c')
    .replace(/[^\x00-\x7F]/g, '');
}

/**
 * İstemci tarafı Zebra CPCL etiket verisi oluşturucu (Fallback)
 */
export function generateFallbackCpcl(barcode: string, title: string = 'BLUEHUB WMS', qty: number = 1): string {
  let cpcl = '';
  const cleanTitle = toAscii(title || 'BLUEHUB WMS');
  const cleanBarcode = toAscii(barcode || '000000');

  for (let i = 0; i < qty; i++) {
    cpcl += `! 0 200 200 400 1\r\n`;
    cpcl += `PAGE-WIDTH 400\r\n`;
    cpcl += `TEXT 4 0 30 20 ${cleanTitle}\r\n`;
    cpcl += `BARCODE 128 1 1 60 30 70 ${cleanBarcode}\r\n`;
    cpcl += `TEXT 7 0 30 140 ${cleanBarcode}\r\n`;
    cpcl += `PRINT\r\n`;
  }
  return cpcl;
}

/**
 * TCP Soket üzerinden yazıcıya veri gönderme (Dahili yardımcı fonksiyon)
 */
function sendCpclViaTcp(ip: string, port: number, cpclData: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let isFinished = false;
    let client: any;

    const cleanupAndReject = (error: Error) => {
      if (isFinished) return;
      isFinished = true;
      try {
        if (client) client.destroy();
      } catch (e) {}
      reject(error);
    };

    const cleanupAndResolve = () => {
      if (isFinished) return;
      isFinished = true;
      try {
        if (client) client.destroy();
      } catch (e) {}
      resolve();
    };

    try {
      console.log(`[TCP YAZICI] TCP bağlantısı kuruluyor: ${ip}:${port}`);
      
      client = TcpSocket.createConnection({
        host: ip,
        port: port,
      }, () => {
        console.log('[TCP YAZICI] Bağlandı, veri gönderiliyor...');
        
        client.write(cpclData, 'utf-8', (err: any) => {
          if (err) {
            console.error('[TCP YAZICI] Veri yazma hatası:', err);
            cleanupAndReject(new Error(`Yazıcıya veri yazılırken hata oluştu (${ip}:${port}): ${err?.message || err}`));
          } else {
            console.log('[TCP YAZICI] Veri başarıyla gönderildi.');
            setTimeout(() => {
              cleanupAndResolve();
            }, 200);
          }
        });
      });

      client.on('error', (err: any) => {
        console.error('[TCP YAZICI] Soket hatası:', err);
        cleanupAndReject(new Error(`Yazıcı bağlantı hatası (${ip}:${port}): ${err?.message || err}`));
      });

      client.setTimeout(6000, () => {
        console.error('[TCP YAZICI] Zaman aşımı (Timeout).');
        cleanupAndReject(new Error(`Yazıcıya (${ip}:${port}) ulaşılamadı (Zaman Aşımı). Wi-Fi ve IP adresini kontrol edin.`));
      });
    } catch (err: any) {
      cleanupAndReject(err);
    }
  });
}

/**
 * HTTP POST /pstprnt üzerinden yazıcıya veri gönderme (Dahili yardımcı fonksiyon - Fallback)
 */
async function sendCpclViaHttp(ip: string, cpclData: string): Promise<void> {
  console.log(`[HTTP YAZICI] HTTP POST /pstprnt üzerinden veri gönderiliyor: http://${ip}/pstprnt`);
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`http://${ip}/pstprnt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: cpclData,
      signal: controller.signal
    });

    clearTimeout(id);

    if (!response.ok) {
      throw new Error(`HTTP Durum Kodu: ${response.status}`);
    }
    console.log('[HTTP YAZICI] Veri HTTP üzerinden başarıyla gönderildi.');
  } catch (err: any) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Etiket verisini yazıcıya gönderir.
 * IP ve Port doğrulaması ve hatalı IP durumunda bilgilendirici hata mesajı sağlar.
 */
export async function sendCpclToPrinter(ip: string, port: number, cpclData: string): Promise<void> {
  if (!ip || ip.trim() === '' || ip === 'undefined' || ip === 'null') {
    throw new Error('Geçerli bir yazıcı IP adresi belirtilmedi. Lütfen aktif yazıcı seçimini ve IP ayarlarını kontrol edin.');
  }

  const validPort = port && !isNaN(port) && port > 0 ? port : 6101;
  const targetIp = ip.trim();

  try {
    // 1. Önce TCP üzerinden göndermeyi dene
    await sendCpclViaTcp(targetIp, validPort, cpclData);
  } catch (err: any) {
    // Expo Go veya native modül eksikliğinde LogBox uyarısı çıkmaması için console.log ile kaydedip HTTP fallback çalıştırıyoruz.
    console.log(`[YAZICI] TCP gönderimi deneniyor/başarısız: ${err?.message}`);
    
    const isNativeModuleError = err.message?.includes('null') || err.message?.includes('connect') || err.message?.includes('undefined');
    if (isNativeModuleError) {
      console.log("[YAZICI] Expo Go / Native modül eksikliği tespit edildi. HTTP Fallback başlatılıyor...");
      try {
        await sendCpclViaHttp(targetIp, cpclData);
      } catch (httpErr: any) {
        throw new Error(`Yazıcı bağlantı hatası (${targetIp}:${validPort}). HTTP Fallback de başarısız oldu: ${httpErr?.message || httpErr}`);
      }
    } else {
      throw err;
    }
  }
}

export interface PrintJobOptions {
  printerId?: number | null;
  printerIp?: string | null;
  printerPort?: number | null;
  barcode: string;
  title?: string;
  quantity?: number;
}

/**
 * Esnek Etiket Yazdırma Akışı:
 * 1. Sunucudan CPCL ve IP/Port bilgisi almaya dener.
 * 2. Sunucu hata verirse (örn: ürün bulunamadı), istemci tarafı fallback CPCL üreterek yerel IP'ye gönderir.
 */
export async function executePrintJob(options: PrintJobOptions): Promise<void> {
  const { printerId, printerIp, printerPort, barcode, title, quantity = 1 } = options;

  let cpclDataToSend = '';
  let ipToSend = printerIp || '';
  let portToSend = printerPort || 6101;

  // 1. Sunucudan Etiket CPCL Verisini Çekmeyi Dene
  if (printerId) {
    try {
      const result = await printLabel({
        printerId,
        barcode,
        qrCode: barcode,
        quantity,
      });

      if (result && result.cpclData) {
        cpclDataToSend = result.cpclData;
      }
      if (result && result.printerIp) {
        ipToSend = result.printerIp;
      }
      if (result && result.printerPort) {
        portToSend = result.printerPort;
      }
    } catch (apiErr: any) {
      console.warn(`[PRINT JOB] Sunucu CPCL etiketi üretemedi (${apiErr?.message}). Yerel Fallback CPCL üretiliyor...`);
    }
  }

  // 2. Eğer sunucudan CPCL gelmediyse, yerel istemci CPCL şablonu üret
  if (!cpclDataToSend) {
    cpclDataToSend = generateFallbackCpcl(barcode, title || 'BLUEHUB WMS', quantity);
  }

  // 3. Eğer hâlâ geçerli bir IP yoksa hata fırlat
  if (!ipToSend) {
    throw new Error('Yazıcı IP adresi bulunamadı. Lütfen Ayarlar veya Cihaz Yapılandırmasından aktif yazıcıyı seçin veya IP adresini girin.');
  }

  // 4. Yazıcıya Soket/TCP ile Gönder
  await sendCpclToPrinter(ipToSend, portToSend, cpclDataToSend);
}

export interface PrintBoxItem {
  code?: string;
  impaCode?: string;
  stockCode?: string;
  stockName?: string;
  qty: number;
  unit?: string;
}

export interface PrintBoxLabelOptions {
  boxName: string;
  boxBarcode?: string;
  orderNo?: string;
  rfqNo?: string;
  vesselName?: string;
  supplierName?: string;
  itemCount?: number;
  totalQty?: number;
  items?: PrintBoxItem[];
  printerIp?: string | null;
  printerPort?: number | null;
  qrUrl?: string;
}

/**
 * Kompakt Koli / Palet QR Etiketi CPCL verisi oluşturucu (Zebra ZQ521 CPCL formatında)
 * - Üst Bilgi: Sol tarafta 3 satır (Koli Adı, Gemi Adı, RFQ No) ve sağ tarafında QR Code
 * - Alt Bilgi: Sadece Box No (Ürün detay tablosu ve 1D barkod çizgileri kaldırıldı)
 */
export function generateBoxCpcl(options: PrintBoxLabelOptions): string {
  const { boxName, boxBarcode, orderNo, rfqNo, vesselName, qrUrl } = options;
  const cleanBoxName = toAscii(boxName || 'Koli');
  const cleanBarcode = toAscii(boxBarcode || boxName || 'BOX-001');
  const cleanOrder = toAscii(orderNo || '');
  const cleanRfq = toAscii(rfqNo || '');
  const cleanVessel = toAscii(vesselName || '');

  // Kompakt etiket yüksekliği (Ürün tablosu ve 1D barkod kaldırıldı):
  const calculatedHeight = 220;

  let cpcl = '';
  cpcl += `! 0 200 200 ${calculatedHeight} 1\r\n`;
  cpcl += `PAGE-WIDTH 550\r\n`;

  // 1. ÜST BÖLÜM:
  // Sol tarafta 3 satır:
  //   1. Koli Adı (Font 4, büyük)
  //   2. Gemi Adı (Font 7)
  //   3. RFQ No (Font 7)
  // Sağ tarafta bu 3 satırın karşısında: QR Code
  let y = 16;
  const cleanBoxTitle = cleanBoxName.toUpperCase().substring(0, 20);
  cpcl += `TEXT 4 0 30 ${y} ${cleanBoxTitle}\r\n`;
  y += 34;

  const cleanVesselStr = cleanVessel ? cleanVessel.trim() : '';
  const vesselDisplay = cleanVesselStr
    ? (cleanVesselStr.toLowerCase().startsWith('gemi') ? cleanVesselStr : `Gemi: ${cleanVesselStr}`)
    : 'Gemi: -';
  cpcl += `TEXT 7 0 30 ${y} ${vesselDisplay.substring(0, 24)}\r\n`;
  y += 26;

  const rfqOrOrder = cleanRfq || cleanOrder || '';
  const rfqPrefix = cleanRfq ? 'RFQ No' : 'Sip No';
  const rfqDisplay = rfqOrOrder ? `${rfqPrefix}: ${rfqOrOrder}` : 'RFQ No: -';
  cpcl += `TEXT 7 0 30 ${y} ${rfqDisplay.substring(0, 26)}\r\n`;

  // Sağ tarafta bu 3 satırın karşısına QR Kod (Müşteri okuttuğunda koli çeki listesini açar)
  const qrPayload = qrUrl || (cleanBarcode.startsWith('http') ? cleanBarcode : `https://gemini.bluehub.tr/PublicPacking/Box?code=${cleanBarcode}`);
  cpcl += `B QR 370 12 M 2 U 3\r\n`;
  cpcl += `MA,${qrPayload}\r\n`;
  cpcl += `ENDQR\r\n`;

  // Başlık Ayraç Çizgisi (Kalın) - QR kod ve 3 satırın hemen altı
  y = 140;
  cpcl += `LINE 30 ${y} 520 ${y} 2\r\n`;
  y += 18;

  // 2. ALT BÖLÜM: Ürün detay tablosu ve 1D barkod çizgileri kaldırıldı, sadece Box No yazılıyor
  const isPallet = cleanBoxTitle.includes('PALET') || cleanBarcode.toUpperCase().startsWith('PLT');
  const boxLabel = isPallet ? 'Palet No' : 'Box No';
  cpcl += `TEXT 4 0 30 ${y} ${boxLabel}: ${cleanBarcode}\r\n`;

  cpcl += `PRINT\r\n`;

  return cpcl;
}

/**
 * Koli etiketini aktif Zebra yazıcıya gönderir
 */
export async function printBoxLabel(options: PrintBoxLabelOptions): Promise<void> {
  const { activePrinterIp, activePrinterPort } = useSettingsStore.getState();
  let ipToSend = options.printerIp || activePrinterIp || '';
  let portToSend = options.printerPort || activePrinterPort || 6101;

  // Eğer doğrudan IP yoksa, sunucudan kayıtlı yazıcıları çekip PAKETLEME yazıcısını bul
  if (!ipToSend) {
    try {
      const printers = await getPrinters();
      const packingPrinter = printers.find(p => 
        (p.name || '').toUpperCase().includes('PAKET') || 
        (p.location || '').toUpperCase().includes('PAKET')
      ) || printers[0];

      if (packingPrinter && packingPrinter.ipAddress) {
        ipToSend = packingPrinter.ipAddress;
        portToSend = packingPrinter.port || 6101;
      }
    } catch {
      // ignore
    }
  }

  if (!ipToSend) {
    throw new Error('Yazıcı IP adresi bulunamadı. Lütfen Ayarlar sayfasından Paketleme yazıcısını seçin.');
  }

  const cpclData = generateBoxCpcl(options);
  await sendCpclToPrinter(ipToSend, portToSend, cpclData);
}