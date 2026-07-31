import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  AUTH_TOKEN: '@wms_auth_token',
  REFRESH_TOKEN: '@wms_refresh_token',
  USER_DATA: '@wms_user_data',
  API_BASE_URL: '@wms_api_base_url',
} as const;

const DEFAULT_API_BASE_URL = 'https://arkship.posnetx.com/api';

/** API Base URL'i al (Kayıtlı URL yoksa varsayılanı döndürür) */
async function getApiBaseUrl(): Promise<string> {
  try {
    const savedUrl = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
    if (savedUrl && savedUrl.trim().length > 0) {
      return savedUrl.trim();
    }
  } catch (error) {
    console.error('API Base URL okuma hatası:', error);
  }
  return DEFAULT_API_BASE_URL;
}

/** API Base URL'in cihaz hafızasında kayıtlı olup olmadığını kontrol eder */
async function isApiBaseUrlSet(): Promise<boolean> {
  try {
    const savedUrl = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
    return !!(savedUrl && savedUrl.trim().length > 0);
  } catch {
    return false;
  }
}

/** API Base URL'i cihaz hafızasına kaydet */
async function setApiBaseUrl(url: string): Promise<void> {
  const formattedUrl = url.trim().replace(/\/+$/, '');
  await AsyncStorage.setItem(STORAGE_KEYS.API_BASE_URL, formattedUrl);
}

export const Config = {
  DEFAULT_API_BASE_URL,
  STORAGE_KEYS,
  getApiBaseUrl,
  isApiBaseUrlSet,
  setApiBaseUrl,
  APP_NAME: 'BlueHub Terminal',
  APP_VERSION: '1.0.0',
  /** Arama debounce süresi (ms) */
  SEARCH_DEBOUNCE_MS: 300,
  /** API timeout süresi (ms) */
  API_TIMEOUT_MS: 15000,
} as const;

