import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Animated } from 'react-native';
import { QuinielasService } from '../services/quinielas.service';

function useCountdown(targetDate: string | null) {
  const [tiempo, setTiempo] = useState({ dias: 0, horas: 0, minutos: 0, segundos: 0, pasado: false });
  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTiempo({ dias: 0, horas: 0, minutos: 0, segundos: 0, pasado: true }); return; }
      setTiempo({
        dias:     Math.floor(diff / 86400000),
        horas:    Math.floor((diff % 86400000) / 3600000),
        minutos:  Math.floor((diff % 3600000) / 60000),
        segundos: Math.floor((diff % 60000) / 1000),
        pasado: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return tiempo;
}

const MEDALLAS = ['🥇', '🥈', '🥉'];
const COLORS_PODIO = ['#FFD700', '#C0C0C0', '#CD7F32'];
const LABELS_PODIO = ['1er lugar', '2do lugar', '3er lugar'];

function QuinielaCard({ q }: { q: any }) {
  const [expanded, setExpanded] = useState(false);

  const fecha = new Date(q.created_at);
  const fechaStr = `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;

  return (
    <View style={card.container}>
      {/* Header siempre visible */}
      <TouchableOpacity style={card.header} onPress={() => setExpanded(v => !v)} activeOpacity={0.8}>
        <View style={card.headerLeft}>
          <Text style={card.titulo} numberOfLines={1}>{q.titulo}</Text>
          <Text style={card.fecha}>{fechaStr} • {q.total_jugadores} jugadores</Text>
        </View>
        <View style={card.headerRight}>
          <Text style={card.premio}>${Number(q.premio_total || 0).toLocaleString()}</Text>
          <Text style={card.premioLabel}>bolsa</Text>
        </View>
        <Text style={[card.chevron, expanded && { transform: [{ rotate: '180deg' }] }]}>▼</Text>
      </TouchableOpacity>

      {/* Stats row */}
      <View style={card.statsRow}>
        <View style={card.stat}>
          <Text style={card.statVal}>${q.precio_entrada}</Text>
          <Text style={card.statLbl}>Entrada</Text>
        </View>
        <View style={card.statDiv} />
        <View style={card.stat}>
          <Text style={card.statVal}>{q.total_jugadores}</Text>
          <Text style={card.statLbl}>Jugadores</Text>
        </View>
        <View style={card.statDiv} />
        <View style={card.stat}>
          <Text style={[card.statVal, { color: '#2ECC71' }]}>${Number(q.premio_total || 0).toLocaleString()}</Text>
          <Text style={card.statLbl}>Premio</Text>
        </View>
      </View>

      {/* Podio desplegable */}
      {expanded && (
        <View style={card.podioContainer}>
          <View style={card.podioTitleRow}>
            <Text style={card.podioTitle}>🏆 Tabla Final</Text>
          </View>

          {q.top3 && q.top3.length > 0 ? (
            q.top3.map((jugador: any, i: number) => (
              <View key={i} style={[
                card.jugadorRow,
                i === 0 && card.jugadorRowGold,
              ]}>
                {/* Medalla */}
                <Text style={card.medalla}>{MEDALLAS[i]}</Text>

                {/* Info */}
                <View style={card.jugadorInfo}>
                  <Text style={[card.jugadorNombre, { color: COLORS_PODIO[i] }]}>
                    {jugador.username}
                  </Text>
                  <Text style={card.jugadorLabel}>{LABELS_PODIO[i]}</Text>
                </View>

                {/* Aciertos */}
                <View style={card.aciertosBox}>
                  <Text style={[card.aciertosNum, { color: COLORS_PODIO[i] }]}>{jugador.aciertos}</Text>
                  <Text style={card.aciertosLabel}>aciertos</Text>
                </View>

                {/* Premio si es ganador */}
                {jugador.estado === 'ganador' && (
                  <View style={card.premioBox}>
                    <Text style={card.premioBoxVal}>${Number(jugador.monto_pagado || q.premio_total || 0).toLocaleString()}</Text>
                    <Text style={card.premioBoxLabel}>💰 premio</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={card.sinGanador}>Sin resultados registrados</Text>
          )}
        </View>
      )}

      {/* Tap para ver */}
      <TouchableOpacity style={card.verBtn} onPress={() => setExpanded(v => !v)}>
        <Text style={card.verBtnText}>{expanded ? 'Ocultar resultados ▲' : 'Ver resultados ▼'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function EmptyQuinielas() {
  const [proximaFecha, setProximaFecha] = useState<string | null>(null);
  const [finalizadas,  setFinalizadas]  = useState<any[]>([]);
  const [notifActiva,  setNotifActiva]  = useState(false);
  const countdown = useCountdown(proximaFecha);

  useEffect(() => {
    QuinielasService.getProximaFecha().then(f => setProximaFecha(f)).catch(() => {});
    QuinielasService.getFinalizadas().then(d => setFinalizadas(d || [])).catch(() => {});
  }, []);

  const handleNotificacion = () => {
    setNotifActiva(true);
    Alert.alert('Próximamente', 'Las notificaciones push estarán disponibles en la siguiente actualización.');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      <Text style={styles.icon}>🏆</Text>
      <Text style={styles.titulo}>Sin quinielas activas</Text>
      <Text style={styles.subtitulo}>{`El admin aún no ha publicado quinielas.\nVuelve pronto.`}</Text>

      {/* Countdown */}
      {proximaFecha && !countdown.pasado && (
        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>⏳ Próxima quiniela en</Text>
          <View style={styles.countdownRow}>
            {[{ v: countdown.dias, l: 'días' }, { v: countdown.horas, l: 'horas' }, { v: countdown.minutos, l: 'min' }, { v: countdown.segundos, l: 'seg' }].map((u, i) => (
              <React.Fragment key={i}>
                {i > 0 && <Text style={styles.countdownSep}>:</Text>}
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownNum}>{String(u.v).padStart(2, '0')}</Text>
                  <Text style={styles.countdownUnitLabel}>{u.l}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      {/* Boton notificaciones */}
      <TouchableOpacity
        style={[styles.notifBtn, notifActiva && styles.notifBtnActiva]}
        onPress={handleNotificacion}
        disabled={notifActiva}
      >
        <Text style={[styles.notifBtnText, notifActiva && { color: '#2ECC71' }]}>
          {notifActiva ? '🔔 Te avisaremos pronto ✅' : '🔔 Avísame cuando haya una nueva'}
        </Text>
      </TouchableOpacity>

      {/* Historial */}
      {finalizadas.length > 0 && (
        <View style={styles.historialBox}>
          <View style={styles.historialTituloRow}>
            <Text style={styles.historialTitulo}>📜 Últimas Quinielas</Text>
            <Text style={styles.historialSub}>Toca para ver el podio</Text>
          </View>
          {finalizadas.map((q) => <QuinielaCard key={q.id} q={q} />)}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:          { alignItems: 'center', paddingTop: 50, paddingBottom: 40, paddingHorizontal: 20 },
  icon:               { fontSize: 70, marginBottom: 16 },
  titulo:             { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  subtitulo:          { color: '#A0A0A0', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  countdownBox:       { backgroundColor: '#15181F', borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1.5, borderColor: '#F39C12', width: '100%', alignItems: 'center' },
  countdownLabel:     { color: '#F39C12', fontSize: 12, fontWeight: 'bold', marginBottom: 14, letterSpacing: 1 },
  countdownRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countdownUnit:      { alignItems: 'center', minWidth: 52 },
  countdownNum:       { color: '#FFF', fontSize: 36, fontWeight: 'bold' },
  countdownUnitLabel: { color: '#A0A0A0', fontSize: 10, marginTop: 2 },
  countdownSep:       { color: '#F39C12', fontSize: 30, fontWeight: 'bold', marginBottom: 14 },
  notifBtn:           { backgroundColor: '#15181F', borderWidth: 1.5, borderColor: '#9B59B6', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, marginBottom: 32, width: '100%', alignItems: 'center' },
  notifBtnActiva:     { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.08)' },
  notifBtnText:       { color: '#9B59B6', fontWeight: 'bold', fontSize: 15 },
  historialBox:       { width: '100%' },
  historialTituloRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  historialTitulo:    { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  historialSub:       { color: '#505050', fontSize: 11 },
});

const card = StyleSheet.create({
  container:      { backgroundColor: '#15181F', borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35', overflow: 'hidden' },
  header:         { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  headerLeft:     { flex: 1 },
  titulo:         { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  fecha:          { color: '#505050', fontSize: 11, marginTop: 2 },
  headerRight:    { alignItems: 'flex-end', marginRight: 6 },
  premio:         { color: '#2ECC71', fontSize: 16, fontWeight: 'bold' },
  premioLabel:    { color: '#505050', fontSize: 10 },
  chevron:        { color: '#F39C12', fontSize: 12 },
  statsRow:       { flexDirection: 'row', backgroundColor: '#1C1F26', paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  stat:           { flex: 1, alignItems: 'center' },
  statVal:        { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  statLbl:        { color: '#505050', fontSize: 10, marginTop: 1 },
  statDiv:        { width: 1, height: 24, backgroundColor: '#2A2D35' },
  podioContainer: { padding: 16, borderTopWidth: 1, borderTopColor: '#2A2D35' },
  podioTitleRow:  { marginBottom: 12 },
  podioTitle:     { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  jugadorRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1F26', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10, borderWidth: 1, borderColor: '#2A2D35' },
  jugadorRowGold: { borderColor: '#FFD70044', backgroundColor: '#1a1a0f' },
  medalla:        { fontSize: 28, width: 36, textAlign: 'center' },
  jugadorInfo:    { flex: 1 },
  jugadorNombre:  { fontSize: 14, fontWeight: 'bold' },
  jugadorLabel:   { color: '#505050', fontSize: 10, marginTop: 1 },
  aciertosBox:    { alignItems: 'center', marginRight: 4 },
  aciertosNum:    { fontSize: 20, fontWeight: 'bold' },
  aciertosLabel:  { color: '#505050', fontSize: 9 },
  premioBox:      { alignItems: 'center', backgroundColor: 'rgba(46,204,113,0.1)', borderRadius: 8, padding: 6, borderWidth: 1, borderColor: '#2ECC7144' },
  premioBoxVal:   { color: '#2ECC71', fontSize: 13, fontWeight: 'bold' },
  premioBoxLabel: { color: '#2ECC71', fontSize: 9 },
  sinGanador:     { color: '#505050', textAlign: 'center', padding: 16, fontSize: 13 },
  verBtn:         { paddingVertical: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#2A2D35' },
  verBtnText:     { color: '#F39C12', fontSize: 12, fontWeight: 'bold' },
});
