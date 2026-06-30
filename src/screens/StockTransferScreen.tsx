import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, Stock, createStockTransfer, getWarehouses, Warehouse } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';

export function StockTransferScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [product, setProduct] = useState<Stock | null>(route.params?.product || null);
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  
  // Hedef Depo Modal States
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [targetWarehouseId, setTargetWarehouseId] = useState<number | null>(null);
  
  const { activeWarehouseId, activeWarehouseName } = useSettingsStore();
  const showToast = useUIStore((s) => s.showToast);

  // Depoları çek
  useEffect(() => {
    getWarehouses().then(setWarehouses).catch(() => {});
  }, []);

  const handleScan = async (scannedBarcode: string) => {
    try {
      const data = await getStockByBarcode(scannedBarcode);
      if (!data || !data.id || data.id === 0) {
        throw new Error('Ürün kaydı bulunamadı');
      }
      setProduct(data);
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

  const handleTransfer = async () => {
    if (!product) return;
    
    if (!activeWarehouseId) {
      showToast({ message: 'Lütfen ayarlardan çıkış (terminal) deposunu seçin', type: 'error' });
      return;
    }
    if (!targetWarehouseId) {
      showToast({ message: 'Lütfen hedef depoyu seçin', type: 'error' });
      return;
    }
    if (activeWarehouseId === targetWarehouseId) {
      showToast({ message: 'Çıkış deposu ile Hedef depo aynı olamaz', type: 'warning' });
      return;
    }
    
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      showToast({ message: 'Geçerli bir miktar girin', type: 'error' });
      return;
    }
    
    try {
      await createStockTransfer({
        documentDate: new Date().toISOString(),
        documentNo: note.trim() || 'TRN-' + Date.now(),
        fromWarehouseId: activeWarehouseId,
        toWarehouseId: targetWarehouseId,
        lines: [
          { stockId: product.id, transferQty: qty }
        ]
      });
      showToast({ message: `${product.stockName} transferi başarıyla kaydedildi`, type: 'success' });
      
      setQuantity('');
      setNote('');
      setProduct(null); // Transfer sonrası ekranı temizle
    } catch (err: any) {
      let errorMsg = err.message;
      if (err.response?.data) {
        errorMsg = typeof err.response.data === 'object' ? JSON.stringify(err.response.data, null, 2) : err.response.data;
      }
      console.error("=== STOCK TRANSFER API ERROR ===");
      console.error(errorMsg);
      showToast({ message: 'Transfer başarısız. Detaylar terminalde.', type: 'error' });
    }
  };

  const getTargetWarehouseName = () => {
    if (!targetWarehouseId) return 'Hedef Depo Seçin';
    const w = warehouses.find(x => x.id === targetWarehouseId);
    return w ? (w.warehouseName || w.warehouseCode) : 'Bilinmeyen Depo';
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Depo Transferi" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Çıkış Deposu (Terminal Depo) */}
        <View style={styles.warehouseAlert}>
          <MaterialCommunityIcons name="export" size={20} color={Colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warehouseAlertLabel}>Çıkış Deposu (Terminal)</Text>
            <Text style={styles.warehouseAlertName}>
              {activeWarehouseId ? activeWarehouseName : 'DEPO SEÇİLMEMİŞ!'}
            </Text>
          </View>
        </View>

        {/* Hedef Depo Seçimi */}
        <TouchableOpacity 
          style={[styles.warehouseAlert, { backgroundColor: 'rgba(52, 168, 83, 0.1)', borderColor: 'rgba(52, 168, 83, 0.3)' }]}
          onPress={() => setShowWarehouseModal(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="import" size={20} color={Colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.warehouseAlertLabel, { color: Colors.success }]}>Hedef Depo (Varış)</Text>
            <Text style={styles.warehouseAlertName}>{getTargetWarehouseName()}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={24} color={Colors.onSurface} />
        </TouchableOpacity>

        {/* Barkod giriş */}
        <View style={styles.scanRow}>
          <TextInput
            style={styles.barcodeInput}
            placeholder="Barkod okutun veya girin..."
            placeholderTextColor={Colors.outline}
            value={barcode}
            onChangeText={setBarcode}
            onSubmitEditing={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
            returnKeyType="search"
            autoFocus={true}
            showSoftInputOnFocus={false}
          />
          <TouchableOpacity 
            style={styles.scanButton}
            onPress={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
          >
            <MaterialCommunityIcons name="barcode-scan" size={24} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Ürün Detayı */}
        {product && (
          <View style={styles.productCard}>
            <View style={styles.productHeader}>
              <View style={styles.iconBoxContainer}>
                <MaterialCommunityIcons name="swap-horizontal" size={28} color={Colors.primary} />
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.stockCode}>{product.stockCode || '-'}</Text>
                <Text style={styles.stockName}>{product.stockName}</Text>
              </View>
            </View>

            <View style={styles.qtyContainer}>
              <Text style={styles.qtyLabel}>Mevcut Miktar</Text>
              <Text style={styles.qtyValue}>{product.qty || 0}</Text>
            </View>
            <View style={styles.divider} />

            {/* Form */}
            <Text style={styles.inputLabel}>Transfer Miktarı</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={Colors.outline}
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
            />

            <Text style={styles.inputLabel}>Not / Belge No</Text>
            <TextInput
              style={styles.input}
              placeholder="İsteğe bağlı..."
              placeholderTextColor={Colors.outline}
              value={note}
              onChangeText={setNote}
            />

            <TouchableOpacity 
              style={[styles.actionButton, (!quantity || !targetWarehouseId) && styles.actionButtonDisabled]}
              onPress={handleTransfer}
              disabled={!quantity || !targetWarehouseId}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="truck-fast" size={24} color={Colors.onPrimary} style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>Transferi Başlat</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Hedef Depo Seçim Modalı */}
      <Modal visible={showWarehouseModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Hedef Depo Seçin</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {warehouses.map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setTargetWarehouseId(w.id);
                    setShowWarehouseModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{w.warehouseName || w.warehouseCode}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowWarehouseModal(false)}>
              <Text style={styles.modalCloseText}>İptal</Text>
            </TouchableOpacity>
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
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  warehouseAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(186, 26, 26, 0.08)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.2)',
    gap: Spacing.md,
  },
  warehouseAlertLabel: {
    ...Typography.labelSm,
    color: Colors.error,
    marginBottom: 2,
  },
  warehouseAlertName: {
    ...Typography.titleMd,
    color: Colors.onSurface,
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
  scanButton: {
    width: 56,
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  productCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.md,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  iconBoxContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
  },
  stockCode: {
    ...Typography.labelMd,
    color: Colors.outline,
    marginBottom: 4,
  },
  stockName: {
    ...Typography.titleLg,
    color: Colors.onSurface,
  },
  qtyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  qtyLabel: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  qtyValue: {
    ...Typography.titleLg,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.outlineVariant,
    marginVertical: Spacing.lg,
  },
  inputLabel: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 56,
    ...Typography.bodyLg,
    color: Colors.onSurface,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadow.sm,
  },
  actionButtonDisabled: {
    backgroundColor: Colors.outline,
    elevation: 0,
    shadowOpacity: 0,
  },
  actionButtonText: {
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
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  modalItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  modalItemText: {
    ...Typography.bodyLg,
  },
  modalCloseButton: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
  },
  modalCloseText: {
    ...Typography.labelLg,
  }
});
