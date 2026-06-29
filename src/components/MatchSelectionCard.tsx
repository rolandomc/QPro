import React from 'react';
import {
  StyleSheet, Text, View, Pressable, TextInput, TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';

export interface SeleccionConGoles {
  prediccion: 'local' | 'empate' | 'visitante';
  golesLocal: number;
  golesVisitante: number;
}

interface Partido {
  id: string;
  equipo_local: string;
  equipo_visitante: string;
  fecha_partido: string;
}

interface Props {
  partido: Partido;
  index: number;
  seleccionActual: SeleccionConGoles | null;
  onSelect: (seleccion: SeleccionConGoles) => void;
  disabled?: boolean;
}

/** Deduce la predicción automáticamente a partir del marcador */
function deducirPrediccion(
  golesLocal: number,
  golesVisitante: number
): 'local' | 'empate' | 'visitante' {
  if (golesLocal > golesVisitante) return 'local';
  if (golesVisitante > golesLocal) return 'visitante';
  return 'empate';
}

export default function MatchSelectionCard({
  partido, index, seleccionActual, onSelect, disabled = false,
}: Props) {
  const fecha = partido.fecha_partido
    ? new Date(partido.fecha_partido).toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Fecha por confirmar';

  const golesLocal      = seleccionActual?.golesLocal      ?? 0;
  const golesVisitante  = seleccionActual?.golesVisitante  ?? 1;
  const prediccion      = seleccionActual?.prediccion      ?? null;

  const cambiarGoles = (
    campo: 'local' | 'visitante',
    delta: number
  ) => {
    if (disabled) return;
    const nuevoLocal      = campo === 'local'     ? Math.max(0, golesLocal + delta)     : golesLocal;
    const nuevoVisitante  = campo === 'visitante' ? Math.max(0, golesVisitante + delta) : golesVisitante;
    const nuevaPrediccion = deducirPrediccion(nuevoLocal, nuevoVisitante);

    Haptics.impactAsync(
      seleccionActual === null
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium
    );

    onSelect({
      prediccion:    nuevaPrediccion,
      golesLocal:    nuevoLocal,
      golesVisitante: nuevoVisitante,
    });
  };

  // Color según predicción deducida
  const colorLocal      = prediccion === 'local'     ? '#2ECC71' : '#A0A0A0';
  const colorVisitante  = prediccion === 'visitante' ? '#2ECC71' : '#A0A0A0';
  const colorEmpate     = prediccion === 'empate'    ? '#F39C12' : '#505050';

  return (
    <View style={[styles.card, prediccion && styles.cardCompleto]}>
      {/* Top: número + fecha + check */}
      <View style={styles.cardTop}>
        <View style={styles.numBadge}>
          <Text style={styles.numText}>{index + 1}</Text>
        </View>
        <Text style={styles.fecha}>{fecha}</Text>
        {prediccion ? (
          <View style={[styles.resultBadge, prediccion === 'empate' && styles.resultBadgeEmpate]}>
            <Text style={styles.resultBadgeText}>
              {prediccion === 'local'
                ? '1'
                : prediccion === 'empate'
                ? 'X'
                : '2'}
            </Text>
          </View>
        ) : (
          <View style={styles.pendienteBadge}>
            <Text style={styles.pendienteText}>?</Text>
          </View>
        )}
      </View>

      {/* Marcador central */}
      <View style={styles.marcadorRow}>
        {/* Equipo local */}
        <View style={styles.equipoCol}>
          <Text style={[styles.equipoNombre, { color: colorLocal }]} numberOfLines={2}>
            {partido.equipo_local}
          </Text>
          <View style={styles.golesControl}>
            <TouchableOpacity
              onPress={() => cambiarGoles('local', -1)}
              style={styles.golesBtn}
              disabled={disabled || golesLocal === 0}
            >
              <Text style={[styles.golesBtnText, golesLocal === 0 && styles.golesBtnDisabled]}>−</Text>
            </TouchableOpacity>
            <View style={[styles.golesDisplay, prediccion === 'local' && styles.golesDisplayWinner]}>
              <Text style={[styles.golesNumero, { color: colorLocal }]}>{golesLocal}</Text>
            </View>
            <TouchableOpacity
              onPress={() => cambiarGoles('local', +1)}
              style={styles.golesBtn}
              disabled={disabled}
            >
              <Text style={styles.golesBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Separador central */}
        <View style={styles.separador}>
          <Text style={styles.vsText}>vs</Text>
          {prediccion === 'empate' && (
            <View style={styles.empatePill}>
              <Text style={styles.empateText}>EMPATE</Text>
            </View>
          )}
          {prediccion && prediccion !== 'empate' && (
            <View style={styles.flechaWrap}>
              <Text style={{ color: '#2ECC71', fontSize: 18 }}>
                {prediccion === 'local' ? '◄' : '►'}
              </Text>
            </View>
          )}
        </View>

        {/* Equipo visitante */}
        <View style={[styles.equipoCol, styles.equipoColRight]}>
          <Text style={[styles.equipoNombre, styles.equipoNombreRight, { color: colorVisitante }]} numberOfLines={2}>
            {partido.equipo_visitante}
          </Text>
          <View style={styles.golesControl}>
            <TouchableOpacity
              onPress={() => cambiarGoles('visitante', -1)}
              style={styles.golesBtn}
              disabled={disabled || golesVisitante === 0}
            >
              <Text style={[styles.golesBtnText, golesVisitante === 0 && styles.golesBtnDisabled]}>−</Text>
            </TouchableOpacity>
            <View style={[styles.golesDisplay, prediccion === 'visitante' && styles.golesDisplayWinner]}>
              <Text style={[styles.golesNumero, { color: colorVisitante }]}>{golesVisitante}</Text>
            </View>
            <TouchableOpacity
              onPress={() => cambiarGoles('visitante', +1)}
              style={styles.golesBtn}
              disabled={disabled}
            >
              <Text style={styles.golesBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Hint de desempate */}
      <View style={styles.hintRow}>
        <Text style={styles.hintText}>
          🎯 Predicción: <Text style={styles.hintBold}>
            {prediccion === 'local'
              ? partido.equipo_local
              : prediccion === 'visitante'
              ? partido.equipo_visitante
              : prediccion === 'empate'
              ? 'Empate'
              : 'Ajusta el marcador'}
          </Text>
          {prediccion
            ? <Text style={styles.hintMuted}>  •  Goles totales: {golesLocal + golesVisitante}</Text>
            : null}
        </Text>
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
  cardCompleto: {
    borderColor: '#2A3A2A',
  },

  // Top
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  numBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#2A2D35',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },
  numText:    { color: '#A0A0A0', fontSize: 11, fontWeight: 'bold' },
  fecha:      { color: '#606060', fontSize: 11, flex: 1 },
  resultBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderWidth: 1, borderColor: '#2ECC71',
    justifyContent: 'center', alignItems: 'center',
  },
  resultBadgeEmpate: {
    backgroundColor: 'rgba(243,156,18,0.15)',
    borderColor: '#F39C12',
  },
  resultBadgeText: { color: '#2ECC71', fontSize: 11, fontWeight: 'bold' },
  pendienteBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#1C1F26',
    borderWidth: 1, borderColor: '#3A3D45',
    justifyContent: 'center', alignItems: 'center',
  },
  pendienteText: { color: '#505050', fontSize: 13, fontWeight: 'bold' },

  // Marcador
  marcadorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  equipoCol: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  equipoColRight: {
    alignItems: 'center',
  },
  equipoNombre: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 17,
  },
  equipoNombreRight: {
    textAlign: 'center',
  },

  // Controles de goles
  golesControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  golesBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#1C1F26',
    borderWidth: 1, borderColor: '#2A2D35',
    justifyContent: 'center', alignItems: 'center',
  },
  golesBtnText: {
    color: '#E0E0E0',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '300',
  },
  golesBtnDisabled: { color: '#333' },
  golesDisplay: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#1C1F26',
    borderWidth: 1.5, borderColor: '#2A2D35',
    justifyContent: 'center', alignItems: 'center',
  },
  golesDisplayWinner: {
    backgroundColor: 'rgba(46,204,113,0.1)',
    borderColor: '#2ECC71',
  },
  golesNumero: {
    fontSize: 22,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },

  // Separador
  separador: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 50,
  },
  vsText: { color: '#404040', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  empatePill: {
    backgroundColor: 'rgba(243,156,18,0.15)',
    borderRadius: 6, borderWidth: 1, borderColor: '#F39C12',
    paddingHorizontal: 6, paddingVertical: 2,
  },
  empateText: { color: '#F39C12', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  flechaWrap: { alignItems: 'center' },

  // Hint inferior
  hintRow: {
    borderTopWidth: 1,
    borderTopColor: '#1E2128',
    paddingTop: 10,
    alignItems: 'center',
  },
  hintText:  { color: '#606060', fontSize: 11, textAlign: 'center' },
  hintBold:  { color: '#A0A0A0', fontWeight: '600' },
  hintMuted: { color: '#404040' },
});
