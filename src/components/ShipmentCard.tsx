import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { CustomIcon } from './CustomIcon';
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
        <CustomIcon
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
    borderRadius: BorderRadius.xs,
    padding: 8,
    ...Shadow.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.onSurface,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  meta: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    flex: 1,
    marginRight: Spacing.sm,
  },
  date: {
    ...Typography.dataMono,
    fontSize: 10,
    color: Colors.onSurfaceVariant,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  itemChip: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  itemChipText: {
    fontSize: 9,
    color: Colors.onSurfaceVariant,
  },
});
