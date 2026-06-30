import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  TouchableOpacity, FlatList, Alert, Linking, Platform,
  ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import ProgressBar from '../../src/components/ProgressBar';
import MatchSelectionCard, { type SeleccionConGoles } from '../../src/components/MatchSelectionCard';
import { QuinielasService } from '../../src/services/quinielas.service';
import { MercadoPagoService } from '../../src/services/mercadopago.service';
import { SpeiService } from '../../src/services/spei.service';
import { supabase } from '../../src/config/supabase';

type MetodoPago = 'mp' | 'spei';
type ConfirmState =
  | 'idle'
  | 'choosingPayment'     // selector método
  | 'confirmingMP'        // resumen MP
  | 'confirmingEdit'
  | 'speiDatos'           // muestra CLABE + formulario subida comprobante
  | 'speiSubiendo'        // cargando mientras sube imagen
  | 'speiValidando'       // spinner mientras apiCEP valida
  | 'speiEnviado'         // comprobante enviado, esperando revisión manual
  | 'success'
  | 'successEdit'
  | 'error';

const PENDING_KEY = 'qpro_pago_pendiente';

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
  const [faltanMsg,        setFaltanMsg]        = useState('');
  const [retryingPago,     setRetryingPago]     = useState(false);
  const [metodoPago,       setMetodoPago]       = useState<MetodoPago>('mp');
  const [comprobanteUrl,   setComprobanteUrl]   = useState<string | null>(null);
  const [speiValidResult,  setSpeiValidResult]  = useState<{ valid: boolean; errorMsg?: string } | null>(null);

  const openingRef         = useRef(false);
  const picksOriginalesRef = useRef<Record<string, SeleccionConGoles>>({});
  const participacionIdRef = useRef<string | null>(null);

  // ─── Carga picks actuales ────────────────────────────────────────────────
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

  // ─── Focus effect ─────────────────────────────────────────────────────────
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

  // ─── Picks ────────────────────────────────────────────────────────────────
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
        supabase.from('selecciones').upsert(rows, { onConflict: 'participacion_id,partido_id' }),
        supabase.from('participaciones').update({ total_goles_predichos: totalGolesPredichos }).eq('id', participacionId),
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
    setConfirmState('choosingPayment');
  };

  // ─── Mercado Pago ─────────────────────────────────────────────────────────
  const handlePagarConMP = async () => {
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

  // ─── SPEI: guardar picks y mostrar datos bancarios ────────────────────────
  const handlePagarConSpei = async () => {
    setSaving(true);
    try {
      const participacion = await QuinielasService.guardarSelecciones(
        id, selecciones, 'spei_pendiente'
      );
      const partId = participacion.id ?? participacionId;
      setParticipacionId(partId);
      participacionIdRef.current = partId;
      await SpeiService.registrarIntencionSPEI(partId!);
      setComprobanteUrl(null);
      setSpeiValidResult(null);
      setConfirmState('speiDatos');
    } catch (e: any) {
      setErrorMsg(e.message);
      setConfirmState('error');
    } finally {
      setSaving(false);
    }
  };

  // ─── SPEI: subir comprobante ──────────────────────────────────────────────
  const handleSubirComprobante = async () => {
    const partId = participacionIdRef.current;
    if (!partId) return;
    setConfirmState('speiSubiendo');
    try {
      const url = await SpeiService.subirComprobante(partId);
      if (!url) {
        // Usuario canceló el picker
        setConfirmState('speiDatos');
        return;
      }
      setComprobanteUrl(url);
      setConfirmState('speiValidando');
      await handleValidarAutomatico(partId, url);
    } catch (e: any) {
      setErrorMsg(e.message);
      setConfirmState('error');
    }
  };

  // ─── SPEI: validar automáticamente con Edge Function validar-spei ─────────
  const handleValidarAutomatico = async (partId: string, url: string) => {
    const monto = quiniela?.precio_entrada ?? 0;
    try {
      const result = await SpeiService.validarYConfirmar(partId, url, monto);
      setSpeiValidResult(result);
      setConfirmState('speiEnviado');
    } catch (e: any) {
      setErrorMsg(e.message);
      setConfirmState('error');
    }
  };

  // ─── Reintentar pago MP ───────────────────────────────────────────────────
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

  const totalSeleccionados    = Object.keys(selecciones).length;
  const isComplete            = totalSeleccionados === partidos.length && partidos.length > 0;
  const puedeEditar           = yaParticipo && quiniela?.estado === 'abierta';
  const golesPredichosTotales = Object.values(selecciones).reduce(
    (acc, s) => acc + (s.golesLocal ?? 0) + (s.golesVisitante ?? 0), 0
  );
  const clabe = process.env.EXPO_PUBLIC_CLABE_DESTINO ?? 'CLABE no configurada';
  const monto = quiniela?.precio_entrada ?? 0;

  // ─── Loading ──────────────────────────────────────────────────────────────
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

  // ─── Éxito pago ──────────────────────────────────────────────────────────
  if (confirmState === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>🎉</Text>
          <Text style={styles.successTitle}>¡Listo, ya estás dentro!</Text>
          <Text style={styles.successSub}>
            Tus picks fueron guardados y tu participación está confirmada.
          </Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => router.replace('/results')}>
            <Text style={styles.successBtnTxt}>Ver mis quinielas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── SPEI enviado — esperando revisión ────────────────────────────────────
  if (confirmState === 'speiEnviado') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 60, marginBottom: 16 }}>📨</Text>
          <Text style={styles.successTitle}>Comprobante recibido</Text>
          <Text style={styles.successSub}>
            Revisaremos tu transferencia y te notificaremos cuando se confirme tu participación.
          </Text>
          <View style={styles.speiEnviadoCard}>
            <Text style={styles.speiEnviadoRow}>⏱ Tiempo estimado de revisión</Text>
            <Text style={styles.speiEnviadoVal}>15 – 60 minutos</Text>
            <Text style={[styles.speiEnviadoRow, { marginTop: 12 }]}>📩 Recibirás una notificación cuando</Text>
            <Text style={styles.speiEnviadoVal}>tu pago sea validado o rechazado</Text>
          </View>
          <TouchableOpacity style={styles.successBtn} onPress={() => router.replace('/')}>
            <Text style={styles.successBtnTxt}>Ir al inicio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/results')}>
            <Text style={styles.cancelBtnTxt}>Ver mis quinielas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Éxito edición ───────────────────────────────────────────────────────
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

  // ─── Error ────────────────────────────────────────────────────────────────
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

  // ─── Confirmar edición ───────────────────────────────────────────────────
  if (confirmState === 'confirmingEdit') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>📝</Text>
          <Text style={styles.successTitle}>Confirmar cambios</Text>
          <Text style={styles.successSub}>Se guardarán tus picks actualizados.</Text>
          <View style={styles.desempateSummary}>
            <Text style={styles.desempateLabel}>🎯 Tus goles totales predichos</Text>
            <Text style={styles.desempateValue}>{golesPredichosTotales}</Text>
            <Text style={styles.desempateHint}>
              En caso de empate en aciertos, quien más se acerque al total de goles reales gana.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.successBtn, saving && styles.btnDisabled]}
            onPress={handleGuardarEdicion}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.successBtnTxt}>Guardar cambios</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmState('idle')} disabled={saving}>
            <Text style={styles.cancelBtnTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── SELECTOR DE MÉTODO DE PAGO ──────────────────────────────────────────
  if (confirmState === 'choosingPayment') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={styles.centered}>

            <Text style={styles.payTitle}>¿Cómo quieres pagar?</Text>
            <Text style={styles.paySub}>Entrada: <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>${monto} MXN</Text></Text>

            {/* Resumen desempate */}
            <View style={styles.desempateSummary}>
              <Text style={styles.desempateLabel}>🎯 Goles totales predichos</Text>
              <Text style={styles.desempateValue}>{golesPredichosTotales}</Text>
              <Text style={styles.desempateHint}>
                En caso de empate en aciertos, quien más se acerque al total de goles reales gana.
              </Text>
            </View>

            {/* Opción MP */}
            <TouchableOpacity
              style={[styles.payOptionCard, metodoPago === 'mp' && styles.payOptionCardActive]}
              onPress={() => setMetodoPago('mp')}
              activeOpacity={0.8}
            >
              <View style={styles.payOptionRow}>
                <View style={styles.payOptionIconWrap}>
                  <Text style={styles.payOptionIcon}>💳</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payOptionTitle}>Mercado Pago</Text>
                  <Text style={styles.payOptionDesc}>Tarjeta, OXXO, saldo MP — pago instantáneo</Text>
                </View>
                <View style={[styles.radioOuter, metodoPago === 'mp' && styles.radioOuterActive]}>
                  {metodoPago === 'mp' && <View style={styles.radioInner} />}
                </View>
              </View>
              {metodoPago === 'mp' && (
                <View style={styles.payOptionDetail}>
                  <Text style={styles.payOptionDetailTxt}>✅ Confirmación automática al pagar</Text>
                  <Text style={styles.payOptionDetailTxt}>✅ Acepta tarjeta, débito, OXXO</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Opción SPEI */}
            <TouchableOpacity
              style={[styles.payOptionCard, metodoPago === 'spei' && styles.payOptionCardActive]}
              onPress={() => setMetodoPago('spei')}
              activeOpacity={0.8}
            >
              <View style={styles.payOptionRow}>
                <View style={styles.payOptionIconWrap}>
                  <Text style={styles.payOptionIcon}>🏦</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payOptionTitle}>Transferencia SPEI</Text>
                  <Text style={styles.payOptionDesc}>Desde cualquier banco mexicano, sin comisión extra</Text>
                </View>
                <View style={[styles.radioOuter, metodoPago === 'spei' && styles.radioOuterActive]}>
                  {metodoPago === 'spei' && <View style={styles.radioInner} />}
                </View>
              </View>
              {metodoPago === 'spei' && (
                <View style={styles.payOptionDetail}>
                  <Text style={styles.payOptionDetailTxt}>✅ Sin comisión adicional</Text>
                  <Text style={styles.payOptionDetailTxt}>✅ Desde cualquier banco (BBVA, HSBC, Santander…)</Text>
                  <Text style={styles.payOptionDetailTxt}>⚡ Valida tu comprobante automáticamente</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Botón continuar */}
            <TouchableOpacity
              style={[styles.confirmBtn, saving && styles.btnDisabled]}
              onPress={metodoPago === 'mp' ? handlePagarConMP : handlePagarConSpei}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.confirmBtnTxt}>
                    {metodoPago === 'mp' ? 'Continuar con Mercado Pago →' : 'Continuar con SPEI →'}
                  </Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmState('idle')} disabled={saving}>
              <Text style={styles.cancelBtnTxt}>← Volver a mis picks</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── SPEI: datos bancarios + subir comprobante ────────────────────────────
  if (confirmState === 'speiDatos' || confirmState === 'speiSubiendo' || confirmState === 'speiValidando') {
    const subiendo  = confirmState === 'speiSubiendo';
    const validando = confirmState === 'speiValidando';
    const ocupado   = subiendo || validando;

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={styles.centered}>

            <Text style={{ fontSize: 52, marginBottom: 16 }}>🏦</Text>
            <Text style={styles.payTitle}>Paga y confirma</Text>
            <Text style={styles.paySub}>
              Realiza una transferencia SPEI por{' '}
              <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>${monto} MXN</Text>
            </Text>

            {/* Datos bancarios */}
            <View style={styles.clabeBanner}>
              <Text style={styles.clabeLabel}>CLABE Interbancaria</Text>
              <Text style={styles.clabeValue} selectable>{clabe}</Text>
              <Text style={styles.clabeHint}>
                Concepto: QPro – {id?.toString().slice(0, 8).toUpperCase()}
              </Text>
            </View>

            {/* Separador */}
            <View style={styles.spaySeparator}>
              <View style={styles.spaySeparatorLine} />
              <Text style={styles.spaySeparatorTxt}>Una vez que pagues</Text>
              <View style={styles.spaySeparatorLine} />
            </View>

            {/* Instrucción */}
            <Text style={styles.speiInstruccion}>
              Sube tu <Text style={{ color: '#E0E0E0', fontWeight: '600' }}>comprobante de transferencia</Text> (imagen o XML) para confirmar tu participación automáticamente.
            </Text>

            {/* Estado del comprobante */}
            {comprobanteUrl ? (
              <View style={styles.comprobanteOkBox}>
                <Text style={styles.comprobanteOkTxt}>✅ Comprobante subido correctamente</Text>
              </View>
            ) : null}

            {/* Botón subir comprobante */}
            {validando ? (
              <View style={styles.validandoBox}>
                <ActivityIndicator color="#2ECC71" size="large" style={{ marginBottom: 12 }} />
                <Text style={styles.validandoTxt}>Validando pago con Banxico...</Text>
                <Text style={styles.validandoSub}>Esto puede tomar unos segundos</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.speiUploadBtn, ocupado && styles.btnDisabled]}
                onPress={handleSubirComprobante}
                disabled={ocupado}
                activeOpacity={0.8}
              >
                {subiendo ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color="#000" size="small" />
                    <Text style={styles.speiUploadBtnTxt}>Subiendo...</Text>
                  </View>
                ) : (
                  <Text style={styles.speiUploadBtnTxt}>
                    {comprobanteUrl ? '🔄 Cambiar comprobante' : '📎 Subir comprobante'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <Text style={styles.speiFormatos}>
              Formatos aceptados: imagen (JPG, PNG) o XML de tu banco
            </Text>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setConfirmState('choosingPayment')}
              disabled={ocupado}
            >
              <Text style={styles.cancelBtnTxt}>← Cambiar método de pago</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── Pantalla principal ───────────────────────────────────────────────────
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
        <View style={{ width: 36 }} />
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

      {/* Banner verde + botón editar */}
      {yaParticipo && !modoEdicion && (
        <View style={styles.participandoWrap}>
          <View style={styles.participandoBanner}>
            <Text style={styles.participandoText}>
              ✅ Ya tienes picks guardados  •  🎯 {golesPredichosTotales} goles predichos
            </Text>
          </View>
          {puedeEditar && (
            <TouchableOpacity style={styles.editBtn} onPress={() => setModoEdicion(true)}>
              <Text style={styles.editBtnTxt}>✏️ Editar mis picks</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Banner pago pendiente */}
      {pagoPendiente && !modoEdicion && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingBannerText}>
            ⏳ Tu pago está pendiente. Tus picks están guardados.
          </Text>
          <TouchableOpacity style={styles.pendingBannerBtn} onPress={handleReintentarPago} disabled={retryingPago}>
            {retryingPago
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.pendingBannerBtnTxt}>Reintentar pago con MP</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Hint desempate */}
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

            {!yaParticipo && (
              <TouchableOpacity
                style={[styles.confirmBtn, !isComplete && styles.btnDisabled]}
                onPress={handleConfirmarClick}
                disabled={!isComplete}
              >
                <Text style={styles.confirmBtnTxt}>Confirmar picks y elegir pago →</Text>
              </TouchableOpacity>
            )}

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
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0A0C12' },
  centered:    { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#A0A0A0', marginTop: 12 },

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

  participandoWrap: { marginHorizontal: 16, marginTop: 12, gap: 8 },
  participandoBanner: {
    backgroundColor: '#0D2B1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A4D2E',
    padding: 12,
  },
  participandoText: { color: '#2ECC71', fontSize: 13, textAlign: 'center' },

  editBtn:    { backgroundColor: '#1E2128', borderRadius: 10, padding: 12, alignItems: 'center' },
  editBtnTxt: { color: '#E0E0E0', fontSize: 14, fontWeight: '600' },

  pendingBanner: {
    backgroundColor: '#2B1D0A', marginHorizontal: 16, marginTop: 10,
    borderRadius: 10, padding: 12, gap: 10,
    borderWidth: 1, borderColor: '#5C3A1E',
  },
  pendingBannerText:    { color: '#E0A050', fontSize: 13, textAlign: 'center' },
  pendingBannerBtn:     { backgroundColor: '#2ECC71', borderRadius: 8, padding: 10, alignItems: 'center' },
  pendingBannerBtnTxt:  { color: '#000', fontWeight: '700', fontSize: 13 },

  desempateInfoBanner: {
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    backgroundColor: '#12151F', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#1E2535',
  },
  desempateInfoText: { color: '#8090B0', fontSize: 12, lineHeight: 18 },

  list:   { paddingBottom: 32 },
  footer: { padding: 16, gap: 10 },

  faltanMsg:   { color: '#FF6B6B', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  editActions: { gap: 10 },

  confirmBtn: {
    backgroundColor: '#2ECC71', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', width: '100%',
  },
  confirmBtnTxt: { color: '#0A0C12', fontWeight: '800', fontSize: 15 },
  btnDisabled:   { opacity: 0.4 },

  cancelBtn:    { paddingVertical: 14, alignItems: 'center', width: '100%' },
  cancelBtnTxt: { color: '#606060', fontSize: 14 },

  successTitle: { color: '#E0E0E0', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  successSub:   { color: '#808080', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  successBtn: {
    backgroundColor: '#2ECC71', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 32,
    alignItems: 'center', width: '100%',
  },
  successBtnTxt: { color: '#0A0C12', fontWeight: '800', fontSize: 15 },

  desempateSummary: {
    backgroundColor: '#12151F',
    borderRadius: 12, padding: 16, width: '100%',
    marginBottom: 20, borderWidth: 1, borderColor: '#1E2535',
    alignItems: 'center',
  },
  desempateLabel: { color: '#8090B0', fontSize: 12, marginBottom: 4 },
  desempateValue: { color: '#2ECC71', fontSize: 36, fontWeight: '900', marginBottom: 8 },
  desempateHint:  { color: '#606880', fontSize: 11, textAlign: 'center', lineHeight: 16 },

  payTitle: { color: '#E0E0E0', fontSize: 22, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  paySub:   { color: '#808080', fontSize: 14, marginBottom: 20, textAlign: 'center' },

  payOptionCard: {
    width: '100%', backgroundColor: '#12151F',
    borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#1E2535',
  },
  payOptionCardActive: { borderColor: '#2ECC71', backgroundColor: '#0D1A11' },
  payOptionRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  payOptionIconWrap:   { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E2535', justifyContent: 'center', alignItems: 'center' },
  payOptionIcon:       { fontSize: 22 },
  payOptionTitle:      { color: '#E0E0E0', fontSize: 15, fontWeight: '700' },
  payOptionDesc:       { color: '#606060', fontSize: 12, marginTop: 2 },
  payOptionDetail:     { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E2535', gap: 4 },
  payOptionDetailTxt:  { color: '#60A878', fontSize: 12 },

  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#303540',
    justifyContent: 'center', alignItems: 'center',
  },
  radioOuterActive: { borderColor: '#2ECC71' },
  radioInner:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2ECC71' },

  clabeBanner: {
    width: '100%', backgroundColor: '#0D1A1B',
    borderRadius: 14, padding: 18, marginBottom: 20,
    borderWidth: 1.5, borderColor: '#1A4045',
    alignItems: 'center',
  },
  clabeLabel: { color: '#4DABB8', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' },
  clabeValue: { color: '#E0E0E0', fontSize: 20, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  clabeHint:  { color: '#406870', fontSize: 11 },

  spaySeparator:    { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 16, gap: 10 },
  spaySeparatorLine: { flex: 1, height: 1, backgroundColor: '#1E2535' },
  spaySeparatorTxt:  { color: '#404860', fontSize: 12 },

  speiInstruccion: {
    color: '#8090B0', fontSize: 13, textAlign: 'center',
    lineHeight: 20, marginBottom: 20, paddingHorizontal: 8,
  },

  speiUploadBtn: {
    width: '100%', backgroundColor: '#2ECC71',
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 8,
  },
  speiUploadBtnTxt: { color: '#0A0C12', fontWeight: '800', fontSize: 15 },

  speiFormatos: { color: '#404060', fontSize: 11, textAlign: 'center', marginBottom: 20 },

  comprobanteOkBox: {
    backgroundColor: '#0D2B1A', borderRadius: 10,
    padding: 12, width: '100%', marginBottom: 14,
    borderWidth: 1, borderColor: '#1A4D2E', alignItems: 'center',
  },
  comprobanteOkTxt: { color: '#2ECC71', fontSize: 13, fontWeight: '600' },

  validandoBox: {
    width: '100%', alignItems: 'center',
    backgroundColor: '#0D1220', borderRadius: 14,
    padding: 24, marginBottom: 16,
    borderWidth: 1, borderColor: '#1E2535',
  },
  validandoTxt: { color: '#E0E0E0', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  validandoSub: { color: '#606080', fontSize: 12 },

  speiEnviadoCard: {
    width: '100%', backgroundColor: '#12151F',
    borderRadius: 14, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: '#1E2535',
  },
  speiEnviadoRow: { color: '#808098', fontSize: 12, textAlign: 'center' },
  speiEnviadoVal: { color: '#E0E0E0', fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
});
