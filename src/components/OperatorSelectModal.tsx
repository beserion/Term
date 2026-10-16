import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { CustomIcon } from './CustomIcon';
import { SearchBar } from './SearchBar';
import { useOperatorStore, WarehouseOperator } from '../store/operatorStore';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useUIStore } from '../store/uiStore';
import { FeedbackService } from '../services/feedback';

interface OperatorSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect?: (operator: WarehouseOperator) => void;
}

export function OperatorSelectModal({ visible, onClose, onSelect }: OperatorSelectModalProps) {
  const { operators, activeOperator, isLoading, loadOperators, setActiveOperator } = useOperatorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    if (visible) {
      loadOperators();
    }
  }, [visible, loadOperators]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadOperators(true);
      showToast({ message: 'Personel listesi güncellendi', type: 'success' });
    } catch {
      showToast({ message: 'Personel listesi yenilenemedi', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const filteredOperators = operators.filter((op) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const name = (op.fullName || '').toLowerCase();
    const code = (op.employeeCode || '').toLowerCase();
    const dept = (op.departmentName || '').toLowerCase();
    return name.includes(q) || code.includes(q) || dept.includes(q);
  });

  const handleSelect = (op: WarehouseOperator) => {
    FeedbackService.playSuccess();
    setActiveOperator(op);
    if (onSelect) {
      onSelect(op);
    }
    showToast({ message: `Operatör: ${op.fullName}`, type: 'success' });
    onClose();
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name[0] || 'P').toUpperCase();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconCircle}>
                <CustomIcon name="account-hard-hat" size={24} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.title}>Depo Personeli Seçimi</Text>
                <Text style={styles.subtitle}>
                  Depo Departmanı Personelleri ({operators.length} Kişi)
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <CustomIcon name="close" size={22} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="İsim, departman veya sicil no..."
            />
          </View>

          {/* List or Loading */}
          {isLoading && operators.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.infoText}>Veritabanından personel listesi alınıyor...</Text>
            </View>
          ) : filteredOperators.length === 0 ? (
            <View style={styles.centerContainer}>
              <CustomIcon name="account-search-outline" size={48} color={Colors.outlineVariant} />
              <Text style={styles.infoText}>Aranan kriterlere uygun personel bulunamadı</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
            >
              {filteredOperators.map((op) => {
                const isActive = activeOperator?.id === op.id;
                return (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.itemCard, isActive && styles.itemCardActive]}
                    onPress={() => handleSelect(op)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.avatarCircle, isActive && styles.avatarCircleActive]}>
                      <Text style={[styles.avatarText, isActive && styles.avatarTextActive]}>
                        {getInitials(op.fullName)}
                      </Text>
                    </View>

                    <View style={styles.itemInfo}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.itemName, isActive && styles.itemNameActive]}>
                          {op.fullName}
                        </Text>
                        {op.employeeCode ? (
                          <View style={styles.codeBadge}>
                            <CustomIcon name="barcode" size={12} color="#0369a1" />
                            <Text style={styles.codeText}>{op.employeeCode}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.deptRow}>
                        {op.departmentName ? (
                          <Text style={styles.deptText}>
                            🏢 {op.departmentName}
                          </Text>
                        ) : null}
                        {op.positionName ? (
                          <Text style={styles.positionText}>
                            • {op.positionName}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {isActive ? (
                      <View style={styles.activeCheckCircle}>
                        <CustomIcon name="check-bold" size={16} color="#ffffff" />
                      </View>
                    ) : (
                      <CustomIcon name="chevron-right" size={20} color={Colors.outlineVariant} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Footer Bar */}
          <View style={styles.footerBar}>
            <View style={styles.footerNote}>
              <CustomIcon name="qrcode-scan" size={16} color={Colors.primary} />
              <Text style={styles.footerNoteText}>
                İpucu: Barkod / kart okutarak anında operatör değiştirebilirsiniz.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    paddingBottom: Spacing.xl,
    ...Shadow.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryContainer + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  list: {
    maxHeight: 420,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.card,
  },
  itemCardActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 1.5,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarCircleActive: {
    backgroundColor: '#2563eb',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#334155',
  },
  avatarTextActive: {
    color: '#ffffff',
  },
  itemInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  itemName: {
    ...Typography.titleSmall,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  itemNameActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  deptText: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  positionText: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  activeCheckCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  infoText: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.sm,
  },
  footerBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: '#f0fdf4',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  footerNoteText: {
    fontSize: 12,
    color: '#166534',
    flex: 1,
    fontWeight: '500',
  },
});
