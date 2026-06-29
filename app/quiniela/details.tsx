import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  TouchableOpacity, FlatList, Alert, Linking, Platform,
  TextInput, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import ProgressBar from '../../src/components/ProgressBar';
import MatchSelectionCard, { type SeleccionConGoles } from '../../src/components/MatchSelectionCard';
import { QuinielasService } from '../../src/services/quinielas.service';
import { MercadoPagoService } from '../../src/services/mercadopago.service';
import { ApiCepService } from '../../src/services/apicep.service';
import { supabase } from '../../src/config/supabase';

type MetodoPago = 'mp' | 'spei';
type ConfirmState =
  | 'idle'
  | 'choosingPayment'   // pantalla selector de método
  | 'confirmingMP'      // resumen antes de ir a MP
  | 'confirmingEdit'
  | 'speiPendiente'     // usuario ingresa clave de rastreo
  | 'validandoSpei'     // spinner mientras apiCEP valida
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
  const [errorMsg,      setErrorMsg]      = useState('');
  const [faltanMsg,     setFaltanMsg]     = useState('');
  const [retryingPago,  setRetryingPago]  = useState(false);
  const [claveRastreo,  setClaveRastreo]  = useState('');
  const [speiError,     setSpeiError]     = useState('');
  const [metodoPago,    setMetodoPago]    = useState<MetodoPago>('mp');

  const openingRef            = useRef(false);
  const picksOriginalesRef    = useRef<Record<string, SeleccionConGoles>>({});
  const participacionIdRef    = useRef<string | null>(null);

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

  // Abre pantalla de selección de método
  const handleConfirmarClick = () => {
    if (yaParticipo) return;
    const faltan = partidos.filter(p => !selecciones[p.id]);
    if (faltan.length > 0) { setFaltanMsg(`⚠️ Aún te faltan ${faltan.length} partido(s).`); return; }
    setFaltanMsg('');
    setConfirmState('choosingPayment');
  };

  // Guardar picks y luego redirigir a MP
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

  // Guardar picks con estado spei_pendiente y mostrar instrucciones
  const handlePagarConSpei = async () => {
    setSaving(true);
    try {
      const participacion = await QuinielasService.guardarSelecciones(
        id, selecciones, 'spei_pendiente'
      );
      const partId = participacion.id ?? participacionId;
      setParticipacionId(partId);
      participacionIdRef.current = partId;
      setConfirmState('speiPendiente');
    } catch (e: any) {
      setErrorMsg(e.message);
      setConfirmState('error');
    } finally {
      setSaving(false);
    }
  };

  // Validar CEP y activar participación
  const handleValidarSpei = async () => {
    if (!claveRastreo.trim()) { setSpeiError('Ingresa la clave de rastreo'); return; }
    setSpeiError('');
    setConfirmState('validandoSpei');
    try {
      const monto = quiniela?.precio_entrada ?? 0;
      const cep = await ApiCepService.validarPago(claveRastreo.trim(), monto);
      const partId = participacionIdRef.current;
      if (!partId) throw new Error('No se encontró la participación');

      // Activar participación en Supabase
      const { error } = await supabase
        .from('participaciones')
        .update({
          estado:           'pagado',
          metodo_pago:      'spei',
          clave_rastreo:    claveRastreo.trim(),
          monto_pagado:     cep.monto,
          fecha_pago:       cep.fechaOperacion,
        })
        .eq('id', partId);
      if (error) throw error;

      setConfirmState('success');
    } catch (e: any) {
      setSpeiError(e.message);
      setConfirmState('speiPendiente');
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
                  <Text style={styles.payOptionDetailTxt}>⚡ Validación automática con tu comprobante</Text>
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

  // ─── VALIDAR SPEI ─────────────────────────────────────────────────────────
  if (confirmState === 'speiPendiente' || confirmState === 'validandoSpei') {
    const validando = confirmState === 'validandoSpei';
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={styles.centered}>

            <Text style={{ fontSize: 52, marginBottom: 16 }}>🏦</Text>
            <Text style={styles.payTitle}>Paga y confirma</Text>
            <Text style={styles.paySub}>Realiza una transferencia SPEI por <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>${monto} MXN</Text> a:</Text>

            {/* Datos bancarios */}
            <View style={styles.clabeBanner}>
              <Text style={styles.clabeLabel}>CLABE Interbancaria</Text>
              <Text style={styles.clabeValue} selectable>{clabe}</Text>
              <Text style={styles.clabeHint}>Concepto: QPro - {id?.toString().slice(0, 8).toUpperCase()}</Text>
            </View>

            <View style={styles.spaySeparator}>
              <View style={styles.spaySeparatorLine} />
              <Text style={styles.spaySeparatorTxt}>Una vez que pagues</Text>
              <View style={styles.spaySeparatorLine} />
            </View>

            <Text style={styles.speiInstruccion}>
              Ingresa la <Text style={{ color: '#E0E0E0', fontWeight: '600' }}>clave de rastreo</Text> de tu comprobante para confirmar tu participación automáticamente.
            </Text>

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Clave de rastreo CEP</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. 2026062912345678"
                placeholderTextColor="#404040"
                value={claveRastreo}
                onChangeText={setClaveRastreo}
                autoCapitalize="none"
                keyboardType="default"
                editable={!validando}
              />
              {speiError ? <Text style={styles.speiErrorTxt}>{speiError}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, (validando || !claveRastreo.trim()) && styles.btnDisabled]}
              onPress={handleValidarSpei}
              disabled={validando || !claveRastreo.trim()}
            >
              {validando
                ? <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <ActivityIndicator color="#000" size="small" />
                    <Text style={styles.confirmBtnTxt}>Validando con Banxico...</Text>
                  </View>
                : <Text style={styles.confirmBtnTxt}>✓ Validar y confirmar entrada</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmState('choosingPayment')} disabled={validando}>
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
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.25)',
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  participandoText: { color: '#2ECC71', fontSize: 12, fontWeight: '500' },

  editBtn: {
    borderWidth: 1.5, borderColor: '#2ECC71', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    backgroundColor: 'rgba(46,204,113,0.06)',
  },
  editBtnTxt: { color: '#2ECC71', fontWeight: '700', fontSize: 15 },

  pendingBanner: {
    marginHorizontal: 16, marginTop: 8,
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

  desempateSummary: {
    width: '100%', backgroundColor: '#15181F',
    borderRadius: 14, padding: 18, marginVertical: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#2A2D35',
  },
  desempateLabel: { color: '#A0A0A0', fontSize: 13, marginBottom: 8 },
  desempateValue: { color: '#2ECC71', fontSize: 42, fontWeight: 'bold', marginBottom: 8 },
  desempateHint:  { color: '#505050', fontSize: 11, textAlign: 'center', lineHeight: 16 },

  list:      { padding: 16, paddingBottom: 24 },
  footer:    { marginTop: 8, gap: 10 },
  faltanMsg: { color: '#F39C12', textAlign: 'center', fontSize: 13, marginBottom: 4 },

  confirmBtn:    { backgroundColor: '#2ECC71', borderRadius: 14, paddingVertical: 16, alignItems: 'center', width: '100%' },
  confirmBtnTxt: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  btnDisabled:   { opacity: 0.35 },

  editActions:  { gap: 10 },
  cancelBtn:    { paddingVertical: 14, alignItems: 'center' },
  cancelBtnTxt: { color: '#606060', fontSize: 14 },

  successTitle:  { color: '#E0E0E0', fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  successSub:    { color: '#808080', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  successBtn:    { backgroundColor: '#2ECC71', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginBottom: 12 },
  successBtnTxt: { color: '#000', fontWeight: 'bold', fontSize: 15 },

  // ── Selector de método de pago ──────────────────────────────────────────
  payTitle: { color: '#E0E0E0', fontSize: 22, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  paySub:   { color: '#808080', fontSize: 14, textAlign: 'center', marginBottom: 4 },

  payOptionCard: {
    width: '100%', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#2A2D35',
    backgroundColor: '#13151C',
    padding: 16, marginBottom: 12,
  },
  payOptionCardActive: {
    borderColor: '#2ECC71',
    backgroundColor: 'rgba(46,204,113,0.05)',
  },
  payOptionRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  payOptionIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1E2128',
    justifyContent: 'center', alignItems: 'center',
  },
  payOptionIcon:  { fontSize: 22 },
  payOptionTitle: { color: '#E0E0E0', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  payOptionDesc:  { color: '#707070', fontSize: 12 },
  payOptionDetail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E2128', gap: 4 },
  payOptionDetailTxt: { color: '#5A9E6A', fontSize: 12 },

  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#404040',
    justifyContent: 'center', alignItems: 'center',
  },
  radioOuterActive: { borderColor: '#2ECC71' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2ECC71' },

  // ── Pantalla SPEI ───────────────────────────────────────────────────────
  clabeBanner: {
    width: '100%', backgroundColor: '#0F1117',
    borderWidth: 1, borderColor: '#2A2D35',
    borderRadius: 16, padding: 20, marginVertical: 16, alignItems: 'center',
  },
  clabeLabel: { color: '#606060', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  clabeValue: { color: '#E0E0E0', fontSize: 18, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  clabeHint:  { color: '#404040', fontSize: 11 },

  spaySeparator:    { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginVertical: 4 },
  spaySeparatorLine: { flex: 1, height: 1, backgroundColor: '#1E2128' },
  spaySeparatorTxt:  { color: '#404040', fontSize: 11 },

  speiInstruccion: { color: '#808080', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16, width: '100%' },

  inputWrap:  { width: '100%', marginBottom: 16 },
  inputLabel: { color: '#A0A0A0', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#13151C',
    borderWidth: 1, borderColor: '#2A2D35',
    borderRadius: 12, padding: 14,
    color: '#E0E0E0', fontSize: 15, letterSpacing: 0.5,
  },
  speiErrorTxt: { color: '#E74C3C', fontSize: 12, marginTop: 6 },
});
