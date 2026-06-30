import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config';
import { getApi } from './api';

/**
 * Auth Servisi
 * .NET Core 9 Identity JWT kimlik doğrulaması
 */

export interface LoginRequest {
  email?: string;
  userName?: string;
  password?: string;
}

export interface UserData {
  id: string;
  userName: string;
  email: string;
  name: string;
  companyId?: number;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  expiresUtc: string;
  user: UserData;
}

/** Kullanıcı girişi */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const api = await getApi();
  const response = await api.post<LoginResponse>('/Auth/login', credentials);
  const data = response.data;

  // Token'ları kaydet
  if (data.token) {
    await AsyncStorage.setItem(Config.STORAGE_KEYS.AUTH_TOKEN, data.token);
  }
  if (data.user) {
    await AsyncStorage.setItem(Config.STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
  }

  return data;
}

/** Kullanıcı çıkışı */
export async function logout(): Promise<void> {
  try {
    const api = await getApi();
    await api.post('/Auth/logout'); // Varsa çağırılır, yoksa hata düşer
  } catch {
    // Logout API başarısız olsa da yerel verileri temizle
  }

  await AsyncStorage.removeItem(Config.STORAGE_KEYS.AUTH_TOKEN);
  await AsyncStorage.removeItem(Config.STORAGE_KEYS.REFRESH_TOKEN); // Eski sürümler için
  await AsyncStorage.removeItem(Config.STORAGE_KEYS.USER_DATA);
}

/** Kayıtlı kullanıcı verisini getir */
export async function getStoredUser(): Promise<UserData | null> {
  try {
    const userData = await AsyncStorage.getItem(Config.STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
}

/** Kayıtlı token kontrolü */
export async function hasValidToken(): Promise<boolean> {
  try {
    const token = await AsyncStorage.getItem(Config.STORAGE_KEYS.AUTH_TOKEN);
    return !!token;
  } catch {
    return false;
  }
}
