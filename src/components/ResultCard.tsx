import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, LayoutAnimation } from 'react-native';
import { colors, spacing, radii, text } from '../theme';
import { common, layout } from '../styles';

interface Partido {
  equipo_local: string; equipo_visitante: string;
  fecha_partido: string; resultado: 'local' | 'empate' | 'visitante' | null;
}
interface Seleccion {
  partido_id: string; prediccion: 'local' | 'empate' | 'visitante';
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
  pos === 1 ? colors.notifGanador : pos === 2 ? '#C0C0C0' : pos === 3 ? '#CD7F32' : colors.notifCerrada;

const pctColor = (pct: number) =>
  pct >= 70 ? colors.success : pct >= 40 ? colors.warning : colors.error;

export default function ResultCard({
  quiniela, participacion, selecciones, modo, ganador, posicion, totalJugadores,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  const sels       = selecciones.filter(s => s.partidos != null);
  const totalSels  = sels.length;
  const conRes     = sels.filter(s => s.partidos!.resultado !== null);
  const aciertos   = conRes.filter(s => s.prediccion === s.partidos!.resultado).length;
  const pendientes = totalSels - conRes.length;
  const pct        = conRes.length > 0 ? Math.round((aciertos / conRes.length) * 100) : 0;

  const esGanador  = participacion.estado === 'ganador';
  const esPerdedor = participacion.estado === 'perdedor';
  const premio     = participacion.premio_ganado ?? 0;
  const pagado     = participacion.monto_pagado ?? quiniela?.precio_entrada ?? 0;
  const fecha      = new Date(participacion.created_at).toLocaleDateString('es-MX', { dateStyle: 'medium' });

  const neonBorder = esGanador ? colors.notifGanador : modo === 'en_juego' ? colors.info : colors.border;
  const neonShadow = esGanador ? colors.notifGanador : modo === 'en_juego' ? colors.info : 'transparent';

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandido(p => !p);
  };

  return (
    <View style={[s.card, { borderColor: neonBorder, shadowColor: neonShadow }]}>
      <View style={[s.neonLine, { backgroundColor: neonBorder, shadowColor: neonBorder }]} />

      <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={s.headerTouch}>
        <View style={[layout.row, { gap: spacing.sm }]}>
          <View style={layout.flex1}>
            <Text style={[text.itemTitle, common.textPrimary]} numberOfLines={1}>
              {quiniela?.titulo ?? '—'}
            </Text>
            <Text style={[text.caption, { color: colors.textFaint, marginTop: spacing.xxs }]}>{fecha}</Text>
          </View>

          {modo === 'historial' ? (
            <View style={s.aciBox}>
              <Text style={[s.bigNum, { color: pctColor(pct) }]}>{aciertos}</Text>
              <Text style={[text.caption, common.textFaint]}>/{totalSels}</Text>
            </View>
          ) : (
            <View style={s.aciBox}>
              <Text style={[s.bigNum, { color: colors.info }]}>{pendientes}</Text>
              <Text style={[text.caption, common.textFaint]}>pend.</Text>
            </View>
          )}
          <Text style={[text.caption, common.textFaint]}>{expandido ? '▲' : '▼'}</Text>
        </View>

        {/* Historial meta */}
        {modo === 'historial' && (
          <View style={[layout.col, { gap: spacing.sm, marginTop: spacing.md }]}>
            {posicion != null && (
              <View style={[common.badge, { borderWidth: 1, borderColor: NEON_POS(posicion), flexDirection: 'row', alignItems: 'baseline', gap: 2 }]}>
                <Text style={[text.sectionTitle, { color: NEON_POS(posicion), textShadowColor: NEON_POS(posicion), textShadowRadius: 6 }]}>#{posicion}</Text>
                <Text style={[text.caption, { color: NEON_POS(posicion), opacity: 0.6 }]}>/{totalJugadores ?? '?'}</Text>
              </View>
            )}

            {esGanador && (
              <View style={[common.badge, { backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: colors.notifGanador }]}>
                <Text style={[text.label, { color: colors.notifGanador, letterSpacing: 0.5 }]}>
                  🏆 GANADOR{premio > 0 ? `  $${premio.toLocaleString()}` : ''}
                </Text>
              </View>
            )}
            {esPerdedor && !esGanador && (
              <View style={[common.badge, { backgroundColor: 'rgba(100,100,100,0.1)', borderWidth: 1, borderColor: colors.textFaint }]}>
                <Text style={[text.label, { color: colors.textFaint, letterSpacing: 1 }]}>FINALIZADO</Text>
              </View>
            )}

            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${pct}%`, backgroundColor: pctColor(pct), shadowColor: pctColor(pct), shadowOpacity: 0.8, shadowRadius: 4 }]} />
            </View>
            <Text style={[text.caption, { color: colors.textFaint, letterSpacing: 0.5 }]}>
              {conRes.length > 0 ? `${aciertos}/${conRes.length} partidos jugados · ${pct}% acierto` : 'Sin resultados cargados aún'}
            </Text>

            {ganador && (
              <View style={layout.row}>
                <Text style={[text.body, common.textFaint]}>🏆 Ganó: </Text>
                <Text style={[text.bodySemibold, { color: colors.notifGanador, textShadowColor: colors.notifGanador, textShadowRadius: 6 }]}>@{ganador.username}</Text>
                <Text style={[text.body, common.textFaint]}> ({ganador.aciertos} aciertos)</Text>
              </View>
            )}

            <View style={[layout.row, { gap: spacing.sm }]}>
              <Text style={[text.caption, common.textFaint]}>Entrada: <Text style={[text.caption, { color: colors.text, fontWeight: '600' }]}>${pagado.toLocaleString()}</Text></Text>
              <Text style={[text.caption, { color: colors.border }]}>│</Text>
              <Text style={[text.caption, common.textFaint]}>Ganado: <Text style={[text.caption, { color: premio > 0 ? colors.notifGanador : colors.textFaint, fontWeight: '600' }]}>${premio.toLocaleString()}</Text></Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Detalle de picks */}
      {expandido && (
        <View style={s.body}>
          {sels.map((sel) => {
            const p = sel.partidos!;
            const tieneRes  = p.resultado !== null;
            const esAcierto = tieneRes && sel.prediccion === p.resultado;
            const esFallo   = tieneRes && sel.prediccion !== p.resultado;
            const neon = esAcierto ? colors.success : esFallo ? colors.error : colors.textFaint;
            return (
              <View key={sel.partido_id} style={[layout.row, { gap: spacing.sm, borderLeftWidth: 2, borderLeftColor: neon, paddingLeft: spacing.sm }]}>
                <View style={layout.flex1}>
                  <Text style={[text.bodySmallBold, { color: '#CCC' }]} numberOfLines={1}>
                    {p.equipo_local} <Text style={common.textFaint}>vs</Text> {p.equipo_visitante}
                  </Text>
                  {tieneRes && (
                    <Text style={[text.caption, { color: neon, marginTop: spacing.xxs }]}>
                      {esAcierto ? '✅' : '❌'} Resultado: {LABEL[p.resultado!]}
                    </Text>
                  )}
                </View>
                <View style={[common.badge, { borderWidth: 1, borderColor: neon, backgroundColor: neon + '18', minWidth: 28, alignItems: 'center' }]}>
                  <Text style={[text.body, { color: neon, fontWeight: 'bold' }]}>{LABEL[sel.prediccion]}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// Solo estilos específicos de ResultCard — los genéricos vienen de common/layout
const s = StyleSheet.create({
  card:        { backgroundColor: colors.backgroundDeep, borderRadius: radii.lg, borderWidth: 1, marginBottom: spacing.md, overflow: 'hidden', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  neonLine:    { height: 2, shadowOpacity: 0.8, shadowRadius: 6 },
  headerTouch: { padding: spacing.md },
  aciBox:      { alignItems: 'center', minWidth: 40 },
  bigNum:      { fontSize: 22, fontWeight: 'bold' },
  barTrack:    { height: 3, backgroundColor: colors.backgroundDeep, borderRadius: radii.xxs, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: radii.xxs },
  body:        { borderTopWidth: 1, borderTopColor: colors.borderSubtle, padding: spacing.md, gap: spacing.sm },
});
