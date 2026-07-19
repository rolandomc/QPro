import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    LayoutAnimation,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet, Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    UIManager,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Badge from '../../src/components/Badge';
import Header from '../../src/components/Header';
import { supabase } from '../../src/config/supabase';
import { useDeporte } from '../../src/context/DeporteContext';
import { AdminService } from '../../src/services/admin.service';
import { AuthService } from '../../src/services/auth.service';

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

  // ── Deporte global (compartido con todas las tabs) ──────────────────────────
  const { deporteActivo, setDeporteActivo } = useDeporte();

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

  const [retirosOpen,    setRetirosOpen]    = useState(false);
  const retirosOpenRef                      = useRef(false);
  const [retiros,        setRetiros]        = useState<any[]>([]);
  const [loadingRetiros, setLoadingRetiros] = useState(false);
  const userIdRef                           = useRef<string>('');
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
    const opening = !retirosOpenRef.current;
    retirosOpenRef.current = opening;
    setRetirosOpen(opening);
    if (opening && userIdRef.current) cargarRetiros(userIdRef.current);
  };

  const loadUserData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      userIdRef.current = user.id;

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
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); loadUserData(); }, [loadUserData]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    if (retirosOpenRef.current && userIdRef.current) {
      cargarRetiros(userIdRef.current);
    }
  }, [loadUserData, cargarRetiros]);

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
        <ActivityIndicator size="large" color="#35D07F" />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      {/* Header con selector de deporte conectado al context global */}
      <Header
        deporteActivo={deporteActivo}
        onDeporteChange={setDeporteActivo}
        onRefresh={handleRefresh}
      />

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        bounces
        overScrollMode="always"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#67BAFF" colors={['#35D07F']} />
        }
      >
        <View style={st.heroCard}>
          <View style={st.heroGlowGreen} />
          <View style={st.heroGlowBlue} />

          <View style={st.heroTopRow}>
            <View style={st.heroIdentityRow}>
              <View style={st.avatarWrap}>
                <View style={st.avatarNeonRing}>
                  {avatarUrl
                    ? <Image source={{ uri: avatarUrl }} style={st.avatarImg} />
                    : <View style={st.avatar}><Text style={st.avatarTxt}>{initials}</Text></View>}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <View style={st.nameRow}>
                  <Text style={st.nombre}>{displayName || username || 'Usuario'}</Text>
                  {isAdmin ? (
                    <View style={st.adminPill}><Text style={st.adminPillTxt}>👑 ADMIN</Text></View>
                  ) : null}
                </View>
                {username ? (
                  <View style={st.usernamePill}><Text style={st.usernamePillTxt}>@{username}</Text></View>
                ) : null}
              </View>
            </View>

            <TouchableOpacity style={st.editBtn} onPress={abrirEditModal}>
              <Text style={st.editBtnTxt}>Editar</Text>
            </TouchableOpacity>
          </View>

          {!fullName && (
            <TouchableOpacity style={st.alertaRetiro} onPress={abrirEditModal}>
              <Text style={st.alertaRetiroTxt}>Completa tu nombre legal para habilitar retiros.</Text>
            </TouchableOpacity>
          )}

          <View style={st.levelCard}>
            <View style={st.nivelRow}>
              <Text style={st.nivelLabel}>RANGO ACTUAL</Text>
              <Text style={st.nivelNombre}>{nivel}</Text>
            </View>
            <View style={st.xpTrack}><View style={[st.xpFill, { width: `${xpPct}%` }]} /></View>
            <Text style={st.xpTxt}>{niveXP} / {nextXP} XP</Text>
          </View>
        </View>

        {isAdmin && (
          <TouchableOpacity style={st.adminPanelBtn} onPress={() => router.push('/admin')} activeOpacity={0.86}>
            <View style={st.adminPanelGlow} />
            <View style={st.adminPanelLeft}>
              <Text style={st.adminPanelIcon}>🛠️</Text>
              <View>
                <Text style={st.adminPanelTitle}>Panel Administrador</Text>
                <Text style={st.adminPanelSub}>Gestionar quinielas, retiros y resultados</Text>
              </View>
            </View>
            <Text style={st.adminPanelArrow}>›</Text>
          </TouchableOpacity>
        )}

        <View style={st.statsCard}>
          <Text style={st.statsTitle}>DESEMPENO</Text>
          <View style={st.statsGrid}>
            <View style={st.statTile}>
              <Text style={[st.statVal, { color: '#67BAFF' }]}>{stats.jugadas}</Text>
              <Text style={st.statLbl}>Jugadas</Text>
            </View>
            <View style={st.statTile}>
              <Text style={[st.statVal, { color: '#35D07F' }]}>{stats.ganadas}</Text>
              <Text style={st.statLbl}>Ganadas</Text>
            </View>
            <View style={st.statTile}>
              <Text style={[st.statVal, { color: '#7FD4FF' }]}>{stats.pctAcierto}%</Text>
              <Text style={st.statLbl}>Acierto</Text>
            </View>
            <View style={st.statTile}>
              <Text style={[st.statVal, { color: roiColor }]}>{`${stats.roi >= 0 ? '+' : ''}${stats.roi}%`}</Text>
              <Text style={st.statLbl}>ROI</Text>
            </View>
          </View>

          <View style={st.statsBottomRow}>
            <View style={st.statsFinBox}>
              <Text style={st.statsFinLbl}>Mejor posición</Text>
              <Text style={[st.statsFinVal, { color: stats.mejorPos === 1 ? '#67BAFF' : '#EAF0FA' }]}>
                {stats.mejorPos != null ? `#${stats.mejorPos}` : '—'}
              </Text>
            </View>
            <View style={st.statsFinBox}>
              <Text style={st.statsFinLbl}>Invertido</Text>
              <Text style={st.statsFinVal}>${stats.invertido.toLocaleString()}</Text>
            </View>
            <View style={st.statsFinBox}>
              <Text style={st.statsFinLbl}>Ganado</Text>
              <Text style={[st.statsFinVal, { color: '#35D07F' }]}>
                ${stats.ganado.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={st.sectionHeader}>
          <View style={st.sectionLine} />
          <Text style={st.sectionTitle}>LOGROS</Text>
          <View style={st.sectionLine} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 2 }}>
            <Badge icon="🎯" title="Pleno Perfecto" isUnlocked={stats.ganadas >= 1}     neonColor="#35D07F" />
            <Badge icon="🔥" title="Racha x3"       isUnlocked={stats.jugadas >= 3}    neonColor="#F39C12" />
            <Badge icon="💰" title="Bolsa Mayor"    isUnlocked={stats.ganado >= 1000}  neonColor="#67BAFF" />
            <Badge icon="🔮" title="Vidente"        isUnlocked={stats.pctAcierto >= 80} neonColor="#7FD4FF" />
          </View>
        </ScrollView>

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
                <ActivityIndicator color="#35D07F" />
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
                        <Text style={[st.retiroMetodoTxt, r.metodo === 'spei' ? { color: '#67BAFF' } : { color: '#35D07F' }]}>
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

        <TouchableOpacity style={st.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
          {signingOut ? <ActivityIndicator color="#E74C3C" /> : <Text style={st.signOutTxt}>🚨 Cerrar Sesión</Text>}
        </TouchableOpacity>
      </ScrollView>

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
                    {saving ? <ActivityIndicator color="#08111A" /> : <Text style={st.saveBtnTxt}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
  container: { flex: 1, backgroundColor: '#070B12' },
  scroll: { padding: 16, paddingBottom: 120 },

  heroCard: {
    backgroundColor: '#0F1622',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#253247',
    padding: 16,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: '#67BAFF',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 7,
  },
  heroGlowGreen: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 100,
    top: -70,
    left: -70,
    backgroundColor: 'rgba(53,208,127,0.12)',
  },
  heroGlowBlue: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 100,
    right: -70,
    bottom: -80,
    backgroundColor: 'rgba(103,186,255,0.12)',
  },
  heroTopRow: { gap: 14 },
  heroIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { alignItems: 'center' },
  avatarNeonRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: '#35D07F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#35D07F',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#142033',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: { width: 82, height: 82, borderRadius: 41 },
  avatarTxt: { color: '#EAF0FA', fontSize: 26, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nombre: { color: '#F2F6FD', fontSize: 22, fontWeight: '800' },
  adminPill: {
    backgroundColor: 'rgba(103,186,255,0.16)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(103,186,255,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  adminPillTxt: { color: '#7FD4FF', fontWeight: '700', fontSize: 10, letterSpacing: 0.8 },
  usernamePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: 'rgba(53,208,127,0.12)',
    borderColor: 'rgba(53,208,127,0.45)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  usernamePillTxt: { color: '#35D07F', fontSize: 12, fontWeight: '700' },
  editBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#142238',
    borderWidth: 1,
    borderColor: '#2F4768',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editBtnTxt: { color: '#CBE0FF', fontWeight: '700', fontSize: 13 },
  alertaRetiro: {
    marginTop: 12,
    backgroundColor: 'rgba(247,185,85,0.1)',
    borderColor: 'rgba(247,185,85,0.4)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alertaRetiroTxt: { color: '#F7B955', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  levelCard: {
    marginTop: 14,
    backgroundColor: 'rgba(11,18,29,0.86)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#253247',
    padding: 12,
  },
  nivelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  nivelLabel: { color: '#8FA2BE', fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  nivelNombre: { color: '#67BAFF', fontSize: 14, fontWeight: '800' },
  xpTrack: {
    height: 8,
    backgroundColor: '#1A2637',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 6,
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#35D07F',
    shadowColor: '#35D07F',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  xpTxt: { color: '#8FA2BE', fontSize: 11, textAlign: 'right', fontWeight: '600' },

  statsCard: {
    backgroundColor: '#0F1622',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#253247',
    padding: 14,
    marginBottom: 18,
  },
  statsTitle: { color: '#A7BCD7', fontSize: 10, fontWeight: '700', letterSpacing: 1.8, marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  statTile: {
    width: '48.5%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#28384F',
    backgroundColor: '#121D2E',
    paddingVertical: 12,
    alignItems: 'center',
  },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLbl: { color: '#8EA3BF', fontSize: 10, marginTop: 3, letterSpacing: 1.1 },
  statsBottomRow: {
    marginTop: 12,
    flexDirection: 'row',
    backgroundColor: '#111A29',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#273751',
    overflow: 'hidden',
  },
  statsFinBox: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRightWidth: 1, borderRightColor: '#273751' },
  statsFinLbl: { color: '#89A0BD', fontSize: 9, letterSpacing: 1.1, marginBottom: 4, fontWeight: '600' },
  statsFinVal: { color: '#EAF0FA', fontSize: 15, fontWeight: '800' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#213047' },
  sectionTitle: { color: '#A7BCD7', fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },

  retirosToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1622',
    borderRadius: 16,
    padding: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#253247',
  },
  retirosToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  retirosToggleIcon: { fontSize: 18 },
  retirosToggleTitle: { color: '#ECF2FC', fontSize: 15, fontWeight: '800' },
  retirosToggleArrow: { color: '#67BAFF', fontSize: 14, fontWeight: '800' },
  retirosContainer: { marginBottom: 20, gap: 10 },
  retirosEmpty: { alignItems: 'center', paddingVertical: 18 },
  retirosEmptyTxt: { color: '#8B9FB9', fontSize: 13 },
  retiroCard: {
    backgroundColor: '#101A2A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  retiroCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  retiroEstadoBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  retiroEstadoTxt: { fontSize: 11, fontWeight: '800' },
  retiroFecha: { color: '#8CA2BE', fontSize: 11 },
  retiroMontoRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  retiroMonto: { color: '#EEF3FD', fontSize: 22, fontWeight: '800' },
  retiroMxn: { color: '#8EA3BF', fontSize: 13, paddingBottom: 2 },
  retiroMetodoBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  metodoBadgeSPEI: { backgroundColor: 'rgba(103,186,255,0.12)', borderColor: 'rgba(103,186,255,0.35)' },
  metodoBadgeMP: { backgroundColor: 'rgba(53,208,127,0.12)', borderColor: 'rgba(53,208,127,0.35)' },
  retiroMetodoTxt: { fontSize: 11, fontWeight: '700' },
  retiroNotaBox: {
    backgroundColor: 'rgba(231,76,60,0.08)',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.24)',
    marginBottom: 6,
  },
  retiroNotaLabel: { color: '#EF6B5D', fontSize: 10, fontWeight: '800', marginBottom: 2 },
  retiroNotaVal: { color: '#D8B5B1', fontSize: 12 },
  retiroCompBtn: {
    marginTop: 8,
    backgroundColor: '#15263D',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D4A70',
  },
  retiroCompBtnTxt: { color: '#67BAFF', fontWeight: '800', fontSize: 13 },

  adminPanelBtn: {
    backgroundColor: '#112037',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#35557D',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  adminPanelGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 70,
    right: -40,
    top: -45,
    backgroundColor: 'rgba(103,186,255,0.18)',
  },
  adminPanelLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  adminPanelIcon: { fontSize: 22 },
  adminPanelTitle: { color: '#EAF2FC', fontWeight: '800', fontSize: 15 },
  adminPanelSub: { color: '#A7BDD7', fontSize: 12, marginTop: 2 },
  adminPanelArrow: { color: '#7FD4FF', fontSize: 24, fontWeight: '800', marginLeft: 8 },

  signOutBtn: {
    marginTop: 8,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.45)',
    alignItems: 'center',
    backgroundColor: 'rgba(231,76,60,0.08)',
  },
  signOutTxt: { color: '#F16B60', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#111A2A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: '#2D415F',
    gap: 2,
  },
  modalTitle: { color: '#EEF3FC', fontSize: 19, fontWeight: '800', marginBottom: 18 },
  avatarEditRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatarEditWrap: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#35D07F',
  },
  avatarEditImg: { width: 72, height: 72 },
  avatarEditPlaceholder: { width: 72, height: 72, backgroundColor: '#1A2A42', justifyContent: 'center', alignItems: 'center' },
  avatarEditInitials: { color: '#EEF3FC', fontSize: 22, fontWeight: '800' },
  avatarEditOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', paddingVertical: 4 },
  avatarEditCamara: { fontSize: 14 },
  avatarEditHint: { color: '#EEF3FC', fontSize: 13, fontWeight: '600' },
  avatarEditSub: { color: '#8DA2BD', fontSize: 11, marginTop: 3 },
  inputLabel: { color: '#90A5BF', fontSize: 10, letterSpacing: 1.2, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: '#0A121D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#294263',
    color: '#EEF3FC',
    padding: 12,
    fontSize: 15,
    marginBottom: 4,
  },
  inputHint: { color: '#D6A24E', fontSize: 11, marginBottom: 4 },
  inputUsernameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A121D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#294263',
    paddingLeft: 12,
    marginBottom: 4,
  },
  inputPrefix: { color: '#67BAFF', fontWeight: '800', fontSize: 16 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#182437',
    borderWidth: 1,
    borderColor: '#2E4362',
  },
  cancelBtnTxt: { color: '#AFC2DB', fontWeight: '700' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#35D07F' },
  saveBtnTxt: { color: '#08111A', fontWeight: '800', fontSize: 15 },

  visorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  visorCard: {
    width: '100%',
    backgroundColor: '#111B2B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A3F5D',
    alignItems: 'center',
  },
  visorTitle: { color: '#EEF3FC', fontSize: 16, fontWeight: '800', marginBottom: 14 },
  visorImg: { width: '100%', height: 380, borderRadius: 12, backgroundColor: '#0A111B', marginBottom: 16 },
  visorCloseBtn: {
    backgroundColor: '#16263D',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#2D476A',
  },
  visorCloseTxt: { color: '#CBE0FF', fontWeight: '800' },
});
