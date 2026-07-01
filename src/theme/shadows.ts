// src/theme/shadows.ts
// Design token — sombras y elevación.
// En iOS se usan shadowColor/shadowOpacity/etc.
// En Android se usa elevation.
// Cada preset incluye ambos para cross-platform.

import { ViewStyle } from 'react-native';

export const shadows = {
  /** Sin sombra */
  none: {} as ViewStyle,

  /** Sombra sutil — separadores, inputs */
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius:  4,
    elevation:     2,
  } as ViewStyle,

  /** Sombra estándar — cards */
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius:  10,
    elevation:     6,
  } as ViewStyle,

  /** Sombra pronunciada — modales, dropdowns */
  lg: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius:  20,
    elevation:     16,
  } as ViewStyle,

  /** Sombra máxima — bottom sheets, overlays */
  xl: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.70,
    shadowRadius:  28,
    elevation:     24,
  } as ViewStyle,
} as const;

export type ShadowKey = keyof typeof shadows;
