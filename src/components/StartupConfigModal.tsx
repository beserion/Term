import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { CustomIcon } from './CustomIcon';
import { useSettingsStore } from '../store/settingsStore';
import { getWarehouses, Warehouse, getPrinters, PrinterDto } from '../services/inventory';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useUIStore } from '../store/uiStore';

interface StartupConfigModalProps {
  visible: boolean;
  onClose: () => void;
}



export function StartupConfigModal({ visible, onClose }: StartupConfigModalProps) {
  const { 
    activeWarehouseId, 
    activeWarehouseName, 
    setActiveWarehouse,
    activePrinterId,
    activePrinterName,
    setActivePrinter
  } = useSettingsStore();

  const showToast = useUIStore((s) => s.showToast);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  // Alt Seçim Ekranı Durumları
  const [pickerType, setPickerType] = useState<'none' | 'warehouse' | 'printer'>('none');

  const [printers, setPrinters] = useState<PrinterDto[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  useEffect(() => {
    if (visible) {
      loadWarehouses();
      loadPrinters();
    }
  }, [visible]);

  const loadPrinters = async () => {
    try {
      setLoadingPrinters(true);
      const list = await getPrinters();
      setPrinters(list);
      
      if (list.length > 0 && !activePrinterId) {
        setActivePrinter(list[0].id, list[0].name);
      }
    } catch {
      showToast({ message: 'Yazıcılar yüklenirken hata oluştu', type: 'error' });
      setPrinters([]);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const loadWarehouses = async () => {
    try {
      setLoadingWarehouses(true);
      const data = await getWarehouses();
      let parsed: Warehouse[] = [];
      
      if (Array.isArray(data)) {
        parsed = data;
      } else if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
        parsed = (data as any).data;
      } else if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
        parsed = (data as any).items;
      }

      setWarehouses(parsed);

      // Eğer aktif bir depo henüz seçilmemişse, ID'si en küçük olan depoyu varsayılan seç
      if (parsed.length > 0 && !activeWarehouseId) {
        const sorted = [...parsed].sort((a, b) => a.id - b.id);
        const defaultWarehouse = sorted[0];
        setActiveWarehouse(
          defaultWarehouse.id,
          defaultWarehouse.warehouseName || defaultWarehouse.warehouseCode || 'Bilinmeyen'
        );
      }
    } catch {
      showToast({ message: 'Depolar yüklenirken hata oluştu', type: 'error' });
      setWarehouses([]);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const handleSave = () => {
    if (!activeWarehouseId) {
      showToast({ message: 'Lütfen aktif depo seçimi yapın!', type: 'info' });
      return;
    }
    showToast({ message: 'Yapılandırma başarıyla kaydedildi', type: 'success' });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <CustomIcon name="cog" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Cihaz Yapılandırması</Text>
          <Text style={styles.desc}>
            İşlemlere başlamadan önce bu cihazın kullanacağı aktif depoyu ve etiket yazıcısını seçmeniz gerekmektedir.
          </Text>

          {/* Form */}
          <View style={styles.form}>
            {/* Depo Seçimi */}
            <Text style={styles.label}>Aktif Depo</Text>
            <TouchableOpacity 
              style={styles.selectButton} 
              onPress={() => setPickerType('warehouse')}
              activeOpacity={0.7}
            >
              <CustomIcon name="office-building-marker" size={20} color={Colors.primary} />
              <Text style={[styles.selectButtonText, !activeWarehouseId && styles.placeholder]}>
                {activeWarehouseName || 'Depo Seçin...'}
              </Text>
              <CustomIcon name="chevron-down" size={20} color={Colors.outline} />
            </TouchableOpacity>

            {/* Yazıcı Seçimi */}
            <Text style={styles.label}>Aktif Yazıcı</Text>
            <TouchableOpacity 
              style={styles.selectButton} 
              onPress={() => setPickerType('printer')}
              activeOpacity={0.7}
            >
              <CustomIcon name="printer" size={20} color={Colors.primary} />
              <Text style={[styles.selectButtonText, !activePrinterId && styles.placeholder]}>
                {activePrinterName || 'Yazıcı Seçin...'}
              </Text>
              <CustomIcon name="chevron-down" size={20} color={Colors.outline} />
            </TouchableOpacity>
          </View>

          {/* Kaydet Butonu */}
          <TouchableOpacity
            style={[
              styles.saveButton, 
              !activeWarehouseId && styles.saveButtonDisabled
            ]}
            disabled={!activeWarehouseId}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>Kaydet ve Devam Et</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Alt Seçim Listesi Modalı (Depo veya Yazıcı için) */}
      <Modal 
        visible={pickerType !== 'none'} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setPickerType('none')}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {pickerType === 'warehouse' ? 'Depo Seçin' : 'Yazıcı Seçin'}
              </Text>
              <TouchableOpacity onPress={() => setPickerType('none')} style={styles.pickerCloseBtn}>
                <CustomIcon name="close" size={24} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>

            {pickerType === 'warehouse' && (
              <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerListContent}>
                {loadingWarehouses ? (
                  <View style={styles.pickerCenterContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.pickerInfoText}>Depolar yükleniyor...</Text>
                  </View>
                ) : warehouses.length === 0 ? (
                  <View style={styles.pickerCenterContainer}>
                    <Text style={styles.pickerInfoText}>Kayıtlı depo bulunamadı</Text>
                  </View>
                ) : (
                  warehouses.map((w) => {
                    const isSelected = activeWarehouseId === w.id;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                        onPress={() => {
                          setActiveWarehouse(w.id, w.warehouseName || w.warehouseCode || 'Bilinmeyen');
                          setPickerType('none');
                        }}
                        activeOpacity={0.7}
                      >
                        <CustomIcon
                          name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                          size={24}
                          color={isSelected ? Colors.primary : Colors.outline}
                        />
                        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                          {w.warehouseName || w.warehouseCode}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            )}

            {pickerType === 'printer' && (
              <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerListContent}>
                {loadingPrinters ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
                ) : printers.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: Colors.outline, marginTop: Spacing.xl }}>Yazıcı bulunamadı</Text>
                ) : (
                  printers.map((p) => {
                    const isSelected = activePrinterId === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                        onPress={() => {
                          setActivePrinter(p.id, p.name);
                          setPickerType('none');
                        }}
                        activeOpacity={0.7}
                      >
                        <CustomIcon
                          name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                          size={24}
                          color={isSelected ? Colors.primary : Colors.outline}
                        />
                        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadow.card,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.titleLg,
    color: Colors.onSurface,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  desc: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  form: {
    width: '100%',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.labelLg,
    color: Colors.onSurfaceVariant,
    fontWeight: 'bold',
    marginTop: Spacing.xs,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    gap: Spacing.md,
  },
  selectButtonText: {
    flex: 1,
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  placeholder: {
    color: Colors.outline,
  },
  saveButton: {
    width: '100%',
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.outlineVariant,
    elevation: 0,
    shadowOpacity: 0,
  },
  saveButtonText: {
    ...Typography.titleMedium,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },

  // Picker modal styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '60%',
    minHeight: '40%',
    paddingBottom: Spacing.xl,
    ...Shadow.card,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  pickerTitle: {
    ...Typography.titleLg,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  pickerCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerList: {
    flex: 1,
  },
  pickerListContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  pickerItemActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFixed,
  },
  pickerItemText: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  pickerItemTextActive: {
    fontWeight: 'bold',
    color: Colors.onPrimaryFixed,
  },
  pickerCenterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  pickerInfoText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
});
