import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import CustomDropdown from '../../src/components/CustomDropdown';
import { AdminService, CompetitionCode, MatchStatus } from '../../src/services/admin.service';

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

const STATUS_OPTIONS: { label: string; value: MatchStatus }[] = [
  { label: '📅 Próximos (programados)', value: 'SCHEDULED' },
  { label: '✅ Ya jugados',             value: 'FINISHED'  },
  { label: '🔴 En vivo',               value: 'LIVE'      },
  { label: '🔀 Todos',                 value: 'ALL'       },
];
const STATUS_LABELS = STATUS_OPTIONS.map(s => s.label);

/** Hoy y hace 30 días como defaults para rango */
const hoy = () => new Date().toISOString().slice(0, 10);
const hace30 = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function CreateQuinielaScreen() {
  const router = useRouter();

  // ── Detalles quiniela ───────────────────────────────────────────────────────
  const [titulo, setTitulo]         = useState('');
  const [liga, setLiga]             = useState(LIGAS_DISPONIBLES[0]);
  const [precio, setPrecio]         = useState('50');
  const [fechaCierre, setFechaCierre] = useState('');

  // ── Filtros de búsqueda ─────────────────────────────────────────────────────
  const [statusLabel, setStatusLabel] = useState(STATUS_LABELS[0]);
  const [jornada, setJornada]         = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [modoFiltro, setModoFiltro]   = useState<'status' | 'fecha'>('status');

  // ── Resultados API ──────────────────────────────────────────────────────────
  const [partidosApi, setPartidosApi]     = useState<any[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [loadingApi, setLoadingApi]       = useState(false);
  const [loadingPublish, setLoadingPublish] = useState(false);

  // ── Buscar partidos ─────────────────────────────────────────────────────────
  const handleBuscarPartidos = async () => {
    setLoadingApi(true);
    setPartidosApi([]);
    setSeleccionados(new Set());
    try {
      const competitionCode = LIGAS_MAP[liga];
      const statusValue = STATUS_OPTIONS.find(s => s.label === statusLabel)?.value ?? 'SCHEDULED';

      const options: Parameters<typeof AdminService.fetchMatches>[1] = {};

      if (jornada) options.matchday = parseInt(jornada);

      if (modoFiltro === 'fecha') {
        if (dateFrom) options.dateFrom = dateFrom;
        if (dateTo)   options.dateTo   = dateTo;
      } else {
        options.status = statusValue;
      }

      const result = await AdminService.fetchMatches(competitionCode, options);

      if (!result.matches || result.matches.length === 0) {
        Alert.alert('⚠️ Sin resultados', 'No se encontraron partidos con esos filtros.');
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

  const toggleTodos = () => {
    if (seleccionados.size === partidosApi.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(partidosApi.map(p => String(p.external_id))));
    }
  };

  // ── Publicar ────────────────────────────────────────────────────────────────
  const handlePublicar = async () => {
    if (!titulo.trim()) { Alert.alert('Falta el título', 'Escribe un título.'); return; }
    if (seleccionados.size === 0) { Alert.alert('Sin partidos', 'Selecciona al menos uno.'); return; }

    setLoadingPublish(true);
    try {
      const partidosElegidos = partidosApi.filter(p =>
        seleccionados.has(String(p.external_id))
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
        `"${titulo}" creada con ${seleccionados.size} partido(s).`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error al publicar', error.message);
    } finally {
      setLoadingPublish(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'FINISHED') return '#2ECC71';
    if (status === 'LIVE')     return '#E74C3C';
    return '#A0A0A0';
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

        {/* ── Detalles ── */}
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

        {/* ── Filtros de búsqueda ── */}
        <Text style={styles.sectionTitle}>2. Buscar Partidos</Text>

        {/* Liga */}
        <View style={[styles.formRow, { zIndex: 20 }]}>
          <CustomDropdown label="Liga" options={LIGAS_DISPONIBLES} selectedValue={liga} onSelect={setLiga} />
        </View>

        {/* Toggle modo filtro */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, modoFiltro === 'status' && styles.toggleBtnActive]}
            onPress={() => setModoFiltro('status')}
          >
            <Text style={[styles.toggleText, modoFiltro === 'status' && styles.toggleTextActive]}>Por estado</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, modoFiltro === 'fecha' && styles.toggleBtnActive]}
            onPress={() => setModoFiltro('fecha')}
          >
            <Text style={[styles.toggleText, modoFiltro === 'fecha' && styles.toggleTextActive]}>Por rango de fecha</Text>
          </TouchableOpacity>
        </View>

        {/* Filtro por estado */}
        {modoFiltro === 'status' && (
          <View style={[{ zIndex: 10 }]}>
            <CustomDropdown
              label="Estado de partidos"
              options={STATUS_LABELS}
              selectedValue={statusLabel}
              onSelect={setStatusLabel}
            />
          </View>
        )}

        {/* Filtro por rango de fechas */}
        {modoFiltro === 'fecha' && (
          <View style={styles.formRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Desde (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder={hace30()}
                placeholderTextColor="#505050"
                value={dateFrom}
                onChangeText={setDateFrom}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Hasta (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder={hoy()}
                placeholderTextColor="#505050"
                value={dateTo}
                onChangeText={setDateTo}
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.fetchBtn, styles.neonBorderBlue]}
          onPress={handleBuscarPartidos}
          disabled={loadingApi}
        >
          {loadingApi
            ? <ActivityIndicator color="#3498DB" />
            : <Text style={styles.fetchBtnText}>🔍 Buscar Partidos</Text>
          }
        </TouchableOpacity>

        {/* ── Lista de partidos ── */}
        {partidosApi.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>
                3. Seleccionar — {seleccionados.size}/{partidosApi.length}
              </Text>
              <TouchableOpacity onPress={toggleTodos} style={styles.selectAllBtn}>
                <Text style={styles.selectAllText}>
                  {seleccionados.size === partidosApi.length ? 'Deselect. todos' : 'Selec. todos'}
                </Text>
              </TouchableOpacity>
            </View>

            {partidosApi.map((partido) => {
              const pid = String(partido.external_id);
              const isSelected = seleccionados.has(pid);
              const fecha = partido.fecha_partido
                ? new Date(partido.fecha_partido).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
                : '---';
              const marcador = partido.status === 'FINISHED' && partido.marcador
                ? `${partido.marcador.home ?? '-'} - ${partido.marcador.away ?? '-'}`
                : null;

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
                    <View style={styles.matchRow}>
                      <Text style={styles.matchTeams} numberOfLines={1}>
                        {partido.equipo_local} vs {partido.equipo_visitante}
                      </Text>
                      {marcador && (
                        <Text style={styles.marcadorText}>{marcador}</Text>
                      )}
                    </View>
                    <View style={styles.matchMeta}>
                      <Text style={styles.matchDate}>{fecha}</Text>
                      <Text style={[styles.statusBadge, { color: getStatusColor(partido.status) }]}>
                        {partido.status === 'FINISHED' ? '✅ Jugado'
                          : partido.status === 'LIVE'  ? '🔴 En vivo'
                          : '📅 Programado'}
                      </Text>
                    </View>
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
                : <Text style={styles.publishBtnText}>
                    🚀 Publicar con {seleccionados.size} partido{seleccionados.size !== 1 ? 's' : ''}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0A0C10' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2D35', zIndex: 20 },
  backButton:       { width: 60 },
  backText:         { color: '#9B59B6', fontSize: 16 },
  title:            { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  content:          { padding: 15, paddingBottom: 40 },
  sectionTitle:     { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  formRow:          { flexDirection: 'row', gap: 15, marginBottom: 15 },
  inputContainer:   { flex: 1, marginBottom: 15 },
  label:            { color: '#A0A0A0', fontSize: 12, marginBottom: 5 },
  input:            { backgroundColor: '#15181F', color: '#FFF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#2A2D35', fontSize: 15, height: 48 },
  // Toggle modo
  toggleRow:        { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggleBtn:        { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#2A2D35', alignItems: 'center', backgroundColor: '#15181F' },
  toggleBtnActive:  { borderColor: '#3498DB', backgroundColor: 'rgba(52,152,219,0.12)' },
  toggleText:       { color: '#707070', fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#3498DB' },
  // Fetch btn
  fetchBtn:         { backgroundColor: '#15181F', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10, borderWidth: 1.5 },
  neonBorderBlue:   { borderColor: '#3498DB', shadowColor: '#3498DB', shadowOpacity: 0.5, shadowRadius: 8, elevation: 5 },
  fetchBtnText:     { color: '#3498DB', fontWeight: 'bold', fontSize: 16 },
  // Lista
  listHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectAllBtn:     { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#3498DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  selectAllText:    { color: '#3498DB', fontSize: 12, fontWeight: 'bold' },
  matchCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15181F', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#2A2D35' },
  matchCardSelected:{ borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.05)' },
  checkbox:         { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#707070', marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  checkmark:        { color: '#000', fontWeight: 'bold', fontSize: 14 },
  matchRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  matchTeams:       { color: '#FFF', fontSize: 14, fontWeight: 'bold', flex: 1 },
  marcadorText:     { color: '#2ECC71', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  matchMeta:        { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  matchDate:        { color: '#707070', fontSize: 11 },
  statusBadge:      { fontSize: 11, fontWeight: '600' },
  publishBtn:       { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  neonBgGreen:      { backgroundColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.8, shadowRadius: 10, elevation: 8 },
  disabledBtn:      { backgroundColor: '#1C1F26', borderColor: '#2A2D35', borderWidth: 1 },
  publishBtnText:   { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
