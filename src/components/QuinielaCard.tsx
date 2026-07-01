import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Share, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../config/supabase';
import { colors, spacing, radii, text } from '../theme';
import { common, layout } from '../styles';

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

// ─── Countdown hook ────────────────────────────────────────────
function useCountdown(fechaPrimerPartido?: string, estado?: string) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!fechaPrimerPartido || estado !== 'abierta') { setLabel(null); return; }
    const calc = () => {
      const diff = new Date(fechaPrimerPartido).getTime() - Date.now();
      if (diff <= 0) { setLabel(null); return; }
      const totalSecs = Math.floor(diff / 1000);
      const days  = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const mins  = Math.floor((totalSecs % 3600) / 60);
      const secs  = totalSecs % 60;
      if (days > 0) {
        setLabel(`⏱ Primer partido en ${days}d ${hours}h`);
      } else if (hours > 0) {
        setLabel(`⏱ Primer partido en ${hours}h ${String(mins).padStart(2,'0')}m`);
      } else {
        setLabel(`⚠️ ¡Últimos ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')} para participar!`);
      }
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [fechaPrimerPartido, estado]);
  return label;
}

// ─── Componente principal ────────────────────────────────────────────
export function QuinielaCard({
  id, titulo, descripcion, precioEntrada, premioTotal, estado,
  totalPartidos, fechaCierre, jugadoresMinimos = 0, porcentajeAdmin = 0,
  modoResultados = false, jugadoresCount, yaParticipo: yaParticipoInit,
}: Props) {
  const router   = useRouter();
  const countdown = useCountdown(fechaCierre, estado);

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
          async () => {
            const { count } = await supabase.from('participaciones')
              .select('*', { count: 'exact', head: true })
              .eq('quiniela_id', id).in('estado', ['pagado', 'ganador', 'perdedor', 'pendiente']);
            setJugadoresPagados(count ?? 0);
          }
        ).subscribe();
      return () => { supabase.removeChannel(channel); };
    }

    let channel: any;
    const cargar = async () => {
      const { count } = await supabase.from('participaciones')
        .select('*', { count: 'exact', head: true })
        .eq('quiniela_id', id).in('estado', ['pagado', 'ganador', 'perdedor', 'pendiente']);
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

  const estadoColor = estado === 'abierta' ? colors.success : estado === 'cerrada' ? colors.warning : colors.notifCerrada;
  const estadoLabel = estado === 'abierta' ? '🟢 Abierta' : estado === 'cerrada' ? '🟡 Cerrada' : '✅ Finalizada';

  const handlePress = () => {
    if (modoResultados) { router.push(`/quiniela/${id}`); return; }
    if (estado === 'abierta') { router.push(`/quiniela/details?id=${id}`); return; }
    router.push(`/quiniela/${id}`);
  };
  const handleReintentarPago = () => router.push(`/quiniela/details?id=${id}`);
  const handleShare = async () => {
    const premioTexto   = premioVisible && premioCalculado > 0 ? `$${premioCalculado.toFixed(0)} en juego` : `Entrada $${precioEntrada}`;
    const countdownTexto = countdown ? `\n${countdown}` : '';
    try {
      await Share.share({
        title: `🏆 ${titulo} — QPro`,
        message: `🏆 ${titulo}\n${premioTexto} · ${totalPartidos} partidos${countdownTexto}\n\n¡Únete y demuestra que sabes de fútbol! 👇\nqpro://quiniela/${id}`,
      });
    } catch (_) {}
  };

  const botonLabel  = modoResultados
    ? (estado === 'finalizada' ? 'Ver resultado →' : 'Ver mis picks →')
    : estado === 'abierta'
      ? (yaParticipo ? '✏️ Ver / Editar picks →' : 'Participar →')
      : 'Ver detalle →';
  const botonActivo = modoResultados || estado === 'abierta';

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>

      {/* Header */}
      <View style={[layout.rowBetween, { marginBottom: spacing.sm }]}>
        <Text style={styles.title}>🏆 {titulo}</Text>
        <View style={[layout.row, layout.gapSm]}>
          <View style={[common.badge, { borderWidth: 1, borderColor: estadoColor }]}>
            <Text style={[common.badgeText, { color: estadoColor }]}>{estadoLabel}</Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 16 }}>⬆️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {descripcion ? <Text style={[text.body, common.textMuted, { marginBottom: spacing.md }]}>{descripcion}</Text> : null}

      {/* Countdown */}
      {countdown && (
        <View style={styles.countdownRow}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalPartidos}</Text>
          <Text style={[text.label, common.textMuted]}>Partidos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>${precioEntrada}</Text>
          <Text style={[text.label, common.textMuted]}>Entrada</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          {isLoading ? (
            <SkeletonBlock width={52} height={20} style={{ marginBottom: spacing.xs }} />
          ) : premioVisible ? (
            <Text style={[styles.statValue, { color: colors.success }]}>
              ${premioCalculado > 0 ? premioCalculado.toFixed(0) : '---'}
            </Text>
          ) : (
            <Text style={[styles.statValue, { color: colors.textFaint }]}>🔒 Oculto</Text>
          )}
          <Text style={[text.label, common.textMuted]}>Premio</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          {isLoading ? (
            <SkeletonBlock width={32} height={20} style={{ marginBottom: spacing.xs }} />
          ) : (
            <Text style={[styles.statValue, { color: colors.info }]}>{jug}</Text>
          )}
          <Text style={[text.label, common.textMuted]}>Jugadores</Text>
        </View>
      </View>

      {/* Barra de mínimo */}
      {tieneMinimo && (
        <View style={styles.pozoBox}>
          {isLoading ? (
            <SkeletonBlock width="70%" height={12} style={{ marginBottom: spacing.sm }} />
          ) : !minimoAlcanzado ? (
            <Text style={[text.label, common.textWarning]}>
              ⏳ Faltan {faltanJugadores} jugador{faltanJugadores !== 1 ? 'es' : ''} para activar el pozo
            </Text>
          ) : (
            <Text style={[text.label, common.textSuccess]}>✅ Pozo activo — aumentando en tiempo real</Text>
          )}
          <View style={[layout.row, { gap: spacing.sm, marginTop: spacing.xs }]}>
            <View style={styles.progressTrack}>
              {isLoading ? (
                <SkeletonBlock width="40%" height={5} style={{ borderRadius: radii.xs }} />
              ) : (
                <View style={[
                  styles.progressFill,
                  { width: `${Math.min((jug / jugadoresMinimos) * 100, 100)}%` },
                  minimoAlcanzado && { backgroundColor: colors.success },
                ]} />
              )}
            </View>
            {isLoading ? (
              <SkeletonBlock width={28} height={10} />
            ) : (
              <Text style={[text.caption, common.textFaint]}>{jug}/{jugadoresMinimos}</Text>
            )}
          </View>
        </View>
      )}

      {/* Botón principal */}
      <TouchableOpacity
        style={[common.btnPrimary, !botonActivo && styles.buttonDisabled]}
        onPress={handlePress}
      >
        <Text style={[common.btnPrimaryText, !botonActivo && common.textFaint]}>
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
  card:           { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.xl, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  title:          { ...text.sectionTitle, color: colors.text, flex: 1, marginRight: spacing.sm },
  shareBtn:       { padding: spacing.xxs },
  countdownRow:   { backgroundColor: 'rgba(243,156,18,0.10)', borderWidth: 1, borderColor: 'rgba(243,156,18,0.3)', borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.md, alignSelf: 'flex-start' },
  countdownText:  { ...text.bodySmallBold, color: colors.warning, letterSpacing: 0.3 },
  statsRow:       { flexDirection: 'row', backgroundColor: colors.backgroundDeep, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md, alignItems: 'center' },
  stat:           { flex: 1, alignItems: 'center', minHeight: 40, justifyContent: 'center' },
  statValue:      { ...text.sectionTitle, color: colors.text },
  statDivider:    { width: 1, height: 30, backgroundColor: colors.border },
  pozoBox:        { backgroundColor: colors.backgroundDeep, borderRadius: radii.sm, padding: spacing.sm, marginBottom: spacing.md },
  progressTrack:  { flex: 1, height: 5, backgroundColor: colors.border, borderRadius: radii.xs, overflow: 'hidden' },
  progressFill:   { height: '100%', backgroundColor: colors.warning, borderRadius: radii.xs },
  buttonDisabled: { backgroundColor: colors.backgroundDeep, borderWidth: 1, borderColor: colors.border },
  reintentarBtn:     { backgroundColor: colors.error, paddingVertical: 11, borderRadius: radii.md, alignItems: 'center', marginTop: spacing.sm },
  reintentarBtnText: { ...text.itemTitle, color: '#FFF' },
});
