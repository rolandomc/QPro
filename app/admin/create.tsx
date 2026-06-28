import React, { useState, useMemo } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import CustomDropdown from '../../src/components/CustomDropdown';
import { AdminService, CompetitionCode, MatchStatus } from '../../src/services/admin.service';

// ─── Ligas soportadas por football-data.org (tier gratuito) ───────────────────
const LIGAS_MAP: Record<string, CompetitionCode | null> = {
  '🇪🇸 La Liga':            'PD',
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League':    'PL',
  '⭐ Champions League':     'CL',
  '🌍 Mundial FIFA':         'WC',
  '🇩🇪 Bundesliga':          'BL1',
  '🇮🇹 Serie A':             'SA',
  '🇫🇷 Ligue 1':             'FL1',
  '🇧🇷 Brasileirão':         'BSA',
  '🇲🇽 Liga MX (manual)':   null, // No soportada por API – usar partidos manuales
};
const LIGAS_DISPONIBLES = Object.keys(LIGAS_MAP);
const LIGAS_NO_SOPORTADAS = Object.keys(LIGAS_MAP).filter(k => LIGAS_MAP[k] === null);

const STATUS_OPTIONS: { label: string; value: MatchStatus }[] = [
  { label: '📅 Próximos (programados)', value: 'SCHEDULED' },
  { label: '✅ Ya jugados',             value: 'FINISHED'  },
  { label: '🔴 En vivo',               value: 'LIVE'      },
  { label: '🔀 Todos',                 value: 'ALL'       },
];
const STATUS_LABELS = STATUS_OPTIONS.map(s => s.label);

const hoy    = () => new Date().toISOString().slice(0, 10);
const hace30 = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

// Partidos creados manualmente (sin API)
interface PartidoManual {
  id: string;
  local: string;
  visitante: string;
  fecha: string;
}

