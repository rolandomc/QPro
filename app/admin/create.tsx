import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import CustomDropdown from '../../src/components/CustomDropdown';
import { AdminService, CompetitionCode } from '../../src/services/admin.service';

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

  const [titulo, setTitulo] = useState('');
  const [liga, setLiga] = useState(LIGAS_DISPONIBLES[0]);
  const [jornada, setJornada] = useState('');
  const [precio, setPrecio] = useState('50');
  const [fechaCierre, setFechaCierre] = useState('');

  // Partidos traídos de la API (preview)
  const [partidosApi, setPartidosApi] = useState<any[]>([]);
  // IDs de partidos que el admin marca
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const [loadingApi, setLoadingApi] = useState(false);
  const [loadingPublish, setLoadingPublish] = useState(false);

  // PASO 1: Traer partidos de la API sin guardar nada
  const handleBuscarPartidos = async () => {
    setLoadingApi(true);
    setPartidosApi([]);
    setSeleccionados(new Set());
    try {
      const competitionCode = LIGAS_MAP[liga];
      const result = await AdminService.fetchMatches(
        competitionCode,
        jornada ? parseInt(jornada) : undefined,
      );
      if (!result.matches || result.matches.length === 0) {
        Alert.alert('⚠️ Sin resultados', 'No se encontraron partidos para esa jornada. Prueba sin especificar jornada.');
      } else {
        setPartidosApi(result.matches);
      }
    } catch (error: any) {
      Alert.alert('Error API', error.message || 'No se pudo conectar con la API');
    } finally {
      setLoadingApi(false);
    }
  };

  const togglePartido = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // PASO 2: Crear quiniela con SOLO los partidos seleccionados
  const handlePublicar = async () => {
    if (!titulo.trim()) {
      Alert.alert('Falta el título', 'Escribe un título para la quiniela.');
      return;
    }
    if (seleccionados.size === 0) {
      Alert.alert('Sin partidos', 'Selecciona al menos un partido.');
      return;
    }

    setLoadingPublish(true);
    try {
      const partidosElegidos = partidosApi.filter(p =>
        seleccionados.has(String(p.external_id ?? p.id))
      );

      await AdminService.createQuinielaConPartidos(
        titulo,
        `Quiniela de ${liga}`,
        parseFloat(precio) || 50,
        fechaCierre || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        partidosElegidos,
      );

      Alert.alert(
        '🎉 Quiniela Publicada',
        `"${titulo}" fue creada con ${seleccionados.size} partidos y ya es visible para los usuarios.`,
        // dismiss lleva al admin index sin duplicar el stack
        [{ text: 'OK', onPress: () => router.back() }]
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

        <Text style={styles.sectionTitle}>1. Detalles</Text>

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
            <TextInput style={styles.input} value={precio} onChangeText={setPrecio} keyboardType="numeric" placeholderTextColor="#707070" />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Jornada (opcional)</Text>
            <TextInput style={styles.input} value={jornada} onChangeText={setJornada} keyboardType="numeric" placeholder="Ej: 15" placeholderTextColor="#707070" />
          </View>
        </View>

        <Text style={styles.sectionTitle}>2. Obtener Partidos</Text>
        <View style={[styles.formRow, { zIndex: 10 }]}>
          <CustomDropdown label="Liga" options={LIGAS_DISPONIBLES} selectedValue={liga} onSelect={setLiga} />
        </View>

        <TouchableOpacity style={[styles.fetchBtn, styles.neonBorderBlue]} onPress={handleBuscarPartidos} disabled={loadingApi}>
          {loadingApi
            ? <ActivityIndicator color="#3498DB" />
            : <Text style={styles.fetchBtnText}>🔍 Traer Partidos (sin guardar)</Text>
          }
        </TouchableOpacity>

        {/* PASO 3: Seleccionar cuáles incluir */}
        {partidosApi.length > 0 && (
          <View style={{ zIndex: 1, marginTop: 20 }}>
            <Text style={styles.sectionTitle}>
              3. Seleccionar Partidos — {seleccionados.size} de {partidosApi.length} elegidos
            </Text>
            <Text style={styles.hintText}>Solo se guardarán los que marques ✓</Text>

            {partidosApi.map((partido) => {
              const pid = String(partido.external_id ?? partido.id);
              const isSelected = seleccionados.has(pid);
              const fecha = partido.fecha_partido ?? partido.utcDate
                ? new Date(partido.fecha_partido ?? partido.utcDate).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
                : '---';
              const local = partido.equipo_local ?? partido.homeTeam?.name ?? partido.homeTeam ?? '?';
              const visitante = partido.equipo_visitante ?? partido.awayTeam?.name ?? partido.awayTeam ?? '?';

              return (
                <TouchableOpacity
                  key={pid}
                  style={[styles.matchCard, isSelected && styles.matchCardSelected]}
                  onPress={() => togglePartido(pid)}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchTeams}>{local} vs {visitante}</Text>
                    <Text style={styles.matchDate}>{fecha}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.publishBtn, seleccionados.size > 0 ? styles.neonBgGreen : styles.disabledBtn]}
              disabled={seleccionados.size === 0 || loadingPublish}
              onPress={handlePublicar}
            >
              {loadingPublish
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.publishBtnText}>🚀 Publicar con {seleccionados.size} partido{seleccionados.size !== 1 ? 's' : ''}</Text>
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
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  hintText: { color: '#707070', fontSize: 12, marginBottom: 12, fontStyle: 'italic' },
  formRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  inputContainer: { flex: 1, marginBottom: 15 },
  label: { color: '#A0A0A0', fontSize: 12, marginBottom: 5 },
  input: { backgroundColor: '#15181F', color: '#FFF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#2A2D35', fontSize: 16, height: 48 },
  fetchBtn: { backgroundColor: '#15181F', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 5, borderWidth: 1.5, zIndex: 1 },
  neonBorderBlue: { borderColor: '#3498DB', shadowColor: '#3498DB', shadowOpacity: 0.6, shadowRadius: 8, elevation: 5 },
  fetchBtnText: { color: '#3498DB', fontWeight: 'bold', fontSize: 16 },
  matchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15181F', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#2A2D35' },
  matchCardSelected: { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.05)' },
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
