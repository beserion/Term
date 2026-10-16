import * as signalR from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config';
import { useAuthStore } from '../store/authStore';
import { useOperatorStore } from '../store/operatorStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUIStore } from '../store/uiStore';
import { getActivePackingOrders, PackingOrder } from './packing';
import { FeedbackService } from './feedback';

export type TerminalUpdateEventType = 'task_assigned' | 'reload_tasks' | 'reload_warehouse' | 'notification' | 'polled_new_task' | 'substitution_resolved';

export interface TerminalUpdateEvent {
  type: TerminalUpdateEventType;
  data?: any;
}

type TerminalSubscriber = (event: TerminalUpdateEvent) => void;

class TerminalNotificationService {
  private hubConnection: signalR.HubConnection | null = null;
  private isConnecting = false;
  private pollerTimer: any = null;
  private subscribers: Set<TerminalSubscriber> = new Set();
  private knownAssignedOrderIds: Set<number> = new Set();
  private isPollerInitialized = false;

  /** Terminal güncellemelerine abone ol (Örn: PackingListScreen canlı liste yenileme) */
  subscribe(callback: TerminalSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(event: TerminalUpdateEvent) {
    this.subscribers.forEach((sub) => {
      try {
        sub(event);
      } catch (err) {
        console.warn('[TerminalNotification] Subscriber error:', err);
      }
    });
  }

  /** Servisi başlat (SignalR soketi + Akıllı yedek poller) */
  async start() {
    this.startSignalR();
    this.startPoller();
  }

  /** Servisi durdur */
  async stop() {
    this.stopPoller();
    await this.stopSignalR();
  }

  /** SignalR Bağlantısını Başlat */
  private async startSignalR() {
    if (this.hubConnection || this.isConnecting) return;
    this.isConnecting = true;

    try {
      const apiBase = await Config.getApiBaseUrl();
      // Örn: https://api.blackskyqore.com/api -> https://api.blackskyqore.com/notificationhub
      const hubUrl = `${apiBase.replace(/\/+api\/?$/i, '')}/notificationhub`;

      console.log(`[SignalR] 🌐 Bağlantı kuruluyor: ${hubUrl}`);

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: async () => {
            const token = await AsyncStorage.getItem(Config.STORAGE_KEYS.AUTH_TOKEN);
            return token || '';
          },
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      // 1. Yeni Görev Atandı Event'i (Web'den Sorumlu Ata dendiğinde gelir)
      connection.on('terminalNewTaskAssigned', async (data: any) => {
        console.log('[SignalR] 📥 terminalNewTaskAssigned:', data);
        await this.handleTaskAssignedEvent(data);
      });

      // 2. Terminal Görev Listesini Tazele Event'i
      connection.on('reloadTerminalTasks', () => {
        console.log('[SignalR] 🔄 reloadTerminalTasks alındı');
        this.notifySubscribers({ type: 'reload_tasks' });
      });

      // 3. Depo Takip Tablosu Güncellendi
      connection.on('reloadWarehouseTracking', () => {
        console.log('[SignalR] 🔄 reloadWarehouseTracking alındı');
        this.notifySubscribers({ type: 'reload_warehouse' });
      });

      // 4. Genel Sistem Bildirimi (Nesne veya çift parametre formatı)
      const onReceiveNotif = async (arg1: any, arg2?: any) => {
        let title = 'Sistem Bildirimi';
        let message = '';
        if (typeof arg1 === 'object' && arg1 !== null) {
          title = arg1.Title || arg1.title || 'Sistem Bildirimi';
          message = arg1.Message || arg1.message || '';
        } else {
          title = String(arg1 || 'Sistem Bildirimi');
          message = String(arg2 || '');
        }
        console.log('[SignalR] 🔔 receiveNotification:', title, message);
        await this.handleGenericNotification(title, message);
      };
      connection.on('receiveNotification', onReceiveNotif);
      connection.on('ReceiveNotification', onReceiveNotif);

      // 5. Muadil Ürün Onay/Red Event'i
      connection.on('terminalSubstitutionResolved', async (data: any) => {
        console.log('[SignalR] 🔔 terminalSubstitutionResolved:', data);
        await this.handleSubstitutionResolvedEvent(data);
      });

      connection.onreconnecting((error) => {
        console.warn('[SignalR] ⚠️ Yeniden bağlanıyor...', error?.message);
      });

      connection.onreconnected((connectionId) => {
        console.log('[SignalR] ✅ Yeniden bağlandı! ID:', connectionId);
        this.notifySubscribers({ type: 'reload_tasks' });
      });

      connection.onclose((error) => {
        console.warn('[SignalR] 🔌 Bağlantı kapandı:', error?.message);
        this.hubConnection = null;
      });

      await connection.start();
      console.log('[SignalR] 🚀 Başarıyla bağlandı! ConnectionId:', connection.connectionId);
      this.hubConnection = connection;
    } catch (err: any) {
      console.warn('[SignalR] ❌ Bağlantı başlatılamadı, poller devrede kalacak:', err?.message);
    } finally {
      this.isConnecting = false;
    }
  }

  private async stopSignalR() {
    if (this.hubConnection) {
      try {
        await this.hubConnection.stop();
        console.log('[SignalR] 🛑 Bağlantı durduruldu.');
      } catch (e) {
        // ignore
      } finally {
        this.hubConnection = null;
      }
    }
  }

  /** Gelen görev atama event'ini ses, titreşim, toast ve bildirim çekmecesine işle */
  private async handleTaskAssignedEvent(data: any) {
    const activeOp = useOperatorStore.getState().activeOperator;
    const assignedEmpId = data?.employeeId;
    const assignedEmpName = data?.employeeName || '';
    const reqNo = data?.requestNo || (data?.requestId ? `REQ-${data.requestId}` : 'Yeni Talep');
    const vessel = data?.vesselName ? ` (${data.vesselName})` : '';

    // Bana mı atandı yoksa genel havuza mı?
    const isAssignedToMe =
      activeOp &&
      (assignedEmpId === activeOp.id ||
        (assignedEmpName && assignedEmpName.toLowerCase().includes(activeOp.fullName.toLowerCase())));

    const title = isAssignedToMe ? 'Yeni Görev Size Atandı' : 'Depo Görevi Güncellendi';
    const message =
      data?.message ||
      (isAssignedToMe
        ? `${reqNo}${vessel} görevi üzerinize tanımlandı. İncelemek için dokunun.`
        : `${reqNo}${vessel} için görev güncellendi (${assignedEmpName || 'Personel'}).`);

    // 1. Bildirim Çekmecesine Ekle (Bu metot zaten ses ve titreşimi tetikler)
    await useNotificationStore.getState().addNotification({
      type: 'INFO',
      title,
      message,
      documentNo: reqNo,
      rfqNo: reqNo,
      responsiblePerson: assignedEmpName,
      targetRole: isAssignedToMe ? 'RESPONSIBLE' : 'ALL',
    });

    // 2. Anlık Floating Toast Göster
    useUIStore.getState().showToast({
      message: `🔔 ${title}: ${reqNo}${vessel}`,
      type: isAssignedToMe ? 'success' : 'info',
      duration: 5000,
    });

    // 3. Açık ekranlara canlı liste tazeleme uyarısı ilet
    this.notifySubscribers({ type: 'task_assigned', data });
  }

  private async handleGenericNotification(title: string, message: string) {
    await useNotificationStore.getState().addNotification({
      type: 'INFO',
      title: title || 'Sistem Bildirimi',
      message: message || '',
      targetRole: 'ALL',
    });

    useUIStore.getState().showToast({
      message: `🔔 ${title || 'Bildirim'}: ${message || ''}`,
      type: 'info',
      duration: 4000,
    });

    this.notifySubscribers({ type: 'notification', data: { title, message } });
  }

  private async handleSubstitutionResolvedEvent(data: any) {
    const isApproved = data?.isApproved === true || data?.status === 1 || data?.status === 'Approved';
    const title = isApproved ? 'Muadil Ürün Onaylandı' : 'Muadil Ürün Reddedildi';
    const subName = data?.substituteStockName || data?.substituteStockCode || '';
    const message =
      data?.message ||
      (isApproved
        ? `Sipariş #${data?.orderId || ''} için önerilen muadil ürün (${subName}) onaylandı.`
        : `Sipariş #${data?.orderId || ''} için muadil ürün talebi reddedildi.`);

    FeedbackService.playSuccess();
    useUIStore.getState().showToast({
      message: `🔔 ${title}: ${message}`,
      type: isApproved ? 'success' : 'error',
      duration: 6000,
    });

    await useNotificationStore.getState().addNotification({
      type: 'SUBSTITUTION_ALERT',
      title,
      message,
      orderId: data?.orderId,
      documentNo: data?.orderNo || (data?.orderId ? `ORD-${data.orderId}` : ''),
      targetRole: 'ALL',
    });

    this.notifySubscribers({ type: 'substitution_resolved', data });
  }

  /** Akıllı Arka Plan Yoklayıcısı (Poller - Wi-Fi kopmalarına karşı garantör) */
  private startPoller() {
    if (this.pollerTimer) return;

    // İlk kontrol
    this.checkAssignedTasks();

    // Her 25 saniyede bir kontrol et
    this.pollerTimer = setInterval(() => {
      this.checkAssignedTasks();
    }, 25000);
  }

  private stopPoller() {
    if (this.pollerTimer) {
      clearInterval(this.pollerTimer);
      this.pollerTimer = null;
    }
  }

  private async checkAssignedTasks() {
    const isAuth = useAuthStore.getState().isAuthenticated;
    if (!isAuth) return;

    try {
      const orders = await getActivePackingOrders();
      const activeOp = useOperatorStore.getState().activeOperator;

      if (!activeOp) {
        // Operatör seçilmemişse bile bilinen sipariş kimliklerini ilk çalıştırmada kaydet
        if (!this.isPollerInitialized) {
          orders.forEach((o) => this.knownAssignedOrderIds.add(o.orderId || o.id));
          this.isPollerInitialized = true;
        }
        return;
      }

      // Bu personele atanmış olan siparişleri filtrele
      const myOrders = orders.filter(
        (o) =>
          o.assignedOperatorId === activeOp.id ||
          (o.assignedOperatorName &&
            o.assignedOperatorName.trim().toLowerCase() === activeOp.fullName.trim().toLowerCase())
      );

      const currentMyIds = new Set(myOrders.map((o) => o.orderId || o.id));

      if (!this.isPollerInitialized) {
        // İlk açılışta mevcut siparişleri hafızaya al, hemen bildirim patlatma
        this.knownAssignedOrderIds = currentMyIds;
        this.isPollerInitialized = true;
        return;
      }

      // Yeni atanan bir sipariş var mı?
      const newlyAssigned: PackingOrder[] = [];
      for (const order of myOrders) {
        const id = order.orderId || order.id;
        if (!this.knownAssignedOrderIds.has(id)) {
          newlyAssigned.push(order);
          this.knownAssignedOrderIds.add(id);
        }
      }

      if (newlyAssigned.length > 0) {
        const first = newlyAssigned[0];
        const countText = newlyAssigned.length > 1 ? ` (+${newlyAssigned.length - 1} diğer)` : '';
        const vesselText = first.vesselName ? ` (${first.vesselName})` : '';

        await useNotificationStore.getState().addNotification({
          type: 'INFO',
          title: 'Yeni Depo Görevi Atandı',
          message: `${first.documentNo}${vesselText} siparişi üzerinize atandı.${countText}`,
          documentNo: first.documentNo,
          rfqNo: first.rfqNo,
          targetRole: 'RESPONSIBLE',
        });

        useUIStore.getState().showToast({
          message: `🔔 Yeni Görev: ${first.documentNo}${vesselText}${countText}`,
          type: 'success',
          duration: 5000,
        });

        this.notifySubscribers({ type: 'polled_new_task', data: newlyAssigned });
      }
    } catch {
      // Arka plan yoklaması sessizce devam eder
    }
  }
}

export const terminalNotificationService = new TerminalNotificationService();
