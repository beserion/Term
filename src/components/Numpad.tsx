import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TouchableWithoutFeedback } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';

interface NumpadProps {
  visible: boolean;
  onClose: () => void;
  onType: (val: string) => void;
  onDelete: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitColor?: string;
}

export function Numpad({ visible, onClose, onType, onDelete, onSubmit, submitLabel = 'TAMAM', submitColor = Colors.primary }: NumpadProps) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'DEL']
  ];

  const handlePress = (key: string) => {
    if (key === 'DEL') {
      onDelete();
    } else {
      onType(key);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>
      <View style={styles.container}>
        {/* Kapatma Çubuğu / Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>
        <View style={styles.grid}>
          {keys.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={styles.key}
                  onPress={() => handlePress(key)}
                  activeOpacity={0.6}
                >
                  {key === 'DEL' ? (
                    <MaterialCommunityIcons name="backspace-outline" size={28} color={Colors.error} />
                  ) : (
                    <Text style={styles.keyText}>{key}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
        {onSubmit && (
          <TouchableOpacity 
            style={[styles.submitButton, { backgroundColor: submitColor }]} 
            onPress={() => {
              onSubmit();
              onClose();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.submitText}>{submitLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  container: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xl, // iOS home indicator vs için extra boşluk
    paddingTop: Spacing.sm,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    ...Shadow.md,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.outlineVariant,
    borderRadius: BorderRadius.full,
  },
  grid: {
    gap: Spacing.xs || 4,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.xs || 4,
  },
  key: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  keyText: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
  },
  submitButton: {
    marginTop: Spacing.xs || 4,
    height: 50,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.md,
  },
  submitText: {
    ...Typography.titleLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  }
});