type OpenDropdown = 'liga' | 'status' | null;

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

  // Control de qué dropdown está abierto (solo uno a la vez)
  const [openDropdown,   setOpenDropdown]  = useState<OpenDropdown>(null);
  const toggleDropdown = (name: OpenDropdown) =>
    setOpenDropdown(prev => prev === name ? null : name);

  const [partidosApi,    setPartidosApi]   = useState<any[]>([]);
  const [seleccionados,  setSeleccionados] = useState<Set<string>>(new Set());
  const [loadingApi,     setLoadingApi]    = useState(false);
  const [loadingPublish, setLoadingPublish]= useState(false);

  // Modo manual para ligas sin soporte de API
  const [partidosManuales, setPartidosManuales] = useState<PartidoManual[]>([]);
  const [manualLocal,     setManualLocal]   = useState('');
  const [manualVisitante, setManualVisitante] = useState('');
  const [manualFecha,     setManualFecha]   = useState('');

  const ligaEsManual = LIGAS_NO_SOPORTADAS.includes(liga);
  const competitionCode = LIGAS_MAP[liga] as CompetitionCode | undefined;

  const precioNum   = parseFloat(precio)   || 0;
  const pctAdminNum = parseFloat(pctAdmin)  || 0;
  const jugMinNum   = parseInt(jugMinimos)  || 0;

  const previsualizacion = useMemo(() => {
    const pozoMinimo  = precioNum * jugMinNum;
    const comisionMin = pozoMinimo * (pctAdminNum / 100);
    const premioMin   = pozoMinimo - comisionMin;
    return { pozoMinimo, comisionMin, premioMin };
  }, [precioNum, pctAdminNum, jugMinNum]);

  // ─── Buscar partidos vía API ───────────────────────────────────────────────
  const handleBuscarPartidos = async () => {
    if (ligaEsManual || !competitionCode) {
      Alert.alert(
        '⚠️ Liga sin soporte de API',
        `"${liga}" no está disponible en la API.\n\nUsa el modo Manual debajo para agregar los partidos tú mismo.`,
      );
      return;
    }
    setLoadingApi(true);
    setPartidosApi([]);
    setSeleccionados(new Set());
    try {
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

  // ─── Partidos manuales ────────────────────────────────────────────────────
  const agregarPartidoManual = () => {
    if (!manualLocal.trim() || !manualVisitante.trim()) {
      Alert.alert('Faltan datos', 'Escribe el equipo local y visitante.');
      return;
    }
    const nuevo: PartidoManual = {
      id:         `manual_${Date.now()}`,
      local:      manualLocal.trim(),
      visitante:  manualVisitante.trim(),
      fecha:      manualFecha || new Date().toISOString(),
    };
    setPartidosManuales(prev => [...prev, nuevo]);
    setManualLocal('');
    setManualVisitante('');
    setManualFecha('');
  };

  const eliminarPartidoManual = (id: string) =>
    setPartidosManuales(prev => prev.filter(p => p.id !== id));

  // ─── Selección de API partidos ────────────────────────────────────────────
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

  // ─── Publicar ────────────────────────────────────────────────────────────
  const handlePublicar = async () => {
    if (!titulo.trim()) { Alert.alert('Falta el título', 'Escribe un título.'); return; }

    const partidosElegidos = ligaEsManual
      ? partidosManuales.map(p => ({
          external_id:      p.id,
          equipo_local:     p.local,
          equipo_visitante: p.visitante,
          fecha_partido:    p.fecha,
          status:           'SCHEDULED',
        }))
      : partidosApi.filter(p => seleccionados.has(String(p.external_id)));

    if (partidosElegidos.length === 0) { Alert.alert('Sin partidos', 'Selecciona o agrega al menos uno.'); return; }
    if (jugMinNum < 2)                 { Alert.alert('J. mínimos inválido', 'Mínimo 2 jugadores.'); return; }
    if (pctAdminNum < 0 || pctAdminNum > 50) { Alert.alert('% Admin inválido', 'Debe estar entre 0 y 50%.'); return; }

    setLoadingPublish(true);
    try {
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
        `"${titulo}" creada con ${partidosElegidos.length} partido(s).`,
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

  const totalPartidos = ligaEsManual ? partidosManuales.length : seleccionados.size;
  const showFab       = ligaEsManual ? partidosManuales.length > 0 : partidosApi.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Crear Quiniela</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, showFab && { paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
        // Cierra dropdowns al hacer scroll
        onScrollBeginDrag={() => setOpenDropdown(null)}
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

        {/* Dropdown Liga — zIndex alto cuando está abierto */}
        <View style={[styles.dropdownRow, openDropdown === 'liga' && { zIndex: 200 }]}>
          <CustomDropdown
            label="Liga"
            options={LIGAS_DISPONIBLES}
            selectedValue={liga}
            onSelect={v => { setLiga(v); setPartidosApi([]); setSeleccionados(new Set()); setPartidosManuales([]); }}
            isOpen={openDropdown === 'liga'}
            onToggle={() => toggleDropdown('liga')}
          />
        </View>

        {/* Aviso si la liga no tiene soporte de API */}
        {ligaEsManual && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Esta liga no está disponible en la API de partidos.{`\n`}
              Agrega los partidos manualmente en la sección de abajo.
            </Text>
          </View>
        )}

        {/* Filtros solo cuando hay soporte de API */}
        {!ligaEsManual && (
          <>
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
              <View style={[styles.dropdownRow, openDropdown === 'status' && { zIndex: 200 }]}>
                <CustomDropdown
                  label="Estado de partidos"
                  options={STATUS_LABELS}
                  selectedValue={statusLabel}
                  onSelect={setStatusLabel}
                  isOpen={openDropdown === 'status'}
                  onToggle={() => toggleDropdown('status')}
                />
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
          </>
        )}

        {/* ─── Partidos manuales (ligas sin API) ──────────────────────────── */}
        {ligaEsManual && (
          <View style={styles.manualBox}>
            <Text style={styles.manualTitle}>✏️ Agregar partido manualmente</Text>

            <Text style={styles.label}>Equipo Local</Text>
            <TextInput
              style={[styles.input, { marginBottom: 10 }]}
              placeholder="Ej: Club América"
              placeholderTextColor="#505050"
              value={manualLocal}
              onChangeText={setManualLocal}
            />
            <Text style={styles.label}>Equipo Visitante</Text>
            <TextInput
              style={[styles.input, { marginBottom: 10 }]}
              placeholder="Ej: Chivas"
              placeholderTextColor="#505050"
              value={manualVisitante}
              onChangeText={setManualVisitante}
            />
            <Text style={styles.label}>Fecha (YYYY-MM-DD, opcional)</Text>
            <TextInput
              style={[styles.input, { marginBottom: 12 }]}
              placeholder={hoy()}
              placeholderTextColor="#505050"
              value={manualFecha}
              onChangeText={setManualFecha}
            />
            <TouchableOpacity style={styles.addManualBtn} onPress={agregarPartidoManual}>
              <Text style={styles.addManualTxt}>+ Agregar partido</Text>
            </TouchableOpacity>

            {partidosManuales.length > 0 && (
              <View style={{ marginTop: 16, gap: 8 }}>
                <Text style={[styles.label, { marginBottom: 4 }]}>Partidos agregados ({partidosManuales.length}):</Text>
                {partidosManuales.map(p => (
                  <View key={p.id} style={styles.manualCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.manualCardTeams}>{p.local} vs {p.visitante}</Text>
                      <Text style={styles.manualCardFecha}>{p.fecha.slice(0, 10)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => eliminarPartidoManual(p.id)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 4. Lista de partidos de API */}
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
                      <Text style={styles.matchTeams} numberOfLines={1}>
                        {partido.equipo_local} vs {partido.equipo_visitante}
                      </Text>
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

      {/* FAB Publicar */}
      {showFab && (
        <TouchableOpacity
          style={[styles.fab, totalPartidos > 0 ? styles.fabActive : styles.fabInactive]}
          onPress={handlePublicar}
          disabled={totalPartidos === 0 || loadingPublish}
          activeOpacity={0.85}
        >
          {loadingPublish ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={[styles.fabText, totalPartidos === 0 && { color: '#505050' }]}>
              🚀 Publicar {totalPartidos > 0 ? `${totalPartidos} partido${totalPartidos !== 1 ? 's' : ''}` : ''}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0A0C10' },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
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
  dropdownRow:        { marginBottom: 14, zIndex: 10 },
  toggleRow:          { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggleBtn:          { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1,
                        borderColor: '#2A2D35', alignItems: 'center', backgroundColor: '#15181F' },
  toggleBtnActive:    { borderColor: '#3498DB', backgroundColor: 'rgba(52,152,219,0.12)' },
  toggleText:         { color: '#707070', fontSize: 13, fontWeight: '600' },
  toggleTextActive:   { color: '#3498DB' },
  warningBox:         { backgroundColor: 'rgba(243,156,18,0.08)', borderRadius: 10, borderWidth: 1,
                        borderColor: '#F39C12', padding: 12, marginBottom: 14 },
  warningText:        { color: '#F39C12', fontSize: 13, lineHeight: 20 },
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
  // Partidos manuales
  manualBox:          { backgroundColor: '#15181F', borderRadius: 12, padding: 14, marginTop: 10,
                        borderWidth: 1, borderColor: '#F39C12' },
  manualTitle:        { color: '#F39C12', fontWeight: 'bold', fontSize: 14, marginBottom: 12 },
  addManualBtn:       { backgroundColor: 'rgba(46,204,113,0.12)', borderRadius: 10, borderWidth: 1,
                        borderColor: '#2ECC71', padding: 12, alignItems: 'center' },
  addManualTxt:       { color: '#2ECC71', fontWeight: 'bold', fontSize: 14 },
  manualCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1F26',
                        borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2A2D35' },
  manualCardTeams:    { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  manualCardFecha:    { color: '#707070', fontSize: 11, marginTop: 2 },
  deleteBtn:          { padding: 6 },
  deleteBtnTxt:       { color: '#E74C3C', fontWeight: 'bold', fontSize: 16 },
  // Lista API
  listHeader:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectAllBtn:       { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#3498DB',
                        borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  selectAllText:      { color: '#3498DB', fontSize: 12, fontWeight: 'bold' },
  matchCard:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15181F',
                        padding: 14, borderRadius: 12, marginBottom: 10,
                        borderWidth: 1, borderColor: '#2A2D35' },
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
  fab: {
    position: 'absolute', bottom: 30, alignSelf: 'center',
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 50,
    minWidth: 200, alignItems: 'center', justifyContent: 'center',
  },
  fabActive: {
    backgroundColor: '#2ECC71',
    shadowColor: '#2ECC71', shadowOpacity: 0.8, shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 }, elevation: 12,
  },
  fabInactive: {
    backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  fabText: { color: '#000', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 },
});
