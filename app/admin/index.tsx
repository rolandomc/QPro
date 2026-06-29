import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Modal, FlatList, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { AdminService } from '../../src/services/admin.service';
import { QuinielasService } from '../../src/services/quinielas.service';
import { supabase } from '../../src/config/supabase';
import DateTimePicker from '../../src/components/DateTimePicker';

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDisplay(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}h`;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [quinielas,            setQuinielas]            = useState<any[]>([]);
  const [loading,              setLoading]              = useState(true);
  const [refreshing,           setRefreshing]           = useState(false);
  const [actionLoading,        setActionLoading]        = useState<string | null>(null);
  const [usuariosModal,        setUsuariosModal]        = useState(false);
  const [usuarios,             setUsuarios]             = useState<any[]>([]);
  const [loadingUsuarios,      setLoadingUsuarios]      = useState(false);
  const [quinielaSeleccionada, setQuinielaSeleccionada] = useState('');
  const [proximaFecha,         setProximaFecha]         = useState('');
  const [savingFecha,          setSavingFecha]          = useState(false);
  const [configExpanded,       setConfigExpanded]       = useState(false);
  const [pickerVisible,        setPickerVisible]        = useState(false);
  const [retirosPendientes,    setRetirosPendientes]    = useState(0);

  // ── Comprobantes SPEI pendientes ──────────────────────────────────
  const [speiPendientes,       setSpeiPendientes]       = useState<any[]>([]);
  const [speiExpanded,         setSpeiExpanded]         = useState(false);
  const [aprobandoId,          setAprobandoId]          = useState<string | null>(null);

  const loadQuinielas = useCallback(async () => {
    try {
      const [data, fecha, { count }, { data: speiData }] = await Promise.all([
        AdminService.getQuinielas(),
        QuinielasService.getProximaFecha(),
        supabase
          .from('retiro_solicitudes')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'pendiente')
          .then(r => ({ count: r.count ?? 0 })),
        // Cargar participaciones SPEI con comprobante subido pero sin validar
        supabase
          .from('participaciones')
          .select('id, user_id, monto_pagado, clave_rastreo, comprobante_url, comprobante_enviado_at, ultimo_error_spei, created_at, quiniela_id')
          .eq('estado', 'spei_pendiente')
          .eq('comprobante_validado', false)
          .not('comprobante_url', 'is', null)
          .order('comprobante_enviado_at', { ascending: true }),
      ]);
      setQuinielas(data || []);
      setProximaFecha(fecha ?? '');
      setRetirosPendientes(count);

      // Enriquecer con username
      const parts = speiData || [];
      if (parts.length > 0) {
        const userIds = parts.map((p: any) => p.user_id);
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);
        const profsMap: Record<string, string> = {};
        (profs || []).forEach((p: any) => { profsMap[p.id] = p.username; });
        setSpeiPendientes(parts.map((p: any) => ({ ...p, username: profsMap[p.user_id] ?? 'usuario' })));
        // Auto-expandir si hay pendientes
        if (parts.length > 0) setSpeiExpanded(true);
      } else {
        setSpeiPendientes([]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); loadQuinielas(); }, []));

  // ── Aprobar comprobante SPEI manualmente ─────────────────────────
  const handleAprobarSPEI = (item: any) => {
    Alert.alert(
      '✅ Aprobar Pago',
      `¿Confirmas que el pago de @${item.username} es válido?\n\nClave: ${item.clave_rastreo ?? 'N/A'}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            setAprobandoId(item.id);
            try {
              const { error } = await supabase
                .from('participaciones')
                .update({
                  estado:               'pagado',
                  comprobante_validado: true,
                  monto_pagado:         item.monto_pagado || 50,
                  fecha_pago:           new Date().toISOString(),
                  ultimo_error_spei:    null,
                })
                .eq('id', item.id);
              if (error) throw error;
              // Marcar notificación como leída
              await supabase
                .from('admin_notificaciones')
                .update({ leida: true })
                .eq('participacion_id', item.id);
              setSpeiPendientes(prev => prev.filter(p => p.id !== item.id));
              Alert.alert('¡Aprobado!', `El pago de @${item.username} fue confirmado.`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setAprobandoId(null);
            }
          },
        },
      ],
    );
  };

  const handlePickerConfirm = (date: Date) => {
    setPickerVisible(false);
    setProximaFecha(date.toISOString());
  };

  const handleGuardarFecha = async () => {
    setSavingFecha(true);
    try {
      await QuinielasService.setProximaFecha(proximaFecha || null);
      Alert.alert('Guardado', proximaFecha
        ? 'Los usuarios verán el countdown en la pantalla principal.'
        : 'Countdown ocultado.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingFecha(false);
    }
  };

  const handleLimpiar = async () => {
    setProximaFecha('');
    await QuinielasService.setProximaFecha(null).catch(() => {});
  };

  const handleVerUsuarios = async (quinielaId: string, titulo: string) => {
    setQuinielaSeleccionada(titulo);
    setUsuariosModal(true);
    setLoadingUsuarios(true);
    try {
      const { data: parts, error: partsError } = await supabase
        .from('participaciones')
        .select('id, user_id, estado, monto_pagado, aciertos, created_at')
        .eq('quiniela_id', quinielaId)
        .order('created_at', { ascending: false });
      if (partsError) throw partsError;
      const userIds = (parts || []).map((p: any) => p.user_id);
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);
      const profsMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { profsMap[p.id] = p.username; });
      setUsuarios((parts || []).map((p: any) => ({ ...p, username: profsMap[p.user_id] ?? 'usuario' })));
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setUsuariosModal(false);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const handleCerrarApuestas = (quinielaId: string, titulo: string) => {
    Alert.alert('Cerrar Apuestas', `¿Cerrar "${titulo}"?\n\nYa nadie podrá participar.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar', style: 'destructive', onPress: async () => {
        setActionLoading(quinielaId + '_cerrar');
        try {
          await AdminService.updateEstado(quinielaId, 'cerrada');
          setQuinielas(prev => prev.map(q => q.id === quinielaId ? { ...q, estado: 'cerrada' } : q));
          Alert.alert('Cerrada', `"${titulo}" ya no acepta participaciones.`);
        } catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionLoading(null); }
      }},
    ]);
  };

  const handleCancelar = (quinielaId: string, titulo: string) => {
    Alert.alert('Cancelar', `¿Cancelar "${titulo}" definitivamente?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, Cancelar', style: 'destructive', onPress: async () => {
        setActionLoading(quinielaId + '_cancelar');
        try {
          await AdminService.updateEstado(quinielaId, 'finalizada');
          setQuinielas(prev => prev.map(q => q.id === quinielaId ? { ...q, estado: 'finalizada' } : q));
          Alert.alert('Cancelada', `"${titulo}" fue marcada como finalizada.`);
        } catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionLoading(null); }
      }},
    ]);
  };

  const getEstadoColor     = (e: string) => e === 'abierta' ? '#2ECC71' : e === 'cerrada' ? '#3498DB' : '#A0A0A0';
  const getEstadoPartColor = (e: string) => ({ pagado: '#2ECC71', pendiente: '#F39C12', ganador: '#9B59B6', perdedor: '#E74C3C' }[e] ?? '#A0A0A0');
  const totalBolsa = quinielas.reduce((acc, q) => acc + (q.premio_total ?? 0), 0);

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#9B59B6" />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Panel Admin</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadQuinielas(); }} tintColor="#9B59B6" />}
      >
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{quinielas.length}</Text>
            <Text style={styles.statLabel}>Quinielas</Text>
          </View>
          <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: '#2A2D35' }]}>
            <Text style={[styles.statValue, { color: '#2ECC71' }]}>${totalBolsa.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Bolsa Total</Text>
          </View>
        </View>

        {/* ── Comprobantes SPEI pendientes ── */}
        <TouchableOpacity
          style={[styles.speiHeader, speiPendientes.length > 0 && styles.speiHeaderAlert]}
          onPress={() => setSpeiExpanded(v => !v)}
        >
          <View style={styles.speiHeaderLeft}>
            <Text style={styles.speiEmoji}>🧾</Text>
            <View>
              <Text style={styles.speiHeaderTitle}>Comprobantes SPEI</Text>
              <Text style={styles.speiHeaderSub}>
                {speiPendientes.length > 0
                  ? `${speiPendientes.length} pago${speiPendientes.length > 1 ? 's' : ''} por revisar`
                  : 'Sin pagos pendientes'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {speiPendientes.length > 0 && (
              <View style={styles.speiBadge}>
                <Text style={styles.speiBadgeCount}>{speiPendientes.length}</Text>
              </View>
            )}
            <Text style={styles.speiChevron}>{speiExpanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {speiExpanded && (
          <View style={styles.speiList}>
            {speiPendientes.length === 0 ? (
              <Text style={styles.speiEmpty}>✅ Todos los comprobantes están al día.</Text>
            ) : (
              speiPendientes.map((item) => (
                <View key={item.id} style={styles.speiCard}>
                  <View style={styles.speiCardHeader}>
                    <Text style={styles.speiUser}>@{item.username}</Text>
                    <Text style={styles.speiMonto}>${item.monto_pagado || '?'}</Text>
                  </View>
                  {item.clave_rastreo ? (
                    <Text style={styles.speiClave}>🔑 {item.clave_rastreo}</Text>
                  ) : (
                    <Text style={styles.speiClaveNull}>⚠️ Sin clave de rastreo</Text>
                  )}
                  {item.ultimo_error_spei ? (
                    <Text style={styles.speiError} numberOfLines={2}>{item.ultimo_error_spei}</Text>
                  ) : null}
                  <Text style={styles.speiDate}>
                    {item.comprobante_enviado_at ? formatDisplay(item.comprobante_enviado_at) : ''}
                  </Text>
                  <View style={styles.speiActions}>
                    {item.comprobante_url ? (
                      <TouchableOpacity
                        style={styles.speiVerBtn}
                        onPress={() => Linking.openURL(item.comprobante_url)}
                      >
                        <Text style={styles.speiVerText}>🖼 Ver comprobante</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.speiAprobarBtn, aprobandoId === item.id && { opacity: 0.6 }]}
                      onPress={() => handleAprobarSPEI(item)}
                      disabled={aprobandoId === item.id}
                    >
                      {aprobandoId === item.id
                        ? <ActivityIndicator size="small" color="#000" />
                        : <Text style={styles.speiAprobarText}>✅ Aprobar</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Acceso rápido retiros */}
        <TouchableOpacity
          style={styles.retirosBtn}
          onPress={() => router.push('/admin/retiros')}
        >
          <View style={styles.retirosBtnLeft}>
            <Text style={styles.retirosEmoji}>💸</Text>
            <View>
              <Text style={styles.retirosBtnTitle}>Gestionar Retiros</Text>
              <Text style={styles.retirosBtnSub}>
                {retirosPendientes > 0
                  ? `${retirosPendientes} solicitud${retirosPendientes > 1 ? 'es' : ''} pendiente${retirosPendientes > 1 ? 's' : ''}`
                  : 'Sin solicitudes pendientes'}
              </Text>
            </View>
          </View>
          <View style={styles.retirosBtnRight}>
            {retirosPendientes > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeCount}>{retirosPendientes}</Text>
              </View>
            )}
            <Text style={styles.retirosChevron}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Configurar próxima quiniela */}
        <TouchableOpacity style={styles.configHeader} onPress={() => setConfigExpanded(v => !v)}>
          <Text style={styles.configHeaderText}>⏰ Configurar Próxima Quiniela</Text>
          <Text style={styles.configChevron}>{configExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {configExpanded && (
          <View style={styles.configBox}>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setPickerVisible(true)}>
              <Text style={styles.datePickerIcon}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.datePickerLabel}>Seleccionar fecha y hora</Text>
                <Text style={styles.datePickerValue}>
                  {proximaFecha ? formatDisplay(proximaFecha) : 'Sin fecha configurada'}
                </Text>
              </View>
              <Text style={styles.datePickerArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.configBtns}>
              <TouchableOpacity style={[styles.configBtn, styles.configBtnSave]} onPress={handleGuardarFecha} disabled={savingFecha || !proximaFecha}>
                {savingFecha ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.configBtnSaveText}>Guardar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.configBtn, styles.configBtnClear]} onPress={handleLimpiar}>
                <Text style={styles.configBtnClearText}>Limpiar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity style={[styles.createBtn, styles.neonBorderPurple]} onPress={() => router.push('/admin/create')}>
          <Text style={styles.createBtnText}>+ Diseñar Nueva Quiniela</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Quinielas</Text>
        {quinielas.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No hay quinielas creadas aún.</Text>
          </View>
        )}

        {quinielas.map((q) => (
          <TouchableOpacity key={q.id} style={styles.card} onPress={() => router.push(`/admin/quiniela/${q.id}`)} activeOpacity={0.75}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{q.titulo}</Text>
              <View style={[styles.estadoBadge, { borderColor: getEstadoColor(q.estado) }]}>
                <Text style={[styles.estadoBadgeText, { color: getEstadoColor(q.estado) }]}>{q.estado.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardArrow}>›</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.infoText}>🎦 Partidos: {q.partidos?.[0]?.count ?? 0}</Text>
              <Text style={styles.infoText}>💰 Entrada: <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>${q.precio_entrada}</Text></Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.infoText}>👥 Mín: <Text style={{ color: '#F39C12', fontWeight: 'bold' }}>{q.jugadores_minimos ?? 0}</Text></Text>
              <Text style={styles.infoText}>🏠 Casa: <Text style={{ color: '#9B59B6', fontWeight: 'bold' }}>{q.porcentaje_admin ?? 0}%</Text></Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={(e) => { e.stopPropagation?.(); handleVerUsuarios(q.id, q.titulo); }}>
                <Text style={styles.actionText}>👥 Usuarios</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, q.estado !== 'abierta' && styles.disabledBtn]}
                disabled={q.estado !== 'abierta' || actionLoading === q.id + '_cerrar'}
                onPress={(e) => { e.stopPropagation?.(); handleCerrarApuestas(q.id, q.titulo); }}
              >
                {actionLoading === q.id + '_cerrar'
                  ? <ActivityIndicator size="small" color="#3498DB" />
                  : <Text style={[styles.actionText, q.estado !== 'abierta' && { color: '#505050' }]}>🔒 Cerrar</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.dangerBtn, q.estado === 'finalizada' && styles.disabledBtn]}
                disabled={q.estado === 'finalizada' || actionLoading === q.id + '_cancelar'}
                onPress={(e) => { e.stopPropagation?.(); handleCancelar(q.id, q.titulo); }}
              >
                {actionLoading === q.id + '_cancelar'
                  ? <ActivityIndicator size="small" color="#E91E63" />
                  : <Text style={[styles.dangerText, q.estado === 'finalizada' && { color: '#505050' }]}>❌ Cancelar</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <DateTimePicker
        visible={pickerVisible}
        initialDate={proximaFecha ? new Date(proximaFecha) : new Date()}
        onConfirm={handlePickerConfirm}
        onCancel={() => setPickerVisible(false)}
      />

      {/* Modal participantes */}
      <Modal visible={usuariosModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>👥 Participantes</Text>
              <Text style={styles.modalSubtitle} numberOfLines={1}>{quinielaSeleccionada}</Text>
              <TouchableOpacity onPress={() => setUsuariosModal(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingUsuarios ? (
              <ActivityIndicator size="large" color="#2ECC71" style={{ marginVertical: 30 }} />
            ) : usuarios.length === 0 ? (
              <Text style={styles.emptyText}>Nadie ha participado aún.</Text>
            ) : (
              <FlatList
                data={usuarios}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <View style={styles.userRow}>
                    <Text style={styles.userRank}>#{index + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userEmail}>@{item.username}</Text>
                      <Text style={styles.userMeta}>Aciertos: {item.aciertos ?? 0}</Text>
                    </View>
                    <View style={[styles.partEstadoBadge, { borderColor: getEstadoPartColor(item.estado) }]}>
                      <Text style={[styles.partEstadoBadgeText, { color: getEstadoPartColor(item.estado) }]}>{item.estado?.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.userMonto}>${item.monto_pagado ?? 0}</Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#0A0C10' },
  header:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backButton:           { width: 60 },
  backText:             { color: '#9B59B6', fontSize: 16 },
  title:                { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  content:              { padding: 15, paddingBottom: 40 },

  statsContainer:       { flexDirection: 'row', backgroundColor: '#15181F', borderRadius: 12, paddingVertical: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35' },
  statBox:              { flex: 1, alignItems: 'center' },
  statValue:            { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  statLabel:            { color: '#A0A0A0', fontSize: 12 },

  // ── SPEI pendientes ──
  speiHeader:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#15181F', borderRadius: 12, padding: 16, marginBottom: 4, borderWidth: 1.5, borderColor: '#2A2D35' },
  speiHeaderAlert:      { borderColor: '#2ECC71' },
  speiHeaderLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  speiEmoji:            { fontSize: 28 },
  speiHeaderTitle:      { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  speiHeaderSub:        { color: '#A0A0A0', fontSize: 12, marginTop: 2 },
  speiBadge:            { backgroundColor: '#2ECC71', borderRadius: 12, minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  speiBadgeCount:       { color: '#000', fontWeight: 'bold', fontSize: 12 },
  speiChevron:          { color: '#2ECC71', fontSize: 12 },
  speiList:             { backgroundColor: '#15181F', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35', gap: 10 },
  speiEmpty:            { color: '#2ECC71', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  speiCard:             { backgroundColor: '#1C1F26', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2A2D35' },
  speiCardHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  speiUser:             { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  speiMonto:            { color: '#2ECC71', fontWeight: 'bold', fontSize: 16 },
  speiClave:            { color: '#A0A0A0', fontSize: 11, marginBottom: 4, fontFamily: 'monospace' },
  speiClaveNull:        { color: '#F39C12', fontSize: 11, marginBottom: 4 },
  speiError:            { color: '#E74C3C', fontSize: 10, marginBottom: 4, fontStyle: 'italic' },
  speiDate:             { color: '#505050', fontSize: 10, marginBottom: 8 },
  speiActions:          { flexDirection: 'row', gap: 8 },
  speiVerBtn:           { flex: 1, backgroundColor: '#1C1F26', paddingVertical: 9, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#3498DB' },
  speiVerText:          { color: '#3498DB', fontSize: 12, fontWeight: '600' },
  speiAprobarBtn:       { flex: 1, backgroundColor: '#2ECC71', paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  speiAprobarText:      { color: '#000', fontSize: 12, fontWeight: 'bold' },

  retirosBtn:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#15181F', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: '#F39C12' },
  retirosBtnLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  retirosEmoji:         { fontSize: 28 },
  retirosBtnTitle:      { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  retirosBtnSub:        { color: '#A0A0A0', fontSize: 12, marginTop: 2 },
  retirosBtnRight:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:                { backgroundColor: '#E74C3C', borderRadius: 12, minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeCount:           { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  retirosChevron:       { color: '#F39C12', fontSize: 24 },

  configHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#15181F', borderRadius: 10, padding: 14, marginBottom: 4, borderWidth: 1, borderColor: '#F39C12' },
  configHeaderText:     { color: '#F39C12', fontWeight: 'bold', fontSize: 14 },
  configChevron:        { color: '#F39C12', fontSize: 12 },
  configBox:            { backgroundColor: '#15181F', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35' },
  datePickerBtn:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1F26', borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#F39C12', gap: 10 },
  datePickerIcon:       { fontSize: 24 },
  datePickerLabel:      { color: '#A0A0A0', fontSize: 11, marginBottom: 2 },
  datePickerValue:      { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  datePickerArrow:      { color: '#F39C12', fontSize: 22 },
  configBtns:           { flexDirection: 'row', gap: 10 },
  configBtn:            { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  configBtnSave:        { backgroundColor: '#F39C12' },
  configBtnSaveText:    { color: '#000', fontWeight: 'bold', fontSize: 14 },
  configBtnClear:       { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35' },
  configBtnClearText:   { color: '#A0A0A0', fontSize: 14 },

  createBtn:            { backgroundColor: '#1C1F26', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 12, marginBottom: 24, borderWidth: 1.5 },
  neonBorderPurple:     { borderColor: '#9B59B6' },
  createBtnText:        { color: '#9B59B6', fontWeight: 'bold', fontSize: 16 },
  sectionTitle:         { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  emptyBox:             { alignItems: 'center', padding: 30 },
  emptyText:            { color: '#A0A0A0', fontSize: 14, textAlign: 'center' },

  card:                 { backgroundColor: '#15181F', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#2A2D35' },
  cardHeader:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle:            { color: '#FFF', fontSize: 15, fontWeight: 'bold', flex: 1, marginRight: 8 },
  cardArrow:            { color: '#9B59B6', fontSize: 22, marginLeft: 4 },
  estadoBadge:          { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  estadoBadgeText:      { fontSize: 10, fontWeight: 'bold' },
  cardInfo:             { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1C1F26', padding: 10, borderRadius: 8, marginBottom: 8 },
  infoText:             { color: '#A0A0A0', fontSize: 12 },
  cardActions:          { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn:            { flex: 1, backgroundColor: '#1C1F26', paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35' },
  actionText:           { color: '#FFF', fontSize: 12, fontWeight: '600' },
  dangerBtn:            { borderColor: '#E91E63', backgroundColor: 'rgba(233,30,99,0.1)' },
  dangerText:           { color: '#E91E63', fontSize: 12, fontWeight: 'bold' },
  disabledBtn:          { opacity: 0.35 },

  modalOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox:             { backgroundColor: '#15181F', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  modalHeader:          { marginBottom: 15 },
  modalTitle:           { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  modalSubtitle:        { color: '#A0A0A0', fontSize: 13, marginTop: 2 },
  modalClose:           { position: 'absolute', right: 0, top: 0, padding: 5 },
  modalCloseText:       { color: '#FFF', fontSize: 20 },
  userRow:              { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2D35', gap: 8 },
  userRank:             { color: '#F39C12', fontWeight: 'bold', width: 28, fontSize: 14 },
  userEmail:            { color: '#FFF', fontSize: 14, fontWeight: '600' },
  userMeta:             { color: '#A0A0A0', fontSize: 12, marginTop: 2 },
  partEstadoBadge:      { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  partEstadoBadgeText:  { fontSize: 9, fontWeight: 'bold' },
  userMonto:            { color: '#2ECC71', fontWeight: 'bold', fontSize: 13, minWidth: 40, textAlign: 'right' },
});
