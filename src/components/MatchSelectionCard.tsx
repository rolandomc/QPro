import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
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
        dateStyle: 'medium', timeStyle: 'short',
      })
    : 'Fecha por confirmar';

  // Valores actuales — 0-0 por defecto
  const golesLocal     = seleccionActual?.golesLocal     ?? 0;
  const golesVisitante = seleccionActual?.golesVisitante ?? 0;
  const prediccion     = seleccionActual?.prediccion     ?? null;

  const cambiarGoles = (campo: 'local' | 'visitante', delta: number) => {
    if (disabled) return;
    const nuevoLocal     = campo === 'local'     ? Math.max(0, golesLocal + delta)     : golesLocal;
    const nuevoVisitante = campo === 'visitante' ? Math.max(0, golesVisitante + delta) : golesVisitante;
    const nuevaPrediccion = deducirPrediccion(nuevoLocal, nuevoVisitante);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    onSelect({
      prediccion:     nuevaPrediccion,
      golesLocal:     nuevoLocal,
      golesVisitante: nuevoVisitante,
    });
  };

  // Colores según predicción
  const localSelected    = prediccion === 'local';
  const visitanteSelected = prediccion === 'visitante';
  const empateSelected   = prediccion === 'empate';

  return (
    <View style={[styles.card, prediccion !== null && styles.cardSeleccionado]}>

      {/* Cabecera: número + fecha */}
      <View style={styles.header}>
        <View style={styles.numBadge}>
          <Text style={styles.numText}>{index + 1}</Text>
        </View>
        <Text style={styles.fecha}>{fecha}</Text>
        {/* Badge resultado deducido */}
        {prediccion ? (
          <View style={[styles.resultBadge, empateSelected && styles.resultBadgeEmpate]}>
            <Text style={[styles.resultBadgeText, empateSelected && styles.resultBadgeTextEmpate]}>
              {prediccion === 'local' ? '1' : prediccion === 'empate' ? 'X' : '2'}
            </Text>
          </View>
        ) : (
          <View style={styles.pendienteBadge}>
            <Text style={styles.pendienteText}>?</Text>
          </View>
        )}
      </View>

      {/* Equipos con controles de goles */}
      <View style={styles.teamsRow}>

        {/* LOCAL */}
        <View style={[styles.teamBlock, localSelected && styles.teamBlockWinner]}>
          <Text
            style={[styles.teamName, localSelected && styles.teamNameWinner]}
            numberOfLines={2}
          >
            {partido.equipo_local}
          </Text>
          {!disabled && (
            <View style={styles.golesRow}>
              <TouchableOpacity
                style={styles.golesBtn}
                onPress={() => cambiarGoles('local', -1)}
                disabled={golesLocal === 0}
              >
                <Text style={[styles.golesBtnTxt, golesLocal === 0 && styles.golesBtnDisabled]}>−</Text>
              </TouchableOpacity>
              <View style={[styles.golesBox, localSelected && styles.golesBoxWinner]}>
                <Text style={[styles.golesNum, localSelected && styles.golesNumWinner]}>
                  {golesLocal}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.golesBtn}
                onPress={() => cambiarGoles('local', +1)}
              >
                <Text style={styles.golesBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          )}
          {disabled && (
            <Text style={[styles.golesReadOnly, localSelected && styles.golesNumWinner]}>
              {golesLocal}
            </Text>
          )}
        </View>

        {/* CENTRO: vs + indicador */}
        <View style={styles.centerCol}>
          <Text style={styles.vsText}>vs</Text>
          {prediccion === 'empate' && (
            <View style={styles.empatePill}>
              <Text style={styles.empateText}>X</Text>
            </View>
          )}
          {localSelected && <Text style={styles.flechaLocal}>◄</Text>}
          {visitanteSelected && <Text style={styles.flechaVisitante}>►</Text>}
          {!prediccion && <Text style={styles.flechaInactiva}>-</Text>}
        </View>

        {/* VISITANTE */}
        <View style={[styles.teamBlock, styles.teamBlockRight, visitanteSelected && styles.teamBlockWinner]}>
          <Text
            style={[styles.teamName, styles.teamNameRight, visitanteSelected && styles.teamNameWinner]}
            numberOfLines={2}
          >
            {partido.equipo_visitante}
          </Text>
          {!disabled && (
            <View style={styles.golesRow}>
              <TouchableOpacity
                style={styles.golesBtn}
                onPress={() => cambiarGoles('visitante', -1)}
                disabled={golesVisitante === 0}
              >
                <Text style={[styles.golesBtnTxt, golesVisitante === 0 && styles.golesBtnDisabled]}>−</Text>
              </TouchableOpacity>
              <View style={[styles.golesBox, visitanteSelected && styles.golesBoxWinner]}>
                <Text style={[styles.golesNum, visitanteSelected && styles.golesNumWinner]}>
                  {golesVisitante}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.golesBtn}
                onPress={() => cambiarGoles('visitante', +1)}
              >
                <Text style={styles.golesBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          )}
          {disabled && (
            <Text style={[styles.golesReadOnly, visitanteSelected && styles.golesNumWinner]}>
              {golesVisitante}
            </Text>
          )}
        </View>
      </View>

      {/* Hint inferior */}
      <View style={styles.hintRow}>
        <Text style={styles.hintText}>
          {prediccion
            ? `🎯 ${prediccion === 'local' ? partido.equipo_local : prediccion === 'visitante' ? partido.equipo_visitante : 'Empate'}  •  ${golesLocal + golesVisitante} goles totales`
            : 'Ajusta el marcador para hacer tu predicción'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#12151C',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#22252E',
  },
  cardSeleccionado: {
    borderColor: '#1E2E1E',
  },

  // Cabecera
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  numBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#1E2128',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },
  numText:       { color: '#606060', fontSize: 10, fontWeight: 'bold' },
  fecha:         { color: '#505050', fontSize: 11, flex: 1 },
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
  resultBadgeText:       { color: '#2ECC71', fontSize: 11, fontWeight: 'bold' },
  resultBadgeTextEmpate: { color: '#F39C12' },
  pendienteBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#1A1D24',
    borderWidth: 1, borderColor: '#2A2D35',
    justifyContent: 'center', alignItems: 'center',
  },
  pendienteText: { color: '#404040', fontSize: 13, fontWeight: 'bold' },

  // Equipos
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderRadius: 10,
  },
  teamBlockRight:  {},
  teamBlockWinner: {
    backgroundColor: 'rgba(46,204,113,0.06)',
  },
  teamName: {
    color: '#808080',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  teamNameRight:  { textAlign: 'center' },
  teamNameWinner: { color: '#E0E0E0' },

  // Controles goles
  golesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  golesBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#1A1D24',
    borderWidth: 1, borderColor: '#2A2D35',
    justifyContent: 'center', alignItems: 'center',
  },
  golesBtnTxt:      { color: '#C0C0C0', fontSize: 18, lineHeight: 20, fontWeight: '300' },
  golesBtnDisabled: { color: '#2A2D35' },
  golesBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#1A1D24',
    borderWidth: 1.5, borderColor: '#2A2D35',
    justifyContent: 'center', alignItems: 'center',
  },
  golesBoxWinner: {
    borderColor: '#2ECC71',
    backgroundColor: 'rgba(46,204,113,0.1)',
  },
  golesNum:       { color: '#808080', fontSize: 20, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  golesNumWinner: { color: '#2ECC71' },

  // Modo solo lectura (disabled)
  golesReadOnly: {
    color: '#606060',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },

  // Centro
  centerCol: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  vsText:            { color: '#303030', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  empatePill: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(243,156,18,0.15)',
    borderWidth: 1, borderColor: '#F39C12',
    justifyContent: 'center', alignItems: 'center',
  },
  empateText:       { color: '#F39C12', fontSize: 13, fontWeight: 'bold' },
  flechaLocal:      { color: '#2ECC71', fontSize: 16 },
  flechaVisitante:  { color: '#2ECC71', fontSize: 16 },
  flechaInactiva:   { color: '#303030', fontSize: 14 },

  // Hint
  hintRow: {
    borderTopWidth: 1,
    borderTopColor: '#1A1D24',
    paddingTop: 8,
    alignItems: 'center',
  },
  hintText: { color: '#404040', fontSize: 11 },
});
