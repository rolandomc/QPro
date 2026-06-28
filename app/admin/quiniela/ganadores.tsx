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

      const userIds = (parts || []).map((p: any) => p.user_id).filter(Boolean);
      let usernameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds);
        usernameMap = Object.fromEntries((profiles || []).map((pr: any) => [pr.id, pr.username]));
      }

      setQuiniela(q);
      setParticipantes((parts || []).map((p: any) => ({
        ...p,
        aciertos:      p.aciertos ?? 0,
        premio_ganado: p.premio_ganado ?? 0,
        username:      usernameMap[p.user_id] ?? 'usuario',
      })));
      setTotalPartidos(count || 0);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const calcularPremioReal = () => {
    if (!quiniela) return 0;
    const premioGuardado = Number(quiniela.premio_total ?? 0);
    if (premioGuardado > 0) return premioGuardado;
    const pagados  = participantes.filter((p: any) => p.estado === 'pagado' || p.estado === 'pendiente').length;
    const pozo     = pagados * Number(quiniela.precio_entrada ?? 0);
    const adminPct = Number(quiniela.porcentaje_admin ?? 0);
    return Math.round(pozo * (1 - adminPct / 100));
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

    const premioReal = calcularPremioReal();
    if (premioReal <= 0) {
      Alert.alert('⚠️ Pozo vacío', 'No hay participantes o el precio de entrada es 0.');
      return;
    }

    const maxAciertos     = participantes[0].aciertos;
    const ganadores       = participantes.filter((p: any) => p.aciertos === maxAciertos);
    const montoPorGanador = Math.round(premioReal / ganadores.length);

    const msg = ganadores.length === 1
      ? `🏆 @${ganadores[0].username} — ${maxAciertos} aciertos\nPremio: $${montoPorGanador.toLocaleString()} (100% del pozo)`
      : `🥇 Empate entre ${ganadores.length} jugadores con ${maxAciertos} aciertos\nPremio: $${montoPorGanador.toLocaleString()} c/u`;

    Alert.alert('💰 Distribuir Premio',
      `Premio total: $${premioReal.toLocaleString()}\n\n${msg}\n\n¿Confirmar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Distribuir',
          onPress: async () => {
            setDistribuyendo(true);
            try {
              const notificaciones: any[]       = [];
              const walletTransactions: any[]   = [];
              const ganadoresIds: string[]      = [];

              // --- Ganadores ---
              for (const g of ganadores) {
                const { error } = await supabase
                  .from('participaciones')
                  .update({ premio_ganado: montoPorGanador, estado: 'ganador' })
                  .eq('id', g.id);
                if (error) throw error;

                ganadoresIds.push(g.id);

                // ✅ WALLET: acreditar premio al ganador
                walletTransactions.push({
                  user_id:      g.user_id,
                  tipo:         'premio',
                  monto:        montoPorGanador,
                  descripcion:  `Premio quiniela: ${quiniela.titulo}`,
                  referencia_id: g.id,
                });

                notificaciones.push({
                  user_id: g.user_id,
                  tipo:    'ganador',
                  titulo:  `🏆 ¡Ganaste en ${quiniela.titulo}!`,
                  mensaje: `Tuviste ${maxAciertos} aciertos y ganaste $${montoPorGanador.toLocaleString()}. Ya está en tu billetera.`,
                  leida:   false,
                });
              }

              // --- Perdedores ---
              const perdedores = participantes.filter((p: any) => !ganadoresIds.includes(p.id));
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

              // --- Insertar transacciones de wallet en lote ---
              if (walletTransactions.length > 0) {
                const { error: errWallet } = await supabase
                  .from('wallet_transactions')
                  .insert(walletTransactions);
                if (errWallet) throw errWallet;
              }

              // --- Finalizar quiniela ---
              const { error: errFin } = await supabase
                .from('quinielas')
                .update({ estado: 'finalizada', premio_total: premioReal })
                .eq('id', id);
              if (errFin) throw errFin;

              // --- Notificaciones ---
              if (notificaciones.length > 0) {
                await supabase.from('notificaciones').insert(notificaciones);
              }

              await cargarDatos();
              Alert.alert(
                '🎉 ¡Premio distribuido!',
                ganadores.length === 1
                  ? `@${ganadores[0].username} recibe $${montoPorGanador.toLocaleString()} en su billetera.`
                  : `${ganadores.length} ganadores reciben $${montoPorGanador.toLocaleString()} c/u en su billetera.`,
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

  // ---- Retrocompatibilidad: repartir premios de quinielas YA finalizadas sin wallet ----
  const handleReparar = async () => {
    Alert.alert(
      '🔧 Reparar Wallet',
      'Esto acreditará los premios de esta quiniela a los ganadores que aún no los tienen en su wallet.\n¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reparar', onPress: async () => {
          setDistribuyendo(true);
          try {
            const ganadores = participantes.filter((p: any) => p.estado === 'ganador' && (p.premio_ganado ?? 0) > 0);
            if (ganadores.length === 0) { Alert.alert('Sin ganadores marcados'); return; }

            // Verificar cuáles ya tienen transacción para no duplicar
            const { data: existing } = await supabase
              .from('wallet_transactions')
              .select('referencia_id')
              .in('referencia_id', ganadores.map((g: any) => g.id))
              .eq('tipo', 'premio');

            const yaAcreditados = new Set((existing || []).map((e: any) => e.referencia_id));
            const pendientes = ganadores.filter((g: any) => !yaAcreditados.has(g.id));

            if (pendientes.length === 0) {
              Alert.alert('✅ Ya estaban acreditados', 'Todos los ganadores ya tienen su premio en wallet.');
              return;
            }

            const inserts = pendientes.map((g: any) => ({
              user_id:      g.user_id,
              tipo:         'premio',
              monto:        g.premio_ganado,
              descripcion:  `Premio quiniela: ${quiniela.titulo}`,
              referencia_id: g.id,
            }));

            const { error } = await supabase.from('wallet_transactions').insert(inserts);
            if (error) throw error;

            Alert.alert('✅ Reparado', `Se acreditaron $${inserts.reduce((s: number, i: any) => s + i.monto, 0).toLocaleString()} a ${inserts.length} ganador(es).`);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setDistribuyendo(false);
          }
        }},
      ]
    );
  };

  const premioYaDistribuido = participantes.some((p: any) => p.estado === 'ganador');
  const premioReal = calcularPremioReal();

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
        <View style={styles.resumenRow}>
          <View style={styles.resumenBox}>
            <Text style={styles.resumenVal}>{participantes.length}</Text>
            <Text style={styles.resumenLabel}>Participantes</Text>
          </View>
          <View style={[styles.resumenBox, styles.resumenBorder]}>
            <Text style={[styles.resumenVal, { color: '#F39C12' }]}>${premioReal.toLocaleString()}</Text>
            <Text style={styles.resumenLabel}>Premio Total</Text>
          </View>
          <View style={[styles.resumenBox, styles.resumenBorder]}>
            <Text style={[styles.resumenVal, { color: '#3498DB' }]}>{totalPartidos}</Text>
            <Text style={styles.resumenLabel}>Partidos</Text>
          </View>
        </View>

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
          <View style={styles.yaDistribuidoContainer}>
            <View style={styles.yaDistribuidoBadge}>
              <Text style={styles.yaDistribuidoText}>✅ Premio ya distribuido</Text>
            </View>
            {/* Botón reparación para quinielas antiguas sin wallet */}
            <TouchableOpacity
              style={[styles.repararBtn, distribuyendo && { opacity: 0.6 }]}
              onPress={handleReparar}
              disabled={distribuyendo}
            >
              <Text style={styles.repararBtnText}>🔧 Reparar Wallet</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.reglaBox}>
          <Text style={styles.reglaTitle}>Regla</Text>
          <Text style={styles.reglaItem}>🏆 El jugador con más aciertos gana el 100% del pozo</Text>
          <Text style={styles.reglaNote}>En caso de empate, el pozo se divide entre los empatados</Text>
        </View>

        <Text style={styles.sectionTitle}>Tabla de Posiciones</Text>
        {participantes.map((part: any, index: number) => {
          const aciertos   = part.aciertos ?? 0;
          const porcentaje = totalPartidos > 0 ? Math.round((aciertos / totalPartidos) * 100) : 0;
          const esGanador  = part.estado === 'ganador';
          const esPerdedor = part.estado === 'perdedor';
          const esPagado   = part.estado === 'pagado';
          return (
            <View key={part.id} style={[
              styles.rankCard,
              index === 0 && styles.rankCardPrimero,
              esGanador   && styles.rankCardGanador,
              esPerdedor  && styles.rankCardPerdedor,
            ]}>
              <View style={styles.rankLeft}>
                <Text style={styles.rankPos}>{MEDALS[index] ?? `#${index + 1}`}</Text>
                <View>
                  <Text style={styles.rankUsername}>@{part.username}</Text>
                  <Text style={styles.rankSub}>{aciertos}/{totalPartidos} aciertos · {porcentaje}%</Text>
                </View>
              </View>
              <View style={styles.rankRight}>
                {(part.premio_ganado ?? 0) > 0 && (
                  <Text style={styles.rankPremio}>${part.premio_ganado.toLocaleString()}</Text>
                )}
                {esGanador  && <Text style={styles.rankBadgeGanador}>🏆 GANADOR</Text>}
                {esPerdedor && <Text style={styles.rankBadgePerdedor}>PERDEDOR</Text>}
                {esPagado   && <Text style={styles.rankBadgePagado}>✅ PAGADO</Text>}
                {!esGanador && !esPerdedor && !esPagado && <Text style={styles.rankBadgePendiente}>PENDIENTE</Text>}
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
  container:            { flex: 1, backgroundColor: '#0A0C10' },
  centered:             { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:               { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backBtn:              { width: 60 },
  backText:             { color: '#9B59B6', fontSize: 15 },
  headerTitle:          { flex: 1, color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  content:              { padding: 15, paddingBottom: 50 },
  resumenRow:           { flexDirection: 'row', backgroundColor: '#15181F', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35' },
  resumenBox:           { flex: 1, alignItems: 'center', paddingVertical: 16 },
  resumenBorder:        { borderLeftWidth: 1, borderLeftColor: '#2A2D35' },
  resumenVal:           { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  resumenLabel:         { color: '#A0A0A0', fontSize: 11, marginTop: 3 },
  finalizadaBadge:      { backgroundColor: 'rgba(46,204,113,0.08)', borderWidth: 1, borderColor: '#2ECC71', borderRadius: 10, padding: 10, alignItems: 'center', marginBottom: 12 },
  finalizadaText:       { color: '#2ECC71', fontWeight: 'bold', fontSize: 13 },
  recalcularBtn:        { backgroundColor: '#1C1F26', borderWidth: 1.5, borderColor: '#3498DB', borderRadius: 12, padding: 13, alignItems: 'center', marginBottom: 10 },
  recalcularBtnText:    { color: '#3498DB', fontWeight: 'bold', fontSize: 14 },
  distribuirBtn:        { backgroundColor: '#F39C12', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 14, shadowColor: '#F39C12', shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  distribuirBtnText:    { color: '#000', fontWeight: 'bold', fontSize: 16 },
  yaDistribuidoContainer:{ marginBottom: 14, gap: 8 },
  yaDistribuidoBadge:   { backgroundColor: 'rgba(46,204,113,0.1)', borderWidth: 1, borderColor: '#2ECC71', borderRadius: 12, padding: 14, alignItems: 'center' },
  yaDistribuidoText:    { color: '#2ECC71', fontWeight: 'bold', fontSize: 14 },
  repararBtn:           { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#F39C12', borderRadius: 12, padding: 12, alignItems: 'center' },
  repararBtnText:       { color: '#F39C12', fontWeight: '600', fontSize: 13 },
  reglaBox:             { backgroundColor: '#15181F', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#2A2D35' },
  reglaTitle:           { color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  reglaItem:            { color: '#FFF', fontSize: 13, marginBottom: 4 },
  reglaNote:            { color: '#505050', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  sectionTitle:         { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  rankCard:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#15181F', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2A2D35' },
  rankCardPrimero:      { borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.06)' },
  rankCardGanador:      { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.04)' },
  rankCardPerdedor:     { opacity: 0.5 },
  rankLeft:             { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rankPos:              { fontSize: 22, width: 32, textAlign: 'center' },
  rankUsername:         { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  rankSub:              { color: '#707070', fontSize: 12, marginTop: 2 },
  rankRight:            { alignItems: 'flex-end', gap: 4 },
  rankPremio:           { color: '#F39C12', fontWeight: 'bold', fontSize: 16 },
  rankBadgeGanador:     { color: '#2ECC71', fontSize: 11, fontWeight: 'bold' },
  rankBadgePerdedor:    { color: '#505050', fontSize: 10, fontWeight: 'bold', borderWidth: 1, borderColor: '#505050', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  rankBadgePagado:      { color: '#3498DB', fontSize: 10, fontWeight: 'bold', borderWidth: 1, borderColor: '#3498DB', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  rankBadgePendiente:   { color: '#F39C12', fontSize: 10, fontWeight: 'bold', borderWidth: 1, borderColor: '#F39C12', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  emptyBox:             { alignItems: 'center', paddingVertical: 40 },
  emptyText:            { color: '#505050', fontSize: 16 },
});
