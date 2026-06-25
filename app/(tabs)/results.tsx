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

export default function ResultsScreen() {
  const [tab,             setTab]             = useState('En Juego');
  const [participaciones, setParticipaciones] = useState<any[]>([]);
  const [ganadoresMap,    setGanadoresMap]    = useState<Record<string, { username: string; aciertos: number } | null>>({});
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);

  const loadParticipaciones = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('participaciones')
        .select(`
          id, aciertos, estado, premio_ganado, created_at,
          quinielas ( id, titulo, precio_entrada, estado ),
          selecciones (
            partido_id, prediccion,
            partidos ( equipo_local, equipo_visitante, fecha_partido, resultado )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setParticipaciones(data || []);

      // Cargar ganadores de quinielas finalizadas
      const finalizadas = (data || []).filter(p => p.quinielas?.estado === 'finalizada');
      const quinielaIds = [...new Set(finalizadas.map(p => p.quinielas?.id).filter(Boolean))];

      if (quinielaIds.length > 0) {
        const ganadoresObj: Record<string, { username: string; aciertos: number } | null> = {};
        for (const qid of quinielaIds) {
          // Buscar quien tiene estado = 'ganador' en esa quiniela
          const { data: gPart } = await supabase
            .from('participaciones')
            .select('aciertos, user_id')
            .eq('quiniela_id', qid)
            .eq('estado', 'ganador')
            .order('aciertos', { ascending: false })
            .limit(1)
            .single();

          if (gPart) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', gPart.user_id)
              .single();
            ganadoresObj[qid] = { username: prof?.username ?? 'Desconocido', aciertos: gPart.aciertos ?? 0 };
          } else {
            ganadoresObj[qid] = null;
          }
        }
        setGanadoresMap(ganadoresObj);
      }
    } catch (e: any) {
      console.error('Error cargando participaciones:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); loadParticipaciones(); }, []));

  const enJuego  = participaciones.filter(p => p.quinielas?.estado === 'abierta' || p.quinielas?.estado === 'cerrada');
  const historial = participaciones.filter(p => p.quinielas?.estado === 'finalizada');
  const listaActual = tab === 'En Juego' ? enJuego : historial;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      <SegmentedControl options={['En Juego', 'Historial']} selectedOption={tab} onSelect={setTab} />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2ECC71" />
          <Text style={styles.loadingText}>Cargando tus quinielas...</Text>
        </View>
      ) : (
        <FlatList
          data={listaActual}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadParticipaciones(); }} tintColor="#2ECC71" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>{tab === 'En Juego' ? '📺' : '📄'}</Text>
              <Text style={styles.emptyTitle}>{tab === 'En Juego' ? 'Sin quinielas activas' : 'Sin historial aún'}</Text>
              <Text style={styles.emptySubtitle}>
                {tab === 'En Juego' ? 'Cuando participes aparecerá aquí.' : 'Las quinielas finalizadas aparecerán aquí.'}
              </Text>
            </View>
          }
          ListHeaderComponent={
            <View style={styles.headerSection}>
              {tab === 'En Juego' ? (
                <View style={styles.liveRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.sectionTitle}>Tus quinielas activas</Text>
                  <View style={styles.countBadge}><Text style={styles.countText}>{enJuego.length}</Text></View>
                </View>
              ) : (
                <View style={styles.liveRow}>
                  <Text style={styles.sectionTitle}>📊 Resultados finales</Text>
                  <View style={[styles.countBadge, { backgroundColor: '#2A2D35' }]}><Text style={styles.countText}>{historial.length}</Text></View>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ResultCard
              quiniela={item.quinielas}
              participacion={item}
              selecciones={item.selecciones ?? []}
              modo={tab === 'En Juego' ? 'en_juego' : 'historial'}
              ganador={ganadoresMap[item.quinielas?.id] ?? null}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0A0C10' },
  list:         { paddingHorizontal: 15, paddingBottom: 40 },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:  { color: '#A0A0A0', fontSize: 14 },
  headerSection:{ paddingTop: 5, paddingBottom: 15 },
  liveRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.9, shadowRadius: 6, elevation: 4 },
  sectionTitle: { color: '#FFF', fontSize: 17, fontWeight: 'bold', flex: 1 },
  countBadge:   { backgroundColor: 'rgba(46,204,113,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#2ECC71' },
  countText:    { color: '#2ECC71', fontWeight: 'bold', fontSize: 12 },
  emptyBox:     { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon:    { fontSize: 50 },
  emptyTitle:   { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  emptySubtitle:{ color: '#707070', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
