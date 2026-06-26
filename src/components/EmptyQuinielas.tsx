import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
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

// Neon colors por posicion
const NEON = ['#FFD700', '#00E5FF', '#FF6B35'];
const NEON_BG = ['rgba(255,215,0,0.07)', 'rgba(0,229,255,0.06)', 'rgba(255,107,53,0.06)'];
const NEON_BORDER = ['rgba(255,215,0,0.4)', 'rgba(0,229,255,0.3)', 'rgba(255,107,53,0.3)'];
const MEDALLAS = ['🥇', '🥈', '🥉'];
const LABELS = ['CAMPEÓN', '2º LUGAR', '3º LUGAR'];

function QuinielaCard({ q }: { q: any }) {
  const [expanded, setExpanded] = useState(false);
  const fecha = new Date(q.created_at);
  const fechaStr = `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
  const bolsa = Number(q.premio_total || 0);

  return (
    <View style={card.wrap}>
      {/* Borde neon superior */}
      <View style={card.neonLine} />

      {/* Header */}
      <TouchableOpacity style={card.header} onPress={() => setExpanded(v => !v)} activeOpacity={0.75}>
        <View style={{ flex: 1 }}>
          <Text style={card.titulo} numberOfLines={1}>{q.titulo}</Text>
          <Text style={card.meta}>{fechaStr} • {q.total_jugadores} jugadores</Text>
        </View>
        <View style={card.bolsaBox}>
          <Text style={card.bolsaVal}>${bolsa.toLocaleString()}</Text>
          <Text style={card.bolsaLbl}>BOLSA</Text>
        </View>
      </TouchableOpacity>

      {/* Stats */}
      <View style={card.statsRow}>
        <View style={card.statItem}>
          <Text style={card.statNum}>${q.precio_entrada}</Text>
          <Text style={card.statLbl}>Entrada</Text>
        </View>
        <View style={card.statSep} />
        <View style={card.statItem}>
          <Text style={card.statNum}>{q.total_jugadores}</Text>
          <Text style={card.statLbl}>Jugadores</Text>
        </View>
        <View style={card.statSep} />
        <View style={card.statItem}>
          <Text style={[card.statNum, { color: '#2ECC71' }]}>${bolsa.toLocaleString()}</Text>
          <Text style={card.statLbl}>Premio</Text>
        </View>
      </View>

      {/* Podio desplegable */}
      {expanded && (
        <View style={card.podio}>
          <Text style={card.podioTitle}>🏆 TABLA DE HONOR</Text>

          {q.top3 && q.top3.length > 0 ? q.top3.map((j: any, i: number) => (
            <View key={i} style={[
              card.jugRow,
              { backgroundColor: NEON_BG[i], borderColor: NEON_BORDER[i] },
              i === 0 && card.jugRowFirst,
            ]}>
              {/* Rank badge */}
              <View style={[card.rankBadge, { borderColor: NEON[i] }]}>
                <Text style={card.rankEmoji}>{MEDALLAS[i]}</Text>
              </View>

              {/* Nombre + label */}
              <View style={{ flex: 1 }}>
                <Text style={[card.jugNombre, { color: NEON[i], textShadowColor: NEON[i], textShadowRadius: 8 }]}>
                  {j.username}
                </Text>
                <Text style={[card.jugLabel, { color: NEON[i], opacity: 0.7 }]}>{LABELS[i]}</Text>
              </View>

              {/* Aciertos */}
              <View style={[card.aciBox, { borderColor: NEON[i] + '55' }]}>
                <Text style={[card.aciNum, { color: NEON[i] }]}>{j.aciertos}</Text>
                <Text style={[card.aciLbl, { color: NEON[i], opacity: 0.6 }]}>aciertos</Text>
              </View>

              {/* Premio ganador */}
              {j.estado === 'ganador' && (
                <View style={card.premioNeon}>
                  <Text style={card.premioNeonVal}>
                    ${Number(j.monto_pagado || bolsa).toLocaleString()}
                  </Text>
                  <Text style={card.premioNeonLbl}>💰 COBRADO</Text>
                </View>
              )}
            </View>
          )) : (
            <Text style={card.sinData}>Sin resultados registrados</Text>
          )}
        </View>
      )}

      {/* Toggle btn */}
      <TouchableOpacity style={card.toggleBtn} onPress={() => setExpanded(v => !v)}>
        <Text style={card.toggleTxt}>
          {expanded ? 'OCULTAR PODIO  ▲' : 'VER PODIO  ▼'}
        </Text>
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
      <Text style={styles.sub}>{`El admin aún no ha publicado quinielas.\nVuelve pronto.`}</Text>

      {/* Countdown */}
      {proximaFecha && !countdown.pasado && (
        <View style={styles.cdBox}>
          <Text style={styles.cdLabel}>⏳ PRÓXIMA QUINIELA EN</Text>
          <View style={styles.cdRow}>
            {[{ v: countdown.dias, l: 'DÍAS' }, { v: countdown.horas, l: 'HORAS' }, { v: countdown.minutos, l: 'MIN' }, { v: countdown.segundos, l: 'SEG' }].map((u, i) => (
              <React.Fragment key={i}>
                {i > 0 && <Text style={styles.cdSep}>:</Text>}
                <View style={styles.cdUnit}>
                  <Text style={styles.cdNum}>{String(u.v).padStart(2, '0')}</Text>
                  <Text style={styles.cdLbl}>{u.l}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      {/* Notif btn */}
      <TouchableOpacity
        style={[styles.notifBtn, notifActiva && styles.notifOn]}
        onPress={handleNotificacion}
        disabled={notifActiva}
      >
        <Text style={[styles.notifTxt, notifActiva && { color: '#2ECC71' }]}>
          {notifActiva ? '🔔 Te avisaremos pronto ✅' : '🔔 Avísame cuando haya una nueva'}
        </Text>
      </TouchableOpacity>

      {/* Historial */}
      {finalizadas.length > 0 && (
        <View style={{ width: '100%' }}>
          <View style={styles.histHead}>
            <View style={styles.histLine} />
            <Text style={styles.histTitulo}>ÚLTIMAS QUINIELAS</Text>
            <View style={styles.histLine} />
          </View>
          {finalizadas.map((q) => <QuinielaCard key={q.id} q={q} />)}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 50, paddingBottom: 40, paddingHorizontal: 18 },
  icon:      { fontSize: 72, marginBottom: 14 },
  titulo:    { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  sub:       { color: '#606060', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 28 },

  // Countdown
  cdBox:  { width: '100%', backgroundColor: '#0D1117', borderRadius: 18, padding: 20, marginBottom: 20,
             borderWidth: 1.5, borderColor: '#F39C12',
             shadowColor: '#F39C12', shadowOpacity: 0.35, shadowRadius: 14, elevation: 8 },
  cdLabel:{ color: '#F39C12', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, textAlign: 'center', marginBottom: 14 },
  cdRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  cdUnit: { alignItems: 'center', minWidth: 58 },
  cdNum:  { color: '#FFF', fontSize: 38, fontWeight: 'bold',
             textShadowColor: '#F39C12', textShadowRadius: 10 },
  cdLbl:  { color: '#F39C12', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  cdSep:  { color: '#F39C12', fontSize: 30, fontWeight: 'bold', marginBottom: 16, opacity: 0.6 },

  // Notif
  notifBtn: { width: '100%', backgroundColor: '#0D1117', borderWidth: 1.5, borderColor: '#9B59B6',
              borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 32,
              shadowColor: '#9B59B6', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  notifOn:  { borderColor: '#2ECC71', shadowColor: '#2ECC71' },
  notifTxt: { color: '#9B59B6', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.5 },

  // Historial header
  histHead:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  histLine:   { flex: 1, height: 1, backgroundColor: '#2A2D35' },
  histTitulo: { color: '#606060', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
});

const card = StyleSheet.create({
  wrap:       { width: '100%', backgroundColor: '#0D1117', borderRadius: 18, marginBottom: 18,
                borderWidth: 1, borderColor: '#1E2330', overflow: 'hidden',
                shadowColor: '#9B59B6', shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  neonLine:   { height: 2, backgroundColor: '#9B59B6',
                shadowColor: '#9B59B6', shadowOpacity: 1, shadowRadius: 8 },

  header:    { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  titulo:    { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 3 },
  meta:      { color: '#404040', fontSize: 11 },
  bolsaBox:  { alignItems: 'flex-end' },
  bolsaVal:  { color: '#2ECC71', fontSize: 18, fontWeight: 'bold',
               textShadowColor: '#2ECC71', textShadowRadius: 8 },
  bolsaLbl:  { color: '#2ECC71', fontSize: 8, letterSpacing: 2, opacity: 0.7 },

  statsRow:  { flexDirection: 'row', backgroundColor: '#111520', paddingVertical: 10, paddingHorizontal: 16 },
  statItem:  { flex: 1, alignItems: 'center' },
  statNum:   { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  statLbl:   { color: '#404040', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  statSep:   { width: 1, backgroundColor: '#1E2330' },

  podio:      { padding: 16, borderTopWidth: 1, borderTopColor: '#1E2330' },
  podioTitle: { color: '#FFF', fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
                textAlign: 'center', marginBottom: 14, opacity: 0.6 },

  jugRow:      { flexDirection: 'row', alignItems: 'center', borderRadius: 14,
                 padding: 12, marginBottom: 8, gap: 10, borderWidth: 1 },
  jugRowFirst: { shadowColor: '#FFD700', shadowOpacity: 0.25, shadowRadius: 12, elevation: 5 },

  rankBadge: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5,
               justifyContent: 'center', alignItems: 'center',
               backgroundColor: 'rgba(0,0,0,0.4)' },
  rankEmoji: { fontSize: 22 },

  jugNombre: { fontSize: 14, fontWeight: 'bold' },
  jugLabel:  { fontSize: 9, letterSpacing: 1.5, marginTop: 2 },

  aciBox:  { alignItems: 'center', borderWidth: 1, borderRadius: 10,
             paddingHorizontal: 10, paddingVertical: 6, minWidth: 52 },
  aciNum:  { fontSize: 22, fontWeight: 'bold' },
  aciLbl:  { fontSize: 8, letterSpacing: 1, marginTop: 1 },

  premioNeon:    { alignItems: 'center', backgroundColor: 'rgba(46,204,113,0.08)',
                   borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6,
                   borderWidth: 1, borderColor: 'rgba(46,204,113,0.35)',
                   shadowColor: '#2ECC71', shadowOpacity: 0.4, shadowRadius: 8 },
  premioNeonVal: { color: '#2ECC71', fontSize: 12, fontWeight: 'bold',
                  textShadowColor: '#2ECC71', textShadowRadius: 6 },
  premioNeonLbl: { color: '#2ECC71', fontSize: 8, letterSpacing: 1, opacity: 0.7 },

  sinData:   { color: '#404040', textAlign: 'center', padding: 20, fontSize: 12, letterSpacing: 1 },

  toggleBtn: { paddingVertical: 11, alignItems: 'center',
               borderTopWidth: 1, borderTopColor: '#1E2330', backgroundColor: '#0A0D14' },
  toggleTxt: { color: '#9B59B6', fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
               textShadowColor: '#9B59B6', textShadowRadius: 6 },
});
