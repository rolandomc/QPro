import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Alert, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  TouchableWithoutFeedback, Image, Platform, LayoutAnimation, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Header from '../../src/components/Header';
import Badge from '../../src/components/Badge';
import { AuthService } from '../../src/services/auth.service';
import { AdminService } from '../../src/services/admin.service';
import { supabase } from '../../src/config/supabase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ESTADO_RETIRO_CFG: Record<string, { color: string; bg: string; border: string; emoji: string; label: string }> = {
  pendiente: { color: '#F39C12', bg: 'rgba(243,156,18,0.10)',  border: 'rgba(243,156,18,0.3)',  emoji: '⏳', label: 'Pendiente' },
  pagado:    { color: '#2ECC71', bg: 'rgba(46,204,113,0.10)',  border: 'rgba(46,204,113,0.3)',  emoji: '✅', label: 'Pagado'    },
  rechazado: { color: '#E74C3C', bg: 'rgba(231,76,60,0.10)',   border: 'rgba(231,76,60,0.3)',   emoji: '❌', label: 'Rechazado' },
};

function formatFechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProfileScreen() {
  const router = useRouter();
  const [username,    setUsername]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [fullName,    setFullName]    = useState<string | null>(null);
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null);
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [signingOut,  setSigningOut]  = useState(false);
  const [userId,      setUserId]      = useState<string>('');

  const [editModal,    setEditModal]    = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar,   setEditAvatar]   = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);

  const [stats, setStats] = useState({
    jugadas: 0, ganadas: 0, pctAcierto: 0,
    roi: 0, invertido: 0, ganado: 0, mejorPos: null as number | null,
  });

  // Retiros
  const [retirosOpen,    setRetirosOpen]    = useState(false);
  const [retiros,        setRetiros]        = useState<any[]>([]);
  const [loadingRetiros, setLoadingRetiros] = useState(false);
  const [visorUrl,       setVisorUrl]       = useState<string | null>(null);
  const [visorModal,     setVisorModal]     = useState(false);

  const cargarRetiros = useCallback(async (uid: string) => {
    setLoadingRetiros(true);
    try {
      const { data } = await supabase
        .from('retiro_solicitudes')
        .select('id, monto, metodo, estado, nota_admin, comprobante_url, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      setRetiros(data ?? []);
    } catch (_) {}
    finally { setLoadingRetiros(false); }
  }, []);

  const toggleRetiros = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!retirosOpen && userId) cargarRetiros(userId);
    setRetirosOpen(v => !v);
  };

  const loadUserData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const adminStatus = await AdminService.isAdmin();
      setIsAdmin(adminStatus);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, display_name, nombre, apellido, full_name, avatar_url')
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
      setFullName(profile?.full_name ?? null);
      setAvatarUrl(profile?.avatar_url ?? null);

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

      // Si la sección de retiros estaba abierta, recargar
      if (retirosOpen) cargarRetiros(user.id);
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [retirosOpen, cargarRetiros]);

  useFocusEffect(useCallback(() => { setLoading(true); loadUserData(); }, [loadUserData]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
  }, [loadUserData]);

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

  const abrirEditModal = () => {
    setEditFullName(fullName ?? '');
    setEditUsername(username);
    setEditAvatar(avatarUrl);
    setEditModal(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para cambiar la foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: false,
    });
    if (!result.canceled && result.assets[0]) setEditAvatar(result.assets[0].uri);
  };

  const handleGuardarPerfil = async () => {
    if (!editFullName.trim()) {
      Alert.alert('Campo requerido', 'El nombre completo es necesario para procesar retiros.');
      return;
    }
    setSaving(true);
    try {
      let newAvatarUrl = avatarUrl;
      if (editAvatar && editAvatar !== avatarUrl) {
        const ext      = editAvatar.split('.').pop()?.toLowerCase() ?? 'jpg';
        const fileName = `${userId}_${Date.now()}.${ext}`;
        const response = await fetch(editAvatar);
        const blob     = await response.blob();
        const arrayBuf = await blob.arrayBuffer();
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(fileName, arrayBuf, { contentType: `image/${ext}`, upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        newAvatarUrl = urlData.publicUrl;
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name:  editFullName.trim(),
          username:   editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || username,
          avatar_url: newAvatarUrl,
        })
        .eq('id', userId);
      if (error) throw error;
      setFullName(editFullName.trim());
      setUsername(editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || username);
      setAvatarUrl(newAvatarUrl);
      setEditModal(false);
      Alert.alert('✅ Perfil actualizado', 'Tus datos han sido guardados correctamente.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const initials = (displayName || username)
    ? (displayName || username).substring(0, 2).toUpperCase()
    : '?';

  const roiColor  = stats.roi >= 0 ? '#2ECC71' : '#E91E63';
  const nivel     = stats.jugadas >= 20 ? 'Oráculo' : stats.jugadas >= 10 ? 'Estratéga' : stats.jugadas >= 5 ? 'Analista' : 'Novato';
  const niveXP    = stats.jugadas * 100;
  const nextXP    = Math.ceil((stats.jugadas + 1) / 5) * 5 * 100;
  const xpPct     = Math.min((niveXP / nextXP) * 100, 100);

  if (loading) return (
    <SafeAreaView style={st.container}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#9B59B6" />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <Header onRefresh={handleRefresh} />
      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        bounces
        overScrollMode="always"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#9B59B6" colors={['#9B59B6']} />
        }
      >
        {/* Hero */}
        <View style={st.heroSection}>
          <View style={st.avatarWrap}>
            <View style={st.avatarNeonRing}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={st.avatarImg} />
                : <View style={st.avatar}><Text style={st.avatarTxt}>{initials}</Text></View>}
            </View>
            {isAdmin && (
              <View style={st.adminPill}><Text style={st.adminPillTxt}>👑 ADMIN</Text></View>
            )}
          </View>
          <Text style={st.nombre}>{displayName || username || 'Usuario'}</Text>
          {username ? (
            <View style={st.usernamePill}><Text style={st.usernamePillTxt}>@{username}</Text></View>
          ) : null}
          <TouchableOpacity style={st.editBtn} onPress={abrirEditModal}>
            <Text style={st.editBtnTxt}>✏️ Editar perfil</Text>
          </TouchableOpacity>
          {!fullName && (
            <TouchableOpacity style={st.alertaRetiro} onPress={abrirEditModal}>
              <Text style={st.alertaRetiroTxt}>⚠️ Agrega tu nombre completo para poder realizar retiros</Text>
            </TouchableOpacity>
          )}
          <View style={st.nivelBox}>
            <View style={st.nivelRow}>
              <Text style={st.nivelLabel}>RANGO</Text>
              <Text style={[st.nivelNombre, { textShadowColor: '#9B59B6', textShadowRadius: 8 }]}>{nivel}</Text>
            </View>
            <View style={st.xpTrack}><View style={[st.xpFill, { width: `${xpPct}%` }]} /></View>
            <Text style={st.xpTxt}>{niveXP} / {nextXP} XP</Text>
          </View>
        </View>

        {/* Estadísticas */}
        <View style={st.statsCard}>
          <View style={st.statsNeonLine} />
          <Text style={st.statsTitle}>ESTADÍSTICAS DE TEMPORADA</Text>
          <View style={st.statsGrid}>
            {[
              { v: String(stats.jugadas),                        l: 'JUGADAS', c: '#00E5FF' },
              { v: String(stats.ganadas),                        l: 'GANADAS', c: '#FFD700' },
              { v: `${stats.pctAcierto}%`,                       l: 'ACIERTO', c: '#9B59B6' },
              { v: `${stats.roi >= 0 ? '+' : ''}${stats.roi}%`, l: 'ROI',     c: roiColor  },
            ].map((item, i, arr) => (
              <React.Fragment key={i}>
                <View style={st.statItem}>
                  <Text style={[st.statVal, { color: item.c, textShadowColor: item.c, textShadowRadius: 8 }]}>{item.v}</Text>
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

        {/* ── Historial de Retiros ── */}
        <TouchableOpacity style={st.retirosToggle} onPress={toggleRetiros} activeOpacity={0.8}>
          <View style={st.retirosToggleLeft}>
            <Text style={st.retirosToggleIcon}>💸</Text>
            <Text style={st.retirosToggleTitle}>Mis Retiros</Text>
          </View>
          <Text style={st.retirosToggleArrow}>{retirosOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {retirosOpen && (
          <View style={st.retirosContainer}>
            {loadingRetiros ? (
              <View style={{ alignItems: 'center', padding: 20 }}>
                <ActivityIndicator color="#9B59B6" />
              </View>
            ) : retiros.length === 0 ? (
              <View style={st.retirosEmpty}>
                <Text style={st.retirosEmptyTxt}>Sin retiros registrados</Text>
              </View>
            ) : (
              retiros.map((r) => {
                const cfg = ESTADO_RETIRO_CFG[r.estado] ?? ESTADO_RETIRO_CFG['pendiente'];
                return (
                  <View key={r.id} style={[st.retiroCard, { borderColor: cfg.border }]}>
                    <View style={st.retiroCardHeader}>
                      <View style={[st.retiroEstadoBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                        <Text style={[st.retiroEstadoTxt, { color: cfg.color }]}>
                          {cfg.emoji} {cfg.label}
                        </Text>
                      </View>
                      <Text style={st.retiroFecha}>{formatFechaCorta(r.created_at)}</Text>
                    </View>

                    <View style={st.retiroMontoRow}>
                      <Text style={st.retiroMonto}>
                        ${Number(r.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </Text>
                      <Text style={st.retiroMxn}> MXN</Text>
                      <View style={{ flex: 1 }} />
                      <View style={[st.retiroMetodoBadge, r.metodo === 'spei' ? st.metodoBadgeSPEI : st.metodoBadgeMP]}>
                        <Text style={[st.retiroMetodoTxt, r.metodo === 'spei' ? { color: '#3498DB' } : { color: '#00B1EA' }]}>
                          {r.metodo === 'spei' ? '🏦 SPEI' : '💳 MP'}
                        </Text>
                      </View>
                    </View>

                    {r.nota_admin ? (
                      <View style={st.retiroNotaBox}>
                        <Text style={st.retiroNotaLabel}>📝 Motivo</Text>
                        <Text style={st.retiroNotaVal}>{r.nota_admin}</Text>
                      </View>
                    ) : null}

                    {r.comprobante_url ? (
                      <TouchableOpacity
                        style={st.retiroCompBtn}
                        onPress={() => { setVisorUrl(r.comprobante_url); setVisorModal(true); }}
                        activeOpacity={0.8}
                      >
                        <Text style={st.retiroCompBtnTxt}>🧾 Ver comprobante</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Panel Admin */}
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

        {/* Cerrar sesión */}
        <TouchableOpacity style={st.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
          {signingOut ? <ActivityIndicator color="#E74C3C" /> : <Text style={st.signOutTxt}>🚨 Cerrar Sesión</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal editar perfil */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <TouchableWithoutFeedback onPress={() => setEditModal(false)}>
          <View style={st.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={st.modalCard}>
                <Text style={st.modalTitle}>✏️ Editar Perfil</Text>
                <View style={st.avatarEditRow}>
                  <TouchableOpacity onPress={pickImage} style={st.avatarEditWrap}>
                    {editAvatar
                      ? <Image source={{ uri: editAvatar }} style={st.avatarEditImg} />
                      : <View style={st.avatarEditPlaceholder}><Text style={st.avatarEditInitials}>{initials}</Text></View>}
                    <View style={st.avatarEditOverlay}><Text style={st.avatarEditCamara}>📷</Text></View>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={st.avatarEditHint}>Toca la foto para cambiarla</Text>
                    <Text style={st.avatarEditSub}>Imagen cuadrada recomendada</Text>
                  </View>
                </View>
                <Text style={st.inputLabel}>NOMBRE COMPLETO <Text style={{ color: '#E74C3C' }}>*</Text></Text>
                <TextInput
                  style={st.input}
                  placeholder="Ej. Juan Pérez García"
                  placeholderTextColor="#404050"
                  value={editFullName}
                  onChangeText={setEditFullName}
                  autoCapitalize="words"
                />
                <Text style={st.inputHint}>Requerido para procesar retiros 💸</Text>
                <Text style={[st.inputLabel, { marginTop: 14 }]}>USUARIO</Text>
                <View style={st.inputUsernameWrap}>
                  <Text style={st.inputPrefix}>@</Text>
                  <TextInput
                    style={[st.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="tu_usuario"
                    placeholderTextColor="#404050"
                    value={editUsername}
                    onChangeText={v => setEditUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    autoCapitalize="none"
                  />
                </View>
                <View style={st.modalBtns}>
                  <TouchableOpacity style={st.cancelBtn} onPress={() => setEditModal(false)} disabled={saving}>
                    <Text style={st.cancelBtnTxt}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} onPress={handleGuardarPerfil} disabled={saving}>
                    {saving ? <ActivityIndicator color="#000" /> : <Text style={st.saveBtnTxt}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Visor comprobante retiro */}
      <Modal visible={visorModal} transparent animationType="fade" onRequestClose={() => setVisorModal(false)}>
        <TouchableWithoutFeedback onPress={() => setVisorModal(false)}>
          <View style={st.visorOverlay}>
            <TouchableWithoutFeedback>
              <View style={st.visorCard}>
                <Text style={st.visorTitle}>🧾 Comprobante de retiro</Text>
                {visorUrl ? (
                  <Image source={{ uri: visorUrl }} style={st.visorImg} resizeMode="contain" />
                ) : null}
                <TouchableOpacity style={st.visorCloseBtn} onPress={() => setVisorModal(false)}>
                  <Text style={st.visorCloseTxt}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container:             { flex: 1, backgroundColor: '#0A0C10' },
  scroll:                { padding: 16, paddingBottom: 120 },
  heroSection:           { alignItems: 'center', marginBottom: 24 },
  avatarWrap:            { marginBottom: 14, alignItems: 'center' },
  avatarNeonRing:        { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: '#9B59B6', justifyContent: 'center', alignItems: 'center', shadowColor: '#9B59B6', shadowOpacity: 0.6, shadowRadius: 16, elevation: 8, overflow: 'hidden' },
  avatar:                { width: 86, height: 86, borderRadius: 43, backgroundColor: '#15181F', justifyContent: 'center', alignItems: 'center' },
  avatarImg:             { width: 86, height: 86, borderRadius: 43 },
  avatarTxt:             { color: '#FFF', fontSize: 28, fontWeight: 'bold', textShadowColor: '#9B59B6', textShadowRadius: 10 },
  adminPill:             { marginTop: 8, backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3, borderWidth: 1, borderColor: '#FFD700' },
  adminPillTxt:          { color: '#FFD700', fontWeight: 'bold', fontSize: 11, letterSpacing: 1 },
  nombre:                { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  usernamePill:          { backgroundColor: 'rgba(155,89,182,0.12)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 10, borderWidth: 1, borderColor: '#9B59B655' },
  usernamePillTxt:       { color: '#9B59B6', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  editBtn:               { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(155,89,182,0.1)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, marginBottom: 12, borderWidth: 1, borderColor: '#9B59B655' },
  editBtnTxt:            { color: '#9B59B6', fontSize: 13, fontWeight: '600' },
  alertaRetiro:          { backgroundColor: 'rgba(243,156,18,0.1)', borderRadius: 12, borderWidth: 1, borderColor: '#F39C12', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, width: '100%' },
  alertaRetiroTxt:       { color: '#F39C12', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  nivelBox:              { width: '100%', backgroundColor: '#0D1117', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1E2330' },
  nivelRow:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  nivelLabel:            { color: '#404040', fontSize: 10, letterSpacing: 2 },
  nivelNombre:           { color: '#9B59B6', fontSize: 15, fontWeight: 'bold' },
  xpTrack:               { height: 6, backgroundColor: '#1A1D24', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  xpFill:                { height: '100%', backgroundColor: '#9B59B6', shadowColor: '#9B59B6', shadowOpacity: 0.8, shadowRadius: 4 },
  xpTxt:                 { color: '#303030', fontSize: 10, textAlign: 'right', letterSpacing: 1 },
  statsCard:             { backgroundColor: '#0D1117', borderRadius: 18, marginBottom: 20, borderWidth: 1, borderColor: '#1E2330', overflow: 'hidden', shadowColor: '#9B59B6', shadowOpacity: 0.15, shadowRadius: 14, elevation: 5 },
  statsNeonLine:         { height: 2, backgroundColor: '#9B59B6', shadowColor: '#9B59B6', shadowOpacity: 1, shadowRadius: 8 },
  statsTitle:            { color: '#303030', fontSize: 9, fontWeight: 'bold', letterSpacing: 3, textAlign: 'center', paddingTop: 14, paddingBottom: 10 },
  statsGrid:             { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center' },
  statItem:              { flex: 1, alignItems: 'center' },
  statVal:               { fontSize: 22, fontWeight: 'bold' },
  statLbl:               { color: '#303030', fontSize: 8, letterSpacing: 1.5, marginTop: 3 },
  statDiv:               { width: 1, height: 32, backgroundColor: '#1E2330' },
  statsBottomRow:        { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1E2330' },
  statsFinBox:           { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statsFinLbl:           { color: '#303030', fontSize: 8, letterSpacing: 2, marginBottom: 4 },
  statsFinVal:           { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  sectionHeader:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionLine:           { flex: 1, height: 1, backgroundColor: '#1E2330' },
  sectionTitle:          { color: '#404040', fontSize: 9, fontWeight: 'bold', letterSpacing: 3 },
  // Retiros
  retirosToggle:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0D1117', borderRadius: 14, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: '#1E2330' },
  retirosToggleLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  retirosToggleIcon:     { fontSize: 20 },
  retirosToggleTitle:    { color: '#FFF', fontSize: 15, fontWeight: '700' },
  retirosToggleArrow:    { color: '#9B59B6', fontSize: 14, fontWeight: 'bold' },
  retirosContainer:      { marginBottom: 20, gap: 10 },
  retirosEmpty:          { alignItems: 'center', paddingVertical: 20 },
  retirosEmptyTxt:       { color: '#505060', fontSize: 13 },
  retiroCard:            { backgroundColor: '#0D1117', borderRadius: 14, padding: 14, borderWidth: 1 },
  retiroCardHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  retiroEstadoBadge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  retiroEstadoTxt:       { fontSize: 11, fontWeight: 'bold' },
  retiroFecha:           { color: '#404050', fontSize: 11 },
  retiroMontoRow:        { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  retiroMonto:           { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  retiroMxn:             { color: '#505060', fontSize: 13, paddingBottom: 2 },
  retiroMetodoBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  metodoBadgeSPEI:       { backgroundColor: 'rgba(52,152,219,0.1)', borderColor: 'rgba(52,152,219,0.3)' },
  metodoBadgeMP:         { backgroundColor: 'rgba(0,177,234,0.1)',   borderColor: 'rgba(0,177,234,0.3)' },
  retiroMetodoTxt:       { fontSize: 11, fontWeight: '700' },
  retiroNotaBox:         { backgroundColor: 'rgba(231,76,60,0.07)', borderRadius: 8, padding: 8, marginTop: 4, borderWidth: 1, borderColor: 'rgba(231,76,60,0.2)', marginBottom: 6 },
  retiroNotaLabel:       { color: '#E74C3C', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  retiroNotaVal:         { color: '#C0A0A0', fontSize: 12 },
  retiroCompBtn:         { marginTop: 8, backgroundColor: '#1C1F28', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2A2D38' },
  retiroCompBtnTxt:      { color: '#9B59B6', fontWeight: '700', fontSize: 13 },
  // Admin card
  adminCard:             { backgroundColor: '#0D1117', borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#1E2330', overflow: 'hidden', shadowColor: '#FFD700', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  adminCardNeonLine:     { height: 2, backgroundColor: '#FFD700', shadowColor: '#FFD700', shadowOpacity: 1, shadowRadius: 8 },
  adminCardBody:         { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  adminCardTitle:        { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  adminCardSub:          { color: '#404040', fontSize: 12, marginTop: 2 },
  adminCardArrow:        { color: '#FFD700', fontSize: 24 },
  signOutBtn:            { marginTop: 8, padding: 15, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(231,76,60,0.4)', alignItems: 'center', backgroundColor: 'rgba(231,76,60,0.05)', shadowColor: '#E74C3C', shadowOpacity: 0.2, shadowRadius: 8 },
  signOutTxt:            { color: '#E74C3C', fontWeight: 'bold', fontSize: 15, letterSpacing: 1 },
  // Modal editar perfil
  modalOverlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:             { backgroundColor: '#15181F', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: '#2A2D35', gap: 2 },
  modalTitle:            { color: '#FFF', fontSize: 19, fontWeight: 'bold', marginBottom: 18 },
  avatarEditRow:         { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatarEditWrap:        { position: 'relative', width: 72, height: 72, borderRadius: 36, overflow: 'hidden', borderWidth: 2, borderColor: '#9B59B6' },
  avatarEditImg:         { width: 72, height: 72 },
  avatarEditPlaceholder: { width: 72, height: 72, backgroundColor: '#1C1F28', justifyContent: 'center', alignItems: 'center' },
  avatarEditInitials:    { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  avatarEditOverlay:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', paddingVertical: 4 },
  avatarEditCamara:      { fontSize: 14 },
  avatarEditHint:        { color: '#FFF', fontSize: 13, fontWeight: '600' },
  avatarEditSub:         { color: '#606070', fontSize: 11, marginTop: 3 },
  inputLabel:            { color: '#606070', fontSize: 10, letterSpacing: 1.5, fontWeight: '700', marginBottom: 6 },
  input:                 { backgroundColor: '#0A0C10', borderRadius: 12, borderWidth: 1, borderColor: '#2A2D35', color: '#FFF', padding: 12, fontSize: 15, marginBottom: 4 },
  inputHint:             { color: '#F39C1288', fontSize: 11, marginBottom: 4 },
  inputUsernameWrap:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0C10', borderRadius: 12, borderWidth: 1, borderColor: '#2A2D35', paddingLeft: 12, marginBottom: 4 },
  inputPrefix:           { color: '#9B59B6', fontWeight: 'bold', fontSize: 16 },
  modalBtns:             { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:             { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35' },
  cancelBtnTxt:          { color: '#A0A0A0', fontWeight: 'bold' },
  saveBtn:               { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#9B59B6' },
  saveBtnTxt:            { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  // Visor comprobante
  visorOverlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  visorCard:             { width: '100%', backgroundColor: '#12151C', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1E2128', alignItems: 'center' },
  visorTitle:            { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 14 },
  visorImg:              { width: '100%', height: 380, borderRadius: 12, backgroundColor: '#0A0C12', marginBottom: 16 },
  visorCloseBtn:         { backgroundColor: '#1C1F28', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, borderWidth: 1, borderColor: '#2A2D38' },
  visorCloseTxt:         { color: '#A0A0B0', fontWeight: 'bold' },
});
