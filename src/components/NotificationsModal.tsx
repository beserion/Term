import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomIcon } from './CustomIcon';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useNotificationStore, WMSNotification } from '../store/notificationStore';
import { useNavigation } from '@react-navigation/native';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const navigation = useNavigation<any>();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } =
    useNotificationStore();

  const [activeTab, setActiveTab] = useState<'ALL' | 'PACKING' | 'RECEIVING'>('ALL');

  const safeList = Array.isArray(notifications) ? notifications : [];

  const filteredNotifications = safeList.filter((item) => {
    if (!item) return false;
    if (activeTab === 'PACKING') {
      return item.targetRole === 'PACKING' || item.type === 'RECEIPT_COMPLETED';
    }
    if (activeTab === 'RECEIVING') {
      return item.targetRole === 'RECEIVING' || item.type === 'PACKING_COMPLETED';
    }
    return true;
  });

  const handleNotificationPress = async (item: WMSNotification) => {
    try {
      if (item?.id) {
        await markAsRead(item.id);
      }
      onClose();

      // Derin Bağlantı (Deep Link) - İlgili ekrana yönlendirme
      if (item.type === 'RECEIPT_COMPLETED' || item.targetRole === 'PACKING') {
        if (item.orderId) {
          navigation.navigate('PackingSuppliers', {
            orderId: item.orderId,
            documentNo: item.documentNo,
            rfqNo: item.rfqNo,
            supplierId: item.supplierId,
            supplierName: item.supplierName,
          });
        } else {
          navigation.navigate('PackingList');
        }
      } else if (item.type === 'PACKING_COMPLETED') {
        navigation.navigate('PackingList');
      }
    } catch (err) {
      console.warn('Bildirim yönlendirme hatası:', err);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}.${month} ${hours}:${mins}`;
    } catch {
      return '';
    }
  };

  const renderItem = ({ item }: { item: WMSNotification }) => {
    if (!item) return null;
    const isUnread = !item.isRead;

    let iconName = 'bell-outline';
    let iconColor: string = Colors.primary;
    let badgeBg = '#E0F2FE';
    let badgeColor = '#0369A1';
    let typeLabel = 'BİLDİRİM';

    if (item.type === 'RECEIPT_COMPLETED') {
      iconName = 'truck-check';
      iconColor = '#059669';
      badgeBg = '#ECFDF5';
      badgeColor = '#047857';
      typeLabel = 'MAL KABUL EDİLDİ';
    } else if (item.type === 'PACKING_COMPLETED') {
      iconName = 'package-variant-closed-check';
      iconColor = '#2563EB';
      badgeBg = '#EFF6FF';
      badgeColor = '#1D4ED8';
      typeLabel = 'PAKETLENDİ';
    } else if (item.type === 'SUBSTITUTION_ALERT') {
      iconName = 'alert-decagram';
      iconColor = '#D97706';
      badgeBg = '#FEF3C7';
      badgeColor = '#B45309';
      typeLabel = 'MUADİL TALEBİ';
    }

    return (
      <TouchableOpacity
        style={[
          styles.notifCard,
          isUnread && styles.notifCardUnread,
        ]}
        activeOpacity={0.7}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.iconAndType}>
            <View style={[styles.iconBox, { backgroundColor: badgeBg }]}>
              <CustomIcon name={iconName} size={20} color={iconColor} />
            </View>
            <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.typeBadgeText, { color: badgeColor }]}>{typeLabel}</Text>
            </View>
          </View>
          <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
        </View>

        <Text style={[styles.notifTitle, isUnread && styles.notifTitleBold]}>
          {item.title}
        </Text>
        <Text style={styles.notifMessage}>{item.message}</Text>

        {/* Sipariş, Tedarikçi ve Sorumlu Etiketleri */}
        <View style={styles.tagsContainer}>
          {item.documentNo ? (
            <View style={styles.tagItem}>
              <CustomIcon name="file-document-outline" size={13} color={Colors.primary} />
              <Text style={styles.tagText}>{item.documentNo}</Text>
            </View>
          ) : null}

          {item.supplierName ? (
            <View style={styles.tagItem}>
              <CustomIcon name="storefront-outline" size={13} color={Colors.secondary} />
              <Text style={styles.tagText} numberOfLines={1}>{item.supplierName}</Text>
            </View>
          ) : null}

          {item.responsiblePerson ? (
            <View style={[styles.tagItem, styles.responsibleTag]}>
              <CustomIcon name="account-tie" size={13} color="#4338CA" />
              <Text style={styles.responsibleTagText}>Sorumlu: {item.responsiblePerson}</Text>
            </View>
          ) : null}
        </View>

        {/* Tıklama Yönlendirmesi */}
        <View style={styles.actionRow}>
          <Text style={styles.actionText}>
            {item.type === 'RECEIPT_COMPLETED' ? 'Paketleme Ekranına Git' : 'Detayı İncele'}
          </Text>
          <CustomIcon name="chevron-right" size={16} color={Colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
          {/* Üst Bar */}
          <View style={styles.topBar}>
            <View style={styles.titleWrapper}>
              <View style={styles.bellIconContainer}>
                <CustomIcon name="bell-ring" size={24} color={Colors.primary} />
                {unreadCount > 0 ? (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{unreadCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.topTitle}>Bildirim Merkezi</Text>
            </View>

            <View style={styles.topActions}>
              {unreadCount > 0 ? (
                <TouchableOpacity
                  style={styles.markAllButton}
                  onPress={markAllAsRead}
                  activeOpacity={0.7}
                >
                  <Text style={styles.markAllText}>Tümünü Oku</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                <CustomIcon name="close" size={24} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sekme Filtreleri */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'ALL' && styles.tabButtonActive]}
              onPress={() => setActiveTab('ALL')}
            >
              <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
                Tümü ({safeList.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'PACKING' && styles.tabButtonActive]}
              onPress={() => setActiveTab('PACKING')}
            >
              <Text style={[styles.tabText, activeTab === 'PACKING' && styles.tabTextActive]}>
                Paketleme
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'RECEIVING' && styles.tabButtonActive]}
              onPress={() => setActiveTab('RECEIVING')}
            >
              <Text style={[styles.tabText, activeTab === 'RECEIVING' && styles.tabTextActive]}>
                Mal Kabul
              </Text>
            </TouchableOpacity>
          </View>

          {/* Liste */}
          <FlatList
            data={filteredNotifications}
            renderItem={renderItem}
            keyExtractor={(item, index) => item?.id || String(index)}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <CustomIcon name="bell-off-outline" size={48} color={Colors.outline} />
                <Text style={styles.emptyTitle}>Henüz Bildirim Yok</Text>
                <Text style={styles.emptySub}>
                  Mal kabul veya paketleme birimlerince tamamlanan işlemler burada listelenir.
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellIconContainer: {
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  topTitle: {
    ...Typography.titleMedium,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  markAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#E0F2FE',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  closeButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    gap: 8,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F1F5F9',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  listContent: {
    padding: Spacing.md,
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },
  notifCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.card,
  },
  notifCardUnread: {
    borderColor: '#93C5FD',
    backgroundColor: '#F0F9FF',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  iconAndType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 11,
    color: Colors.outline,
    fontWeight: '500',
  },
  notifTitle: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    marginBottom: 4,
  },
  notifTitleBold: {
    fontWeight: 'bold',
  },
  notifMessage: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  responsibleTag: {
    backgroundColor: '#EEF2FF',
  },
  responsibleTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4338CA',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    ...Typography.titleMedium,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginTop: 14,
    marginBottom: 6,
  },
  emptySub: {
    ...Typography.bodySm,
    color: Colors.outline,
    textAlign: 'center',
    lineHeight: 20,
  },
});
