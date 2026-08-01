import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { CustomIcon } from './CustomIcon';
import { Colors, Typography, Spacing, Shadow } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TopAppBarProps {
  title: string;
  onBack?: () => void;
  onAction?: () => void;
  actionIcon?: string;
  showBack?: boolean;
}

export function TopAppBar({
  title,
  onBack,
  onAction,
  actionIcon = 'account',
  showBack = true,
}: TopAppBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      <View style={[styles.container, { paddingTop: insets.top, height: 56 + insets.top }]}>
        {showBack && onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.iconButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <CustomIcon
              name="arrow-left"
              size={24}
              color={Colors.primary}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {onAction ? (
          <TouchableOpacity
            onPress={onAction}
            style={styles.iconButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <CustomIcon
              name={actionIcon}
              size={24}
              color={Colors.primary}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.marginMobile,
    backgroundColor: Colors.surface,
    ...Shadow.sm,
    zIndex: 50,
  },
  title: {
    ...Typography.headlineSm,
    color: Colors.primary,
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    width: Spacing.touchTargetMin,
    height: Spacing.touchTargetMin,
    borderRadius: Spacing.touchTargetMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholder: {
    width: Spacing.touchTargetMin,
    height: Spacing.touchTargetMin,
  },
});
