import { useEffect, useRef, useCallback } from 'react';
import { DeviceEventEmitter, NativeEventEmitter, Platform } from 'react-native';

/**
 * Zebra DataWedge Barkod Hook'u
 * 
 * Zebra el terminallerinde DataWedge servisinden
 * Intent Broadcast yoluyla barkod verisi yakalar.
 * 
 * Kullanım:
 * const { lastBarcode } = useBarcode((barcode) => {
 *   console.log('Barkod tarandı:', barcode);
 * });
 */

// DataWedge Intent aksiyonu
const DATAWEDGE_INTENT_ACTION = 'com.wms.terminal.ACTION';
const DATAWEDGE_INTENT_CATEGORY = 'android.intent.category.DEFAULT';

interface UseBarcodeReturn {
  lastBarcode: string | null;
}

export function useBarcode(
  onScan: (barcode: string) => void,
  enabled: boolean = true
): UseBarcodeReturn {
  const lastBarcodeRef = useRef<string | null>(null);
  const onScanRef = useRef(onScan);

  // Callback'i güncel tut
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    // Zebra DataWedge Intent dinle
    const subscription = DeviceEventEmitter.addListener(
      'datawedge_broadcast_intent',
      (intent: any) => {
        if (intent && intent['com.symbol.datawedge.data_string']) {
          const barcode = intent['com.symbol.datawedge.data_string'].trim();
          if (barcode) {
            lastBarcodeRef.current = barcode;
            onScanRef.current(barcode);
          }
        }
      }
    );

    // Alternatif: Keyboard wedge modunda çalışırken
    // barkod verisini gizli TextInput üzerinden de yakalayabiliriz
    // Bu, DataWedge modülü yüklü olmayan cihazlar için yedek yöntemdir

    return () => {
      subscription.remove();
    };
  }, [enabled]);

  return {
    lastBarcode: lastBarcodeRef.current,
  };
}

/**
 * Keyboard Wedge Barkod Hook'u
 * DataWedge Intent yerine, barkod verisini TextInput üzerinden yakalar.
 * Zebra cihazlarda "Keystroke Output" modunda kullanılır.
 */
export function useKeyboardBarcode(
  onScan: (barcode: string) => void,
  options?: { minLength?: number; maxDelay?: number }
) {
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);
  const minLength = options?.minLength || 4;
  const maxDelay = options?.maxDelay || 100; // ms between keystrokes

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleKeyPress = useCallback((char: string) => {
    // Timer'ı sıfırla
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (char === '\n' || char === '\r') {
      // Enter → barkod tamamlandı
      if (bufferRef.current.length >= minLength) {
        onScanRef.current(bufferRef.current);
      }
      bufferRef.current = '';
      return;
    }

    bufferRef.current += char;

    // Belirli süre karakter gelmezse buffer'ı temizle
    timerRef.current = setTimeout(() => {
      bufferRef.current = '';
    }, maxDelay);
  }, [minLength, maxDelay]);

  return { handleKeyPress };
}
