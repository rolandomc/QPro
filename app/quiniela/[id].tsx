import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, RefreshControl, Animated, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/config/supabase';

const LABEL: Record<string, string>     = { local: '1', empate: 'X', visitante: '2' };
const RES_LABEL: Record<string, string>  = { local: 'Local', empate: 'Empate', visitante: 'Visitante' };
const PICK_EMOJI: Record<string, string> = { local: '🏠', empate: '🤝', visitante: '✈️' };

// ── StatusPill ────────────────────────────────────────────────────────────────
function StatusPill({ estado }: { estado: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    abierta:    { color: '#2ECC71', label: 'EN VIVO' },
    cerrada:    { color: '#00E5FF', label: 'CERRADA' },
    finalizada: { color: '#9B59B6', label: 'FINALIZADA' },
  };
  const c = cfg[estado] ?? { color: '#606060', label: estado.toUpperCase() };
  return (
    <View style={[pill.wrap, { borderColor: c.color }]}>
      {estado === 'abierta' && <View style={[pill.dot, { backgroundColor: c.color }]} />}
      <Text style={[pill.txt, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20,
          paddingHorizontal: 10, paddingVertical: 3, gap: 5, alignSelf: 'flex-start' },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  txt:  { fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5 },
});

// ── RankRow ───────────────────────────────────────────────────────────────────
function RankRow({ item, totalPartidos, isLast }: {
  item: any; totalPartidos: number; isLast?: boolean;
}) {
  const flashAnim   = useRef(new Animated.Value(0)).current;
  const prevAciertos = useRef(item.aciertos);

  useEffect(() => {
    if (item.aciertos !== prevAciertos.current) {
      prevAciertos.current = item.aciertos;
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]).start();
    }
  }, [item.aciertos]);

  const posColor = item.pos === 1 ? '#FFD700' : item.pos === 2 ? '#C0C0C0' : item.pos === 3 ? '#CD7F32' : '#404060';
  const medalla  = item.pos === 1 ? '🥇' : item.pos === 2 ? '🥈' : item.pos === 3 ? '🥉' : `#${item.pos}`;
  const pct      = totalPartidos > 0 ? (item.aciertos ?? 0) / totalPartidos : 0;
  const barColor = item.isMe ? '#9B59B6' : posColor;
  const flashBg  = flashAnim.interpolate({ inputRange: [0, 1],
    outputRange: ['transparent', 'rgba(46,204,113,0.12)'] });

  return (
    <Animated.View style={[
      s.rankRow,
      item.isMe && { borderColor: '#9B59B6', backgroundColor: 'rgba(155,89,182,0.08)' },
      isLast && { marginBottom: 0 },
      { backgroundColor: flashBg as any },
    ]}>
      {item.separador && (
        <View style={s.separador}>
          <View style={s.separadorLine} />
          <Text style={s.separadorTxt}>···</Text>
          <View style={s.separadorLine} />
        </View>
      )}
      <View style={s.rankInner}>
        <Text style={[s.rankPos, { color: posColor, fontSize: item.pos <= 3 ? 22 : 14 }]}>{medalla}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.rankName, item.isMe && { color: '#9B59B6' }]}>
            {item.username}{item.isMe ? '  (Tú)' : ''}
          </Text>
          <View style={s.rankBarWrap}>
            <View style={[s.rankBarFill, {
              width: `${Math.round(pct * 100)}%`,
              backgroundColor: barColor,
              shadowColor: barColor, shadowOpacity: 0.6, shadowRadius: 4,
            }]} />
          </View>
          {item.estado === 'ganador' && <Text style={s.rankGanador}>🏆 GANADOR</Text>}
        </View>
        <View style={[s.rankAciBox, { borderColor: posColor + '55' }]}>
          <Text style={[s.rankAciNum, { color: item.isMe ? '#9B59B6' : posColor }]}>
            {item.aciertos ?? 0}
          </Text>
          <Text style={s.rankAciLbl}>/{totalPartidos}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function QuinielaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const [quiniela,   setQuiniela]   = useState<any>(null);
  const [partidos,   setPartidos]   = useState<any[]>([]);
  const [misSelec,   setMisSelec]   = useState<Record<string, string>>({});
  const [miPart,     setMiPart]     = useState<any>(null);
  const [ranking,    setRanking]    = useState<any[]>([]);
  const [miPosicion, setMiPosicion] = useState<number | null>(null);
  const [totalParts, setTotalParts] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabActivo,  setTabActivo]  = useState<'picks' | 'ranking'>('picks');
  const [livePulse,  setLivePulse]  = useState(false);
  const [sharing,    setSharing]    = useState(false);
  const myUserId     = useRef<string | null>(null);
  const myUsername   = useRef<string>('Jugador');

  // ── Compartir quiniela ──────────────────────────────────────────────────────
  const compartirQuiniela = useCallback(async () => {
    if (!quiniela || partidos.length === 0) return;
    setSharing(true);
    try {
      const titulo   = quiniela.titulo ?? 'Quiniela';
      const bolsa    = `$${Number(quiniela.premio_total || 0).toLocaleString()}`;
      const usuario  = myUsername.current;

      // Línea por partido: número | equipos | mi pick
      const lineas = partidos.map((p: any, i: number) => {
        const pick    = misSelec[p.id];
        const pickLbl = pick ? LABEL[pick] : '?';
        const pickEmj = pick ? PICK_EMOJI[pick] : '❓';
        const tieneRes = p.resultado !== null;
        const acerto  = tieneRes && pick === p.resultado;
        const fallo   = tieneRes && pick !== p.resultado;
        const status  = tieneRes ? (acerto ? '✅' : '❌') : '⏳';
        return `${status} ${i + 1}. ${p.equipo_local} vs ${p.equipo_visitante}  →  ${pickEmj}${pickLbl}`;
      });

      // Resumen de aciertos (si la quiniela tiene resultados parciales)
      const conRes    = partidos.filter((p: any) => p.resultado !== null);
      const aciertos  = conRes.filter((p: any) => misSelec[p.id] === p.resultado).length;
      const resumen   = conRes.length > 0
        ? `\n🎯 Aciertos: ${aciertos}/${conRes.length}  (${Math.round((aciertos / conRes.length) * 100)}%)`
        : '';

      const posicionTxt = miPosicion ? `\n🏅 Posición: #${miPosicion} de ${totalParts}` : '';

      const mensaje =
`🏆 *${titulo}*
💰 Bolsa: ${bolsa}  |  👤 ${usuario}
${'─'.repeat(30)}
${lineas.join('\n')}${resumen}${posicionTxt}
${'─'.repeat(30)}
📲 Únete a QPro y participa!`;

      await Share.share({ message: mensaje, title: titulo });
    } catch (e: any) {
      if (e.message !== 'User did not share') {
        Alert.alert('Error', 'No se pudo compartir la quiniela.');
      }
    } finally {
      setSharing(false);
    }
  }, [quiniela, partidos, misSelec, miPosicion, totalParts]);

  // ── Cargar ranking ──────────────────────────────────────────────────────────
  const loadRanking = useCallback(async (userId: string, _n: number) => {
    const { count } = await supabase
      .from('participaciones')
      .select('id', { count: 'exact', head: true })
      .eq('quiniela_id', id!);
    setTotalParts(count ?? 0);

    const { data: rank } = await supabase
      .from('participaciones')
      .select('user_id, aciertos, estado')
      .eq('quiniela_id', id!)
      .order('aciertos', { ascending: false })
      .limit(20);

    if (!rank || rank.length === 0) { setRanking([]); return; }

    const uids = rank.map((r: any) => r.user_id);
    const { data: profs } = await supabase
      .from('profiles').select('id, username').in('id', uids);
    const pm: Record<string, string> = {};
    (profs || []).forEach((p: any) => { pm[p.id] = p.username; });

    const rows = rank.map((r: any, i: number) => ({
      ...r, username: pm[r.user_id] ?? 'Usuario', pos: i + 1, isMe: r.user_id === userId,
    }));

    const yoEnTop = rows.find((r: any) => r.isMe);
    if (!yoEnTop) {
      const { data: miRow } = await supabase
        .from('participaciones')
        .select('user_id, aciertos, estado')
        .eq('quiniela_id', id!).eq('user_id', userId).single();
      if (miRow) {
        const { count: porDelante } = await supabase
          .from('participaciones')
          .select('id', { count: 'exact', head: true })
          .eq('quiniela_id', id!).gt('aciertos', miRow.aciertos ?? 0);
        const miPos = (porDelante ?? 0) + 1;
        setMiPosicion(miPos);
        rows.push({ ...miRow, username: pm[userId] ?? 'Tú', pos: miPos, isMe: true, separador: true });
      }
    } else {
      setMiPosicion(yoEnTop.pos);
    }

    setRanking(rows);
    setLivePulse(true);
    setTimeout(() => setLivePulse(false), 800);
  }, [id]);

  // ── Carga principal ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      myUserId.current = user?.id ?? null;

      const [{ data: q }, { data: pts }] = await Promise.all([
        supabase.from('quinielas').select('*').eq('id', id!).single(),
        supabase.from('partidos').select('*').eq('quiniela_id', id!).order('orden', { ascending: true }),
      ]);
      setQuiniela(q);
      setPartidos(pts || []);

      if (!user) return;

      // Perfil del usuario para mostrar en el share
      const { data: myProf } = await supabase
        .from('profiles').select('username').eq('id', user.id).single();
      myUsername.current = myProf?.username ?? 'Jugador';

      const { data: part } = await supabase
        .from('participaciones')
        .select('id, aciertos, estado, premio_ganado, monto_pagado')
        .eq('quiniela_id', id!).eq('user_id', user.id).single();
      setMiPart(part ?? null);

      if (part) {
        const { data: sels } = await supabase
          .from('selecciones').select('partido_id, prediccion')
          .eq('participacion_id', part.id);
        const map: Record<string, string> = {};
        (sels || []).forEach((s: any) => { map[s.partido_id] = s.prediccion; });
        setMisSelec(map);
      }

      await loadRanking(user.id, (pts || []).length);
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, loadRanking]);

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    load();
    const channel = supabase
      .channel(`ranking-${id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'participaciones', filter: `quiniela_id=eq.${id}` },
        () => { if (myUserId.current) loadRanking(myUserId.current, 0); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const totalPartidos = partidos.length;
  const conResultado  = partidos.filter(p => p.resultado !== null);
  const misAciertos   = conResultado.filter(p => misSelec[p.id] === p.resultado).length;
  const pendientes    = totalPartidos - conResultado.length;
  const pct           = conResultado.length > 0 ? Math.round((misAciertos / conResultado.length) * 100) : 0;
  const pctColor      = pct >= 70 ? '#2ECC71' : pct >= 40 ? '#F39C12' : '#E91E63';

  if (loading) return (
    <SafeAreaView style={s.container}>
      <View style={s.centered}><ActivityIndicator size="large" color="#9B59B6" /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{quiniela?.titulo ?? 'Quiniela'}</Text>
          {quiniela && <StatusPill estado={quiniela.estado} />}
        </View>
        <View style={s.bolsaBox}>
          <Text style={s.bolsaVal}>${Number(quiniela?.premio_total || 0).toLocaleString()}</Text>
          <Text style={s.bolsaLbl}>BOLSA</Text>
        </View>
        {/* Botón compartir */}
        {miPart && (
          <TouchableOpacity
            onPress={compartirQuiniela}
            disabled={sharing}
            style={[s.shareBtn, sharing && { opacity: 0.5 }]}
            activeOpacity={0.7}
          >
            <Text style={s.shareBtnTxt}>{sharing ? '⏳' : '📤'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }} tintColor="#9B59B6" />
        }
      >
        {/* ── Mi resumen ── */}
        {miPart && (
          <View style={s.resumenCard}>
            <View style={s.resumenNeonLine} />
            <View style={s.resumenBody}>
              <View style={s.resumenStat}>
                <Text style={[s.resumenNum, { color: pctColor, textShadowColor: pctColor, textShadowRadius: 8 }]}>
                  {misAciertos}
                </Text>
                <Text style={s.resumenLbl}>ACIERTOS</Text>
              </View>
              <View style={s.resumenDiv} />
              <View style={s.resumenStat}>
                <Text style={[s.resumenNum, { color: '#00E5FF', textShadowColor: '#00E5FF', textShadowRadius: 8 }]}>
                  {pendientes}
                </Text>
                <Text style={s.resumenLbl}>PENDIENTES</Text>
              </View>
              <View style={s.resumenDiv} />
              <View style={s.resumenStat}>
                <Text style={[s.resumenNum, { color: pctColor }]}>{pct}%</Text>
                <Text style={s.resumenLbl}>ACIERTO</Text>
              </View>
              {miPart.estado === 'ganador' && (
                <>
                  <View style={s.resumenDiv} />
                  <View style={s.resumenStat}>
                    <Text style={[s.resumenNum, { color: '#FFD700', textShadowColor: '#FFD700', textShadowRadius: 10 }]}>
                      ${Number(miPart.premio_ganado || 0).toLocaleString()}
                    </Text>
                    <Text style={s.resumenLbl}>GANADO</Text>
                  </View>
                </>
              )}
            </View>
            <View style={s.barWrap}>
              <View style={[s.barFill, {
                width: `${pct}%`, backgroundColor: pctColor,
                shadowColor: pctColor, shadowOpacity: 0.8, shadowRadius: 6,
              }]} />
            </View>
          </View>
        )}

        {/* ── Tabs ── */}
        <View style={s.tabs}>
          {(['picks', 'ranking'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tabActivo === t && s.tabActivo]}
              onPress={() => setTabActivo(t)}
            >
              <Text style={[s.tabTxt, tabActivo === t && s.tabTxtActivo]}>
                {t === 'picks' ? '🎯 MIS PICKS' : '🏆 RANKING'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── TAB PICKS ── */}
        {tabActivo === 'picks' && (
          <View style={s.section}>
            {partidos.map((p, i) => {
              const miPick   = misSelec[p.id];
              const tieneRes = p.resultado !== null;
              const esAcierto = tieneRes && miPick === p.resultado;
              const esFallo   = tieneRes && miPick !== p.resultado;
              const neon = esAcierto ? '#2ECC71' : esFallo ? '#E91E63' : '#00E5FF';
              const icon = tieneRes ? (esAcierto ? '✅' : '❌') : '⏳';
              return (
                <View key={p.id} style={[s.partidoCard, { borderLeftColor: neon, shadowColor: neon }]}>
                  <View style={s.partidoTop}>
                    <Text style={s.partidoNum}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.partidoEquipos}>
                        {p.equipo_local} <Text style={s.vsText}>vs</Text> {p.equipo_visitante}
                      </Text>
                      {tieneRes && (
                        <Text style={[s.resultadoTxt, { color: '#606060' }]}>
                          Resultado: <Text style={{ color: neon }}>{RES_LABEL[p.resultado]}</Text>
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 18 }}>{icon}</Text>
                  </View>
                  <View style={s.opcionesRow}>
                    {['local', 'empate', 'visitante'].map(op => {
                      const isMiPick  = miPick === op;
                      const isCorrect = tieneRes && p.resultado === op;
                      const opNeon = isMiPick
                        ? (tieneRes ? (isCorrect ? '#2ECC71' : '#E91E63') : '#00E5FF')
                        : (isCorrect ? 'rgba(46,204,113,0.4)' : '#1E2330');
                      return (
                        <View key={op} style={[s.opcion, {
                          borderColor: opNeon,
                          backgroundColor: isMiPick
                            ? (tieneRes ? (isCorrect ? 'rgba(46,204,113,0.12)' : 'rgba(233,30,99,0.1)') : 'rgba(0,229,255,0.08)')
                            : 'transparent',
                        }]}>
                          <Text style={[s.opcionLabel, { color: opNeon }]}>{LABEL[op]}</Text>
                          {isMiPick && <Text style={[s.miPickDot, { color: opNeon }]}>●</Text>}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Botón compartir en la parte de abajo de los picks */}
            {miPart && (
              <TouchableOpacity
                onPress={compartirQuiniela}
                disabled={sharing}
                style={[s.shareFullBtn, sharing && { opacity: 0.5 }]}
                activeOpacity={0.75}
              >
                <Text style={s.shareFullBtnTxt}>
                  {sharing ? 'Preparando…' : '📤  Compartir mis picks'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── TAB RANKING ── */}
        {tabActivo === 'ranking' && (
          <View style={s.section}>
            <View style={s.rankHeader}>
              <View style={s.rankHeaderLeft}>
                <View style={[s.liveIndicator, livePulse && s.liveIndicatorPulse]} />
                <Text style={s.rankHeaderTitle}>EN VIVO</Text>
              </View>
              <View style={s.rankHeaderRight}>
                {miPosicion && (
                  <Text style={s.miPosText}>
                    Tu posición: <Text style={{ color: '#9B59B6' }}>#{miPosicion}</Text>
                  </Text>
                )}
                <Text style={s.totalPartsText}>{totalParts} participantes</Text>
              </View>
            </View>

            {ranking.length === 0 ? (
              <View style={s.emptyRank}>
                <Text style={s.emptyIcon}>🏟️</Text>
                <Text style={s.emptyTxt}>Sin participantes aún</Text>
              </View>
            ) : ranking.map((r, i) => (
              <RankRow
                key={r.user_id + '_' + r.pos}
                item={r}
                totalPartidos={totalPartidos}
                isLast={i === ranking.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0A0C10' },
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:             { padding: 14, paddingBottom: 40 },

  // Header
  header:             { flexDirection: 'row', alignItems: 'center', padding: 16,
                        borderBottomWidth: 1, borderBottomColor: '#1E2330', gap: 10 },
  backBtn:            { width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
                        backgroundColor: '#15181F', borderRadius: 10, borderWidth: 1, borderColor: '#2A2D35' },
  backTxt:            { color: '#9B59B6', fontSize: 18, fontWeight: 'bold' },
  headerTitle:        { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  bolsaBox:           { alignItems: 'flex-end' },
  bolsaVal:           { color: '#2ECC71', fontSize: 18, fontWeight: 'bold',
                        textShadowColor: '#2ECC71', textShadowRadius: 8 },
  bolsaLbl:           { color: '#2ECC71', fontSize: 8, letterSpacing: 2, opacity: 0.7 },
  shareBtn:           { width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
                        backgroundColor: '#15181F', borderRadius: 10, borderWidth: 1, borderColor: '#9B59B655' },
  shareBtnTxt:        { fontSize: 18 },

  // Resumen
  resumenCard:        { backgroundColor: '#0D1117', borderRadius: 16, marginBottom: 16,
                        borderWidth: 1, borderColor: '#1E2330', overflow: 'hidden',
                        shadowColor: '#9B59B6', shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  resumenNeonLine:    { height: 2, backgroundColor: '#9B59B6',
                        shadowColor: '#9B59B6', shadowOpacity: 1, shadowRadius: 8 },
  resumenBody:        { flexDirection: 'row', padding: 16, alignItems: 'center' },
  resumenStat:        { flex: 1, alignItems: 'center' },
  resumenNum:         { fontSize: 22, fontWeight: 'bold' },
  resumenLbl:         { color: '#404040', fontSize: 8, letterSpacing: 1.5, marginTop: 3 },
  resumenDiv:         { width: 1, height: 32, backgroundColor: '#1E2330' },
  barWrap:            { height: 3, backgroundColor: '#1A1D24' },
  barFill:            { height: '100%' },

  // Tabs
  tabs:               { flexDirection: 'row', backgroundColor: '#0D1117', borderRadius: 12,
                        padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#1E2330' },
  tab:                { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActivo:          { backgroundColor: '#1A1D26' },
  tabTxt:             { color: '#404040', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  tabTxtActivo:       { color: '#9B59B6', textShadowColor: '#9B59B6', textShadowRadius: 6 },

  section:            { gap: 8 },

  // Picks
  partidoCard:        { backgroundColor: '#0D1117', borderRadius: 14,
                        borderWidth: 1, borderColor: '#1E2330', borderLeftWidth: 3,
                        padding: 14, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  partidoTop:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  partidoNum:         { color: '#303030', fontSize: 11, width: 18, textAlign: 'center' },
  partidoEquipos:     { color: '#FFF', fontSize: 13, fontWeight: '600' },
  vsText:             { color: '#303030', fontWeight: 'normal' },
  resultadoTxt:       { fontSize: 11, marginTop: 3 },
  opcionesRow:        { flexDirection: 'row', gap: 8 },
  opcion:             { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
                        alignItems: 'center', justifyContent: 'center', gap: 2 },
  opcionLabel:        { fontSize: 15, fontWeight: 'bold' },
  miPickDot:          { fontSize: 7 },

  // Botón compartir (ancho completo, al pie de los picks)
  shareFullBtn:       { marginTop: 8, backgroundColor: '#13111A', borderRadius: 14,
                        borderWidth: 1, borderColor: '#9B59B655', paddingVertical: 14,
                        alignItems: 'center',
                        shadowColor: '#9B59B6', shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  shareFullBtnTxt:    { color: '#9B59B6', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },

  // Ranking header
  rankHeader:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        backgroundColor: '#0D1117', borderRadius: 12, padding: 12, marginBottom: 4,
                        borderWidth: 1, borderColor: '#1E2330' },
  rankHeaderLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveIndicator:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC71',
                        shadowColor: '#2ECC71', shadowOpacity: 0.8, shadowRadius: 4 },
  liveIndicatorPulse: { shadowOpacity: 1, shadowRadius: 10 },
  rankHeaderTitle:    { color: '#2ECC71', fontSize: 11, fontWeight: 'bold', letterSpacing: 2 },
  rankHeaderRight:    { alignItems: 'flex-end', gap: 2 },
  miPosText:          { color: '#A0A0A0', fontSize: 12 },
  totalPartsText:     { color: '#505050', fontSize: 10, letterSpacing: 1 },

  // Ranking rows
  rankRow:            { backgroundColor: '#0D1117', borderRadius: 14, borderWidth: 1,
                        borderColor: '#1E2330', overflow: 'hidden' },
  rankInner:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rankPos:            { width: 36, textAlign: 'center', fontWeight: 'bold' },
  rankName:           { color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  rankBarWrap:        { height: 3, backgroundColor: '#1A1D24', borderRadius: 2, overflow: 'hidden' },
  rankBarFill:        { height: '100%', borderRadius: 2 },
  rankGanador:        { color: '#FFD700', fontSize: 10, letterSpacing: 1, marginTop: 4 },
  rankAciBox:         { alignItems: 'center', borderWidth: 1, borderRadius: 10,
                        paddingHorizontal: 10, paddingVertical: 6, minWidth: 52 },
  rankAciNum:         { fontSize: 20, fontWeight: 'bold' },
  rankAciLbl:         { color: '#404040', fontSize: 9, letterSpacing: 0.5 },

  // Separador fuera del top
  separador:          { flexDirection: 'row', alignItems: 'center', gap: 8,
                        paddingHorizontal: 14, paddingTop: 8, marginTop: -8 },
  separadorLine:      { flex: 1, height: 1, backgroundColor: '#1E2330' },
  separadorTxt:       { color: '#303030', fontSize: 12, letterSpacing: 3 },

  // Empty ranking
  emptyRank:          { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyIcon:          { fontSize: 40 },
  emptyTxt:           { color: '#404040', textAlign: 'center', letterSpacing: 1, fontSize: 13 },
});
