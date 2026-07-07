import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Shimmer } from '../Shimmer';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';

export function TaskCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Shimmer width={24} height={24} borderRadius={12} />
          <Shimmer width="60%" height={20} borderRadius={4} />
        </View>
        <Shimmer width={65} height={20} borderRadius={4} />
      </View>
      <View style={styles.description}>
        <Shimmer width="100%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
        <Shimmer width="80%" height={16} borderRadius={4} />
      </View>
      <View style={styles.footer}>
        <Shimmer width="35%" height={14} borderRadius={4} />
        <Shimmer width="20%" height={14} borderRadius={4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  description: {
    marginVertical: Spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
