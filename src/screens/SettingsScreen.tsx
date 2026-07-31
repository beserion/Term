import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Platform, TextInput } from 'react-native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { Config } from '../config';
import { useSettingsStore } from '../store/settingsStore';
import { getWarehouses, Warehouse } from '../services/inventory';
import { resetApiInstance } from '../services/api';

export function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const showToast = useUIStore((s) => s.showToast);
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { activeWarehouseId, setActiveWarehouse } = useSettingsStore();

  // API Sunucu Adresi state'leri
  const [currentApiUrl, setCurrentApiUrl] = useState('');
  const [showApiUrlModal, setShowApiUrlModal] = useState(false);
  const [newApiUrlInput, setNewApiUrlInput] = useState('');

  useEffect(() => {
    loadWarehouses();
    loadApiUrl();
  }, []);

  const loadApiUrl = async () => {
    const url = await Config.getApiBaseUrl();
    setCurrentApiUrl(url);
  };

  const handleSaveApiUrl = async () => {
    const trimmed = newApiUrlInput.trim();
    if (!trimmed) {
      showToast({ message: 'Lütfen geçerli bir URL girin', type: 'error' });
      return;
    }
    await Config.setApiBaseUrl(trimmed);
    resetApiInstance();
    setCurrentApiUrl(trimmed);
    setShowApiUrlModal(false);
    showToast({ message: 'API sunucu adresi güncellendi', type: 'success' });
  };

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

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
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
                <CustomIcon name="account" size={32} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user?.name || 'Kullanıcı'}</Text>
                <Text style={styles.userEmail}>{user?.email || user?.userName || ''}</Text>
              </View>
            </View>
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
                      <CustomIcon
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

        {/* Uygulama Bilgileri & Sunucu Yapılandırması */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama & Sunucu</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>API Sunucu Adresi</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}
                onPress={() => {
                  setNewApiUrlInput(currentApiUrl);
                  setShowApiUrlModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.infoValue, { color: Colors.primary, maxWidth: 160 }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {currentApiUrl}
                </Text>
                <CustomIcon name="pencil" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>

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
          <CustomIcon name="logout" size={20} color={Colors.error} />
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* API Sunucu Adresi Düzenleme Modalı */}
      <Modal
        visible={showApiUrlModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApiUrlModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconContainer, { backgroundColor: Colors.primaryContainer }]}>
              <CustomIcon name="server-network" size={28} color={Colors.onPrimary} />
            </View>

            <Text style={styles.modalTitle}>API Sunucu Adresi</Text>
            <Text style={styles.modalMessage}>
              Genişletilmiş isteklerin gönderileceği sunucu adresini düzenleyin:
            </Text>

            <View style={{
              width: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: Colors.surfaceContainerLow,
              borderRadius: BorderRadius.md,
              borderWidth: 1,
              borderColor: Colors.outlineVariant,
              paddingHorizontal: Spacing.md,
              height: 48,
              marginBottom: Spacing.xl,
            }}>
              <CustomIcon name="web" size={20} color={Colors.outline} style={{ marginRight: Spacing.sm }} />
              <TextInput
                style={{ flex: 1, ...Typography.bodyMd, color: Colors.onSurface, height: '100%' }}
                placeholder="https://arkship.posnetx.com/api"
                placeholderTextColor={Colors.outline}
                value={newApiUrlInput}
                onChangeText={setNewApiUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowApiUrlModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: Colors.primaryContainer }]}
                onPress={handleSaveApiUrl}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalConfirmText, { color: Colors.onPrimary }]}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Özel Çıkış Onay Modalı */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <CustomIcon name="logout" size={28} color={Colors.error} />
            </View>

            <Text style={styles.modalTitle}>Çıkış Yap</Text>
            <Text style={styles.modalMessage}>
              Hesabınızdan çıkış yapmak istediğinize emin misiniz?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmLogout}
                activeOpacity={0.7}
              >
                <Text style={styles.modalConfirmText}>Çıkış Yap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Modal stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadow.card,
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    marginBottom: Spacing.xs,
  },
  modalMessage: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    ...Typography.labelLg,
    color: Colors.onSurface,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    ...Typography.labelLg,
    color: Colors.onError || '#FFFFFF',
    fontWeight: 'bold',
  },
});
