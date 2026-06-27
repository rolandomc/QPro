import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated } from 'react-native';
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
  modoResultados?: boolean;
  // Props precargados desde el service (evitan queries extras)
  jugadoresCount?: number;
  yaParticipo?: boolean;
}

// Bloque skeleton animado
function SkeletonBlock({ width, height = 18, style }: { width: number | string; height?: number; style?: any }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: 6, backgroundColor: '#2A2D35', opacity: anim }, style]}
    />
  );
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
  porcentajeAdmin  = 0,
  modoResultados   = false,
  jugadoresCount,
  yaParticipo: yaParticipoInit,
}: Props) {
  const router = useRouter();

  // Si vienen precargados del service, usarlos directamente; si no, iniciar en null para mostrar skeleton
  const [jugadoresPagados, setJugadoresPagados] = React.useState<number | null>(
    jugadoresCount !== undefined ? jugadoresCount : null
  );
  const [yaParticipo, setYaParticipo] = React.useState<boolean | null>(
    yaParticipoInit !== undefined ? yaParticipoInit : null
  );

  useEffect(() => {
    if (!id) return;
    // Solo lanzar query si no vinieron precargados
    const needsCount = jugadoresCount === undefined;
    const needsParticipo = yaParticipoInit === undefined;
    if (!needsCount && !needsParticipo) {
      // Todo precargado, solo suscribirse a cambios en tiempo real
      const channel = supabase
        .channel(`pozo-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participaciones', filter: `quiniela_id=eq.${id}` },
          async () => {
            const { count } = await supabase
              .from('participaciones')
              .select('*', { count: 'exact', head: true })
              .eq('quiniela_id', id)
              .in('estado', ['pagado', 'ganador', 'perdedor', 'pendiente']);
            setJugadoresPagados(count ?? 0);
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }

    // Fallback: cargar por cuenta propia si no vinieron precargados
    let channel: any;
    const cargar = async () => {
      const { count } = await supabase
        .from('participaciones')
        .select('*', { count: 'exact', head: true })
        .eq('quiniela_id', id)
        .in('estado', ['pagado', 'ganador', 'perdedor', 'pendiente']);
      setJugadoresPagados(count ?? 0);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: part } = await supabase
          .from('participaciones')
          .select('id')
          .eq('quiniela_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        setYaParticipo(!!part);
      } else {
        setYaParticipo(false);
      }
    };

    cargar();
    channel = supabase
      .channel(`pozo-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participaciones', filter: `quiniela_id=eq.${id}` }, cargar)
      .subscribe();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [id, jugadoresCount, yaParticipoInit]);

  const tieneMinimo     = jugadoresMinimos > 0;
  const jug             = jugadoresPagados ?? 0;
  const pozoActual      = jug * precioEntrada;
  const premioCalculado = tieneMinimo && porcentajeAdmin > 0
    ? pozoActual * (1 - porcentajeAdmin / 100)
    : premioTotal;
  const minimoAlcanzado = tieneMinimo ? jug >= jugadoresMinimos : true;
  const faltanJugadores = Math.max(0, jugadoresMinimos - jug);
  const premioVisible   = !tieneMinimo || minimoAlcanzado;

  const isLoading = jugadoresPagados === null || yaParticipo === null;

  const estadoColor = estado === 'abierta' ? '#2ECC71' : estado === 'cerrada' ? '#F39C12' : '#9B59B6';
  const estadoLabel = estado === 'abierta' ? '🟢 Abierta' : estado === 'cerrada' ? '🟡 Cerrada' : '✅ Finalizada';

  const handlePress = () => {
    if (!modoResultados && estado === 'abierta' && !yaParticipo) {
      router.push(`/quiniela/details?id=${id}`);
    } else {
      router.push(`/quiniela/${id}`);
    }
  };

  const botonLabel = modoResultados
    ? (estado === 'finalizada' ? 'Ver resultado →' : 'Ver mis picks →')
    : estado === 'abierta'
      ? (yaParticipo ? 'Ver mis picks →' : 'Participar →')
      : 'Ver detalle →';

  const botonActivo = modoResultados || estado === 'abierta';

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>🏆 {titulo}</Text>
        <View style={[styles.estadoBadge, { borderColor: estadoColor }]}>
          <Text style={[styles.estadoText, { color: estadoColor }]}>{estadoLabel}</Text>
        </View>
      </View>

      {descripcion ? <Text style={styles.descripcion}>{descripcion}</Text> : null}

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
          {isLoading ? (
            <SkeletonBlock width={52} height={20} style={{ marginBottom: 4 }} />
          ) : premioVisible ? (
            <Text style={[styles.statValue, { color: '#2ECC71' }]}>
              ${premioCalculado > 0 ? premioCalculado.toFixed(0) : '---'}
            </Text>
          ) : (
            <Text style={[styles.statValue, { color: '#505050' }]}>🔒 Oculto</Text>
          )}
          <Text style={styles.statLabel}>Premio</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          {isLoading ? (
            <SkeletonBlock width={32} height={20} style={{ marginBottom: 4 }} />
          ) : (
            <Text style={[styles.statValue, { color: '#00E5FF' }]}>{jug}</Text>
          )}
          <Text style={styles.statLabel}>Jugadores</Text>
        </View>
      </View>

      {tieneMinimo && (
        <View style={styles.pozoBox}>
          {isLoading ? (
            <SkeletonBlock width="70%" height={12} style={{ marginBottom: 8 }} />
          ) : !minimoAlcanzado ? (
            <Text style={styles.faltanText}>
              ⏳ Faltan {faltanJugadores} jugador{faltanJugadores !== 1 ? 'es' : ''} para activar el pozo
            </Text>
          ) : (
            <Text style={styles.pozoActivoText}>✅ Pozo activo — aumentando en tiempo real</Text>
          )}
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              {isLoading ? (
                <SkeletonBlock width="40%" height={5} style={{ borderRadius: 3 }} />
              ) : (
                <View style={[
                  styles.progressFill,
                  { width: `${Math.min((jug / jugadoresMinimos) * 100, 100)}%` },
                  minimoAlcanzado && styles.progressFillGreen,
                ]} />
              )}
            </View>
            {isLoading ? (
              <SkeletonBlock width={28} height={10} />
            ) : (
              <Text style={styles.progressLabel}>{jug}/{jugadoresMinimos}</Text>
            )}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, !botonActivo && styles.buttonDisabled]}
        onPress={handlePress}
      >
        <Text style={[styles.buttonText, !botonActivo && { color: '#707070' }]}>
          {botonLabel}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default QuinielaCard;

const styles = StyleSheet.create({
  card:              { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: colors.border },
  cardHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title:             { color: colors.text, fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 10 },
  estadoBadge:       { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  estadoText:        { fontSize: 11, fontWeight: 'bold' },
  descripcion:       { color: colors.textMuted, fontSize: 13, marginBottom: 15 },
  statsRow:          { flexDirection: 'row', backgroundColor: '#1C1F26', borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center' },
  stat:              { flex: 1, alignItems: 'center', minHeight: 40, justifyContent: 'center' },
  statValue:         { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  statLabel:         { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statDivider:       { width: 1, height: 30, backgroundColor: '#2A2D35' },
  pozoBox:           { backgroundColor: '#1C1F26', borderRadius: 10, padding: 10, marginBottom: 12 },
  faltanText:        { color: '#F39C12', fontSize: 11, marginBottom: 6 },
  pozoActivoText:    { color: '#2ECC71', fontSize: 11, marginBottom: 6 },
  progressRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack:     { flex: 1, height: 5, backgroundColor: '#2A2D35', borderRadius: 3, overflow: 'hidden' },
  progressFill:      { height: '100%', backgroundColor: '#F39C12', borderRadius: 3 },
  progressFillGreen: { backgroundColor: '#2ECC71' },
  progressLabel:     { color: '#707070', fontSize: 10, minWidth: 30, textAlign: 'right' },
  button:            { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  buttonDisabled:    { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35' },
  buttonText:        { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
