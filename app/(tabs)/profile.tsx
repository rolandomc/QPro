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
  ganador:  { icon: '🏆', color: '#FFD700' },
  perdedor: { icon: '😔', color: '#606060' },
  info:     { icon: '📢', color: '#00E5FF' },
};

export default function ProfileScreen() {
  const router = useRouter();
  const [username,      setUsername]      = useState('');
  const [displayName,   setDisplayName]   = useState('');
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [signingOut,    setSigningOut]    = useState(false);
  const [notifs,        setNotifs]        = useState<any[]>([]);
  const [notifExpanded, setNotifExpanded] = useState(false);

  const [stats, setStats] = useState({
    jugadas: 0, ganadas: 0, pctAcierto: 0,
    roi: 0, invertido: 0, ganado: 0, mejorPos: null as number | null,
  });

  const loadUserData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const adminStatus = await AdminService.isAdmin();
      setIsAdmin(adminStatus);

      // Leer perfil: username, display_name, nombre, apellido
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, display_name, nombre, apellido')
        .eq('id', user.id)
        .single();

      const uname = profile?.username ?? '';
      const dname = profile?.display_name
        || (profile?.nombre && profile?.apellido
              ? `${profile.nombre} ${profile.apellido}`.trim()
              : '')
        || uname;

      setUsername(uname);
      setDisplayName(dname);

      // Traemos todas las participaciones con info de quiniela
      const { data: parts } = await supabase
        .from('participaciones')
        .select(`
          id, estado, aciertos, monto_pagado, premio_ganado, quiniela_id,
          quinielas ( estado ),
          selecciones ( partido_id, prediccion, partidos ( resultado ) )
        `)
        .eq('user_id', user.id);

      const finalizadas = (parts || []).filter((p: any) =>
        p.quinielas?.estado === 'finalizada' ||
        p.estado === 'ganador' ||
        p.estado === 'perdedor'
      );

      const jugadas   = finalizadas.length;
      const ganadas   = finalizadas.filter((p: any) => p.estado === 'ganador').length;
      const invertido = finalizadas.reduce((a: number, p: any) => a + (p.monto_pagado ?? 0), 0);
      const ganado    = finalizadas.reduce((a: number, p: any) => a + (p.premio_ganado ?? 0), 0);

      let totalAc = 0; let totalPts = 0;
      finalizadas.forEach((p: any) => {
        (p.selecciones || []).forEach((s: any) => {
          if (s.partidos?.resultado !== null && s.partidos?.resultado !== undefined) {
            totalPts++;
            if (s.prediccion === s.partidos?.resultado) totalAc++;
          }
        });
      });
      const pctAcierto = totalPts > 0 ? Math.round((totalAc / totalPts) * 100) : 0;
      const roi        = invertido > 0 ? Math.round(((ganado - invertido) / invertido) * 100) : 0;

      let mejorPos: number | null = null;
      for (const p of finalizadas) {
        const { data: rank } = await supabase
          .from('participaciones')
          .select('user_id, aciertos')
          .eq('quiniela_id', p.quiniela_id)
          .in('estado', ['ganador', 'perdedor'])
          .order('aciertos', { ascending: false });
        if (rank) {
          const pos = rank.findIndex((r: any) => r.user_id === user.id);
          if (pos >= 0) {
            const p1 = pos + 1;
            if (mejorPos === null || p1 < mejorPos) mejorPos = p1;
          }
        }
      }

      setStats({ jugadas, ganadas, pctAcierto, roi, invertido, ganado, mejorPos });

      // Notificaciones
      const { data: notifsData } = await supabase
        .from('notificaciones').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(20);
      setNotifs(notifsData || []);
      if ((notifsData || []).some((n: any) => !n.leida)) {
        await supabase.from('notificaciones').update({ leida: true })
          .eq('user_id', user.id).eq('leida', false);
      }
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); loadUserData(); }, []));

  const handleSignOut = async () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        setSigningOut(true);
        try { await AuthService.signOut(); }
        catch (e: any) { Alert.alert('Error', e.message); setSigningOut(false); }
      }},
    ]);
  };

  // Iniciales: primeras 2 letras del displayName o username
  const initials = (displayName || username)
    ? (displayName || username).substring(0, 2).toUpperCase()
    : '?';

  const roiColor = stats.roi >= 0 ? '#2ECC71' : '#E91E63';
  const noLeidas = notifs.filter(n => !n.leida).length;

  const nivel  = stats.jugadas >= 20 ? 'Oráculo' : stats.jugadas >= 10 ? 'Estratéga' : stats.jugadas >= 5 ? 'Analista' : 'Novato';
  const niveXP = stats.jugadas * 100;
  const nextXP = Math.ceil((stats.jugadas + 1) / 5) * 5 * 100;
  const xpPct  = Math.min((niveXP / nextXP) * 100, 100);

  if (loading) return (
    <SafeAreaView style={st.container}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#9B59B6" />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar + nombre */}
        <View style={st.heroSection}>
          <View style={st.avatarWrap}>
            <View style={st.avatarNeonRing}>
              <View style={st.avatar}>
                <Text style={st.avatarTxt}>{initials}</Text>
              </View>
            </View>
            {isAdmin && (
              <View style={st.adminPill}>
                <Text style={st.adminPillTxt}>👑 ADMIN</Text>
              </View>
            )}
          </View>

          {/* Nombre completo */}
          <Text style={st.nombre}>{displayName || username || 'Usuario'}</Text>
          {/* @username — siempre visible */}
          {username ? (
            <View style={st.usernamePill}>
              <Text style={st.usernamePillTxt}>@{username}</Text>
            </View>
          ) : null}

          <View style={st.nivelBox}>
            <View style={st.nivelRow}>
              <Text style={st.nivelLabel}>RANGO</Text>
              <Text style={[st.nivelNombre, { textShadowColor: '#9B59B6', textShadowRadius: 8 }]}>{nivel}</Text>
            </View>
            <View style={st.xpTrack}>
              <View style={[st.xpFill, { width: `${xpPct}%` }]} />
            </View>
            <Text style={st.xpTxt}>{niveXP} / {nextXP} XP</Text>
          </View>
        </View>

        {/* Stats grid */}
        <View style={st.statsCard}>
          <View style={st.statsNeonLine} />
          <Text style={st.statsTitle}>ESTADÍSTICAS DE TEMPORADA</Text>
          <View style={st.statsGrid}>
            {[
              { v: String(stats.jugadas),                              l: 'JUGADAS', c: '#00E5FF' },
              { v: String(stats.ganadas),                              l: 'GANADAS', c: '#FFD700' },
              { v: `${stats.pctAcierto}%`,                             l: 'ACIERTO', c: '#9B59B6' },
              { v: `${stats.roi >= 0 ? '+' : ''}${stats.roi}%`,       l: 'ROI',     c: roiColor  },
            ].map((item, i, arr) => (
              <React.Fragment key={i}>
                <View style={st.statItem}>
                  <Text style={[st.statVal, { color: item.c, textShadowColor: item.c, textShadowRadius: 8 }]}>
                    {item.v}
                  </Text>
                  <Text style={st.statLbl}>{item.l}</Text>
                </View>
                {i < arr.length - 1 && <View style={st.statDiv} />}
              </React.Fragment>
            ))}
          </View>
          <View style={st.statsBottomRow}>
            <View style={st.statsFinBox}>
              <Text style={st.statsFinLbl}>MEJOR POSICIÓN</Text>
              <Text style={[st.statsFinVal, { color: stats.mejorPos === 1 ? '#FFD700' : '#FFF' }]}>
                {stats.mejorPos != null ? `#${stats.mejorPos}` : '—'}
              </Text>
            </View>
            <View style={[st.statsFinBox, { borderLeftWidth: 1, borderLeftColor: '#1E2330' }]}>
              <Text style={st.statsFinLbl}>INVERTIDO</Text>
              <Text style={st.statsFinVal}>${stats.invertido.toLocaleString()}</Text>
            </View>
            <View style={[st.statsFinBox, { borderLeftWidth: 1, borderLeftColor: '#1E2330' }]}>
              <Text style={st.statsFinLbl}>GANADO</Text>
              <Text style={[st.statsFinVal, { color: '#2ECC71', textShadowColor: '#2ECC71', textShadowRadius: 6 }]}>
                ${stats.ganado.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Logros */}
        <View style={st.sectionHeader}>
          <View style={st.sectionLine} />
          <Text style={st.sectionTitle}>LOGROS</Text>
          <View style={st.sectionLine} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 2 }}>
            <Badge icon="🎯" title="Pleno Perfecto" isUnlocked={stats.ganadas >= 1}     neonColor="#E91E63" />
            <Badge icon="🔥" title="Racha x3"       isUnlocked={stats.jugadas >= 3}    neonColor="#F39C12" />
            <Badge icon="💰" title="Bolsa Mayor"    isUnlocked={stats.ganado >= 1000}  neonColor="#FFD700" />
            <Badge icon="🔮" title="Vidente"        isUnlocked={stats.pctAcierto >= 80} neonColor="#9B59B6" />
          </View>
        </ScrollView>

        {/* Admin */}
        {isAdmin && (
          <TouchableOpacity style={st.adminCard} onPress={() => router.push('/admin')}>
            <View style={st.adminCardNeonLine} />
            <View style={st.adminCardBody}>
              <Text style={{ fontSize: 26 }}>🛠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.adminCardTitle}>Panel Administrador</Text>
                <Text style={st.adminCardSub}>Gestionar quinielas y resultados</Text>
              </View>
              <Text style={st.adminCardArrow}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Notificaciones */}
        <TouchableOpacity style={st.notifToggle} onPress={() => setNotifExpanded(v => !v)}>
          <Text style={st.notifToggleTxt}>🔔 NOTIFICACIONES</Text>
          {noLeidas > 0 && (
            <View style={st.notifDot}>
              <Text style={st.notifDotTxt}>{noLeidas}</Text>
            </View>
          )}
          <Text style={st.notifChevron}>{notifExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {notifExpanded && (
          <View style={{ gap: 8, marginBottom: 16 }}>
            {notifs.length === 0 ? (
              <Text style={st.emptyTxt}>Sin notificaciones todavía</Text>
            ) : notifs.map(n => {
              const cfg  = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.info;
              const fecha = new Date(n.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
              return (
                <View key={n.id} style={[st.notifCard, !n.leida && { borderColor: cfg.color }]}>
                  <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.notifTitulo, !n.leida && { color: '#FFF' }]}>{n.titulo}</Text>
                    <Text style={st.notifMsg}>{n.mensaje}</Text>
                    <Text style={st.notifFecha}>{fecha}</Text>
                  </View>
                  {!n.leida && <View style={[st.dotUnread, { backgroundColor: cfg.color }]} />}
                </View>
              );
            })}
          </View>
        )}

        {/* Cerrar sesion */}
        <TouchableOpacity style={st.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
          {signingOut
            ? <ActivityIndicator color="#E74C3C" />
            : <Text style={st.signOutTxt}>🚨 Cerrar Sesión</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0A0C10' },
  scroll:           { padding: 16, paddingBottom: 50 },
  heroSection:      { alignItems: 'center', marginBottom: 24 },
  avatarWrap:       { marginBottom: 14, alignItems: 'center' },
  avatarNeonRing:   { width: 92, height: 92, borderRadius: 46, borderWidth: 2,
                      borderColor: '#9B59B6', justifyContent: 'center', alignItems: 'center',
                      shadowColor: '#9B59B6', shadowOpacity: 0.6, shadowRadius: 16, elevation: 8 },
  avatar:           { width: 80, height: 80, borderRadius: 40,
                      backgroundColor: '#15181F', justifyContent: 'center', alignItems: 'center' },
  avatarTxt:        { color: '#FFF', fontSize: 28, fontWeight: 'bold',
                      textShadowColor: '#9B59B6', textShadowRadius: 10 },
  adminPill:        { marginTop: 8, backgroundColor: 'rgba(255,215,0,0.1)',
                      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3,
                      borderWidth: 1, borderColor: '#FFD700' },
  adminPillTxt:     { color: '#FFD700', fontWeight: 'bold', fontSize: 11, letterSpacing: 1 },
  nombre:           { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  usernamePill:     { backgroundColor: 'rgba(155,89,182,0.12)', borderRadius: 20,
                      paddingHorizontal: 14, paddingVertical: 4, marginBottom: 16,
                      borderWidth: 1, borderColor: '#9B59B655' },
  usernamePillTxt:  { color: '#9B59B6', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  nivelBox:         { width: '100%', backgroundColor: '#0D1117', borderRadius: 14, padding: 14,
                      borderWidth: 1, borderColor: '#1E2330' },
  nivelRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  nivelLabel:       { color: '#404040', fontSize: 10, letterSpacing: 2 },
  nivelNombre:      { color: '#9B59B6', fontSize: 15, fontWeight: 'bold' },
  xpTrack:          { height: 6, backgroundColor: '#1A1D24', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  xpFill:           { height: '100%', backgroundColor: '#9B59B6',
                      shadowColor: '#9B59B6', shadowOpacity: 0.8, shadowRadius: 4 },
  xpTxt:            { color: '#303030', fontSize: 10, textAlign: 'right', letterSpacing: 1 },
  statsCard:        { backgroundColor: '#0D1117', borderRadius: 18, marginBottom: 20,
                      borderWidth: 1, borderColor: '#1E2330', overflow: 'hidden',
                      shadowColor: '#9B59B6', shadowOpacity: 0.15, shadowRadius: 14, elevation: 5 },
  statsNeonLine:    { height: 2, backgroundColor: '#9B59B6',
                      shadowColor: '#9B59B6', shadowOpacity: 1, shadowRadius: 8 },
  statsTitle:       { color: '#303030', fontSize: 9, fontWeight: 'bold', letterSpacing: 3,
                      textAlign: 'center', paddingTop: 14, paddingBottom: 10 },
  statsGrid:        { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center' },
  statItem:         { flex: 1, alignItems: 'center' },
  statVal:          { fontSize: 22, fontWeight: 'bold' },
  statLbl:          { color: '#303030', fontSize: 8, letterSpacing: 1.5, marginTop: 3 },
  statDiv:          { width: 1, height: 32, backgroundColor: '#1E2330' },
  statsBottomRow:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1E2330' },
  statsFinBox:      { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statsFinLbl:      { color: '#303030', fontSize: 8, letterSpacing: 2, marginBottom: 4 },
  statsFinVal:      { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionLine:      { flex: 1, height: 1, backgroundColor: '#1E2330' },
  sectionTitle:     { color: '#404040', fontSize: 9, fontWeight: 'bold', letterSpacing: 3 },
  adminCard:        { backgroundColor: '#0D1117', borderRadius: 16, marginBottom: 20,
                      borderWidth: 1, borderColor: '#1E2330', overflow: 'hidden',
                      shadowColor: '#FFD700', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  adminCardNeonLine:{ height: 2, backgroundColor: '#FFD700',
                      shadowColor: '#FFD700', shadowOpacity: 1, shadowRadius: 8 },
  adminCardBody:    { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  adminCardTitle:   { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  adminCardSub:     { color: '#404040', fontSize: 12, marginTop: 2 },
  adminCardArrow:   { color: '#FFD700', fontSize: 24 },
  notifToggle:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D1117',
                      borderRadius: 12, padding: 14, marginBottom: 10,
                      borderWidth: 1, borderColor: '#1E2330', gap: 8 },
  notifToggleTxt:   { color: '#404040', fontSize: 11, fontWeight: 'bold', letterSpacing: 2, flex: 1 },
  notifDot:         { backgroundColor: '#E74C3C', borderRadius: 10, minWidth: 20, height: 20,
                      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  notifDotTxt:      { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  notifChevron:     { color: '#303030', fontSize: 11 },
  notifCard:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                      backgroundColor: '#0D1117', borderRadius: 12, padding: 12,
                      borderWidth: 1, borderColor: '#1E2330' },
  notifTitulo:      { color: '#606060', fontWeight: 'bold', fontSize: 13, marginBottom: 2 },
  notifMsg:         { color: '#404040', fontSize: 12, lineHeight: 17 },
  notifFecha:       { color: '#303030', fontSize: 10, marginTop: 4 },
  dotUnread:        { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  emptyTxt:         { color: '#404040', textAlign: 'center', padding: 20, letterSpacing: 1 },
  signOutBtn:       { marginTop: 8, padding: 15, borderRadius: 14,
                      borderWidth: 1, borderColor: 'rgba(231,76,60,0.4)',
                      alignItems: 'center', backgroundColor: 'rgba(231,76,60,0.05)',
                      shadowColor: '#E74C3C', shadowOpacity: 0.2, shadowRadius: 8 },
  signOutTxt:       { color: '#E74C3C', fontWeight: 'bold', fontSize: 15, letterSpacing: 1 },
});
