import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: Props) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  const isComplete = current === total && total > 0;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>
          {isComplete ? '✅ Todos los partidos seleccionados' : `Seleccionados: ${current} de ${total}`}
        </Text>
        <Text style={[styles.pct, isComplete && styles.pctComplete]}>{Math.round(pct)}%</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct}%` },
            isComplete && styles.fillComplete,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 15,
    marginBottom: 12,
    backgroundColor: '#15181F',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2D35',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#A0A0A0', fontSize: 12 },
  pct: { color: '#A0A0A0', fontSize: 12, fontWeight: 'bold' },
  pctComplete: { color: '#2ECC71' },
  track: {
    height: 6,
    backgroundColor: '#1C1F26',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#3498DB',
    borderRadius: 3,
  },
  fillComplete: { backgroundColor: '#2ECC71' },
});
