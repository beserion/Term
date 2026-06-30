import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { getTasks, updateTaskStatus, Task } from '../services/tasks';
import { useUIStore } from '../store/uiStore';
import { EmptyState } from '../components/Toast';

export function TasksScreen() {
  const navigation = useNavigation<any>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const showToast = useUIStore((s) => s.showToast);
  
  // Modal states
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      showToast({ message: 'Görevler yüklenemedi', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleUpdateStatus = async (newStatus: 'InProgress' | 'Completed') => {
    if (!selectedTask) return;
    try {
      await updateTaskStatus(selectedTask.id, newStatus);
      showToast({ message: 'Görev durumu güncellendi', type: 'success' });
      setModalVisible(false);
      fetchTasks();
    } catch (err) {
      showToast({ message: 'Hata oluştu', type: 'error' });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return Colors.error;
      case 'Medium': return Colors.warning;
      default: return Colors.success;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending': return 'Bekliyor';
      case 'InProgress': return 'Devam Ediyor';
      case 'Completed': return 'Tamamlandı';
      default: return status;
    }
  };

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity 
      style={styles.taskCard}
      onPress={() => {
        setSelectedTask(item);
        setModalVisible(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons 
            name={item.status === 'Completed' ? 'check-circle' : 'clipboard-text-outline'} 
            size={24} 
            color={item.status === 'Completed' ? Colors.success : Colors.primary} 
          />
          <Text style={styles.taskTitle}>{item.title}</Text>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) + '20' }]}>
          <Text style={[styles.priorityText, { color: getPriorityColor(item.priority) }]}>
            {item.priority.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.taskDescription} numberOfLines={2}>{item.description}</Text>
      
      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>
          {new Date(item.createdAt).toLocaleDateString('tr-TR')} {new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={[styles.statusText, item.status === 'InProgress' && { color: Colors.warning }]}>
          {getStatusLabel(item.status)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TopAppBar title="Görevler ve Talepler" onBack={() => navigation.goBack()} showBack={true} />

      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchTasks} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          !refreshing ? (
            <EmptyState icon="clipboard-check-outline" title="Görev Yok" subtitle="Şu an için atanmış bir göreviniz bulunmuyor." />
          ) : null
        }
      />

      {/* Görev Detay Modalı */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTask && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedTask.title}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                    <MaterialCommunityIcons name="close" size={24} color={Colors.onSurface} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Öncelik:</Text>
                    <Text style={[styles.detailValue, { color: getPriorityColor(selectedTask.priority), fontWeight: 'bold' }]}>
                      {selectedTask.priority}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Durum:</Text>
                    <Text style={styles.detailValue}>{getStatusLabel(selectedTask.status)}</Text>
                  </View>
                  {selectedTask.relatedBarcode && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>İlgili Ürün/Barkod:</Text>
                      <Text style={styles.detailValue}>{selectedTask.relatedBarcode}</Text>
                    </View>
                  )}
                  
                  <Text style={styles.descriptionLabel}>Görev Detayı:</Text>
                  <Text style={styles.fullDescription}>{selectedTask.description}</Text>
                </View>

                <View style={styles.modalActions}>
                  {selectedTask.status === 'Pending' && (
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: Colors.warning }]}
                      onPress={() => handleUpdateStatus('InProgress')}
                    >
                      <MaterialCommunityIcons name="play-circle-outline" size={20} color={Colors.onWarning || '#fff'} style={{ marginRight: 8 }}/>
                      <Text style={[styles.actionBtnText, { color: Colors.onWarning || '#fff' }]}>Görevi Başlat</Text>
                    </TouchableOpacity>
                  )}
                  
                  {selectedTask.status !== 'Completed' && (
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: Colors.success, marginTop: Spacing.sm }]}
                      onPress={() => handleUpdateStatus('Completed')}
                    >
                      <MaterialCommunityIcons name="check-circle-outline" size={20} color={Colors.onSuccess || '#fff'} style={{ marginRight: 8 }}/>
                      <Text style={[styles.actionBtnText, { color: Colors.onSuccess || '#fff' }]}>Tamamlandı İşaretle</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  taskCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  taskTitle: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  priorityText: {
    ...Typography.labelSm,
    fontWeight: 'bold',
  },
  taskDescription: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
    paddingTop: Spacing.sm,
  },
  dateText: {
    ...Typography.labelSm,
    color: Colors.outline,
  },
  statusText: {
    ...Typography.labelMd,
    color: Colors.primary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.titleLg,
    color: Colors.onSurface,
    flex: 1,
    marginRight: Spacing.md,
  },
  closeButton: {
    padding: Spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
  },
  modalBody: {
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    paddingBottom: Spacing.sm,
  },
  detailLabel: {
    ...Typography.bodyLg,
    color: Colors.onSurfaceVariant,
  },
  detailValue: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  descriptionLabel: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  fullDescription: {
    ...Typography.bodyLg,
    color: Colors.onSurfaceVariant,
    lineHeight: 24,
  },
  modalActions: {
    marginTop: Spacing.xl,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadow.sm,
  },
  actionBtnText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  }
});
