import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedButton from '../../src/components/AnimatedButton';
import CustomDropdown from '../../src/components/CustomDropdown';
import { AdminService, CompetitionCode, MatchStatus } from '../../src/services/admin.service';
import { MLBAdminService, MLBPartidoInput } from '../../src/services/mlbAdmin.service';
import { colors } from '../../src/theme';

// ─── Ligas fútbol ─────────────────────────────────────────────────────────────
const LIGAS_MAP: Record<string, CompetitionCode | null> = {
  '🇪🇸 La Liga':           'PD',
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League':   'PL',
  '⭐ Champions League':    'CL',
  '🌍 Mundial FIFA':        'WC',
  '🇩🇪 Bundesliga':         'BL1',
  '🇮🇹 Serie A':            'SA',
  '🇫🇷 Ligue 1':            'FL1',
  '🇧🇷 Brasileirão':        'BSA',
  '🇲🇽 Liga MX':           'MX1',
};
const LIGAS_DISPONIBLES   = Object.keys(LIGAS_MAP);
const LIGAS_NO_SOPORTADAS = Object.keys(LIGAS_MAP).filter(k => LIGAS_MAP[k] === null);
const LIGA_VISUAL: Record<string, { flag: string; name: string }> = {
  '🇪🇸 La Liga': { flag: '🇪🇸', name: 'La Liga' },
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League': { flag: '🏴', name: 'Premier League' },
  '⭐ Champions League': { flag: '⭐', name: 'Champions League' },
  '🌍 Mundial FIFA': { flag: '🌍', name: 'Mundial FIFA' },
  '🇩🇪 Bundesliga': { flag: '🇩🇪', name: 'Bundesliga' },
  '🇮🇹 Serie A': { flag: '🇮🇹', name: 'Serie A' },
  '🇫🇷 Ligue 1': { flag: '🇫🇷', name: 'Ligue 1' },
  '🇧🇷 Brasileirão': { flag: '🇧🇷', name: 'Brasileirao' },
  '🇲🇽 Liga MX': { flag: '🇲🇽', name: 'Liga MX' },
};

const STATUS_OPTIONS: { label: string; value: MatchStatus }[] = [
  { label: '📅 Próximos (programados)', value: 'SCHEDULED' },
  { label: '✅ Ya jugados',             value: 'FINISHED'  },
  { label: '🔴 En vivo',               value: 'LIVE'      },
  { label: '🔀 Todos',                 value: 'ALL'       },
];
const STATUS_LABELS = STATUS_OPTIONS.map(s => s.label);

const hoy    = () => new Date().toISOString().slice(0, 10);
const hace30 = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };
const en7    = () => { const d = new Date(); d.setDate(d.getDate() + 7);  return d.toISOString().slice(0, 10); };

interface PartidoManual {
  id: string;
  local: string;
  visitante: string;
  fecha: string;
}

type OpenDropdown = 'deporte' | 'liga' | 'status' | 'ganadores' | null;
type Deporte = 'futbol' | 'beisbol';
const DEPORTE_OPTIONS = ['Football', 'Baseball', 'Basketball', 'Tennis', 'MMA'];

