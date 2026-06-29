/**
 * Pantalla de pago por SPEI
 *
 * Flujo:
 *  1. Muestra los datos bancarios (CLABE, banco, titular)
 *  2. Usuario sube el comprobante (imagen)
 *  3. Ingresa opcionalmente la clave de rastreo
 *  4. Si tiene clave → valida con apiCEP automáticamente
 *     Si no tiene clave → queda en revisión manual (admin lo aprueba)
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Image, Clipboard, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SpeiService } from '../../src/services/spei.service';

// ─── Tipo de estado de la pantalla ──────────────────────────────────────────
type PantallaEstado =
  | 'instrucciones'   // paso 1: muestra datos bancarios
  | 'comprobante'     // paso 2: sube imagen + clave rastreo
  | 'validando'       // cargando: consultando apiCEP
  | 'exito'           // pago validado automáticamente
  | 'pendiente'       // sin clave rastreo, queda para revisión manual
  | 'error';          // clave rastreo inválida

export default function PagoSPEI() {
  const router    = useRouter();
  const { participacion_id, monto, quiniela_id } = useLocalSearchParams<{
    participacion_id: string;
    monto: string;
    quiniela_id: string;
  }>();

  const [estado, setEstado]             = useState<PantallaEstado>('instrucciones');
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [claveRastreo, setClaveRastreo] = useState('');
  const [errorMsg, setErrorMsg]         = useState('');
  const [subiendoImg, setSubiendoImg]   = useState(false);

  const montoNum = parseFloat(monto ?? '0');

  // ─── Paso 1 → 2: Registrar intención y avanzar ──────────────────────────
  const irASubirComprobante = useCallback(async () => {
    try {
      await SpeiService.registrarIntencionSPEI(participacion_id);
      setEstado('comprobante');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }, [participacion_id]);

  // ─── Subir imagen desde galería ─────────────────────────────────────────
  const seleccionarImagen = useCallback(async () => {
    try {
      setSubiendoImg(true);
      const url = await SpeiService.subirComprobante(participacion_id);
      if (url) setComprobanteUrl(url);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubiendoImg(false);
    }
  }, [participacion_id]);

  // ─── Paso 2 → validar / pendiente ────────────────────────────────────────
  const enviarComprobante = useCallback(async () => {
    if (!comprobanteUrl) {
      Alert.alert('Falta el comprobante', 'Por favor sube la imagen de tu transferencia.');
      return;
    }

    const clave = claveRastreo.trim();

    if (!clave) {
      // Sin clave → revisión manual
      try {
        await SpeiService.marcarPendienteRevision(participacion_id);
        setEstado('pendiente');
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
      return;
    }

    // Con clave → validar con apiCEP
    setEstado('validando');
    try {
      const result = await SpeiService.validarYConfirmar(participacion_id, clave, montoNum);
      if (result.valid) {
        setEstado('exito');
      } else {
        setErrorMsg(result.errorMsg ?? 'Comprobante inválido');
        setEstado('error');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
      setEstado('error');
    }
  }, [comprobanteUrl, claveRastreo, participacion_id, montoNum]);

  const copiarCLABE = useCallback(() => {
    const clabe = process.env.EXPO_PUBLIC_CLABE_DESTINO ?? '';
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(clabe);
    } else {
      Clipboard.setString(clabe);
    }
    Alert.alert('Copiado', 'CLABE copiada al portapapeles');
  }, []);

  // ────────────────────────────────────────────────────────────────────────
  //  RENDER ESTADOS FINALES
  // ────────────────────────────────────────────────────────────────────────

  if (estado === 'validando') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centrado}>
          <ActivityIndicator size="large" color="#00E5FF" />
          <Text style={s.validandoTxt}>Validando tu pago…</Text>
          <Text style={s.validandoSub}>Consultando Banxico vía apiCEP</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (estado === 'exito') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centrado}>
          <Text style={s.resultIcon}>✅</Text>
          <Text style={[s.resultTitulo, { color: '#2ECC71' }]}>¡Pago confirmado!</Text>
          <Text style={s.resultSub}>Tu transferencia fue validada correctamente.{`\n`}Ya puedes participar en la quiniela.</Text>
          <TouchableOpacity style={[s.btnPrimario, { backgroundColor: '#2ECC71' }]} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.btnPrimarioTxt}>Ir al inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (estado === 'pendiente') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centrado}>
          <Text style={s.resultIcon}>⏳</Text>
          <Text style={[s.resultTitulo, { color: '#F59E0B' }]}>Comprobante recibido</Text>
          <Text style={s.resultSub}>
            Tu comprobante está siendo revisado.{`\n`}Te notificaremos cuando se confirme tu participación.
          </Text>
          <TouchableOpacity style={[s.btnPrimario, { backgroundColor: '#F59E0B' }]} onPress={() => router.replace('/(tabs)')}>
            <Text style={[s.btnPrimarioTxt, { color: '#0A0C10' }]}>Ir al inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (estado === 'error') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centrado}>
          <Text style={s.resultIcon}>❌</Text>
          <Text style={[s.resultTitulo, { color: '#E91E63' }]}>No pudimos validar</Text>
          <Text style={s.resultSub}>{errorMsg}</Text>
          <TouchableOpacity
            style={[s.btnPrimario, { backgroundColor: '#E91E63', marginBottom: 12 }]}
            onPress={() => { setEstado('comprobante'); setClaveRastreo(''); }}
          >
            <Text style={s.btnPrimarioTxt}>Intentar sin clave de rastreo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnSecundario} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.btnSecundarioTxt}>Ir al inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  //  PASO 1: INSTRUCCIONES / DATOS BANCARIOS
  // ────────────────────────────────────────────────────────────────────────
  if (estado === 'instrucciones') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTit}>Pago por SPEI</Text>
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          {/* Monto */}
          <View style={s.montoCard}>
            <Text style={s.montoLbl}>MONTO A TRANSFERIR</Text>
            <Text style={s.montoVal}>${montoNum.toFixed(2)} MXN</Text>
          </View>

          {/* Datos bancarios */}
          <View style={s.card}>
            <Text style={s.cardTit}>📋 Datos de transferencia</Text>

            <DatoRow label="Banco" value="BBVA" />
            <DatoRow label="Titular" value="Rolando Martinez" />
            <DatoRow
              label="CLABE"
              value={process.env.EXPO_PUBLIC_CLABE_DESTINO ?? '—'}
              copiable
              onCopiar={copiarCLABE}
            />
            <DatoRow label="Concepto" value={`QPro - ${quiniela_id ?? ''}`} />
          </View>

          {/* Pasos */}
          <View style={s.card}>
            <Text style={s.cardTit}>📲 ¿Cómo pagar?</Text>
            {[
              'Abre tu app bancaria.',
              'Realiza una transferencia SPEI con los datos de arriba.',
              `Transfiere exactamente $${montoNum.toFixed(2)} MXN.`,
              'Guarda el comprobante (screenshot o PDF).',
              'Regresa aquí y sube el comprobante.',
            ].map((paso, i) => (
              <View key={i} style={s.pasoRow}>
                <View style={s.pasoDot}><Text style={s.pasoDotTxt}>{i + 1}</Text></View>
                <Text style={s.pasoTxt}>{paso}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.btnPrimario} onPress={irASubirComprobante}>
            <Text style={s.btnPrimarioTxt}>Ya transferí — subir comprobante →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  //  PASO 2: SUBIR COMPROBANTE
  // ────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setEstado('instrucciones')} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTit}>Subir comprobante</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Subir imagen */}
        <TouchableOpacity
          style={[s.uploadBox, comprobanteUrl && s.uploadBoxDone]}
          onPress={seleccionarImagen}
          disabled={subiendoImg}
          activeOpacity={0.75}
        >
          {subiendoImg ? (
            <ActivityIndicator size="large" color="#00E5FF" />
          ) : comprobanteUrl ? (
            <Image source={{ uri: comprobanteUrl }} style={s.previewImg} resizeMode="cover" />
          ) : (
            <>
              <Text style={s.uploadIcon}>📁</Text>
              <Text style={s.uploadTxt}>Toca para seleccionar{`\n`}tu comprobante</Text>
              <Text style={s.uploadSub}>JPG, PNG o WEBP</Text>
            </>
          )}
        </TouchableOpacity>

        {comprobanteUrl && (
          <TouchableOpacity style={s.cambiarImgBtn} onPress={seleccionarImagen}>
            <Text style={s.cambiarImgTxt}>Cambiar imagen</Text>
          </TouchableOpacity>
        )}

        {/* Clave de rastreo */}
        <View style={s.card}>
          <Text style={s.cardTit}>🔑 Clave de rastreo (opcional)</Text>
          <Text style={s.claveDesc}>
            Si tu app bancaria muestra una clave de rastreo (o SPEI key), ingrésala para validación instantánea.{`\n`}Si no la tienes, déjala vacía — revisaremos tu comprobante manualmente.
          </Text>
          <TextInput
            style={s.claveInput}
            placeholder="Ej: 2024010112345678"
            placeholderTextColor="#404060"
            value={claveRastreo}
            onChangeText={setClaveRastreo}
            keyboardType="number-pad"
            maxLength={30}
          />
        </View>

        <TouchableOpacity
          style={[s.btnPrimario, !comprobanteUrl && { opacity: 0.5 }]}
          onPress={enviarComprobante}
          disabled={!comprobanteUrl}
        >
          <Text style={s.btnPrimarioTxt}>
            {claveRastreo.trim() ? 'Validar pago automáticamente' : 'Enviar para revisión manual'}
          </Text>
        </TouchableOpacity>

        <Text style={s.aviso}>
          {claveRastreo.trim()
            ? '⚡ La validación con Banxico tarda unos segundos.'
            : '⏱ La revisión manual puede tardar hasta 24 h.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Componente auxiliar ─────────────────────────────────────────────────────
function DatoRow({ label, value, copiable, onCopiar }: {
  label: string; value: string; copiable?: boolean; onCopiar?: () => void;
}) {
  return (
    <View style={d.row}>
      <Text style={d.lbl}>{label}</Text>
      <View style={d.valWrap}>
        <Text style={d.val} selectable>{value}</Text>
        {copiable && (
          <TouchableOpacity onPress={onCopiar} style={d.copiarBtn}>
            <Text style={d.copiarTxt}>Copiar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const d = StyleSheet.create({
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E2330' },
  lbl:      { color: '#606080', fontSize: 13 },
  valWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' },
  val:      { color: '#E0E0F0', fontSize: 13, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  copiarBtn:{ backgroundColor: '#1A1D26', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#00E5FF44' },
  copiarTxt:{ color: '#00E5FF', fontSize: 12, fontWeight: '600' },
});

// ─── Estilos principales ─────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0A0C10' },
  centrado:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  scroll:        { padding: 16, paddingBottom: 48, gap: 16 },
  header:        { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E2330', gap: 12 },
  backBtn:       { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: '#15181F', borderRadius: 10, borderWidth: 1, borderColor: '#2A2D35' },
  backTxt:       { color: '#00E5FF', fontSize: 18, fontWeight: 'bold' },
  headerTit:     { color: '#FFF', fontSize: 17, fontWeight: 'bold', flex: 1 },

  montoCard:     { backgroundColor: '#0D1117', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#00E5FF33' },
  montoLbl:      { color: '#00E5FF', fontSize: 10, letterSpacing: 2, marginBottom: 6 },
  montoVal:      { color: '#FFF', fontSize: 32, fontWeight: 'bold', textShadowColor: '#00E5FF', textShadowRadius: 10 },

  card:          { backgroundColor: '#0D1117', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E2330' },
  cardTit:       { color: '#9B9BFF', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 12 },

  pasoRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  pasoDot:       { width: 22, height: 22, borderRadius: 11, backgroundColor: '#00E5FF22', borderWidth: 1, borderColor: '#00E5FF', alignItems: 'center', justifyContent: 'center' },
  pasoDotTxt:    { color: '#00E5FF', fontSize: 11, fontWeight: 'bold' },
  pasoTxt:       { color: '#C0C0D0', fontSize: 13, flex: 1, lineHeight: 20 },

  uploadBox:     { backgroundColor: '#0D1117', borderRadius: 16, borderWidth: 2, borderColor: '#1E2330', borderStyle: 'dashed', minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  uploadBoxDone: { borderColor: '#2ECC71', borderStyle: 'solid' },
  uploadIcon:    { fontSize: 36 },
  uploadTxt:     { color: '#9CA3AF', fontSize: 15, textAlign: 'center', fontWeight: '600' },
  uploadSub:     { color: '#404060', fontSize: 12 },
  previewImg:    { width: '100%', height: 200 },

  cambiarImgBtn: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#1A1D26', borderRadius: 8, borderWidth: 1, borderColor: '#2A2D35' },
  cambiarImgTxt: { color: '#9CA3AF', fontSize: 12 },

  claveDesc:     { color: '#606080', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  claveInput:    { backgroundColor: '#15181F', borderRadius: 10, borderWidth: 1, borderColor: '#2A2D35', color: '#E0E0F0', fontSize: 16, padding: 14, letterSpacing: 1 },

  btnPrimario:   { backgroundColor: '#00E5FF', borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#00E5FF', shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  btnPrimarioTxt:{ color: '#0A0C10', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 },
  btnSecundario: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35' },
  btnSecundarioTxt: { color: '#9CA3AF', fontSize: 15, fontWeight: '600' },

  aviso:         { color: '#404060', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  validandoTxt:  { color: '#00E5FF', fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  validandoSub:  { color: '#606080', fontSize: 13, textAlign: 'center' },
  resultIcon:    { fontSize: 64 },
  resultTitulo:  { fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  resultSub:     { color: '#9CA3AF', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
