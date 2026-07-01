// src/theme/radii.ts
// Design token — border radius globales.
// Cambiar aquí afecta todas las cards, botones y modales de la app.

export const radii = {
  /** 4px — chips pequeños, badges de texto */
  xs:   4,
  /** 8px — botones compactos, tags */
  sm:   8,
  /** 12px — cards estándar, inputs */
  md:  12,
  /** 16px — cards grandes, modales */
  lg:  16,
  /** 20px — pills, botones redondeados */
  xl:  20,
  /** 26px — bottom sheets, modales principales */
  xxl: 26,
  /** 9999px — círculos, avatares */
  full: 9999,
} as const;

export type RadiiKey = keyof typeof radii;
