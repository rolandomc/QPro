// src/components/QuinielaCard.tsx
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

export function QuinielaCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🏆 Quiniela Mundial</Text>
      
      <View style={styles.prizeContainer}>
        <Text style={styles.prizeLabel}>Monto a ganar:</Text>
        <Text style={styles.prizeAmount}>$5,000.00 MXN</Text>
      </View>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Participar →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  prizeContainer: {
    backgroundColor: '#1C1F26',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  prizeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 5,
  },
  prizeAmount: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
});