import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  Alert, TouchableOpacity, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import ProgressBar from '../../src/components/ProgressBar';
import MatchSelectionCard from '../../src/components/MatchSelectionCard';
import { QuinielasService } from '../../src/services/quinielas.service';
import { supabase } from '../../src/config/supabase';

export default function QuinielaDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [quiniela, setQuiniela] = useState<any>(null);
  const [partidos, setPartidos] = useState<any[]>([]);
  const [selecciones, setSelecciones] = useState<Record<string, 'local' | 'empate' | 'visitante'>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [yaParticipo, setYaParticipo] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [partidosData, yaParticipoData, { data: quinielaData }] = await Promise.all([
        QuinielasService.getPartidos(id),
        QuinielasService.yaParticipo(id),
        supabase.from('quinielas').select('*').eq('id', id).single(),
      ]);
      setQuiniela(quinielaData);
      setPartidos(partidosData || []);
      setYaParticipo(yaParticipoData);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(loadData);

  const handleSelect = (partidoId: string, opcion: 'local' | 'empate' | 'visitante') => {
    if (yaParticipo) return; // no permitir cambios si ya participó
    setSelecciones(prev => ({ ...prev, [partidoId]: opcion }));
  };

  const handleConfirmar = async () => {
    if (yaParticipo) return;
    const sinSeleccionar = partidos.filter(p => !selecciones[p.id]);
    if (sinSeleccionar.length > 0) {
      Alert.alert(
        'Faltan selecciones',
        `Aún te faltan ${sinSeleccionar.length} partido(s) por seleccionar.`
      );
      return;
    }

    Alert.alert(
      '🎉 Confirmar Participación',
      `¿Confirmar tu quiniela?\n\nCosto: $${quiniela?.precio_entrada ?? 50} MXN\n\nUna vez confirmada no podrás cambiar tus selecciones.`,
      [
        { text: 'Revisar', style: 'cancel' },
        {
          text: `Confirmar $${quiniela?.precio_entrada ?? 50}`,
          onPress: async () => {
            setSaving(true);
            try {
              await QuinielasService.guardarSelecciones(id, selecciones);
              Alert.alert(
                '✅ ¡Registrado!',
                '¡Tus selecciones han sido guardadas! Buena suerte 🍀',
                [{ text: 'Ver mis quinielas', onPress: () => router.replace('/(tabs)') }]
              );
            } catch (e: any) {
              Alert.alert('Error al guardar', e.message);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const totalSeleccionados = Object.keys(selecciones).length;
  const isComplete = totalSeleccionados === partidos.length && partidos.length > 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2ECC71" />
          <Text style={styles.loadingText}>Cargando partidos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{quiniela?.titulo ?? 'Quiniela'}</Text>
        <View style={styles.spacer} />
      </View>

      {/* Banner ya participó */}
      {yaParticipo && (
        <View style={styles.yaParticipoBar}>
          <Text style={styles.yaParticipoText}>✅ Ya registraste tus selecciones — ¡Buena suerte!</Text>
        </View>
      )}

      {/* Info de la quiniela */}
      <View style={styles.infoRow}>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>🏀 {partidos.length} partidos</Text>
        </View>
        <View style={[styles.infoPill, styles.infoPillGreen]}>
          <Text style={[styles.infoPillText, { color: '#2ECC71' }]}>💰 ${quiniela?.precio_entrada ?? 50} MXN</Text>
        </View>
        <View style={[styles.infoPill, styles.infoPillOrange]}>
          <Text style={[styles.infoPillText, { color: '#F39C12' }]}>🏆 Premio por definir</Text>
        </View>
      </View>

      {/* Barra de progreso */}
      <ProgressBar current={totalSeleccionados} total={partidos.length} />

      {/* Lista de partidos */}
      <FlatList
        data={partidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Esta quiniela no tiene partidos cargados.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <MatchSelectionCard
            partido={item}
            index={index}
            seleccionActual={selecciones[item.id] ?? null}
            onSelect={(opcion) => handleSelect(item.id, opcion)}
          />
        )}
      />

      {/* Botón flotante — solo si no ha participado */}
      {!yaParticipo && (
        <View style={styles.fab}>
          <TouchableOpacity
            style={[
              styles.fabBtn,
              isComplete ? styles.fabBtnActive : styles.fabBtnDisabled,
            ]}
            onPress={handleConfirmar}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={[styles.fabText, !isComplete && { color: '#505050' }]}>
                {isComplete
                  ? `🚀 Confirmar y Participar — $${quiniela?.precio_entrada ?? 50} MXN`
                  : `Selecciona todos los partidos (${totalSeleccionados}/${partidos.length})`
                }
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#A0A0A0', marginTop: 12, fontSize: 14 },
  emptyText: { color: '#A0A0A0', fontSize: 14, textAlign: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 15, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#2A2D35',
  },
  backBtn: { width: 60 },
  backText: { color: '#2ECC71', fontSize: 15 },
  title: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  spacer: { width: 60 },

  yaParticipoBar: {
    backgroundColor: 'rgba(46,204,113,0.1)',
    borderBottomWidth: 1, borderBottomColor: '#2ECC71',
    padding: 10, alignItems: 'center',
  },
  yaParticipoText: { color: '#2ECC71', fontWeight: 'bold', fontSize: 13 },

  infoRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 15, paddingVertical: 10,
  },
  infoPill: {
    flex: 1, backgroundColor: '#15181F',
    borderRadius: 8, padding: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35',
  },
  infoPillGreen: { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.05)' },
  infoPillOrange: { borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.05)' },
  infoPillText: { color: '#A0A0A0', fontSize: 11, fontWeight: '600', textAlign: 'center' },

  list: { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 120 },

  fab: {
    position: 'absolute', bottom: 25,
    left: 15, right: 15, zIndex: 100,
  },
  fabBtn: {
    padding: 16, borderRadius: 14, alignItems: 'center',
    borderWidth: 1,
  },
  fabBtnActive: {
    backgroundColor: '#2ECC71',
    borderColor: '#2ECC71',
    shadowColor: '#2ECC71', shadowOpacity: 0.7, shadowRadius: 12, elevation: 8,
  },
  fabBtnDisabled: {
    backgroundColor: '#15181F',
    borderColor: '#2A2D35',
  },
  fabText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
});
