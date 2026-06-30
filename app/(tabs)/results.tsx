import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Header from '../../src/components/Header';
import { QuinielaCard } from '../../src/components/QuinielaCard';
import SegmentedControl from '../../src/components/SegmentedControl';
import { supabase } from '../../src/config/supabase';

function StatBox({ valor, label, color = '#FFF', glow = false }: {
  valor: string; label: string; color?: string; glow?: boolean;
}) {
  return (
    <View style={sb.box}>
      <Text style={[sb.valor, { color }, glow && { textShadowColor: color, textShadowRadius: 10 }]}>
        {valor}
      </Text>
      <Text style={sb.label}>{label}</Text>
    </View>
  );
}

export default function ResultsScreen() {
  const [tab,             setTab]             = useState('En Juego');
  const [participaciones, setParticipaciones] = useState<any[]>([]);
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
          quinielas (
            id, titulo, descripcion, precio_entrada, premio_total, estado,
            fecha_cierre, jugadores_minimos, porcentaje_admin,
            partidos ( id ),
            participaciones ( count )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const quinielaIds = [...new Set(
        (data || []).map((item: any) => item.quinielas?.id).filter(Boolean)
      )] as string[];

      const primerPartidoMap: Record<string, string> = {};
      if (quinielaIds.length > 0) {
        const { data: primerosPartidos } = await supabase
          .from('partidos')
          .select('quiniela_id, fecha_partido')
          .in('quiniela_id', quinielaIds)
          .order('orden', { ascending: true });

        for (const p of (primerosPartidos || [])) {
          if (!primerPartidoMap[p.quiniela_id] && p.fecha_partido) {
            primerPartidoMap[p.quiniela_id] = p.fecha_partido;
          }
        }
      }

      const enriquecido = (data || []).map((item: any) => ({
        ...item,
        jugadores_count: item.quinielas?.participaciones?.[0]?.count ?? 0,
        fecha_primer_partido: primerPartidoMap[item.quinielas?.id] ?? item.quinielas?.fecha_cierre ?? null,
      }));

      setParticipaciones(enriquecido);
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, []));

  const enJuego  = participaciones.filter((p: any) =>
    ['abierta', 'cerrada'].includes(p.quinielas?.estado)
  );
  const historial = participaciones.filter((p: any) =>
    p.quinielas?.estado === 'finalizada' ||
    p.estado === 'ganador' ||
    p.estado === 'perdedor'
  );
  const lista = tab === 'En Juego' ? enJuego : historial;

  const totalJugadas   = historial.length;
  const totalGanadas   = historial.filter((p: any) => p.estado === 'ganador').length;
  const totalInvertido = historial.reduce((acc: number, p: any) =>
    acc + Number(p.monto_pagado ?? p.quinielas?.precio_entrada ?? 0), 0);
  const totalGanado    = historial.reduce((acc: number, p: any) =>
    acc + Number(p.premio_ganado ?? 0), 0);
  const roi            = totalInvertido > 0
    ? (((totalGanado - totalInvertido) / totalInvertido) * 100).toFixed(0)
    : '0';
  const roiNum = Number(roi);
  const pctAcierto = totalJugadas > 0 ? Math.round((totalGanadas / totalJugadas) * 100) : 0;

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
          style={{ flex: 1 }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadData(); }}
              tintColor="#9B59B6"
            />
          }
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
                    <StatBox valor={`${pctAcierto}%`} label="Win Rate" color="#9B59B6" glow />
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
                      <Text style={[s.statsFinVal, {
                        color: '#2ECC71', textShadowColor: '#2ECC71', textShadowRadius: 8,
                      }]}>${totalGanado.toLocaleString()}</Text>
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
              <Text style={s.emptyTitulo}>
                {tab === 'En Juego' ? 'Sin quinielas activas' : 'Sin historial aún'}
              </Text>
              <Text style={s.emptySub}>
                {tab === 'En Juego'
                  ? 'Las quinielas donde participes aparecerán aquí.'
                  : 'Las quinielas finalizadas aparecerán aquí.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const q = item.quinielas;
            if (!q) return null;
            return (
              <QuinielaCard
                id={q.id}
                titulo={q.titulo}
                descripcion={q.descripcion}
                precioEntrada={Number(q.precio_entrada)}
                premioTotal={Number(q.premio_total)}
                estado={q.estado}
                totalPartidos={q.partidos?.length ?? 0}
                fechaCierre={item.fecha_primer_partido}
                jugadoresMinimos={q.jugadores_minimos ?? 0}
                porcentajeAdmin={q.porcentaje_admin ?? 0}
                modoResultados
                jugadoresCount={item.jugadores_count}
                yaParticipo={true}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0A0C10' },
  list:          { paddingHorizontal: 14, paddingBottom: 40, paddingTop: 8 },
  centered:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingTxt:    { color: '#606060', fontSize: 13, letterSpacing: 1 },
  statsCard:     { backgroundColor: '#0D1117', borderRadius: 18, marginBottom: 18,
                   borderWidth: 1, borderColor: '#1E2330', overflow: 'hidden',
                   shadowColor: '#9B59B6', shadowOpacity: 0.2, shadowRadius: 14, elevation: 6 },
  statsNeonLine: { height: 2, backgroundColor: '#9B59B6',
                   shadowColor: '#9B59B6', shadowOpacity: 1, shadowRadius: 8 },
  statsTitle:    { color: '#404040', fontSize: 9, fontWeight: 'bold', letterSpacing: 3,
                   textAlign: 'center', paddingTop: 14, paddingBottom: 10 },
  statsGrid:     { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 14, alignItems: 'center' },
  statsDiv:      { width: 1, height: 36, backgroundColor: '#1E2330' },
  statsFinRow:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1E2330' },
  statsFinBox:   { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statsFinLbl:   { color: '#404040', fontSize: 9, letterSpacing: 2, marginBottom: 4 },
  statsFinVal:   { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  sectionRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  liveDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC71',
                   shadowColor: '#2ECC71', shadowOpacity: 1, shadowRadius: 6 },
  sectionTxt:    { color: '#FFF', fontSize: 15, fontWeight: 'bold', flex: 1 },
  countPill:     { backgroundColor: 'rgba(155,89,182,0.15)', borderRadius: 10,
                   paddingHorizontal: 10, paddingVertical: 2,
                   borderWidth: 1, borderColor: '#9B59B6' },
  countTxt:      { color: '#9B59B6', fontWeight: 'bold', fontSize: 12 },
  emptyBox:      { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon:     { fontSize: 50 },
  emptyTitulo:   { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
  emptySub:      { color: '#505050', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

const sb = StyleSheet.create({
  box:   { flex: 1, alignItems: 'center' },
  valor: { fontSize: 22, fontWeight: 'bold' },
  label: { color: '#404040', fontSize: 9, letterSpacing: 1.5, marginTop: 3 },
});
