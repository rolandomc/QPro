import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Partido {
  id: string;
  equipo_local: string;
  equipo_visitante: string;
  fecha_partido: string;
}

interface Props {
  partido: Partido;
  index: number;
  seleccionActual: 'local' | 'empate' | 'visitante' | null;
  onSelect: (opcion: 'local' | 'empate' | 'visitante') => void;
}

export default function MatchSelectionCard({ partido, index, seleccionActual, onSelect }: Props) {
  const fecha = partido.fecha_partido
    ? new Date(partido.fecha_partido).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Fecha por confirmar';

  const opciones: { key: 'local' | 'empate' | 'visitante'; label: string; sublabel: string }[] = [
    { key: 'local',     label: '1', sublabel: partido.equipo_local },
    { key: 'empate',    label: 'X', sublabel: 'Empate' },
    { key: 'visitante', label: '2', sublabel: partido.equipo_visitante },
  ];

  const handleSelect = (opcion: 'local' | 'empate' | 'visitante') => {
    // Vibración distinta si es cambio de pick o primer pick
    if (seleccionActual === opcion) return; // misma opción, no hacer nada
    Haptics.impactAsync(
      seleccionActual === null
        ? Haptics.ImpactFeedbackStyle.Light   // primer pick: suave
        : Haptics.ImpactFeedbackStyle.Medium  // cambio de pick: media
    );
    onSelect(opcion);
  };

  return (
    <View style={styles.card}>
      {/* Numero y fecha */}
      <View style={styles.cardTop}>
        <View style={styles.numBadge}>
          <Text style={styles.numText}>{index + 1}</Text>
        </View>
        <Text style={styles.fecha}>{fecha}</Text>
        {seleccionActual && (
          <View style={styles.checkBadge}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        )}
      </View>

      {/* Equipos */}
      <View style={styles.teamsRow}>
        <Text style={[styles.teamName, seleccionActual === 'local' && styles.teamSelected]} numberOfLines={1}>
          {partido.equipo_local}
        </Text>
        <Text style={styles.vsText}>vs</Text>
        <Text style={[styles.teamName, styles.teamRight, seleccionActual === 'visitante' && styles.teamSelected]} numberOfLines={1}>
          {partido.equipo_visitante}
        </Text>
      </View>

      {/* Botones 1 X 2 */}
      <View style={styles.optionsRow}>
        {opciones.map((op) => {
          const isSelected = seleccionActual === op.key;
          return (
            <Pressable
              key={op.key}
              onPress={() => handleSelect(op.key)}
              style={({ pressed }) => [
                styles.optionBtn,
                isSelected && styles.optionBtnSelected,
                pressed && styles.optionBtnPressed,
              ]}
            >
              <Text style={[styles.optionKey, isSelected && styles.optionKeySelected]}>{op.label}</Text>
              <Text style={[styles.optionSub, isSelected && styles.optionSubSelected]} numberOfLines={1}>
                {op.sublabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#15181F',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2D35',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  numBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#2A2D35',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },
  numText:    { color: '#A0A0A0', fontSize: 11, fontWeight: 'bold' },
  fecha:      { color: '#707070', fontSize: 12, flex: 1 },
  checkBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#2ECC71',
    justifyContent: 'center', alignItems: 'center',
  },
  checkText: { color: '#000', fontSize: 12, fontWeight: 'bold' },

  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  teamName:     { flex: 1, color: '#A0A0A0', fontSize: 14, fontWeight: '600' },
  teamRight:    { textAlign: 'right' },
  teamSelected: { color: '#2ECC71' },
  vsText:       { color: '#505050', fontSize: 12, fontWeight: 'bold', paddingHorizontal: 4 },

  optionsRow:        { flexDirection: 'row', gap: 8 },
  optionBtn:         {
    flex: 1,
    backgroundColor: '#1C1F26',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2A2D35',
  },
  optionBtnSelected: { backgroundColor: 'rgba(46,204,113,0.12)', borderColor: '#2ECC71' },
  optionBtnPressed:  { opacity: 0.7 },
  optionKey:         { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
  optionKeySelected: { color: '#2ECC71' },
  optionSub:         { color: '#707070', fontSize: 9, textAlign: 'center' },
  optionSubSelected: { color: '#2ECC71' },
});
