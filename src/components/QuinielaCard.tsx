import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../config/supabase';
import { colors } from '../theme/colors';

interface Props {
  id: string;
  titulo: string;
  descripcion?: string;
  precioEntrada: number;
  premioTotal: number;
  estado: 'abierta' | 'cerrada' | 'finalizada';
  totalPartidos: number;
  fechaCierre?: string;
  jugadoresMinimos?: number;
  porcentajeAdmin?: number;
}

export function QuinielaCard({
  id,
  titulo,
  descripcion,
  precioEntrada,
  premioTotal,
  estado,
  totalPartidos,
  fechaCierre,
  jugadoresMinimos = 0,
  porcentajeAdmin = 0,
}: Props) {
  const router = useRouter();
  const [jugadoresPagados, setJugadoresPagados] = useState(0);

  useEffect(() => {
    if (!id) return;
    let channel: any;
    const cargar = async () => {
      const { count } = await supabase
        .from('participaciones')
        .select('*', { count: 'exact', head: true })
        .eq('quiniela_id', id)
        .in('estado', ['pagado', 'ganador', 'perdedor']);
      setJugadoresPagados(count ?? 0);
    };
    cargar();
    channel = supabase
      .channel(`pozo-${id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'participaciones',
        filter: `quiniela_id=eq.${id}`,
      }, cargar)
      .subscribe();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [id]);

  const tieneConfigPozo   = jugadoresMinimos > 0;
  const pozoActual        = jugadoresPagados * precioEntrada;
  const premioCalculado   = tieneConfigPozo
    ? pozoActual * (1 - porcentajeAdmin / 100)
    : premioTotal;
  const minimoAlcanzado   = tieneConfigPozo ? jugadoresPagados >= jugadoresMinimos : true;
  const faltanJugadores   = Math.max(0, jugadoresMinimos - jugadoresPagados);
  const premioVisible     = !tieneConfigPozo || minimoAlcanzado;

  const estadoColor = estado === 'abierta' ? '#2ECC71' : estado === 'cerrada' ? '#E74C3C' : '#A0A0A0';
  const estadoLabel = estado === 'abierta' ? '🟢 Abierta' : estado === 'cerrada' ? '🔴 Cerrada' : '✅ Finalizada';

  return (
    <View style={styles.card}>

      {/* Header — igual al original */}
      <View style={styles.cardHeader}>
        <Text style={styles.title}>🏆 {titulo}</Text>
        <View style={[styles.estadoBadge, { borderColor: estadoColor }]}>
          <Text style={[styles.estadoText, { color: estadoColor }]}>{estadoLabel}</Text>
        </View>
      </View>

      {/* Descripcion — igual al original */}
      {descripcion ? <Text style={styles.descripcion}>{descripcion}</Text> : null}

      {/* Stats row — igual al original */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalPartidos}</Text>
          <Text style={styles.statLabel}>Partidos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>${precioEntrada}</Text>
          <Text style={styles.statLabel}>Entrada</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          {premioVisible ? (
            <Text style={[styles.statValue, { color: '#2ECC71' }]}>
              ${premioCalculado > 0 ? premioCalculado.toFixed(0) : '---'}
            </Text>
          ) : (
            <Text style={[styles.statValue, { color: '#505050' }]}>🔒 Oculto</Text>
          )}
          <Text style={styles.statLabel}>Premio</Text>
        </View>
      </View>

      {/* Barra de progreso — solo si hay minimo configurado */}
      {tieneConfigPozo && (
        <View style={styles.pozoBox}>
          {!minimoAlcanzado ? (
            <Text style={styles.faltanText}>
              ⏳ Faltan {faltanJugadores} jugador{faltanJugadores !== 1 ? 'es' : ''} para activar el pozo
            </Text>
          ) : (
            <Text style={styles.pozoActivoText}>✅ Pozo activo — creciendo en tiempo real</Text>
          )}
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                { width: `${Math.min((jugadoresPagados / jugadoresMinimos) * 100, 100)}%` },
                minimoAlcanzado && styles.progressFillGreen,
              ]} />
            </View>
            <Text style={styles.progressLabel}>{jugadoresPagados}/{jugadoresMinimos}</Text>
          </View>
        </View>
      )}

      {/* Boton Participar — igual al original */}
      <TouchableOpacity
        style={[styles.button, estado !== 'abierta' && styles.buttonDisabled]}
        disabled={estado !== 'abierta'}
        onPress={() => router.push({ pathname: '/quiniela/details', params: { id } })}
      >
        <Text style={[styles.buttonText, estado !== 'abierta' && { color: '#707070' }]}>
          {estado === 'abierta' ? 'Participar →' : 'No disponible'}
        </Text>
      </TouchableOpacity>

    </View>
  );
}

export default QuinielaCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title:           { color: colors.text, fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 10 },
  estadoBadge:     { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  estadoText:      { fontSize: 11, fontWeight: 'bold' },
  descripcion:     { color: colors.textMuted, fontSize: 13, marginBottom: 15 },
  statsRow:        { flexDirection: 'row', backgroundColor: '#1C1F26', borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center' },
  stat:            { flex: 1, alignItems: 'center' },
  statValue:       { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  statLabel:       { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statDivider:     { width: 1, height: 30, backgroundColor: '#2A2D35' },
  // Pozo
  pozoBox:         { backgroundColor: '#1C1F26', borderRadius: 10, padding: 10, marginBottom: 12 },
  faltanText:      { color: '#F39C12', fontSize: 11, marginBottom: 6 },
  pozoActivoText:  { color: '#2ECC71', fontSize: 11, marginBottom: 6 },
  progressRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack:   { flex: 1, height: 5, backgroundColor: '#2A2D35', borderRadius: 3, overflow: 'hidden' },
  progressFill:    { height: '100%', backgroundColor: '#F39C12', borderRadius: 3 },
  progressFillGreen: { backgroundColor: '#2ECC71' },
  progressLabel:   { color: '#707070', fontSize: 10, minWidth: 30, textAlign: 'right' },
  // Boton
  button:          { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  buttonDisabled:  { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35' },
  buttonText:      { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
