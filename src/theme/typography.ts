import { TextStyle } from 'react-native';

/**
 * Typography Scale — Material Design 3
 * stitch.txt tasarım dosyasından çıkarılan tipografi token'ları
 * Font: Inter (genel), JetBrains Mono (veri/kod)
 */

export const FontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
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
    fontFamily: FontFamilies.regular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  bodyMd: {
    fontFamily: FontFamilies.regular,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
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
