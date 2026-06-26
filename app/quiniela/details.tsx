import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  TouchableOpacity, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import ProgressBar from '../../src/components/ProgressBar';
import MatchSelectionCard from '../../src/components/MatchSelectionCard';
import { QuinielasService } from '../../src/services/quinielas.service';
import { supabase } from '../../src/config/supabase';

type ConfirmState = 'idle' | 'confirming' | 'success' | 'error';

export default function QuinielaDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [quiniela, setQuiniela] = useState<any>(null);
  const [partidos, setPartidos] = useState<any[]>([]);
  const [selecciones, setSelecciones] = useState<Record<string, 'local' | 'empate' | 'visitante'>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [yaParticipo, setYaParticipo] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [faltanMsg, setFaltanMsg] = useState('');

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
        } catch (e: any) {
          setErrorMsg(e.message);
          setConfirmState('error');
        } finally {
          setLoading(false);
        }
      }
      loadData();
    }, [id])
  );

  const handleSelect = (partidoId: string, opcion: 'local' | 'empate' | 'visitante') => {
    if (yaParticipo) return;
    setSelecciones(prev => ({ ...prev, [partidoId]: opcion }));
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
      await QuinielasService.guardarSelecciones(id, selecciones);
      setConfirmState('success');
    } catch (e: any) {
      setErrorMsg(e.message);
      setConfirmState('error');
    } finally {
      setSaving(false);
    }
  };

  const totalSeleccionados = Object.keys(selecciones).length;
  const isComplete = totalSeleccionados === partidos.length && partidos.length > 0;

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

  // Pantalla de éxito
  if (confirmState === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>🍀</Text>
          <Text style={styles.successTitle}>¡Selecciones guardadas!</Text>
          <Text style={styles.successSub}>Buena suerte en la quiniela</Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.successBtnTxt}>Ver mis quinielas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Pantalla de error
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

  // Pantalla de confirmacion
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
              Una vez confirmada no podrás cambiar tus selecciones.
            </Text>
          </View>
          <View style={styles.confirmBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmState('idle')} disabled={saving}>
              <Text style={styles.cancelBtnTxt}>Revisar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmarFinal} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.confirmBtnTxt}>Confirmar ${quiniela?.precio_entrada ?? 50}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{quiniela?.titulo ?? 'Quiniela'}</Text>
        <View style={styles.spacer} />
      </View>

      {yaParticipo && (
        <View style={styles.yaParticipoBar}>
          <Text style={styles.yaParticipoText}>✅ Ya registraste tus selecciones — ¡Buena suerte!</Text>
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

      <ProgressBar current={totalSeleccionados} total={partidos.length} />

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

      {!yaParticipo && (
        <View style={styles.fab}>
          <TouchableOpacity
            style={[styles.fabBtn, isComplete ? styles.fabBtnActive : styles.fabBtnDisabled]}
            onPress={handleConfirmarClick}
            disabled={saving}
          >
            <Text style={[styles.fabText, !isComplete && { color: '#505050' }]}>
              {isComplete
                ? `🚀 Confirmar y Participar — $${quiniela?.precio_entrada ?? 50} MXN`
                : `Selecciona todos los partidos (${totalSeleccionados}/${partidos.length})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0A0C10' },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText:     { color: '#A0A0A0', marginTop: 12, fontSize: 14 },
  emptyText:       { color: '#A0A0A0', fontSize: 14, textAlign: 'center' },

  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backBtn:         { width: 60 },
  backText:        { color: '#2ECC71', fontSize: 15 },
  title:           { flex: 1, color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  spacer:          { width: 60 },

  yaParticipoBar:  { backgroundColor: 'rgba(46,204,113,0.1)', borderBottomWidth: 1, borderBottomColor: '#2ECC71', padding: 10, alignItems: 'center' },
  yaParticipoText: { color: '#2ECC71', fontWeight: 'bold', fontSize: 13 },

  infoRow:         { flexDirection: 'row', gap: 8, paddingHorizontal: 15, paddingVertical: 10 },
  infoPill:        { flex: 1, backgroundColor: '#15181F', borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35' },
  infoPillGreen:   { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.05)' },
  infoPillOrange:  { borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.05)' },
  infoPillText:    { color: '#A0A0A0', fontSize: 11, fontWeight: '600', textAlign: 'center' },

  faltanBanner:    { backgroundColor: 'rgba(231,76,60,0.12)', borderBottomWidth: 1, borderBottomColor: '#E74C3C', padding: 10, alignItems: 'center' },
  faltanTxt:       { color: '#E74C3C', fontWeight: '600', fontSize: 13 },

  list:            { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 120 },
  fab:             { position: 'absolute', bottom: 25, left: 15, right: 15, zIndex: 100 },
  fabBtn:          { padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  fabBtnActive:    { backgroundColor: '#2ECC71', borderColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.7, shadowRadius: 12, elevation: 8 },
  fabBtnDisabled:  { backgroundColor: '#15181F', borderColor: '#2A2D35' },
  fabText:         { color: '#000', fontWeight: 'bold', fontSize: 15 },

  // Pantalla confirmacion
  confirmTitle:    { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  confirmCard:     { backgroundColor: '#15181F', borderRadius: 16, padding: 20, width: '100%', borderWidth: 1, borderColor: '#2A2D35', gap: 10, marginBottom: 24 },
  confirmLine:     { color: '#A0A0A0', fontSize: 14, lineHeight: 22 },
  confirmBtns:     { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn:       { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35' },
  cancelBtnTxt:    { color: '#A0A0A0', fontWeight: 'bold', fontSize: 15 },
  confirmBtn:      { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#2ECC71' },
  confirmBtnTxt:   { color: '#000', fontWeight: 'bold', fontSize: 15 },

  // Pantalla exito
  successTitle:    { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  successSub:      { color: '#A0A0A0', fontSize: 14, marginBottom: 32, textAlign: 'center' },
  successBtn:      { backgroundColor: '#2ECC71', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  successBtnTxt:   { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
