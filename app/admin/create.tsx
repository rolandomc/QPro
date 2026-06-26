import React, { useState, useMemo } from 'react';
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

const hoy    = () => new Date().toISOString().slice(0, 10);
const hace30 = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

export default function CreateQuinielaScreen() {
  const router = useRouter();

  const [titulo,         setTitulo]        = useState('');
  const [liga,           setLiga]          = useState(LIGAS_DISPONIBLES[0]);
  const [precio,         setPrecio]        = useState('50');
  const [fechaCierre,    setFechaCierre]   = useState('');
  const [jugMinimos,     setJugMinimos]    = useState('5');
  const [pctAdmin,       setPctAdmin]      = useState('10');

  const [statusLabel,    setStatusLabel]   = useState(STATUS_LABELS[0]);
  const [jornada,        setJornada]       = useState('');
  const [dateFrom,       setDateFrom]      = useState('');
  const [dateTo,         setDateTo]        = useState('');
  const [modoFiltro,     setModoFiltro]    = useState<'status' | 'fecha'>('status');

  const [partidosApi,    setPartidosApi]   = useState<any[]>([]);
  const [seleccionados,  setSeleccionados] = useState<Set<string>>(new Set());
  const [loadingApi,     setLoadingApi]    = useState(false);
  const [loadingPublish, setLoadingPublish]= useState(false);

  const precioNum   = parseFloat(precio)   || 0;
  const pctAdminNum = parseFloat(pctAdmin)  || 0;
  const jugMinNum   = parseInt(jugMinimos)  || 0;

  const previsualizacion = useMemo(() => {
    const pozoMinimo  = precioNum * jugMinNum;
    const comisionMin = pozoMinimo * (pctAdminNum / 100);
    const premioMin   = pozoMinimo - comisionMin;
    return { pozoMinimo, comisionMin, premioMin };
  }, [precioNum, pctAdminNum, jugMinNum]);

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
      if (!result.matches?.length) {
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
    setSeleccionados(
      seleccionados.size === partidosApi.length
        ? new Set()
        : new Set(partidosApi.map(p => String(p.external_id)))
    );
  };

  const handlePublicar = async () => {
    if (!titulo.trim())             { Alert.alert('Falta el título',      'Escribe un título.'); return; }
    if (seleccionados.size === 0)   { Alert.alert('Sin partidos',         'Selecciona al menos uno.'); return; }
    if (jugMinNum < 2)              { Alert.alert('J. mínimos inválido',  'Mínimo 2 jugadores.'); return; }
    if (pctAdminNum < 0 || pctAdminNum > 50) { Alert.alert('% Admin inválido', 'Debe estar entre 0 y 50%.'); return; }

    setLoadingPublish(true);
    try {
      const partidosElegidos = partidosApi.filter(p => seleccionados.has(String(p.external_id)));
      await AdminService.createQuinielaConPartidos(
        titulo,
        `Quiniela de ${liga}`,
        precioNum || 50,
        fechaCierre || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        partidosElegidos,
        jugMinNum,
        pctAdminNum,
      );
      Alert.alert(
        '🎉 Quiniela Publicada',
        `"${titulo}" creada con ${seleccionados.size} partido(s).\nMínimo ${jugMinNum} jugadores para activar el pozo.`,
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

  // El botón flotante aparece cuando hay partidos cargados (aunque sean 0 seleccionados)
  const showFloating = partidosApi.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Crear Quiniela</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Scroll — con paddingBottom extra cuando hay botón flotante */}
      <ScrollView
        contentContainerStyle={[styles.content, showFloating && { paddingBottom: 110 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Detalles */}
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
            <Text style={styles.label}>Costo por jugador (MXN)</Text>
            <TextInput style={styles.input} value={precio} onChangeText={setPrecio} keyboardType="numeric" placeholderTextColor="#707070" />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Jornada (opcional)</Text>
            <TextInput style={styles.input} value={jornada} onChangeText={setJornada} keyboardType="numeric" placeholder="Ej: 15" placeholderTextColor="#707070" />
          </View>
        </View>

        {/* 2. Pozo */}
        <Text style={styles.sectionTitle}>2. Configuración del Pozo</Text>
        <View style={styles.formRow}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Jugadores mínimos 👥</Text>
            <TextInput style={styles.input} value={jugMinimos} onChangeText={setJugMinimos} keyboardType="numeric" placeholder="5" placeholderTextColor="#707070" />
            <Text style={styles.hint}>Mínimo para que sea válida</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Comisión admin %</Text>
            <TextInput style={styles.input} value={pctAdmin} onChangeText={setPctAdmin} keyboardType="numeric" placeholder="10" placeholderTextColor="#707070" />
            <Text style={styles.hint}>% que retiene la casa</Text>
          </View>
        </View>

        {precioNum > 0 && jugMinNum > 0 && (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>📊 Preview del Pozo Mínimo</Text>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Pozo bruto ({jugMinNum} jugadores)</Text>
              <Text style={styles.previewVal}>${previsualizacion.pozoMinimo.toLocaleString()}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Comisión admin ({pctAdminNum}%)</Text>
              <Text style={[styles.previewVal, { color: '#E74C3C' }]}>-${previsualizacion.comisionMin.toLocaleString()}</Text>
            </View>
            <View style={[styles.previewRow, styles.previewRowTotal]}>
              <Text style={styles.previewLabelTotal}>🏆 Premio neto al ganador</Text>
              <Text style={styles.previewValTotal}>${previsualizacion.premioMin.toLocaleString()}</Text>
            </View>
            <Text style={styles.previewNote}>El monto aumenta conforme se registren más jugadores</Text>
          </View>
        )}

        {/* 3. Buscar */}
        <Text style={styles.sectionTitle}>3. Buscar Partidos</Text>
        <View style={[styles.formRow, { zIndex: 20 }]}>
          <CustomDropdown label="Liga" options={LIGAS_DISPONIBLES} selectedValue={liga} onSelect={setLiga} />
        </View>

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

        {modoFiltro === 'status' && (
          <View style={{ zIndex: 10 }}>
            <CustomDropdown label="Estado de partidos" options={STATUS_LABELS} selectedValue={statusLabel} onSelect={setStatusLabel} />
          </View>
        )}

        {modoFiltro === 'fecha' && (
          <View style={styles.formRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Desde (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} placeholder={hace30()} placeholderTextColor="#505050" value={dateFrom} onChangeText={setDateFrom} />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Hasta (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} placeholder={hoy()} placeholderTextColor="#505050" value={dateTo} onChangeText={setDateTo} />
            </View>
          </View>
        )}

        <TouchableOpacity style={[styles.fetchBtn, styles.neonBorderBlue]} onPress={handleBuscarPartidos} disabled={loadingApi}>
          {loadingApi
            ? <ActivityIndicator color="#3498DB" />
            : <Text style={styles.fetchBtnText}>🔍 Buscar Partidos</Text>}
        </TouchableOpacity>

        {/* 4. Lista de partidos */}
        {partidosApi.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>4. Seleccionar — {seleccionados.size}/{partidosApi.length}</Text>
              <TouchableOpacity onPress={toggleTodos} style={styles.selectAllBtn}>
                <Text style={styles.selectAllText}>
                  {seleccionados.size === partidosApi.length ? 'Deselect. todos' : 'Selec. todos'}
                </Text>
              </TouchableOpacity>
            </View>

            {partidosApi.map((partido) => {
              const pid        = String(partido.external_id);
              const isSelected = seleccionados.has(pid);
              const fecha      = partido.fecha_partido
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
                      <Text style={styles.matchTeams} numberOfLines={1}>{partido.equipo_local} vs {partido.equipo_visitante}</Text>
                      {marcador && <Text style={styles.marcadorText}>{marcador}</Text>}
                    </View>
                    <View style={styles.matchMeta}>
                      <Text style={styles.matchDate}>{fecha}</Text>
                      <Text style={[styles.statusBadge, { color: getStatusColor(partido.status) }]}>
                        {partido.status === 'FINISHED' ? '✅ Jugado' : partido.status === 'LIVE' ? '🔴 En vivo' : '📅 Programado'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── BOTÓN FLOTANTE ── */}
      {showFloating && (
        <View style={styles.floatingWrap}>
          <TouchableOpacity
            style={[
              styles.floatingBtn,
              seleccionados.size > 0 ? styles.floatingBtnActive : styles.floatingBtnDisabled,
            ]}
            onPress={handlePublicar}
            disabled={seleccionados.size === 0 || loadingPublish}
            activeOpacity={0.85}
          >
            {loadingPublish ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={[
                  styles.floatingBtnText,
                  seleccionados.size === 0 && { color: '#505050' },
                ]}>
                  🚀 Publicar
                </Text>
                <View style={[
                  styles.floatingBadge,
                  seleccionados.size > 0 ? styles.floatingBadgeActive : styles.floatingBadgeDisabled,
                ]}>
                  <Text style={[
                    styles.floatingBadgeText,
                    seleccionados.size === 0 && { color: '#505050' },
                  ]}>
                    {seleccionados.size} partido{seleccionados.size !== 1 ? 's' : ''}
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0A0C10' },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2D35', zIndex: 20 },
  backButton:         { width: 60 },
  backText:           { color: '#9B59B6', fontSize: 16 },
  title:              { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  content:            { padding: 15, paddingBottom: 40 },
  sectionTitle:       { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  formRow:            { flexDirection: 'row', gap: 15, marginBottom: 15 },
  inputContainer:     { flex: 1, marginBottom: 15 },
  label:              { color: '#A0A0A0', fontSize: 12, marginBottom: 5 },
  hint:               { color: '#505050', fontSize: 10, marginTop: 4 },
  input:              { backgroundColor: '#15181F', color: '#FFF', padding: 12, borderRadius: 8,
                        borderWidth: 1, borderColor: '#2A2D35', fontSize: 15, height: 48 },
  toggleRow:          { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggleBtn:          { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1,
                        borderColor: '#2A2D35', alignItems: 'center', backgroundColor: '#15181F' },
  toggleBtnActive:    { borderColor: '#3498DB', backgroundColor: 'rgba(52,152,219,0.12)' },
  toggleText:         { color: '#707070', fontSize: 13, fontWeight: '600' },
  toggleTextActive:   { color: '#3498DB' },
  previewBox:         { backgroundColor: '#15181F', borderRadius: 12, padding: 15, marginBottom: 10,
                        borderWidth: 1.5, borderColor: '#F39C12' },
  previewTitle:       { color: '#F39C12', fontWeight: 'bold', fontSize: 13, marginBottom: 12 },
  previewRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  previewRowTotal:    { borderTopWidth: 1, borderTopColor: '#2A2D35', paddingTop: 8, marginTop: 4 },
  previewLabel:       { color: '#A0A0A0', fontSize: 13 },
  previewVal:         { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  previewLabelTotal:  { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  previewValTotal:    { color: '#F39C12', fontSize: 18, fontWeight: 'bold' },
  previewNote:        { color: '#505050', fontSize: 10, marginTop: 8, textAlign: 'center' },
  fetchBtn:           { backgroundColor: '#15181F', padding: 15, borderRadius: 12,
                        alignItems: 'center', marginTop: 10, borderWidth: 1.5 },
  neonBorderBlue:     { borderColor: '#3498DB', shadowColor: '#3498DB', shadowOpacity: 0.5, shadowRadius: 8, elevation: 5 },
  fetchBtnText:       { color: '#3498DB', fontWeight: 'bold', fontSize: 16 },
  listHeader:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectAllBtn:       { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#3498DB',
                        borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  selectAllText:      { color: '#3498DB', fontSize: 12, fontWeight: 'bold' },
  matchCard:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15181F',
                        padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#2A2D35' },
  matchCardSelected:  { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.05)' },
  checkbox:           { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#707070',
                        marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected:   { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  checkmark:          { color: '#000', fontWeight: 'bold', fontSize: 14 },
  matchRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  matchTeams:         { color: '#FFF', fontSize: 14, fontWeight: 'bold', flex: 1 },
  marcadorText:       { color: '#2ECC71', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  matchMeta:          { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  matchDate:          { color: '#707070', fontSize: 11 },
  statusBadge:        { fontSize: 11, fontWeight: '600' },

  // ── Floating button ──────────────────────────────────────────────────────
  floatingWrap:       {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 24, paddingTop: 10,
    backgroundColor: 'rgba(10,12,16,0.92)',
    borderTopWidth: 1, borderTopColor: '#1E2330',
  },
  floatingBtn:        {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, borderRadius: 14, gap: 10,
  },
  floatingBtnActive:  {
    backgroundColor: '#2ECC71',
    shadowColor: '#2ECC71', shadowOpacity: 0.7, shadowRadius: 14, elevation: 10,
  },
  floatingBtnDisabled:{ backgroundColor: '#15181F', borderWidth: 1, borderColor: '#2A2D35' },
  floatingBtnText:    { color: '#000', fontWeight: 'bold', fontSize: 17 },
  floatingBadge:      { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  floatingBadgeActive:  { backgroundColor: 'rgba(0,0,0,0.2)' },
  floatingBadgeDisabled:{ backgroundColor: '#1C1F26' },
  floatingBadgeText:  { color: '#000', fontWeight: 'bold', fontSize: 13 },
});
