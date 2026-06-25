import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import CustomDropdown from '../../src/components/CustomDropdown';
import { AdminService, CompetitionCode, COMPETITIONS } from '../../src/services/admin.service';

// Mapeo de nombre visible → código de API
const LIGAS_MAP: Record<string, CompetitionCode> = {
  '🇪🇸 La Liga': 'PD',
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League': 'PL',
  '🇲🇽 Liga MX': 'MX1',
  '⭐ Champions League': 'CL',
  '🌍 Mundial FIFA': 'WC',
  '🇩🇪 Bundesliga': 'BL1',
  '🇮🇹 Serie A': 'SA',
  '🇫🇷 Ligue 1': 'FL1',
};
const LIGAS_DISPONIBLES = Object.keys(LIGAS_MAP);

export default function CreateQuinielaScreen() {
  const router = useRouter();

  // Formulario
  const [titulo, setTitulo] = useState('');
  const [liga, setLiga] = useState(LIGAS_DISPONIBLES[0]);
  const [jornada, setJornada] = useState('');
  const [precio, setPrecio] = useState('50');
  const [fechaCierre, setFechaCierre] = useState('');

  // Partidos
  const [partidosExtraidos, setPartidosExtraidos] = useState<any[]>([]);
  const [partidosSeleccionados, setPartidosSeleccionados] = useState<string[]>([]);

  // Estados de carga
  const [loadingApi, setLoadingApi] = useState(false);
  const [loadingPublish, setLoadingPublish] = useState(false);

  // ID de la quiniela creada en el paso 1
  const [quinielaId, setQuinielaId] = useState<string | null>(null);

  // PASO 1: Crear la quiniela y luego llamar a la Edge Function
  const handleBuscarPartidos = async () => {
    if (!titulo.trim()) {
      Alert.alert('Falta info', 'Escribe un título para la quiniela antes de buscar partidos.');
      return;
    }

    setLoadingApi(true);
    setPartidosExtraidos([]);
    setPartidosSeleccionados([]);

    try {
      // 1a. Crear la quiniela en Supabase
      const nuevaQuiniela = await AdminService.createQuiniela(
        titulo,
        `Quiniela de ${liga}`,
        parseFloat(precio) || 50,
        fechaCierre || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      );
      setQuinielaId(nuevaQuiniela.id);

      // 1b. Llamar a la Edge Function para importar partidos
      const competitionCode = LIGAS_MAP[liga];
      const result = await AdminService.syncMatches(
        nuevaQuiniela.id,
        competitionCode,
        jornada ? parseInt(jornada) : undefined,
      );

      if (result.inserted === 0) {
        Alert.alert('⚠️ Sin partidos', 'La API no encontró partidos programados para esa jornada. Prueba sin especificar jornada.');
      } else {
        setPartidosExtraidos(result.matches || []);
        Alert.alert('✅ Éxito', `Se importaron ${result.inserted} partidos de ${result.competition}`);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo conectar con la API');
    } finally {
      setLoadingApi(false);
    }
  };

  const togglePartido = (id: string) => {
    setPartidosSeleccionados(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // PASO 2: Publicar la quiniela (ya está creada, solo cambiar estado)
  const handlePublicar = async () => {
    if (!quinielaId || partidosSeleccionados.length === 0) return;

    setLoadingPublish(true);
    try {
      await AdminService.updateEstado(quinielaId, 'abierta');
      Alert.alert(
        '🎉 ¡Quiniela Publicada!',
        `La quiniela "${titulo}" ya está visible para los usuarios con ${partidosSeleccionados.length} partidos.`,
        [{ text: 'OK', onPress: () => router.replace('/admin') }]
      );
    } catch (error: any) {
      Alert.alert('Error al publicar', error.message);
    } finally {
      setLoadingPublish(false);
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

        {/* SECCIÓN 1: Detalles */}
        <Text style={styles.sectionTitle}>1. Detalles de la Quiniela</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Título</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Jornada 15 - Liga MX"
            placeholderTextColor="#707070"
            value={titulo}
            onChangeText={setTitulo}
          />
        </View>

        <View style={styles.formRow}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Costo (MXN)</Text>
            <TextInput
              style={styles.input}
              value={precio}
              onChangeText={setPrecio}
              keyboardType="numeric"
              placeholderTextColor="#707070"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Jornada (opcional)</Text>
            <TextInput
              style={styles.input}
              value={jornada}
              onChangeText={setJornada}
              keyboardType="numeric"
              placeholder="Ej: 15"
              placeholderTextColor="#707070"
            />
          </View>
        </View>

        {/* SECCIÓN 2: API */}
        <Text style={styles.sectionTitle}>2. Obtener Partidos (API)</Text>
        <View style={[styles.formRow, { zIndex: 10 }]}>
          <CustomDropdown
            label="Liga"
            options={LIGAS_DISPONIBLES}
            selectedValue={liga}
            onSelect={setLiga}
          />
        </View>

        <TouchableOpacity
          style={[styles.fetchBtn, styles.neonBorderBlue]}
          onPress={handleBuscarPartidos}
          disabled={loadingApi}
        >
          {loadingApi
            ? <ActivityIndicator color="#3498DB" />
            : <Text style={styles.fetchBtnText}>🔍 Buscar Partidos en API</Text>
          }
        </TouchableOpacity>

        {/* SECCIÓN 3: Seleccionar partidos */}
        {partidosExtraidos.length > 0 && (
          <View style={{ zIndex: 1 }}>
            <Text style={styles.sectionTitle}>3. Seleccionar Partidos ({partidosSeleccionados.length})</Text>
            {partidosExtraidos.map((partido) => {
              const isSelected = partidosSeleccionados.includes(partido.id);
              const fecha = partido.fecha_partido
                ? new Date(partido.fecha_partido).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
                : '---';
              return (
                <TouchableOpacity
                  key={partido.id}
                  style={[styles.matchCard, isSelected && styles.matchCardSelected]}
                  onPress={() => togglePartido(partido.id)}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchTeams}>{partido.equipo_local} vs {partido.equipo_visitante}</Text>
                    <Text style={styles.matchDate}>{fecha}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.publishBtn, partidosSeleccionados.length > 0 ? styles.neonBgGreen : styles.disabledBtn]}
              disabled={partidosSeleccionados.length === 0 || loadingPublish}
              onPress={handlePublicar}
            >
              {loadingPublish
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.publishBtnText}>🚀 Publicar Quiniela ({partidosSeleccionados.length} partidos)</Text>
              }
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
  inputContainer: { flex: 1, marginBottom: 15 },
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
  matchTeams: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  matchDate: { color: '#A0A0A0', fontSize: 12, marginTop: 2 },

  publishBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  neonBgGreen: { backgroundColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.8, shadowRadius: 10, elevation: 8 },
  disabledBtn: { backgroundColor: '#1C1F26', borderColor: '#2A2D35', borderWidth: 1 },
  publishBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
