/**
 * Uygulama Yapılandırması
 */

const STORAGE_KEYS = {
  AUTH_TOKEN: '@wms_auth_token',
  REFRESH_TOKEN: '@wms_refresh_token',
  USER_DATA: '@wms_user_data',
} as const;

const DEFAULT_API_BASE_URL = 'https://api.blackskyqore.com/api';

/** API Base URL'i al */
async function getApiBaseUrl(): Promise<string> {
  return DEFAULT_API_BASE_URL;
}

export const Config = {
  DEFAULT_API_BASE_URL,
  STORAGE_KEYS,
  getApiBaseUrl,
  APP_NAME: 'BlueHub Terminal',
  APP_VERSION: '1.0.0',
  /** Arama debounce süresi (ms) */
  SEARCH_DEBOUNCE_MS: 300,
  /** API timeout süresi (ms) */
  API_TIMEOUT_MS: 15000,
} as const;
