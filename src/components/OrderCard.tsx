import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { CustomIcon } from './CustomIcon';
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
          <CustomIcon
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
    borderRadius: BorderRadius.xs,
    padding: 8,
    ...Shadow.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  orderNo: {
    ...Typography.dataMono,
    fontSize: 13,
    color: Colors.onSurface,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  companyName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.onSurfaceVariant,
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHighest,
  },
  meta: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    flex: 1,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    fontSize: 11,
    color: Colors.outline,
  },
});
