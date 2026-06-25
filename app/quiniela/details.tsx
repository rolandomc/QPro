import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ProgressBar from '../../src/components/ProgressBar';
import MatchSelectionCard from '../../src/components/MatchSelectionCard';
import FloatingActionButton from '../../src/components/FloatingActionButton';
import { FlatList } from 'react-native';
import { QuinielasService } from '../../src/services/quinielas.service';

export default function QuinielaDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [quiniela, setQuiniela] = useState<any>(null);
  const [partidos, setPartidos] = useState<any[]>([]);
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [yaParticipo, setYaParticipo] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // Cargar partidos reales de Supabase
      const [partidosData, yaParticipoData] = await Promise.all([
        QuinielasService.getPartidos(id),
        QuinielasService.yaParticipo(id),
      ]);

      // Cargar info de la quiniela
      const { data: quinielaData } = await import('../../src/config/supabase').then(({ supabase }) =>
        supabase.from('quinielas').select('*').eq('id', id).single()
      );

      setQuiniela(quinielaData);
      setPartidos(partidosData || []);
      setYaParticipo(yaParticipoData);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (partidoId: string, opcion: string) => {
    setSelecciones(prev => ({ ...prev, [partidoId]: opcion }));
  };

  const handleGuardar = async () => {
    if (yaParticipo) {
      Alert.alert('Ya participaste', 'Ya registraste tus selecciones en esta quiniela.');
      return;
    }

    setSaving(true);
    try {
      await QuinielasService.guardarSelecciones(
        id,
        selecciones as Record<string, 'local' | 'empate' | 'visitante'>
      );
      Alert.alert(
        '🎉 ¡Quiniela registrada!',
        'Tus selecciones han sido guardadas. ¡Buena suerte!',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (e: any) {
      Alert.alert('Error al guardar', e.message);
    } finally {
      setSaving(false);
    }
  };

  const currentSelections = Object.keys(selecciones).length;
  const totalMatches = partidos.length;
  const isComplete = currentSelections === totalMatches && totalMatches > 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2ECC71" />
          <Text style={{ color: '#A0A0A0', marginTop: 15 }}>Cargando partidos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{quiniela?.titulo ?? 'Quiniela'}</Text>
        <View style={styles.spacer} />
      </View>

      {yaParticipo && (
        <View style={styles.yaParticipoBar}>
          <Text style={styles.yaParticipoText}>✅ Ya registraste tus selecciones</Text>
        </View>
      )}

      <ProgressBar current={currentSelections} total={totalMatches} />

      <FlatList
        data={partidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: '#A0A0A0', fontSize: 14 }}>Esta quiniela no tiene partidos cargados aún.</Text>
          </View>
        }
        renderItem={({ item: partido }) => (
          <MatchSelectionCard
            partido={{
              id: partido.id,
              local: partido.equipo_local,
              visitante: partido.equipo_visitante,
              fecha: new Date(partido.fecha_partido).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }),
              stats: { local: '33%', empate: '33%', visita: '33%' },
            }}
            seleccionActual={selecciones[partido.id] || null}
            onSelect={(opcion) => handleSelect(partido.id, opcion)}
          />
        )}
      />

      <FloatingActionButton
        title={saving ? 'Guardando...' : `Confirmar y Pagar $${quiniela?.precio_entrada ?? 50} MXN`}
        visible={isComplete && !yaParticipo}
        onPress={handleGuardar}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, marginBottom: 10 },
  backButton: { width: 60 },
  backText: { color: '#2ECC71', fontSize: 16 },
  title: { color: '#FFF', fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  spacer: { width: 60 },
  list: { paddingHorizontal: 15, paddingBottom: 100 },
  yaParticipoBar: { backgroundColor: 'rgba(46,204,113,0.1)', borderWidth: 1, borderColor: '#2ECC71', marginHorizontal: 15, marginBottom: 10, padding: 10, borderRadius: 10, alignItems: 'center' },
  yaParticipoText: { color: '#2ECC71', fontWeight: 'bold', fontSize: 13 },
});
