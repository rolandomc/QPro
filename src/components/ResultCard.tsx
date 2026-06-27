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

  const sels      = selecciones.filter(s => s.partidos != null);
  const totalSels = sels.length;
  const conRes    = sels.filter(s => s.partidos!.resultado !== null);
  const aciertos  = conRes.filter(s => s.prediccion === s.partidos!.resultado).length;
  const pendientes = totalSels - conRes.length;
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
                }]}>@{ganador.username}</Text>
                <Text style={c.ganadorAci}> ({ganador.aciertos} aciertos)</Text>
              </View>
            )}

            <View style={c.finRow}>
              <Text style={c.finItem}>Entrada: <Text style={c.finVal}>${pagado.toLocaleString()}</Text></Text>
              <Text style={c.finSep}>│</Text>
              <Text style={c.finItem}>Ganado: <Text style={[c.finVal, { color: premio > 0 ? '#FFD700' : '#404040' }]}>${premio.toLocaleString()}</Text></Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {expandido && (
        <View style={c.body}>
          {sels.map((sel) => {
            const p = sel.partidos!;
            const tieneRes = p.resultado !== null;
            const esAcierto = tieneRes && sel.prediccion === p.resultado;
            const esFallo   = tieneRes && sel.prediccion !== p.resultado;
            const neon = esAcierto ? '#2ECC71' : esFallo ? '#E91E63' : '#404040';
            return (
              <View key={sel.partido_id} style={[c.selRow, { borderLeftColor: neon }]}>
                <View style={{ flex: 1 }}>
                  <Text style={c.selEquipos} numberOfLines={1}>
                    {p.equipo_local} <Text style={c.selVs}>vs</Text> {p.equipo_visitante}
                  </Text>
                  {tieneRes && (
                    <Text style={[c.selRes, { color: neon }]}>
                      {esAcierto ? '✅' : '❌'} Resultado: {LABEL[p.resultado!]}
                    </Text>
                  )}
                </View>
                <View style={[c.pickBadge, { borderColor: neon, backgroundColor: neon + '18' }]}>
                  <Text style={[c.pickLbl, { color: neon }]}>{LABEL[sel.prediccion]}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const c = StyleSheet.create({
  card:           { backgroundColor: '#0D1117', borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  neonLine:       { height: 2, shadowOpacity: 0.8, shadowRadius: 6 },
  headerTouch:    { padding: 14 },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titulo:         { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  fecha:          { color: '#404040', fontSize: 11, marginTop: 2 },
  aciBox:         { alignItems: 'center', minWidth: 40 },
  aciNum:         { fontSize: 22, fontWeight: 'bold' },
  aciDen:         { color: '#404040', fontSize: 11 },
  pendBox:        { alignItems: 'center', minWidth: 40 },
  pendNum:        { color: '#00E5FF', fontSize: 22, fontWeight: 'bold' },
  pendLbl:        { color: '#404040', fontSize: 10 },
  chevron:        { color: '#404040', fontSize: 12, marginLeft: 4 },
  histMeta:       { marginTop: 12, gap: 8 },
  posBadge:       { flexDirection: 'row', alignItems: 'baseline', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', gap: 1 },
  posNum:         { fontSize: 16, fontWeight: 'bold' },
  posDen:         { fontSize: 11 },
  badgeGanador:   { backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: '#FFD700', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeGanadorTxt:{ color: '#FFD700', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 },
  badgePerdedor:  { backgroundColor: 'rgba(100,100,100,0.1)', borderWidth: 1, borderColor: '#404040', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgePerdedorTxt:{ color: '#606060', fontSize: 11, letterSpacing: 1 },
  barTrack:       { height: 3, backgroundColor: '#1A1D24', borderRadius: 2, overflow: 'hidden' },
  barFill:        { height: '100%', borderRadius: 2 },
  pctTxt:         { color: '#505050', fontSize: 10, letterSpacing: 0.5 },
  ganadorRow:     { flexDirection: 'row', alignItems: 'center' },
  ganadorLbl:     { color: '#505050', fontSize: 12 },
  ganadorNombre:  { fontSize: 13, fontWeight: 'bold' },
  ganadorAci:     { color: '#505050', fontSize: 12 },
  finRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  finItem:        { color: '#505050', fontSize: 11 },
  finVal:         { color: '#FFF', fontWeight: '600' },
  finSep:         { color: '#2A2D35' },
  body:           { borderTopWidth: 1, borderTopColor: '#1A1D24', padding: 14, gap: 10 },
  selRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, borderLeftWidth: 2, paddingLeft: 10 },
  selEquipos:     { color: '#CCC', fontSize: 12, fontWeight: '600' },
  selVs:          { color: '#404040', fontWeight: 'normal' },
  selRes:         { fontSize: 10, marginTop: 2 },
  pickBadge:      { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, minWidth: 28, alignItems: 'center' },
  pickLbl:        { fontSize: 13, fontWeight: 'bold' },
});
