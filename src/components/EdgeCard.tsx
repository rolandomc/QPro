import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function EdgeCard() {
  return (
    <View style={[styles.card, styles.neonCardBlue]}>
      <Text style={styles.header}>🏆 World Cup • mar 23 de jun, 20:00</Text>
      <Text style={styles.match}>Colombia 🇨🇴 v 🇨🇩 Congo DR</Text>
      <View style={styles.statsRow}>
        <Text style={styles.edge}>+17.6% EDGE</Text>
        <Text style={styles.odds}>1.85</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#15181F', borderRadius: 16, padding: 20, marginBottom: 20,
  },
  neonCardBlue: {
    borderColor: '#3498DB', borderWidth: 1.5,
    shadowColor: '#3498DB', shadowOpacity: 0.8, shadowRadius: 12, elevation: 8,
  },
  header: { color: '#707070', fontSize: 12, marginBottom: 15 },
  match: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  edge: { color: '#3498DB', fontSize: 20, fontWeight: 'bold' },
  odds: { color: '#FFF', fontSize: 18, fontWeight: 'bold', padding: 8, backgroundColor: '#1C1F26', borderRadius: 8 },
});