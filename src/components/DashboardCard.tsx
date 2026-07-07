import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { CustomIcon } from './CustomIcon';
import { ScalePressable } from './ScalePressable';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';

interface DashboardCardProps {
  title: string;
  icon: string;
  iconColor?: string;
  iconBgColor?: string;
  onPress: () => void;
}

export function DashboardCard({
  title,
  icon,
  iconColor = Colors.primary,
  iconBgColor = 'rgba(30, 58, 138, 0.1)',
  onPress,
}: DashboardCardProps) {
  return (
    <ScalePressable
      style={styles.card}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <CustomIcon name={icon} size={28} color={iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    padding: Spacing.cardPadding,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    width: '100%',
    ...Shadow.card,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    textAlign: 'center',
  },
});
