import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { getOrderDetail, getSupplierOrderDetail, Order, OrderLine } from '../services/orders';
import { getStockByBarcode } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useBarcode } from '../hooks/useBarcode';
import { FeedbackService } from '../services/feedback';

export function OrderDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orderId, supplierId, supplierName } = route.params || {};
  const [detail, setDetail] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [barcode, setBarcode] = useState('');
  
  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<OrderLine | null>(null);
  const [qtyInput, setQtyInput] = useState('');

  const showToast = useUIStore((s) => s.showToast);
  const showErrorLock = useUIStore((s) => s.showErrorLock);

  const fetchDetail = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = supplierId
        ? await getSupplierOrderDetail(orderId, supplierId)
        : await getOrderDetail(orderId);
      setDetail(data);
      if (data.lines) {
        // İlk yüklemede pickedQty 0 başlasın
        setLines(data.lines.map(line => ({ ...line, pickedQty: 0, isPicked: false })));
      }
    } catch {
      showToast({ message: 'Sipariş detayı yüklenemedi', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [orderId, supplierId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleScan = async (scannedCode: string) => {
    if (!lines || lines.length === 0) return;
    
    // 1. Önce yerel olarak Sipariş kalemlerinde ara
    let matchedIndex = lines.findIndex(l => l.stockCode === scannedCode || l.stockId.toString() === scannedCode);
    
    // 2. Yerelde bulunamazsa, API'den (barkod/karekod sorgusu) ara
    if (matchedIndex === -1) {
      try {
        const stockData = await getStockByBarcode(scannedCode);
        if (stockData && stockData.stockCode) {
          matchedIndex = lines.findIndex(l => l.stockCode === stockData.stockCode);
        }
      } catch (err) {
        // API hatası durumunda devam et, altta bulunamadı uyarısı verilecek
      }
    }
    
    if (matchedIndex !== -1) {
      const line = lines[matchedIndex];
      setSelectedLine(line);
      setQtyInput(line.pickedQty ? String(line.pickedQty) : '');
      setShowModal(true);
      FeedbackService.playSuccess();
    } else {
      FeedbackService.playError();
      showErrorLock('Okuttuğunuz ürün bu tedarikçinin sipariş kalemlerinde bulunamadı!');
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

  const handleSaveQty = () => {
    if (!selectedLine) return;
    const parsedQty = parseInt(qtyInput, 10);
    const finalQty = isNaN(parsedQty) || parsedQty < 0 ? 0 : parsedQty;
    
    const updatedLines = lines.map(line => {
      if (line.id === selectedLine.id) {
        return {
          ...line,
          pickedQty: finalQty,
          isPicked: finalQty === line.quantity
        };
      }
      return line;
    });
    
    setLines(updatedLines);
    setShowModal(false);
    FeedbackService.playSuccess();
    showToast({ 
      message: `${selectedLine.stockName} miktarı güncellendi: ${finalQty}/${selectedLine.quantity}`, 
      type: 'success' 
    });
  };

  const totalRequired = lines.reduce((acc, l) => acc + l.quantity, 0);
  const totalPicked = lines.reduce((acc, l) => acc + (l.pickedQty || 0), 0);
  const isComplete = totalRequired > 0 && totalPicked === totalRequired;

  const getCardStyle = (item: OrderLine) => {
    const picked = item.pickedQty || 0;
    const required = item.quantity;
    
    if (picked === 0) {
      return styles.productCard;
    }
    if (picked < required) {
      return [styles.productCard, styles.productCardUnder];
    }
    if (picked > required) {
      return [styles.productCard, styles.productCardOver];
    }
    return [styles.productCard, styles.productCardMatch];
  };

  const getStatusIconInfo = (item: OrderLine) => {
    const picked = item.pickedQty || 0;
    const required = item.quantity;
    
    if (picked === 0) {
      return { name: "package-variant-closed" as const, color: Colors.primary };
    }
    if (picked < required) {
      return { name: "minus-circle-outline" as const, color: Colors.error };
    }
    if (picked > required) {
      return { name: "plus-circle-outline" as const, color: Colors.warning };
    }
    return { name: "check-circle" as const, color: Colors.success };
  };

  const getQtyPickedStyle = (item: OrderLine) => {
    const picked = item.pickedQty || 0;
    const required = item.quantity;
    
    if (picked === 0) {
      return styles.qtyPicked;
    }
    if (picked < required) {
      return [styles.qtyPicked, { color: Colors.error }];
    }
    if (picked > required) {
      return [styles.qtyPicked, { color: Colors.warning }];
    }
    return [styles.qtyPicked, { color: Colors.success }];
  };

  const renderItem = ({ item }: { item: OrderLine }) => {
    const iconInfo = getStatusIconInfo(item);
    
    return (
      <TouchableOpacity 
        style={getCardStyle(item)}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedLine(item);
          setQtyInput(item.pickedQty ? String(item.pickedQty) : '');
          setShowModal(true);
        }}
      >
        <View style={styles.productIconBox}>
          <MaterialCommunityIcons 
            name={iconInfo.name} 
            size={24} 
            color={iconInfo.color} 
          />
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productCode}>{item.stockCode}</Text>
          <Text style={styles.productName}>{item.stockName}</Text>
        </View>
        <View style={styles.qtyBox}>
          <Text style={getQtyPickedStyle(item)}>
            {item.pickedQty || 0}
          </Text>
          <Text style={styles.qtyTotal}> / {item.quantity}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TopAppBar
        title={detail ? `Sipariş: ${detail.documentNo}` : "Sipariş Detayı"}
        onBack={() => navigation.goBack()}
        showBack={true}
      />

      {/* Progress & Scan Area */}
      <View style={styles.headerArea}>
        {(supplierName || detail?.partnerName) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, backgroundColor: Colors.background, padding: 8, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.outlineVariant }}>
            <MaterialCommunityIcons name="storefront" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={{ ...Typography.labelMd, color: Colors.onSurface, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              Tedarikçi: {supplierName || detail?.partnerName}
            </Text>
          </View>
        ) : null}
        <View style={styles.progressRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.progressLabel}>Toplama Durumu</Text>
            <Text style={styles.progressValue}>{totalPicked} / {totalRequired} Ürün</Text>
          </View>
          <View style={[styles.statusBadge, isComplete && styles.statusBadgeComplete]}>
            <Text style={[styles.statusText, isComplete && styles.statusTextComplete]}>
              {isComplete ? 'TAMAMLANDI' : 'DEVAM EDİYOR'}
            </Text>
          </View>
        </View>

        <View style={styles.scanRow}>
          <TextInput
            style={styles.barcodeInput}
            placeholder="Ürün barkodunu okutun..."
            placeholderTextColor={Colors.outline}
            value={barcode}
            onChangeText={setBarcode}
            onSubmitEditing={() => { if (barcode.trim()) handleScan(barcode.trim()); }}
            returnKeyType="search"
            showSoftInputOnFocus={false}
          />
        </View>
      </View>

      <FlatList
        data={lines}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchDetail}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          !refreshing ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <MaterialCommunityIcons name="clipboard-alert-outline" size={48} color={Colors.outline} />
              <Text style={{ marginTop: 10, color: Colors.outline }}>Bu siparişte kalem bulunmuyor.</Text>
            </View>
          ) : null
        }
      />

      {/* Miktar Düzenleme Modali */}
      <Modal visible={showModal} animationType="fade" transparent={true} onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Miktar Girin</Text>
            {selectedLine && (
              <View style={styles.modalProductInfo}>
                <Text style={styles.modalProductCode}>{selectedLine.stockCode}</Text>
                <Text style={styles.modalProductName}>{selectedLine.stockName}</Text>
                <Text style={styles.modalProductMeta}>
                  Sipariş Miktarı: <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{selectedLine.quantity}</Text> {selectedLine.unit || 'Adet'}
                </Text>
              </View>
            )}
            
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={qtyInput}
              onChangeText={setQtyInput}
              autoFocus={true}
              placeholder="0"
              placeholderTextColor={Colors.outline}
              selectTextOnFocus={true}
              onSubmitEditing={handleSaveQty}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveButton} 
                onPress={handleSaveQty}
              >
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
  headerArea: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    ...Shadow.sm,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressLabel: {
    ...Typography.labelMd,
    color: Colors.outline,
  },
  progressValue: {
    ...Typography.titleLg,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
  },
  statusBadgeComplete: {
    backgroundColor: 'rgba(52, 168, 83, 0.1)',
  },
  statusText: {
    ...Typography.labelSm,
    color: Colors.primary,
  },
  statusTextComplete: {
    color: Colors.success,
  },
  scanRow: {
    flexDirection: 'row',
  },
  barcodeInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 56,
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: 40,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.sm,
  },
  productCardUnder: {
    backgroundColor: Colors.errorContainer,
    borderColor: Colors.error,
  },
  productCardOver: {
    backgroundColor: Colors.warningContainer,
    borderColor: Colors.warning,
  },
  productCardMatch: {
    backgroundColor: Colors.successContainer,
    borderColor: Colors.success,
  },
  productIconBox: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  productInfo: {
    flex: 1,
  },
  productCode: {
    ...Typography.labelSm,
    color: Colors.outline,
  },
  productName: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  qtyPicked: {
    ...Typography.titleLg,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  qtyTotal: {
    ...Typography.bodyMd,
    color: Colors.outline,
    marginLeft: 2,
  },
  // Modal Styles
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
    ...Shadow.card,
  },
  modalTitle: {
    ...Typography.titleLg,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: Spacing.md,
  },
  modalProductInfo: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  modalProductCode: {
    ...Typography.labelSm,
    color: Colors.outline,
    marginBottom: 2,
  },
  modalProductName: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
    fontWeight: '500',
    marginBottom: 6,
  },
  modalProductMeta: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
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
    justifyContent: 'center',
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
    justifyContent: 'center',
  },
  modalSaveText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  },
});
