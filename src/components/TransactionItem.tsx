import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  tipo: string;
  monto: string;
  fecha: string;
  color: string;
}

export default function TransactionItem({ tipo, monto, fecha, color }: Props) {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.type}>{tipo}</Text>
        <Text style={styles.date}>{fecha}</Text>
      </View>
      <Text style={[styles.amount, { color }]}>{monto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D35',
  },
  type: { color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  date: { color: '#A0A0A0', fontSize: 12 },
  amount: { fontSize: 16, fontWeight: 'bold' },
});