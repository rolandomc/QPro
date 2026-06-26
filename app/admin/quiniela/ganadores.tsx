import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../src/config/supabase';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function GanadoresScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [quiniela,      setQuiniela]      = useState<any>(null);
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [totalPartidos, setTotalPartidos] = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [distribuyendo, setDistribuyendo] = useState(false);
  const [recalculando,  setRecalculando]  = useState(false);

  useEffect(() => { cargarDatos(); }, [id]);

  const cargarDatos = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [{ data: q, error: errQ }, { data: parts, error: errP }, { count }] = await Promise.all([
        supabase.from('quinielas').select('*').eq('id', id).single(),
        supabase.from('participaciones')
          .select('id, aciertos, monto_pagado, estado, premio_ganado, user_id')
          .eq('quiniela_id', id)
          .order('aciertos', { ascending: false, nullsFirst: false }),
        supabase.from('partidos').select('*', { count: 'exact', head: true }).eq('quiniela_id', id),
      ]);
      if (errQ) throw errQ;
      if (errP) throw errP;

      const userIds = (parts || []).map(p => p.user_id).filter(Boolean);
      let usernameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds);
        usernameMap = Object.fromEntries((profiles || []).map(pr => [pr.id, pr.username]));
      }

      setQuiniela(q);
      setParticipantes((parts || []).map(p => ({
        ...p,
        aciertos:      p.aciertos ?? 0,
        premio_ganado: p.premio_ganado ?? 0,
        username:      usernameMap[p.user_id] ?? 'Usuario',
      })));
      setTotalPartidos(count || 0);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalcular = async () => {
    setRecalculando(true);
    try {
      const { error } = await supabase.rpc('recalcular_aciertos', { p_quiniela_id: id });
      if (error) throw error;
      await cargarDatos();
      Alert.alert('✅ Aciertos actualizados');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setRecalculando(false);
    }
  };

  const handleDistribuirPremios = async () => {
    if (!quiniela) return;

    const topAciertos = participantes[0]?.aciertos ?? 0;
    if (topAciertos === 0) {
      Alert.alert('⚠️ Sin aciertos', 'Presiona "Recalcular Aciertos" primero.');
      return;
    }
    const premioTotal = quiniela.premio_total ?? 0;
    if (premioTotal <= 0) {
      Alert.alert('⚠️ Pozo vacío', 'El premio_total es 0. Actualiza la quiniela con el monto del pozo.');
      return;
    }

    const maxAciertos     = participantes[0].aciertos;
    const ganadores       = participantes.filter(p => p.aciertos === maxAciertos);
    const montoPorGanador = Math.round(premioTotal / ganadores.length);

    const msg = ganadores.length === 1
      ? `🏆 ${ganadores[0].username} — ${maxAciertos} aciertos\nPremio: $${montoPorGanador.toLocaleString()} (100% del pozo)`
      : `🥇 Empate entre ${ganadores.length} jugadores con ${maxAciertos} aciertos\nPremio: $${montoPorGanador.toLocaleString()} c/u`;

    Alert.alert('💰 Distribuir Premio',
      `Premio total: $${premioTotal.toLocaleString()}\n\n${msg}\n\n¿Confirmar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Distribuir',
          onPress: async () => {
            setDistribuyendo(true);
            try {
              const notificaciones: any[] = [];
              const ganadoresIds: string[] = [];

              // ─ Ganadores
              for (const g of ganadores) {
                const { error } = await supabase
                  .from('participaciones')
                  .update({ premio_ganado: montoPorGanador, estado: 'ganador' })
                  .eq('id', g.id);
                if (error) throw error;
                ganadoresIds.push(g.id);
                notificaciones.push({
                  user_id: g.user_id,
                  tipo:    'ganador',
                  titulo:  `🏆 ¡Ganaste en ${quiniela.titulo}!`,
                  mensaje: `Tuviste ${maxAciertos} aciertos y ganaste $${montoPorGanador.toLocaleString()}.`,
                  leida:   false,
                });
              }

              // ─ Perdedores
              const perdedores = participantes.filter(p => !ganadoresIds.includes(p.id));
              for (const p of perdedores) {
                const { error } = await supabase
                  .from('participaciones')
                  .update({ estado: 'perdedor' })
                  .eq('id', p.id);
                if (error) throw error;
                notificaciones.push({
                  user_id: p.user_id,
                  tipo:    'perdedor',
                  titulo:  `Resultado en ${quiniela.titulo}`,
                  mensaje: `Terminaste con ${p.aciertos} acierto${p.aciertos !== 1 ? 's' : ''}. ¡Suerte en la próxima!`,
                  leida:   false,
                });
              }

              // ─ Marcar quiniela como finalizada
              const { error: errFin } = await supabase
                .from('quinielas')
                .update({ estado: 'finalizada' })
                .eq('id', id);
              if (errFin) throw errFin;

              if (notificaciones.length > 0) {
                await supabase.from('notificaciones').insert(notificaciones);
              }

              await cargarDatos();
              Alert.alert(
                '🎉 ¡Premio distribuido!',
                `${ganadores[0].username} recibe $${montoPorGanador.toLocaleString()}.`,
              );
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

  // ── Premio ya distribuido si: alguna participación es 'ganador',
  //    hay premio_ganado > 0, O la quiniela ya está 'finalizada'
  const premioYaDistribuido =
    quiniela?.estado === 'finalizada' ||
    participantes.some(p => p.estado === 'ganador') ||
    participantes.some(p => (p.premio_ganado ?? 0) > 0);

  const premioTotal = quiniela?.premio_total ?? 0;

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
            <Text style={styles.resumenVal}>{participantes.length}</Text>
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

        {/* Badge estado */}
        {quiniela?.estado === 'finalizada' && (
          <View style={styles.finalizadaBadge}>
            <Text style={styles.finalizadaText}>✅ Quiniela finalizada</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.recalcularBtn, recalculando && { opacity: 0.6 }]}
          onPress={handleRecalcular}
          disabled={recalculando}
        >
          {recalculando
            ? <ActivityIndicator color="#3498DB" />
            : <Text style={styles.recalcularBtnText}>🔄 Recalcular Aciertos</Text>}
        </TouchableOpacity>

        {!premioYaDistribuido ? (
          <TouchableOpacity
            style={[styles.distribuirBtn, distribuyendo && { opacity: 0.6 }]}
            onPress={handleDistribuirPremios}
            disabled={distribuyendo}
          >
            {distribuyendo
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.distribuirBtnText}>💰 Distribuir Premio Ahora</Text>}
          </TouchableOpacity>
        ) : (
          <View style={styles.yaDistribuidoBadge}>
            <Text style={styles.yaDistribuidoText}>✅ Premio ya distribuido</Text>
          </View>
        )}

        {/* Regla */}
        <View style={styles.reglaBox}>
          <Text style={styles.reglaTitle}>Regla</Text>
          <Text style={styles.reglaItem}>🏆 El jugador con más aciertos gana el 100% del pozo</Text>
          <Text style={styles.reglaNote}>En caso de empate, el pozo se divide entre los empatados</Text>
        </View>

        {/* Ranking */}
        <Text style={styles.sectionTitle}>Tabla de Posiciones</Text>
        {participantes.map((part, index) => {
          const aciertos   = part.aciertos ?? 0;
          const porcentaje = totalPartidos > 0 ? Math.round((aciertos / totalPartidos) * 100) : 0;
          const esGanador  = part.estado === 'ganador';
          const esPerdedor = part.estado === 'perdedor';
          return (
            <View key={part.id} style={[
              styles.rankCard,
              index === 0    && styles.rankCardPrimero,
              esGanador      && styles.rankCardGanador,
              esPerdedor     && styles.rankCardPerdedor,
            ]}>
              <View style={styles.rankLeft}>
                <Text style={styles.rankPos}>{MEDALS[index] ?? `#${index + 1}`}</Text>
                <View>
                  <Text style={styles.rankUsername}>{part.username}</Text>
                  <Text style={styles.rankSub}>{aciertos}/{totalPartidos} aciertos · {porcentaje}%</Text>
                </View>
              </View>
              <View style={styles.rankRight}>
                {(part.premio_ganado ?? 0) > 0 && (
                  <Text style={styles.rankPremio}>${part.premio_ganado.toLocaleString()}</Text>
                )}
                {esGanador  && <Text style={styles.rankBadgeGanador}>🏆 GANADOR</Text>}
                {esPerdedor && <Text style={styles.rankBadgePerdedor}>PERDEDOR</Text>}
                {!esGanador && !esPerdedor && <Text style={styles.rankBadgePendiente}>PENDIENTE</Text>}
              </View>
            </View>
          );
        })}
        {participantes.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>😕 Nadie participó</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0A0C10' },
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:             { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15,
                        borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backBtn:            { width: 60 },
  backText:           { color: '#9B59B6', fontSize: 15 },
  headerTitle:        { flex: 1, color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  content:            { padding: 15, paddingBottom: 50 },
  resumenRow:         { flexDirection: 'row', backgroundColor: '#15181F', borderRadius: 12,
                        marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35' },
  resumenBox:         { flex: 1, alignItems: 'center', paddingVertical: 16 },
  resumenBorder:      { borderLeftWidth: 1, borderLeftColor: '#2A2D35' },
  resumenVal:         { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  resumenLabel:       { color: '#A0A0A0', fontSize: 11, marginTop: 3 },
  finalizadaBadge:    { backgroundColor: 'rgba(46,204,113,0.08)', borderWidth: 1,
                        borderColor: '#2ECC71', borderRadius: 10, padding: 10,
                        alignItems: 'center', marginBottom: 12 },
  finalizadaText:     { color: '#2ECC71', fontWeight: 'bold', fontSize: 13 },
  recalcularBtn:      { backgroundColor: '#1C1F26', borderWidth: 1.5, borderColor: '#3498DB',
                        borderRadius: 12, padding: 13, alignItems: 'center', marginBottom: 10 },
  recalcularBtnText:  { color: '#3498DB', fontWeight: 'bold', fontSize: 14 },
  distribuirBtn:      { backgroundColor: '#F39C12', borderRadius: 14, padding: 16,
                        alignItems: 'center', marginBottom: 14,
                        shadowColor: '#F39C12', shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  distribuirBtnText:  { color: '#000', fontWeight: 'bold', fontSize: 16 },
  yaDistribuidoBadge: { backgroundColor: 'rgba(46,204,113,0.1)', borderWidth: 1,
                        borderColor: '#2ECC71', borderRadius: 12, padding: 14,
                        alignItems: 'center', marginBottom: 14 },
  yaDistribuidoText:  { color: '#2ECC71', fontWeight: 'bold', fontSize: 14 },
  reglaBox:           { backgroundColor: '#15181F', borderRadius: 12, padding: 14,
                        marginBottom: 20, borderWidth: 1, borderColor: '#2A2D35' },
  reglaTitle:         { color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', marginBottom: 8,
                        textTransform: 'uppercase', letterSpacing: 0.5 },
  reglaItem:          { color: '#FFF', fontSize: 13, marginBottom: 4 },
  reglaNote:          { color: '#505050', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  sectionTitle:       { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  rankCard:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        backgroundColor: '#15181F', borderRadius: 12, padding: 14,
                        marginBottom: 10, borderWidth: 1, borderColor: '#2A2D35' },
  rankCardPrimero:    { borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.06)' },
  rankCardGanador:    { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.04)' },
  rankCardPerdedor:   { opacity: 0.5 },
  rankLeft:           { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rankPos:            { fontSize: 22, width: 32, textAlign: 'center' },
  rankUsername:       { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  rankSub:            { color: '#707070', fontSize: 12, marginTop: 2 },
  rankRight:          { alignItems: 'flex-end', gap: 4 },
  rankPremio:         { color: '#F39C12', fontWeight: 'bold', fontSize: 16 },
  rankBadgeGanador:   { color: '#2ECC71', fontSize: 11, fontWeight: 'bold' },
  rankBadgePerdedor:  { color: '#505050', fontSize: 10, fontWeight: 'bold',
                        borderWidth: 1, borderColor: '#505050', borderRadius: 4,
                        paddingHorizontal: 6, paddingVertical: 2 },
  rankBadgePendiente: { color: '#F39C12', fontSize: 10, fontWeight: 'bold',
                        borderWidth: 1, borderColor: '#F39C12', borderRadius: 4,
                        paddingHorizontal: 6, paddingVertical: 2 },
  emptyBox:           { alignItems: 'center', paddingVertical: 40 },
  emptyText:          { color: '#505050', fontSize: 16 },
});
