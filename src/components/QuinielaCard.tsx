import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../config/supabase';
import { common } from '../styles';
import { colors, radii, shadows, spacing, text } from '../theme';

interface Props {
  id: string;
  titulo: string;
  descripcion?: string;
  headerLabel?: string;
  headerDetail?: string;
  tagColor?: string;
  precioEntrada: number;
  premioTotal: number;
  estado: 'abierta' | 'cerrada' | 'finalizada';
  totalPartidos: number;
  fechaCierre?: string;
  jugadoresMinimos?: number;
  porcentajeAdmin?: number;
  modoResultados?: boolean;
  jugadoresCount?: number;
  yaParticipo?: boolean;
}

// ─── Skeleton ────────────────────────────────────────────────
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
      style={[{ width, height, borderRadius: radii.xs, backgroundColor: colors.border, opacity: anim }, style]}
    />
  );
}

// ─── Componente principal ────────────────────────────────────────────
export function QuinielaCard({
  id, titulo, headerLabel, headerDetail, tagColor,
  precioEntrada, premioTotal, estado,
  totalPartidos, jugadoresMinimos = 0, porcentajeAdmin = 0,
  modoResultados = false, jugadoresCount, yaParticipo: yaParticipoInit,
}: Props) {
  const router   = useRouter();

  const [jugadoresPagados, setJugadoresPagados] = useState<number | null>(
    jugadoresCount !== undefined ? jugadoresCount : null
  );
  const [yaParticipo, setYaParticipo] = useState<boolean | null>(
    yaParticipoInit !== undefined ? yaParticipoInit : null
  );
  const [pagoPendiente, setPagoPendiente] = useState(false);

  useEffect(() => {
    if (!id) return;
    const needsCount     = jugadoresCount === undefined;
    const needsParticipo = yaParticipoInit === undefined;

    if (!needsCount && !needsParticipo) {
      const fetchPendingStatus = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: part } = await supabase
            .from('participaciones').select('id, estado')
            .eq('quiniela_id', id).eq('user_id', user.id).maybeSingle();
          setPagoPendiente(part?.estado === 'pendiente');
        }
      };
      fetchPendingStatus();
      const channel = supabase.channel(`pozo-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participaciones', filter: `quiniela_id=eq.${id}` },
          async () => { await fetchPendingStatus(); }
        ).subscribe();
      return () => { supabase.removeChannel(channel); };
    }

    let channel: any;
    const cargar = async () => {
      const { count } = await supabase.from('participaciones')
        .select('*', { count: 'exact', head: true })
        .eq('quiniela_id', id).in('estado', ['pagado', 'ganador', 'perdedor']);
      setJugadoresPagados(count ?? 0);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: part } = await supabase.from('participaciones')
          .select('id, estado').eq('quiniela_id', id).eq('user_id', user.id).maybeSingle();
        setYaParticipo(!!part);
        setPagoPendiente(part?.estado === 'pendiente');
      } else {
        setYaParticipo(false);
        setPagoPendiente(false);
      }
    };
    cargar();
    channel = supabase.channel(`pozo-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participaciones', filter: `quiniela_id=eq.${id}` }, cargar)
      .subscribe();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [id, jugadoresCount, yaParticipoInit]);

  const tieneMinimo     = jugadoresMinimos > 0;
  const jug             = jugadoresPagados ?? 0;
  const pozoActual      = jug * precioEntrada;
  const premioCalculado = tieneMinimo && porcentajeAdmin > 0
    ? pozoActual * (1 - porcentajeAdmin / 100) : premioTotal;
  const minimoAlcanzado = tieneMinimo ? jug >= jugadoresMinimos : true;
  const faltanJugadores = Math.max(0, jugadoresMinimos - jug);
  const premioVisible   = !tieneMinimo || minimoAlcanzado;
  const isLoading       = jugadoresPagados === null || yaParticipo === null;

  const handlePress = () => {
    if (modoResultados) { router.push(`/quiniela/${id}`); return; }
    if (estado === 'abierta') { router.push(`/quiniela/details?id=${id}`); return; }
    router.push(`/quiniela/${id}`);
  };
  const handleReintentarPago = () => router.push(`/quiniela/details?id=${id}`);

  const botonLabel  = modoResultados
    ? (estado === 'finalizada' ? 'Ver resultado →' : 'Ver mis picks →')
    : estado === 'abierta'
      ? (yaParticipo ? '✏️ Ver / Editar picks →' : 'JOIN POOL')
      : 'Ver detalle →';
  const botonActivo = modoResultados || estado === 'abierta';
  const progreso = tieneMinimo && jugadoresMinimos > 0
    ? Math.min((jug / jugadoresMinimos) * 100, 100)
    : Math.min(jug > 0 ? (jug / Math.max(totalPartidos, 1)) * 100 : 0, 100);
  const estadoEtiqueta = estado === 'abierta'
    ? 'Abierta'
    : estado === 'cerrada'
      ? 'Cerrada'
      : 'Finalizada';
  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.tag, { backgroundColor: tagColor ?? colors.primaryDim, borderColor: tagColor ?? colors.primary }]}>
            <Text style={styles.tagText}>{headerLabel ?? estadoEtiqueta}</Text>
          </View>
          <View style={styles.headerDetail}>
            <Text style={styles.headerDot}>{headerDetail === 'Béisbol' ? '⚾' : '⚽'}</Text>
            <Text style={styles.headerDetailText}>{headerDetail ?? 'Football'}</Text>
          </View>
        </View>
        <View style={styles.prizeContainer}>
          <Text style={styles.prizeLabel}>PRIZE POOL</Text>
          <Text style={styles.prizeAmount}>
            {isLoading ? <SkeletonBlock width={72} height={20} /> : `$${premioVisible ? premioCalculado.toFixed(0) : '---'}`}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{titulo}</Text>

      <View style={styles.statsRow}>
        <View style={styles.statColumn}>
          <Text style={styles.statLabel}>ENTRY</Text>
          <Text style={styles.statValue}>${precioEntrada}</Text>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.statHeader}>
            <Text style={styles.statLabel}>Players</Text>
            <Text style={styles.statValue}>{isLoading ? '...' : `${jug} / ${Math.max(jugadoresMinimos || totalPartidos, 1)}`}</Text>
          </View>
          <View style={styles.progressBarBg}>
            {isLoading ? (
              <View style={styles.progressBarFillLoading} />
            ) : (
              <View style={[styles.progressBarFill, { width: `${progreso}%` }]} />
            )}
          </View>
        </View>
      </View>

      {tieneMinimo && !isLoading && (
        <Text style={[text.caption, common.textFaint, { marginBottom: spacing.md }]}>
          {minimoAlcanzado
            ? 'Pozo activo — aumentando en tiempo real'
            : `Faltan ${faltanJugadores} jugador${faltanJugadores !== 1 ? 'es' : ''} para activar el pozo`}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.actionButton, !botonActivo && styles.actionButtonDisabled]}
        onPress={handlePress}
      >
        <Text style={[styles.actionButtonText, !botonActivo && styles.actionButtonTextDisabled]}>
          {botonLabel}
        </Text>
      </TouchableOpacity>

      {/* Reintentar pago */}
      {pagoPendiente && estado === 'abierta' && (
        <TouchableOpacity style={styles.reintentarBtn} onPress={handleReintentarPago} activeOpacity={0.8}>
          <Text style={styles.reintentarBtnText}>💳 Reintentar pago</Text>
        </TouchableOpacity>
      )}

    </TouchableOpacity>
  );
}

