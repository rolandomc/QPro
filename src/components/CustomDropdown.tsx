import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  label: string;
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export default function CustomDropdown({ label, options, selectedValue, onSelect }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (option: string) => {
    onSelect(option);
    setIsOpen(false); // Cierra la lista al seleccionar
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      
      {/* Botón principal del Dropdown */}
      <TouchableOpacity 
        style={styles.dropdownBtn} 
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={styles.selectedText}>{selectedValue || "Selecciona una opción"}</Text>
        <Text style={styles.arrow}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Lista de opciones desplegable */}
      {isOpen && (
        <View style={styles.optionsContainer}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
            {options.map((option, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.optionBtn}
                onPress={() => handleSelect(option)}
              >
                <Text style={[styles.optionText, selectedValue === option && styles.activeOption]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative', zIndex: 10 },
  label: { color: '#A0A0A0', fontSize: 12, marginBottom: 5 },
  dropdownBtn: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#15181F', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#2A2D35' 
  },
  selectedText: { color: '#FFF', fontSize: 14 },
  arrow: { color: '#707070', fontSize: 12 },
  optionsContainer: {
    position: 'absolute', top: 65, left: 0, right: 0, 
    backgroundColor: '#1C1F26', borderRadius: 8, borderWidth: 1, borderColor: '#2A2D35',
    zIndex: 100, elevation: 5, overflow: 'hidden'
  },
  optionBtn: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  optionText: { color: '#A0A0A0', fontSize: 14 },
  activeOption: { color: '#2ECC71', fontWeight: 'bold' }
});