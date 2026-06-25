import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import CustomDropdown from '../../src/components/CustomDropdown';

const LIGAS_DISPONIBLES = ['Premier League', 'La Liga', 'Liga MX', 'Champions League', 'Mundial'];

export default function CreateQuinielaScreen() {
  const router = useRouter();
  
  // Estados del formulario
  const [liga, setLiga] = useState('Premier League');
  const [jornada, setJornada] = useState('12');
  const [precio, setPrecio] = useState('50');
  const [minUsuarios, setMinUsuarios] = useState('10');
  
  // Estado de partidos (simulando respuesta de la API)
  const [partidosExtraidos, setPartidosExtraidos] = useState<any[]>([]);
  const [partidosSeleccionados, setPartidosSeleccionados] = useState<number[]>([]);

  const simularLlamadaApi = () => {
    // Aquí es donde iría el fetch() a Supabase que llama a football-data
    const mockData = [
      { id: 1, local: 'Arsenal', visitante: 'Chelsea', fecha: 'Sáb 20:00' },
      { id: 2, local: 'Man City', visitante: 'Liverpool', fecha: 'Dom 15:00' },
      { id: 3, local: 'Man Utd', visitante: 'Spurs', fecha: 'Dom 17:30' },
    ];
    setPartidosExtraidos(mockData);
  };

  const togglePartido = (id: number) => {
    if (partidosSeleccionados.includes(id)) {
      setPartidosSeleccionados(partidosSeleccionados.filter(pId => pId !== id));
    } else {
      setPartidosSeleccionados([...partidosSeleccionados, id]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Crear Quiniela</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Parámetros de la Quiniela */}
        <Text style={styles.sectionTitle}>1. Detalles del Premio</Text>
        <View style={styles.formRow}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Costo (MXN)</Text>
            <TextInput style={styles.input} value={precio} onChangeText={setPrecio} keyboardType="numeric" placeholderTextColor="#707070" />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mín. Usuarios</Text>
            <TextInput style={styles.input} value={minUsuarios} onChangeText={setMinUsuarios} keyboardType="numeric" placeholderTextColor="#707070" />
          </View>
        </View>

        {/* Extracción de la API */}
        <Text style={styles.sectionTitle}>2. Obtener Partidos (API)</Text>
        <View style={[styles.formRow, { zIndex: 10 }]}> 
          
          <CustomDropdown 
            label="Liga"
            options={LIGAS_DISPONIBLES}
            selectedValue={liga}
            onSelect={setLiga}
          />
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Jornada</Text>
            <TextInput style={styles.input} value={jornada} onChangeText={setJornada} keyboardType="numeric" placeholderTextColor="#707070" />
          </View>
        </View>

        <TouchableOpacity style={[styles.fetchBtn, styles.neonBorderBlue]} onPress={simularLlamadaApi}>
          <Text style={styles.fetchBtnText}>🔍 Buscar Partidos en API</Text>
        </TouchableOpacity>

        {/* Lista de Partidos a Seleccionar */}
        {partidosExtraidos.length > 0 && (
          <View style={{ zIndex: 1 }}> {/* zIndex menor para que no interfiera con el dropdown */}
            <Text style={styles.sectionTitle}>3. Seleccionar Partidos ({partidosSeleccionados.length})</Text>
            {partidosExtraidos.map((partido) => {
              const isSelected = partidosSeleccionados.includes(partido.id);
              return (
                <TouchableOpacity 
                  key={partido.id} 
                  style={[styles.matchCard, isSelected && styles.matchCardSelected]}
                  onPress={() => togglePartido(partido.id)}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View>
                    <Text style={styles.matchTeams}>{partido.local} vs {partido.visitante}</Text>
                    <Text style={styles.matchDate}>{partido.fecha}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Botón Final de Publicación */}
            <TouchableOpacity 
              style={[styles.publishBtn, partidosSeleccionados.length > 0 ? styles.neonBgGreen : styles.disabledBtn]}
              disabled={partidosSeleccionados.length === 0}
            >
              <Text style={styles.publishBtnText}>Publicar Quiniela</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2D35', zIndex: 20 },
  backButton: { width: 60 },
  backText: { color: '#9B59B6', fontSize: 16 },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 15, paddingBottom: 40 },
  
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 15 },
  
  formRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  inputContainer: { flex: 1 },
  label: { color: '#A0A0A0', fontSize: 12, marginBottom: 5 },
  input: { backgroundColor: '#15181F', color: '#FFF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#2A2D35', fontSize: 16, height: 48 },
  
  fetchBtn: { backgroundColor: '#15181F', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 5, borderWidth: 1.5, zIndex: 1 },
  neonBorderBlue: { borderColor: '#3498DB', shadowColor: '#3498DB', shadowOpacity: 0.6, shadowRadius: 8, elevation: 5 },
  fetchBtnText: { color: '#3498DB', fontWeight: 'bold', fontSize: 16 },

  matchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15181F', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#2A2D35' },
  matchCardSelected: { borderColor: '#2ECC71', backgroundColor: 'rgba(46, 204, 113, 0.05)' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#707070', marginRight: 15, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  checkmark: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  matchTeams: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  matchDate: { color: '#A0A0A0', fontSize: 12, marginTop: 2 },

  publishBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  neonBgGreen: { backgroundColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.8, shadowRadius: 10, elevation: 8 },
  disabledBtn: { backgroundColor: '#1C1F26', borderColor: '#2A2D35', borderWidth: 1 },
  publishBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});