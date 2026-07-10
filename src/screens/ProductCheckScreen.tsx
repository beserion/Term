import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { getStockByBarcode, Stock } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { FeedbackService } from '../services/feedback';

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
      FeedbackService.playLightImpact();
    } catch {
      showToast({ message: 'Barkod bulunamadı: ' + barcode, type: 'error' });
      setProduct(null);
      FeedbackService.playError();
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
            <CustomIcon name="magnify" size={24} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Sonuç Kartı */}
        {product && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              {/* Ürün Görseli */}
              <View style={styles.imageContainer}>
                {product.photo || product.imageUrl ? (
                  <Image
                    source={{ uri: product.photo || product.imageUrl }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <CustomIcon name="package-variant" size={28} color={Colors.outline} />
                  </View>
                )}
              </View>

              <View style={{ flex: 1, justifyContent: 'center' }}>
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
                  <CustomIcon name="package-variant" size={32} color={Colors.outlineVariant} />
                </View>
              </View>
            </View>

            {/* Stok Güncelle Butonu */}
            <TouchableOpacity
              style={styles.updateButton}
              activeOpacity={0.8}
              onPress={() => {
                navigation.navigate('StockIncrease', { product });
                setProduct(null);
              }}
            >
              <CustomIcon name="pencil-box-outline" size={20} color={Colors.onPrimary} />
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
    padding: 8,
    paddingBottom: 40,
    gap: 8,
  },

  // Manual Input
  manualInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  manualInput: {
    flex: 1,
    height: 38,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    fontSize: 13,
    color: Colors.onSurface,
  },
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Result Card
  resultCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadow.card,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  imageContainer: {
    marginRight: 10,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  productName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: 2,
  },
  productCompany: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  verifiedText: {
    ...Typography.labelSm,
    color: Colors.onPrimaryFixedVariant,
  },
  // Data Grid
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  dataCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 6,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  dataCellFull: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 6,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  dataCellLabel: {
    fontSize: 9,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  dataCellValue: {
    fontSize: 13,
    fontFamily: Typography.dataMono.fontFamily,
    color: Colors.onSurface,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockValue: {
    fontSize: 16,
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
    minHeight: 38,
  },
  updateButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
});
