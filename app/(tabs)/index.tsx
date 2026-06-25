import React, { useState, useCallback } from 'react';
import { StyleSheet, FlatList, StatusBar, View, Text, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Header from '../../src/components/Header';
import { QuinielaCard } from '../../src/components/QuinielaCard';
import { QuinielasService } from '../../src/services/quinielas.service';

export default function QuinielasScreen() {
  const [quinielas, setQuinielas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuinielas = useCallback(async () => {
    try {
      setError(null);
      const data = await QuinielasService.getQuinielasAbiertas();
      setQuinielas(data || []);
    } catch (err: any) {
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
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadQuinielas();
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🏆</Text>
      <Text style={styles.emptyTitle}>Sin quinielas activas</Text>
      <Text style={styles.emptySubtitle}>El admin aún no ha publicado quinielas.{`\n`}Vuelve pronto.</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header />
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
      <Header />

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadQuinielas}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={quinielas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2ECC71" colors={['#2ECC71']} />
        }
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>🔥 Quinielas Disponibles</Text>
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
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  listContent: { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 40 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 15 },
  loadingText: { color: '#A0A0A0', fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 60, marginBottom: 15 },
  emptyTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  emptySubtitle: { color: '#A0A0A0', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  errorBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(231,76,60,0.1)', borderWidth: 1, borderColor: '#E74C3C', margin: 15, padding: 12, borderRadius: 10 },
  errorText: { color: '#E74C3C', fontSize: 13, flex: 1 },
  retryText: { color: '#2ECC71', fontWeight: 'bold', fontSize: 13, marginLeft: 10 },
});
