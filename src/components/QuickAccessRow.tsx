import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function QuickAccessRow() {
  return (
    <View style={styles.row}>
      <View style={[styles.card, styles.neonCardPink]}>
        <Text style={styles.title}>TODAY'S ACCA</Text>
        <Text style={styles.flags}>🇵🇹 🏴󠁧󠁢󠁥󠁮󠁧󠁿</Text>
        <Text style={styles.subtitle}>4 Legs @ 3.31</Text>
      </View>
      
      <View style={[styles.card, styles.neonCardPurple]}>
        <Text style={styles.title}>BET BUILDER</Text>
        <Text style={styles.flags}>🇯🇴 V 🇩🇿</Text>
        <Text style={styles.subtitle}>Stats @ 1.58</Text>
      </View>

      <View style={[styles.card, styles.neonCardOrange]}>
        <Text style={[styles.title, { color: '#F39C12' }]}>BEST BETS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: {
    flex: 1,
    backgroundColor: '#15181F',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    height: 100,
  },
  neonCardPink: {
    borderColor: '#E91E63', borderWidth: 1.5,
    shadowColor: '#E91E63', shadowOpacity: 0.8, shadowRadius: 10, elevation: 8,
  },
  neonCardPurple: {
    borderColor: '#9B59B6', borderWidth: 1.5,
    shadowColor: '#9B59B6', shadowOpacity: 0.8, shadowRadius: 10, elevation: 8,
  },
  neonCardOrange: {
    borderColor: '#F39C12', borderWidth: 1.5,
    shadowColor: '#F39C12', shadowOpacity: 0.8, shadowRadius: 10, elevation: 8,
  },
  title: { color: '#FFF', fontSize: 11, fontWeight: 'bold', marginBottom: 10 },
  flags: { fontSize: 16, marginBottom: 10 },
  subtitle: { color: '#A0A0A0', fontSize: 11 },
});