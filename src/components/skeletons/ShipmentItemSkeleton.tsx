import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Shimmer } from '../Shimmer';
import { Colors, Spacing, BorderRadius } from '../../theme';

export function ShipmentItemSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 6 }}>
          <Shimmer width="75%" height={18} borderRadius={4} />
          <Shimmer width="45%" height={14} borderRadius={4} />
        </View>
        <View style={styles.right}>
          <Shimmer width={60} height={16} borderRadius={4} style={{ marginBottom: 4 }} />
          <Shimmer width={18} height={18} borderRadius={9} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.sm,
    padding: Spacing.cardPadding,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  right: {
    alignItems: 'flex-end',
  },
});
