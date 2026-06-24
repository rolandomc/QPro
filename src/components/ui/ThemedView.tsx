import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

// Variantes de contenedor alineadas al tema QPro
type ViewVariant = 'default' | 'card' | 'screen';

interface ThemedViewProps extends ViewProps {
  variant?: ViewVariant;
}

export function ThemedView({ variant = 'default', style, ...rest }: ThemedViewProps) {
  return <View style={[styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: {
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
});
