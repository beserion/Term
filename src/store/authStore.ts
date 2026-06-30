import { create } from 'zustand';
import { UserData, getStoredUser, hasValidToken, login as loginService, logout as logoutService, LoginRequest } from '../services/auth';
import { createApiInstance } from '../services/api';

/**
 * Auth State Store (Zustand)
 * JWT token yönetimi, kullanıcı bilgileri
 */

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserData | null;
  error: string | null;

  /** Uygulama başlarken kayıtlı token kontrolü */
  initialize: () => Promise<void>;
  /** Giriş yap */
  login: (credentials: LoginRequest) => Promise<boolean>;
  /** Çıkış yap */
  logout: () => Promise<void>;
  /** Hata temizle */
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,

  initialize: async () => {
    try {
      const hasToken = await hasValidToken();
      if (hasToken) {
        const user = await getStoredUser();
        await createApiInstance();
        set({ isAuthenticated: true, user, isLoading: false });
      } else {
        set({ isAuthenticated: false, user: null, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, user: null, isLoading: false });
    }
  },

  login: async (credentials: LoginRequest) => {
    set({ isLoading: true, error: null });
    try {
      const response = await loginService(credentials);
      await createApiInstance();
      set({
        isAuthenticated: true,
        user: response.user,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (error: any) {
      // .NET Core 400 Bad Request Validation hatalarını ayrıştır
      let message = 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.';
      if (error?.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
          message = data;
        } else if (data.message) {
          message = data.message;
        } else if (data.title) {
          message = data.title;
          if (data.errors) {
            // Validation detaylarını mesajın sonuna ekle
            const errs = Object.values(data.errors).flat().join(' ');
            message += ` ${errs}`;
          }
        }
      } else if (error?.message) {
        message = error.message;
      }
      set({ isLoading: false, error: message });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    await logoutService();
    set({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
