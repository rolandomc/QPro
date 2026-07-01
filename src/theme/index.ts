// src/theme/index.ts
// Punto de entrada único para todos los tokens de diseño.
// Importar siempre desde aquí, no desde los archivos individuales.
//
// Uso:
//   import { colors, spacing, radii, text, shadows } from '../theme';

export { colors }      from './colors';
export { spacing }     from './spacing';
export { radii }       from './radii';
export { text, fontSize, fontWeight } from './typography';
export { shadows }     from './shadows';

// Re-export de tipos
export type { SpacingKey }  from './spacing';
export type { RadiiKey }    from './radii';
export type { TextPreset }  from './typography';
export type { ShadowKey }   from './shadows';
