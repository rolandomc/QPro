import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Header from '../../src/components/Header';
import Badge from '../../src/components/Badge';
import { AuthService } from '../../src/services/auth.service';
import { AdminService } from '../../src/services/admin.service';
import { supabase } from '../../src/config/supabase';

const TIPO_CONFIG: Record<string, { icon: string; color: string }> = {
  ganador:  { icon: '🏆', color: '#F39C12' },
  perdedor: { icon: '😔', color: '#707070' },
  info:     { icon: '📢', color: '#3498DB' },
};

export default function ProfileScreen() {
  const router = useRouter();
  const [userEmail,     setUserEmail]     = useState('');
  const [username,      setUsername]      = useState('');
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [signingOut,    setSigningOut]    = useState(false);
  const [notifs,        setNotifs]        = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifExpanded, setNotifExpanded] = useState(false);

  const xpCurrent = 1250;
  const xpNextLevel = 2000;
  const xpPercentage = (xpCurrent / xpNextLevel) * 100;

  const loadUserData = useCallback(async () => {
    try {
      const user = await AuthService.getCurrentUser();
      if (user?.email) setUserEmail(user.email);
      const adminStatus = await AdminService.isAdmin();
      setIsAdmin(adminStatus);
      // Cargar username
      if (user?.id) {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
        if (profile?.username) setUsername(profile.username);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNotifs = useCallback(async () => {
    setLoadingNotifs(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingNotifs(false); return; }
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifs(data || []);
    setLoadingNotifs(false);
    // Marcar como leídas
    if ((data || []).some(n => !n.leida)) {
      await supabase.from('notificaciones').update({ leida: true })
        .eq('user_id', user.id).eq('leida', false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadUserData();
    loadNotifs();
  }, []));

  const handleSignOut = async () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try { await AuthService.signOut(); }
          catch (error: any) { Alert.alert('Error', error.message); setSigningOut(false); }
        },
      },
    ]);
  };

  const getInitials = () => {
    if (username) return username.substring(0, 2).toUpperCase();
    if (userEmail) return userEmail.substring(0, 2).toUpperCase();
    return '??';
  };

  const noLeidas = notifs.filter(n => !n.leida).length;

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2ECC71" />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Info del Usuario */}
        <View style={styles.userInfo}>
          <View style={[styles.avatar, styles.neonAvatarBlue]}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <Text style={styles.userName}>{username || userEmail}</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>👑 ADMIN</Text>
            </View>
          )}
          <View style={styles.levelContainer}>
            <Text style={styles.levelTitle}>Rango: <Text style={styles.neonTextOrange}>Estratega</Text></Text>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${xpPercentage}%` }]} />
            </View>
            <Text style={styles.xpText}>{xpCurrent} / {xpNextLevel} XP para Oráculo</Text>
          </View>
        </View>

        {/* Estadísticas */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.neonCardPurple]}>
            <Text style={styles.statValue}>24</Text>
            <Text style={styles.statLabel}>Quinielas</Text>
          </View>
          <View style={[styles.statCard, styles.neonCardGreen]}>
            <Text style={styles.statValue}>68%</Text>
            <Text style={styles.statLabel}>Aciertos</Text>
          </View>
        </View>

        {/* Logros */}
        <Text style={styles.sectionTitle}>Tus Logros</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesContainer}>
          <Badge icon="🎯" title="Pleno Perfecto" isUnlocked={true} neonColor="#E91E63" />
          <Badge icon="🔥" title="Racha x3" isUnlocked={true} neonColor="#F39C12" />
          <Badge icon="💰" title="Bolsa Mayor" isUnlocked={false} />
          <Badge icon="🔮" title="Vidente" isUnlocked={false} />
        </ScrollView>

        {/* Panel Admin */}
        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>Panel Administrador</Text>
            <TouchableOpacity style={styles.adminCard} onPress={() => router.push('/admin')}>
              <Text style={styles.adminCardIcon}>🛠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminCardTitle}>Gestionar Quinielas</Text>
                <Text style={styles.adminCardSubtitle}>Crear, editar y publicar quinielas</Text>
              </View>
              <Text style={styles.adminCardArrow}>›</Text>
            </TouchableOpacity>
          </>
        )}

        {/* 🔔 Notificaciones */}
        <TouchableOpacity
          style={styles.notifHeader}
          onPress={() => setNotifExpanded(prev => !prev)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Text style={styles.sectionTitle}>🔔 Notificaciones</Text>
            {noLeidas > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{noLeidas}</Text>
              </View>
            )}
          </View>
          <Text style={styles.chevron}>{notifExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {notifExpanded && (
          <View style={styles.notifList}>
            {loadingNotifs ? (
              <ActivityIndicator color="#9B59B6" style={{ padding: 20 }} />
            ) : notifs.length === 0 ? (
              <Text style={styles.notifEmpty}>Sin notificaciones todavía</Text>
            ) : (
              notifs.map(n => {
                const cfg = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.info;
                const fecha = new Date(n.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
                return (
                  <View key={n.id} style={[styles.notifCard, !n.leida && { borderColor: cfg.color }]}>
                    <Text style={styles.notifIcon}>{cfg.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.notifTitulo, !n.leida && { color: '#FFF' }]}>{n.titulo}</Text>
                      <Text style={styles.notifMensaje}>{n.mensaje}</Text>
                      <Text style={styles.notifFecha}>{fecha}</Text>
                    </View>
                    {!n.leida && <View style={[styles.dotUnread, { backgroundColor: cfg.color }]} />}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Ajustes */}
        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Ajustes</Text>
        <TouchableOpacity style={styles.optionRow}>
          <Text style={styles.optionIcon}>⚙️</Text>
          <Text style={styles.optionText}>Configuración de la cuenta</Text>
          <Text style={styles.optionArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.optionRow}>
          <Text style={styles.optionIcon}>🛡️</Text>
          <Text style={styles.optionText}>Privacidad y Seguridad</Text>
          <Text style={styles.optionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
          {signingOut
            ? <ActivityIndicator color="#E74C3C" />
            : <Text style={styles.signOutText}>🚨 Cerrar Sesión</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0A0C10' },
  content:          { padding: 15, paddingBottom: 40 },
  userInfo:         { alignItems: 'center', marginBottom: 25 },
  avatar:           { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1C1F26', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2 },
  neonAvatarBlue:   { borderColor: '#3498DB' },
  avatarText:       { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  userName:         { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  adminBadge:       { backgroundColor: 'rgba(243,156,18,0.15)', borderWidth: 1, borderColor: '#F39C12', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  adminBadgeText:   { color: '#F39C12', fontWeight: 'bold', fontSize: 12 },
  levelContainer:   { width: '100%', backgroundColor: '#15181F', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#2A2D35' },
  levelTitle:       { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  neonTextOrange:   { color: '#F39C12' },
  xpTrack:          { height: 8, backgroundColor: '#1C1F26', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  xpFill:           { height: '100%', backgroundColor: '#F39C12' },
  xpText:           { color: '#707070', fontSize: 10, textAlign: 'right' },
  statsRow:         { flexDirection: 'row', gap: 15, marginBottom: 30 },
  statCard:         { flex: 1, backgroundColor: '#15181F', borderRadius: 12, padding: 15, alignItems: 'center', borderWidth: 1.5 },
  neonCardPurple:   { borderColor: '#9B59B6' },
  neonCardGreen:    { borderColor: '#2ECC71' },
  statValue:        { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  statLabel:        { color: '#A0A0A0', fontSize: 12, textTransform: 'uppercase' },
  sectionTitle:     { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 15, paddingHorizontal: 5 },
  badgesContainer:  { marginBottom: 30, paddingLeft: 5 },
  adminCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(243,156,18,0.08)', borderWidth: 1, borderColor: '#F39C12', borderRadius: 12, padding: 15, marginBottom: 20 },
  adminCardIcon:    { fontSize: 24, marginRight: 12 },
  adminCardTitle:   { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  adminCardSubtitle:{ color: '#A0A0A0', fontSize: 12, marginTop: 2 },
  adminCardArrow:   { color: '#F39C12', fontSize: 22 },
  // Notificaciones
  notifHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 5 },
  notifBadge:       { backgroundColor: '#E74C3C', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  notifBadgeText:   { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  chevron:          { color: '#505050', fontSize: 14 },
  notifList:        { marginBottom: 20, gap: 8 },
  notifEmpty:       { color: '#505050', textAlign: 'center', paddingVertical: 20 },
  notifCard:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#15181F', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2A2D35' },
  notifIcon:        { fontSize: 22, marginTop: 1 },
  notifTitulo:      { color: '#A0A0A0', fontWeight: 'bold', fontSize: 13, marginBottom: 2 },
  notifMensaje:     { color: '#707070', fontSize: 12, lineHeight: 17 },
  notifFecha:       { color: '#404040', fontSize: 10, marginTop: 4 },
  dotUnread:        { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  // Opciones
  optionRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15181F', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2A2D35' },
  optionIcon:       { fontSize: 18, marginRight: 12 },
  optionText:       { color: '#FFF', flex: 1, fontSize: 14 },
  optionArrow:      { color: '#505050', fontSize: 20 },
  signOutBtn:       { marginTop: 10, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E74C3C', alignItems: 'center', backgroundColor: 'rgba(231,76,60,0.08)' },
  signOutText:      { color: '#E74C3C', fontWeight: 'bold', fontSize: 16 },
});
