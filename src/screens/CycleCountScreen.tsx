import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, Stock, createCycleCount } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';

interface CountedItem {
  product: Stock;
  countedQty: number;
}

export function CycleCountScreen() {
  const navigation = useNavigation<any>();
  const [barcode, setBarcode] = useState('');
  const [countedItems, setCountedItems] = useState<CountedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Edit Quantity Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CountedItem | null>(null);
  const [editQtyStr, setEditQtyStr] = useState('');
  
  const { activeWarehouseId, activeWarehouseName } = useSettingsStore();
  const showToast = useUIStore((s) => s.showToast);

  const handleScan = async (scannedBarcode: string) => {
    try {
      const data = await getStockByBarcode(scannedBarcode);
      if (!data || !data.id || data.id === 0) {
        throw new Error('Ürün kaydı bulunamadı');
      }
      
      // Listede var mı kontrol et
      setCountedItems(prev => {
        const existing = prev.find(item => item.product.id === data.id);
        if (existing) {
          // Varsa miktarını 1 artır
          return prev.map(item => 
            item.product.id === data.id 
              ? { ...item, countedQty: item.countedQty + 1 } 
              : item
          );
        } else {
          // Yoksa yeni ekle (Miktar 1)
          return [{ product: data, countedQty: 1 }, ...prev];
        }
      });
      showToast({ message: `${data.stockName} okundu`, type: 'success' });
    } catch {
      showToast({ message: 'Barkod bulunamadı: ' + scannedBarcode, type: 'error' });
    }
  };

  useBarcode(handleScan);

  useEffect(() => {
    if (barcode.trim().length >= 4) {
      const timeout = setTimeout(() => {
        handleScan(barcode.trim());
        setBarcode('');
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [barcode]);

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const qty = parseFloat(editQtyStr);
    
    if (isNaN(qty) || qty < 0) {
      showToast({ message: 'Geçerli bir miktar girin', type: 'error' });
      return;
    }
    
    setCountedItems(prev => prev.map(item => 
      item.product.id === editingItem.product.id 
        ? { ...item, countedQty: qty } 
        : item
    ));
    setShowEditModal(false);
    setEditingItem(null);
  };

  const handleRemoveItem = (stockId: number) => {
    setCountedItems(prev => prev.filter(item => item.product.id !== stockId));
  };

  const handleSubmit = async () => {
    if (!activeWarehouseId) {
      showToast({ message: 'Lütfen ayarlardan depo seçin', type: 'error' });
      return;
    }
    if (countedItems.length === 0) {
      showToast({ message: 'Sayım listesi boş', type: 'warning' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createCycleCount({
        documentNo: 'CYC-' + Date.now(),
        countDate: new Date().toISOString(),
        warehouseId: activeWarehouseId,
        lines: countedItems.map(item => ({
          stockId: item.product.id,
          countedQty: item.countedQty
        }))
      });
      showToast({ message: 'Sayım fişi başarıyla oluşturuldu', type: 'success' });
      setCountedItems([]); // Temizle
    } catch (err: any) {
      let errorMsg = err.message;
      if (err.response?.data) {
        errorMsg = typeof err.response.data === 'object' ? JSON.stringify(err.response.data, null, 2) : err.response.data;
      }
      console.error("=== CYCLE COUNT API ERROR ===");
      console.error(errorMsg);
      showToast({ message: 'Sayım kaydedilemedi. Detaylar terminalde.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Depo Sayım (Cycle-Count)" onBack={() => navigation.goBack()} />

      <View style={styles.warehouseAlert}>
        <MaterialCommunityIcons name="clipboard-check-outline" size={24} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.warehouseAlertLabel}>Sayım Yapılan Depo</Text>
          <Text style={styles.warehouseAlertName}>
            {activeWarehouseId ? activeWarehouseName : 'DEPO SEÇİLMEMİŞ!'}
          </Text>
        </View>
      </View>

      <View style={styles.scanContainer}>
        <View style={styles.scanRow}>
          <TextInput
            style={styles.barcodeInput}
            placeholder="Barkod okutun..."
            placeholderTextColor={Colors.outline}
            value={barcode}
            onChangeText={setBarcode}
            onSubmitEditing={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
            returnKeyType="search"
            autoFocus={true}
            showSoftInputOnFocus={false}
          />
        </View>
        <Text style={styles.hint}>Peş peşe okutulan aynı ürünlerin miktarı otomatik toplanır.</Text>
      </View>

      <FlatList
        data={countedItems}
        keyExtractor={item => item.product.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="barcode-scan" size={48} color={Colors.outlineVariant} />
            <Text style={styles.emptyText}>Henüz ürün okutulmadı</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <View style={styles.listItemInfo}>
              <Text style={styles.listItemCode}>{item.product.stockCode || '-'}</Text>
              <Text style={styles.listItemName} numberOfLines={2}>{item.product.stockName}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.qtyBadge}
              onPress={() => {
                setEditingItem(item);
                setEditQtyStr(item.countedQty.toString());
                setShowEditModal(true);
              }}
            >
              <Text style={styles.qtyBadgeText}>{item.countedQty}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => handleRemoveItem(item.product.id)}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={24} color={Colors.error} />
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Toplam Kalem:</Text>
          <Text style={styles.summaryValue}>{countedItems.length}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.submitButton, countedItems.length === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={countedItems.length === 0 || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Kaydediliyor...' : 'Sayımı Kaydet'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Miktar Düzenleme Modalı */}
      <Modal visible={showEditModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Miktarı Düzenle</Text>
            <Text style={styles.modalSubTitle}>{editingItem?.product.stockName}</Text>
            
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={editQtyStr}
              onChangeText={setEditQtyStr}
              autoFocus={true}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowEditModal(false)}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveEdit}>
                <Text style={styles.modalSaveText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  warehouseAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 58, 138, 0.05)',
    padding: Spacing.md,
    margin: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 138, 0.2)',
    gap: Spacing.md,
  },
  warehouseAlertLabel: {
    ...Typography.labelSm,
    color: Colors.primary,
    marginBottom: 2,
  },
  warehouseAlertName: {
    ...Typography.titleMd,
    color: Colors.onSurface,
  },
  scanContainer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  scanRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  barcodeInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 56,
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  hint: {
    ...Typography.labelSm,
    color: Colors.outline,
    marginTop: Spacing.xs,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadow.sm,
    gap: Spacing.md,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemCode: {
    ...Typography.labelSm,
    color: Colors.outline,
  },
  listItemName: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  qtyBadge: {
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
    minWidth: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  qtyBadgeText: {
    ...Typography.titleLg,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: Spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    opacity: 0.5,
  },
  emptyText: {
    ...Typography.bodyLg,
    marginTop: Spacing.md,
  },
  footer: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    ...Shadow.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  summaryLabel: {
    ...Typography.bodyLg,
    color: Colors.onSurfaceVariant,
  },
  summaryValue: {
    ...Typography.titleLg,
    color: Colors.primary,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: Colors.outline,
  },
  submitButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: {
    ...Typography.titleLg,
    marginBottom: Spacing.xs,
  },
  modalSubTitle: {
    ...Typography.bodyMd,
    color: Colors.outline,
    marginBottom: Spacing.lg,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 56,
    ...Typography.titleLg,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  modalCancelButton: {
    padding: Spacing.md,
  },
  modalCancelText: {
    ...Typography.labelLg,
    color: Colors.outline,
  },
  modalSaveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalSaveText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  }
});
