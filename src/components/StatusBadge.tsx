import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../theme';

/**
 * Durum Rozeti Bileşeni
 * Beklemede (sarı), Onaylandı (yeşil), Teslim Alındı (mavi)
 */

type StatusType = 'Pending' | 'Confirmed' | 'Received' | 'Cancelled' | string;

interface StatusBadgeProps {
  status: StatusType;
  small?: boolean;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  Pending: { bg: Colors.pendingBg, text: Colors.pendingText, label: 'Beklemede' },
  Confirmed: { bg: Colors.confirmedBg, text: Colors.confirmedText, label: 'Onaylandı' },
  Received: { bg: Colors.receivedBg, text: Colors.receivedText, label: 'Teslim Alındı' },
  Cancelled: { bg: Colors.errorContainer, text: Colors.onErrorContainer, label: 'İptal Edildi' },
  'In Transit': { bg: Colors.secondaryContainer, text: Colors.onSecondaryContainer, label: 'Yolda' },
  'Not Completed': { bg: Colors.surfaceContainerHigh, text: Colors.onSurfaceVariant, label: 'Tamamlanmadı' },
  'Awaiting Invoice': { bg: Colors.surfaceContainerHigh, text: Colors.onSurfaceVariant, label: 'Fatura Bekleniyor' },
  'Invoice Cleared': { bg: Colors.surfaceContainerHigh, text: Colors.onSurfaceVariant, label: 'Fatura Onaylandı' },
  'Pending Review': { bg: Colors.surfaceContainerHigh, text: Colors.onSurfaceVariant, label: 'İnceleme Bekleniyor' },
};

export function StatusBadge({ status, small = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    bg: Colors.surfaceContainerHigh,
    text: Colors.onSurfaceVariant,
    label: status,
  };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, small && styles.badgeSmall]}>
      <Text style={[
        small ? styles.textSmall : styles.text,
        { color: config.text },
      ]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    ...Typography.labelMd,
    fontWeight: '600',
  },
  textSmall: {
    ...Typography.labelMd,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
});
