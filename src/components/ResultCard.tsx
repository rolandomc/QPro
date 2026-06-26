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
  quiniela:        { titulo: string; precio_entrada: number; estado: string; premio_total?: number };
  participacion:   { id: string; aciertos: number | null; estado: string; premio_ganado?: number | null; monto_pagado?: number | null; created_at: string };
  selecciones:     Seleccion[];
  modo:            'en_juego' | 'historial';
  ganador?:        { username: string; aciertos: number } | null;
  posicion?:       number | null;
  totalJugadores?: number | null;
}

const LABEL: Record<string, string> = { local: '1', empate: 'X', visitante: '2' };
const NEON_POS = (pos: number) =>
  pos === 1 ? '#FFD700' : pos === 2 ? '#C0C0C0' : pos === 3 ? '#CD7F32' : '#9B59B6';

export default function ResultCard({
  quiniela, participacion, selecciones, modo, ganador, posicion, totalJugadores,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  // Total de selecciones de esta participacion (denominador real)
  const sels      = selecciones.filter(s => s.partidos != null);
  const totalSels = sels.length; // todos los partidos de la quiniela

  // Solo los que ya tienen resultado cargado
  const conRes    = sels.filter(s => s.partidos!.resultado !== null);
  // Aciertos sobre los que ya tienen resultado
  const aciertos  = conRes.filter(s => s.prediccion === s.partidos!.resultado).length;
  // Pendientes = selecciones sin resultado aun
  const pendientes = totalSels - conRes.length;
  // % de acierto solo sobre partidos ya jugados
  const pct        = conRes.length > 0 ? Math.round((aciertos / conRes.length) * 100) : 0;

  const esGanador  = participacion.estado === 'ganador';
  const esPerdedor = participacion.estado === 'perdedor';
  const premio     = participacion.premio_ganado ?? 0;
  const pagado     = participacion.monto_pagado ?? quiniela?.precio_entrada ?? 0;
  const fecha      = new Date(participacion.created_at).toLocaleDateString('es-MX', { dateStyle: 'medium' });

  const neonBorder = esGanador ? '#FFD700' : modo === 'en_juego' ? '#00E5FF' : '#2A2D35';
  const neonShadow = esGanador ? '#FFD700' : modo === 'en_juego' ? '#00E5FF' : 'transparent';

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandido(p => !p);
  };

  return (
    <View style={[c.card, { borderColor: neonBorder, shadowColor: neonShadow }]}>
      <View style={[c.neonLine, { backgroundColor: neonBorder, shadowColor: neonBorder }]} />

      <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={c.headerTouch}>
        <View style={c.row}>
          <View style={{ flex: 1 }}>
            <Text style={c.titulo} numberOfLines={1}>{quiniela?.titulo ?? '—'}</Text>
            <Text style={c.fecha}>{fecha}</Text>
          </View>

          {/* Aciertos: X / totalSels (total partidos de la participacion) */}
          {modo === 'historial' ? (
            <View style={c.aciBox}>
              <Text style={[c.aciNum, {
                color: pct >= 70 ? '#2ECC71' : pct >= 40 ? '#F39C12' : '#E91E63',
              }]}>{aciertos}</Text>
              <Text style={c.aciDen}>/{totalSels}</Text>
            </View>
          ) : (
            <View style={c.pendBox}>
              <Text style={c.pendNum}>{pendientes}</Text>
              <Text style={c.pendLbl}>pend.</Text>
            </View>
          )}
          <Text style={c.chevron}>{expandido ? '▲' : '▼'}</Text>
        </View>

        {/* HISTORIAL: posicion + barra + ganador */}
        {modo === 'historial' && (
          <View style={c.histMeta}>
            {posicion != null && (
              <View style={[c.posBadge, { borderColor: NEON_POS(posicion) }]}>
                <Text style={[c.posNum, {
                  color: NEON_POS(posicion),
                  textShadowColor: NEON_POS(posicion),
                  textShadowRadius: 6,
                }]}>#{posicion}</Text>
                <Text style={[c.posDen, { color: NEON_POS(posicion), opacity: 0.6 }]}>
                  /{totalJugadores ?? '?'}
                </Text>
              </View>
            )}

            {esGanador && (
              <View style={c.badgeGanador}>
                <Text style={c.badgeGanadorTxt}>🏆 GANADOR{premio > 0 ? `  $${premio.toLocaleString()}` : ''}</Text>
              </View>
            )}
            {esPerdedor && !esGanador && (
              <View style={c.badgePerdedor}>
                <Text style={c.badgePerdedorTxt}>FINALIZADO</Text>
              </View>
            )}

            {/* Barra % acierto sobre partidos ya jugados */}
            <View style={c.barTrack}>
              <View style={[c.barFill, {
                width: `${pct}%`,
                backgroundColor: pct >= 70 ? '#2ECC71' : pct >= 40 ? '#F39C12' : '#E91E63',
                shadowColor:     pct >= 70 ? '#2ECC71' : pct >= 40 ? '#F39C12' : '#E91E63',
                shadowOpacity: 0.8, shadowRadius: 4,
              }]} />
            </View>
            <Text style={c.pctTxt}>
              {conRes.length > 0
                ? `${aciertos}/${conRes.length} partidos jugados · ${pct}% acierto`
                : 'Sin resultados cargados aún'}
            </Text>

            {ganador && (
              <View style={c.ganadorRow}>
                <Text style={c.ganadorLbl}>🏆 Ganó: </Text>
                <Text style={[c.ganadorNombre, {
                  color: '#FFD700', textShadowColor: '#FFD700', textShadowRadius: 6,
                }]}>{ganador.username}</Text>
                <Text style={c.ganadorAci}> ({ganador.aciertos} aciertos)</Text>
              </View>
            )}

            <View style={c.finRow}>
              <Text style={c.finItem}>Entrada: <Text style={c.finVal}>${pagado.toLocaleString()}</Text></Text>
              <Text style={c.finSep}>│</Text>
              <Text style={c.finItem}>Ganado: <Text style={[
                c.finVal, { color: premio > 0 ? '#2ECC71' : '#505050' },
              ]}>${premio.toLocaleString()}</Text></Text>
              <Text style={c.finSep}>│</Text>
              <Text style={c.finItem}>Neto: <Text style={[
                c.finVal, { color: (premio - pagado) >= 0 ? '#2ECC71' : '#E91E63' },
              ]}>{(premio - pagado) >= 0 ? '+' : ''}${(premio - pagado).toLocaleString()}</Text></Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Desglose partidos */}
      {expandido && (
        <View style={c.desglose}>
          <Text style={c.desgloseTitle}>PARTIDOS</Text>
          {sels.map((s, i) => {
            const p         = s.partidos!;
            const tieneRes  = p.resultado !== null;
            const esAcierto = tieneRes && s.prediccion === p.resultado;
            const esFallo   = tieneRes && s.prediccion !== p.resultado;
            const neonPart  = esAcierto ? '#2ECC71' : esFallo ? '#E91E63' : '#00E5FF';
            return (
              <View key={s.partido_id} style={[c.partidoRow, { borderLeftColor: neonPart, borderLeftWidth: 2 }]}>
                <Text style={c.partidoNum}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={c.partidoEquipos} numberOfLines={1}>
                    {p.equipo_local} <Text style={{ color: '#404040' }}>vs</Text> {p.equipo_visitante}
                  </Text>
                </View>
                <View style={[c.pickBadge, {
                  borderColor: neonPart + '88',
                  backgroundColor: esAcierto ? 'rgba(46,204,113,0.08)'
                    : esFallo ? 'rgba(233,30,99,0.08)' : 'rgba(0,229,255,0.06)',
                }]}>
                  <Text style={[c.pickTxt, { color: neonPart }]}>{LABEL[s.prediccion]}</Text>
                </View>
                <Text style={{ fontSize: 14, marginLeft: 4 }}>
                  {tieneRes ? (esAcierto ? '✅' : '❌') : '⏳'}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity style={c.footer} onPress={toggle}>
        <Text style={[c.footerTxt, { color: neonBorder }]}>
          {expandido ? 'OCULTAR PARTIDOS  ▲' : 'VER PARTIDOS  ▼'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const c = StyleSheet.create({
  card:             { backgroundColor: '#0D1117', borderRadius: 18, marginBottom: 16,
                      borderWidth: 1, overflow: 'hidden',
                      shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  neonLine:         { height: 2, shadowOpacity: 1, shadowRadius: 8 },
  headerTouch:      { padding: 14 },
  row:              { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  titulo:           { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  fecha:            { color: '#404040', fontSize: 11, marginTop: 1 },
  aciBox:           { flexDirection: 'row', alignItems: 'baseline' },
  aciNum:           { fontSize: 24, fontWeight: 'bold' },
  aciDen:           { color: '#404040', fontSize: 13, marginLeft: 1 },
  pendBox:          { alignItems: 'center' },
  pendNum:          { color: '#00E5FF', fontSize: 22, fontWeight: 'bold',
                      textShadowColor: '#00E5FF', textShadowRadius: 8 },
  pendLbl:          { color: '#404040', fontSize: 9, letterSpacing: 1 },
  chevron:          { color: '#303030', fontSize: 11 },
  histMeta:         { marginTop: 10, gap: 8 },
  posBadge:         { flexDirection: 'row', alignItems: 'baseline', alignSelf: 'flex-start',
                      borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  posNum:           { fontSize: 16, fontWeight: 'bold' },
  posDen:           { fontSize: 11 },
  badgeGanador:     { alignSelf: 'flex-start', backgroundColor: 'rgba(255,215,0,0.1)',
                      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3,
                      borderWidth: 1, borderColor: 'rgba(255,215,0,0.5)',
                      shadowColor: '#FFD700', shadowOpacity: 0.4, shadowRadius: 8 },
  badgeGanadorTxt:  { color: '#FFD700', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  badgePerdedor:    { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3,
                      borderWidth: 1, borderColor: '#2A2D35' },
  badgePerdedorTxt: { color: '#404040', fontSize: 10, letterSpacing: 1 },
  barTrack:         { height: 4, backgroundColor: '#1A1D24', borderRadius: 2, overflow: 'hidden' },
  barFill:          { height: '100%', borderRadius: 2 },
  pctTxt:           { color: '#404040', fontSize: 10, letterSpacing: 0.5 },
  ganadorRow:       { flexDirection: 'row', alignItems: 'center' },
  ganadorLbl:       { color: '#606060', fontSize: 12 },
  ganadorNombre:    { fontSize: 12, fontWeight: 'bold' },
  ganadorAci:       { color: '#404040', fontSize: 11 },
  finRow:           { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  finItem:          { color: '#505050', fontSize: 11 },
  finVal:           { color: '#FFF', fontWeight: 'bold' },
  finSep:           { color: '#2A2D35', fontSize: 11 },
  desglose:         { borderTopWidth: 1, borderTopColor: '#1E2330',
                      paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6, gap: 8 },
  desgloseTitle:    { color: '#303030', fontSize: 9, fontWeight: 'bold', letterSpacing: 3, marginBottom: 4 },
  partidoRow:       { flexDirection: 'row', alignItems: 'center', gap: 8,
                      backgroundColor: '#111520', borderRadius: 10, padding: 10, paddingLeft: 12 },
  partidoNum:       { color: '#303030', fontSize: 11, width: 16, textAlign: 'right' },
  partidoEquipos:   { color: '#909090', fontSize: 12 },
  pickBadge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 7,
                      borderWidth: 1, minWidth: 30, alignItems: 'center' },
  pickTxt:          { fontWeight: 'bold', fontSize: 13 },
  footer:           { paddingVertical: 10, alignItems: 'center',
                      borderTopWidth: 1, borderTopColor: '#1E2330', backgroundColor: '#0A0D14' },
  footerTxt:        { fontSize: 10, fontWeight: 'bold', letterSpacing: 2, textShadowRadius: 6 },
});
