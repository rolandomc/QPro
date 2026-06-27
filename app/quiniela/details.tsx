import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  TouchableOpacity, FlatList, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import ProgressBar from '../../src/components/ProgressBar';
import MatchSelectionCard from '../../src/components/MatchSelectionCard';
import { QuinielasService } from '../../src/services/quinielas.service';
import { MercadoPagoService } from '../../src/services/mercadopago.service';
import { supabase } from '../../src/config/supabase';

type ConfirmState = 'idle' | 'confirming' | 'confirmingEdit' | 'success' | 'successEdit' | 'error';

export default function QuinielaDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [quiniela,        setQuiniela]        = useState<any>(null);
  const [partidos,        setPartidos]        = useState<any[]>([]);
  const [selecciones,     setSelecciones]     = useState<Record<string, 'local' | 'empate' | 'visitante'>>({});
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [yaParticipo,     setYaParticipo]     = useState(false);
  const [modoEdicion,     setModoEdicion]     = useState(false);
  const [participacionId, setParticipacionId] = useState<string | null>(null);
  const [confirmState,    setConfirmState]    = useState<ConfirmState>('idle');
  const [errorMsg,        setErrorMsg]        = useState('');
  const [faltanMsg,       setFaltanMsg]       = useState('');

  const picksOriginalesRef = useRef<Record<string, 'local' | 'empate' | 'visitante'>>({});

  const cargarPicksActuales = useCallback(async (partId: string) => {
    const { data: sels } = await supabase
      .from('selecciones')
      .select('partido_id, prediccion')
      .eq('participacion_id', partId);
    const map: Record<string, any> = {};
    (sels || []).forEach((s: any) => { map[s.partido_id] = s.prediccion; });
    picksOriginalesRef.current = map;
    setSelecciones(map);
    return map;
  }, []);

  useFocusEffect(
    useCallback(() => {
      async function loadData() {
        if (!id) return;
        setLoading(true);
        try {
          const [partidosData, yaParticipoData, { data: quinielaData }] = await Promise.all([
            QuinielasService.getPartidos(id),
            QuinielasService.yaParticipo(id),
            supabase.from('quinielas').select('*').eq('id', id).single(),
          ]);
          setQuiniela(quinielaData);
          setPartidos(partidosData || []);
          setYaParticipo(yaParticipoData);

          if (yaParticipoData && quinielaData?.estado === 'abierta') {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: part } = await supabase
                .from('participaciones')
                .select('id')
                .eq('quiniela_id', id)
                .eq('user_id', user.id)
                .single();
              if (part) {
                setParticipacionId(part.id);
                await cargarPicksActuales(part.id);
              }
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

  const handleSelect = (partidoId: string, opcion: 'local' | 'empate' | 'visitante') => {
    if (yaParticipo && !modoEdicion) return;
    setSelecciones(prev => ({ ...prev, [partidoId]: opcion }));
  };

  const handleCancelarEdicion = useCallback(async () => {
    setModoEdicion(false);
    setFaltanMsg('');
    if (participacionId) {
      setSelecciones({ ...picksOriginalesRef.current });
    }
  }, [participacionId]);

  const handleGuardarEdicion = async () => {
    if (!participacionId) return;
    setSaving(true);
    try {
      const rows = Object.entries(selecciones).map(([partido_id, prediccion]) => ({
        participacion_id: participacionId,
        partido_id,
        prediccion,
      }));
      const { error } = await supabase
        .from('selecciones')
        .upsert(rows, { onConflict: 'participacion_id,partido_id' });
      if (error) throw error;
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
    const sinSeleccionar = partidos.filter(p => !selecciones[p.id]);
    if (sinSeleccionar.length > 0) {
      setFaltanMsg(`⚠️ Aún te faltan ${sinSeleccionar.length} partido(s) por seleccionar.`);
      return;
    }
    setFaltanMsg('');
    setConfirmState('confirmingEdit');
  };

  const handleConfirmarClick = () => {
    if (yaParticipo) return;
    const sinSeleccionar = partidos.filter(p => !selecciones[p.id]);
    if (sinSeleccionar.length > 0) {
      setFaltanMsg(`⚠️ Aún te faltan ${sinSeleccionar.length} partido(s) por seleccionar.`);
      return;
    }
    setFaltanMsg('');
    setConfirmState('confirming');
  };

  const handleConfirmarFinal = async () => {
    setSaving(true);
    try {
      // 1. Guardar selecciones
      const participacion = await QuinielasService.guardarSelecciones(id, selecciones);
      const partId = participacion.id ?? participacionId;

      // 2. Crear preferencia MP
      const { init_point } = await MercadoPagoService.crearPreferencia(
        partId!,
        id as string
      );

      // 3. Mostrar pantalla de exito ANTES de abrir MP
      //    (en iOS Linking es fire-and-forget, no bloquea)
      setConfirmState('success');

      // 4. Abrir MP: Linking funciona en iOS nativo, iOS Safari y Android
      await Linking.openURL(init_point);
    } catch (e: any) {
      setErrorMsg(e.message);
      setConfirmState('error');
    } finally {
      setSaving(false);
    }
  };

  const totalSeleccionados = Object.keys(selecciones).length;
  const isComplete = totalSeleccionados === partidos.length && partidos.length > 0;
  const puedeEditar = yaParticipo && quiniela?.estado === 'abierta';

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

  if (confirmState === 'successEdit') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>✏️</Text>
          <Text style={styles.successTitle}>¡Picks actualizados!</Text>
          <Text style={styles.successSub}>Tus nuevas selecciones han sido guardadas</Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => router.back()}>
            <Text style={styles.successBtnTxt}>Ver mi quiniela</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (confirmState === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>🍀</Text>
          <Text style={styles.successTitle}>¡Redirigiendo a MP!</Text>
          <Text style={styles.successSub}>
            {'Tus picks fueron guardados.\nSe abrir\u00e1 Mercado Pago para completar el pago.'}
          </Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => router.replace('/(tabs)/results')}>
            <Text style={styles.successBtnTxt}>Ver mis quinielas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (confirmState === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 50, marginBottom: 20 }}>❌</Text>
          <Text style={styles.successTitle}>Algo salió mal</Text>
          <Text style={styles.successSub}>{errorMsg}</Text>
          <TouchableOpacity style={[styles.successBtn, { backgroundColor: '#E74C3C' }]} onPress={() => setConfirmState('idle')}>
            <Text style={styles.successBtnTxt}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (confirmState === 'confirmingEdit') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 50, marginBottom: 16 }}>✏️</Text>
          <Text style={styles.confirmTitle}>Actualizar Picks</Text>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmLine}>🏆 Quiniela: <Text style={{ color: '#FFF' }}>{quiniela?.titulo}</Text></Text>
            <Text style={styles.confirmLine}>🎯 Picks: <Text style={{ color: '#00E5FF' }}>{totalSeleccionados} selecciones</Text></Text>
            <Text style={[styles.confirmLine, { color: '#F39C12', fontSize: 12, marginTop: 8 }]}>
              ⚠️ Tus picks anteriores serán reemplazados por los nuevos.
            </Text>
          </View>
          <View style={styles.confirmBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmState('idle')} disabled={saving}>
              <Text style={styles.cancelBtnTxt}>Revisar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#F39C12' }]} onPress={handleGuardarEdicion} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.confirmBtnTxt}>Guardar cambios</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (confirmState === 'confirming') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 50, marginBottom: 16 }}>🎉</Text>
          <Text style={styles.confirmTitle}>Confirmar Participación</Text>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmLine}>🏆 Quiniela: <Text style={{ color: '#FFF' }}>{quiniela?.titulo}</Text></Text>
            <Text style={styles.confirmLine}>💰 Costo: <Text style={{ color: '#2ECC71' }}>${quiniela?.precio_entrada ?? 50} MXN</Text></Text>
            <Text style={styles.confirmLine}>🎯 Picks: <Text style={{ color: '#00E5FF' }}>{totalSeleccionados} selecciones</Text></Text>
            <Text style={[styles.confirmLine, { color: '#606060', fontSize: 11, marginTop: 8 }]}>
              Serás redirigido a Mercado Pago para completar el pago.
            </Text>
          </View>
          <View style={styles.confirmBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmState('idle')} disabled={saving}>
              <Text style={styles.cancelBtnTxt}>Revisar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmarFinal} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.confirmBtnTxt}>💳 Ir a pagar ${quiniela?.precio_entrada ?? 50}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (modoEdicion) {
              Alert.alert('¿Cancelar edición?', 'Perderás los cambios no guardados.', [
                { text: 'Seguir editando', style: 'cancel' },
                { text: 'Cancelar', style: 'destructive', onPress: () => { handleCancelarEdicion(); router.back(); } },
              ]);
            } else {
              router.back();
            }
          }}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{quiniela?.titulo ?? 'Quiniela'}</Text>

        {puedeEditar && !modoEdicion && (
          <TouchableOpacity style={styles.editBtn} onPress={() => setModoEdicion(true)}>
            <Text style={styles.editBtnTxt}>✏️ Editar</Text>
          </TouchableOpacity>
        )}
        {modoEdicion && (
          <TouchableOpacity
            style={styles.cancelEditBtn}
            onPress={() => {
              Alert.alert('¿Cancelar edición?', 'Perderás los cambios no guardados.', [
                { text: 'Seguir editando', style: 'cancel' },
                { text: 'Cancelar', style: 'destructive', onPress: handleCancelarEdicion },
              ]);
            }}
          >
            <Text style={styles.cancelEditBtnTxt}>✕ Cancelar</Text>
          </TouchableOpacity>
        )}
        {!puedeEditar && <View style={styles.spacer} />}
      </View>

      {yaParticipo && !modoEdicion && (
        <View style={puedeEditar ? styles.editableBanner : styles.yaParticipoBar}>
          <Text style={puedeEditar ? styles.editableBannerText : styles.yaParticipoText}>
            {puedeEditar
              ? '✏️ Quiniela abierta — puedes editar tus picks'
              : '✅ Ya registraste tus selecciones — ¡Buena suerte!'}
          </Text>
        </View>
      )}
      {modoEdicion && (
        <View style={styles.editingBanner}>
          <Text style={styles.editingBannerText}>🟡 Modo edición — cambia tus picks y guarda</Text>
        </View>
      )}

      <View style={styles.infoRow}>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>🏀 {partidos.length} partidos</Text>
        </View>
        <View style={[styles.infoPill, styles.infoPillGreen]}>
          <Text style={[styles.infoPillText, { color: '#2ECC71' }]}>💰 ${quiniela?.precio_entrada ?? 50} MXN</Text>
        </View>
        <View style={[styles.infoPill, styles.infoPillOrange]}>
          <Text style={[styles.infoPillText, { color: '#F39C12' }]}>🏆 Premio por definir</Text>
        </View>
      </View>

      {(modoEdicion || !yaParticipo) && (
        <ProgressBar current={totalSeleccionados} total={partidos.length} />
      )}

      {faltanMsg ? (
        <View style={styles.faltanBanner}>
          <Text style={styles.faltanTxt}>{faltanMsg}</Text>
        </View>
      ) : null}

      <FlatList
        data={partidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Esta quiniela no tiene partidos cargados.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <MatchSelectionCard
            partido={item}
            index={index}
            seleccionActual={selecciones[item.id] ?? null}
            onSelect={(opcion) => handleSelect(item.id, opcion)}
          />
        )}
      />

      {modoEdicion && (
        <View style={styles.fab}>
          <TouchableOpacity
            style={[styles.fabBtn, isComplete ? styles.fabBtnEdit : styles.fabBtnDisabled]}
            onPress={handleConfirmarEdicionClick}
            disabled={saving || !isComplete}
          >
            <Text style={[styles.fabText, !isComplete && { color: '#505050' }]}>
              {isComplete ? '💾 Guardar nuevos picks' : `Selecciona todos (${totalSeleccionados}/${partidos.length})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!yaParticipo && (
        <View style={styles.fab}>
          <TouchableOpacity
            style={[styles.fabBtn, isComplete ? styles.fabBtnActive : styles.fabBtnDisabled]}
            onPress={handleConfirmarClick}
            disabled={saving}
          >
            <Text style={[styles.fabText, !isComplete && { color: '#505050' }]}>
              {isComplete
                ? `💳 Confirmar y Pagar — $${quiniela?.precio_entrada ?? 50} MXN`
                : `Selecciona todos los partidos (${totalSeleccionados}/${partidos.length})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0A0C10' },
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText:        { color: '#A0A0A0', marginTop: 12, fontSize: 14 },
  emptyText:          { color: '#A0A0A0', fontSize: 14, textAlign: 'center' },
  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backBtn:            { width: 60 },
  backText:           { color: '#2ECC71', fontSize: 15 },
  title:              { flex: 1, color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  spacer:             { width: 60 },
  editBtn:            { backgroundColor: 'rgba(243,156,18,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#F39C12' },
  editBtnTxt:         { color: '#F39C12', fontWeight: 'bold', fontSize: 13 },
  cancelEditBtn:      { backgroundColor: 'rgba(231,76,60,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E74C3C' },
  cancelEditBtnTxt:   { color: '#E74C3C', fontWeight: 'bold', fontSize: 13 },
  yaParticipoBar:     { backgroundColor: 'rgba(46,204,113,0.1)', borderBottomWidth: 1, borderBottomColor: '#2ECC71', padding: 10, alignItems: 'center' },
  yaParticipoText:    { color: '#2ECC71', fontWeight: 'bold', fontSize: 13 },
  editableBanner:     { backgroundColor: 'rgba(243,156,18,0.08)', borderBottomWidth: 1, borderBottomColor: '#F39C12', padding: 10, alignItems: 'center' },
  editableBannerText: { color: '#F39C12', fontWeight: 'bold', fontSize: 13 },
  editingBanner:      { backgroundColor: 'rgba(243,156,18,0.15)', borderBottomWidth: 1, borderBottomColor: '#F39C12', padding: 10, alignItems: 'center' },
  editingBannerText:  { color: '#FFD700', fontWeight: 'bold', fontSize: 13 },
  infoRow:            { flexDirection: 'row', gap: 8, paddingHorizontal: 15, paddingVertical: 10 },
  infoPill:           { flex: 1, backgroundColor: '#15181F', borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35' },
  infoPillGreen:      { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.05)' },
  infoPillOrange:     { borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.05)' },
  infoPillText:       { color: '#A0A0A0', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  faltanBanner:       { backgroundColor: 'rgba(231,76,60,0.12)', borderBottomWidth: 1, borderBottomColor: '#E74C3C', padding: 10, alignItems: 'center' },
  faltanTxt:          { color: '#E74C3C', fontWeight: '600', fontSize: 13 },
  list:               { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 120 },
  fab:                { position: 'absolute', bottom: 25, left: 15, right: 15, zIndex: 100 },
  fabBtn:             { padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  fabBtnActive:       { backgroundColor: '#2ECC71', borderColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.7, shadowRadius: 12, elevation: 8 },
  fabBtnEdit:         { backgroundColor: '#F39C12', borderColor: '#F39C12', shadowColor: '#F39C12', shadowOpacity: 0.7, shadowRadius: 12, elevation: 8 },
  fabBtnDisabled:     { backgroundColor: '#15181F', borderColor: '#2A2D35' },
  fabText:            { color: '#000', fontWeight: 'bold', fontSize: 15 },
  confirmTitle:       { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  confirmCard:        { backgroundColor: '#15181F', borderRadius: 16, padding: 20, width: '100%', borderWidth: 1, borderColor: '#2A2D35', gap: 10, marginBottom: 24 },
  confirmLine:        { color: '#A0A0A0', fontSize: 14, lineHeight: 22 },
  confirmBtns:        { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn:          { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35' },
  cancelBtnTxt:       { color: '#A0A0A0', fontWeight: 'bold', fontSize: 15 },
  confirmBtn:         { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#2ECC71' },
  confirmBtnTxt:      { color: '#000', fontWeight: 'bold', fontSize: 15 },
  successTitle:       { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  successSub:         { color: '#A0A0A0', fontSize: 14, marginBottom: 32, textAlign: 'center', lineHeight: 22 },
  successBtn:         { backgroundColor: '#2ECC71', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  successBtnTxt:      { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
