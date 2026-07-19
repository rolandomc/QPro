import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyQuinielas from '../../src/components/EmptyQuinielas';
import Header from '../../src/components/Header';
import { QuinielaCard } from '../../src/components/QuinielaCard';
import { useDeporte, type Deporte } from '../../src/context/DeporteContext';
import { QuinielasService } from '../../src/services/quinielas.service';
import { colors, radii, shadows, spacing, text } from '../../src/theme';

const DEPORTE_LABELS: Record<Deporte, { titulo: string; emoji: string }> = {
  futbol: { titulo: 'Quinielas de Fútbol', emoji: '⚽' },
  beisbol: { titulo: 'Quinielas de Béisbol', emoji: '⚾' },
  basquet: { titulo: 'Quinielas de Básquetbol', emoji: '🏀' },
};

export default function QuinielasScreen() {
  const [quinielas, setQuinielas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { deporteActivo, setDeporteActivo } = useDeporte();

  const loadQuinielas = useCallback(async () => {
    try {
      setError(null);
      const data = await QuinielasService.getQuinielasAbiertas();
      setQuinielas(data || []);
    } catch {
      setError('No se pudieron cargar las quinielas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadQuinielas();
    }, [loadQuinielas])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadQuinielas();
  }, [loadQuinielas]);

  const quinielasFiltradas = deporteActivo === 'futbol'
    ? quinielas.filter((q) => !q.deporte || q.deporte === 'futbol')
    : quinielas.filter((q) => q.deporte === deporteActivo);

  const { titulo, emoji } = DEPORTE_LABELS[deporteActivo];
  const estadoTitulo = deporteActivo === 'basquet'
    ? 'Próximamente'
    : quinielasFiltradas.length > 0
      ? 'Listas para jugar'
      : 'Sin actividad ahora';

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header deporteActivo={deporteActivo} onDeporteChange={setDeporteActivo} onRefresh={handleRefresh} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando quinielas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <Header deporteActivo={deporteActivo} onDeporteChange={setDeporteActivo} onRefresh={handleRefresh} />

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadQuinielas}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={quinielasFiltradas}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.listContent, quinielasFiltradas.length === 0 && { flex: 1 }]}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.heroCard}>
              <View style={styles.heroGlowLeft} pointerEvents="none" />
              <View style={styles.heroGlowRight} pointerEvents="none" />

              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>QPro Live</Text>
                </View>
                <TouchableOpacity onPress={handleRefresh} style={styles.heroAction} activeOpacity={0.8}>
                  <Text style={styles.heroActionText}>{refreshing ? 'Actualizando...' : 'Actualizar'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.heroHeadlineRow}>
                <Text style={styles.heroTitle}>{emoji} {titulo}</Text>
                <Text style={styles.heroSubtitle}>{estadoTitulo}</Text>
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{quinielasFiltradas.length}</Text>
                  <Text style={styles.metricLabel}>Disponibles</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{titulo}</Text>
                  <Text style={styles.metricLabel}>Deporte activo</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{estadoTitulo}</Text>
                  <Text style={styles.metricLabel}>Estado</Text>
                </View>
              </View>
            </View>

            {quinielasFiltradas.length > 0 && (
              <Text style={styles.sectionTitle}>{emoji} {titulo}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          deporteActivo === 'basquet'
            ? (
              <View style={styles.proximamenteContainer}>
                <Text style={styles.proximamenteEmoji}>{emoji}</Text>
                <Text style={styles.proximamenteTitulo}>Próximamente</Text>
                <Text style={styles.proximamenteSubtitulo}>
                  Las quinielas de {titulo.toLowerCase()} estarán disponibles muy pronto.
                </Text>
              </View>
            )
            : <EmptyQuinielas />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <QuinielaCard
            id={item.id}
            titulo={item.titulo}
            headerLabel={(item.liga ?? item.league ?? item.descripcion?.replace(/^Quiniela de\s*/i, '') ?? item.deporte ?? 'QPRO').toString()}
            headerDetail={item.deporte === 'beisbol' ? 'Béisbol' : 'Fútbol'}
            tagColor={colors.primary}
            precioEntrada={item.precio_entrada}
            premioTotal={item.premio_total}
            estado={item.estado}
            totalPartidos={item.partidos?.[0]?.count ?? 0}
            fechaCierre={item.fecha_primer_partido}
            jugadoresMinimos={item.jugadores_minimos ?? 0}
            porcentajeAdmin={item.porcentaje_admin ?? 0}
            numGanadores={item.num_ganadores ?? 1}
            porcentajesPremios={item.porcentajes_premios ?? [100]}
            jugadoresCount={item.jugadores_count ?? 0}
            yaParticipo={item.ya_participo ?? false}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  headerStack: { gap: spacing.md },
  heroCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    overflow: 'hidden',
    ...shadows.lg,
  },
  heroGlowLeft: {
    position: 'absolute',
    top: -40,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(53,208,127,0.18)',
  },
  heroGlowRight: {
    position: 'absolute',
    bottom: -42,
    right: -28,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(91,155,213,0.14)',
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  heroBadge: {
    backgroundColor: 'rgba(53,208,127,0.14)',
    borderColor: 'rgba(53,208,127,0.35)',
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  heroBadgeText: { ...text.label, color: colors.primary },
  heroAction: {
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroActionText: { ...text.label, color: colors.text },
  heroHeadlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  heroTitle: { ...text.itemTitle, color: colors.text, flex: 1 },
  heroSubtitle: { ...text.caption, color: colors.textMuted },
  metricRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: {
    flex: 1,
    minHeight: 58,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(8,12,20,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'space-between',
  },
  metricValue: { ...text.body, color: colors.text, fontWeight: '700' },
  metricLabel: { ...text.caption, color: colors.textMuted },
  sectionTitle: { ...text.sectionTitle, color: colors.text, marginBottom: spacing.xs, marginTop: spacing.xs },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 15 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  errorBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(231,76,60,0.10)', borderWidth: 1, borderColor: 'rgba(231,76,60,0.45)', margin: spacing.lg, padding: spacing.md, borderRadius: radii.md },
  errorText: { color: colors.error, fontSize: 13, flex: 1 },
  retryText: { color: colors.primary, fontWeight: 'bold', fontSize: 13, marginLeft: 10 },
  proximamenteContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  proximamenteEmoji: { fontSize: 64, marginBottom: 8 },
  proximamenteTitulo: { color: colors.text, fontSize: 22, fontWeight: 'bold' },
  proximamenteSubtitulo: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
});