import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../src/config/supabase';
import { AdminService } from '../../../src/services/admin.service';

const RESULTADO_OPTIONS = [
  { label: '1', value: 'local',    color: '#2ECC71' },
  { label: 'X', value: 'empate',   color: '#F39C12' },
  { label: '2', value: 'visitante',color: '#3498DB' },
];

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';

export default function AdminQuinielaDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [quiniela,     setQuiniela]     = useState<any>(null);
  const [partidos,     setPartidos]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [savingPartido,setSavingPartido]= useState<string | null>(null);
  const [fetchingAuto, setFetchingAuto] = useState(false);
  const [autoActivo,   setAutoActivo]   = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [{ data: q }, { data: p }] = await Promise.all([
        supabase.from('quinielas').select('*').eq('id', id).single(),
        supabase.from('partidos').select('*').eq('quiniela_id', id).order('orden', { ascending: true }),
      ]);
      setQuiniela(q);
      setPartidos(p || []);
      setAutoActivo(q?.auto_resultados ?? false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [id]));

  // ── MANUAL ──────────────────────────────────────────────────────────────
  const handleSetResultado = async (partidoId: string, resultado: string) => {
    setSavingPartido(partidoId);
    try {
      const { error } = await supabase.from('partidos').update({ resultado }).eq('id', partidoId);
      if (error) throw error;
      setPartidos(prev => prev.map(p => p.id === partidoId ? { ...p, resultado } : p));
      await AdminService.recalcularAciertos(id!);
    } catch (e: any) {
      Alert.alert('Error al guardar resultado', e.message);
    } finally {
      setSavingPartido(null);
    }
  };

  // ── OBTENER RESULTADOS — directo a football-data.org ─────────────────────
  const handleFetchAuto = async () => {
    const apiKey = process.env.EXPO_PUBLIC_FOOTBALL_API_KEY;
    if (!apiKey) {
      Alert.alert('Error', 'EXPO_PUBLIC_FOOTBALL_API_KEY no configurada en .env');
      return;
    }

    // Solo procesar pendientes que tengan fixture_id
    const pendientes = partidos.filter(p => !p.resultado && p.fixture_id);
    const sinFixtureId = partidos.filter(p => !p.resultado && !p.fixture_id);

    if (pendientes.length === 0) {
      if (sinFixtureId.length > 0) {
        Alert.alert(
          '⚠️ Sin fixture_id',
          `${sinFixtureId.length} partido(s) no tienen ID de la API. Ingresa los resultados de forma manual.`
        );
      } else {
        Alert.alert('✅ Todo listo', 'Todos los partidos ya tienen resultado.');
      }
      return;
    }

    setFetchingAuto(true);
    let actualizados = 0;
    const errores: string[] = [];

    try {
      for (const partido of pendientes) {
        try {
          const res = await fetch(
            `${FOOTBALL_API_BASE}/matches/${partido.fixture_id}`,
            { headers: { 'X-Auth-Token': apiKey } }
          );

          if (!res.ok) {
            errores.push(`#${partido.fixture_id}: HTTP ${res.status}`);
            continue;
          }

          const json = await res.json();
          // football-data.org devuelve el partido directo en json (no en array)
          const match = json.match ?? json;
          const status = match?.status;

          // Solo procesar si el partido ya terminó
          if (!['FINISHED', 'AWARDED'].includes(status)) {
            errores.push(`${partido.equipo_local} vs ${partido.equipo_visitante}: aún no ha terminado (${status})`);
            continue;
          }

          const home = match?.score?.fullTime?.home ?? match?.score?.fullTime?.homeTeam ?? null;
          const away = match?.score?.fullTime?.away ?? match?.score?.fullTime?.awayTeam ?? null;

          if (home === null || away === null) {
            errores.push(`${partido.equipo_local} vs ${partido.equipo_visitante}: marcador no disponible`);
            continue;
          }

          const resultado: 'local' | 'empate' | 'visitante' =
            home > away ? 'local' : home === away ? 'empate' : 'visitante';

          const { error } = await supabase
            .from('partidos')
            .update({ resultado })
            .eq('id', partido.id);

          if (error) throw error;

          setPartidos(prev => prev.map(p => p.id === partido.id ? { ...p, resultado } : p));
          actualizados++;
        } catch (innerErr: any) {
          errores.push(`${partido.equipo_local} vs ${partido.equipo_visitante}: ${innerErr.message}`);
        }
      }

      // Recalcular aciertos si hubo cambios
      if (actualizados > 0) await AdminService.recalcularAciertos(id!);

      // Construir mensaje de resultado
      let msg = `✅ ${actualizados} partido(s) actualizados.`;
      if (errores.length > 0) msg += `\n\n⚠️ Sin actualizar:\n${errores.join('\n')}`;

      Alert.alert(actualizados > 0 ? '🎉 Resultados obtenidos' : '⚠️ Sin actualizaciones', msg);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setFetchingAuto(false);
    }
  };

  // ── Toggle auto-resultados ────────────────────────────────────────────────
  const handleToggleAuto = async (value: boolean) => {
    setAutoActivo(value);
    try {
      await supabase.from('quinielas').update({ auto_resultados: value }).eq('id', id);
    } catch (e: any) {
      setAutoActivo(!value);
      Alert.alert('Error', e.message);
    }
  };

  // ── Finalizar quiniela ────────────────────────────────────────────────────
  const handleFinalizar = () => {
    const sinResultado = partidos.filter(p => !p.resultado).length;
    const msg = sinResultado > 0
      ? `Aún hay ${sinResultado} partido(s) sin resultado. ¿Finalizar de todas formas?`
      : '¿Finalizar la quiniela? Se calcularán los ganadores.';
    Alert.alert('🏆 Finalizar Quiniela', msg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Finalizar',
        onPress: async () => {
          try {
            await AdminService.updateEstado(id!, 'finalizada');
            await AdminService.recalcularAciertos(id!);
            Alert.alert('✅ Quiniela finalizada', 'Los resultados han sido calculados.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const getEstadoColor = (estado: string) => {
    if (estado === 'abierta')    return '#2ECC71';
    if (estado === 'cerrada')    return '#3498DB';
    if (estado === 'finalizada') return '#A0A0A0';
    return '#FFF';
  };

  const resultadosCompletos = partidos.length > 0 && partidos.every(p => p.resultado);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color="#9B59B6" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{quiniela?.titulo}</Text>
        <View style={[styles.estadoBadge, { borderColor: getEstadoColor(quiniela?.estado) }]}>
          <Text style={[styles.estadoText, { color: getEstadoColor(quiniela?.estado) }]}>
            {quiniela?.estado?.toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor="#9B59B6"
          />
        }
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{partidos.length}</Text>
            <Text style={styles.statLabel}>Partidos</Text>
          </View>
          <View style={[styles.statBox, styles.statBorder]}>
            <Text style={[styles.statVal, { color: '#2ECC71' }]}>{partidos.filter(p => p.resultado).length}</Text>
            <Text style={styles.statLabel}>Con resultado</Text>
          </View>
          <View style={[styles.statBox, styles.statBorder]}>
            <Text style={[styles.statVal, { color: '#F39C12' }]}>{partidos.filter(p => !p.resultado).length}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
        </View>

        {/* Auto toggle */}
        <View style={styles.autoRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoTitle}>🤖 Resultados Automáticos</Text>
            <Text style={styles.autoDesc}>Activa para que se jalen solos al consultar la quiniela</Text>
          </View>
          <Switch
            value={autoActivo}
            onValueChange={handleToggleAuto}
            trackColor={{ false: '#2A2D35', true: 'rgba(155,89,182,0.4)' }}
            thumbColor={autoActivo ? '#9B59B6' : '#505050'}
          />
        </View>

        {/* Botón fetch */}
        <TouchableOpacity
          style={[styles.fetchBtn, fetchingAuto && styles.fetchBtnLoading]}
          onPress={handleFetchAuto}
          disabled={fetchingAuto}
        >
          {fetchingAuto
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.fetchBtnText}>⬇️  Obtener Resultados de la API</Text>
          }
        </TouchableOpacity>

        {/* Partidos */}
        <Text style={styles.sectionTitle}>Partidos</Text>

        {partidos.map((partido, index) => (
          <View key={partido.id} style={styles.partidoCard}>
            <View style={styles.partidoHeader}>
              <Text style={styles.partidoNum}>#{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.partidoEquipos}>
                  {partido.equipo_local}  vs  {partido.equipo_visitante}
                </Text>
                {partido.fecha_partido && (
                  <Text style={styles.partidoFecha}>
                    📅 {new Date(partido.fecha_partido).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                  </Text>
                )}
                {partido.fixture_id && (
                  <Text style={styles.fixtureId}>ID API: {partido.fixture_id}</Text>
                )}
              </View>
              {partido.resultado && (
                <View style={styles.resultadoActualBadge}>
                  <Text style={styles.resultadoActualText}>
                    {partido.resultado === 'local' ? '1' : partido.resultado === 'empate' ? 'X' : '2'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.opcionesRow}>
              {RESULTADO_OPTIONS.map(opt => {
                const seleccionado = partido.resultado === opt.value;
                const guardando = savingPartido === partido.id;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.opcionBtn,
                      seleccionado && { backgroundColor: opt.color + '25', borderColor: opt.color },
                    ]}
                    onPress={() => handleSetResultado(partido.id, opt.value)}
                    disabled={guardando || quiniela?.estado === 'abierta'}
                  >
                    {guardando && seleccionado
                      ? <ActivityIndicator size="small" color={opt.color} />
                      : <Text style={[styles.opcionText, seleccionado && { color: opt.color }]}>{opt.label}</Text>
                    }
                  </TouchableOpacity>
                );
              })}
            </View>

            {quiniela?.estado === 'abierta' && (
              <Text style={styles.warningText}>⚠️ Cierra las apuestas antes de ingresar resultados</Text>
            )}
          </View>
        ))}

        {quiniela?.estado === 'cerrada' && (
          <TouchableOpacity
            style={[styles.finalizarBtn, resultadosCompletos && styles.finalizarBtnActive]}
            onPress={handleFinalizar}
          >
            <Text style={styles.finalizarText}>
              {resultadosCompletos
                ? '🏆 Finalizar Quiniela y Calcular Ganadores'
                : `🏆 Finalizar (faltan ${partidos.filter(p => !p.resultado).length} resultados)`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: '#0A0C10' },
  centered:              { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:                { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backBtn:               { width: 60 },
  backText:              { color: '#9B59B6', fontSize: 15 },
  headerTitle:           { flex: 1, color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  estadoBadge:           { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  estadoText:            { fontSize: 10, fontWeight: 'bold' },
  content:               { padding: 15, paddingBottom: 50 },
  statsRow:              { flexDirection: 'row', backgroundColor: '#15181F', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#2A2D35' },
  statBox:               { flex: 1, alignItems: 'center', paddingVertical: 15 },
  statBorder:            { borderLeftWidth: 1, borderLeftColor: '#2A2D35' },
  statVal:               { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  statLabel:             { color: '#A0A0A0', fontSize: 11, marginTop: 2 },
  autoRow:               { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15181F', borderRadius: 12, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#2A2D35', gap: 12 },
  autoTitle:             { color: '#FFF', fontWeight: 'bold', fontSize: 14, marginBottom: 3 },
  autoDesc:              { color: '#707070', fontSize: 11, lineHeight: 16 },
  fetchBtn:              { backgroundColor: '#1C1F26', borderWidth: 1.5, borderColor: '#9B59B6', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  fetchBtnLoading:       { opacity: 0.6 },
  fetchBtnText:          { color: '#9B59B6', fontWeight: 'bold', fontSize: 14 },
  sectionTitle:          { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  partidoCard:           { backgroundColor: '#15181F', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#2A2D35' },
  partidoHeader:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  partidoNum:            { color: '#505050', fontSize: 12, width: 22 },
  partidoEquipos:        { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  partidoFecha:          { color: '#707070', fontSize: 11, marginTop: 2 },
  fixtureId:             { color: '#303030', fontSize: 10, marginTop: 1 },
  resultadoActualBadge:  { backgroundColor: '#2ECC71', borderRadius: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  resultadoActualText:   { color: '#000', fontWeight: 'bold', fontSize: 14 },
  opcionesRow:           { flexDirection: 'row', gap: 8 },
  opcionBtn:             { flex: 1, borderWidth: 1, borderColor: '#2A2D35', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  opcionText:            { color: '#A0A0A0', fontWeight: 'bold', fontSize: 16 },
  warningText:           { color: '#F39C12', fontSize: 11, marginTop: 8, textAlign: 'center' },
  finalizarBtn:          { marginTop: 20, borderWidth: 1.5, borderColor: '#505050', borderRadius: 14, padding: 16, alignItems: 'center', backgroundColor: '#1C1F26' },
  finalizarBtnActive:    { borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.1)', shadowColor: '#F39C12', shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 },
  finalizarText:         { color: '#F39C12', fontWeight: 'bold', fontSize: 15 },
});
