// src/styles/common.ts
// Estilos de componentes compartidos: cards, badges, inputs, botones, modales.
// Son los patrones más repetidos en la app.

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, shadows, text } from '../theme';

export const common = StyleSheet.create({

  // ── Cards ────────────────────────────────────────────────
  /** Card estándar */
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  /** Card elevada / destacada */
  cardElevated: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  /** Card sin padding (maneja su propio padding internamente) */
  cardRaw: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.md,
  },
  /** Card compacta — listas densas */
  cardCompact: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // ── Sección con header ───────────────────────────────────
  sectionHeader: {
    ...text.sectionTitle,
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  sectionSubtitle: {
    ...text.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },

  // ── Badges ──────────────────────────────────────────────
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
  },
  badgeText: {
    ...text.label,
    color: colors.text,
  },
  /** Badge primario (verde) */
  badgePrimary: {
    backgroundColor: colors.primaryDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.xs,
  },
  badgePrimaryText: {
    ...text.label,
    color: colors.primary,
  },
  /** Badge de éxito */
  badgeSuccess: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.xs,
  },
  badgeSuccessText: {
    ...text.label,
    color: colors.success,
  },
  /** Badge de advertencia */
  badgeWarning: {
    backgroundColor: 'rgba(243,156,18,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.xs,
  },
  badgeWarningText: {
    ...text.label,
    color: colors.warning,
  },
  /** Badge de error */
  badgeError: {
    backgroundColor: 'rgba(231,76,60,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.xs,
  },
  badgeErrorText: {
    ...text.label,
    color: colors.error,
  },

  // ── Inputs ──────────────────────────────────────────────
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    ...text.body,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputLabel: {
    ...text.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputErrorText: {
    ...text.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },

  // ── Botones ─────────────────────────────────────────────
  /** Botón primario (verde) */
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    ...text.bodySemibold,
    color: '#000',
  },
  /** Botón outline */
  btnOutline: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    ...text.bodySemibold,
    color: colors.primary,
  },
  /** Botón ghost (sin borde, solo texto) */
  btnGhost: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    ...text.bodySemibold,
    color: colors.textMuted,
  },
  /** Botón deshabilitado */
  btnDisabled: {
    opacity: 0.4,
  },

  // ── Pills / Filtros ──────────────────────────────────────
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pillText: {
    ...text.label,
    color: colors.textMuted,
  },
  pillTextActive: {
    ...text.label,
    color: colors.primary,
  },

  // ── Modales / Bottom Sheets ──────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    ...shadows.xl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...text.screenTitle,
    color: colors.text,
    marginBottom: spacing.lg,
  },

  // ── Textos comunes ───────────────────────────────────────
  textPrimary:  { color: colors.text },
  textMuted:    { color: colors.textMuted },
  textFaint:    { color: colors.textFaint },
  textAccent:   { color: colors.primary },
  textDanger:   { color: colors.error },
  textWarning:  { color: colors.warning },
  textSuccess:  { color: colors.success },

  // ── Estados vacíos ───────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // ── Loading ──────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