export default QuinielaCard;

// Solo estilos MUY específicos de este componente que no existen en common/layout
const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radii.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', ...shadows.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, flexWrap: 'wrap' },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.xs, minWidth: 72, borderWidth: 1 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  headerDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerDot: { fontSize: 12 },
  headerDetailText: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  prizeContainer: { alignItems: 'flex-end' },
  prizeLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  prizeAmount: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: -5, marginBottom: spacing.sm, lineHeight: 24 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, backgroundColor: colors.backgroundDeep, borderRadius: radii.md, padding: spacing.md },
  statColumn: { minWidth: 88 },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  progressSection: { flex: 1, marginLeft: spacing.md },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 },
  progressBarBg: { height: 6, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.primary },
  progressBarFillLoading: { width: '45%', height: '100%', backgroundColor: colors.cardElevated },
  actionButton: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center' },
  actionButtonDisabled: { backgroundColor: colors.backgroundDeep, borderWidth: 1, borderColor: colors.border },
  actionButtonText: { color: '#08110D', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionButtonTextDisabled: { color: colors.textFaint },
  reintentarBtn: { backgroundColor: colors.error, paddingVertical: 11, borderRadius: radii.md, alignItems: 'center', marginTop: spacing.sm },
  reintentarBtnText: { ...text.itemTitle, color: '#FFF' },
});
