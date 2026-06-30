import { create } from 'zustand';

/**
 * UI State Store
 * Loading overlay, toast bildirimleri
 */

interface ToastData {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface UIState {
  isLoading: boolean;
  loadingMessage: string;
  toast: ToastData | null;

  showLoading: (message?: string) => void;
  hideLoading: () => void;
  showToast: (toast: ToastData) => void;
  hideToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  loadingMessage: '',
  toast: null,

  showLoading: (message = 'Yükleniyor...') => {
    set({ isLoading: true, loadingMessage: message });
  },

  hideLoading: () => {
    set({ isLoading: false, loadingMessage: '' });
  },

  showToast: (toast: ToastData) => {
    set({ toast });
    // Otomatik kapanma
    const duration = toast.duration || 3000;
    setTimeout(() => {
      set((state) => {
        // Aynı toast ise kapat
        if (state.toast?.message === toast.message) {
          return { toast: null };
        }
        return state;
      });
    }, duration);
  },

  hideToast: () => {
    set({ toast: null });
  },
}));
