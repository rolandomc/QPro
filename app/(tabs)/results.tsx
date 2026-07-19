import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../src/components/Header';
import { QuinielaCard } from '../../src/components/QuinielaCard';
import SegmentedControl from '../../src/components/SegmentedControl';
import { supabase } from '../../src/config/supabase';
import { useDeporte } from '../../src/context/DeporteContext';
import { QuinielasService } from '../../src/services/quinielas.service';

function StatBox({ valor, label, tone = 'neutral' }: {
  valor: string;
  label: string;
  tone?: 'neutral' | 'good' | 'warn' | 'accent';
}) {
  const toneMap = {
    neutral: { color: '#EAF0FA', border: '#253247' },
    good: { color: '#35D07F', border: 'rgba(53,208,127,0.4)' },
    warn: { color: '#F7B955', border: 'rgba(247,185,85,0.4)' },
    accent: { color: '#67BAFF', border: 'rgba(103,186,255,0.45)' },
  } as const;
  const cfg = toneMap[tone];

  return (
    <View style={[s.kpiTile, { borderColor: cfg.border }]}>
      <Text style={[s.kpiValue, { color: cfg.color }]}>{valor}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

export default function ResultsScreen() {
  const [tab, setTab] = useState('En Juego');
  const [participaciones, setParticipaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { deporteActivo, setDeporteActivo } = useDeporte();

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const selectWithLiga = `
        id, aciertos, estado, premio_ganado, monto_pagado, created_at,
        quinielas (
          id, titulo, descripcion, liga, precio_entrada, premio_total, estado,
          fecha_cierre, jugadores_minimos, porcentaje_admin, deporte, num_ganadores, porcentajes_premios,
          partidos ( count )
        )
      `;

      const selectWithoutLiga = `
        id, aciertos, estado, premio_ganado, monto_pagado, created_at,
        quinielas (
          id, titulo, descripcion, precio_entrada, premio_total, estado,
          fecha_cierre, jugadores_minimos, porcentaje_admin, deporte, num_ganadores, porcentajes_premios,
          partidos ( count )
        )
      `;

      let data: any[] | null = null;

      const { data: dataWithLiga, error: errorWithLiga } = await supabase
        .from('participaciones')
        .select(selectWithLiga)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (errorWithLiga) {
        const ligaMissing =
          errorWithLiga.message?.includes('liga does not exist') ||
          errorWithLiga.message?.includes('quinielas_1.liga');

        if (!ligaMissing) throw errorWithLiga;

        const { data: dataFallback, error: errorFallback } = await supabase
          .from('participaciones')
          .select(selectWithoutLiga)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (errorFallback) throw errorFallback;
        data = dataFallback;
      } else {
        data = dataWithLiga;
      }

      const quinielaIds = [...new Set((data || []).map((item: any) => item.quinielas?.id).filter(Boolean))] as string[];

      let stats: any[] = [];
      if (quinielaIds.length > 0) {
        try {
          stats = await QuinielasService.getQuinielasStatsPublic(quinielaIds);
        } catch {
          stats = [];
        }
      }
      const statsMap = new Map((stats ?? []).map((row: any) => [row.id, row]));

      const missingIds = quinielaIds.filter((qid) => !statsMap.has(qid));
      const rankingCountMap = new Map<string, number>();
      if (missingIds.length > 0) {
        await Promise.all(missingIds.map(async (qid) => {
          try {
            const rank = await QuinielasService.getQuinielaRankingPublic(qid, 1);
            rankingCountMap.set(qid, Number(rank?.[0]?.total_participants ?? 0));
          } catch {
            rankingCountMap.set(qid, 0);
          }
        }));
      }

      const enriched = (data || []).map((item: any) => ({
        ...item,
        quinielas: {
          ...item.quinielas,
          ...(statsMap.get(item.quinielas?.id) ?? {}),
        },
        total_partidos: Number(statsMap.get(item.quinielas?.id)?.total_partidos ?? item.quinielas?.partidos?.[0]?.count ?? 0),
        jugadores_count: Number(statsMap.get(item.quinielas?.id)?.jugadores_count ?? rankingCountMap.get(item.quinielas?.id) ?? 0),
        fecha_primer_partido: statsMap.get(item.quinielas?.id)?.fecha_primer_partido ?? item.quinielas?.fecha_cierre ?? null,
      }));

      setParticipaciones(enriched);
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData();
  }, [loadData]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  const participacionesFiltradas = participaciones.filter((p: any) => {
    const dep = p.quinielas?.deporte;
    if (deporteActivo === 'futbol') return !dep || dep === 'futbol';
    return dep === deporteActivo;
  });

  const enJuego = participacionesFiltradas.filter((p: any) => ['abierta', 'cerrada'].includes(p.quinielas?.estado));
  const historial = participacionesFiltradas.filter((p: any) =>
    p.quinielas?.estado === 'finalizada' || p.estado === 'ganador' || p.estado === 'perdedor'
  );
  const lista = tab === 'En Juego' ? enJuego : historial;

  const totalJugadas = historial.length;
  const totalGanadas = historial.filter((p: any) => p.estado === 'ganador').length;
  const totalInvertido = historial.reduce((acc: number, p: any) => acc + Number(p.monto_pagado ?? p.quinielas?.precio_entrada ?? 0), 0);
  const totalGanado = historial.reduce((acc: number, p: any) => acc + Number(p.premio_ganado ?? 0), 0);
  const totalPerdidas = Math.max(0, totalJugadas - totalGanadas);
  const pctAcierto = totalJugadas > 0 ? Math.round((totalGanadas / totalJugadas) * 100) : 0;

  const roi = totalInvertido > 0
    ? (((totalGanado - totalInvertido) / totalInvertido) * 100).toFixed(0)
    : '0';
  const roiNum = Number(roi);

  const abiertasEnJuego = enJuego.filter((p: any) => p.quinielas?.estado === 'abierta').length;
  const cerradasEnJuego = enJuego.filter((p: any) => p.quinielas?.estado === 'cerrada').length;

  const deporteEmoji = deporteActivo === 'beisbol' ? '⚾' : deporteActivo === 'basquet' ? '🏀' : '⚽';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <Header deporteActivo={deporteActivo} onDeporteChange={setDeporteActivo} onRefresh={handleRefresh} />
      <SegmentedControl options={['En Juego', 'Historial']} selectedOption={tab} onSelect={setTab} accentColor="#35D07F" />

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#35D07F" />
          <Text style={s.loadingTxt}>Cargando...</Text>
        </View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#67BAFF" colors={["#35D07F"]} />
          }
          ListHeaderComponent={
            <>
              <View style={s.overviewCard}>
                <View style={s.overviewTop}>
                  <Text style={s.overviewTag}>{tab === 'En Juego' ? 'LIVE TRACKER' : 'RESUMEN HISTORIAL'}</Text>
                  <View style={s.overviewCountPill}>
                    <Text style={s.overviewCountText}>{lista.length}</Text>
                  </View>
                </View>

                {tab === 'En Juego' ? (
                  <>
                    <Text style={s.overviewTitle}>{deporteEmoji} Tus quinielas activas</Text>
                    <Text style={s.overviewSub}>Sigue el estado de tus picks y entra antes del cierre.</Text>
                    <View style={s.livePillsRow}>
                      <View style={s.livePill}>
                        <Text style={s.livePillValue}>{abiertasEnJuego}</Text>
                        <Text style={s.livePillLabel}>Abiertas</Text>
                      </View>
                      <View style={s.livePill}>
                        <Text style={s.livePillValue}>{cerradasEnJuego}</Text>
                        <Text style={s.livePillLabel}>Cerradas</Text>
                      </View>
                      <View style={s.livePill}>
                        <Text style={s.livePillValue}>{enJuego.length}</Text>
                        <Text style={s.livePillLabel}>Total</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={s.overviewTitle}>{deporteEmoji} Rendimiento acumulado</Text>
                    <Text style={s.overviewSub}>Revisa tu desempeño historico y retorno total.</Text>

                    <View style={s.kpiGrid}>
                      <StatBox valor={String(totalJugadas)} label="Jugadas" tone="accent" />
                      <StatBox valor={String(totalGanadas)} label="Ganadas" tone="good" />
                      <StatBox valor={String(totalPerdidas)} label="Perdidas" tone="warn" />
                      <StatBox valor={`${pctAcierto}%`} label="Win Rate" tone="neutral" />
                    </View>

                    <View style={s.moneyRow}>
                      <View style={s.moneyBox}>
                        <Text style={s.moneyLabel}>Invertido</Text>
                        <Text style={s.moneyValue}>${totalInvertido.toLocaleString()}</Text>
                      </View>
                      <View style={s.moneyBox}>
                        <Text style={s.moneyLabel}>Ganado</Text>
                        <Text style={[s.moneyValue, { color: '#35D07F' }]}>${totalGanado.toLocaleString()}</Text>
                      </View>
                      <View style={s.moneyBox}>
                        <Text style={s.moneyLabel}>ROI</Text>
                        <Text style={[s.moneyValue, { color: roiNum >= 0 ? '#35D07F' : '#F7B955' }]}>
                          {`${roiNum >= 0 ? '+' : ''}${roi}%`}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>

              {tab === 'Historial' && totalJugadas === 0 && (
                <View style={s.hintCard}>
                  <Text style={s.hintText}>Aun no tienes quinielas finalizadas para mostrar estadisticas.</Text>
                </View>
              )}

              <View style={s.sectionRow}>
                {tab === 'En Juego' ? (
                  <>
                    <View style={s.liveDot} />
                    <Text style={s.sectionTxt}>{deporteEmoji} En juego</Text>
                  </>
                ) : (
                  <Text style={s.sectionTxt}>{deporteEmoji} Historial</Text>
                )}
                <View style={s.countPill}>
                  <Text style={s.countTxt}>{lista.length}</Text>
                </View>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>{tab === 'En Juego' ? (deporteActivo === 'beisbol' ? '⚾' : '🎥') : '📊'}</Text>
              <Text style={s.emptyTitulo}>{tab === 'En Juego' ? 'No hay quinielas activas' : 'Aun sin historial'}</Text>
              <Text style={s.emptySub}>
                {tab === 'En Juego'
                  ? `Tus participaciones activas de ${deporteActivo === 'beisbol' ? 'beisbol' : 'futbol'} apareceran aqui.`
                  : 'Cuando tus quinielas terminen, veras resultados y rendimiento en esta seccion.'}
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
                headerLabel={(q.liga ?? q.league ?? q.descripcion?.replace(/^Quiniela de\s*/i, '') ?? q.deporte ?? 'QPRO').toString()}
                headerDetail={q.deporte === 'beisbol' ? 'Béisbol' : 'Fútbol'}
                tagColor="#35D07F"
                precioEntrada={Number(q.precio_entrada)}
                premioTotal={Number(q.premio_total)}
                estado={q.estado}
                totalPartidos={item.total_partidos ?? 0}
                fechaCierre={item.fecha_primer_partido}
                jugadoresMinimos={q.jugadores_minimos ?? 0}
                porcentajeAdmin={q.porcentaje_admin ?? 0}
                numGanadores={q.num_ganadores ?? 1}
                porcentajesPremios={q.porcentajes_premios ?? [100]}
                modoResultados
                jugadoresCount={item.jugadores_count}
                yaParticipo
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  list: { paddingHorizontal: 14, paddingBottom: 40, paddingTop: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingTxt: { color: '#5F6B7D', fontSize: 13, letterSpacing: 1 },

  overviewCard: {
    backgroundColor: '#0F1622',
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#253247',
    padding: 14,
    shadowColor: '#67BAFF',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  overviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  overviewTag: { color: '#7FA8D8', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  overviewCountPill: {
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2B3A53',
    backgroundColor: '#142238',
  },
  overviewCountText: { color: '#CBE0FF', fontWeight: '700', fontSize: 12 },
  overviewTitle: { color: '#F1F5FC', fontSize: 19, fontWeight: '700', marginBottom: 4 },
  overviewSub: { color: '#93A1B8', fontSize: 13, lineHeight: 18, marginBottom: 12 },

  livePillsRow: { flexDirection: 'row', gap: 8 },
  livePill: {
    flex: 1,
    backgroundColor: '#121D2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24344A',
    paddingVertical: 8,
    alignItems: 'center',
  },
  livePillValue: { color: '#EAF0FA', fontSize: 18, fontWeight: '700' },
  livePillLabel: { color: '#8FA2BE', fontSize: 10, letterSpacing: 1.1, marginTop: 2 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  kpiTile: {
    width: '49%',
    backgroundColor: '#121D2E',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 19, fontWeight: '700' },
  kpiLabel: { color: '#8FA2BE', fontSize: 10, letterSpacing: 1.1, marginTop: 2 },

  moneyRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  moneyBox: {
    flex: 1,
    backgroundColor: '#121A28',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253247',
    paddingVertical: 10,
    alignItems: 'center',
  },
  moneyLabel: { color: '#8A9DB7', fontSize: 10, letterSpacing: 1.2, marginBottom: 3 },
  moneyValue: { color: '#EAF0FA', fontSize: 15, fontWeight: '700' },

  hintCard: {
    backgroundColor: '#101722',
    borderColor: '#253247',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  hintText: { color: '#95A4BC', fontSize: 12, lineHeight: 18, textAlign: 'center' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 1, shadowRadius: 6 },
  sectionTxt: { color: '#F3F6FC', fontSize: 15, fontWeight: '700', flex: 1 },
  countPill: {
    backgroundColor: 'rgba(103,186,255,0.14)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#67BAFF',
  },
  countTxt: { color: '#67BAFF', fontWeight: '700', fontSize: 12 },

  emptyBox: { alignItems: 'center', paddingTop: 56, gap: 10 },
  emptyIcon: { fontSize: 50 },
  emptyTitulo: { color: '#F3F6FC', fontSize: 18, fontWeight: '700' },
  emptySub: { color: '#8595AD', fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
});
