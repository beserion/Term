import { TextStyle } from 'react-native';

/**
 * Typography Scale — Material Design 3
 * stitch.txt tasarım dosyasından çıkarılan tipografi token'ları
 * Font: Montserrat (genel), JetBrains Mono (veri/kod)
 */

export const FontFamilies = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semiBold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  mono: 'JetBrainsMono_500Medium',
} as const;

export const Typography: Record<string, TextStyle> = {
  headlineLg: {
    fontFamily: FontFamilies.bold,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  headlineMd: {
    fontFamily: FontFamilies.semiBold,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  headlineSm: {
    fontFamily: FontFamilies.semiBold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  bodyLg: {
    fontFamily: FontFamilies.medium,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  bodyMd: {
    fontFamily: FontFamilies.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  labelLg: {
    fontFamily: FontFamilies.semiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    fontWeight: '600',
  },
  labelMd: {
    fontFamily: FontFamilies.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  dataMono: {
    fontFamily: FontFamilies.mono,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
} as const;
