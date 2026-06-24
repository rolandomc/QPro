import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ResultCard({ local, visitante, score, pronostico, isWin }: any) {
  return (
    <View style={[styles.card, isWin ? styles.neonCardWin : styles.neonCardLoss]}>
      <View style={styles.header}>
        <Text style={styles.teams}>{local} vs {visitante}</Text>
        <Text style={[styles.status, { color: isWin ? '#2ECC71' : '#E91E63' }]}>
          {isWin ? '¡Ganado!' : 'Perdido'}
        </Text>
      </View>
      
      <View style={styles.details}>
        <Text style={styles.text}>Marcador Final: <Text style={styles.bold}>{score}</Text></Text>
        <Text style={styles.text}>Tu pronóstico: <Text style={styles.bold}>{pronostico}</Text></Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#15181F', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1.5 },
  neonCardWin: {
    borderColor: '#2ECC71',
    shadowColor: '#2ECC71', shadowOpacity: 0.6, shadowRadius: 10, elevation: 6,
  },
  neonCardLoss: {
    borderColor: '#E91E63',
    shadowColor: '#E91E63', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  teams: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  status: { fontSize: 14, fontWeight: 'bold' },
  details: { backgroundColor: '#1C1F26', padding: 10, borderRadius: 8 },
  text: { color: '#A0A0A0', fontSize: 13, marginBottom: 5 },
  bold: { color: '#FFF', fontWeight: 'bold' }
});