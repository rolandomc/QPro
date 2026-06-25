import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../src/config/supabase';

const MEDALS = ['🥇', '🥈', '🥉'];

// Distribución del premio: 60% 1er lugar, 30% 2do, 10% 3er
const DIST = [0.60, 0.30, 0.10];

export default function GanadoresScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [quiniela,       setQuiniela]       = useState<any>(null);
  const [participantes,  setParticipantes]  = useState<any[]>([]);
  const [totalPartidos,  setTotalPartidos]  = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [distribuyendo,  setDistribuyendo]  = useState(false);

  useEffect(() => { cargarDatos(); }, [id]);

  const cargarDatos = async () => {
    if (!id) return;
    try {
      const [{ data: q }, { data: parts }, { count }] = await Promise.all([
        supabase.from('quinielas').select('*').eq('id', id).single(),
        supabase
          .from('participaciones')
          .select('id, aciertos, monto_pagado, estado, premio_ganado, profiles(username)')
          .eq('quiniela_id', id)
          .order('aciertos', { ascending: false }),
        supabase.from('partidos').select('*', { count: 'exact', head: true }).eq('quiniela_id', id),
      ]);
      setQuiniela(q);
      setParticipantes(parts || []);
      setTotalPartidos(count || 0);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Distribuir premios ──────────────────────────────────────────────────────
  const handleDistribuirPremios = async () => {
    if (!quiniela) return;

    const topAciertos = participantes[0]?.aciertos ?? 0;
    if (topAciertos === 0) {
      Alert.alert('⚠️ Sin ganadores', 'Nadie acertó ningún partido.');
      return;
    }

    // Agrupar por nivel de aciertos para empates
    const porAciertos: Record<number, any[]> = {};
    for (const p of participantes) {
      if (!porAciertos[p.aciertos]) porAciertos[p.aciertos] = [];
      porAciertos[p.aciertos].push(p);
    }

    const nivelesOrdenados = Object.keys(porAciertos)
      .map(Number)
      .sort((a, b) => b - a)
      .slice(0, 3); // máx 3 niveles con premio

    const premioTotal = quiniela.premio_total;
    if (premioTotal <= 0) {
      Alert.alert('⚠️ Sin fondo', 'El premio_total es 0. Verifica que los pagos estén registrados.');
      return;
    }

    Alert.alert(
      '💰 Distribuir Premios',
      `Premio total: $${premioTotal.toLocaleString()}\n\n` +
      nivelesOrdenados.map((aciertos, i) => {
        const grupo = porAciertos[aciertos];
        const pct   = DIST[i] ?? 0;
        const monto = (premioTotal * pct) / grupo.length;
        return `${MEDALS[i] ?? '🏅'} ${aciertos} aciertos (${grupo.length} persona${grupo.length > 1 ? 's' : ''}) — $${monto.toFixed(0)} c/u`;
      }).join('\n') +
      '\n\n¿Confirmar distribución?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Distribuir',
          onPress: async () => {
            setDistribuyendo(true);
            try {
              for (let i = 0; i < nivelesOrdenados.length; i++) {
                const aciertos = nivelesOrdenados[i];
                const grupo    = porAciertos[aciertos];
                const pct      = DIST[i] ?? 0;
                const monto    = (premioTotal * pct) / grupo.length;

                for (const part of grupo) {
                  await supabase
                    .from('participaciones')
                    .update({ premio_ganado: Math.round(monto), estado: 'ganador' })
                    .eq('id', part.id);
                }
              }
              // Marcar resto como 'perdedor'
              const ganadoresIds = nivelesOrdenados.flatMap(a => porAciertos[a].map((p: any) => p.id));
              const perdedores = participantes.filter(p => !ganadoresIds.includes(p.id));
              for (const p of perdedores) {
                await supabase
                  .from('participaciones')
                  .update({ estado: 'perdedor' })
                  .eq('id', p.id);
              }
              await cargarDatos();
              Alert.alert('🎉 ¡Premios distribuidos!', 'Los ganadores han sido notificados en su perfil.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setDistribuyendo(false);
            }
          },
        },
      ]
    );
  };

  const premioYaDistribuido = participantes.some(p => p.premio_ganado > 0);
  const premioTotal = quiniela?.premio_total ?? 0;
  const totalParticipantes = participantes.length;

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}><ActivityIndicator size="large" color="#F39C12" /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>🏆 {quiniela?.titulo}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Resumen */}
        <View style={styles.resumenRow}>
          <View style={styles.resumenBox}>
            <Text style={styles.resumenVal}>{totalParticipantes}</Text>
            <Text style={styles.resumenLabel}>Participantes</Text>
          </View>
          <View style={[styles.resumenBox, styles.resumenBorder]}>
            <Text style={[styles.resumenVal, { color: '#F39C12' }]}>${premioTotal.toLocaleString()}</Text>
            <Text style={styles.resumenLabel}>Premio Total</Text>
          </View>
          <View style={[styles.resumenBox, styles.resumenBorder]}>
            <Text style={[styles.resumenVal, { color: '#3498DB' }]}>{totalPartidos}</Text>
            <Text style={styles.resumenLabel}>Partidos</Text>
          </View>
        </View>

        {/* Botón distribuir */}
        {!premioYaDistribuido ? (
          <TouchableOpacity
            style={[styles.distribuirBtn, distribuyendo && { opacity: 0.6 }]}
            onPress={handleDistribuirPremios}
            disabled={distribuyendo}
          >
            {distribuyendo
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.distribuirBtnText}>💰 Distribuir Premios Ahora</Text>
            }
          </TouchableOpacity>
        ) : (
          <View style={styles.yaDistribuidoBadge}>
            <Text style={styles.yaDistribuidoText}>✅ Premios ya distribuidos</Text>
          </View>
        )}

        {/* Regla de distribución */}
        <View style={styles.reglaBox}>
          <Text style={styles.reglaTitle}>Regla de distribución</Text>
          <Text style={styles.reglaItem}>🥇 1er lugar — 60% del pozo</Text>
          <Text style={styles.reglaItem}>🥈 2do lugar — 30% del pozo</Text>
          <Text style={styles.reglaItem}>🥉 3er lugar — 10% del pozo</Text>
          <Text style={styles.reglaNote}>En caso de empate, el monto se divide entre los empatados</Text>
        </View>

        {/* Tabla de posiciones */}
        <Text style={styles.sectionTitle}>Tabla de Posiciones</Text>

        {participantes.map((part, index) => {
          const username = part.profiles?.username ?? 'Usuario';
          const aciertos = part.aciertos ?? 0;
          const porcentaje = totalPartidos > 0 ? Math.round((aciertos / totalPartidos) * 100) : 0;
          const esGanador = part.estado === 'ganador';
          const esPerdedor = part.estado === 'perdedor';
          const medal = MEDALS[index] ?? null;

          return (
            <View
              key={part.id}
              style={[
                styles.rankCard,
                esGanador  && styles.rankCardGanador,
                esPerdedor && styles.rankCardPerdedor,
                index === 0 && styles.rankCardPrimero,
              ]}
            >
              <View style={styles.rankLeft}>
                <Text style={styles.rankPos}>{medal ?? `#${index + 1}`}</Text>
                <View>
                  <Text style={styles.rankUsername}>{username}</Text>
                  <Text style={styles.rankSub}>
                    {aciertos}/{totalPartidos} aciertos · {porcentaje}%
                  </Text>
                </View>
              </View>
              <View style={styles.rankRight}>
                {part.premio_ganado > 0 && (
                  <Text style={styles.rankPremio}>${part.premio_ganado.toLocaleString()}</Text>
                )}
                {esGanador  && <Text style={styles.rankBadgeGanador}>GANADOR</Text>}
                {esPerdedor && <Text style={styles.rankBadgePerdedor}>PERDEDOR</Text>}
                {!esGanador && !esPerdedor && <Text style={styles.rankBadgePendiente}>PENDIENTE</Text>}
              </View>
            </View>
          );
        })}

        {participantes.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>😕 Nadie participó en esta quiniela</Text>
          </View>
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
  content:               { padding: 15, paddingBottom: 50 },
  resumenRow:            { flexDirection: 'row', backgroundColor: '#15181F', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35' },
  resumenBox:            { flex: 1, alignItems: 'center', paddingVertical: 16 },
  resumenBorder:         { borderLeftWidth: 1, borderLeftColor: '#2A2D35' },
  resumenVal:            { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  resumenLabel:          { color: '#A0A0A0', fontSize: 11, marginTop: 3 },
  distribuirBtn:         { backgroundColor: '#F39C12', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 14, shadowColor: '#F39C12', shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  distribuirBtnText:     { color: '#000', fontWeight: 'bold', fontSize: 16 },
  yaDistribuidoBadge:    { backgroundColor: 'rgba(46,204,113,0.1)', borderWidth: 1, borderColor: '#2ECC71', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 14 },
  yaDistribuidoText:     { color: '#2ECC71', fontWeight: 'bold', fontSize: 14 },
  reglaBox:              { backgroundColor: '#15181F', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#2A2D35' },
  reglaTitle:            { color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  reglaItem:             { color: '#FFF', fontSize: 13, marginBottom: 4 },
  reglaNote:             { color: '#505050', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  sectionTitle:          { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  rankCard:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#15181F', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2A2D35' },
  rankCardPrimero:       { borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.06)' },
  rankCardGanador:       { borderColor: '#2ECC71' },
  rankCardPerdedor:      { opacity: 0.5 },
  rankLeft:              { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rankPos:               { fontSize: 22, width: 32, textAlign: 'center' },
  rankUsername:          { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  rankSub:               { color: '#707070', fontSize: 12, marginTop: 2 },
  rankRight:             { alignItems: 'flex-end', gap: 4 },
  rankPremio:            { color: '#F39C12', fontWeight: 'bold', fontSize: 16 },
  rankBadgeGanador:      { color: '#2ECC71', fontSize: 10, fontWeight: 'bold', borderWidth: 1, borderColor: '#2ECC71', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  rankBadgePerdedor:     { color: '#505050', fontSize: 10, fontWeight: 'bold', borderWidth: 1, borderColor: '#505050', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  rankBadgePendiente:    { color: '#F39C12', fontSize: 10, fontWeight: 'bold', borderWidth: 1, borderColor: '#F39C12', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  emptyBox:              { alignItems: 'center', paddingVertical: 40 },
  emptyText:             { color: '#505050', fontSize: 16 },
});
