import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { useUIStore } from '../store/uiStore';

/** Toast Bildirimi */
export function Toast() {
  const { toast, hideToast } = useUIStore();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [toast]);

  if (!toast) return null;

  const iconMap = {
    success: 'check-circle' as const,
    error: 'alert-circle' as const,
    info: 'information' as const,
  };

  const colorMap = {
    success: Colors.confirmedText,
    error: Colors.error,
    info: Colors.primary,
  };

  const bgMap = {
    success: Colors.confirmedBg,
    error: Colors.errorContainer,
    info: Colors.primaryFixed,
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgMap[toast.type],
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={iconMap[toast.type]}
        size={20}
        color={colorMap[toast.type]}
      />
      <Text style={[styles.message, { color: colorMap[toast.type] }]}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

/** Loading Overlay */
export function LoadingOverlay() {
  const { isLoading, loadingMessage } = useUIStore();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isLoading ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <View style={styles.loadingBox}>
        <MaterialCommunityIcons name="loading" size={32} color={Colors.primary} />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </View>
    </Animated.View>
  );
}

/** Boş Liste Durumu */
interface EmptyStateProps {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({
  icon = 'package-variant',
  title,
  subtitle,
}: EmptyStateProps) {
  return (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name={icon}
        size={64}
        color={Colors.outlineVariant}
      />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Toast
  container: {
    position: 'absolute',
    top: 60,
    left: Spacing.marginMobile,
    right: Spacing.marginMobile,
    borderRadius: BorderRadius.md,
    padding: Spacing.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    zIndex: 999,
    elevation: 10,
  },
  message: {
    ...Typography.labelLg,
    flex: 1,
  },
  // Loading
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 998,
  },
  loadingBox: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.bodyMd,
    color: Colors.outline,
    textAlign: 'center',
  },
});
