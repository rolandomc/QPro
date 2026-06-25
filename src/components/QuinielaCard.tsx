import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { supabase } from '../config/supabase';

interface Props {
  quiniela: {
    id: string;
    titulo: string;
    descripcion?: string;
    precio_entrada: number;
    premio_total: number;
    estado: string;
    fecha_cierre?: string;
    jugadores_minimos?: number;
    porcentaje_admin?: number;
  };
  onPress: () => void;
}

export default function QuinielaCard({ quiniela, onPress }: Props) {
  const [jugadoresPagados, setJugadoresPagados] = useState(0);

  const jugMin     = quiniela.jugadores_minimos ?? 0;
  const pctAdmin   = quiniela.porcentaje_admin  ?? 0;
  const precio     = quiniela.precio_entrada    ?? 0;

  useEffect(() => {
    let channel: any;
    const cargar = async () => {
      const { count } = await supabase
        .from('participaciones')
        .select('*', { count: 'exact', head: true })
        .eq('quiniela_id', quiniela.id)
        .in('estado', ['pagado', 'ganador', 'perdedor']);
      setJugadoresPagados(count ?? 0);
    };
    cargar();
    // Suscripción Realtime para actualizar el pozo en vivo
    channel = supabase
      .channel(`pozo-${quiniela.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'participaciones',
        filter: `quiniela_id=eq.${quiniela.id}`,
      }, cargar)
      .subscribe();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [quiniela.id]);

  const pozoActual       = jugadoresPagados * precio;
  const premioActual     = pozoActual * (1 - pctAdmin / 100);
  const minimoAlcanzado  = jugMin > 0 ? jugadoresPagados >= jugMin : true;
  const faltanJugadores  = Math.max(0, jugMin - jugadoresPagados);

  const getEstadoColor = () => {
    if (quiniela.estado === 'abierta')    return '#2ECC71';
    if (quiniela.estado === 'cerrada')    return '#F39C12';
    if (quiniela.estado === 'finalizada') return '#707070';
    return '#A0A0A0';
  };

  const getEstadoLabel = () => {
    if (quiniela.estado === 'abierta')    return '🟢 ABIERTA';
    if (quiniela.estado === 'cerrada')    return '🟡 CERRADA';
    if (quiniela.estado === 'finalizada') return '⚪ FINALIZADA';
    return quiniela.estado.toUpperCase();
  };

  const fechaStr = quiniela.fecha_cierre
    ? new Date(quiniela.fecha_cierre).toLocaleDateString('es-MX', { dateStyle: 'medium' })
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.titulo} numberOfLines={2}>{quiniela.titulo}</Text>
        <View style={[styles.estadoBadge, { borderColor: getEstadoColor() }]}>
          <Text style={[styles.estadoText, { color: getEstadoColor() }]}>{getEstadoLabel()}</Text>
        </View>
      </View>

      {/* Premio */}
      <View style={styles.premioSection}>
        {minimoAlcanzado ? (
          <>
            <Text style={styles.premioLabel}>Premio acumulado</Text>
            <Text style={styles.premioValor}>${premioActual.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
          </>
        ) : (
          <>
            <Text style={styles.premioLabel}>Premio mínimo garantizado</Text>
            <Text style={styles.premioValorGris}>${(jugMin * precio * (1 - pctAdmin / 100)).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
            <View style={styles.faltanRow}>
              <Text style={styles.faltanText}>⏳ Faltan {faltanJugadores} jugador{faltanJugadores !== 1 ? 'es' : ''} para activar el pozo</Text>
            </View>
          </>
        )}
        {jugMin > 0 && (
          <View style={styles.progressoRow}>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                { width: `${Math.min((jugadoresPagados / jugMin) * 100, 100)}%` },
                minimoAlcanzado && styles.progressFillGreen,
              ]} />
            </View>
            <Text style={styles.progressLabel}>{jugadoresPagados}/{jugMin}</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Text style={styles.footerIcon}>💰</Text>
          <Text style={styles.footerText}>${precio} entrada</Text>
        </View>
        {pctAdmin > 0 && (
          <View style={styles.footerItem}>
            <Text style={styles.footerIcon}>🏠</Text>
            <Text style={styles.footerText}>{pctAdmin}% casa</Text>
          </View>
        )}
        {fechaStr && (
          <View style={styles.footerItem}>
            <Text style={styles.footerIcon}>📅</Text>
            <Text style={styles.footerText}>{fechaStr}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:              { backgroundColor: '#15181F', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: '#2A2D35' },
  cardHeader:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 10 },
  titulo:            { color: '#FFF', fontSize: 16, fontWeight: 'bold', flex: 1 },
  estadoBadge:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  estadoText:        { fontSize: 10, fontWeight: 'bold' },
  premioSection:     { backgroundColor: '#0A0C10', borderRadius: 10, padding: 12, marginBottom: 12 },
  premioLabel:       { color: '#A0A0A0', fontSize: 11, marginBottom: 4 },
  premioValor:       { color: '#F39C12', fontSize: 26, fontWeight: 'bold' },
  premioValorGris:   { color: '#505050', fontSize: 22, fontWeight: 'bold' },
  faltanRow:         { marginTop: 6 },
  faltanText:        { color: '#F39C12', fontSize: 11 },
  progressoRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  progressTrack:     { flex: 1, height: 5, backgroundColor: '#1C1F26', borderRadius: 3, overflow: 'hidden' },
  progressFill:      { height: '100%', backgroundColor: '#F39C12', borderRadius: 3 },
  progressFillGreen: { backgroundColor: '#2ECC71' },
  progressLabel:     { color: '#707070', fontSize: 10, minWidth: 30, textAlign: 'right' },
  cardFooter:        { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  footerItem:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerIcon:        { fontSize: 12 },
  footerText:        { color: '#707070', fontSize: 11 },
});
