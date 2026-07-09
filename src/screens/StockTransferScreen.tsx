import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, Stock, createStockTransfer, getWarehouses, Warehouse } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { FeedbackService } from '../services/feedback';
import { ScalePressable } from '../components/ScalePressable';
import { WarehouseSelectModal } from '../components/WarehouseSelectModal';
import { Numpad } from '../components/Numpad';

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
  
  const [warehouseModalVisible, setWarehouseModalVisible] = useState(false);
  const [showSoftKeyboard, setShowSoftKeyboard] = useState(false);
  const [numpadVisible, setNumpadVisible] = useState(false);
  const barcodeInputRef = React.useRef<TextInput>(null);
  
  const { activeWarehouseId, activeWarehouseName } = useSettingsStore();
  const showToast = useUIStore((s) => s.showToast);

  // Depoları çek
  useEffect(() => {
    getWarehouses()
      .then((data) => {
        if (Array.isArray(data)) {
          setWarehouses(data);
        } else if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
          setWarehouses((data as any).data);
        } else if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
          setWarehouses((data as any).items);
        } else {
          setWarehouses([]);
        }
      })
      .catch(() => {
        setWarehouses([]);
      });
  }, []);

  const handleScan = async (scannedBarcode: string) => {
    try {
      const data = await getStockByBarcode(scannedBarcode);
      if (!data || !data.id || data.id === 0) {
        throw new Error('Ürün kaydı bulunamadı');
      }
      setProduct(data);
      FeedbackService.playSuccess();
    } catch {
      FeedbackService.playError();
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
      FeedbackService.playSuccess();
      showToast({ message: `${product.stockName} transferi başarıyla kaydedildi`, type: 'success' });
      
      setQuantity('');
      setNote('');
      setProduct(null); // Transfer sonrası ekranı temizle
    } catch (err: any) {
      FeedbackService.playError();
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
        <TouchableOpacity 
          style={styles.warehouseAlert} 
          onPress={() => setWarehouseModalVisible(true)}
          activeOpacity={0.8}
        >
          <CustomIcon name="export" size={20} color={Colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warehouseAlertLabel}>Çıkış Deposu (Terminal)</Text>
            <Text style={styles.warehouseAlertName}>
              {activeWarehouseId ? activeWarehouseName : 'DEPO SEÇİLMEMİŞ! Dokunup seçin.'}
            </Text>
          </View>
          <CustomIcon name="chevron-down" size={20} color={Colors.error} />
        </TouchableOpacity>

        {/* Hedef Depo Seçimi */}
        <TouchableOpacity 
          style={[styles.warehouseAlert, { backgroundColor: 'rgba(52, 168, 83, 0.1)', borderColor: 'rgba(52, 168, 83, 0.3)' }]}
          onPress={() => setShowWarehouseModal(true)}
          activeOpacity={0.7}
        >
          <CustomIcon name="import" size={20} color={Colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.warehouseAlertLabel, { color: Colors.success }]}>Hedef Depo (Varış)</Text>
            <Text style={styles.warehouseAlertName}>{getTargetWarehouseName()}</Text>
          </View>
          <CustomIcon name="chevron-down" size={24} color={Colors.onSurface} />
        </TouchableOpacity>

        {/* Barkod giriş */}
        <View style={styles.scanRow}>
          <View style={styles.barcodeInputContainer}>
            <TextInput
              style={styles.barcodeInput}
              placeholder="Barkod okutun veya girin..."
              placeholderTextColor={Colors.outline}
              value={barcode}
              onChangeText={setBarcode}
              onSubmitEditing={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
              returnKeyType="search"
              ref={barcodeInputRef}
              autoFocus={true}
              showSoftInputOnFocus={showSoftKeyboard}
            />
            <TouchableOpacity 
              style={styles.keyboardToggleBtn}
              onPress={() => {
                setShowSoftKeyboard(prev => !prev);
                setTimeout(() => barcodeInputRef.current?.focus(), 100);
              }}
              activeOpacity={0.7}
            >
              <CustomIcon 
                name={showSoftKeyboard ? "keyboard" : "keyboard-outline"} 
                size={22} 
                color={showSoftKeyboard ? Colors.primary : Colors.outline} 
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.scanButton}
            onPress={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
          >
            <CustomIcon name="barcode-scan" size={24} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Ürün Detayı */}
        {product && (
          <View style={styles.productCard}>
            <View style={styles.productHeader}>
              <View style={styles.iconBoxContainer}>
                <CustomIcon name="swap-horizontal" size={28} color={Colors.primary} />
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
            <TouchableOpacity 
              style={styles.quantityInputTouchable} 
              onPress={() => setNumpadVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.quantityInputText, !quantity && styles.quantityInputPlaceholder]}>
                {quantity || '0'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Not / Belge No</Text>
            <TextInput
              style={styles.input}
              placeholder="İsteğe bağlı..."
              placeholderTextColor={Colors.outline}
              value={note}
              onChangeText={setNote}
            />

            <ScalePressable 
              style={[styles.actionButton, (!quantity || !targetWarehouseId) && styles.actionButtonDisabled]}
              onPress={handleTransfer}
              disabled={!quantity || !targetWarehouseId}
            >
              <CustomIcon name="truck-fast" size={24} color={Colors.onPrimary} style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>Transferi Başlat</Text>
            </ScalePressable>
          </View>
        )}
      </ScrollView>

      {/* Hedef Depo Seçim Modalı */}
      <Modal visible={showWarehouseModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Hedef Depo Seçin</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {(Array.isArray(warehouses) ? warehouses : []).map(w => (
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

      <WarehouseSelectModal
        visible={warehouseModalVisible}
        onClose={() => setWarehouseModalVisible(false)}
      />

      {product && (
        <Numpad 
          visible={numpadVisible}
          onClose={() => setNumpadVisible(false)}
          onType={(val) => setQuantity(prev => prev + val)}
          onDelete={() => setQuantity(prev => prev.slice(0, -1))}
          onSubmit={handleTransfer}
          submitLabel="TRANSFERİ BAŞLAT"
          submitColor={Colors.primary}
        />
      )}
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
  barcodeInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingRight: Spacing.xs,
  },
  barcodeInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.md,
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  keyboardToggleBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  quantityInputTouchable: {
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  quantityInputText: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
  },
  quantityInputPlaceholder: {
    color: Colors.outline,
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
