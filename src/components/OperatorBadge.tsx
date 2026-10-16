import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CustomIcon } from './CustomIcon';
import { useOperatorStore } from '../store/operatorStore';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { OperatorSelectModal } from './OperatorSelectModal';

interface OperatorBadgeProps {
  compact?: boolean;
  style?: any;
}

export function OperatorBadge({ compact = false, style }: OperatorBadgeProps) {
  const { activeOperator } = useOperatorStore();
  const [modalVisible, setModalVisible] = useState(false);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name[0] || 'P').toUpperCase();
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          activeOperator ? styles.containerActive : styles.containerEmpty,
          compact && styles.containerCompact,
          style,
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <View style={styles.leftContent}>
          {activeOperator ? (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(activeOperator.fullName)}</Text>
            </View>
          ) : (
            <View style={styles.avatarEmpty}>
              <CustomIcon name="account-alert" size={18} color="#d97706" />
            </View>
          )}

          <View style={styles.infoCol}>
            <View style={styles.titleRow}>
              <Text style={styles.label}>Depocu / Operatör</Text>
            </View>
            <Text
              style={[
                styles.nameText,
                !activeOperator && styles.nameTextEmpty,
              ]}
              numberOfLines={1}
            >
              {activeOperator ? activeOperator.fullName : 'Personel Seçiniz (Dokunun)'}
            </Text>
          </View>
        </View>

        <View style={styles.switchButton}>
          <Text style={styles.switchText}>Değiştir</Text>
          <CustomIcon name="chevron-down" size={16} color={Colors.primary} />
        </View>
      </TouchableOpacity>

      <OperatorSelectModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...Shadow.card,
  },
  containerActive: {
    backgroundColor: '#f0f7ff',
    borderColor: '#bfdbfe',
  },
  containerEmpty: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  containerCompact: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  avatarEmpty: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeTag: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  codeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1',
  },
  nameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
  nameTextEmpty: {
    color: '#b45309',
    fontWeight: '600',
    fontSize: 13,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  switchText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
});