export default function CreateQuinielaScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const stepInfo: Record<1 | 2 | 3, { title: string; subtitle: string }> = {
    1: { title: 'Informacion Basica', subtitle: 'Define deporte, cupo y configuracion inicial' },
    2: { title: 'Seleccion de Partidos', subtitle: 'Busca y agrega los encuentros de la quiniela' },
    3: { title: 'Premios y Publicacion', subtitle: 'Ajusta porcentajes y publica la quiniela' },
  };

  // ─── Selector de deporte ────────────────────────────────────────────────────
  const [deporte, setDeporte] = useState<Deporte>('futbol');
  const [deporteLabel, setDeporteLabel] = useState('Football');

  // ─── Campos comunes ─────────────────────────────────────────────────────────
  const [titulo,         setTitulo]        = useState('');
  const [precio,         setPrecio]        = useState('50');
  const [fechaCierre]    = useState('');
  const [jugMinimos,     setJugMinimos]    = useState('10');
  const [premioGarantizado, setPremioGarantizado] = useState('0');
  const [pctAdmin,       setPctAdmin]      = useState('10');
  const [cierreAuto,     setCierreAuto]    = useState(true);
  const [loadingPublish, setLoadingPublish]= useState(false);
  const [quinielaPrivada, setQuinielaPrivada] = useState(false);
  const [busquedaPartido, setBusquedaPartido] = useState('');
  const [busquedaLiga, setBusquedaLiga] = useState('');
  const [filtroRapidoFecha, setFiltroRapidoFecha] = useState<'todos' | 'hoy' | 'semana'>('todos');

  const [numGanadores, setNumGanadores] = useState<1 | 3>(3);
  const [repartoEscalonado, setRepartoEscalonado] = useState(true);
  const [premiosPct, setPremiosPct] = useState<string[]>(['60', '25', '15']);

  // ─── Fútbol ─────────────────────────────────────────────────────────────────
  const [liga,           setLiga]          = useState(LIGAS_DISPONIBLES[0]);
  const [statusLabel,    setStatusLabel]   = useState(STATUS_LABELS[0]);
  const [jornada,        setJornada]       = useState('');
  const [dateFrom,       setDateFrom]      = useState('');
  const [dateTo,         setDateTo]        = useState('');
  const [modoFiltro,     setModoFiltro]    = useState<'status' | 'fecha'>('status');
  const [openDropdown,   setOpenDropdown]  = useState<OpenDropdown>(null);
  const [partidosApi,    setPartidosApi]   = useState<any[]>([]);
  const [seleccionados,  setSeleccionados] = useState<Set<string>>(new Set());
  const [loadingApi,     setLoadingApi]    = useState(false);
  const [partidosManuales, setPartidosManuales] = useState<PartidoManual[]>([]);
  const [manualLocal,    setManualLocal]   = useState('');
  const [manualVisitante,setManualVisitante]= useState('');
  const [manualFecha,    setManualFecha]   = useState('');

  // ─── Béisbol / MLB ───────────────────────────────────────────────────────────
  const [mlbDateFrom,    setMlbDateFrom]   = useState(hoy());
  const [mlbDateTo,      setMlbDateTo]     = useState(en7());
  const [mlbJuegos,      setMlbJuegos]     = useState<MLBPartidoInput[]>([]);
  const [mlbSelec,       setMlbSelec]      = useState<Set<number>>(new Set());
  const [loadingMlb,     setLoadingMlb]    = useState(false);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const ligaEsManual    = LIGAS_NO_SOPORTADAS.includes(liga);
  const competitionCode = LIGAS_MAP[liga] as CompetitionCode | undefined;
  const precioNum       = parseFloat(precio)  || 0;
  const pctAdminNum     = parseFloat(pctAdmin) || 0;
  const jugMinNum       = parseInt(jugMinimos) || 0;
  const toggleDropdown  = (name: OpenDropdown) =>
    setOpenDropdown(prev => prev === name ? null : name);
  const getPartidoKey = (p: { external_id: string; fecha_partido?: string | null }) =>
    `${String(p.external_id)}_${String(p.fecha_partido ?? '')}`;
  const handlePrecioChange = (value: string) => {
    const clean = value.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
    setPrecio(normalized);
  };

  const handleCupoChange = (value: string) => {
    const clean = value.replace(/[^0-9]/g, '');
    setJugMinimos(clean);
  };

  const handlePremioGarantizadoChange = (value: string) => {
    const clean = value.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
    setPremioGarantizado(normalized);
  };

  const handleDeporteSelect = (value: string) => {
    setDeporteLabel(value);
    setDeporte(value === 'Baseball' ? 'beisbol' : 'futbol');
  };

  // Primer partido (para cierre automático)
  const primerPartidoISO = useMemo(() => {
    if (deporte === 'beisbol') {
      const fechas = Array.from(mlbSelec)
        .map(pk => mlbJuegos.find(g => g.gamePk === pk)?.fecha_partido)
        .filter(Boolean) as string[];
      return fechas.length ? fechas.sort()[0] : null;
    }
    const partidos = ligaEsManual
      ? partidosManuales.map(p => p.fecha).filter(Boolean)
      : partidosApi
          .filter(p => seleccionados.has(getPartidoKey(p)) && p.fecha_partido)
          .map(p => p.fecha_partido as string);
    return partidos.length ? partidos.sort()[0] : null;
  }, [deporte, mlbSelec, mlbJuegos, ligaEsManual, partidosManuales, partidosApi, seleccionados]);

  // Preview pozo
  const previsualizacion = useMemo(() => {
    const pozoMinimo  = precioNum * jugMinNum;
    const comisionMin = pozoMinimo * (pctAdminNum / 100);
    const premioMin   = pozoMinimo - comisionMin;
    return { pozoMinimo, comisionMin, premioMin };
  }, [precioNum, pctAdminNum, jugMinNum]);

  // Total partidos seleccionados
  const totalPartidos = deporte === 'beisbol'
    ? mlbSelec.size
    : (ligaEsManual ? partidosManuales.length : seleccionados.size);
  const showFab = deporte === 'beisbol'
    ? mlbJuegos.length > 0
    : (ligaEsManual ? partidosManuales.length > 0 : partidosApi.length > 0);

  const paso1Valido = !!titulo.trim() && precioNum > 0 && jugMinNum > 0;

  const partidosApiFiltrados = useMemo(() => {
    const term = busquedaPartido.trim().toLowerCase();
    const now = new Date();
    const next7 = new Date(now);
    next7.setDate(now.getDate() + 7);

    return partidosApi.filter((p) => {
      const local = String(p.equipo_local ?? '').toLowerCase();
      const visitante = String(p.equipo_visitante ?? '').toLowerCase();
      const textOk = !term || local.includes(term) || visitante.includes(term);
      if (!textOk) return false;

      if (!p.fecha_partido || filtroRapidoFecha === 'todos') return true;
      const matchDate = new Date(p.fecha_partido);
      if (filtroRapidoFecha === 'hoy') {
        return matchDate.toDateString() === now.toDateString();
      }
      return matchDate >= now && matchDate <= next7;
    });
  }, [partidosApi, busquedaPartido, filtroRapidoFecha]);

  const mlbJuegosFiltrados = useMemo(() => {
    const term = busquedaPartido.trim().toLowerCase();
    if (!term) return mlbJuegos;
    return mlbJuegos.filter((j) => {
      const local = String(j.equipo_local ?? '').toLowerCase();
      const visitante = String(j.equipo_visitante ?? '').toLowerCase();
      return local.includes(term) || visitante.includes(term);
    });
  }, [mlbJuegos, busquedaPartido]);

  const premioGarantizadoNum = parseFloat(premioGarantizado) || 0;
  const premiosActivos = premiosPct.slice(0, numGanadores).map((v) => Number(v) || 0);
  const sumaPremios = premiosActivos.reduce((acc, val) => acc + val, 0);
  const pozoTotalProyectado = precioNum * jugMinNum;
  const comisionFija = pozoTotalProyectado * (pctAdminNum / 100);
  const pozoNeto = pozoTotalProyectado - comisionFija;
  const pozoFinalPremios = Math.max(pozoNeto, premioGarantizadoNum);

  const ligasFiltradas = useMemo(() => {
    const term = busquedaLiga.trim().toLowerCase();
    if (!term) return LIGAS_DISPONIBLES;
    return LIGAS_DISPONIBLES.filter((l) => l.toLowerCase().includes(term));
  }, [busquedaLiga]);

  // ─── Búsqueda fútbol ─────────────────────────────────────────────────────────
  const handleBuscarPartidos = async () => {
    if (ligaEsManual || !competitionCode) {
      Alert.alert('⚠️ Liga sin soporte de API',
        `"${liga}" no está en la API.\nUsa el modo Manual.`);
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
        Alert.alert('⚠️ Sin resultados', 'No se encontraron partidos.');
      } else {
        setPartidosApi(result.matches);
        if (result.fallbackUsed) {
          Alert.alert('ℹ️ Respaldo activo', 'Se usó TheSportsDB porque la API principal no devolvió partidos.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error API', e.message);
    } finally {
      setLoadingApi(false);
    }
  };

  // ─── Búsqueda MLB ─────────────────────────────────────────────────────────────
  const handleBuscarMlb = async () => {
    if (!mlbDateFrom || !mlbDateTo) {
      Alert.alert('Faltan fechas', 'Escribe la fecha de inicio y fin.');
      return;
    }
    setLoadingMlb(true);
    setMlbJuegos([]);
    setMlbSelec(new Set());
    try {
      const juegos = await MLBAdminService.fetchGames(mlbDateFrom, mlbDateTo);
      if (!juegos.length) {
        Alert.alert('⚠️ Sin juegos', 'No hay juegos de MLB en ese rango de fechas.');
      } else {
        setMlbJuegos(juegos);
      }
    } catch (e: any) {
      Alert.alert('Error MLB API', e.message);
    } finally {
      setLoadingMlb(false);
    }
  };

  const toggleMlbJuego = (pk: number) => {
    setMlbSelec(prev => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk);
      else next.add(pk);
      return next;
    });
  };

  const toggleTodosMlb = () => {
    setMlbSelec(
      mlbSelec.size === mlbJuegos.length
        ? new Set()
        : new Set(mlbJuegos.map(g => g.gamePk))
    );
  };

  // ─── Partidos manuales fútbol ──────────────────────────────────────────────
  const agregarPartidoManual = () => {
    if (!manualLocal.trim() || !manualVisitante.trim()) {
      Alert.alert('Faltan datos', 'Escribe el equipo local y visitante.');
      return;
    }
    const nuevo: PartidoManual = {
      id:        `manual_${Date.now()}`,
      local:     manualLocal.trim(),
      visitante: manualVisitante.trim(),
      fecha:     manualFecha || new Date().toISOString(),
    };
    setPartidosManuales(prev => [...prev, nuevo]);
    setManualLocal('');
    setManualVisitante('');
    setManualFecha('');
  };
  const eliminarPartidoManual = (id: string) =>
    setPartidosManuales(prev => prev.filter(p => p.id !== id));

  const togglePartido = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleTodos = () => {
    setSeleccionados(
      seleccionados.size === partidosApi.length
        ? new Set()
        : new Set(partidosApi.map(getPartidoKey))
    );
  };

  const handleNumGanadores = (top: 1 | 3) => {
    setNumGanadores(top);
    if (top === 1) {
      setPremiosPct(['100', '0', '0']);
      return;
    }
    setPremiosPct((prev) => [prev[0] || '60', prev[1] || '25', prev[2] || '15']);
  };

  const updatePremioPct = (index: number, value: string) => {
    const clean = value.replace(/[^0-9]/g, '');
    setPremiosPct((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
  };

  // ─── Publicar ────────────────────────────────────────────────────────────────
  const handlePublicar = async () => {
    if (!titulo.trim()) { Alert.alert('Falta el título', 'Escribe un título.'); return; }
    if (jugMinNum < 2)  { Alert.alert('J. mínimos inválido', 'Mínimo 2 jugadores.'); return; }
    if (pctAdminNum < 0 || pctAdminNum > 50) { Alert.alert('% Admin inválido', 'Entre 0 y 50%.'); return; }
    if (sumaPremios !== 100) { Alert.alert('Premios inválidos', 'Los porcentajes deben sumar 100%.'); return; }

    setLoadingPublish(true);
    try {
      const porcentajesPremios = numGanadores === 1
        ? [100]
        : premiosPct.slice(0, 3).map((v) => Number(v) || 0);

      if (deporte === 'beisbol') {
        // ─ Crear quiniela MLB ─────────────────────────────────────────────────
        const juegosSel = mlbJuegos.filter(g => mlbSelec.has(g.gamePk));
        if (juegosSel.length === 0) { Alert.alert('Sin juegos', 'Selecciona al menos un juego MLB.'); return; }

        await MLBAdminService.createQuinielaMLB(
          titulo,
          `Quiniela MLB`,
          precioNum || 50,
          fechaCierre || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          juegosSel,
          jugMinNum,
          pctAdminNum,
          cierreAuto,
          numGanadores,
          porcentajesPremios,
        );
        Alert.alert(
          '⚾ Quiniela MLB Publicada',
          `"${titulo}" creada con ${juegosSel.length} juego(s).`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        // ─ Crear quiniela fútbol ──────────────────────────────────────────────
        const partidosElegidos = ligaEsManual
          ? partidosManuales.map(p => ({
              external_id:      p.id,
              equipo_local:     p.local,
              equipo_visitante: p.visitante,
              fecha_partido:    p.fecha,
              status:           'SCHEDULED',
            }))
          : partidosApi.filter(p => seleccionados.has(getPartidoKey(p)));

        if (partidosElegidos.length === 0) { Alert.alert('Sin partidos', 'Selecciona al menos uno.'); return; }

        await AdminService.createQuinielaConPartidos(
          titulo,
          `Quiniela de ${liga}`,
          liga,
          precioNum || 50,
          fechaCierre || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          partidosElegidos,
          jugMinNum,
          pctAdminNum,
          cierreAuto,
          primerPartidoISO ?? null,
          numGanadores,
          porcentajesPremios,
        );
        Alert.alert(
          '🎉 Quiniela Publicada',
          `"${titulo}" creada con ${partidosElegidos.length} partido(s).`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (e: any) {
      Alert.alert('Error al publicar', e.message);
    } finally {
      setLoadingPublish(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'FINISHED') return '#2ECC71';
    if (status === 'LIVE')     return '#E74C3C';
    return '#A0A0A0';
  };

  const getMlbEstadoColor = (estado: string) => {
    if (estado === 'Final')   return '#2ECC71';
    if (estado === 'Live' || estado === 'In Progress') return '#E74C3C';
    return '#A0A0A0';
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, step === 2 && { paddingBottom: 140 }]}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => setOpenDropdown(null)}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />
          <View style={styles.heroHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.heroBackButton}>
              <Text style={styles.heroBackText}>← Volver</Text>
            </TouchableOpacity>
            <Text style={styles.heroHeaderTitle}>Crear Quiniela</Text>
            <View style={{ width: 72 }} />
          </View>
          <Text style={styles.heroTag}>Nueva Quiniela</Text>
          <Text style={styles.heroTitle}>Configura tu quiniela en 3 pasos</Text>
          <View style={styles.topStepperRow}>
            {[1, 2, 3].map((idx, i) => {
              const done = step > idx;
              const active = step === idx;
              const label = idx === 1 ? 'INFO' : idx === 2 ? 'PARTIDOS' : 'PREMIOS';
              return (
                <React.Fragment key={idx}>
                  <View style={styles.topStepItem}>
                    <View style={[styles.topStepNode, (active || done) && styles.topStepNodeActive]}>
                      <Text style={[styles.topStepNodeText, (active || done) && styles.topStepNodeTextActive]}>{done ? '✓' : idx}</Text>
                    </View>
                    <Text style={[styles.topStepLabel, active && styles.topStepLabelActive]}>{label}</Text>
                  </View>
                  {i < 2 && <View style={[styles.topStepBar, step > idx && styles.topStepBarActive]} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {step === 1 && (
          <View style={styles.stepCard}>
            <Text style={styles.formLabelUpper}>NOMBRE DE LA QUINIELA</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ej. El Clasico Mega Pool"
                placeholderTextColor="#6F89A7"
                value={titulo}
                onChangeText={setTitulo}
              />
            </View>

            <Text style={styles.formLabelUpper}>DEPORTE</Text>
            <View style={[styles.dropdownRow, openDropdown === 'deporte' && { zIndex: 210 }] }>
              <CustomDropdown
                label=""
                options={DEPORTE_OPTIONS}
                selectedValue={deporteLabel}
                onSelect={handleDeporteSelect}
                isOpen={openDropdown === 'deporte'}
                onToggle={() => toggleDropdown('deporte')}
              />
            </View>

            <Text style={styles.formLabelUpper}>LIGA</Text>
            <View style={[styles.dropdownRow, openDropdown === 'liga' && { zIndex: 205 }]}>
              <CustomDropdown
                label=""
                options={LIGAS_DISPONIBLES}
                selectedValue={liga}
                onSelect={setLiga}
                isOpen={openDropdown === 'liga'}
                onToggle={() => toggleDropdown('liga')}
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.inputContainer}>
                <Text style={styles.formLabelUpper}>COSTO DE ENTRADA</Text>
                <View style={styles.moneyInputWrap}>
                  <Text style={styles.moneyPrefix}>$</Text>
                  <TextInput
                    style={styles.moneyInput}
                    value={precio}
                    onChangeText={handlePrecioChange}
                    keyboardType="decimal-pad"
                    placeholder="50.00"
                    placeholderTextColor="#6F89A7"
                  />
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.formLabelUpper}>PREMIO GARANTIZADO</Text>
                <View style={styles.moneyInputWrap}>
                  <Text style={styles.moneyPrefix}>$</Text>
                  <TextInput
                    style={styles.moneyInput}
                    value={premioGarantizado}
                    onChangeText={handlePremioGarantizadoChange}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#6F89A7"
                  />
                </View>
              </View>
            </View>

            <Text style={styles.formLabelUpper}>CUPO MINIMO</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={jugMinimos}
                onChangeText={handleCupoChange}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor="#6F89A7"
              />
              <Text style={styles.hint}>Define el limite de participantes para esta quiniela</Text>
            </View>

            <View style={styles.privadoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cierreTitle}>Quiniela Privada</Text>
                <Text style={styles.cierreDesc}>Requiere codigo de invitacion para unirse</Text>
              </View>
              <Switch
                value={quinielaPrivada}
                onValueChange={setQuinielaPrivada}
                trackColor={{ false: '#2A2D35', true: colors.primary }}
                thumbColor={quinielaPrivada ? '#08131C' : '#505050'}
              />
            </View>

            <AnimatedButton
              label="CONTINUAR A PARTIDOS ›"
              onPress={() => setStep(2)}
              disabled={!paso1Valido}
              style={styles.stepOneActionBtn}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepCard}>

        <View style={styles.selectedBadgeFloating}>
          <Text style={styles.selectedBadgeTxt}>{totalPartidos} Partidos Seleccionados</Text>
        </View>

        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar equipo..."
            placeholderTextColor="#6F89A7"
            value={busquedaPartido}
            onChangeText={setBusquedaPartido}
          />
        </View>

        {deporte === 'futbol' && (
          <View style={styles.quickFiltersRow}>
            <TouchableOpacity
              style={[styles.quickFilterChip, filtroRapidoFecha === 'todos' && styles.quickFilterChipActive]}
              onPress={() => setFiltroRapidoFecha('todos')}
            >
              <Text style={[styles.quickFilterTxt, filtroRapidoFecha === 'todos' && styles.quickFilterTxtActive]}>Todos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickFilterChip, filtroRapidoFecha === 'hoy' && styles.quickFilterChipActive]}
              onPress={() => setFiltroRapidoFecha('hoy')}
            >
              <Text style={[styles.quickFilterTxt, filtroRapidoFecha === 'hoy' && styles.quickFilterTxtActive]}>Hoy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickFilterChip, filtroRapidoFecha === 'semana' && styles.quickFilterChipActive]}
              onPress={() => setFiltroRapidoFecha('semana')}
            >
              <Text style={[styles.quickFilterTxt, filtroRapidoFecha === 'semana' && styles.quickFilterTxtActive]}>Prox. 7 dias</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 3. Buscar partidos / juegos ───────────────────────────────────── */}
        <Text style={styles.sectionTitle}>
          {deporte === 'beisbol' ? '3. Buscar Juegos MLB' : '3. Buscar Partidos'}
        </Text>

        {/* ── BÉISBOL ──────────────────────────────────────────────────────── */}
        {deporte === 'beisbol' && (
          <>
            <View style={styles.formRow}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Desde (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={hoy()}
                  placeholderTextColor="#505050"
                  value={mlbDateFrom}
                  onChangeText={setMlbDateFrom}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Hasta (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={en7()}
                  placeholderTextColor="#505050"
                  value={mlbDateTo}
                  onChangeText={setMlbDateTo}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.fetchBtn, styles.neonBorderMLB]}
              onPress={handleBuscarMlb}
              disabled={loadingMlb}
            >
              {loadingMlb
                ? <ActivityIndicator color="#E8534A" />
                : <Text style={styles.fetchBtnTextMLB}>⚾ Buscar Juegos MLB</Text>}
            </TouchableOpacity>

            {mlbJuegosFiltrados.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View style={styles.listHeader}>
                  <Text style={styles.sectionTitle}>4. Seleccionar — {mlbSelec.size}/{mlbJuegos.length}</Text>
                  <TouchableOpacity onPress={toggleTodosMlb} style={styles.selectAllBtn}>
                    <Text style={styles.selectAllText}>
                      {mlbSelec.size === mlbJuegos.length ? 'Deselec. todos' : 'Selec. todos'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {mlbJuegosFiltrados.map(juego => {
                  const isSelected = mlbSelec.has(juego.gamePk);
                  const fecha = new Date(juego.fecha_partido).toLocaleString('es-MX', {
                    dateStyle: 'short', timeStyle: 'short',
                  });
                  return (
                    <TouchableOpacity
                      key={juego.gamePk}
                      style={[styles.matchCard, isSelected && styles.matchCardSelectedMLB]}
                      onPress={() => toggleMlbJuego(juego.gamePk)}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelectedMLB]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.matchRow}>
                          <Text style={styles.matchTeams} numberOfLines={1}>
                            {juego.equipo_visitante} @ {juego.equipo_local}
                          </Text>
                        </View>
                        <View style={styles.matchMeta}>
                          <Text style={styles.matchDate}>{fecha}</Text>
                          <Text style={[styles.statusBadge, { color: getMlbEstadoColor(juego.estado_juego ?? '') }]}>
                            {juego.estado_juego === 'Final' ? '✅ Final'
                              : (juego.estado_juego === 'Live' || juego.estado_juego === 'In Progress') ? '🔴 En vivo'
                              : '📅 Programado'}
                          </Text>
                        </View>
                        <Text style={styles.mlbGamePk}>gamePk: {juego.gamePk}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── FÚTBOL ───────────────────────────────────────────────────────── */}
        {deporte === 'futbol' && (
          <>
            <Text style={styles.formLabelUpper}>Buscar Liga</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Teclea una liga..."
              placeholderTextColor="#6F89A7"
              value={busquedaLiga}
              onChangeText={setBusquedaLiga}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ligaPillsRow}>
              {ligasFiltradas.map((ligaItem) => (
                <TouchableOpacity
                  key={ligaItem}
                  style={[styles.quickFilterChip, styles.ligaPillChip, liga === ligaItem && styles.quickFilterChipActive]}
                  onPress={() => {
                    setLiga(ligaItem);
                    setPartidosApi([]);
                    setSeleccionados(new Set());
                    setPartidosManuales([]);
                  }}
                >
                  <Text style={styles.ligaPillFlag}>{LIGA_VISUAL[ligaItem]?.flag ?? '🏟️'}</Text>
                  <Text style={[styles.quickFilterTxt, liga === ligaItem && styles.quickFilterTxtActive]}>
                    {LIGA_VISUAL[ligaItem]?.name ?? ligaItem}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {ligaEsManual && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ Esta liga no está disponible en la API.{`\n`}Agrega los partidos manualmente.
                </Text>
              </View>
            )}

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

            {/* Partidos manuales */}
            {ligaEsManual && (
              <View style={styles.manualBox}>
                <Text style={styles.manualTitle}>✏️ Agregar partido manualmente</Text>
                <Text style={styles.label}>Equipo Local</Text>
                <TextInput style={[styles.input, { marginBottom: 10 }]} placeholder="Ej: Club América" placeholderTextColor="#505050" value={manualLocal} onChangeText={setManualLocal} />
                <Text style={styles.label}>Equipo Visitante</Text>
                <TextInput style={[styles.input, { marginBottom: 10 }]} placeholder="Ej: Chivas" placeholderTextColor="#505050" value={manualVisitante} onChangeText={setManualVisitante} />
                <Text style={styles.label}>Fecha (YYYY-MM-DD, opcional)</Text>
                <TextInput style={[styles.input, { marginBottom: 12 }]} placeholder={hoy()} placeholderTextColor="#505050" value={manualFecha} onChangeText={setManualFecha} />
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

            {/* Lista partidos API */}
            {partidosApiFiltrados.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View style={styles.listHeader}>
                  <Text style={styles.sectionTitle}>4. Seleccionar — {seleccionados.size}/{partidosApi.length}</Text>
                  <TouchableOpacity onPress={toggleTodos} style={styles.selectAllBtn}>
                    <Text style={styles.selectAllText}>
                      {seleccionados.size === partidosApi.length ? 'Deselect. todos' : 'Selec. todos'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {partidosApiFiltrados.map((partido) => {
                  const pid        = getPartidoKey(partido);
                  const isSelected = seleccionados.has(pid);
                  const logoLocal = partido.logo_local ?? null;
                  const logoVisitante = partido.logo_visitante ?? null;
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
                          <View style={styles.matchTeamsWithLogos}>
                            <View style={styles.teamWithLogo}>
                              {logoLocal ? (
                                <Image source={{ uri: logoLocal }} style={styles.teamLogo} resizeMode="contain" />
                              ) : (
                                <View style={styles.teamLogoFallback}><Text style={styles.teamLogoFallbackTxt}>L</Text></View>
                              )}
                              <Text style={styles.matchTeams} numberOfLines={1}>{partido.equipo_local}</Text>
                            </View>
                            <Text style={styles.vsText}>vs</Text>
                            <View style={styles.teamWithLogo}>
                              {logoVisitante ? (
                                <Image source={{ uri: logoVisitante }} style={styles.teamLogo} resizeMode="contain" />
                              ) : (
                                <View style={styles.teamLogoFallback}><Text style={styles.teamLogoFallbackTxt}>V</Text></View>
                              )}
                              <Text style={styles.matchTeams} numberOfLines={1}>{partido.equipo_visitante}</Text>
                            </View>
                          </View>
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
          </>
        )}

          </View>
        )}

        {step === 3 && (
          <View style={styles.stepCard}>
            <Text style={styles.sectionTitle}>3. Distribución de Premios</Text>

            <Text style={styles.formLabelUpper}>Numero de Ganadores</Text>
            <View style={[styles.dropdownRow, openDropdown === 'ganadores' && { zIndex: 220 }]}>
              <CustomDropdown
                label=""
                options={['Top 1', 'Top 3']}
                selectedValue={numGanadores === 1 ? 'Top 1' : 'Top 3'}
                onSelect={(val) => handleNumGanadores(val === 'Top 1' ? 1 : 3)}
                isOpen={openDropdown === 'ganadores'}
                onToggle={() => toggleDropdown('ganadores')}
              />
            </View>

            <View style={styles.privadoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cierreTitle}>📈 Reparto Escalonado</Text>
                <Text style={styles.cierreDesc}>Distribuye el premio por posiciones.</Text>
              </View>
              <Switch
                value={repartoEscalonado}
                onValueChange={setRepartoEscalonado}
                trackColor={{ false: '#2A2D35', true: 'rgba(53,208,127,0.45)' }}
                thumbColor={repartoEscalonado ? '#35D07F' : '#505050'}
              />
            </View>

            {numGanadores === 3 && repartoEscalonado && (
              <View style={styles.premiosInputsCard}>
                {Array.from({ length: numGanadores }).map((_, idx) => (
                  <View key={idx} style={styles.premioInputRow}>
                    <Text style={styles.previewLabel}>{idx + 1}°</Text>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      keyboardType="numeric"
                      value={premiosPct[idx]}
                      onChangeText={(v) => updatePremioPct(idx, v)}
                      placeholder="0"
                      placeholderTextColor="#707070"
                    />
                    <Text style={styles.previewVal}>%</Text>
                  </View>
                ))}
                <Text style={[styles.premioSuma, { color: sumaPremios === 100 ? '#35D07F' : '#E74C3C' }]}>
                  Suma total: {sumaPremios}%
                </Text>
              </View>
            )}

            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>Resumen</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Pozo Total Proyectado</Text>
                <Text style={styles.previewVal}>${pozoTotalProyectado.toLocaleString()}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Comisión casa ({pctAdminNum}%)</Text>
                <Text style={[styles.previewVal, { color: '#E74C3C' }]}>-${comisionFija.toLocaleString()}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Premio garantizado</Text>
                <Text style={styles.previewVal}>${premioGarantizadoNum.toLocaleString()}</Text>
              </View>
              <View style={[styles.previewRow, styles.previewRowTotal]}>
                <Text style={styles.previewLabelTotal}>Pozo final para premios</Text>
                <Text style={[styles.previewValTotal, { color: '#35D07F' }]}>${pozoFinalPremios.toLocaleString()}</Text>
              </View>

              {numGanadores === 1 ? (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Ganador Top 1</Text>
                  <Text style={styles.previewVal}>${pozoFinalPremios.toLocaleString()}</Text>
                </View>
              ) : (
                <>
                  {premiosActivos.map((pct, idx) => (
                    <View key={`desglose_${idx}`} style={styles.previewRow}>
                      <Text style={styles.previewLabel}>{idx + 1}° lugar ({pct}%)</Text>
                      <Text style={styles.previewVal}>${((pozoFinalPremios * pct) / 100).toLocaleString()}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.publishBtn,
                (totalPartidos === 0 || loadingPublish || sumaPremios !== 100) && styles.publishBtnDisabled,
              ]}
              onPress={handlePublicar}
              disabled={totalPartidos === 0 || loadingPublish || sumaPremios !== 100}
            >
              {loadingPublish
                ? <ActivityIndicator color="#08131C" size="small" />
                : <Text style={styles.publishBtnTxt}>Publicar Quiniela</Text>}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {step === 2 && (
        <View style={styles.step2FloatingWrap}>
          <TouchableOpacity
            style={[styles.stepNextBtn, totalPartidos === 0 && styles.stepNextBtnDisabled, styles.step2FloatingBtn]}
            onPress={() => setStep(3)}
            disabled={totalPartidos === 0}
          >
            <Text style={styles.stepNextBtnTxt}>Continuar a Premios</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: '#070B12' },
  header:                 { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#203047', backgroundColor: '#0C131F' },
  backButton:             { width: 72, borderWidth: 1, borderColor: '#2E4667', backgroundColor: '#142238', borderRadius: 10, paddingVertical: 7, alignItems: 'center' },
  backText:               { color: '#CFE1FA', fontSize: 13, fontWeight: '700' },
  title:                  { color: '#ECF3FD', fontSize: 19, fontWeight: '800' },
  content:                { padding: 15, paddingBottom: 40 },
  heroCard:               { backgroundColor: '#0F1622', borderRadius: 18, borderWidth: 1, borderColor: '#26374F', padding: 14, marginBottom: 10, overflow: 'hidden' },
  heroGlowA:              { position: 'absolute', width: 160, height: 160, borderRadius: 90, top: -60, left: -55, backgroundColor: 'rgba(53,208,127,0.13)' },
  heroGlowB:              { position: 'absolute', width: 170, height: 170, borderRadius: 90, bottom: -80, right: -65, backgroundColor: 'rgba(103,186,255,0.13)' },
  heroHeader:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  heroBackButton:         { width: 72, backgroundColor: '#15233A', borderWidth: 1, borderColor: '#2E486A', borderRadius: 10, paddingVertical: 7, alignItems: 'center' },
  heroBackText:           { color: '#D8E8FB', fontSize: 13, fontWeight: '700' },
  heroHeaderTitle:        { color: '#EFF4FC', fontSize: 19, fontWeight: '800' },
  heroTag:                { color: '#7FD4FF', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  heroTitle:              { color: '#EEF4FD', fontSize: 19, fontWeight: '800', marginBottom: 12 },
  heroSub:                { color: '#96ABC6', fontSize: 12, lineHeight: 18 },
  topStepperRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topStepItem:            { alignItems: 'center' },
  topStepNode:            { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#4A607F', backgroundColor: '#102039', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  topStepNodeActive:      { borderColor: '#C6FF00', backgroundColor: '#C6FF00' },
  topStepNodeText:        { color: '#9AB0CB', fontSize: 12, fontWeight: '800' },
  topStepNodeTextActive:  { color: '#08131C' },
  topStepLabel:           { color: '#90A6C1', fontSize: 11, fontWeight: '800' },
  topStepLabelActive:     { color: '#C6FF00' },
  topStepBar:             { flex: 1, height: 3, backgroundColor: '#2D4665', borderRadius: 999, marginHorizontal: 8, marginBottom: 18 },
  topStepBarActive:       { backgroundColor: '#C6FF00' },
  stepperWrapLine:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, marginTop: 2 },
  stepNodeWrap:           { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepNode:               { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#445B7A', backgroundColor: '#102039', alignItems: 'center', justifyContent: 'center' },
  stepNodeActive:         { borderColor: '#C6FF00', backgroundColor: '#C6FF00' },
  stepNodeDone:           { borderColor: '#C6FF00', backgroundColor: '#C6FF00' },
  stepNodeText:           { color: '#9AB0CB', fontSize: 12, fontWeight: '800' },
  stepNodeTextActive:     { color: '#08131C' },
  stepConnector:          { flex: 1, height: 2, backgroundColor: '#365173', marginHorizontal: 8 },
  stepConnectorActive:    { backgroundColor: '#C6FF00' },
  stepLabelsRow:          { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  stepLabel:              { color: '#90A6C1', fontSize: 12, fontWeight: '700' },
  stepLabelActive:        { color: '#C6FF00' },
  stepIntroCard:          { backgroundColor: '#0E1A2A', borderRadius: 14, borderWidth: 1, borderColor: '#2B3F5E', padding: 12, marginBottom: 10 },
  stepIntroTopRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  stepIntroKicker:        { color: '#89A4C5', fontSize: 11, fontWeight: '700', letterSpacing: 0.7 },
  stepIntroPercent:       { color: '#C6FF00', fontSize: 12, fontWeight: '800' },
  stepIntroTitle:         { color: '#EDF5FD', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  stepIntroSub:           { color: '#90A6C1', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  stepProgressTrack:      { height: 6, borderRadius: 999, backgroundColor: '#1C2E46', overflow: 'hidden' },
  stepProgressFill:       { height: '100%', borderRadius: 999, backgroundColor: '#C6FF00' },
  stepCard:               { backgroundColor: '#0B1421', borderRadius: 16, borderWidth: 1, borderColor: '#253A58', paddingHorizontal: 12, paddingBottom: 6, marginBottom: 8 },
  sectionTitle:           { color: '#DDE8F8', fontSize: 16, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  formRow:                { flexDirection: 'row', gap: 15, marginBottom: 15 },
  inputContainer:         { flex: 1, marginBottom: 15 },
  formLabelUpper:         { color: '#8DA4C1', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' },
  label:                  { color: '#8DA4C1', fontSize: 12, marginBottom: 5, fontWeight: '600' },
  hint:                   { color: '#6D84A0', fontSize: 10, marginTop: 4 },
  input:                  { backgroundColor: '#101A2A', color: '#EFF4FD', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2B3F5E', fontSize: 15, height: 48 },
  moneyInputWrap:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101A2A', borderRadius: 10, borderWidth: 1, borderColor: '#2B3F5E', height: 48, paddingHorizontal: 12 },
  moneyPrefix:            { color: '#EFF4FD', fontSize: 16, fontWeight: '700', marginRight: 8 },
  moneyInput:             { flex: 1, color: '#EFF4FD', fontSize: 15, height: '100%' },
  // Cierre automático
  cierreBox:              { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101A2A', borderRadius: 12, padding: 15, marginBottom: 16, borderWidth: 1.5, borderColor: '#2F466A', gap: 12 },
  cierreTitle:            { color: '#EAF2FC', fontWeight: 'bold', fontSize: 14, marginBottom: 3 },
  cierreDesc:             { color: '#8098B5', fontSize: 11, lineHeight: 16 },
  cierreFecha:            { color: '#67BAFF', fontSize: 11, marginTop: 4, fontWeight: '600' },
  cierreWarning:          { color: '#F39C12', fontSize: 11, marginTop: 4 },
  privadoRow:             { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101A2A', borderRadius: 12, padding: 15, marginBottom: 16, borderWidth: 1.5, borderColor: '#2F466A', gap: 12 },
  selectedBadgeFloating:  { alignSelf: 'flex-start', marginTop: 10, backgroundColor: 'rgba(103,186,255,0.16)', borderColor: '#67BAFF', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  selectedBadgeTxt:       { color: '#CFE2FC', fontSize: 12, fontWeight: '700' },
  searchBox:              { marginTop: 12, marginBottom: 8 },
  searchInput:            { height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#32547A', backgroundColor: '#101D30', color: '#EFF4FD', paddingHorizontal: 12, fontSize: 14 },
  quickFiltersRow:        { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quickFilterChip:        { borderRadius: 999, borderWidth: 1, borderColor: '#34577C', backgroundColor: '#101A2A', paddingVertical: 7, paddingHorizontal: 12 },
  quickFilterChipActive:  { borderColor: '#67BAFF', backgroundColor: 'rgba(103,186,255,0.2)' },
  quickFilterTxt:         { color: '#88A0BC', fontSize: 12, fontWeight: '700' },
  quickFilterTxtActive:   { color: '#CFE5FF' },
  ligaPillsRow:           { gap: 8, paddingBottom: 8, marginBottom: 8 },
  ligaPillChip:           { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ligaPillFlag:           { fontSize: 14 },
  stepNextBtn:            { backgroundColor: '#67BAFF', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4, marginBottom: 6 },
  stepNextBtnDisabled:    { opacity: 0.45 },
  stepNextBtnTxt:         { color: '#08131C', fontWeight: '800', fontSize: 14 },
  stepOneActionBtn:       { marginTop: 6, marginBottom: 10 },
  step2FloatingWrap:      { position: 'absolute', left: 14, right: 14, bottom: 16 },
  step2FloatingBtn:       { marginBottom: 0, shadowColor: '#67BAFF', shadowOpacity: 0.38, shadowRadius: 8, elevation: 6 },
  // Dropdowns
  dropdownRow:            { marginBottom: 14, zIndex: 10 },
  toggleRow:              { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggleBtn:              { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#2A3F5E', alignItems: 'center', backgroundColor: '#101A2A' },
  toggleBtnActive:        { borderColor: '#67BAFF', backgroundColor: 'rgba(103,186,255,0.12)' },
  toggleText:             { color: '#7C94B1', fontSize: 13, fontWeight: '600' },
  toggleTextActive:       { color: '#67BAFF' },
  warningBox:             { backgroundColor: 'rgba(243,156,18,0.08)', borderRadius: 10, borderWidth: 1, borderColor: '#F39C12', padding: 12, marginBottom: 14 },
  warningText:            { color: '#F39C12', fontSize: 13, lineHeight: 20 },
  // Preview
  previewBox:             { backgroundColor: '#101A2A', borderRadius: 12, padding: 15, marginBottom: 10, borderWidth: 1.5, borderColor: '#2F466A' },
  previewTitle:           { color: '#F39C12', fontWeight: 'bold', fontSize: 13, marginBottom: 12 },
  previewRow:             { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  previewRowTotal:        { borderTopWidth: 1, borderTopColor: '#2A3F5E', paddingTop: 8, marginTop: 4 },
  previewLabel:           { color: '#9AB0CB', fontSize: 13 },
  previewVal:             { color: '#EEF4FD', fontSize: 13, fontWeight: 'bold' },
  previewLabelTotal:      { color: '#EEF4FD', fontSize: 14, fontWeight: 'bold' },
  previewValTotal:        { color: '#F39C12', fontSize: 18, fontWeight: 'bold' },
  previewNote:            { color: '#728AAA', fontSize: 10, marginTop: 8, textAlign: 'center' },
  // Fetch
  fetchBtn:               { backgroundColor: '#101A2A', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10, borderWidth: 1.5 },
  neonBorderBlue:         { borderColor: '#67BAFF', shadowColor: '#67BAFF', shadowOpacity: 0.45, shadowRadius: 8, elevation: 5 },
  neonBorderMLB:          { borderColor: '#35D07F', shadowColor: '#35D07F', shadowOpacity: 0.45, shadowRadius: 8, elevation: 5 },
  fetchBtnText:           { color: '#67BAFF', fontWeight: 'bold', fontSize: 16 },
  fetchBtnTextMLB:        { color: '#35D07F', fontWeight: 'bold', fontSize: 16 },
  // Manual
  manualBox:              { backgroundColor: '#101A2A', borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#3B526F' },
  manualTitle:            { color: '#F39C12', fontWeight: 'bold', fontSize: 14, marginBottom: 12 },
  addManualBtn:           { backgroundColor: 'rgba(46,204,113,0.12)', borderRadius: 10, borderWidth: 1, borderColor: '#2ECC71', padding: 12, alignItems: 'center' },
  addManualTxt:           { color: '#2ECC71', fontWeight: 'bold', fontSize: 14 },
  manualCard:             { flexDirection: 'row', alignItems: 'center', backgroundColor: '#152238', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2A3F5D' },
  manualCardTeams:        { color: '#EEF4FD', fontWeight: 'bold', fontSize: 13 },
  manualCardFecha:        { color: '#8BA1BD', fontSize: 11, marginTop: 2 },
  deleteBtn:              { padding: 6 },
  deleteBtnTxt:           { color: '#E74C3C', fontWeight: 'bold', fontSize: 16 },
  // Lista partidos / juegos
  listHeader:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectAllBtn:           { backgroundColor: '#152238', borderWidth: 1, borderColor: '#67BAFF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  selectAllText:          { color: '#67BAFF', fontSize: 12, fontWeight: 'bold' },
  matchCard:              { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101A2A', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#2A3F5E' },
  matchCardSelected:      { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.05)' },
  matchCardSelectedMLB:   { borderColor: '#35D07F', backgroundColor: 'rgba(53,208,127,0.05)' },
  checkbox:               { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#6E86A3', marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected:       { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  checkboxSelectedMLB:    { backgroundColor: '#35D07F', borderColor: '#35D07F' },
  checkmark:              { color: '#000', fontWeight: 'bold', fontSize: 14 },
  matchRow:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  matchTeamsWithLogos:    { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8, marginRight: 8 },
  teamWithLogo:           { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, gap: 6 },
  teamLogo:               { width: 20, height: 20, borderRadius: 10 },
  teamLogoFallback:       { width: 20, height: 20, borderRadius: 10, backgroundColor: '#152238', borderWidth: 1, borderColor: '#2A3F5D', alignItems: 'center', justifyContent: 'center' },
  teamLogoFallbackTxt:    { color: '#8BA1BD', fontSize: 10, fontWeight: '700' },
  vsText:                 { color: '#8BA1BD', fontSize: 12, fontWeight: '700' },
  matchTeams:             { color: '#EEF4FD', fontSize: 14, fontWeight: 'bold', flex: 1 },
  marcadorText:           { color: '#2ECC71', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  matchMeta:              { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  matchDate:              { color: '#8BA1BD', fontSize: 11 },
  statusBadge:            { fontSize: 11, fontWeight: '600' },
  mlbGamePk:              { color: '#6D86A4', fontSize: 9, marginTop: 2 },
  ganadoresRow:           { flexDirection: 'row', gap: 10, marginBottom: 14 },
  ganadorBtn:             { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#2A3F5E', backgroundColor: '#101A2A', paddingVertical: 12, alignItems: 'center' },
  ganadorBtnActive:       { borderColor: '#67BAFF', backgroundColor: 'rgba(103,186,255,0.13)' },
  ganadorBtnTxt:          { color: '#8DA6C3', fontWeight: '700' },
  ganadorBtnTxtActive:    { color: '#67BAFF' },
  premiosInputsCard:      { backgroundColor: '#101A2A', borderWidth: 1, borderColor: '#2A3F5E', borderRadius: 12, padding: 12, gap: 8, marginBottom: 12 },
  premioInputRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  premioSuma:             { fontSize: 12, fontWeight: '800', textAlign: 'right', marginTop: 4 },
  publishBtn:             { backgroundColor: '#35D07F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6, marginBottom: 12 },
  publishBtnDisabled:     { opacity: 0.45 },
  publishBtnTxt:          { color: '#08131C', fontWeight: '800', fontSize: 15 },
  // FAB
  fab:                    { position: 'absolute', bottom: 30, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 50, minWidth: 200, alignItems: 'center', justifyContent: 'center' },
  fabActive:              { backgroundColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.8, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 12 },
  fabActiveMLB:           { backgroundColor: '#35D07F', shadowColor: '#35D07F', shadowOpacity: 0.8, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 12 },
  fabInactive:            { backgroundColor: '#152238', borderWidth: 1, borderColor: '#2A3F5E', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  fabText:                { color: '#000', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 },
});
