import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';

interface ShipmentCardProps {
  title: string;
  type: string;
  assignedTo: string;
  date: string;
  statuses: string[];
  itemCount: number;
  linkedCount: number;
  onPress: () => void;
}

export function ShipmentCard({
  title,
  type,
  assignedTo,
  date,
  statuses,
  itemCount,
  linkedCount,
  onPress,
}: ShipmentCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Başlık + Chevron */}
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={Colors.outlineVariant}
        />
      </View>

      {/* Tip + Tarih */}
      <View style={styles.metaRow}>
        <Text style={styles.meta} numberOfLines={1}>
          {type} - {assignedTo}
        </Text>
        <Text style={styles.date}>{date}</Text>
      </View>

      {/* Durum chip'leri */}
      <View style={styles.chipRow}>
        {statuses.map((status, index) => (
          <StatusBadge key={index} status={status} small />
        ))}
        <View style={styles.itemChip}>
          <Text style={styles.itemChipText}>
            {itemCount} kalem - {linkedCount} bağlı
          </Text>
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
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  meta: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    flex: 1,
    marginRight: Spacing.sm,
  },
  date: {
    ...Typography.dataMono,
    color: Colors.onSurfaceVariant,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 4,
  },
  itemChip: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  itemChipText: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
  },
});
