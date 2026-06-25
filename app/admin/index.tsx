import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { AdminService } from '../../src/services/admin.service';
import { supabase } from '../../src/config/supabase';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [quinielas, setQuinielas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [usuariosModal, setUsuariosModal] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [quinielaSeleccionada, setQuinielaSeleccionada] = useState('');

  const loadQuinielas = useCallback(async () => {
    try {
      const data = await AdminService.getQuinielas();
      setQuinielas(data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadQuinielas();
    }, [])
  );

  const handleVerUsuarios = async (quinielaId: string, titulo: string) => {
    setQuinielaSeleccionada(titulo);
    setUsuariosModal(true);
    setLoadingUsuarios(true);
    try {
      const { data, error } = await supabase
        .from('participaciones')
        .select('id, estado, monto_pagado, aciertos, created_at, profiles(username)')
        .eq('quiniela_id', quinielaId)
        .order('aciertos', { ascending: false });
      if (error) throw error;
      setUsuarios(data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setUsuariosModal(false);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const handleCerrarApuestas = (quinielaId: string, titulo: string) => {
    Alert.alert(
      '🔒 Cerrar Apuestas',
      `¿Cerrar "${titulo}"?\n\nYa nadie podrá participar ni modificar selecciones.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(quinielaId + '_cerrar');
            try {
              await AdminService.updateEstado(quinielaId, 'cerrada');
              setQuinielas(prev => prev.map(q => q.id === quinielaId ? { ...q, estado: 'cerrada' } : q));
              Alert.alert('✅ Apuestas cerradas', `"${titulo}" ya no acepta nuevas participaciones.`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleCancelar = (quinielaId: string, titulo: string) => {
    Alert.alert(
      '⚠️ Cancelar Quiniela',
      `¿Cancelar "${titulo}" definitivamente?\n\nDejará de aparecer en la app.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(quinielaId + '_cancelar');
            try {
              await AdminService.updateEstado(quinielaId, 'finalizada');
              setQuinielas(prev => prev.map(q => q.id === quinielaId ? { ...q, estado: 'finalizada' } : q));
              Alert.alert('Quiniela cancelada', `"${titulo}" fue marcada como finalizada.`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const getEstadoColor = (estado: string) => {
    if (estado === 'abierta') return '#2ECC71';
    if (estado === 'cerrada') return '#3498DB';
    return '#A0A0A0';
  };

  const totalBolsa = quinielas.reduce((acc, q) => acc + (q.premio_total ?? 0), 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#9B59B6" />
        </View>
      </SafeAreaView>
    );
  }

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadQuinielas(); }} tintColor="#9B59B6" />
        }
      >
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
          // ── Tocar el card navega al detalle de la quiniela ──
          <TouchableOpacity
            key={q.id}
            style={styles.card}
            onPress={() => router.push(`/admin/quiniela/${q.id}`)}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{q.titulo}</Text>
              <View style={[styles.badge, { borderColor: getEstadoColor(q.estado) }]}>
                <Text style={[styles.badgeText, { color: getEstadoColor(q.estado) }]}>{q.estado.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardArrow}>›</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.infoText}>🏀 Partidos: {q.partidos?.[0]?.count ?? 0}</Text>
              <Text style={styles.infoText}>💰 Entrada: <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>${q.precio_entrada} MXN</Text></Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={(e) => { e.stopPropagation?.(); handleVerUsuarios(q.id, q.titulo); }}
              >
                <Text style={styles.actionText}>👥 Usuarios</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, q.estado !== 'abierta' && styles.disabledBtn]}
                disabled={q.estado !== 'abierta' || actionLoading === q.id + '_cerrar'}
                onPress={(e) => { e.stopPropagation?.(); handleCerrarApuestas(q.id, q.titulo); }}
              >
                {actionLoading === q.id + '_cerrar'
                  ? <ActivityIndicator size="small" color="#3498DB" />
                  : <Text style={[styles.actionText, q.estado !== 'abierta' && { color: '#505050' }]}>🔒 Cerrar</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.dangerBtn, q.estado === 'finalizada' && styles.disabledBtn]}
                disabled={q.estado === 'finalizada' || actionLoading === q.id + '_cancelar'}
                onPress={(e) => { e.stopPropagation?.(); handleCancelar(q.id, q.titulo); }}
              >
                {actionLoading === q.id + '_cancelar'
                  ? <ActivityIndicator size="small" color="#E91E63" />
                  : <Text style={[styles.dangerText, q.estado === 'finalizada' && { color: '#505050' }]}>❌ Cancelar</Text>
                }
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
                      <Text style={styles.userEmail}>{item.profiles?.username ?? 'Usuario'}</Text>
                      <Text style={styles.userMeta}>Aciertos: {item.aciertos ?? 0} • {item.estado}</Text>
                    </View>
                    <Text style={styles.userMonto}>${item.monto_pagado}</Text>
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
  container: { flex: 1, backgroundColor: '#0A0C10' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backButton: { width: 60 },
  backText: { color: '#9B59B6', fontSize: 16 },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 15, paddingBottom: 40 },
  statsContainer: { flexDirection: 'row', backgroundColor: '#15181F', borderRadius: 12, paddingVertical: 20, marginBottom: 20, borderWidth: 1, borderColor: '#2A2D35' },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  statLabel: { color: '#A0A0A0', fontSize: 12 },
  createBtn: { backgroundColor: '#1C1F26', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 30, borderWidth: 1.5 },
  neonBorderPurple: { borderColor: '#9B59B6', shadowColor: '#9B59B6', shadowOpacity: 0.6, shadowRadius: 10, elevation: 5 },
  createBtnText: { color: '#9B59B6', fontWeight: 'bold', fontSize: 16 },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  emptyBox: { alignItems: 'center', padding: 30 },
  emptyText: { color: '#A0A0A0', fontSize: 14, textAlign: 'center' },
  card: { backgroundColor: '#15181F', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#2A2D35' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', flex: 1, marginRight: 8 },
  cardArrow: { color: '#9B59B6', fontSize: 22, marginLeft: 4 },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  cardInfo: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1C1F26', padding: 10, borderRadius: 8, marginBottom: 12 },
  infoText: { color: '#A0A0A0', fontSize: 12 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, backgroundColor: '#1C1F26', paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35' },
  actionText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  dangerBtn: { borderColor: '#E91E63', backgroundColor: 'rgba(233,30,99,0.1)' },
  dangerText: { color: '#E91E63', fontSize: 12, fontWeight: 'bold' },
  disabledBtn: { opacity: 0.35 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#15181F', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  modalHeader: { marginBottom: 15 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  modalSubtitle: { color: '#A0A0A0', fontSize: 13, marginTop: 2 },
  modalClose: { position: 'absolute', right: 0, top: 0, padding: 5 },
  modalCloseText: { color: '#FFF', fontSize: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  userRank: { color: '#F39C12', fontWeight: 'bold', width: 30, fontSize: 14 },
  userEmail: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  userMeta: { color: '#A0A0A0', fontSize: 12, marginTop: 2 },
  userMonto: { color: '#2ECC71', fontWeight: 'bold', fontSize: 14 },
});
