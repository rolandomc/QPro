import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useHome } from './useHome';

// Pantalla principal — solo presentación, lógica en useHome
export default function HomeScreen() {
  const { isLoading, userName, balance, refresh } = useHome();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Hola, {userName} 👋</Text>
      <Text style={styles.balance}>Saldo: ${balance.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcome: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  balance: {
    fontSize: 18,
    color: '#666',
  },
});
