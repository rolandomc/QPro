import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  TouchableOpacity, FlatList, Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import ProgressBar from '../../src/components/ProgressBar';
import MatchSelectionCard, { type SeleccionConGoles } from '../../src/components/MatchSelectionCard';
import { QuinielasService } from '../../src/services/quinielas.service';
import { MercadoPagoService } from '../../src/services/mercadopago.service';
import { supabase } from '../../src/config/supabase';

type ConfirmState = 'idle' | 'confirming' | 'confirmingEdit' | 'success' | 'successEdit' | 'error';

const PENDING_KEY = 'qpro_pago_pendiente';

function checkPendingPago(quinielaId: string): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    const val = localStorage.getItem(PENDING_KEY);
    if (val === quinielaId) {
      localStorage.removeItem(PENDING_KEY);
      return true;
    }
  } catch (_) {}
  return false;
}

export default function QuinielaDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const isPendingPago = useRef(checkPendingPago(id as string));

  const [quiniela,        setQuiniela]        = useState<any>(null);
  const [partidos,        setPartidos]        = useState<any[]>([]);
  const [selecciones,     setSelecciones]     = useState<Record<string, SeleccionConGoles>>({});
  const [loading,         setLoading]         = useState(!isPendingPago.current);
  const [saving,          setSaving]          = useState(false);
  const [yaParticipo,     setYaParticipo]     = useState(false);
  const [pagoPendiente,   setPagoPendiente]   = useState(false);
  const [modoEdicion,     setModoEdicion]     = useState(false);
  const [participacionId, setParticipacionId] = useState<string | null>(null);
  const [confirmState,    setConfirmState]    = useState<ConfirmState>(
    isPendingPago.current ? 'success' : 'idle'
  );
  const [errorMsg,     setErrorMsg]     = useState('');
  const [faltanMsg,    setFaltanMsg]    = useState('');
  const [retryingPago, setRetryingPago] = useState(false);

  const openingRef = useRef(false);
  const picksOriginalesRef = useRef<Record<string, SeleccionConGoles>>({});

  const cargarPicksActuales = useCallback(async (partId: string) => {
    const { data: sels } = await supabase
      .from('selecciones')
      .select('partido_id, prediccion, goles_local_predichos, goles_visitante_predichos')
      .eq('participacion_id', partId);

    const map: Record<string, SeleccionConGoles> = {};
    (sels || []).forEach((s: any) => {
      map[s.partido_id] = {
        prediccion:     s.prediccion,
        golesLocal:     s.goles_local_predichos    ?? 0,
        golesVisitante: s.goles_visitante_predichos ?? 0,
      };
    });
    picksOriginalesRef.current = map;
    setSelecciones(map);
    return map;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isPendingPago.current) return;

      async function loadData() {
        if (!id) return;
        setLoading(true);
        try {
          const [partidosData, { data: quinielaData }] = await Promise.all([
            QuinielasService.getPartidos(id),
            supabase.from('quinielas').select('*').eq('id', id).single(),
          ]);
          setQuiniela(quinielaData);
          setPartidos(partidosData || []);

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: part } = await supabase
              .from('participaciones')
              .select('id, estado')
              .eq('quiniela_id', id)
              .eq('user_id', user.id)
              .maybeSingle();

            if (part) {
              setYaParticipo(true);
              setParticipacionId(part.id);
              await cargarPicksActuales(part.id);
              setPagoPendiente(part.estado === 'pendiente');
            } else {
              setYaParticipo(false);
              setPagoPendiente(false);
            }
          } else {
            setYaParticipo(false);
            setPagoPendiente(false);
          }
        } catch (e: any) {
          setErrorMsg(e.message);
          setConfirmState('error');
        } finally {
          setLoading(false);
        }
      }
      loadData();
    }, [id, cargarPicksActuales])
  );

  const handleSelect = (partidoId: string, seleccion: SeleccionConGoles) => {
    if (yaParticipo && !modoEdicion) return;
    setSelecciones(prev => ({ ...prev, [partidoId]: seleccion }));
  };

  const handleCancelarEdicion = useCallback(() => {
    setModoEdicion(false);
    setFaltanMsg('');
    if (participacionId) setSelecciones({ ...picksOriginalesRef.current });
  }, [participacionId]);

  const handleGuardarEdicion = async () => {
    if (!participacionId) return;
    setSaving(true);
    try {
      const totalGolesPredichos = Object.values(selecciones).reduce(
        (acc, s) => acc + (s.golesLocal ?? 0) + (s.golesVisitante ?? 0), 0
      );

      const rows = Object.entries(selecciones).map(([partido_id, sel]) => ({
        participacion_id:           participacionId,
        partido_id,
        prediccion:                 sel.prediccion,
        goles_local_predichos:      sel.golesLocal,
        goles_visitante_predichos:  sel.golesVisitante,
      }));

      const [{ error: selErr }] = await Promise.all([
        supabase
          .from('selecciones')
          .upsert(rows, { onConflict: 'participacion_id,partido_id' }),
        supabase
          .from('participaciones')
          .update({ total_goles_predichos: totalGolesPredichos })
          .eq('id', participacionId),
      ]);
      if (selErr) throw selErr;

      picksOriginalesRef.current = { ...selecciones };
      setModoEdicion(false);
      setConfirmState('successEdit');
    } catch (e: any) {
      setErrorMsg(e.message);
      setConfirmState('error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmarEdicionClick = () => {
    const faltan = partidos.filter(p => !selecciones[p.id]);
    if (faltan.length > 0) { setFaltanMsg(`⚠️ Aún te faltan ${faltan.length} partido(s).`); return; }
    setFaltanMsg('');
    setConfirmState('confirmingEdit');
  };

  const handleConfirmarClick = () => {
    if (yaParticipo) return;
    const faltan = partidos.filter(p => !selecciones[p.id]);
    if (faltan.length > 0) { setFaltanMsg(`⚠️ Aún te faltan ${faltan.length} partido(s).`); return; }
    setFaltanMsg('');
    setConfirmState('confirming');
  };

  const handleConfirmarFinal = async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setSaving(true);
    try {
      const participacion = await QuinielasService.guardarSelecciones(id, selecciones);
      const partId = participacion.id ?? participacionId;
      const { init_point } = await MercadoPagoService.crearPreferencia(partId!, id as string);
      if (Platform.OS === 'web') {
        try { localStorage.setItem(PENDING_KEY, id as string); } catch (_) {}
        window.location.href = init_point;
        return;
      } else {
        setConfirmState('success');
        Linking.openURL(init_point);
      }
    } catch (e: any) {
      openingRef.current = false;
      setSaving(false);
      setErrorMsg(e.message);
      setConfirmState('error');
    }
  };

  const handleReintentarPago = async () => {
    if (!participacionId || openingRef.current) return;
    openingRef.current = true;
    setRetryingPago(true);
    try {
      const { init_point } = await MercadoPagoService.crearPreferencia(participacionId, id as string);
      if (Platform.OS === 'web') {
        try { localStorage.setItem(PENDING_KEY, id as string); } catch (_) {}
        window.location.href = init_point;
        return;
      } else {
        setConfirmState('success');
        Linking.openURL(init_point);
      }
    } catch (e: any) {
      openingRef.current = false;
      Alert.alert('Error', e.message ?? 'No pudimos abrir el pago. Intenta más tarde.');
    } finally {
      setRetryingPago(false);
    }
  };

  const totalSeleccionados = Object.keys(selecciones).length;
  const isComplete = totalSeleccionados === partidos.length && partidos.length > 0;

  // ✅ El botón editar se muestra siempre que el usuario ya participó
  // y la quiniela sigue abierta, sin importar el estado del pago
  const puedeEditar = yaParticipo && quiniela?.estado === 'abierta';

  const golesPredichosTotales = Object.values(selecciones).reduce(
    (acc, s) => acc + (s.golesLocal ?? 0) + (s.golesVisitante ?? 0), 0
  );

  // ─── Pantallas de estado ───────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2ECC71" />
          <Text style={styles.loadingText}>Cargando partidos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (confirmState === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>🍀</Text>
          <Text style={styles.successTitle}>¡Pago en proceso!</Text>
          <Text style={styles.successSub}>
            {'Tus picks fueron guardados.\nTu participación se confirmará cuando MP apruebe el pago.'}
          </Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => router.replace('/results')}>
            <Text style={styles.successBtnTxt}>Ver mis quinielas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (confirmState === 'successEdit') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>✅</Text>
          <Text style={styles.successTitle}>¡Picks actualizados!</Text>
          <Text style={styles.successSub}>Tus cambios quedaron guardados.</Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => setConfirmState('idle')}>
            <Text style={styles.successBtnTxt}>Ver mis picks</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (confirmState === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>❌</Text>
          <Text style={styles.successTitle}>Algo salió mal</Text>
          <Text style={styles.successSub}>{errorMsg}</Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => setConfirmState('idle')}>
            <Text style={styles.successBtnTxt}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (confirmState === 'confirming' || confirmState === 'confirmingEdit') {
    const isEdit = confirmState === 'confirmingEdit';
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>📝</Text>
          <Text style={styles.successTitle}>
            {isEdit ? 'Confirmar cambios' : 'Confirmar participación'}
          </Text>
          <Text style={styles.successSub}>
            {isEdit
              ? 'Se guardarán tus picks actualizados.'
              : 'Se procesará tu pago y quedarás inscrito.'}
          </Text>

          <View style={styles.desempateSummary}>
            <Text style={styles.desempateLabel}>🎯 Tus goles totales predichos</Text>
            <Text style={styles.desempateValue}>{golesPredichosTotales}</Text>
            <Text style={styles.desempateHint}>
              En caso de empate en aciertos, el participante cuya predicción de goles
              totales sea la más cercana a los goles reales ganará.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.successBtn, saving && styles.btnDisabled]}
            onPress={isEdit ? handleGuardarEdicion : handleConfirmarFinal}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.successBtnTxt}>
                  {isEdit ? 'Guardar cambios' : 'Pagar y participar'}
                </Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmState('idle')} disabled={saving}>
            <Text style={styles.cancelBtnTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Pantalla principal ────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {quiniela?.titulo ?? 'Quiniela'}
          </Text>
          <Text style={styles.headerSub}>
            {quiniela?.estado === 'abierta' ? '🟢 Abierta' : '🔴 Cerrada'}
          </Text>
        </View>
        {/* Botón editar en el header cuando ya participó */}
        {puedeEditar && !modoEdicion ? (
          <TouchableOpacity style={styles.editHeaderBtn} onPress={() => setModoEdicion(true)}>
            <Text style={styles.editHeaderBtnTxt}>✏️ Editar</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      {/* Barra de progreso */}
      {(!yaParticipo || modoEdicion) && (
        <View style={styles.progressWrap}>
          <ProgressBar current={totalSeleccionados} total={partidos.length} />
          <Text style={styles.progressText}>
            {totalSeleccionados}/{partidos.length} picks
          </Text>
        </View>
      )}

      {/* Banner: ya participó (no en modo edición) */}
      {yaParticipo && !modoEdicion && (
        <View style={styles.participandoBanner}>
          <Text style={styles.participandoText}>
            ✅ Ya tienes picks guardados  •  🎯 {golesPredichosTotales} goles predichos
          </Text>
        </View>
      )}

      {/* Banner: pago pendiente */}
      {pagoPendiente && !modoEdicion && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingBannerText}>
            ⏳ Tu pago está pendiente. Tus picks están guardados.
          </Text>
          <TouchableOpacity
            style={styles.pendingBannerBtn}
            onPress={handleReintentarPago}
            disabled={retryingPago}
          >
            {retryingPago
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.pendingBannerBtnTxt}>Reintentar pago</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Hint de desempate */}
      {(!yaParticipo || modoEdicion) && (
        <View style={styles.desempateInfoBanner}>
          <Text style={styles.desempateInfoText}>
            ⚔️ <Text style={{ fontWeight: '600' }}>Desempate por goles:</Text> ingresa el marcador exacto que predices. En caso de empate en aciertos, quien más se acerque al total de goles reales gana.
          </Text>
        </View>
      )}

      {/* Lista de partidos */}
      <FlatList
        data={partidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <MatchSelectionCard
            partido={item}
            index={index}
            seleccionActual={selecciones[item.id] ?? null}
            onSelect={(sel) => handleSelect(item.id, sel)}
            disabled={yaParticipo && !modoEdicion}
          />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {faltanMsg ? <Text style={styles.faltanMsg}>{faltanMsg}</Text> : null}

            {/* Primera vez: confirmar y pagar */}
            {!yaParticipo && (
              <TouchableOpacity
                style={[styles.confirmBtn, !isComplete && styles.btnDisabled]}
                onPress={handleConfirmarClick}
                disabled={!isComplete}
              >
                <Text style={styles.confirmBtnTxt}>Confirmar picks y pagar</Text>
              </TouchableOpacity>
            )}

            {/* Modo edición: guardar / cancelar */}
            {modoEdicion && (
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.confirmBtn, !isComplete && styles.btnDisabled]}
                  onPress={handleConfirmarEdicionClick}
                  disabled={!isComplete || saving}
                >
                  {saving
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.confirmBtnTxt}>Guardar cambios</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelarEdicion} disabled={saving}>
                  <Text style={styles.cancelBtnTxt}>Cancelar edición</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Ya participó, no editando: botón editar también en el footer */}
            {yaParticipo && !modoEdicion && puedeEditar && (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setModoEdicion(true)}
              >
                <Text style={styles.editBtnTxt}>✏️ Editar mis picks</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0A0C12' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#A0A0A0', marginTop: 12 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1E2128',
  },
  backBtn:        { width: 36, height: 36, justifyContent: 'center' },
  backIcon:       { color: '#2ECC71', fontSize: 28, lineHeight: 30 },
  headerCenter:   { flex: 1, alignItems: 'center' },
  headerTitle:    { color: '#E0E0E0', fontSize: 16, fontWeight: 'bold' },
  headerSub:      { color: '#606060', fontSize: 11, marginTop: 2 },
  editHeaderBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2ECC71',
    borderRadius: 8,
  },
  editHeaderBtnTxt: { color: '#2ECC71', fontSize: 12, fontWeight: '600' },

  // Progress
  progressWrap: { paddingHorizontal: 16, paddingTop: 12 },
  progressText: { color: '#606060', fontSize: 12, marginTop: 6, marginBottom: 4 },

  // Banners
  participandoBanner: {
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.25)',
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  participandoText: { color: '#2ECC71', fontSize: 12, fontWeight: '500' },

  pendingBanner: {
    margin: 16, marginBottom: 0,
    backgroundColor: 'rgba(243,156,18,0.1)',
    borderWidth: 1, borderColor: '#F39C12',
    borderRadius: 12, padding: 14, gap: 10,
  },
  pendingBannerText:   { color: '#F39C12', fontSize: 13 },
  pendingBannerBtn:    { backgroundColor: '#F39C12', borderRadius: 8, padding: 10, alignItems: 'center' },
  pendingBannerBtnTxt: { color: '#000', fontWeight: 'bold', fontSize: 13 },

  desempateInfoBanner: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: 'rgba(46,204,113,0.06)',
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)',
    borderRadius: 10, padding: 12,
  },
  desempateInfoText: { color: '#6ABD8A', fontSize: 12, lineHeight: 17 },

  // Desempate summary
  desempateSummary: {
    width: '100%', backgroundColor: '#15181F',
    borderRadius: 14, padding: 18, marginVertical: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#2A2D35',
  },
  desempateLabel: { color: '#A0A0A0', fontSize: 13, marginBottom: 8 },
  desempateValue: { color: '#2ECC71', fontSize: 42, fontWeight: 'bold', marginBottom: 8 },
  desempateHint:  { color: '#505050', fontSize: 11, textAlign: 'center', lineHeight: 16 },

  // List
  list: { padding: 16, paddingBottom: 24 },

  // Footer
  footer:    { marginTop: 8, gap: 10 },
  faltanMsg: { color: '#F39C12', textAlign: 'center', fontSize: 13, marginBottom: 4 },

  confirmBtn: {
    backgroundColor: '#2ECC71', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnTxt: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  btnDisabled:   { opacity: 0.35 },

  editBtn: {
    borderWidth: 1.5, borderColor: '#2ECC71', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    backgroundColor: 'rgba(46,204,113,0.06)',
  },
  editBtnTxt: { color: '#2ECC71', fontWeight: '700', fontSize: 15 },

  editActions: { gap: 10 },

  cancelBtn:    { paddingVertical: 14, alignItems: 'center' },
  cancelBtnTxt: { color: '#606060', fontSize: 14 },

  successTitle:  { color: '#E0E0E0', fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  successSub:    { color: '#808080', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  successBtn:    { backgroundColor: '#2ECC71', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginBottom: 12 },
  successBtnTxt: { color: '#000', fontWeight: 'bold', fontSize: 15 },
});
