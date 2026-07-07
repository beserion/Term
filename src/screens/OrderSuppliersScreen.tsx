import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { getOrderSuppliers, OrderSupplier } from '../services/orders';
import { useUIStore } from '../store/uiStore';
import { EmptyState } from '../components/Toast';

export function OrderSuppliersScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orderId, documentNo } = route.params || {};
  
  const [suppliers, setSuppliers] = useState<OrderSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const showToast = useUIStore((s) => s.showToast);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOrderSuppliers(orderId);
      setSuppliers(data);
    } catch (error) {
      showToast({ message: 'Tedarikçi listesi yüklenemedi', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSuppliers();
  };

  const renderSupplier = ({ item }: { item: OrderSupplier }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('OrderDetail', {
          orderId,
          supplierId: item.partnerId,
          supplierName: item.partnerName,
          documentNo,
        })
      }
      activeOpacity={0.7}
    >
      <View style={styles.iconBox}>
        <CustomIcon name="storefront" size={24} color={Colors.primary} />
      </View>
      <View style={styles.info}>
        <Text style={styles.supplierName}>{item.partnerName}</Text>
        <Text style={styles.supplierMeta}>Cari ID: {item.partnerId}</Text>
      </View>
      <CustomIcon name="chevron-right" size={24} color={Colors.outline} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TopAppBar
        title={documentNo ? `Sipariş: ${documentNo}` : 'Tedarikçiler'}
        onBack={() => navigation.goBack()}
        showBack={true}
      />

      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>Tedarikçi Seçimi</Text>
        <Text style={styles.headerSubtitle}>
          Lütfen toplama yapacağınız tedarikçiyi seçiniz. Bu siparişe ait ürünler birden fazla tedarikçi tarafından temin edilebilmektedir.
        </Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={suppliers}
          renderItem={renderSupplier}
          keyExtractor={(item) => String(item.partnerId)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title="Tedarikçi bulunamadı"
              subtitle="Bu siparişe bağlı aktif bir tedarikçi kaydı bulunmuyor."
            />
          }
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
  headerInfo: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  headerTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    ...Typography.bodyMd,
    color: Colors.outline,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.sm,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  info: {
    flex: 1,
  },
  supplierName: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  supplierMeta: {
    ...Typography.labelSm,
    color: Colors.outline,
    marginTop: 2,
  },
});
