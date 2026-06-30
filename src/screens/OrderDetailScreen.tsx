import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, TextInput } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { getOrderDetail, Order, OrderLine } from '../services/orders';
import { useUIStore } from '../store/uiStore';
import { useBarcode } from '../hooks/useBarcode';
import { FeedbackService } from '../services/feedback';

export function OrderDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orderId } = route.params || {};
  const [detail, setDetail] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [barcode, setBarcode] = useState('');
  const showToast = useUIStore((s) => s.showToast);
  const showErrorLock = useUIStore((s) => s.showErrorLock);

  const fetchDetail = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getOrderDetail(orderId);
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
  }, [orderId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleScan = (scannedCode: string) => {
    if (!lines || lines.length === 0) return;
    
    // Okutulan barkodu Sipariş kalemlerinde ara
    const lineIndex = lines.findIndex(l => l.stockCode === scannedCode || l.stockId.toString() === scannedCode);
    
    if (lineIndex !== -1) {
      const line = lines[lineIndex];
      const newPicked = (line.pickedQty || 0) + 1;
      
      if (newPicked > line.quantity) {
        FeedbackService.playError();
        showErrorLock('Sipariş miktarını aştınız! Fazla ürün toplamaya çalışıyorsunuz.');
        return;
      }
      
      const newLines = [...lines];
      newLines[lineIndex] = {
        ...line,
        pickedQty: newPicked,
        isPicked: newPicked === line.quantity
      };
      
      setLines(newLines);
      FeedbackService.playSuccess();
      showToast({ message: `${line.stockName} toplandı (${newPicked}/${line.quantity})`, type: 'success' });
    } else {
      FeedbackService.playError();
      showErrorLock('Okuttuğunuz ürün siparişte bulunamadı!');
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

  const totalRequired = lines.reduce((acc, l) => acc + l.quantity, 0);
  const totalPicked = lines.reduce((acc, l) => acc + (l.pickedQty || 0), 0);
  const isComplete = totalRequired > 0 && totalPicked === totalRequired;

  const renderItem = ({ item }: { item: OrderLine }) => (
    <View style={[styles.productCard, item.isPicked && styles.productCardPicked]}>
      <View style={styles.productIconBox}>
        <MaterialCommunityIcons 
          name={item.isPicked ? "check-circle" : "package-variant-closed"} 
          size={24} 
          color={item.isPicked ? Colors.success : Colors.primary} 
        />
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productCode}>{item.stockCode}</Text>
        <Text style={styles.productName}>{item.stockName}</Text>
      </View>
      <View style={styles.qtyBox}>
        <Text style={[styles.qtyPicked, item.isPicked && { color: Colors.success }]}>
          {item.pickedQty || 0}
        </Text>
        <Text style={styles.qtyTotal}> / {item.quantity}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TopAppBar
        title={detail ? `Sipariş: ${detail.documentNo}` : "Sipariş Detayı"}
        onBack={() => navigation.goBack()}
        showBack={true}
      />

      {/* Progress & Scan Area */}
      <View style={styles.headerArea}>
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
  productCardPicked: {
    backgroundColor: 'rgba(52, 168, 83, 0.05)',
    borderColor: 'rgba(52, 168, 83, 0.3)',
  },
  productIconBox: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.background,
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
});
