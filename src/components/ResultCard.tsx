import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, LayoutAnimation } from 'react-native';

interface Partido {
  equipo_local: string;
  equipo_visitante: string;
  fecha_partido: string;
  resultado: 'local' | 'empate' | 'visitante' | null;
}

interface Seleccion {
  partido_id: string;
  prediccion: 'local' | 'empate' | 'visitante';
  partidos: Partido | null;
}

interface Props {
  quiniela: {
    titulo: string;
    precio_entrada: number;
    estado: string;
  };
  participacion: {
    id: string;
    aciertos: number | null;
    estado: string;
    premio_ganado?: number | null;
    created_at: string;
  };
  selecciones: Seleccion[];
  modo: 'en_juego' | 'historial';
  ganador?: { username: string; aciertos: number } | null;
}

const LABEL: Record<string, string> = { local: '1', empate: 'X', visitante: '2' };

export default function ResultCard({ quiniela, participacion, selecciones, modo, ganador }: Props) {
  const [expandido, setExpandido] = useState(false);

  const seleccionesValidas = selecciones.filter(s => s.partidos != null);
  const total        = seleccionesValidas.length;
  const conResultado = seleccionesValidas.filter(s => s.partidos!.resultado !== null);
  const aciertos     = conResultado.filter(s => s.prediccion === s.partidos!.resultado).length;
  const pendientes   = total - conResultado.length;

  const esGanador   = participacion.estado === 'ganador';
  const esPerdedor  = participacion.estado === 'perdedor';
  const premioGanado = participacion.premio_ganado ?? 0;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandido(prev => !prev);
  };

  const fecha = new Date(participacion.created_at).toLocaleDateString('es-MX', { dateStyle: 'medium' });

  return (
    <View style={[
      styles.card,
      modo === 'historial' ? styles.cardHistorial : styles.cardEnJuego,
      esGanador  && styles.cardGanador,
      esPerdedor && styles.cardPerdedor,
    ]}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.8}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.quinielaTitulo} numberOfLines={1}>{quiniela?.titulo ?? '—'}</Text>
            <Text style={styles.fechaText}>Participaste el {fecha}</Text>
            {/* Mostrar ganador en historial */}
            {modo === 'historial' && ganador && (
              <View style={styles.ganadorRow}>
                <Text style={styles.ganadorLabel}>🏆 Ganó: </Text>
                <Text style={styles.ganadorName}>{ganador.username}</Text>
                <Text style={styles.ganadorAciertos}> ({ganador.aciertos} aciertos)</Text>
              </View>
            )}
          </View>
          <View style={styles.statsBox}>
            {modo === 'historial' ? (
              <View style={styles.aciertosBox}>
                <Text style={styles.aciertosNum}>{aciertos}</Text>
                <Text style={styles.aciertosLabel}>/{total}</Text>
              </View>
            ) : (
              <View style={styles.pendienteBox}>
                <Text style={styles.pendienteNum}>{pendientes}</Text>
                <Text style={styles.pendienteLabel}>pendientes</Text>
              </View>
            )}
          </View>
          <Text style={styles.chevron}>{expandido ? '▲' : '▼'}</Text>
        </View>

        {/* Badge estado historial */}
        {modo === 'historial' && (
          <View style={styles.estadoRow}>
            {esGanador && (
              <View style={styles.badgeGanadorPill}>
                <Text style={styles.badgeGanadorText}>🏆 GANADOR {premioGanado > 0 ? `· $${premioGanado.toLocaleString()}` : ''}</Text>
              </View>
            )}
            {esPerdedor && (
              <View style={styles.badgePerdedorPill}>
                <Text style={styles.badgePerdedorText}>PERDEDOR</Text>
              </View>
            )}
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                { width: `${total > 0 ? (aciertos / total) * 100 : 0}%` },
                aciertos / total >= 0.7 ? styles.fillVerde : aciertos / total >= 0.4 ? styles.fillAmarillo : styles.fillRojo,
              ]} />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {expandido && (
        <View style={styles.detalleContainer}>
          {seleccionesValidas.map((s, i) => {
            const partido        = s.partidos!;
            const tieneResultado = partido.resultado !== null;
            const esAcierto      = tieneResultado && s.prediccion === partido.resultado;
            const esFallo        = tieneResultado && s.prediccion !== partido.resultado;
            return (
              <View key={s.partido_id} style={styles.seleccionRow}>
                <Text style={styles.seleccionNum}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.seleccionEquipos} numberOfLines={1}>
                    {partido.equipo_local} vs {partido.equipo_visitante}
                  </Text>
                </View>
                <View style={[
                  styles.pronosticoBadge,
                  esAcierto && styles.badgeVerde,
                  esFallo   && styles.badgeRojo,
                  !tieneResultado && styles.badgePendiente,
                ]}>
                  <Text style={[
                    styles.pronosticoText,
                    esAcierto && { color: '#2ECC71' },
                    esFallo   && { color: '#E91E63' },
                  ]}>
                    {LABEL[s.prediccion] ?? s.prediccion}
                  </Text>
                </View>
                <Text style={styles.resultadoIcon}>
                  {tieneResultado ? (esAcierto ? '✅' : '❌') : '⏳'}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card:              { borderRadius: 16, padding: 15, marginBottom: 14, borderWidth: 1.5, backgroundColor: '#15181F' },
  cardEnJuego:       { borderColor: '#3498DB' },
  cardHistorial:     { borderColor: '#2A2D35' },
  cardGanador:       { borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.04)' },
  cardPerdedor:      { borderColor: '#2A2D35', opacity: 0.8 },
  cardHeader:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quinielaTitulo:    { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  fechaText:         { color: '#707070', fontSize: 11, marginTop: 2 },
  ganadorRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  ganadorLabel:      { color: '#F39C12', fontSize: 12, fontWeight: 'bold' },
  ganadorName:       { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  ganadorAciertos:   { color: '#707070', fontSize: 11 },
  statsBox:          { alignItems: 'center' },
  aciertosBox:       { flexDirection: 'row', alignItems: 'baseline' },
  aciertosNum:       { color: '#2ECC71', fontSize: 22, fontWeight: 'bold' },
  aciertosLabel:     { color: '#A0A0A0', fontSize: 13 },
  pendienteBox:      { alignItems: 'center' },
  pendienteNum:      { color: '#3498DB', fontSize: 22, fontWeight: 'bold' },
  pendienteLabel:    { color: '#A0A0A0', fontSize: 10 },
  chevron:           { color: '#505050', fontSize: 12, marginLeft: 4 },
  estadoRow:         { marginTop: 10, gap: 6 },
  badgeGanadorPill:  { alignSelf: 'flex-start', backgroundColor: 'rgba(243,156,18,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#F39C12' },
  badgeGanadorText:  { color: '#F39C12', fontSize: 11, fontWeight: 'bold' },
  badgePerdedorPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#404040' },
  badgePerdedorText: { color: '#606060', fontSize: 11, fontWeight: 'bold' },
  progressTrack:     { height: 4, backgroundColor: '#1C1F26', borderRadius: 2, overflow: 'hidden' },
  progressFill:      { height: '100%', borderRadius: 2 },
  fillVerde:         { backgroundColor: '#2ECC71' },
  fillAmarillo:      { backgroundColor: '#F39C12' },
  fillRojo:          { backgroundColor: '#E91E63' },
  detalleContainer:  { marginTop: 12, borderTopWidth: 1, borderTopColor: '#2A2D35', paddingTop: 12, gap: 10 },
  seleccionRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seleccionNum:      { color: '#505050', fontSize: 11, width: 18, textAlign: 'right' },
  seleccionEquipos:  { color: '#A0A0A0', fontSize: 12 },
  pronosticoBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#2A2D35', minWidth: 32, alignItems: 'center' },
  badgeVerde:        { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.1)' },
  badgeRojo:         { borderColor: '#E91E63', backgroundColor: 'rgba(233,30,99,0.1)' },
  badgePendiente:    { borderColor: '#3498DB', backgroundColor: 'rgba(52,152,219,0.1)' },
  pronosticoText:    { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  resultadoIcon:     { fontSize: 14 },
});
