import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../src/components/Header';
import ResultCard from '../../src/components/ResultCard';
import SegmentedControl from '../../src/components/SegmentedControl';

export default function ResultsScreen() {
  const [tabIndex, setTabIndex] = useState('En Juego');

  // Datos simulados
  const partidosEnJuego = [
    { id: 10, local: 'México 🇲🇽', visitante: '🇨🇦 Canadá', score: '1 - 0 (Min 65\')', pronostico: 'Local', isWin: true }, // Simulamos que va ganando
  ];

  const historial = [
    { id: 1, local: 'Brasil 🇧🇷', visitante: '🇷🇸 Serbia', score: '2 - 0', pronostico: 'Local', isWin: true },
    { id: 2, local: 'Francia 🇫🇷', visitante: '🇦🇺 Australia', score: '4 - 1', pronostico: 'Local', isWin: true },
    { id: 3, local: 'Argentina 🇦🇷', visitante: '🇸🇦 Arabia S.', score: '1 - 2', pronostico: 'Local', isWin: false },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      
      <SegmentedControl 
        options={['En Juego', 'Historial']} 
        selectedOption={tabIndex} 
        onSelect={setTabIndex} 
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {tabIndex === 'En Juego' ? (
          <View>
            <View style={styles.liveIndicatorRow}>
              <View style={styles.liveDot} />
              <Text style={styles.sectionTitle}>Partidos en vivo</Text>
            </View>
            {partidosEnJuego.map(item => (
              <ResultCard key={item.id} {...item} />
            ))}
          </View>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Tus Pronósticos Pasados</Text>
            {historial.map(item => (
              <ResultCard key={item.id} {...item} />
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  content: { paddingHorizontal: 15, paddingBottom: 40 },
  liveIndicatorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  liveDot: { 
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#2ECC71', 
    marginRight: 10, shadowColor: '#2ECC71', shadowOpacity: 0.8, shadowRadius: 5 
  },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
});