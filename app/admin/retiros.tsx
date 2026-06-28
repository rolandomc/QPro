import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput,
  Modal, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/config/supabase';

type Filtro = 'pendiente' | 'procesado' | 'rechazado' | 'todos';

const FILTROS: { key: Filtro; label: string; emoji: string; color: string }[] = [
  { key: 'pendiente',  label: 'Pendientes', emoji: '⏳', color: '#F39C12' },
  { key: 'procesado',  label: 'Procesados', emoji: '✅', color: '#2ECC71' },
  { key: 'rechazado',  label: 'Rechazados', emoji: '❌', color: '#E74C3C' },
  { key: 'todos',      label: 'Todos',      emoji: '📋', color: '#9B59B6' },
];

const ESTADO_CFG: Record<string, { color: string; bg: string; emoji: string }> = {
  pendiente:  { color: '#F39C12', bg: 'rgba(243,156,18,0.12)',  emoji: '⏳' },
  procesado:  { color: '#2ECC71', bg: 'rgba(46,204,113,0.12)',  emoji: '✅' },
  rechazado:  { color: '#E74C3C', bg: 'rgba(231,76,60,0.12)',   emoji: '❌' },
  pagado:     { color: '#2ECC71', bg: 'rgba(46,204,113,0.12)',  emoji: '✅' },
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminRetirosScreen() {
  const router = useRouter();
  const [retiros,      setRetiros]     = useState<any[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [refreshing,   setRefreshing]  = useState(false);
  const [filtro,       setFiltro]      = useState<Filtro>('pendiente');
  const [accionando,   setAccionando]  = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [notaRechazo,  setNotaRechazo]  = useState('');
  const [retiroActivo, setRetiroActivo] = useState<any | null>(null);

  const loadRetiros = useCallback(async () => {
    try {
      let query = supabase
        .from('retiro_solicitudes')
        .select(`id, user_id, monto, metodo, clabe, alias_mp,
          estado, nota_admin, created_at, updated_at,
          profiles:user_id ( username )`)
        .order('created_at', { ascending: false });
      if (filtro !== 'todos') query = query.eq('estado', filtro);
      const { data, error } = await query;
      if (error) throw error;
      setRetiros(data ?? []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtro]);

  useFocusEffect(useCallback(() => { setLoading(true); loadRetiros(); }, [filtro]));

  const llamarEdgeFunction = async (solicitud_id: string, accion: 'pagar' | 'rechazar', nota?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No autenticado');
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/procesar-retiro`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ solicitud_id, accion, nota }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al procesar');
    return json;
  };

  const handlePagar = (retiro: any) => {
    const destino = retiro.metodo === 'spei'
      ? `CLABE: ${retiro.clabe}`
      : `Alias MP: ${retiro.alias_mp}`;
    Alert.alert(
      '💸 Confirmar pago',
      `¿Marcar como procesado el retiro de\n\n@${retiro.profiles?.username}\n$${retiro.monto} MXN\n${destino}?\n\n⚠️ Solo confirma si ya hiciste la transferencia.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, ya pagué', style: 'default', onPress: async () => {
          setAccionando(retiro.id + '_pagar');
          try {
            await llamarEdgeFunction(retiro.id, 'pagar');
            // FIX: actualizar estado local correctamente
            setRetiros(prev =>
              filtro === 'todos'
                ? prev.map(r => r.id === retiro.id ? { ...r, estado: 'procesado' } : r)
                : prev.filter(r => r.id !== retiro.id)
            );
            Alert.alert('✅ Listo', 'Retiro marcado como procesado.');
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setAccionando(null);
          }
        }},
      ]
    );
  };

  const handleRechazarAbrir = (retiro: any) => {
    setRetiroActivo(retiro);
    setNotaRechazo('');
    setModalVisible(true);
  };

  const handleRechazarConfirmar = async () => {
    if (!retiroActivo) return;
    setModalVisible(false);
    setAccionando(retiroActivo.id + '_rechazar');
    try {
      await llamarEdgeFunction(retiroActivo.id, 'rechazar', notaRechazo.trim() || undefined);
      setRetiros(prev =>
        filtro === 'todos'
          ? prev.map(r => r.id === retiroActivo.id ? { ...r, estado: 'rechazado' } : r)
          : prev.filter(r => r.id !== retiroActivo.id)
      );
      Alert.alert('Rechazado', 'Solicitud rechazada y saldo devuelto al usuario.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAccionando(null);
      setRetiroActivo(null);
    }
  };

  const pendientesCount = retiros.filter(r => r.estado === 'pendiente').length;
  const totalPendiente  = retiros.filter(r => r.estado === 'pendiente').reduce((s, r) => s + Number(r.monto), 0);
  const filtroActivo    = FILTROS.find(f => f.key === filtro)!;

  return (
    <SafeAreaView style={s.container}>

      {/* ── HEADER ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>← Volver</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Gestión de Retiros</Text>
          {pendientesCount > 0 && (
            <View style={s.badge}><Text style={s.badgeTxt}>{pendientesCount}</Text></View>
          )}
        </View>
        <TouchableOpacity onPress={() => { setRefreshing(true); loadRetiros(); }} style={s.refreshBtn}>
          <Text style={s.refreshTxt}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* ── STATS BANNER ── */}
      {filtro === 'pendiente' && pendientesCount > 0 && (
        <View style={s.statsBanner}>
          <View style={s.statBox}>
            <Text style={s.statNum}>{pendientesCount}</Text>
            <Text style={s.statLbl}>Solicitudes</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={[s.statNum, { color: '#F39C12' }]}>
              ${totalPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={s.statLbl}>Total MXN</Text>
          </View>
        </View>
      )}

      {/* ── FILTROS ── */}
      <View style={s.filtrosWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtrosRow}>
          {FILTROS.map(f => {
            const active = filtro === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[s.filtroPill, active && { borderColor: f.color, backgroundColor: `${f.color}18` }]}
                onPress={() => setFiltro(f.key)}
                activeOpacity={0.7}
              >
                <Text style={s.filtroEmoji}>{f.emoji}</Text>
                <Text style={[s.filtroTxt, active && { color: f.color, fontWeight: '700' }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── LISTA ── */}
      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color="#9B59B6" /></View>
      ) : (
        <FlatList
          data={retiros}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadRetiros(); }}
              tintColor="#9B59B6" colors={['#9B59B6']}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>
                {filtro === 'pendiente' ? '🎉' : '📭'}
              </Text>
              <Text style={s.emptyTitle}>
                {filtro === 'pendiente' ? '¡Sin pendientes!' : 'Sin registros'}
              </Text>
              <Text style={s.emptySubtitle}>
                {filtro === 'pendiente' ? 'No hay retiros por procesar' : `No hay retiros con estado "${filtroActivo.label}"`}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const cfg       = ESTADO_CFG[item.estado] ?? { color: '#FFF', bg: '#1C1F26', emoji: '💰' };
            const esPend    = item.estado === 'pendiente';
            const pagando   = accionando === item.id + '_pagar';
            const rechazando = accionando === item.id + '_rechazar';
            const ocupado   = pagando || rechazando;

            return (
              <View style={s.card}>
                {/* Franja de color según estado */}
                <View style={[s.cardAccent, { backgroundColor: cfg.color }]} />

                <View style={s.cardBody}>
                  {/* Fila 1: avatar + usuario + badge */}
                  <View style={s.row}>
                    <View style={s.avatarCircle}>
                      <Text style={s.avatarTxt}>
                        {(item.profiles?.username ?? 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardUser}>@{item.profiles?.username ?? 'usuario'}</Text>
                      <Text style={s.cardFecha}>{formatFecha(item.created_at)}</Text>
                    </View>
                    <View style={[s.estadoBadge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                      <Text style={[s.estadoTxt, { color: cfg.color }]}>{cfg.emoji} {item.estado.toUpperCase()}</Text>
                    </View>
                  </View>

                  {/* Fila 2: monto + método */}
                  <View style={[s.row, { marginTop: 14, alignItems: 'flex-end' }]}>
                    <Text style={s.monto}>${Number(item.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Text>
                    <Text style={s.montoMxn}> MXN</Text>
                    <View style={{ flex: 1 }} />
                    <View style={[s.metodoBadge, item.metodo === 'spei' ? s.metodoBadgeSPEI : s.metodoBadgeMP]}>
                      <Text style={[s.metodoTxt, item.metodo === 'spei' ? { color: '#3498DB' } : { color: '#00B1EA' }]}>
                        {item.metodo === 'spei' ? '🏦 SPEI' : '💳 MP'}
                      </Text>
                    </View>
                  </View>

                  {/* Destino copiable */}
                  <View style={s.destinoBox}>
                    <Text style={s.destinoLabel}>
                      {item.metodo === 'spei' ? 'CLABE' : 'Alias / CVU'}
                    </Text>
                    <Text style={s.destinoVal} selectable numberOfLines={1}>
                      {item.metodo === 'spei' ? item.clabe : item.alias_mp}
                    </Text>
                  </View>

                  {/* Nota admin */}
                  {item.nota_admin ? (
                    <View style={s.notaBox}>
                      <Text style={s.notaLabel}>📝 Nota</Text>
                      <Text style={s.notaVal}>{item.nota_admin}</Text>
                    </View>
                  ) : null}

                  {/* Acciones solo pendientes */}
                  {esPend && (
                    <View style={s.acciones}>
                      <TouchableOpacity
                        style={[s.btnRechazar, ocupado && s.btnDisabled]}
                        onPress={() => handleRechazarAbrir(item)}
                        disabled={ocupado}
                        activeOpacity={0.7}
                      >
                        {rechazando
                          ? <ActivityIndicator color="#E74C3C" size="small" />
                          : <Text style={s.btnRechazarTxt}>✕ Rechazar</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.btnPagar, ocupado && s.btnDisabled]}
                        onPress={() => handlePagar(item)}
                        disabled={ocupado}
                        activeOpacity={0.7}
                      >
                        {pagando
                          ? <ActivityIndicator color="#000" size="small" />
                          : <Text style={s.btnPagarTxt}>✓ Ya pagué</Text>}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ── MODAL RECHAZO ── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={s.overlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={s.modalCard}>
                  <View style={s.modalHandle} />
                  <Text style={s.modalTitle}>Rechazar solicitud</Text>
                  <View style={s.modalInfoRow}>
                    <View style={s.modalAvatarCircle}>
                      <Text style={s.modalAvatarTxt}>
                        {(retiroActivo?.profiles?.username ?? 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={s.modalUser}>@{retiroActivo?.profiles?.username}</Text>
                      <Text style={s.modalMonto}>${Number(retiroActivo?.monto ?? 0).toFixed(2)} MXN</Text>
                    </View>
                  </View>
                  <Text style={s.inputLabel}>Motivo del rechazo (opcional)</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Ej. Datos incorrectos, intenta de nuevo…"
                    placeholderTextColor="#404040"
                    value={notaRechazo}
                    onChangeText={setNotaRechazo}
                    multiline
                    numberOfLines={3}
                  />
                  <Text style={s.modalNota}>⚠️ El saldo será devuelto automáticamente al usuario.</Text>
                  <View style={s.modalBtns}>
                    <TouchableOpacity style={s.modalCancelBtn} onPress={() => setModalVisible(false)}>
                      <Text style={s.modalCancelTxt}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.modalConfirmBtn} onPress={handleRechazarConfirmar}>
                      <Text style={s.modalConfirmTxt}>Confirmar rechazo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#080A0F' },
  centered:         { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1E2128' },
  backBtn:          { width: 56 },
  backTxt:          { color: '#9B59B6', fontSize: 15, fontWeight: '600' },
  headerCenter:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:      { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
  badge:            { backgroundColor: '#F39C12', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt:         { color: '#000', fontSize: 11, fontWeight: 'bold' },
  refreshBtn:       { width: 56, alignItems: 'flex-end' },
  refreshTxt:       { color: '#606060', fontSize: 22 },

  statsBanner:      { flexDirection: 'row', backgroundColor: '#0F1116', borderBottomWidth: 1, borderBottomColor: '#1E2128', paddingVertical: 14 },
  statBox:          { flex: 1, alignItems: 'center' },
  statNum:          { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  statLbl:          { color: '#505060', fontSize: 11, marginTop: 2, fontWeight: '500' },
  statDivider:      { width: 1, backgroundColor: '#1E2128', marginVertical: 4 },

  filtrosWrap:      { borderBottomWidth: 1, borderBottomColor: '#1E2128', paddingVertical: 10 },
  filtrosRow:       { paddingHorizontal: 14, gap: 8 },
  filtroPill:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, backgroundColor: '#12151C', borderWidth: 1, borderColor: '#1E2128' },
  filtroEmoji:      { fontSize: 13 },
  filtroTxt:        { color: '#606060', fontSize: 13, fontWeight: '600' },

  list:             { padding: 14, paddingBottom: 50 },
  empty:            { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyEmoji:       { fontSize: 52 },
  emptyTitle:       { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  emptySubtitle:    { color: '#505060', fontSize: 13, textAlign: 'center' },

  card:             { backgroundColor: '#12151C', borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: '#1E2128', overflow: 'hidden', flexDirection: 'row' },
  cardAccent:       { width: 4 },
  cardBody:         { flex: 1, padding: 16 },
  row:              { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle:     { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1C1F28', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2D38' },
  avatarTxt:        { color: '#9B59B6', fontWeight: 'bold', fontSize: 16 },
  cardUser:         { color: '#FFF', fontWeight: '700', fontSize: 14 },
  cardFecha:        { color: '#404050', fontSize: 11, marginTop: 1 },
  estadoBadge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  estadoTxt:        { fontSize: 10, fontWeight: 'bold' },

  monto:            { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  montoMxn:         { color: '#505060', fontSize: 14, paddingBottom: 3 },
  metodoBadge:      { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  metodoBadgeSPEI:  { backgroundColor: 'rgba(52,152,219,0.1)', borderColor: 'rgba(52,152,219,0.3)' },
  metodoBadgeMP:    { backgroundColor: 'rgba(0,177,234,0.1)',  borderColor: 'rgba(0,177,234,0.3)' },
  metodoTxt:        { fontSize: 12, fontWeight: '700' },

  destinoBox:       { backgroundColor: '#0A0C12', borderRadius: 10, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#1E2128' },
  destinoLabel:     { color: '#404050', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  destinoVal:       { color: '#E0E0E0', fontWeight: '600', fontSize: 13 },

  notaBox:          { backgroundColor: 'rgba(231,76,60,0.07)', borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: 'rgba(231,76,60,0.2)' },
  notaLabel:        { color: '#E74C3C', fontSize: 10, fontWeight: '700', marginBottom: 3 },
  notaVal:          { color: '#C0A0A0', fontSize: 12 },

  acciones:         { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnDisabled:      { opacity: 0.4 },
  btnPagar:         { flex: 2, backgroundColor: '#2ECC71', paddingVertical: 13, borderRadius: 13, alignItems: 'center' },
  btnPagarTxt:      { color: '#000', fontWeight: 'bold', fontSize: 14 },
  btnRechazar:      { flex: 1, paddingVertical: 13, borderRadius: 13, alignItems: 'center', borderWidth: 1.5, borderColor: '#E74C3C', backgroundColor: 'rgba(231,76,60,0.07)' },
  btnRechazarTxt:   { color: '#E74C3C', fontWeight: 'bold', fontSize: 14 },

  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:        { backgroundColor: '#12151C', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, paddingTop: 12, borderTopWidth: 1, borderColor: '#1E2128' },
  modalHandle:      { width: 36, height: 4, backgroundColor: '#2A2D38', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  modalTitle:       { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalInfoRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0A0C12', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#1E2128' },
  modalAvatarCircle:{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#1C1F28', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2D38' },
  modalAvatarTxt:   { color: '#9B59B6', fontWeight: 'bold', fontSize: 18 },
  modalUser:        { color: '#FFF', fontWeight: '700', fontSize: 14 },
  modalMonto:       { color: '#E74C3C', fontWeight: 'bold', fontSize: 16, marginTop: 2 },
  inputLabel:       { color: '#505060', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  input:            { backgroundColor: '#0A0C12', borderRadius: 12, borderWidth: 1, borderColor: '#1E2128', color: '#FFF', padding: 12, fontSize: 14, textAlignVertical: 'top', minHeight: 80 },
  modalNota:        { color: '#505060', fontSize: 12, marginTop: 10, marginBottom: 4 },
  modalBtns:        { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancelBtn:   { flex: 1, padding: 14, borderRadius: 13, alignItems: 'center', backgroundColor: '#1C1F28', borderWidth: 1, borderColor: '#2A2D38' },
  modalCancelTxt:   { color: '#707080', fontWeight: 'bold' },
  modalConfirmBtn:  { flex: 1, padding: 14, borderRadius: 13, alignItems: 'center', backgroundColor: 'rgba(231,76,60,0.15)', borderWidth: 1.5, borderColor: '#E74C3C' },
  modalConfirmTxt:  { color: '#E74C3C', fontWeight: 'bold' },
});
