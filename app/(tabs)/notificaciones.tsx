import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet, Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/config/supabase';

const TIPO_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  ganador:  { icon: '🏆', color: '#F39C12', bg: 'rgba(243,156,18,0.1)' },
  perdedor: { icon: '😔', color: '#707070', bg: 'rgba(255,255,255,0.03)' },
  info:     { icon: '📢', color: '#3498DB', bg: 'rgba(52,152,219,0.08)' },
};

export default function NotificacionesScreen() {
  const [notifs,     setNotifs]     = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRead,   setShowRead]   = useState(false);
  const [userId,     setUserId]     = useState<string>('');

  const cargar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifs(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); cargar(); }, [cargar]));

  const marcarLeida = useCallback(async (id: string, isRead: boolean) => {
    if (!userId || isRead) return;
    await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', id)
      .eq('user_id', userId);
    setNotifs(prev => prev.map(n => (n.id === id ? { ...n, leida: true } : n)));
  }, [userId]);

  const borrarNotif = useCallback(async (id: string) => {
    if (!userId) {
      Alert.alert('Error', 'No se pudo identificar al usuario. Intenta de nuevo.');
      return;
    }

    Alert.alert(
      'Eliminar notificación',
      '¿Deseas eliminar esta notificación permanentemente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: deletedById, error: errById } = await supabase
                .from('notificaciones')
                .delete()
                .eq('id', id)
                .select('id');
              if (errById) throw errById;

              if (!deletedById || deletedById.length === 0) {
                const { data: deletedByOwner, error: errByOwner } = await supabase
                  .from('notificaciones')
                  .delete()
                  .eq('id', id)
                  .eq('user_id', userId)
                  .select('id');
                if (errByOwner) throw errByOwner;
                if (!deletedByOwner || deletedByOwner.length === 0) {
                  throw new Error('No se pudo eliminar la notificación (permisos o registro inexistente).');
                }
              }

              setNotifs(prev => prev.filter(n => n.id !== id));
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'No se pudo eliminar la notificación.');
            }
          },
        },
      ]
    );
  }, [userId]);

  const renderItem = ({ item }: { item: any }) => {
    const cfg = TIPO_CONFIG[item.tipo] ?? TIPO_CONFIG.info;
    const fecha = new Date(item.created_at).toLocaleString('es-MX', {
      dateStyle: 'medium', timeStyle: 'short',
    });
    return (
      <View style={[styles.card, { backgroundColor: cfg.bg, borderColor: item.leida ? '#2A2D35' : cfg.color }]}>
        <Text style={styles.cardIcon}>{cfg.icon}</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => marcarLeida(item.id, !!item.leida)}
          style={{ flex: 1 }}
        >
          <Text style={[styles.cardTitulo, { color: item.leida ? '#A0A0A0' : '#FFF' }]}>{item.titulo}</Text>
          <Text style={styles.cardMensaje}>{item.mensaje}</Text>
          <Text style={styles.cardFecha}>{fecha}</Text>
        </TouchableOpacity>
        {!item.leida && <View style={[styles.dot, { backgroundColor: cfg.color }]} />}
        <TouchableOpacity style={styles.deleteBtn} onPress={() => borrarNotif(item.id)}>
          <Text style={styles.deleteBtnTxt}>🗑</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const listaVisible = showRead ? notifs.filter(n => n.leida) : notifs.filter(n => !n.leida);
  const leidasCount = notifs.filter(n => n.leida).length;

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}><ActivityIndicator size="large" color="#9B59B6" /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔔 Notificaciones</Text>
        {leidasCount > 0 && (
          <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowRead(v => !v)}>
            <Text style={styles.toggleBtnTxt}>{showRead ? 'Ver no leídas' : 'Ver leídas'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={listaVisible}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor="#9B59B6" />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>Sin notificaciones todavía</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0A0C10' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:      { padding: 16, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  toggleBtn:   { marginTop: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(155,89,182,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#9B59B6' },
  toggleBtnTxt:{ color: '#C589E8', fontSize: 12, fontWeight: '700' },
  list:        { padding: 14, paddingBottom: 40 },
  card:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardIcon:    { fontSize: 26, marginTop: 2 },
  cardTitulo:  { fontWeight: 'bold', fontSize: 14, marginBottom: 3 },
  cardMensaje: { color: '#A0A0A0', fontSize: 13, lineHeight: 18 },
  cardFecha:   { color: '#505050', fontSize: 11, marginTop: 6 },
  dot:         { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  deleteBtn:   { marginLeft: 4, paddingHorizontal: 4, paddingVertical: 2 },
  deleteBtnTxt:{ fontSize: 14, color: '#A0A0A0' },
  emptyBox:    { alignItems: 'center', paddingTop: 80 },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyText:   { color: '#505050', fontSize: 16 },
});
