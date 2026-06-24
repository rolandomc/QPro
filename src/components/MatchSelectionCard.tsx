import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

interface Props {
  partido: any;
  seleccionActual: string | null;
  onSelect: (opcion: string) => void;
}

export default function MatchSelectionCard({ partido, seleccionActual, onSelect }: Props) {
  
  const OptionButton = ({ label, percentage }: { label: string, percentage: string }) => {
    const isSelected = seleccionActual === label;
    
    return (
      <Pressable 
        onPress={() => onSelect(label)}
        style={[styles.optionBtn, isSelected && styles.optionBtnSelected]}
      >
        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{label}</Text>
        <Text style={[styles.percentage, isSelected && styles.percentageSelected]}>{percentage}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.matchCard}>
      <Text style={styles.date}>{partido.fecha}</Text>
      <Text style={styles.teams}>{partido.local} vs {partido.visitante}</Text>
      
      <View style={styles.optionsRow}>
        <OptionButton label="Local" percentage={partido.stats.local} />
        <OptionButton label="Empate" percentage={partido.stats.empate} />
        <OptionButton label="Visita" percentage={partido.stats.visita} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  matchCard: {
    backgroundColor: '#15181F', borderRadius: 12, padding: 15, marginBottom: 15,
    borderWidth: 1, borderColor: '#2A2D35'
  },
  date: { color: '#A0A0A0', fontSize: 12, marginBottom: 10, textAlign: 'center' },
  teams: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  optionBtn: { 
    flex: 1, backgroundColor: '#1C1F26', paddingVertical: 10, borderRadius: 8, 
    alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35' 
  },
  optionBtnSelected: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)', borderColor: '#2ECC71',
    shadowColor: '#2ECC71', shadowOpacity: 0.5, shadowRadius: 5, elevation: 4
  },
  optionText: { color: '#A0A0A0', fontWeight: '600', marginBottom: 2 },
  optionTextSelected: { color: '#2ECC71', fontWeight: 'bold' },
  percentage: { color: '#707070', fontSize: 10 },
  percentageSelected: { color: '#2ECC71' }
});