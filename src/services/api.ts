import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config';

/**
 * Axios API Client
 * - JWT token otomatik ekleme (interceptor)
 * - Token expire olunca refresh
 * - Hata yönetimi
 */

let apiInstance: AxiosInstance | null = null;

/** API instance'ını oluştur veya güncelle */
export async function createApiInstance(): Promise<AxiosInstance> {
  const baseURL = await Config.getApiBaseUrl();

  const instance = axios.create({
    baseURL,
    timeout: Config.API_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  // Request interceptor — JWT token ekle
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = await AsyncStorage.getItem(Config.STORAGE_KEYS.AUTH_TOKEN);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor — 401 hatalarında logout'a yönlendir (refresh token desteklenmediği için)
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      // 401 Unauthorized ise yerel verileri temizle (kullanıcıyı login ekranına düşür)
      if (error.response?.status === 401) {
        await AsyncStorage.removeItem(Config.STORAGE_KEYS.AUTH_TOKEN);
        await AsyncStorage.removeItem(Config.STORAGE_KEYS.USER_DATA);
      }
      return Promise.reject(error);
    }
  );

  apiInstance = instance;
  return instance;
}

/** Mevcut API instance'ını getir, yoksa oluştur */
export async function getApi(): Promise<AxiosInstance> {
  if (!apiInstance) {
    return createApiInstance();
  }
  return apiInstance;
}

/** API instance'ını sıfırla (URL değiştiğinde çağrılır) */
export function resetApiInstance(): void {
  apiInstance = null;
}
