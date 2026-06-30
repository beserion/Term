import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Uygulama Yapılandırması
 * API Base URL, Ayarlar ekranından değiştirilebilir
 */

const STORAGE_KEYS = {
  API_BASE_URL: '@wms_api_base_url',
  AUTH_TOKEN: '@wms_auth_token',
  REFRESH_TOKEN: '@wms_refresh_token',
  USER_DATA: '@wms_user_data',
} as const;

const DEFAULT_API_BASE_URL = 'https://api.blackskyqore.com/api';

/** API Base URL'i AsyncStorage'dan al */
async function getApiBaseUrl(): Promise<string> {
  try {
    const url = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
    return url || DEFAULT_API_BASE_URL;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

/** API Base URL'i AsyncStorage'a kaydet */
async function setApiBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.API_BASE_URL, url);
}

export const Config = {
  DEFAULT_API_BASE_URL,
  STORAGE_KEYS,
  getApiBaseUrl,
  setApiBaseUrl,
  APP_NAME: 'WMS Terminal',
  APP_VERSION: '1.0.0',
  /** Arama debounce süresi (ms) */
  SEARCH_DEBOUNCE_MS: 300,
  /** API timeout süresi (ms) */
  API_TIMEOUT_MS: 15000,
} as const;
