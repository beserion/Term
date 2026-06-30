import React, { useRef, useEffect } from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography, Spacing } from '../theme';

interface FilterChipsProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function FilterChips({ items, selectedIndex, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scroll}
    >
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        return (
          <TouchableOpacity
            key={index}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelect(index)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  container: {
    paddingHorizontal: Spacing.marginMobile,
    paddingBottom: Spacing.sm,
    gap: Spacing.stackGap,
  },
  chip: {
    minHeight: Spacing.touchTargetMin,
    paddingHorizontal: 24,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: Colors.primaryContainer,
    borderColor: Colors.primaryContainer,
  },
  chipText: {
    ...Typography.labelLg,
    color: Colors.onSurface,
  },
  chipTextSelected: {
    color: Colors.onPrimaryContainer,
  },
});
