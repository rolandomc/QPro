import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { QuinielasService } from '../services/quinielas.service';

function useCountdown(targetDate: string | null) {
  const [tiempo, setTiempo] = useState({ dias: 0, horas: 0, minutos: 0, segundos: 0, pasado: false });

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTiempo({ dias: 0, horas: 0, minutos: 0, segundos: 0, pasado: true });
        return;
      }
      setTiempo({
        dias:     Math.floor(diff / 86400000),
        horas:    Math.floor((diff % 86400000) / 3600000),
        minutos:  Math.floor((diff % 3600000)  / 60000),
        segundos: Math.floor((diff % 60000)    / 1000),
        pasado: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return tiempo;
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

  // TODO: implementar con expo-notifications cuando se agregue
  const handleNotificacion = () => {
    setNotifActiva(true);
    Alert.alert('\uD83D\uDD14 Pr\u00F3ximamente', 'Las notificaciones push estar\u00E1n disponibles en la siguiente actualizaci\u00F3n.');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      <Text style={styles.icon}>\uD83C\uDFC6</Text>
      <Text style={styles.titulo}>Sin quinielas activas</Text>
      <Text style={styles.subtitulo}>{`El admin a\u00FAn no ha publicado quinielas.\nVuelve pronto.`}</Text>

      {/* Countdown */}
      {proximaFecha && !countdown.pasado && (
        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>\u23F3 Pr\u00F3xima quiniela en</Text>
          <View style={styles.countdownRow}>
            <View style={styles.countdownUnit}>
              <Text style={styles.countdownNum}>{String(countdown.dias).padStart(2, '0')}</Text>
              <Text style={styles.countdownUnitLabel}>d\u00EDas</Text>
            </View>
            <Text style={styles.countdownSep}>:</Text>
            <View style={styles.countdownUnit}>
              <Text style={styles.countdownNum}>{String(countdown.horas).padStart(2, '0')}</Text>
              <Text style={styles.countdownUnitLabel}>horas</Text>
            </View>
            <Text style={styles.countdownSep}>:</Text>
            <View style={styles.countdownUnit}>
              <Text style={styles.countdownNum}>{String(countdown.minutos).padStart(2, '0')}</Text>
              <Text style={styles.countdownUnitLabel}>min</Text>
            </View>
            <Text style={styles.countdownSep}>:</Text>
            <View style={styles.countdownUnit}>
              <Text style={styles.countdownNum}>{String(countdown.segundos).padStart(2, '0')}</Text>
              <Text style={styles.countdownUnitLabel}>seg</Text>
            </View>
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
          {notifActiva ? '\uD83D\uDD14 Te avisaremos cuando haya una nueva \u2705' : '\uD83D\uDD14 Av\u00EDsame cuando haya una nueva'}
        </Text>
      </TouchableOpacity>

      {/* Historial quinielas finalizadas */}
      {finalizadas.length > 0 && (
        <View style={styles.historialBox}>
          <Text style={styles.historialTitulo}>\uD83D\uDCDC \u00DAltimas Quinielas</Text>
          {finalizadas.map((q) => (
            <View key={q.id} style={styles.historialCard}>
              <View style={styles.historialHeader}>
                <Text style={styles.historialNombre} numberOfLines={1}>{q.titulo}</Text>
                <Text style={styles.historialEstado}>\u2705 Finalizada</Text>
              </View>
              <View style={styles.historialStats}>
                <View style={styles.historialStat}>
                  <Text style={styles.historialStatVal}>${q.premio_total > 0 ? Number(q.premio_total).toLocaleString() : '---'}</Text>
                  <Text style={styles.historialStatLabel}>Premio</Text>
                </View>
                <View style={styles.historialDivider} />
                <View style={styles.historialStat}>
                  <Text style={styles.historialStatVal}>{q.total_jugadores ?? '---'}</Text>
                  <Text style={styles.historialStatLabel}>Jugadores</Text>
                </View>
                <View style={styles.historialDivider} />
                <View style={styles.historialStat}>
                  <Text style={styles.historialStatVal}>${q.precio_entrada}</Text>
                  <Text style={styles.historialStatLabel}>Entrada</Text>
                </View>
              </View>
              {q.ganador_username && (
                <View style={styles.ganadorRow}>
                  <Text style={styles.ganadorIcon}>\uD83E\uDD47</Text>
                  <Text style={styles.ganadorText}>{q.ganador_username}</Text>
                </View>
              )}
            </View>
          ))}
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
  historialTitulo:    { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  historialCard:      { backgroundColor: '#15181F', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2A2D35' },
  historialHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  historialNombre:    { color: '#FFF', fontSize: 14, fontWeight: 'bold', flex: 1, marginRight: 8 },
  historialEstado:    { color: '#2ECC71', fontSize: 11 },
  historialStats:     { flexDirection: 'row', backgroundColor: '#1C1F26', borderRadius: 10, padding: 10, alignItems: 'center' },
  historialStat:      { flex: 1, alignItems: 'center' },
  historialStatVal:   { color: '#2ECC71', fontSize: 15, fontWeight: 'bold' },
  historialStatLabel: { color: '#A0A0A0', fontSize: 10, marginTop: 2 },
  historialDivider:   { width: 1, height: 28, backgroundColor: '#2A2D35' },
  ganadorRow:         { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  ganadorIcon:        { fontSize: 16 },
  ganadorText:        { color: '#F39C12', fontSize: 13, fontWeight: 'bold' },
});
