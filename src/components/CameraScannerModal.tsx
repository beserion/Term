import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { CustomIcon } from './CustomIcon';
import { Colors } from '../theme/colors';
import { FeedbackService } from '../services/feedback';

interface CameraScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (scannedCode: string) => void;
  title?: string;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  title = 'Barkod / QR Kod Taraması',
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const isScanningRef = useRef(false);

  // Tarama çizgisi animasyonu
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      isScanningRef.current = false;
      setTorchEnabled(false);

      // Çizgi animasyonunu başlat
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();

      return () => animation.stop();
    }
  }, [visible, scanLineAnim]);

  const handleBarcodeScanned = ({ data }: { type: string; data: string }) => {
    if (isScanningRef.current) return;
    if (!data || data.trim().length === 0) return;

    isScanningRef.current = true;
    FeedbackService.playLightImpact();

    onScan(data.trim());
    onClose();
  };

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={styles.container}>
        {/* Üst Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose} activeOpacity={0.7}>
            <CustomIcon name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>{title}</Text>

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setTorchEnabled((prev) => !prev)}
            activeOpacity={0.7}
          >
            <CustomIcon
              name={torchEnabled ? 'flash' : 'flash-off'}
              size={24}
              color={torchEnabled ? '#FFD700' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>

        {/* İzin Kontrolü */}
        {!permission ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.infoText}>Kamera izni kontrol ediliyor...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centered}>
            <CustomIcon name="camera-off" size={56} color={Colors.error} />
            <Text style={styles.errorTitle}>Kamera İzni Gerekli</Text>
            <Text style={styles.infoText}>
              Barkod ve QR kod okutabilmek için kamera erişimine izin vermeniz gerekmektedir.
            </Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.8}>
              <Text style={styles.permissionBtnText}>Kamera İzni Ver</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Kamera Görünümü */
          <View style={styles.cameraWrapper}>
            <CameraView
              style={StyleSheet.absoluteFill}
              enableTorch={torchEnabled}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'code128',
                  'code39',
                  'upc_a',
                  'upc_e',
                  'datamatrix',
                  'pdf417',
                  'aztec',
                  'itf14',
                ],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />

            {/* Overlays / Mask */}
            <View style={styles.overlayContainer}>
              <View style={styles.overlayTop} />
              
              <View style={styles.overlayMiddleRow}>
                <View style={styles.overlaySide} />
                
                {/* Hedefleme Çerçevesi */}
                <View style={styles.targetBox}>
                  {/* Çerçeve Köşeleri */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />

                  {/* Kırmızı Tarama Çizgisi */}
                  <Animated.View
                    style={[
                      styles.scanLine,
                      { transform: [{ translateY }] },
                    ]}
                  />
                </View>

                <View style={styles.overlaySide} />
              </View>

              <View style={styles.overlayBottom}>
                <Text style={styles.hintText}>
                  Barkodu veya QR kodu hizada tutun
                </Text>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const BOX_SIZE = 240;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#121212',
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  infoText: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  permissionBtn: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  overlayMiddleRow: {
    height: BOX_SIZE,
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  targetBox: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    position: 'relative',
    overflow: 'hidden',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    paddingTop: 30,
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: Colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 6,
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
});
