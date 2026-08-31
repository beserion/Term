import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { CustomIcon } from '../components/CustomIcon';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Shadow, BorderRadius } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { StartupConfigModal } from '../components/StartupConfigModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const { activeWarehouseId, activeWarehouseName, activePrinterId, activePrinterName } = useSettingsStore();
  const [startupModalVisible, setStartupModalVisible] = useState(false);

  useEffect(() => {
    // Depo seçilmemişse başlangıç modalını zorunlu olarak aç (yazıcı seçimi isteğe bağlıdır)
    if (!activeWarehouseId) {
      setStartupModalVisible(true);
    }
  }, [activeWarehouseId]);

  const modules = [
    {
      title: 'Raf Sorgulama',
      icon: 'barcode-scan' as const,
      onPress: () => navigation.navigate('BinQuery'),
    },
    {
      title: 'Raf Transferi',
      icon: 'swap-horizontal' as const,
      onPress: () => navigation.navigate('BinTransfer'),
    },
    {
      title: 'Mobil Raflama',
      icon: 'package-variant' as const,
      onPress: () => navigation.navigate('Putaway'),
    },
    {
      title: 'Sipariş Toplama',
      icon: 'package-down' as const,
      onPress: () => navigation.navigate('Picking'),
    },
    {
      title: 'Mal Kabul',
      icon: 'plus-circle' as const,
      onPress: () => navigation.navigate('StockIncrease'),
    },
    {
      title: 'Mal Çıkış',
      icon: 'minus-circle' as const,
      onPress: () => navigation.navigate('StockDecrease'),
    },
    {
      title: 'Ürün Kontrol',
      icon: 'magnify' as const,
      onPress: () => navigation.navigate('ProductCheck'),
    },
    {
      title: 'Sayım',
      icon: 'package-variant-closed' as const,
      onPress: () => navigation.navigate('CycleCount'),
    },
    {
      title: 'Barkod Basım',
      icon: 'printer' as const,
      onPress: () => navigation.navigate('LabelPrint'),
    },
    {
      title: 'Depo Transferi',
      icon: 'truck-delivery-outline' as const,
      onPress: () => navigation.navigate('StockTransfer'),
    },
    {
      title: 'Siparişler',
      icon: 'clipboard-list-outline' as const,
      onPress: () => navigation.navigate('ReceivingStack'),
    },
    {
      title: 'Barkod Eşleme',
      icon: 'link-variant' as const,
      onPress: () => navigation.navigate('BarcodeLink'),
    },
    {
      title: 'İrsaliye',
      icon: 'truck-delivery' as const,
      onPress: () => navigation.navigate('ShippingStack'),
    },
    {
      title: 'Koli & Palet',
      icon: 'warehouse' as const,
      onPress: () => navigation.navigate('PackingList'),
    },
    {
      title: 'Hızlı Kurulum',
      icon: 'cog-outline' as const,
      onPress: () => navigation.navigate('QuickSetup'),
    },
    {
      title: 'Raf QR Basım',
      icon: 'qrcode-edit' as const,
      onPress: () => navigation.navigate('BinQrCode'),
    }
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, height: 56 + insets.top }]}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>BlueHub Depo</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Settings')}
        >
          <CustomIcon name="cog" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Aktif Yapılandırma Çubuğu */}
      <TouchableOpacity
        style={styles.warehouseBar}
        onPress={() => setStartupModalVisible(true)}
        activeOpacity={0.8}
      >
        <View style={styles.warehouseBarLeft}>
          <CustomIcon name="cog-outline" size={20} color={Colors.primary} />
          <Text style={styles.warehouseBarText} numberOfLines={1}>
            Depo: <Text style={styles.warehouseBarName}>{activeWarehouseName || 'Seçilmemiş'}</Text>
            {'  |  '}
            Yazıcı: <Text style={styles.warehouseBarName}>{activePrinterName || 'Seçilmemiş'}</Text>
          </Text>
        </View>
        <CustomIcon name="chevron-right" size={20} color={Colors.outline} />
      </TouchableOpacity>

      {/* Dashboard Grid */}
      <ScrollView
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {modules.map((module, index) => (
            <TouchableOpacity
              key={index}
              style={styles.card}
              onPress={module.onPress}
              activeOpacity={0.8}
            >
              <CustomIcon name={module.icon} size={36} color="#ffffff" />
              <Text style={styles.cardTitle}>{module.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <StartupConfigModal
        visible={startupModalVisible}
        onClose={() => setStartupModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.marginMobile,
    height: 56,
    backgroundColor: Colors.primary,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    flex: 1,
  },
  settingsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warehouseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.marginMobile,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.secondaryContainer,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  warehouseBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  warehouseBarText: {
    ...Typography.bodyMd,
    color: Colors.onSecondaryContainer,
  },
  warehouseBarName: {
    fontWeight: 'bold',
    color: Colors.primary,
  },
  gridContainer: {
    padding: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.lg,
  },
  card: {
    width: '47.5%',
    aspectRatio: 1.28,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
    borderBottomLeftRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});
