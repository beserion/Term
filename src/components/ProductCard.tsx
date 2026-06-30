import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';

/**
 * Sipariş Detay sayfasındaki ürün kartı
 * Ürün adı, istenilen miktar, Teslim Al / Sil butonları
 */

interface ProductCardProps {
  productName: string;
  requiredQuantity: number;
  status: string;
  onReceive: () => void;
  onDelete: () => void;
}

export function ProductCard({
  productName,
  requiredQuantity,
  status,
  onReceive,
  onDelete,
}: ProductCardProps) {
  return (
    <View style={styles.card}>
      {/* Üst: Ürün adı + Durum */}
      <View style={styles.topRow}>
        <Text style={styles.productName} numberOfLines={2}>
          {productName}
        </Text>
        <StatusBadge status={status} />
      </View>

      {/* Miktar */}
      <View style={styles.quantityRow}>
        <MaterialCommunityIcons
          name="package-variant"
          size={20}
          color={Colors.onSurfaceVariant}
        />
        <Text style={styles.quantityText}>
          İstenen Miktar:{' '}
          <Text style={styles.quantityValue}>{requiredQuantity}</Text>
        </Text>
      </View>

      {/* Butonlar */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.receiveButton}
          onPress={onReceive}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="check-circle" size={20} color={Colors.onPrimary} />
          <Text style={styles.receiveButtonText}>Teslim Al</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="delete" size={20} color={Colors.error} />
          <Text style={styles.deleteButtonText}>Sil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.cardPadding,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    ...Shadow.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.lg,
    marginBottom: Spacing.stackGap,
  },
  productName: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    flex: 1,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  quantityText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  quantityValue: {
    ...Typography.dataMono,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.stackGap,
    marginTop: Spacing.sm,
  },
  receiveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xs,
    minHeight: Spacing.touchTargetMin,
  },
  receiveButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: BorderRadius.xs,
    minHeight: Spacing.touchTargetMin,
  },
  deleteButtonText: {
    ...Typography.labelLg,
    color: Colors.error,
  },
});
