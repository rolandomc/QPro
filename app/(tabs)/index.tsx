import React, { useCallback } from 'react';
import { StyleSheet, FlatList, StatusBar, View, Text, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useState } from 'react';
import Header from '../../src/components/Header';
import { QuinielaCard } from '../../src/components/QuinielaCard';
import EmptyQuinielas from '../../src/components/EmptyQuinielas';
import { QuinielasService } from '../../src/services/quinielas.service';
import { useDeporte, type Deporte } from '../../src/context/DeporteContext';

const DEPORTE_LABELS: Record<Deporte, { titulo: string; emoji: string }> = {
  futbol:  { titulo: 'Quinielas de F\u00fatbol',     emoji: '\u26bd' },
  beisbol: { titulo: 'Quinielas de B\u00e9isbol',    emoji: '\u26be' },
  basquet: { titulo: 'Quinielas de B\u00e1squetbol', emoji: '\ud83c\udfc0' },
};

export default function QuinielasScreen() {
  const [quinielas,  setQuinielas]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

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

  useFocusEffect(useCallback(() => { setLoading(true); loadQuinielas(); }, []));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadQuinielas();
  }, [loadQuinielas]);

  const quinielasFiltradas = deporteActivo === 'futbol'
    ? quinielas.filter((q) => !q.deporte || q.deporte === 'futbol')
    : quinielas.filter((q) => q.deporte === deporteActivo);

  const { titulo, emoji } = DEPORTE_LABELS[deporteActivo];

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header deporteActivo={deporteActivo} onDeporteChange={setDeporteActivo} onRefresh={handleRefresh} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2ECC71" />
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
        bounces={true}
        alwaysBounceVertical={true}
        ListEmptyComponent={
          deporteActivo === 'basquet'
            ? (
              <View style={styles.proximamenteContainer}>
                <Text style={styles.proximamenteEmoji}>{emoji}</Text>
                <Text style={styles.proximamenteTitulo}>Pr\u00f3ximamente</Text>
                <Text style={styles.proximamenteSubtitulo}>
                  Las quinielas de {titulo.toLowerCase()} estar\u00e1n disponibles muy pronto.
                </Text>
              </View>
            )
            : <EmptyQuinielas />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2ECC71"
            colors={['#2ECC71']}
          />
        }
        ListHeaderComponent={
          quinielasFiltradas.length > 0
            ? <Text style={styles.sectionTitle}>{emoji} {titulo}</Text>
            : null
        }
        renderItem={({ item }) => (
          <QuinielaCard
            id={item.id}
            titulo={item.titulo}
            descripcion={item.descripcion}
            precioEntrada={item.precio_entrada}
            premioTotal={item.premio_total}
            estado={item.estado}
            totalPartidos={item.partidos?.[0]?.count ?? 0}
            fechaCierre={item.fecha_primer_partido}
            jugadoresMinimos={item.jugadores_minimos ?? 0}
            porcentajeAdmin={item.porcentaje_admin ?? 0}
            jugadoresCount={item.jugadores_count ?? 0}
            yaParticipo={item.ya_participo ?? false}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: '#0A0C10' },
  listContent:           { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 40 },
  sectionTitle:          { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
  loadingContainer:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 15 },
  loadingText:           { color: '#A0A0A0', fontSize: 14 },
  errorBanner:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(231,76,60,0.1)', borderWidth: 1, borderColor: '#E74C3C', margin: 15, padding: 12, borderRadius: 10 },
  errorText:             { color: '#E74C3C', fontSize: 13, flex: 1 },
  retryText:             { color: '#2ECC71', fontWeight: 'bold', fontSize: 13, marginLeft: 10 },
  proximamenteContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  proximamenteEmoji:     { fontSize: 64, marginBottom: 8 },
  proximamenteTitulo:    { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  proximamenteSubtitulo: { color: '#606060', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
