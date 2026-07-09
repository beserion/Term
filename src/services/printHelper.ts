import TcpSocket from 'react-native-tcp-socket';

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
      console.log(`[TCP YAZICI] 🔌 TCP bağlantısı kuruluyor: ${ip}:${port}`);
      
      client = TcpSocket.createConnection({
        host: ip,
        port: port,
      }, () => {
        console.log(`[TCP YAZICI] 🚀 Bağlandı, veri gönderiliyor...`);
        
        client.write(cpclData, 'utf-8', (err: any) => {
          if (err) {
            console.error(`[TCP YAZICI] ❌ Veri yazma hatası:`, err);
            cleanupAndReject(new Error(`Yazıcıya veri yazılırken hata oluştu: ${err.message}`));
          } else {
            console.log(`[TCP YAZICI] ✅ Veri başarıyla gönderildi.`);
            setTimeout(() => {
              cleanupAndResolve();
            }, 200);
          }
        });
      });

      client.on('error', (err: any) => {
        console.error(`[TCP YAZICI] ❌ Soket hatası:`, err);
        cleanupAndReject(new Error(`Yazıcı bağlantı hatası: ${err.message}`));
      });

      client.setTimeout(5000, () => {
        console.error(`[TCP YAZICI] ⏱️ Zaman aşımı (Timeout).`);
        cleanupAndReject(new Error('Yazıcı bağlantı zaman aşımına uğradı (Timeout).'));
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
  console.log(`[HTTP YAZICI] 🌐 HTTP POST /pstprnt üzerinden veri gönderiliyor: http://${ip}/pstprnt`);
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 5000); // 5 saniye timeout

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
    console.log(`[HTTP YAZICI] ✅ Veri HTTP üzerinden başarıyla gönderildi.`);
  } catch (err: any) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Etiket verisini yazıcıya gönderir.
 * Expo Go ortamlarındaki yerel TCP modülü eksikliği durumunda otomatik olarak HTTP POST fallback moduna geçer.
 */
export async function sendCpclToPrinter(ip: string, port: number, cpclData: string): Promise<void> {
  try {
    // 1. Önce TCP üzerinden göndermeyi dene
    await sendCpclViaTcp(ip, port, cpclData);
  } catch (err: any) {
    console.warn(`[YAZICI UYARI] TCP gönderimi başarısız oldu. Hata: ${err.message}`);
    
    // Eğer hata native module eksikliğinden ("connect of null") veya soket bağlantı hatasından kaynaklanıyorsa HTTP'yi dene
    const isNativeModuleError = err.message.includes('null') || err.message.includes('connect') || err.message.includes('undefined');
    if (isNativeModuleError) {
      console.log("[YAZICI] Expo Go / Native modül eksikliği tespit edildi. HTTP Fallback başlatılıyor...");
      try {
        await sendCpclViaHttp(ip, cpclData);
      } catch (httpErr: any) {
        throw new Error(`Yazıcı bağlantı hatası. (Expo Go HTTP Fallback de başarısız oldu: ${httpErr.message})`);
      }
    } else {
      // Eğer native modül hatası değilse (örn: yazıcı IP'sine ulaşılamadı), doğrudan hatayı fırlat
      throw err;
    }
  }
}
