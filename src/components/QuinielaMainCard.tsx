import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function QuinielaMainCard() {
  const router = useRouter();

  return (
    <View style={[styles.card, styles.neonCardGreen]}>
      <Text style={styles.cardSubtitle}>🏆 QUINIELA MUNDIAL 2026</Text>

      <View style={styles.prizeContainer}>
        <Text style={styles.prizeLabel}>Bolsa Acumulada</Text>
        <Text style={styles.prizeValue}>$50,000 MXN</Text>
        <Text style={styles.matchCount}>10 Partidos • Cierre: Mañana 20:00</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/quiniela/details')}
      >
        <Text style={styles.actionButtonText}>Participar →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#15181F',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  neonCardGreen: {
    borderColor: '#2ECC71',
    borderWidth: 1.5,
    boxShadow: '0 0 15px 4px rgba(46, 204, 113, 0.8)',
  },
  cardSubtitle: {
    color: '#A0A0A0',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 15,
  },
  prizeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  prizeLabel: { color: '#FFF', fontSize: 14, marginBottom: 5 },
  prizeValue: { color: '#2ECC71', fontSize: 28, fontWeight: 'bold', marginBottom: 5 },
  matchCount: { color: '#707070', fontSize: 12 },
  actionButton: {
    backgroundColor: '#2ECC71',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
