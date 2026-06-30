import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';

/**
 * Özet Kartı — Sipariş detayında toplam kalem/miktar gösterir
 */

interface SummaryCardProps {
  leftLabel: string;
  leftValue: string | number;
  rightLabel: string;
  rightValue: string | number;
}

export function SummaryCard({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: SummaryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.section}>
        <Text style={styles.label}>{leftLabel}</Text>
        <Text style={styles.value}>{leftValue}</Text>
      </View>

      <View style={styles.divider} />

      <View style={[styles.section, styles.sectionRight]}>
        <Text style={styles.label}>{rightLabel}</Text>
        <Text style={[styles.value, styles.valueHighlight]}>{rightValue}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    ...Shadow.sm,
  },
  section: {
    flex: 1,
    gap: 4,
  },
  sectionRight: {
    alignItems: 'flex-end',
  },
  label: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
  },
  valueHighlight: {
    color: Colors.primary,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.outlineVariant,
    marginHorizontal: Spacing.lg,
  },
});
