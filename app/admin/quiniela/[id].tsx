import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from '../../../src/config/supabase';
import { AdminService } from '../../../src/services/admin.service';

const RESULTADO_OPTIONS = [
  { label: '1', value: 'local',     color: '#2ECC71' },
  { label: 'X', value: 'empate',    color: '#F39C12' },
  { label: '2', value: 'visitante', color: '#3498DB' },
];

function getMatchUrl(fixtureId: string | number): string {
  if (Platform.OS === 'web') return `/api/match?id=${fixtureId}`;
  return `https://api.football-data.org/v4/matches/${fixtureId}`;
}

// ── Helpers countdown ────────────────────────────────────────────────────────
function calcCountdown(targetISO: string | null): string {
  if (!targetISO) return '';
  const diff = new Date(targetISO).getTime() - Date.now();
  if (diff <= 0) return '¡Iniciando!';
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000)  / 60_000);
  const s = Math.floor((diff % 60_000)     / 1_000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function AdminQuinielaDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [quiniela,       setQuiniela]       = useState<any>(null);
  const [partidos,       setPartidos]       = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [savingPartido,  setSavingPartido]  = useState<string | null>(null);
  const [fetchingAuto,   setFetchingAuto]   = useState(false);
  const [autoActivo,     setAutoActivo]     = useState(false);
  const [cerrando,       setCerrando]       = useState(false);

  // ── Countdown ────────────────────────────────────────────────────────────────
  const [countdown,      setCountdown]      = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback((primerPartido: string | null) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!primerPartido) { setCountdown(''); return; }
    setCountdown(calcCountdown(primerPartido));
    timerRef.current = setInterval(() => {
      setCountdown(calcCountdown(primerPartido));
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Cargar datos ─────────────────────────────────────────────────────────────
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
      // Arrancar countdown si la quiniela está abierta y tiene primer_partido
      if (q?.estado === 'abierta' && q?.primer_partido) {
        startCountdown(q.primer_partido);
      } else {
        startCountdown(null);
      }
      return { quiniela: q, partidos: p || [] };
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, startCountdown]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData().then(async (data) => {
        if (!data) return;
        const { quiniela: q, partidos: p } = data;
        if (!q?.auto_resultados) return;
        const pendientes = (p || []).filter((pt: any) => !pt.resultado && pt.fixture_id);
        if (pendientes.length === 0) return;
        await fetchResultadosDesdeAPI(p || [], false);
      });
    }, [id])
  );

  // ── Fetch resultados API ──────────────────────────────────────────────────────
  const fetchResultadosDesdeAPI = async (listaPartidos: any[], mostrarAlert = true) => {
    const pendientes = listaPartidos.filter(p => !p.resultado && p.fixture_id);
    if (pendientes.length === 0) {
      if (mostrarAlert) Alert.alert('✅ Todo listo', 'Todos los partidos ya tienen resultado.');
      return 0;
    }
    const apiKey = Platform.OS !== 'web' ? process.env.EXPO_PUBLIC_FOOTBALL_API_KEY : undefined;
    if (Platform.OS !== 'web' && !apiKey) {
      if (mostrarAlert) Alert.alert('Error', 'EXPO_PUBLIC_FOOTBALL_API_KEY no configurada.');
      return 0;
    }
    let actualizados = 0;
    const errores: string[] = [];
    for (const partido of pendientes) {
      try {
        const url = getMatchUrl(partido.fixture_id);
        const headers: Record<string, string> = {};
        if (Platform.OS !== 'web' && apiKey) headers['X-Auth-Token'] = apiKey;
        const res = await fetch(url, { headers });
        if (!res.ok) { errores.push(`ID ${partido.fixture_id}: HTTP ${res.status}`); continue; }
        const json  = await res.json();
        const match = json.match ?? json;
        if (!['FINISHED', 'AWARDED'].includes(match?.status)) {
          errores.push(`${partido.equipo_local} vs ${partido.equipo_visitante}: aún no terminado (${match?.status ?? 'sin estado'})`);
          continue;
        }
        const home = match?.score?.fullTime?.home ?? match?.score?.fullTime?.homeTeam ?? null;
        const away = match?.score?.fullTime?.away ?? match?.score?.fullTime?.awayTeam ?? null;
        if (home === null || away === null) { errores.push(`${partido.equipo_local}: marcador no disponible`); continue; }
        const resultado: 'local' | 'empate' | 'visitante' =
          home > away ? 'local' : home === away ? 'empate' : 'visitante';
        const { error } = await supabase.from('partidos').update({ resultado }).eq('id', partido.id);
        if (error) throw error;
        setPartidos(prev => prev.map(p => p.id === partido.id ? { ...p, resultado } : p));
        actualizados++;
      } catch (err: any) {
        errores.push(`${partido.equipo_local} vs ${partido.equipo_visitante}: ${err.message}`);
      }
    }
    if (actualizados > 0) await AdminService.recalcularAciertos(id!);
    if (mostrarAlert) {
      let msg = `✅ ${actualizados} partido(s) actualizados.`;
      if (errores.length > 0) msg += `\n\n⚠️ Sin actualizar:\n${errores.join('\n')}`;
      Alert.alert(actualizados > 0 ? '🎉 Resultados obtenidos' : '⚠️ Sin actualizaciones', msg);
    }
    return actualizados;
  };

  const handleFetchAuto = async () => {
    setFetchingAuto(true);
    try { await fetchResultadosDesdeAPI(partidos, true); }
    finally { setFetchingAuto(false); }
  };

  // ── Manual resultado ─────────────────────────────────────────────────────────
  const handleSetResultado = async (partidoId: string, resultado: string) => {
    setSavingPartido(partidoId);
    try {
      const { error } = await supabase.from('partidos').update({ resultado }).eq('id', partidoId);
      if (error) throw error;
      setPartidos(prev => prev.map(p => p.id === partidoId ? { ...p, resultado } : p));
      await AdminService.recalcularAciertos(id!);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingPartido(null);
    }
  };

  // ── Toggle auto resultados ───────────────────────────────────────────────────
  const handleToggleAuto = async (value: boolean) => {
    setAutoActivo(value);
    try {
      await supabase.from('quinielas').update({ auto_resultados: value }).eq('id', id);
    } catch (e: any) {
      setAutoActivo(!value);
      Alert.alert('Error', e.message);
    }
  };

  // ── CERRAR QUINIELA (verifica mínimo → anula o cierra + reembolso) ───────────
  const handleCerrarQuiniela = () => {
    Alert.alert(
      '🔒 Cerrar Quiniela',
      'Se verificará si cumple el mínimo de jugadores.\n\n' +
      `• Si cumple (≥ ${quiniela?.jugadores_minimos}) → se cerrará y comenzará la quiniela.\n` +
      '• Si NO cumple → se anulará y se reembolsará la entrada a cada jugador.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar ahora',
          style: 'destructive',
          onPress: async () => {
            setCerrando(true);
            try {
              const { valida, jugadoresPagados } = await AdminService.cerrarQuiniela(id!);
              // Recargar datos actualizados
              await loadData();
              if (valida) {
                Alert.alert(
                  '✅ Quiniela Cerrada',
                  `¡El pozo está activo!\n\n` +
                  `👥 Jugadores: ${jugadoresPagados} / ${quiniela?.jugadores_minimos} mínimo\n` +
                  `💰 Pozo: $${(jugadoresPagados * (quiniela?.precio_entrada ?? 0)).toLocaleString()} MXN\n\n` +
                  `Ya no se aceptan nuevas entradas.`,
                );
              } else {
                Alert.alert(
                  '❌ Quiniela Anulada',
                  `No se alcanzó el mínimo de jugadores.\n\n` +
                  `👥 Registrados: ${jugadoresPagados} / ${quiniela?.jugadores_minimos} requeridos\n\n` +
                  `💸 Se ha reembolsado la entrada a los ${jugadoresPagados} jugador(es) pagado(s). Verán el movimiento en su Wallet.`,
                );
              }
            } catch (e: any) {
              Alert.alert('Error al cerrar', e.message);
            } finally {
              setCerrando(false);
            }
          },
        },
      ]
    );
  };

  // ── Finalizar ────────────────────────────────────────────────────────────────
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
            router.push(`/admin/quiniela/ganadores?id=${id}`);
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
    if (estado === 'anulada')    return '#E74C3C';
    return '#FFF';
  };

  const resultadosCompletos = partidos.length > 0 && partidos.every(p => p.resultado);

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}><ActivityIndicator size="large" color="#9B59B6" /></View>
    </SafeAreaView>
  );

  const estaAbierta    = quiniela?.estado === 'abierta';
  const estaCerrada    = quiniela?.estado === 'cerrada';
  const estaAnulada    = quiniela?.estado === 'anulada';
  const estaFinalizada = quiniela?.estado === 'finalizada';
  const primerPartido  = quiniela?.primer_partido ?? null;
  const cierreAuto     = quiniela?.cierre_automatico ?? false;

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#9B59B6" />}
      >
        {/* ── Countdown / Cierre automático ────────────────────── */}
        {estaAbierta && primerPartido && (
          <View style={[styles.countdownBox, countdown === '¡Iniciando!' && styles.countdownBoxUrgente]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.countdownLabel}>
                {cierreAuto ? '⏱️ Cierre automático en' : '📅 Primer partido en'}
              </Text>
              <Text style={styles.countdownTimer}>{countdown}</Text>
              <Text style={styles.countdownFecha}>
                {new Date(primerPartido).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })}
              </Text>
            </View>
            <View style={styles.countdownModoBadge}>
              <Text style={styles.countdownModoText}>{cierreAuto ? '🤖 AUTO' : '🔧 MANUAL'}</Text>
            </View>
          </View>
        )}

        {/* ── Anulada banner ───────────────────────────────────── */}
        {estaAnulada && (
          <View style={styles.anuladaBanner}>
            <Text style={styles.anuladaTitle}>❌ Quiniela Anulada</Text>
            <Text style={styles.anuladaDesc}>No se alcanzó el mínimo de jugadores. Las entradas fueron reembolsadas automáticamente.</Text>
          </View>
        )}

        {/* ── Stats ────────────────────────────────────────────── */}
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

        {/* ── Auto resultados toggle ───────────────────────────── */}
        <View style={styles.autoRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoTitle}>🤖 Resultados Automáticos</Text>
            <Text style={styles.autoDesc}>Se actualizan solos cada vez que abres esta pantalla</Text>
          </View>
          <Switch value={autoActivo} onValueChange={handleToggleAuto}
            trackColor={{ false: '#2A2D35', true: 'rgba(155,89,182,0.4)' }}
            thumbColor={autoActivo ? '#9B59B6' : '#505050'} />
        </View>

        {/* ── Fetch resultados manual ──────────────────────────── */}
        <TouchableOpacity
          style={[styles.fetchBtn, fetchingAuto && styles.fetchBtnLoading]}
          onPress={handleFetchAuto}
          disabled={fetchingAuto}
        >
          {fetchingAuto
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.fetchBtnText}>⬇️  Obtener Resultados de la API</Text>}
        </TouchableOpacity>

        {/* ── Ganadores (finalizada) ───────────────────────────── */}
        {estaFinalizada && (
          <TouchableOpacity style={styles.ganadoresBtn} onPress={() => router.push(`/admin/quiniela/ganadores?id=${id}`)}>
            <Text style={styles.ganadoresBtnText}>🏆 Ver Ganadores</Text>
          </TouchableOpacity>
        )}

        {/* ── CERRAR QUINIELA (manual) ─────────────────────────── */}
        {estaAbierta && (
          <TouchableOpacity
            style={[styles.cerrarBtn, cerrando && { opacity: 0.6 }]}
            onPress={handleCerrarQuiniela}
            disabled={cerrando}
          >
            {cerrando
              ? <ActivityIndicator color="#3498DB" />
              : (
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Text style={styles.cerrarBtnText}>🔒 Cerrar Quiniela</Text>
                  <Text style={styles.cerrarBtnSub}>
                    {cierreAuto
                      ? `Modo automático — también puedes cerrar ahora`
                      : `Modo manual — cierra cuando quieras`}
                  </Text>
                </View>
              )}
          </TouchableOpacity>
        )}

        {/* ── Partidos ─────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Partidos</Text>
        {partidos.map((partido, index) => (
          <View key={partido.id} style={styles.partidoCard}>
            <View style={styles.partidoHeader}>
              <Text style={styles.partidoNum}>#{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.partidoEquipos}>{partido.equipo_local}  vs  {partido.equipo_visitante}</Text>
                {partido.fecha_partido && (
                  <Text style={styles.partidoFecha}>
                    📅 {new Date(partido.fecha_partido).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                  </Text>
                )}
                {partido.fixture_id && (
                  <Text style={styles.fixtureId}>🔗 fixture_id: {partido.fixture_id}</Text>
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
                const guardando    = savingPartido === partido.id;
                return (
                  <TouchableOpacity key={opt.value}
                    style={[styles.opcionBtn, seleccionado && { backgroundColor: opt.color + '25', borderColor: opt.color }]}
                    onPress={() => handleSetResultado(partido.id, opt.value)}
                    disabled={guardando || estaAbierta || estaAnulada}
                  >
                    {guardando && seleccionado
                      ? <ActivityIndicator size="small" color={opt.color} />
                      : <Text style={[styles.opcionText, seleccionado && { color: opt.color }]}>{opt.label}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
            {estaAbierta && (
              <Text style={styles.warningText}>⚠️ Cierra las apuestas antes de ingresar resultados</Text>
            )}
          </View>
        ))}

        {/* ── Finalizar (cerrada) ──────────────────────────────── */}
        {estaCerrada && (
          <TouchableOpacity
            style={[styles.finalizarBtn, resultadosCompletos && styles.finalizarBtnActive]}
            onPress={handleFinalizar}
          >
            <Text style={styles.finalizarText}>
              {resultadosCompletos
                ? '🏆 Finalizar Quiniela y Ver Ganadores'
                : `🏆 Finalizar (faltan ${partidos.filter(p => !p.resultado).length} resultados)`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#0A0C10' },
  centered:             { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:               { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backBtn:              { width: 60 },
  backText:             { color: '#9B59B6', fontSize: 15 },
  headerTitle:          { flex: 1, color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  estadoBadge:          { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  estadoText:           { fontSize: 10, fontWeight: 'bold' },
  content:              { padding: 15, paddingBottom: 50 },
  // Countdown
  countdownBox:         { backgroundColor: '#15181F', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: '#3498DB', flexDirection: 'row', alignItems: 'center' },
  countdownBoxUrgente:  { borderColor: '#E74C3C', backgroundColor: 'rgba(231,76,60,0.08)' },
  countdownLabel:       { color: '#A0A0A0', fontSize: 11, marginBottom: 4 },
  countdownTimer:       { color: '#3498DB', fontSize: 28, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  countdownFecha:       { color: '#505050', fontSize: 10, marginTop: 4 },
  countdownModoBadge:   { backgroundColor: '#1C1F26', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#2A2D35' },
  countdownModoText:    { color: '#A0A0A0', fontSize: 11, fontWeight: 'bold' },
  // Anulada
  anuladaBanner:        { backgroundColor: 'rgba(231,76,60,0.1)', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: '#E74C3C' },
  anuladaTitle:         { color: '#E74C3C', fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  anuladaDesc:          { color: '#A0A0A0', fontSize: 12, lineHeight: 18 },
  // Stats
  statsRow:             { flexDirection: 'row', backgroundColor: '#15181F', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#2A2D35' },
  statBox:              { flex: 1, alignItems: 'center', paddingVertical: 15 },
  statBorder:           { borderLeftWidth: 1, borderLeftColor: '#2A2D35' },
  statVal:              { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  statLabel:            { color: '#A0A0A0', fontSize: 11, marginTop: 2 },
  // Auto
  autoRow:              { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15181F', borderRadius: 12, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#2A2D35', gap: 12 },
  autoTitle:            { color: '#FFF', fontWeight: 'bold', fontSize: 14, marginBottom: 3 },
  autoDesc:             { color: '#707070', fontSize: 11, lineHeight: 16 },
  fetchBtn:             { backgroundColor: '#1C1F26', borderWidth: 1.5, borderColor: '#9B59B6', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12 },
  fetchBtnLoading:      { opacity: 0.6 },
  fetchBtnText:         { color: '#9B59B6', fontWeight: 'bold', fontSize: 14 },
  ganadoresBtn:         { backgroundColor: 'rgba(243,156,18,0.12)', borderWidth: 1.5, borderColor: '#F39C12', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  ganadoresBtnText:     { color: '#F39C12', fontWeight: 'bold', fontSize: 14 },
  // Cerrar
  cerrarBtn:            { backgroundColor: 'rgba(52,152,219,0.08)', borderWidth: 1.5, borderColor: '#3498DB', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16,
                          shadowColor: '#3498DB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  cerrarBtnText:        { color: '#3498DB', fontWeight: 'bold', fontSize: 16 },
  cerrarBtnSub:         { color: '#505050', fontSize: 11 },
  // Partidos
  sectionTitle:         { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  partidoCard:          { backgroundColor: '#15181F', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#2A2D35' },
  partidoHeader:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  partidoNum:           { color: '#505050', fontSize: 12, width: 22 },
  partidoEquipos:       { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  partidoFecha:         { color: '#707070', fontSize: 11, marginTop: 2 },
  fixtureId:            { color: '#404040', fontSize: 10, marginTop: 2 },
  resultadoActualBadge: { backgroundColor: '#2ECC71', borderRadius: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  resultadoActualText:  { color: '#000', fontWeight: 'bold', fontSize: 14 },
  opcionesRow:          { flexDirection: 'row', gap: 8 },
  opcionBtn:            { flex: 1, borderWidth: 1, borderColor: '#2A2D35', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  opcionText:           { color: '#A0A0A0', fontWeight: 'bold', fontSize: 16 },
  warningText:          { color: '#F39C12', fontSize: 11, marginTop: 8, textAlign: 'center' },
  finalizarBtn:         { marginTop: 20, borderWidth: 1.5, borderColor: '#505050', borderRadius: 14, padding: 16, alignItems: 'center', backgroundColor: '#1C1F26' },
  finalizarBtnActive:   { borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.1)', shadowColor: '#F39C12', shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 },
  finalizarText:        { color: '#F39C12', fontWeight: 'bold', fontSize: 15 },
});
