import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, Stock } from '../services/inventory';
import { useUIStore } from '../store/uiStore';

export function ProductCheckScreen() {
  const navigation = useNavigation<any>();
  const [product, setProduct] = useState<Stock | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [scanning, setScanning] = useState(true);
  const showToast = useUIStore((s) => s.showToast);

  const handleScan = async (barcode: string) => {
    try {
      const data = await getStockByBarcode(barcode);
      if (!data || !data.id || data.id === 0) {
        throw new Error('Ürün bulunamadı');
      }
      setProduct(data);
    } catch {
      showToast({ message: 'Barkod bulunamadı: ' + barcode, type: 'error' });
      setProduct(null);
    }
  };

  // Zebra DataWedge dinle
  useBarcode(handleScan, scanning);

  const handleManualSearch = () => {
    if (manualBarcode.trim().length >= 4) {
      handleScan(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  useEffect(() => {
    if (manualBarcode.trim().length >= 4) {
      const timeout = setTimeout(() => {
        handleManualSearch();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [manualBarcode]);

  return (
    <View style={styles.container}>
      <TopAppBar title="Ürün Kontrol" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>


        {/* Manuel Giriş */}
        <View style={styles.manualInputRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="Manuel barkod girin..."
            placeholderTextColor={Colors.outline}
            value={manualBarcode}
            onChangeText={setManualBarcode}
            onSubmitEditing={handleManualSearch}
            returnKeyType="search"
            keyboardType="default"
            autoFocus={true}
            showSoftInputOnFocus={false}
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleManualSearch} activeOpacity={0.7}>
            <MaterialCommunityIcons name="magnify" size={24} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Sonuç Kartı */}
        {product && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{product.stockName}</Text>
              </View>
            </View>

            {/* Veri Grid */}
            <View style={styles.dataGrid}>
              <View style={styles.dataCell}>
                <Text style={styles.dataCellLabel}>STOK KODU</Text>
                <Text style={styles.dataCellValue}>{product.stockCode || '-'}</Text>
              </View>
              <View style={styles.dataCell}>
                <Text style={styles.dataCellLabel}>KONUM</Text>
                <Text style={styles.dataCellValue}>{product.shelfAddress || '-'}</Text>
              </View>
              <View style={styles.dataCellFull}>
                <View style={styles.stockRow}>
                  <View>
                    <Text style={styles.dataCellLabel}>KART MİKTARI</Text>
                    <Text style={styles.stockValue}>{product.qty || 0} {product.unit || 'Adet'}</Text>
                  </View>
                  <MaterialCommunityIcons name="package-variant" size={32} color={Colors.outlineVariant} />
                </View>
              </View>
            </View>

            {/* Stok Güncelle Butonu */}
            <TouchableOpacity
              style={styles.updateButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('StockIncrease', { product })}
            >
              <MaterialCommunityIcons name="pencil-box-outline" size={20} color={Colors.onPrimary} />
              <Text style={styles.updateButtonText}>Stok Güncelle</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.marginMobile,
    paddingBottom: 40,
    gap: Spacing.lg,
  },

  // Manual Input
  manualInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  manualInput: {
    flex: 1,
    height: Spacing.touchTargetMin,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.lg,
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  searchButton: {
    width: Spacing.touchTargetMin,
    height: Spacing.touchTargetMin,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Result Card
  resultCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    padding: Spacing.cardPadding,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadow.card,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  productName: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    marginBottom: 4,
  },
  productCompany: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  verifiedText: {
    ...Typography.labelMd,
    color: Colors.onPrimaryFixedVariant,
  },
  // Data Grid
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  dataCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  dataCellFull: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  dataCellLabel: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  dataCellValue: {
    ...Typography.dataMono,
    color: Colors.onSurface,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockValue: {
    ...Typography.headlineMd,
    color: Colors.primary,
    fontWeight: '700',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.sm,
    minHeight: Spacing.touchTargetMin,
  },
  updateButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  },
});
