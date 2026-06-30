import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';

interface DashboardCardProps {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
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
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <MaterialCommunityIcons name={icon} size={28} color={iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
    </TouchableOpacity>
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
