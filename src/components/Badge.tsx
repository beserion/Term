import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { CustomIcon } from './CustomIcon';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

export type BadgeType = 'success' | 'warning' | 'error' | 'info' | 'primary';

interface BadgeProps {
  label: string;
  type?: BadgeType;
  icon?: string;
  style?: ViewStyle;
}

export function Badge({
  label,
  type = 'primary',
  icon,
  style,
}: BadgeProps) {
  const getStyles = () => {
    let backgroundColor = Colors.primaryFixed || '#dce1ff';
    let textColor = Colors.primary;
    let iconColor = Colors.primary;

    switch (type) {
      case 'success':
        backgroundColor = Colors.successContainer || 'rgba(16, 185, 129, 0.15)';
        textColor = Colors.confirmedText || Colors.success;
        iconColor = Colors.confirmedText || Colors.success;
        break;
      case 'warning':
        backgroundColor = Colors.warningContainer || 'rgba(245, 158, 11, 0.15)';
        textColor = Colors.pendingText || Colors.warning;
        iconColor = Colors.pendingText || Colors.warning;
        break;
      case 'error':
        backgroundColor = Colors.errorContainer || 'rgba(186, 26, 26, 0.15)';
        textColor = Colors.error;
        iconColor = Colors.error;
        break;
      case 'info':
        backgroundColor = Colors.secondaryContainer || 'rgba(80, 95, 118, 0.15)';
        textColor = Colors.onSecondaryContainer || Colors.secondary;
        iconColor = Colors.onSecondaryContainer || Colors.secondary;
        break;
      case 'primary':
      default:
        backgroundColor = Colors.primaryFixed || 'rgba(0, 35, 111, 0.15)';
        textColor = Colors.primary;
        iconColor = Colors.primary;
        break;
    }

    return { backgroundColor, textColor, iconColor };
  };

  const { backgroundColor, textColor, iconColor } = getStyles();

  return (
    <View style={[styles.badge, { backgroundColor }, style]}>
      {icon && (
        <CustomIcon
          name={icon}
          size={14}
          color={iconColor}
          style={styles.icon}
        />
      )}
      <Text style={[styles.text, { color: textColor }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    ...Typography.labelSm,
    fontWeight: 'bold',
  },
});
