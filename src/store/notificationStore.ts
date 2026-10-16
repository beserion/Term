import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { FeedbackService } from '../services/feedback';
import * as Haptics from 'expo-haptics';

export type NotificationType =
  | 'RECEIPT_COMPLETED'    // Mal Kabul Tamamlandı -> Paketlemeye haber verir
  | 'PACKING_READY'        // Paketlemeye Hazır
  | 'PACKING_COMPLETED'    // Paketleme Tamamlandı -> Sorumluya ve sevkiyata haber verir
  | 'SUBSTITUTION_ALERT'   // Muadil / Eksik ürün talebi
  | 'INFO';                // Genel bilgilendirme

export interface WMSNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: number;
  documentNo?: string;         // Örn: ORD-2026-00148
  rfqNo?: string;             // Örn: RFQ-2026-0589
  supplierId?: number;        // Örn: 940 (ESEN SOĞUTMA)
  supplierName?: string;      // Örn: ESEN SOĞUTMA
  responsiblePerson?: string; // Örn: Göksel Zaman
  targetRole: 'PACKING' | 'RECEIVING' | 'RESPONSIBLE' | 'ALL';
  createdAt: string;          // ISO Date
  isRead: boolean;
}

const STORAGE_KEY = '@wms_terminal_notifications_v1';

interface NotificationState {
  notifications: WMSNotification[];
  unreadCount: number;
  isLoading: boolean;
  loadNotifications: () => Promise<void>;
  addNotification: (
    item: Omit<WMSNotification, 'id' | 'createdAt' | 'isRead'>
  ) => Promise<WMSNotification>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  loadNotifications: async () => {
    try {
      set({ isLoading: true });
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        let list: WMSNotification[] = [];
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            list = parsed;
          }
        } catch {
          list = [];
        }
        const unread = list.filter((n) => n && !n.isRead).length;
        set({ notifications: list, unreadCount: unread });
      } else {
        set({ notifications: [], unreadCount: 0 });
      }
    } catch (e) {
      console.warn('Bildirimler yüklenemedi:', e);
      set({ notifications: [], unreadCount: 0 });
    } finally {
      set({ isLoading: false });
    }
  },

  addNotification: async (item) => {
    const newNotif: WMSNotification = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    const current = Array.isArray(get().notifications) ? get().notifications : [];
    const updated = [newNotif, ...current].slice(0, 50); // Son 50 bildirimi sakla
    const unread = updated.filter((n) => n && !n.isRead).length;

    set({ notifications: updated, unreadCount: unread });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});

    // Sesli uyarı ve titreşim
    try {
      FeedbackService.playSuccess();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // ignore
    }

    return newNotif;
  },

  markAsRead: async (id: string) => {
    const current = Array.isArray(get().notifications) ? get().notifications : [];
    const updated = current.map((n) =>
      n && n.id === id ? { ...n, isRead: true } : n
    );
    const unread = updated.filter((n) => n && !n.isRead).length;
    set({ notifications: updated, unreadCount: unread });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
  },

  markAllAsRead: async () => {
    const current = Array.isArray(get().notifications) ? get().notifications : [];
    const updated = current.map((n) => (n ? { ...n, isRead: true } : n));
    set({ notifications: updated, unreadCount: 0 });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
  },

  clearNotifications: async () => {
    set({ notifications: [], unreadCount: 0 });
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));
