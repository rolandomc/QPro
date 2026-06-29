import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  TouchableOpacity, FlatList, Alert, Linking, Platform,
  TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import ProgressBar from '../../src/components/ProgressBar';
import MatchSelectionCard, { type SeleccionConGoles } from '../../src/components/MatchSelectionCard';
import { QuinielasService } from '../../src/services/quinielas.service';
import { MercadoPagoService } from '../../src/services/mercadopago.service';
import { SpeiService } from '../../src/services/spei.service';
import { supabase } from '../../src/config/supabase';

type PayMethod = 'mp' | 'spei';
type ConfirmState =
  | 'idle'
  | 'choosingPayment'
  | 'confirmingMP'
  | 'confirmingEdit'
  | 'speiInstructions'   // Datos bancarios + subir comprobante
  | 'speiUploading'      // Subiendo imagen
  | 'speiWaitingKey'     // Imagen subida, esperando clave de rastreo
  | 'validatingSpei'     // Spinner apiCEP
  | 'speiSuccess'        // Validado OK
  | 'speiPending'        // Comprobante enviado, en revisión (sin clave o apiCEP no pudo)
  | 'speiError'          // Comprobante inválido
  | 'success'
  | 'successEdit'
  | 'error';

const PENDING_KEY = 'qpro_pago_pendiente';
const CLABE_DESTINO = process.env.EXPO_PUBLIC_CLABE_DESTINO ?? '000000000000000000';
const BANCO_NOMBRE  = process.env.EXPO_PUBLIC_BANCO_NOMBRE  ?? 'STP';

