/**
 * Material Design 3 Color Palette
 * stitch.txt tasarım dosyasından çıkarılan renk token'ları
 */
export const Colors = {
  // Primary
  primary: '#00236f',
  primaryContainer: '#1e3a8a',
  primaryFixed: '#dce1ff',
  primaryFixedDim: '#b6c4ff',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#90a8ff',
  onPrimaryFixed: '#00164e',
  onPrimaryFixedVariant: '#264191',
  inversePrimary: '#b6c4ff',

  // Secondary
  secondary: '#505f76',
  secondaryContainer: '#d0e1fb',
  secondaryFixed: '#d3e4fe',
  secondaryFixedDim: '#b7c8e1',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#54647a',
  onSecondaryFixed: '#0b1c30',
  onSecondaryFixedVariant: '#38485d',

  // Tertiary
  tertiary: '#4b1c00',
  tertiaryContainer: '#6e2c00',
  tertiaryFixed: '#ffdbcb',
  tertiaryFixedDim: '#ffb691',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#f39461',
  onTertiaryFixed: '#341100',
  onTertiaryFixedVariant: '#773205',

  // Error
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',

  // Surface
  surface: '#f7fafd',
  surfaceBright: '#f7fafd',
  surfaceDim: '#d7dadd',
  surfaceContainer: '#ebeef1',
  surfaceContainerLow: '#f1f4f7',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerHigh: '#e5e8eb',
  surfaceContainerHighest: '#e0e3e6',
  surfaceVariant: '#e0e3e6',
  surfaceTint: '#4059aa',
  onSurface: '#181c1e',
  onSurfaceVariant: '#444651',
  inverseSurface: '#2d3133',
  inverseOnSurface: '#eef1f4',

  // Background
  background: '#f7fafd',
  onBackground: '#181c1e',

  // Outline
  outline: '#757682',
  outlineVariant: '#c5c5d3',

  // Status Colors (Ekran görüntülerinden)
  pendingBg: '#FFF4E5',
  pendingText: '#8C5D00',
  confirmedBg: '#E5F6EB',
  confirmedText: '#006C32',
  receivedBg: '#d0e1fb',
  receivedText: '#54647a',

  // Transparent
  transparent: 'transparent',
  white: '#ffffff',
  black: '#000000',
} as const;

export type ColorKey = keyof typeof Colors;
