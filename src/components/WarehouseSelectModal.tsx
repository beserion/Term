import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { CustomIcon } from './CustomIcon';
import { SearchBar } from './SearchBar';
import { useSettingsStore } from '../store/settingsStore';
import { getWarehouses, Warehouse } from '../services/inventory';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useUIStore } from '../store/uiStore';

interface WarehouseSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect?: (warehouse: Warehouse) => void;
}

export function WarehouseSelectModal({ visible, onClose, onSelect }: WarehouseSelectModalProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { activeWarehouseId, setActiveWarehouse } = useSettingsStore();
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    if (visible) {
      loadWarehouses();
    }
  }, [visible]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const data = await getWarehouses();
      
      if (Array.isArray(data)) {
        setWarehouses(data);
      } else if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
        setWarehouses((data as any).data);
      } else if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
        setWarehouses((data as any).items);
      } else {
        setWarehouses([]);
      }
    } catch {
      showToast({ message: 'Depolar yüklenirken hata oluştu', type: 'error' });
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredWarehouses = warehouses.filter((w) => {
    const name = (w.warehouseName || '').toLowerCase();
    const code = (w.warehouseCode || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || code.includes(query);
  });

  const handleSelect = (w: Warehouse) => {
    setActiveWarehouse(w.id, w.warehouseName || w.warehouseCode || 'Bilinmeyen');
    if (onSelect) {
      onSelect(w);
    }
    showToast({ message: 'Aktif depo güncellendi', type: 'success' });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Modal Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Depo Seçin</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <CustomIcon name="close" size={24} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          {/* Arama Barı */}
          <View style={styles.searchContainer}>
            <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Depo ara..." />
          </View>

          {/* Liste */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.infoText}>Depolar yükleniyor...</Text>
            </View>
          ) : filteredWarehouses.length === 0 ? (
            <View style={styles.centerContainer}>
              <CustomIcon name="office-building-marker-outline" size={48} color={Colors.outlineVariant} />
              <Text style={styles.infoText}>Depo bulunamadı</Text>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {filteredWarehouses.map((w) => {
                const isActive = activeWarehouseId === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.item, isActive && styles.itemActive]}
                    onPress={() => handleSelect(w)}
                    activeOpacity={0.7}
                  >
                    <CustomIcon
                      name={isActive ? 'radiobox-marked' : 'radiobox-blank'}
                      size={24}
                      color={isActive ? Colors.primary : Colors.outline}
                    />
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, isActive && styles.itemNameActive]}>
                        {w.warehouseName || w.warehouseCode}
                      </Text>
                      {w.warehouseCode && w.warehouseName && (
                        <Text style={styles.itemCode}>{w.warehouseCode}</Text>
                      )}
                    </View>
                    {isActive && (
                      <Text style={styles.activeText}>AKTİF</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    maxHeight: '80%',
    minHeight: '50%',
    paddingBottom: Spacing.xl,
    ...Shadow.nav,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  title: {
    fontSize: 15,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    padding: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: Spacing.xl,
    gap: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  itemActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFixed,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  itemNameActive: {
    fontWeight: 'bold',
    color: Colors.onPrimaryFixed,
  },
  itemCode: {
    fontSize: 9,
    color: Colors.outline,
    marginTop: 1,
  },
  activeText: {
    fontSize: 9,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  infoText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
});
