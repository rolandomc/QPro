// src/theme/typography.ts
// Design token — escala tipográfica de la app.
// Usar siempre estos presets en lugar de fontSize/fontWeight sueltos.

import { TextStyle } from 'react-native';

// ── Escala de tamaños ──────────────────────────────────
export const fontSize = {
  xs:   10,
  sm:   11,
  base: 12,
  md:   13,
  lg:   14,
  xl:   16,
  xxl:  18,
  xxxl: 22,
  display: 28,
} as const;

// ── Pesos ─────────────────────────────────────────────
export const fontWeight = {
  regular:   '400' as TextStyle['fontWeight'],
  medium:    '500' as TextStyle['fontWeight'],
  semibold:  '600' as TextStyle['fontWeight'],
  bold:      '700' as TextStyle['fontWeight'],
  extrabold: '800' as TextStyle['fontWeight'],
} as const;

// ── Presets listos para usar en StyleSheet ─────────────────
export const text = {
  /** 10px regular — timestamps, labels terciarios */
  caption:      { fontSize: fontSize.xs,   fontWeight: fontWeight.regular } as TextStyle,
  /** 11px semibold — badges, etiquetas pequeñas */
  label:        { fontSize: fontSize.sm,   fontWeight: fontWeight.semibold } as TextStyle,
  /** 12px regular — texto de apoyo, subtítulos */
  bodySmall:    { fontSize: fontSize.base, fontWeight: fontWeight.regular } as TextStyle,
  /** 12px semibold — metadata destacada */
  bodySmallBold:{ fontSize: fontSize.base, fontWeight: fontWeight.semibold } as TextStyle,
  /** 13px regular — cuerpo principal */
  body:         { fontSize: fontSize.md,   fontWeight: fontWeight.regular } as TextStyle,
  /** 13px semibold — cuerpo con peso */
  bodySemibold: { fontSize: fontSize.md,   fontWeight: fontWeight.semibold } as TextStyle,
  /** 14px bold — títulos de items, nombres */
  itemTitle:    { fontSize: fontSize.lg,   fontWeight: fontWeight.bold } as TextStyle,
  /** 16px bold — títulos de sección */
  sectionTitle: { fontSize: fontSize.xl,   fontWeight: fontWeight.bold } as TextStyle,
  /** 18px bold — títulos de pantalla */
  screenTitle:  { fontSize: fontSize.xxl,  fontWeight: fontWeight.bold } as TextStyle,
  /** 22px bold — logo / display grande */
  display:      { fontSize: fontSize.xxxl, fontWeight: fontWeight.bold } as TextStyle,
} as const;

export type TextPreset = keyof typeof text;
