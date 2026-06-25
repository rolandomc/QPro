import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
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

  const cargar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifs(data || []);
    setLoading(false);
    setRefreshing(false);

    // Marcar todas como leídas automáticamente al abrir
    if ((data || []).some(n => !n.leida)) {
      await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('user_id', user.id)
        .eq('leida', false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); cargar(); }, []));

  const renderItem = ({ item }: { item: any }) => {
    const cfg = TIPO_CONFIG[item.tipo] ?? TIPO_CONFIG.info;
    const fecha = new Date(item.created_at).toLocaleString('es-MX', {
      dateStyle: 'medium', timeStyle: 'short',
    });
    return (
      <View style={[styles.card, { backgroundColor: cfg.bg, borderColor: item.leida ? '#2A2D35' : cfg.color }]}>
        <Text style={styles.cardIcon}>{cfg.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitulo, { color: item.leida ? '#A0A0A0' : '#FFF' }]}>{item.titulo}</Text>
          <Text style={styles.cardMensaje}>{item.mensaje}</Text>
          <Text style={styles.cardFecha}>{fecha}</Text>
        </View>
        {!item.leida && <View style={[styles.dot, { backgroundColor: cfg.color }]} />}
      </View>
    );
  };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}><ActivityIndicator size="large" color="#9B59B6" /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔔 Notificaciones</Text>
      </View>
      <FlatList
        data={notifs}
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
  list:        { padding: 14, paddingBottom: 40 },
  card:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardIcon:    { fontSize: 26, marginTop: 2 },
  cardTitulo:  { fontWeight: 'bold', fontSize: 14, marginBottom: 3 },
  cardMensaje: { color: '#A0A0A0', fontSize: 13, lineHeight: 18 },
  cardFecha:   { color: '#505050', fontSize: 11, marginTop: 6 },
  dot:         { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  emptyBox:    { alignItems: 'center', paddingTop: 80 },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyText:   { color: '#505050', fontSize: 16 },
});
