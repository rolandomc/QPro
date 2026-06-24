import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

// Variantes tipográficas alineadas al tema QPro
type TextVariant = 'default' | 'title' | 'subtitle' | 'muted' | 'link';

interface ThemedTextProps extends TextProps {
  variant?: TextVariant;
}

export function ThemedText({ variant = 'default', style, ...rest }: ThemedTextProps) {
  return <Text style={[styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: {
    fontSize: 14,
    color: colors.text,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  link: {
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
