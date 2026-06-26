import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Header from '../../src/components/Header';
import ResultCard from '../../src/components/ResultCard';
import SegmentedControl from '../../src/components/SegmentedControl';
import { supabase } from '../../src/config/supabase';

function StatBox({ valor, label, color = '#FFF', glow = false }: { valor: string; label: string; color?: string; glow?: boolean }) {
  return (
    <View style={sb.box}>
      <Text style={[
        sb.valor,
        { color },
        glow && { textShadowColor: color, textShadowRadius: 10 },
      ]}>{valor}</Text>
      <Text style={sb.label}>{label}</Text>
    </View>
  );
}

export default function ResultsScreen() {
  const [tab,             setTab]             = useState('En Juego');
  const [participaciones, setParticipaciones] = useState<any[]>([]);
  const [ganadoresMap,    setGanadoresMap]    = useState<Record<string, any>>({});
  const [posicionMap,     setPosicionMap]     = useState<Record<string, number>>({});
  const [totalJugMap,     setTotalJugMap]     = useState<Record<string, number>>({});
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('participaciones')
        .select(`
          id, aciertos, estado, premio_ganado, monto_pagado, created_at,
          quinielas ( id, titulo, precio_entrada, estado, premio_total ),
          selecciones (
            partido_id, prediccion,
            partidos ( equipo_local, equipo_visitante, fecha_partido, resultado )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setParticipaciones(data || []);

      // Quinielas finalizadas: buscar ganador + posicion + total jugadores
      const finalizadas = (data || []).filter(p =>
        p.quinielas?.estado === 'finalizada' ||
        p.estado === 'ganador' ||
        p.estado === 'perdedor'
      );
      const quinielaIds = [...new Set(finalizadas.map((p: any) => p.quinielas?.id).filter(Boolean))] as string[];

      if (quinielaIds.length > 0) {
        const gMap:  Record<string, any>    = {};
        const pMap:  Record<string, number> = {};
        const tjMap: Record<string, number> = {};

        await Promise.all(quinielaIds.map(async (qid) => {
          // Ganador
          const { data: gPart } = await supabase
            .from('participaciones')
            .select('aciertos, user_id')
            .eq('quiniela_id', qid)
            .eq('estado', 'ganador')
            .order('aciertos', { ascending: false })
            .limit(1).single();

          if (gPart) {
            const { data: prof } = await supabase
              .from('profiles').select('username').eq('id', gPart.user_id).single();
            gMap[qid] = { username: prof?.username ?? '?', aciertos: gPart.aciertos ?? 0 };
          } else { gMap[qid] = null; }

          // Ranking: solo participaciones procesadas
          const { data: ranking } = await supabase
            .from('participaciones')
            .select('user_id, aciertos')
            .eq('quiniela_id', qid)
            .in('estado', ['ganador', 'perdedor'])
            .order('aciertos', { ascending: false });

          tjMap[qid] = ranking?.length ?? 0;
          const myPart = finalizadas.find(p => p.quinielas?.id === qid);
          if (myPart && ranking) {
            const pos = ranking.findIndex((r: any) => r.user_id === user.id);
            pMap[qid] = pos >= 0 ? pos + 1 : tjMap[qid];
          }
        }));

        setGanadoresMap(gMap);
        setPosicionMap(pMap);
        setTotalJugMap(tjMap);
      }
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, []));

  const enJuego  = participaciones.filter(p => ['abierta', 'cerrada'].includes(p.quinielas?.estado));
  const historial = participaciones.filter(p =>
    p.quinielas?.estado === 'finalizada' ||
    p.estado === 'ganador' ||
    p.estado === 'perdedor'
  );
  const lista = tab === 'En Juego' ? enJuego : historial;

  // Stats solo historial
  const totalJugadas   = historial.length;
  const totalGanadas   = historial.filter(p => p.estado === 'ganador').length;
  const totalAciertos  = historial.reduce((acc: number, p: any) => {
    const sels = (p.selecciones || []).filter((s: any) => s.partidos != null);
    const con  = sels.filter((s: any) => s.partidos?.resultado !== null);
    return acc + con.filter((s: any) => s.prediccion === s.partidos?.resultado).length;
  }, 0);
  const totalPartidos  = historial.reduce((acc: number, p: any) => {
    return acc + (p.selecciones || []).filter((s: any) => s.partidos?.resultado !== null).length;
  }, 0);
  const pctAcierto     = totalPartidos > 0 ? Math.round((totalAciertos / totalPartidos) * 100) : 0;
  const totalInvertido = historial.reduce((acc: number, p: any) => acc + (p.monto_pagado ?? p.quinielas?.precio_entrada ?? 0), 0);
  const totalGanado    = historial.reduce((acc: number, p: any) => acc + (p.premio_ganado ?? 0), 0);
  const roi            = totalInvertido > 0 ? (((totalGanado - totalInvertido) / totalInvertido) * 100).toFixed(0) : '0';
  const roiNum         = Number(roi);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <Header />
      <SegmentedControl options={['En Juego', 'Historial']} selectedOption={tab} onSelect={setTab} />

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#9B59B6" />
          <Text style={s.loadingTxt}>Cargando...</Text>
        </View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#9B59B6" />}

          ListHeaderComponent={
            <>
              {tab === 'Historial' && totalJugadas > 0 && (
                <View style={s.statsCard}>
                  <View style={s.statsNeonLine} />
                  <Text style={s.statsTitle}>TUS ESTADÍSTICAS</Text>
                  <View style={s.statsGrid}>
                    <StatBox valor={String(totalJugadas)} label="Jugadas" color="#00E5FF" glow />
                    <View style={s.statsDiv} />
                    <StatBox valor={String(totalGanadas)} label="Ganadas" color="#FFD700" glow />
                    <View style={s.statsDiv} />
                    <StatBox valor={`${pctAcierto}%`} label="Acierto" color="#9B59B6" glow />
                    <View style={s.statsDiv} />
                    <StatBox
                      valor={`${roiNum >= 0 ? '+' : ''}${roi}%`}
                      label="ROI"
                      color={roiNum >= 0 ? '#2ECC71' : '#E91E63'}
                      glow
                    />
                  </View>
                  <View style={s.statsFinRow}>
                    <View style={s.statsFinBox}>
                      <Text style={s.statsFinLbl}>INVERTIDO</Text>
                      <Text style={s.statsFinVal}>${totalInvertido.toLocaleString()}</Text>
                    </View>
                    <View style={[s.statsFinBox, { borderLeftWidth: 1, borderLeftColor: '#1E2330' }]}>
                      <Text style={s.statsFinLbl}>GANADO</Text>
                      <Text style={[s.statsFinVal, { color: '#2ECC71', textShadowColor: '#2ECC71', textShadowRadius: 8 }]}>
                        ${totalGanado.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={s.sectionRow}>
                {tab === 'En Juego' ? (
                  <><View style={s.liveDot} />
                  <Text style={s.sectionTxt}>Quinielas activas</Text></>
                ) : (
                  <Text style={s.sectionTxt}>Resultados finales</Text>
                )}
                <View style={s.countPill}>
                  <Text style={s.countTxt}>{lista.length}</Text>
                </View>
              </View>
            </>
          }

          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>{tab === 'En Juego' ? '🎥' : '📊'}</Text>
              <Text style={s.emptyTitulo}>{tab === 'En Juego' ? 'Sin quinielas activas' : 'Sin historial aún'}</Text>
              <Text style={s.emptySub}>
                {tab === 'En Juego' ? 'Cuando participes aparecerá aquí.' : 'Las quinielas finalizadas aparecerán aquí.'}
              </Text>
            </View>
          }

          renderItem={({ item }) => (
            <ResultCard
              quiniela={item.quinielas}
              participacion={item}
              selecciones={item.selecciones ?? []}
              modo={tab === 'En Juego' ? 'en_juego' : 'historial'}
              ganador={ganadoresMap[item.quinielas?.id] ?? null}
              posicion={posicionMap[item.quinielas?.id] ?? null}
              totalJugadores={totalJugMap[item.quinielas?.id] ?? null}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0A0C10' },
  list:         { paddingHorizontal: 14, paddingBottom: 40, paddingTop: 8 },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingTxt:   { color: '#606060', fontSize: 13, letterSpacing: 1 },
  statsCard:    { backgroundColor: '#0D1117', borderRadius: 18, marginBottom: 18,
                  borderWidth: 1, borderColor: '#1E2330', overflow: 'hidden',
                  shadowColor: '#9B59B6', shadowOpacity: 0.2, shadowRadius: 14, elevation: 6 },
  statsNeonLine:{ height: 2, backgroundColor: '#9B59B6',
                  shadowColor: '#9B59B6', shadowOpacity: 1, shadowRadius: 8 },
  statsTitle:   { color: '#404040', fontSize: 9, fontWeight: 'bold', letterSpacing: 3,
                  textAlign: 'center', paddingTop: 14, paddingBottom: 10 },
  statsGrid:    { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 14, alignItems: 'center' },
  statsDiv:     { width: 1, height: 36, backgroundColor: '#1E2330' },
  statsFinRow:  { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1E2330' },
  statsFinBox:  { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statsFinLbl:  { color: '#404040', fontSize: 9, letterSpacing: 2, marginBottom: 4 },
  statsFinVal:  { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  liveDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC71',
                  shadowColor: '#2ECC71', shadowOpacity: 1, shadowRadius: 6 },
  sectionTxt:   { color: '#FFF', fontSize: 15, fontWeight: 'bold', flex: 1 },
  countPill:    { backgroundColor: 'rgba(155,89,182,0.15)', borderRadius: 10,
                  paddingHorizontal: 10, paddingVertical: 2,
                  borderWidth: 1, borderColor: '#9B59B6' },
  countTxt:     { color: '#9B59B6', fontWeight: 'bold', fontSize: 12 },
  emptyBox:     { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon:    { fontSize: 50 },
  emptyTitulo:  { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
  emptySub:     { color: '#505050', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

const sb = StyleSheet.create({
  box:   { flex: 1, alignItems: 'center' },
  valor: { fontSize: 22, fontWeight: 'bold' },
  label: { color: '#404040', fontSize: 9, letterSpacing: 1.5, marginTop: 3 },
});
