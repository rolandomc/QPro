import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useHome } from './useHome';
import { common, layout } from '../../styles';
import { colors, text, spacing } from '../../theme';

export default function HomeScreen() {
  const { isLoading, userName, balance, refresh } = useHome();

  if (isLoading) {
    return (
      <View style={common.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[layout.screen, { padding: spacing.lg }]}>
      <Text style={[text.display, common.textPrimary]}>Hola, {userName} 👋</Text>
      <Text style={[text.screenTitle, common.textMuted]}>Saldo: ${balance.toFixed(2)}</Text>
    </View>
  );
}
