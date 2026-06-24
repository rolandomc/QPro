import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: Props) {
  const percentage = Math.min((current / total) * 100, 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Pronósticos listos:</Text>
        <Text style={styles.neonText}>{current} / {total}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percentage}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, marginBottom: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#A0A0A0', fontSize: 12, fontWeight: '600' },
  neonText: { 
    color: '#2ECC71', fontSize: 14, fontWeight: 'bold',
    textShadowColor: 'rgba(46, 204, 113, 0.8)', textShadowRadius: 8
  },
  track: { height: 8, backgroundColor: '#1C1F26', borderRadius: 4, overflow: 'hidden' },
  fill: { 
    height: '100%', backgroundColor: '#2ECC71', borderRadius: 4,
    shadowColor: '#2ECC71', shadowOpacity: 1, shadowRadius: 10, elevation: 5
  }
});