function checkPendingPago(quinielaId: string): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    const val = localStorage.getItem(PENDING_KEY);
    if (val === quinielaId) { localStorage.removeItem(PENDING_KEY); return true; }
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
  const [errorMsg,         setErrorMsg]         = useState('');
  const [faltanMsg,        setFaltanMsg]         = useState('');
  const [retryingPago,     setRetryingPago]      = useState(false);
  const [payMethod,        setPayMethod]         = useState<PayMethod>('mp');
  const [claveRastreo,     setClaveRastreo]      = useState('');
  const [speiResultMsg,    setSpeiResultMsg]     = useState('');
  const [comprobanteUrl,   setComprobanteUrl]    = useState<string | null>(null);

  const openingRef           = useRef(false);
  const picksOriginalesRef   = useRef<Record<string, SeleccionConGoles>>({});
  const participacionIdRef   = useRef<string | null>(null);

  // ─── Helpers ────────────────────────────────────────────────────────────────

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

  // ─── Carga inicial ───────────────────────────────────────────────────────────

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
              participacionIdRef.current = part.id;
              await cargarPicksActuales(part.id);
              setPagoPendiente(part.estado === 'pendiente' || part.estado === 'spei_pendiente');
            } else {
              setYaParticipo(false);
              setPagoPendiente(false);
            }
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

  // ─── Picks ───────────────────────────────────────────────────────────────────

  const handleSelect = (partidoId: string, seleccion: SeleccionConGoles) => {
    if (yaParticipo && !modoEdicion) return;
    setSelecciones(prev => ({ ...prev, [partidoId]: seleccion }));
  };

  const handleCancelarEdicion = useCallback(() => {
    setModoEdicion(false);
    setFaltanMsg('');
    if (participacionId) setSelecciones({ ...picksOriginalesRef.current });
  }, [participacionId]);

  // ─── Edición ─────────────────────────────────────────────────────────────────

  const handleGuardarEdicion = async () => {
    if (!participacionId) return;
    setSaving(true);
    try {
      const totalGolesPredichos = Object.values(selecciones).reduce(
        (acc, s) => acc + (s.golesLocal ?? 0) + (s.golesVisitante ?? 0), 0
      );
      const rows = Object.entries(selecciones).map(([partido_id, sel]) => ({
        participacion_id:          participacionId,
        partido_id,
        prediccion:                sel.prediccion,
        goles_local_predichos:     sel.golesLocal,
        goles_visitante_predichos: sel.golesVisitante,
      }));
      const [{ error: selErr }] = await Promise.all([
        supabase.from('selecciones').upsert(rows, { onConflict: 'participacion_id,partido_id' }),
        supabase.from('participaciones')
          .update({ total_goles_predichos: totalGolesPredichos })
          .eq('id', participacionId),
      ]);
      if (selErr) throw selErr;
      picksOriginalesRef.current = { ...selecciones };
      setModoEdicion(false);
      setConfirmState('successEdit');
    } catch (e: any) {
      setErrorMsg(e.message); setConfirmState('error');
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

  // ─── Primera participación ───────────────────────────────────────────────────

  const handleConfirmarClick = () => {
    if (yaParticipo) return;
    const faltan = partidos.filter(p => !selecciones[p.id]);
    if (faltan.length > 0) { setFaltanMsg(`⚠️ Aún te faltan ${faltan.length} partido(s).`); return; }
    setFaltanMsg('');
    setConfirmState('choosingPayment');
  };

  // ─── Pago MP ─────────────────────────────────────────────────────────────────

  const handleIrAPagarMP = async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setSaving(true);
    try {
      const participacion = await QuinielasService.guardarSelecciones(id, selecciones);
      const partId = participacion.id ?? participacionId;
      participacionIdRef.current = partId;
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

  // ─── Pago SPEI ───────────────────────────────────────────────────────────────

  const handleIrASPEI = async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setSaving(true);
    try {
      const participacion = await QuinielasService.guardarSelecciones(id, selecciones);
      const partId = participacion.id ?? participacionId;
      participacionIdRef.current = partId;
      setParticipacionId(partId);
      await SpeiService.registrarIntencionSPEI(partId!);
      setConfirmState('speiInstructions');
    } catch (e: any) {
      openingRef.current = false;
      setErrorMsg(e.message);
      setConfirmState('error');
    } finally {
      setSaving(false);
      openingRef.current = false;
    }
  };

  /** Abre galería y sube imagen */
  const handleSubirComprobante = async () => {
    const partId = participacionIdRef.current ?? participacionId;
    if (!partId) return;
    setConfirmState('speiUploading');
    try {
      const url = await SpeiService.subirComprobante(partId);
      if (!url) {
        // Usuario canceló el picker
        setConfirmState('speiInstructions');
        return;
      }
      setComprobanteUrl(url);
      setConfirmState('speiWaitingKey');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo subir el comprobante.');
      setConfirmState('speiInstructions');
    }
  };

  /** Valida clave de rastreo con apiCEP */
  const handleValidarSPEI = async () => {
    if (!claveRastreo.trim()) {
      Alert.alert('Falta la clave', 'Ingresa la clave de rastreo de tu comprobante SPEI.');
      return;
    }
    const partId = participacionIdRef.current ?? participacionId;
    if (!partId) return;
    setConfirmState('validatingSpei');
    try {
      const monto = quiniela?.precio_entrada ?? 0;
      const result = await SpeiService.validarYConfirmar(partId, claveRastreo.trim(), monto);
      if (result.valid) {
        setSpeiResultMsg(`✅ Pago confirmado por $${result.amount} MXN`);
        setConfirmState('speiSuccess');
      } else {
        setSpeiResultMsg(result.errorMsg ?? 'Comprobante inválido');
        setConfirmState('speiError');
      }
    } catch (e: any) {
      setSpeiResultMsg(e.message);
      setConfirmState('speiError');
    }
  };

  /** Sin clave rastreo → queda en revisión manual */
  const handleEnviarSinClave = async () => {
    const partId = participacionIdRef.current ?? participacionId;
    if (!partId) return;
    await SpeiService.marcarPendienteRevision(partId);
    setConfirmState('speiPending');
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
        Linking.openURL(init_point);
      }
    } catch (e: any) {
      openingRef.current = false;
      Alert.alert('Error', e.message ?? 'No pudimos abrir el pago.');
    } finally {
      setRetryingPago(false);
    }
  };

  // ─── Computed ────────────────────────────────────────────────────────────────

  const totalSeleccionados    = Object.keys(selecciones).length;
  const isComplete            = totalSeleccionados === partidos.length && partidos.length > 0;
  const puedeEditar           = yaParticipo && quiniela?.estado === 'abierta';
  const golesPredichosTotales = Object.values(selecciones).reduce(
    (acc, s) => acc + (s.golesLocal ?? 0) + (s.golesVisitante ?? 0), 0
  );
  const precioEntrada         = quiniela?.precio_entrada ?? 0;

  // ════════════════════════════════════════════════════════════════════════════
  // PANTALLAS DE ESTADO
  // ════════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#2ECC71" />
          <Text style={s.loadingText}>Cargando partidos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Éxito MP ────────────────────────────────────────────────────────────────
  if (confirmState === 'success') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Text style={s.bigEmoji}>🎉</Text>
          <Text style={s.stateTitle}>¡Pago en proceso!</Text>
          <Text style={s.stateSub}>Tus picks fueron guardados.{`\n`}Tu participación se confirma cuando MP apruebe el pago.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/results')}>
            <Text style={s.primaryBtnTxt}>Ver mis quinielas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Éxito edición ────────────────────────────────────────────────────────────
  if (confirmState === 'successEdit') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Text style={s.bigEmoji}>✅</Text>
          <Text style={s.stateTitle}>¡Picks actualizados!</Text>
          <Text style={s.stateSub}>Tus cambios quedaron guardados.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setConfirmState('idle')}>
            <Text style={s.primaryBtnTxt}>Ver mis picks</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error genérico ───────────────────────────────────────────────────────────
  if (confirmState === 'error') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Text style={s.bigEmoji}>❌</Text>
          <Text style={s.stateTitle}>Algo salió mal</Text>
          <Text style={s.stateSub}>{errorMsg}</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setConfirmState('idle')}>
            <Text style={s.primaryBtnTxt}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Confirmación edición ─────────────────────────────────────────────────────
  if (confirmState === 'confirmingEdit') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Text style={s.bigEmoji}>📝</Text>
          <Text style={s.stateTitle}>Confirmar cambios</Text>
          <Text style={s.stateSub}>Se guardarán tus picks actualizados.</Text>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>🎯 Goles totales predichos</Text>
            <Text style={s.summaryValue}>{golesPredichosTotales}</Text>
            <Text style={s.summaryHint}>Desempate: quien más se acerque al total real gana.</Text>
          </View>
          <TouchableOpacity style={[s.primaryBtn, saving && s.disabled]} onPress={handleGuardarEdicion} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnTxt}>Guardar cambios</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.ghostBtn} onPress={() => setConfirmState('idle')} disabled={saving}>
            <Text style={s.ghostBtnTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Selector de método de pago ───────────────────────────────────────────────
  if (confirmState === 'choosingPayment') {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.centered}>
          <Text style={s.bigEmoji}>💳</Text>
          <Text style={s.stateTitle}>¿Cómo quieres pagar?</Text>
          <Text style={s.stateSub}>Entrada: <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>${precioEntrada} MXN</Text></Text>

          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>🎯 Goles totales predichos</Text>
            <Text style={s.summaryValue}>{golesPredichosTotales}</Text>
            <Text style={s.summaryHint}>Criterio de desempate si hay empate en aciertos.</Text>
          </View>

          <View style={s.methodRow}>
            <TouchableOpacity
              style={[s.methodCard, payMethod === 'mp' && s.methodCardActive]}
              onPress={() => setPayMethod('mp')}
            >
              <Text style={s.methodEmoji}>💙</Text>
              <Text style={s.methodTitle}>Mercado Pago</Text>
              <Text style={s.methodDesc}>Tarjeta, OXXO, saldo MP{`\n`}Aprobación instantánea</Text>
              {payMethod === 'mp' && <View style={s.methodCheck}><Text style={s.methodCheckTxt}>✓</Text></View>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.methodCard, payMethod === 'spei' && s.methodCardActive]}
              onPress={() => setPayMethod('spei')}
            >
              <Text style={s.methodEmoji}>🏦</Text>
              <Text style={s.methodTitle}>Transferencia SPEI</Text>
              <Text style={s.methodDesc}>Desde cualquier banco{`\n`}Sin comisión de pasarela</Text>
              {payMethod === 'spei' && <View style={s.methodCheck}><Text style={s.methodCheckTxt}>✓</Text></View>}
            </TouchableOpacity>
          </View>

          {payMethod === 'mp' ? (
            <View style={s.methodInfoBox}>
              <Text style={s.methodInfoText}>Se abrirá el checkout de Mercado Pago. Puedes pagar con tarjeta, saldo MP u OXXO. Tu participación se confirma automáticamente.</Text>
            </View>
          ) : (
            <View style={s.methodInfoBox}>
              <Text style={s.methodInfoText}>Verás los datos para transferir. Sube tu comprobante y se validará automáticamente vía Banxico.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.primaryBtn, saving && s.disabled]}
            onPress={payMethod === 'mp' ? handleIrAPagarMP : handleIrASPEI}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={s.primaryBtnTxt}>
                  {payMethod === 'mp' ? 'Pagar con Mercado Pago →' : 'Ver datos de transferencia →'}
                </Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.ghostBtn} onPress={() => setConfirmState('idle')} disabled={saving}>
            <Text style={s.ghostBtnTxt}>← Volver a mis picks</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Instrucciones SPEI ───────────────────────────────────────────────────────
  if (confirmState === 'speiInstructions') {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.speiScroll}>
          <Text style={s.bigEmoji}>🏦</Text>
          <Text style={s.stateTitle}>Transferencia SPEI</Text>
          <Text style={s.stateSub}>Realiza la transferencia y luego sube tu comprobante.</Text>

          {/* Datos bancarios */}
          <View style={s.bankBox}>
            <View style={s.bankRow}>
              <Text style={s.bankLabel}>Banco</Text>
              <Text style={s.bankValue}>{BANCO_NOMBRE}</Text>
            </View>
            <View style={s.divider} />
            <View style={s.bankRow}>
              <Text style={s.bankLabel}>CLABE</Text>
              <Text style={[s.bankValue, s.clabe]} selectable>{CLABE_DESTINO}</Text>
            </View>
            <View style={s.divider} />
            <View style={s.bankRow}>
              <Text style={s.bankLabel}>Monto exacto</Text>
              <Text style={[s.bankValue, { color: '#2ECC71' }]}>${precioEntrada}.00 MXN</Text>
            </View>
            <View style={s.divider} />
            <View style={s.bankRow}>
              <Text style={s.bankLabel}>Concepto</Text>
              <Text style={s.bankValue}>QPro participación</Text>
            </View>
          </View>

          <View style={s.speiWarning}>
            <Text style={s.speiWarningTxt}>⚠️ Transfiere el monto exacto (${precioEntrada}.00 MXN) para validación automática.</Text>
          </View>

          {/* Botón subir comprobante */}
          <TouchableOpacity style={s.uploadBtn} onPress={handleSubirComprobante}>
            <Text style={s.uploadBtnIcon}>📎</Text>
            <Text style={s.uploadBtnTxt}>Subir comprobante (foto o captura)</Text>
          </TouchableOpacity>

          <Text style={s.inputHint}>Sube la foto o captura de pantalla de tu comprobante SPEI.</Text>

          <TouchableOpacity style={s.ghostBtn} onPress={() => setConfirmState('choosingPayment')}>
            <Text style={s.ghostBtnTxt}>← Cambiar método de pago</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Subiendo imagen ──────────────────────────────────────────────────────────
  if (confirmState === 'speiUploading') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#2ECC71" style={{ marginBottom: 20 }} />
          <Text style={s.stateTitle}>Subiendo comprobante…</Text>
          <Text style={s.stateSub}>Espera un momento.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Imagen subida → ingresar clave rastreo ───────────────────────────────────
  if (confirmState === 'speiWaitingKey') {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.speiScroll}>
          <Text style={s.bigEmoji}>✅</Text>
          <Text style={s.stateTitle}>Comprobante recibido</Text>
          <Text style={s.stateSub}>Ingresa la clave de rastreo para confirmar tu pago automáticamente.</Text>

          <View style={s.comprobanteOkBox}>
            <Text style={s.comprobanteOkTxt}>📎 Imagen subida correctamente</Text>
          </View>

          <Text style={s.inputLabel}>Clave de rastreo (CEP)</Text>
          <TextInput
            style={s.input}
            placeholder="Ej. 2026062912345678901234"
            placeholderTextColor="#404040"
            value={claveRastreo}
            onChangeText={setClaveRastreo}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text style={s.inputHint}>La encuentras en el comprobante de tu banco (PDF o notificación).</Text>

          <TouchableOpacity
            style={[s.primaryBtn, !claveRastreo.trim() && s.disabled]}
            onPress={handleValidarSPEI}
            disabled={!claveRastreo.trim()}
          >
            <Text style={s.primaryBtnTxt}>Validar y confirmar pago ✓</Text>
          </TouchableOpacity>

          {/* Opción sin clave */}
          <View style={s.sinClaveBox}>
            <Text style={s.sinClaveTxt}>¿No tienes la clave de rastreo?</Text>
            <TouchableOpacity onPress={handleEnviarSinClave}>
              <Text style={s.sinClaveLink}>Enviar para revisión manual →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Validando SPEI ───────────────────────────────────────────────────────────
  if (confirmState === 'validatingSpei') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#2ECC71" style={{ marginBottom: 20 }} />
          <Text style={s.stateTitle}>Validando pago…</Text>
          <Text style={s.stateSub}>Consultando Banxico vía apiCEP.{`\n`}Esto puede tardar unos segundos.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── SPEI confirmado ──────────────────────────────────────────────────────────
  if (confirmState === 'speiSuccess') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Text style={s.bigEmoji}>🎉</Text>
          <Text style={s.stateTitle}>¡Participación confirmada!</Text>
          <Text style={s.stateSub}>{speiResultMsg}</Text>
          <Text style={s.stateSub}>Tu pago SPEI fue verificado.{`\n`}¡Ya estás dentro!</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/results')}>
            <Text style={s.primaryBtnTxt}>Ver mis quinielas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── SPEI en revisión (sin clave o apiCEP no pudo confirmar) ──────────────────
  if (confirmState === 'speiPending') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Text style={s.bigEmoji}>⏳</Text>
          <Text style={s.stateTitle}>Pago en revisión</Text>
          <Text style={s.stateSub}>
            Recibimos tu comprobante.{`\n`}Lo revisaremos y confirmaremos tu participación en breve.
          </Text>
          <View style={s.pendingInfoBox}>
            <Text style={s.pendingInfoTxt}>📱 Te notificaremos cuando tu pago sea aprobado.</Text>
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.primaryBtnTxt}>Ir al inicio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.ghostBtn} onPress={() => router.replace('/results')}>
            <Text style={s.ghostBtnTxt}>Ver mis quinielas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── SPEI inválido ────────────────────────────────────────────────────────────
  if (confirmState === 'speiError') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Text style={s.bigEmoji}>⚠️</Text>
          <Text style={s.stateTitle}>Comprobante no válido</Text>
          <Text style={s.stateSub}>{speiResultMsg}</Text>
          <Text style={s.stateSub}>Verifica la clave de rastreo y que el monto sea exacto.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setConfirmState('speiWaitingKey')}>
            <Text style={s.primaryBtnTxt}>Intentar de nuevo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.ghostBtn} onPress={handleEnviarSinClave}>
            <Text style={s.ghostBtnTxt}>Enviar para revisión manual →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PANTALLA PRINCIPAL
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{quiniela?.titulo ?? 'Quiniela'}</Text>
          <Text style={s.headerSub}>{quiniela?.estado === 'abierta' ? '🟢 Abierta' : '🔴 Cerrada'}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      {(!yaParticipo || modoEdicion) && (
        <View style={s.progressWrap}>
          <ProgressBar current={totalSeleccionados} total={partidos.length} />
          <Text style={s.progressText}>{totalSeleccionados}/{partidos.length} picks</Text>
        </View>
      )}

      {/* Banner verde + botón editar */}
      {yaParticipo && !modoEdicion && (
        <View style={s.participandoWrap}>
          <View style={s.participandoBanner}>
            <Text style={s.participandoText}>
              ✅ Ya tienes picks guardados  •  🎯 {golesPredichosTotales} goles predichos
            </Text>
          </View>
          {puedeEditar && (
            <TouchableOpacity style={s.editBtn} onPress={() => setModoEdicion(true)}>
              <Text style={s.editBtnTxt}>✏️ Editar mis picks</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Banner pago pendiente */}
      {pagoPendiente && !modoEdicion && (
        <View style={s.pendingBanner}>
          <Text style={s.pendingBannerText}>⏳ Tu pago está pendiente. Tus picks están guardados.</Text>
          <TouchableOpacity style={s.pendingBannerBtn} onPress={handleReintentarPago} disabled={retryingPago}>
            {retryingPago
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.pendingBannerBtnTxt}>Reintentar pago</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Hint desempate */}
      {(!yaParticipo || modoEdicion) && (
        <View style={s.desempateHintBanner}>
          <Text style={s.desempateHintText}>
            ⚔️ <Text style={{ fontWeight: '600' }}>Desempate por goles:</Text> ingresa el marcador exacto. En empate de aciertos gana quien más se acerque al total real.
          </Text>
        </View>
      )}

      {/* Lista */}
      <FlatList
        data={partidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
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
          <View style={s.footer}>
            {faltanMsg ? <Text style={s.faltanMsg}>{faltanMsg}</Text> : null}

            {!yaParticipo && (
              <TouchableOpacity
                style={[s.primaryBtn, !isComplete && s.disabled]}
                onPress={handleConfirmarClick}
                disabled={!isComplete}
              >
                <Text style={s.primaryBtnTxt}>Confirmar picks →</Text>
              </TouchableOpacity>
            )}

            {modoEdicion && (
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  style={[s.primaryBtn, (!isComplete || saving) && s.disabled]}
                  onPress={handleConfirmarEdicionClick}
                  disabled={!isComplete || saving}
                >
                  {saving
                    ? <ActivityIndicator color="#000" />
                    : <Text style={s.primaryBtnTxt}>Guardar cambios</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={s.ghostBtn} onPress={handleCancelarEdicion} disabled={saving}>
                  <Text style={s.ghostBtnTxt}>Cancelar edición</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0A0C12' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#A0A0A0', marginTop: 12 },
  bigEmoji:    { fontSize: 60, marginBottom: 16 },

  stateTitle:  { color: '#E0E0E0', fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  stateSub:    { color: '#808080', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1E2128',
  },
  backBtn:      { width: 36, height: 36, justifyContent: 'center' },
  backIcon:     { color: '#2ECC71', fontSize: 28, lineHeight: 30 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { color: '#E0E0E0', fontSize: 16, fontWeight: 'bold' },
  headerSub:    { color: '#606060', fontSize: 11, marginTop: 2 },

  progressWrap: { paddingHorizontal: 16, paddingTop: 12 },
  progressText: { color: '#606060', fontSize: 12, marginTop: 6, marginBottom: 4 },

  participandoWrap:   { marginHorizontal: 16, marginTop: 12, gap: 8 },
  participandoBanner: {
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.25)',
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  participandoText: { color: '#2ECC71', fontSize: 12, fontWeight: '500' },
  editBtn:    { borderWidth: 1.5, borderColor: '#2ECC71', borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(46,204,113,0.06)' },
  editBtnTxt: { color: '#2ECC71', fontWeight: '700', fontSize: 15 },

  pendingBanner:      { marginHorizontal: 16, marginTop: 8, backgroundColor: 'rgba(243,156,18,0.1)', borderWidth: 1, borderColor: '#F39C12', borderRadius: 12, padding: 14, gap: 10 },
  pendingBannerText:  { color: '#F39C12', fontSize: 13 },
  pendingBannerBtn:   { backgroundColor: '#F39C12', borderRadius: 8, padding: 10, alignItems: 'center' },
  pendingBannerBtnTxt:{ color: '#000', fontWeight: 'bold', fontSize: 13 },

  desempateHintBanner: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: 'rgba(46,204,113,0.06)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)', borderRadius: 10, padding: 12 },
  desempateHintText:   { color: '#6ABD8A', fontSize: 12, lineHeight: 17 },

  summaryBox:   { width: '100%', backgroundColor: '#15181F', borderRadius: 14, padding: 18, marginVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35' },
  summaryLabel: { color: '#A0A0A0', fontSize: 13, marginBottom: 8 },
  summaryValue: { color: '#2ECC71', fontSize: 42, fontWeight: 'bold', marginBottom: 8 },
  summaryHint:  { color: '#505050', fontSize: 11, textAlign: 'center', lineHeight: 16 },

  methodRow: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 16 },
  methodCard: {
    flex: 1, backgroundColor: '#13161E', borderWidth: 1.5, borderColor: '#2A2D35',
    borderRadius: 16, padding: 16, alignItems: 'center', gap: 6, position: 'relative',
  },
  methodCardActive: { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.06)' },
  methodEmoji: { fontSize: 28 },
  methodTitle: { color: '#E0E0E0', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  methodDesc:  { color: '#606060', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  methodCheck: { position: 'absolute', top: 8, right: 8, backgroundColor: '#2ECC71', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  methodCheckTxt: { color: '#000', fontSize: 11, fontWeight: 'bold' },
  methodInfoBox:  { width: '100%', backgroundColor: '#13161E', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35' },
  methodInfoText: { color: '#808080', fontSize: 13, lineHeight: 19, textAlign: 'center' },

  speiScroll:  { padding: 24, alignItems: 'center' },
  bankBox:     { width: '100%', backgroundColor: '#13161E', borderRadius: 16, padding: 16, marginVertical: 16, borderWidth: 1, borderColor: '#2A2D35' },
  bankRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  bankLabel:   { color: '#606060', fontSize: 13 },
  bankValue:   { color: '#E0E0E0', fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  clabe:       { color: '#2ECC71', fontSize: 12, letterSpacing: 1 },
  divider:     { height: 1, backgroundColor: '#1E2128' },
  speiWarning: { width: '100%', backgroundColor: 'rgba(243,156,18,0.08)', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(243,156,18,0.3)' },
  speiWarningTxt: { color: '#F39C12', fontSize: 12, textAlign: 'center' },

  // Upload button
  uploadBtn: {
    width: '100%', backgroundColor: '#13161E', borderWidth: 1.5, borderColor: '#2ECC71',
    borderRadius: 14, paddingVertical: 18, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10,
  },
  uploadBtnIcon: { fontSize: 22 },
  uploadBtnTxt:  { color: '#2ECC71', fontWeight: '700', fontSize: 15 },

  // Comprobante OK chip
  comprobanteOkBox: { backgroundColor: 'rgba(46,204,113,0.08)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.25)', borderRadius: 10, padding: 10, marginBottom: 20, width: '100%', alignItems: 'center' },
  comprobanteOkTxt: { color: '#2ECC71', fontSize: 13, fontWeight: '500' },

  // Pending info box
  pendingInfoBox: { backgroundColor: 'rgba(243,156,18,0.08)', borderWidth: 1, borderColor: 'rgba(243,156,18,0.3)', borderRadius: 12, padding: 14, marginBottom: 24, width: '100%', alignItems: 'center' },
  pendingInfoTxt: { color: '#F39C12', fontSize: 13, textAlign: 'center' },

  // Sin clave option
  sinClaveBox:  { marginTop: 20, alignItems: 'center', gap: 6 },
  sinClaveTxt:  { color: '#505050', fontSize: 12 },
  sinClaveLink: { color: '#4A7CFF', fontSize: 13, fontWeight: '600' },

  inputLabel:  { alignSelf: 'flex-start', color: '#A0A0A0', fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input:       { width: '100%', backgroundColor: '#13161E', borderWidth: 1, borderColor: '#2A2D35', borderRadius: 12, padding: 14, color: '#E0E0E0', fontSize: 14, marginBottom: 6, letterSpacing: 0.5 },
  inputHint:   { alignSelf: 'flex-start', color: '#404040', fontSize: 11, marginBottom: 20 },

  primaryBtn:    { width: '100%', backgroundColor: '#2ECC71', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  primaryBtnTxt: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  ghostBtn:      { width: '100%', paddingVertical: 14, alignItems: 'center' },
  ghostBtnTxt:   { color: '#606060', fontSize: 14 },
  disabled:      { opacity: 0.35 },

  list:     { padding: 16, paddingBottom: 24 },
  footer:   { marginTop: 8, gap: 10 },
  faltanMsg:{ color: '#F39C12', textAlign: 'center', fontSize: 13, marginBottom: 4 },
});
