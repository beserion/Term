import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { CustomIcon } from '../components/CustomIcon';
import { useNavigation } from '@react-navigation/native';
import { DashboardCard } from '../components/DashboardCard';
import { Colors, Typography, Spacing, Shadow, BorderRadius } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { StartupConfigModal } from '../components/StartupConfigModal';

export function DashboardScreen() {
  const navigation = useNavigation<any>();
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
      title: 'Siparişler',
      icon: 'eye' as const,
      iconColor: Colors.primary,
      iconBgColor: 'rgba(30, 58, 138, 0.1)',
      onPress: () => navigation.navigate('ReceivingTab'),
    },
    {
      title: 'Ürün Kontrol',
      icon: 'barcode-scan' as const,
      iconColor: Colors.primary,
      iconBgColor: 'rgba(30, 58, 138, 0.1)',
      onPress: () => navigation.navigate('ProductCheck'),
    },

    {
      title: 'Mal Çıkış',
      icon: 'minus-circle-outline' as const,
      iconColor: Colors.error,
      iconBgColor: 'rgba(186, 26, 26, 0.08)',
      onPress: () => navigation.navigate('StockDecrease'),
    },
    {
      title: 'Mal Giriş',
      icon: 'plus-circle-outline' as const,
      iconColor: Colors.primary,
      iconBgColor: 'rgba(208, 225, 251, 0.5)',
      onPress: () => navigation.navigate('StockIncrease'),
    },
    {
      title: 'Barkod Eşleme',
      icon: 'link-variant' as const,
      iconColor: Colors.primary,
      iconBgColor: 'rgba(30, 58, 138, 0.1)',
      onPress: () => navigation.navigate('BarcodeLink'),
    },
    {
      title: 'Depo Sayım',
      icon: 'clipboard-check-outline' as const,
      iconColor: Colors.primary,
      iconBgColor: 'rgba(30, 58, 138, 0.1)',
      onPress: () => navigation.navigate('CycleCount'),
    },
    {
      title: 'Depo Transferi',
      icon: 'swap-horizontal' as const,
      iconColor: Colors.primary,
      iconBgColor: 'rgba(208, 225, 251, 0.5)',
      onPress: () => navigation.navigate('StockTransfer'),
    },
    {
      title: 'Etiket Yazdırma',
      icon: 'printer' as const,
      iconColor: Colors.primary,
      iconBgColor: 'rgba(30, 58, 138, 0.1)',
      onPress: () => navigation.navigate('LabelPrint'),
    },
    {
      title: 'İrsaliye',
      icon: 'truck-delivery' as const,
      iconColor: Colors.primary,
      iconBgColor: 'rgba(30, 58, 138, 0.1)',
      onPress: () => navigation.navigate('ShippingTab'),
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.menuButton} activeOpacity={0.7}>
            <CustomIcon name="menu" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.welcomeText}>
            Hoş geldin, {user?.name || 'Kullanıcı'}
          </Text>
        </View>
        <TouchableOpacity style={styles.avatarButton} activeOpacity={0.7}>
          <CustomIcon name="account" size={24} color={Colors.primary} />
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
            <View
              key={index}
              style={[
                styles.gridItem,
                // Son tek kart ise tam genişlik
                index === modules.length - 1 && modules.length % 2 !== 0
                  ? styles.gridItemFull
                  : null,
              ]}
            >
              <DashboardCard
                title={module.title}
                icon={module.icon}
                iconColor={module.iconColor}
                iconBgColor={module.iconBgColor}
                onPress={module.onPress}
              />
            </View>
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.marginMobile,
    height: 56,
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  warehouseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.marginMobile,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primaryFixed,
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
    color: Colors.onPrimaryFixedVariant,
  },
  warehouseBarName: {
    fontWeight: 'bold',
    color: Colors.onPrimaryFixed,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    flex: 1,
  },
  menuButton: {
    width: Spacing.touchTargetMin,
    height: Spacing.touchTargetMin,
    borderRadius: Spacing.touchTargetMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    ...Typography.headlineSm,
    color: Colors.primary,
    flex: 1,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContainer: {
    padding: Spacing.marginMobile,
    paddingTop: Spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  gridItem: {
    width: '47.5%',
  },
  gridItemFull: {
    width: '100%',
  },
});
