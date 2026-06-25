import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../theme/colors';

interface Props {
  id: string;
  titulo: string;
  descripcion?: string;
  precioEntrada: number;
  premioTotal: number;
  estado: 'abierta' | 'cerrada' | 'finalizada';
  totalPartidos: number;
}

export function QuinielaCard({ id, titulo, descripcion, precioEntrada, premioTotal, estado, totalPartidos }: Props) {
  const router = useRouter();

  const estadoColor = estado === 'abierta' ? '#2ECC71' : estado === 'cerrada' ? '#E74C3C' : '#A0A0A0';
  const estadoLabel = estado === 'abierta' ? '🟢 Abierta' : estado === 'cerrada' ? '🔴 Cerrada' : '✅ Finalizada';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.title}>🏆 {titulo}</Text>
        <View style={[styles.estadoBadge, { borderColor: estadoColor }]}>
          <Text style={[styles.estadoText, { color: estadoColor }]}>{estadoLabel}</Text>
        </View>
      </View>

      {/* Descripcion */}
      {descripcion ? <Text style={styles.descripcion}>{descripcion}</Text> : null}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalPartidos}</Text>
          <Text style={styles.statLabel}>Partidos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>${precioEntrada}</Text>
          <Text style={styles.statLabel}>Entrada</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: '#2ECC71' }]}>${premioTotal > 0 ? premioTotal.toFixed(0) : '---'}</Text>
          <Text style={styles.statLabel}>Premio</Text>
        </View>
      </View>

      {/* Boton */}
      <TouchableOpacity
        style={[styles.button, estado !== 'abierta' && styles.buttonDisabled]}
        disabled={estado !== 'abierta'}
        onPress={() => router.push({ pathname: '/quiniela/details', params: { id } })}
      >
        <Text style={[styles.buttonText, estado !== 'abierta' && { color: '#707070' }]}>
          {estado === 'abierta' ? 'Participar →' : 'No disponible'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { color: colors.text, fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 10 },
  estadoBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  estadoText: { fontSize: 11, fontWeight: 'bold' },
  descripcion: { color: colors.textMuted, fontSize: 13, marginBottom: 15 },
  statsRow: { flexDirection: 'row', backgroundColor: '#1C1F26', borderRadius: 12, padding: 12, marginBottom: 15, alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#2A2D35' },
  button: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35' },
  buttonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
