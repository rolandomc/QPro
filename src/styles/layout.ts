// src/styles/layout.ts
// Estilos de layout reutilizables: contenedores, filas, columnas.
// Usar estos en lugar de definir flex/padding por pantalla.

import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export const layout = StyleSheet.create({
  // ── Pantallas ────────────────────────────────────────────
  /** Contenedor raíz de pantalla */
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  /** Pantalla con padding horizontal estándar */
  screenPadded: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  /** Scroll content con padding horizontal */
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  // ── Flexbox ──────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  col: {
    flexDirection: 'column',
  },
  colCenter: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: { flex: 1 },

  // ── Separadores ─────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  dividerSubtle: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },

  // ── Gaps comunes ────────────────────────────────────────
  gapXs:  { gap: spacing.xs },
  gapSm:  { gap: spacing.sm },
  gapMd:  { gap: spacing.md },
  gapLg:  { gap: spacing.lg },
});
