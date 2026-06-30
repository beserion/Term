import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';

interface OrderCardProps {
  orderNo: string;
  companyName: string;
  status: string;
  itemCount: number;
  buyerName?: string;
  date: string;
  onPress: () => void;
}

export function OrderCard({
  orderNo,
  companyName,
  status,
  itemCount,
  buyerName,
  date,
  onPress,
}: OrderCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Üst satır: Sipariş No + Durum */}
      <View style={styles.topRow}>
        <Text style={styles.orderNo}>{orderNo}</Text>
        <StatusBadge status={status} />
      </View>

      {/* Firma adı */}
      <Text style={styles.companyName}>{companyName}</Text>

      {/* Alt satır: Kalem sayısı, alıcı, tarih */}
      <View style={styles.bottomRow}>
        <Text style={styles.meta}>
          {itemCount} kalem
          {buyerName ? ` • Alıcı: ${buyerName}` : ''}
        </Text>
        <View style={styles.dateContainer}>
          <MaterialCommunityIcons
            name="calendar-month"
            size={14}
            color={Colors.outline}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.date}>{date}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    padding: Spacing.cardPadding,
    ...Shadow.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.stackGap,
  },
  orderNo: {
    ...Typography.dataMono,
    color: Colors.onSurface,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  companyName: {
    ...Typography.headlineSm,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.stackGap,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHighest,
  },
  meta: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    flex: 1,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    ...Typography.labelMd,
    color: Colors.outline,
  },
});
