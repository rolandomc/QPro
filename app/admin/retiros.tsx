import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput,
  Modal, TouchableWithoutFeedback, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/config/supabase';

const ESTADO_CFG: Record<string, { color: string; emoji: string }> = {
  pendiente:   { color: '#F39C12', emoji: '⏳' },
  procesando:  { color: '#3498DB', emoji: '🔄' },
  pagado:      { color: '#2ECC71', emoji: '✅' },
  rechazado:   { color: '#E74C3C', emoji: '❌' },
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type Filtro = 'todos' | 'pendiente' | 'pagado' | 'rechazado';

export default function AdminRetirosScreen() {
  const router = useRouter();
  const [retiros,     setRetiros]    = useState<any[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [refreshing,  setRefreshing] = useState(false);
  const [filtro,      setFiltro]     = useState<Filtro>('pendiente');
  const [accionando,  setAccionando] = useState<string | null>(null);

  // Modal nota rechazo
  const [modalVisible, setModalVisible] = useState(false);
  const [notaRechazo,  setNotaRechazo]  = useState('');
  const [retiroActivo, setRetiroActivo] = useState<any | null>(null);

  const loadRetiros = useCallback(async () => {
    try {
      let query = supabase
        .from('retiro_solicitudes')
        .select(`
          id, user_id, monto, metodo, clabe, alias_mp,
          estado, nota_admin, created_at, updated_at,
          profiles:user_id ( username )
        `)
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
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
      `¿Marcar como pagado el retiro de\n\n@${retiro.profiles?.username}\n$${retiro.monto} MXN\n${destino}?\n\n⚠️ Asegúrate de haber hecho la transferencia antes de confirmar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, está pagado', style: 'default', onPress: async () => {
          setAccionando(retiro.id + '_pagar');
          try {
            await llamarEdgeFunction(retiro.id, 'pagar');
            setRetiros(prev => prev.filter(r => filtro !== 'todos' ? r.id !== retiro.id : { ...r, estado: 'pagado' }));
            loadRetiros();
            Alert.alert('✅ Listo', 'Retiro marcado como pagado y saldo descontado.');
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
    setAccionando(retiroActivo.id + '_rechazar');
    setModalVisible(false);
    try {
      await llamarEdgeFunction(retiroActivo.id, 'rechazar', notaRechazo.trim() || undefined);
      loadRetiros();
      Alert.alert('Rechazado', 'La solicitud fue rechazada y el usuario fue notificado.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAccionando(null);
      setRetiroActivo(null);
    }
  };

  const pendientesCount = retiros.filter(r => r.estado === 'pendiente').length;
  const totalPendiente  = retiros
    .filter(r => r.estado === 'pendiente')
    .reduce((s, r) => s + Number(r.monto), 0);

  const FILTROS: { key: Filtro; label: string }[] = [
    { key: 'pendiente', label: '⏳ Pendientes' },
    { key: 'pagado',    label: '✅ Pagados' },
    { key: 'rechazado', label: '❌ Rechazados' },
    { key: 'todos',     label: '📋 Todos' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Retiros</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Stats pendientes */}
      {filtro === 'pendiente' && retiros.length > 0 && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{pendientesCount}</Text>
            <Text style={styles.statLbl}>Pendientes</Text>
          </View>
          <View style={[styles.statItem, { borderLeftWidth: 1, borderLeftColor: '#2A2D35' }]}>
            <Text style={[styles.statVal, { color: '#F39C12' }]}>${totalPendiente.toFixed(2)}</Text>
            <Text style={styles.statLbl}>Total MXN</Text>
          </View>
        </View>
      )}

      {/* Filtros */}
      <View style={styles.filtrosRow}>
        {FILTROS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filtroPill, filtro === f.key && styles.filtroPillActive]}
            onPress={() => setFiltro(f.key)}
          >
            <Text style={[styles.filtroPillTxt, filtro === f.key && styles.filtroPillTxtActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#9B59B6" />
        </View>
      ) : (
        <FlatList
          data={retiros}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadRetiros(); }}
              tintColor="#9B59B6"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyText}>
                {filtro === 'pendiente' ? 'No hay retiros pendientes' : 'Sin registros'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = ESTADO_CFG[item.estado] ?? { color: '#FFF', emoji: '💰' };
            const esPendiente = item.estado === 'pendiente';
            const pagando     = accionando === item.id + '_pagar';
            const rechazando  = accionando === item.id + '_rechazar';

            return (
              <View style={styles.card}>
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardUser}>@{item.profiles?.username ?? 'usuario'}</Text>
                    <Text style={styles.cardFecha}>{formatFecha(item.created_at)}</Text>
                  </View>
                  <View style={[styles.estadoBadge, { borderColor: cfg.color }]}>
                    <Text style={[styles.estadoTxt, { color: cfg.color }]}>
                      {cfg.emoji} {item.estado.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Monto + método */}
                <View style={styles.montoRow}>
                  <Text style={styles.montoVal}>${Number(item.monto).toFixed(2)}
                    <Text style={styles.montoMxn}> MXN</Text>
                  </Text>
                  <View style={styles.metodoBadge}>
                    <Text style={styles.metodoTxt}>{item.metodo.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Destino */}
                <View style={styles.destinoRow}>
                  <Text style={styles.destinoLabel}>
                    {item.metodo === 'spei' ? '🏦 CLABE:' : '💳 Alias MP:'}
                  </Text>
                  <Text style={styles.destinoVal} selectable>
                    {item.metodo === 'spei' ? item.clabe : item.alias_mp}
                  </Text>
                </View>

                {/* Nota admin si existe */}
                {item.nota_admin ? (
                  <View style={styles.notaRow}>
                    <Text style={styles.notaTxt}>📝 {item.nota_admin}</Text>
                  </View>
                ) : null}

                {/* Acciones solo para pendientes */}
                {esPendiente && (
                  <View style={styles.acciones}>
                    <TouchableOpacity
                      style={[styles.btnPagar, (pagando || rechazando) && { opacity: 0.5 }]}
                      onPress={() => handlePagar(item)}
                      disabled={pagando || rechazando}
                    >
                      {pagando
                        ? <ActivityIndicator color="#000" size="small" />
                        : <Text style={styles.btnPagarTxt}>✅ Ya pagué</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnRechazar, (pagando || rechazando) && { opacity: 0.5 }]}
                      onPress={() => handleRechazarAbrir(item)}
                      disabled={pagando || rechazando}
                    >
                      {rechazando
                        ? <ActivityIndicator color="#E74C3C" size="small" />
                        : <Text style={styles.btnRechazarTxt}>❌ Rechazar</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Modal nota de rechazo */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>❌ Rechazar retiro</Text>
                  <Text style={styles.modalSubtitle}>
                    @{retiroActivo?.profiles?.username} — ${retiroActivo?.monto} MXN
                  </Text>
                  <Text style={styles.inputLabel}>Motivo (opcional — se envía al usuario)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. Datos incorrectos, intenta de nuevo"
                    placeholderTextColor="#505050"
                    value={notaRechazo}
                    onChangeText={setNotaRechazo}
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.modalBtns}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                      <Text style={styles.cancelBtnTxt}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rechazarConfirmBtn} onPress={handleRechazarConfirmar}>
                      <Text style={styles.rechazarConfirmTxt}>Confirmar rechazo</Text>
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

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0A0C10' },
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backButton:         { width: 60 },
  backText:           { color: '#9B59B6', fontSize: 16 },
  title:              { color: '#FFF', fontSize: 18, fontWeight: 'bold' },

  statsBar:           { flexDirection: 'row', backgroundColor: '#15181F', borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  statItem:           { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statVal:            { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  statLbl:            { color: '#A0A0A0', fontSize: 11, marginTop: 2 },

  filtrosRow:         { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexWrap: 'wrap' },
  filtroPill:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35' },
  filtroPillActive:   { backgroundColor: 'rgba(155,89,182,0.15)', borderColor: '#9B59B6' },
  filtroPillTxt:      { color: '#606060', fontSize: 12, fontWeight: '600' },
  filtroPillTxtActive:{ color: '#9B59B6', fontWeight: '700' },

  list:               { padding: 12, paddingBottom: 40 },
  emptyContainer:     { flex: 1, alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji:         { fontSize: 48 },
  emptyText:          { color: '#606060', fontSize: 15 },

  card:               { backgroundColor: '#15181F', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2A2D35' },
  cardTop:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardLeft:           { flex: 1 },
  cardUser:           { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  cardFecha:          { color: '#505050', fontSize: 11, marginTop: 3 },
  estadoBadge:        { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  estadoTxt:          { fontSize: 11, fontWeight: 'bold' },

  montoRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  montoVal:           { color: '#FFF', fontSize: 26, fontWeight: 'bold' },
  montoMxn:           { fontSize: 14, color: '#A0A0A0', fontWeight: 'normal' },
  metodoBadge:        { backgroundColor: '#1C1F26', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2A2D35' },
  metodoTxt:          { color: '#A0A0A0', fontSize: 12, fontWeight: '700' },

  destinoRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1F26', borderRadius: 10, padding: 10, gap: 8, marginBottom: 8 },
  destinoLabel:       { color: '#A0A0A0', fontSize: 12 },
  destinoVal:         { color: '#FFF', fontWeight: '600', fontSize: 13, flex: 1 },

  notaRow:            { backgroundColor: 'rgba(231,76,60,0.08)', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(231,76,60,0.2)' },
  notaTxt:            { color: '#E74C3C', fontSize: 12 },

  acciones:           { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnPagar:           { flex: 1, backgroundColor: '#2ECC71', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnPagarTxt:        { color: '#000', fontWeight: 'bold', fontSize: 14 },
  btnRechazar:        { flex: 1, backgroundColor: 'rgba(231,76,60,0.1)', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E74C3C' },
  btnRechazarTxt:     { color: '#E74C3C', fontWeight: 'bold', fontSize: 14 },

  // Modal
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:          { backgroundColor: '#15181F', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: '#2A2D35', gap: 6 },
  modalTitle:         { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  modalSubtitle:      { color: '#A0A0A0', fontSize: 13, marginBottom: 8 },
  inputLabel:         { color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginTop: 8 },
  input:              { backgroundColor: '#0A0C10', borderRadius: 12, borderWidth: 1, borderColor: '#2A2D35', color: '#FFF', padding: 12, fontSize: 14, textAlignVertical: 'top', minHeight: 80, marginTop: 6 },
  modalBtns:          { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn:          { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35' },
  cancelBtnTxt:       { color: '#A0A0A0', fontWeight: 'bold' },
  rechazarConfirmBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(231,76,60,0.15)', borderWidth: 1, borderColor: '#E74C3C' },
  rechazarConfirmTxt: { color: '#E74C3C', fontWeight: 'bold' },
});
