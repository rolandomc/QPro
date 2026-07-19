import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

              {/* ✅ Premio ganador: ahora usa premio_ganado real de la BD */}
              {j.estado === 'ganador' && (
                <View style={card.premioNeon}>
                  <Text style={card.premioNeonVal}>
                    ${Number(j.premio_ganado > 0 ? j.premio_ganado : bolsa).toLocaleString()}
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
      <View style={styles.topPanel}>
        <View style={styles.topIconWrap}>
          <Text style={styles.topIcon}>⚡</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.topEyebrow}>ESTADO ACTUAL</Text>
          <Text style={styles.topTitle}>Lobby en espera</Text>
          <Text style={styles.topSub}>No hay pools abiertos por ahora.</Text>
        </View>
        <View style={styles.topChip}>
          <View style={styles.topChipDot} />
          <Text style={styles.topChipText}>Standby</Text>
        </View>
      </View>

      <View style={styles.factsRow}>
        <View style={styles.factPill}>
          <Text style={styles.factValue}>{finalizadas.length}</Text>
          <Text style={styles.factLabel}>Quinielas en historial</Text>
        </View>
        <View style={styles.factPill}>
          <Text style={styles.factValue}>{notifActiva ? 'ON' : 'OFF'}</Text>
          <Text style={styles.factLabel}>Avisos</Text>
        </View>
      </View>

      <Text style={styles.sub}>Estamos preparando la siguiente ronda. En cuanto se publique una nueva, te avisamos.</Text>

      {/* Countdown */}
      {proximaFecha && !countdown.pasado && (
        <View style={styles.cdBox}>
          <Text style={styles.cdLabel}>CUENTA REGRESIVA</Text>
          <Text style={styles.cdTitle}>Próxima quiniela en</Text>
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

      {!proximaFecha && (
        <View style={styles.cdBoxMuted}>
          <Text style={styles.cdMutedTitle}>Sin fecha programada todavía</Text>
          <Text style={styles.cdMutedSub}>El admin aún no define hora de publicación para la siguiente quiniela.</Text>
        </View>
      )}

      {/* Notif btn */}
      <TouchableOpacity
        style={[styles.notifBtn, notifActiva && styles.notifOn]}
        onPress={handleNotificacion}
        disabled={notifActiva}
      >
        <Text style={[styles.notifTxt, notifActiva && { color: '#2ECC71' }]}>
          {notifActiva ? 'Te avisaremos en cuanto salga la próxima' : 'Activar aviso de nueva quiniela'}
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
  container: { alignItems: 'center', paddingTop: 12, paddingBottom: 40, paddingHorizontal: 16 },

  topPanel: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#223047',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  topIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(77,163,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  topIcon: { fontSize: 18 },
  topEyebrow: { color: '#7FA8D8', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 1 },
  topTitle: { color: '#EAF0FA', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  topSub: { color: '#9AA8BF', fontSize: 12 },
  topChip: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(243,156,18,0.65)',
    backgroundColor: 'rgba(243,156,18,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  topChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F39C12', marginRight: 6 },
  topChipText: { color: '#FFD58B', fontSize: 11, fontWeight: '700' },

  factsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  factPill: {
    width: '49%',
    backgroundColor: '#0F1522',
    borderWidth: 1,
    borderColor: '#233049',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  factValue: { color: '#EAF0FA', fontSize: 16, fontWeight: '700' },
  factLabel: { color: '#93A2BA', fontSize: 11, marginTop: 1 },

  sub:       { color: '#97A2B2', fontSize: 13, textAlign: 'left', lineHeight: 20, width: '100%', marginBottom: 12 },

  // Countdown
  cdBox:  { width: '100%', backgroundColor: '#101722', borderRadius: 20, padding: 18, marginBottom: 18,
             borderWidth: 1.5, borderColor: 'rgba(243,156,18,0.8)',
             shadowColor: '#F39C12', shadowOpacity: 0.26, shadowRadius: 12, elevation: 6 },
  cdLabel:{ color: '#F7B955', fontSize: 10, fontWeight: '700', letterSpacing: 1.8, textAlign: 'center', marginBottom: 7 },
  cdTitle:{ color: '#FFF', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  cdRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  cdUnit: { alignItems: 'center', minWidth: 56, backgroundColor: '#0C1118', borderRadius: 12, paddingVertical: 8 },
  cdNum:  { color: '#FFF', fontSize: 30, fontWeight: '800',
             textShadowColor: '#F39C12', textShadowRadius: 10 },
  cdLbl:  { color: '#F7B955', fontSize: 9, letterSpacing: 1, marginTop: 1, fontWeight: '700' },
  cdSep:  { color: '#F39C12', fontSize: 24, fontWeight: '800', marginBottom: 8, opacity: 0.75 },
  cdBoxMuted: {
    width: '100%',
    backgroundColor: '#101722',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#253245',
  },
  cdMutedTitle: { color: '#D7DEEA', fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  cdMutedSub: { color: '#8D98A9', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // Notif
  notifBtn: { width: '100%', backgroundColor: '#132033', borderWidth: 1.5, borderColor: '#4DA3FF',
              borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 30,
              shadowColor: '#4DA3FF', shadowOpacity: 0.22, shadowRadius: 10, elevation: 4 },
  notifOn:  { borderColor: '#2ECC71', shadowColor: '#2ECC71' },
  notifTxt: { color: '#7CC0FF', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },

  // Historial header
  histHead:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  histLine:   { flex: 1, height: 1, backgroundColor: '#2A2D35' },
  histTitulo: { color: '#7F8CA1', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
});

const card = StyleSheet.create({
  wrap:       { width: '100%', backgroundColor: '#0F1622', borderRadius: 20, marginBottom: 16,
                borderWidth: 1, borderColor: '#263244', overflow: 'hidden',
                shadowColor: '#55B7FF', shadowOpacity: 0.13, shadowRadius: 10, elevation: 4 },
  neonLine:   { height: 2, backgroundColor: '#4DA3FF',
                shadowColor: '#4DA3FF', shadowOpacity: 0.7, shadowRadius: 6 },

  header:    { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  titulo:    { color: '#F5F7FA', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  meta:      { color: '#8A96A8', fontSize: 11 },
  bolsaBox:  { alignItems: 'flex-end' },
  bolsaVal:  { color: '#2ECC71', fontSize: 18, fontWeight: '700',
               textShadowColor: '#2ECC71', textShadowRadius: 8 },
  bolsaLbl:  { color: '#2ECC71', fontSize: 8, letterSpacing: 1.8, opacity: 0.7 },

  statsRow:  { flexDirection: 'row', backgroundColor: '#121A28', paddingVertical: 10, paddingHorizontal: 16 },
  statItem:  { flex: 1, alignItems: 'center' },
  statNum:   { color: '#F5F7FA', fontSize: 14, fontWeight: '700' },
  statLbl:   { color: '#8291A8', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  statSep:   { width: 1, backgroundColor: '#263244' },

  podio:      { padding: 16, borderTopWidth: 1, borderTopColor: '#263244' },
  podioTitle: { color: '#E5EAF3', fontSize: 11, fontWeight: '700', letterSpacing: 2,
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

  sinData:   { color: '#7F8CA1', textAlign: 'center', padding: 20, fontSize: 12, letterSpacing: 1 },

  toggleBtn: { paddingVertical: 11, alignItems: 'center',
               borderTopWidth: 1, borderTopColor: '#263244', backgroundColor: '#0D1420' },
  toggleTxt: { color: '#70B5FF', fontSize: 11, fontWeight: '700', letterSpacing: 2,
               textShadowColor: '#70B5FF', textShadowRadius: 4 },
});
