import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { Config } from '../config';
import { resetApiInstance, createApiInstance } from '../services/api';
import { useSettingsStore } from '../store/settingsStore';
import { getWarehouses, Warehouse } from '../services/inventory';

export function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const showToast = useUIStore((s) => s.showToast);
  const [apiUrl, setApiUrl] = useState('');
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const { activeWarehouseId, setActiveWarehouse } = useSettingsStore();

  useEffect(() => {
    Config.getApiBaseUrl().then(setApiUrl);
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      setWarehousesLoading(true);
      const data = await getWarehouses();
      
      // Backend'in veri dönüş yapısına (direkt array mi yoksa obje içinde mi) karşı koruma
      if (Array.isArray(data)) {
        setWarehouses(data);
      } else if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
        setWarehouses((data as any).data);
      } else if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
        setWarehouses((data as any).items);
      } else {
        setWarehouses([]); // Tanımsız veya beklenmeyen formattaysa boş liste
      }
    } catch {
      showToast({ message: 'Depolar yüklenirken hata oluştu', type: 'error' });
      setWarehouses([]);
    } finally {
      setWarehousesLoading(false);
    }
  };

  const handleSaveUrl = async () => {
    if (!apiUrl.trim()) {
      showToast({ message: 'Geçerli bir URL girin', type: 'error' });
      return;
    }
    await Config.setApiBaseUrl(apiUrl.trim());
    resetApiInstance();
    await createApiInstance();
    showToast({ message: 'API adresi güncellendi', type: 'success' });
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Ayarlar" showBack={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Kullanıcı Bilgileri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kullanıcı Bilgileri</Text>
          <View style={styles.card}>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="account" size={32} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user?.name || 'Kullanıcı'}</Text>
                <Text style={styles.userEmail}>{user?.email || user?.userName || ''}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sunucu Ayarları */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sunucu Ayarları</Text>
          <View style={styles.card}>
            <Text style={styles.inputLabel}>API Adresi</Text>
            <TextInput
              style={styles.input}
              value={apiUrl}
              onChangeText={setApiUrl}
              placeholder="http://192.168.1.100:5000/api"
              placeholderTextColor={Colors.outline}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveUrl}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="content-save" size={20} color={Colors.onPrimary} />
              <Text style={styles.saveButtonText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Terminal Depo Ayarı */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terminal Depo Ayarı</Text>
          <View style={styles.card}>
            <Text style={{ ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginBottom: Spacing.md }}>
              Bu cihaz (terminal) üzerinden yapılacak tüm işlemler için varsayılan bir depo seçin. Bu ayar cihaz hafızasına kaydedilir.
            </Text>
            
            {warehousesLoading ? (
              <Text style={{ color: Colors.outline }}>Depolar yükleniyor...</Text>
            ) : (
              <View style={{ gap: Spacing.sm }}>
                {(Array.isArray(warehouses) ? warehouses : []).map((w) => {
                  const isActive = activeWarehouseId === w.id;
                  return (
                    <TouchableOpacity
                      key={w.id}
                      style={[styles.warehouseItem, isActive && styles.warehouseItemActive]}
                      onPress={() => {
                        setActiveWarehouse(w.id, w.warehouseName || w.warehouseCode || 'Bilinmeyen');
                        showToast({ message: 'Aktif depo güncellendi', type: 'success' });
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={isActive ? "radiobox-marked" : "radiobox-blank"}
                        size={24}
                        color={isActive ? Colors.primary : Colors.outline}
                      />
                      <Text style={[styles.warehouseName, isActive && styles.warehouseNameActive]}>
                        {w.warehouseName || w.warehouseCode}
                      </Text>
                      {isActive && <Text style={{ marginLeft: 'auto', ...Typography.labelSm, color: Colors.primary }}>AKTİF</Text>}
                    </TouchableOpacity>
                  );
                })}
                {(!warehouses || warehouses.length === 0) && <Text style={{ color: Colors.outline }}>Kayıtlı depo bulunamadı.</Text>}
              </View>
            )}
          </View>
        </View>

        {/* Uygulama Bilgileri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Versiyon</Text>
              <Text style={styles.infoValue}>{Config.APP_VERSION}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Uygulama</Text>
              <Text style={styles.infoValue}>{Config.APP_NAME}</Text>
            </View>
          </View>
        </View>

        {/* Çıkış */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="logout" size={20} color={Colors.error} />
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.marginMobile, paddingBottom: 100, gap: Spacing.xl },
  section: { gap: Spacing.sm },
  sectionTitle: {
    ...Typography.labelLg, color: Colors.onSurfaceVariant,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md, padding: Spacing.cardPadding,
    ...Shadow.card,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  userName: { ...Typography.headlineSm, color: Colors.onSurface },
  userEmail: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  userRole: { ...Typography.labelMd, color: Colors.primary, marginTop: 2 },
  inputLabel: {
    ...Typography.labelLg, color: Colors.onSurfaceVariant, marginBottom: Spacing.sm,
  },
  input: {
    height: Spacing.touchTargetMin,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.sm, borderWidth: 1,
    borderColor: Colors.outlineVariant, paddingHorizontal: Spacing.lg,
    ...Typography.bodyMd, color: Colors.onSurface, marginBottom: Spacing.md,
  },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.sm, minHeight: Spacing.touchTargetMin,
  },
  saveButtonText: { ...Typography.labelLg, color: Colors.onPrimary },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainerHigh,
  },
  infoLabel: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  infoValue: { ...Typography.dataMono, color: Colors.onSurface },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, borderWidth: 1, borderColor: Colors.error,
    borderRadius: BorderRadius.md, minHeight: Spacing.touchTargetMin,
    marginTop: Spacing.lg,
  },
  logoutButtonText: { ...Typography.labelLg, color: Colors.error, fontSize: 16 },
  warehouseItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.surfaceContainer,
  },
  warehouseItemActive: {
    borderColor: Colors.primary, backgroundColor: Colors.primaryContainer,
  },
  warehouseName: { ...Typography.bodyLg, color: Colors.onSurface },
  warehouseNameActive: { fontWeight: 'bold', color: Colors.onPrimaryContainer },
});
