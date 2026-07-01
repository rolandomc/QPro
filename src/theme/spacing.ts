// src/theme/spacing.ts
// Design token — espaciado base de la app.
// Usar siempre estos valores en padding, margin y gap.
// Nunca hardcodear números sueltos en los StyleSheets.

export const spacing = {
  /** 2px — separación mínima, líneas divisoras */
  xxs:  2,
  /** 4px — gap interno pequeño */
  xs:   4,
  /** 8px — gap entre elementos relacionados */
  sm:   8,
  /** 12px — padding interno de componentes compactos */
  md:  12,
  /** 16px — padding estándar de cards y secciones */
  lg:  16,
  /** 20px — padding horizontal de pantallas */
  xl:  20,
  /** 24px — separación entre secciones */
  xxl: 24,
  /** 32px — espaciado generoso, headers */
  xxxl: 32,
} as const;

export type SpacingKey = keyof typeof spacing;
