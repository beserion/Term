import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUIStore } from '../store/uiStore';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { FeedbackService } from '../services/feedback';

const { width, height } = Dimensions.get('window');

export function RedScreenLock() {
  const { isErrorLocked, errorLockMessage, hideErrorLock } = useUIStore();

  useEffect(() => {
    if (isErrorLocked) {
      // Hata kilidi açıldığında güçlü hata ses ve titreşimini tetikle
      FeedbackService.playError();
    }
  }, [isErrorLocked]);

  if (!isErrorLocked) return null;

  return (
    <Modal visible={isErrorLocked} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <MaterialCommunityIcons name="alert-octagon" size={80} color={Colors.white} style={styles.icon} />
          
          <Text style={styles.title}>KRİTİK HATA</Text>
          
          <Text style={styles.message}>
            {errorLockMessage || 'Yanlış bir ürün okuttunuz veya miktar aşıldı! Lütfen kontrol edin.'}
          </Text>

          <TouchableOpacity style={styles.button} onPress={hideErrorLock} activeOpacity={0.7}>
            <Text style={styles.buttonText}>ANLADIM</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#93000a', // Çok güçlü bir kırmızı (ErrorContainer veya Dark Error)
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    width: width,
    height: height,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.displaySm,
    color: Colors.white,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  message: {
    ...Typography.headlineSm,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    opacity: 0.9,
  },
  button: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  buttonText: {
    ...Typography.titleLg,
    color: '#93000a',
    fontWeight: 'bold',
  }
});
