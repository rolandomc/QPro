import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ProgressBar from '../../src/components/ProgressBar';
import MatchSelectionCard from '../../src/components/MatchSelectionCard';
import FloatingActionButton from '../../src/components/FloatingActionButton';
import { FlatList } from 'react-native';

const PARTIDOS = [
  { id: 1, local: 'México 🇲🇽', visitante: '🇨🇦 Canadá', fecha: 'Hoy 18:00', stats: { local: '60%', empate: '25%', visita: '15%' } },
  { id: 2, local: 'Argentina 🇦🇷', visitante: '🇺🇾 Uruguay', fecha: 'Hoy 20:00', stats: { local: '45%', empate: '35%', visita: '20%' } },
  { id: 3, local: 'España 🇪🇸', visitante: '🇩🇪 Alemania', fecha: 'Mañana 14:00', stats: { local: '30%', empate: '40%', visita: '30%' } },
  { id: 4, local: 'Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿', visitante: '🇫🇷 Francia', fecha: 'Mañana 16:30', stats: { local: '50%', empate: '20%', visita: '30%' } },
];

export default function QuinielaDetailsScreen() {
  const router = useRouter();
  const [selecciones, setSelecciones] = useState<Record<number, string>>({});

  const handleSelect = (partidoId: number, opcion: string) => {
    setSelecciones(prev => ({ ...prev, [partidoId]: opcion }));
  };

  const currentSelections = Object.keys(selecciones).length;
  const totalMatches = PARTIDOS.length;
  const isComplete = currentSelections === totalMatches;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>🏆 Mundial 2026</Text>
        <View style={styles.spacer} />
      </View>

      <ProgressBar current={currentSelections} total={totalMatches} />

      <FlatList
        data={PARTIDOS}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: partido }) => (
          <MatchSelectionCard
            partido={partido}
            seleccionActual={selecciones[partido.id] || null}
            onSelect={(opcion) => handleSelect(partido.id, opcion)}
          />
        )}
      />

      <FloatingActionButton
        title="Pagar $50 MXN y Guardar"
        visible={isComplete}
        onPress={() => {
          console.log('Quiniela guardada:', selecciones);
          router.replace('/(tabs)/results');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15, marginBottom: 10,
  },
  backButton: { width: 60 },
  backText: { color: '#2ECC71', fontSize: 16 },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  spacer: { width: 60 },
  list: { paddingHorizontal: 15, paddingBottom: 100 },
});
