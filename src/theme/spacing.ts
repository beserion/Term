/**
 * Spacing & Layout Tokens
 * stitch.txt tasarım dosyasından çıkarılan spacing değerleri
 */
export const Spacing = {
  /** Elemanlar arası boşluk */
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,

  /** Tasarım Token'ları */
  gutter: 12,
  stackGap: 8,
  marginMobile: 16,
  cardPadding: 16,
  touchTargetMin: 48,
} as const;

export const BorderRadius = {
  /** Temel border radius değerleri */
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Shadow = {
  /** Kart gölgesi */
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  /** Hafif gölge */
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  /** Navigasyon gölgesi */
  nav: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
