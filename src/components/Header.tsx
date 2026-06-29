import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, Pressable,
  Modal, TouchableOpacity, TouchableWithoutFeedback,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { WalletService } from '../services/wallet.service';
import { supabase } from '../config/supabase';

export type Deporte = 'futbol' | 'beisbol' | 'basquet';

const DEPORTES: { key: Deporte; label: string; emoji: string; proximamente?: boolean }[] = [
  { key: 'futbol',  label: 'Fútbol',     emoji: '⚽' },
  { key: 'beisbol', label: 'Béisbol',    emoji: '⚾', proximamente: true },
  { key: 'basquet', label: 'Básquetbol', emoji: '🏀', proximamente: true },
];

// Íconos por tipo de notificación
const NOTIF_ICON: Record<string, string> = {
  ganador:           '🏆',
  perdedor:          '😔',
  info:              '📢',
  reembolso:         '💸',
  quiniela_cerrada:  '🔒',
  quiniela_anulada:  '❌',
  spei:              '🏦',
};

const NOTIF_COLOR: Record<string, string> = {
  ganador:           '#FFD700',
  perdedor:          '#606060',
  reembolso:         '#2ECC71',
  quiniela_cerrada:  '#9B59B6',
  quiniela_anulada:  '#E74C3C',
  spei:              '#00E5FF',
  info:              '#00E5FF',
};

interface Props {
  deporteActivo?: Deporte;
  onDeporteChange?: (d: Deporte) => void;
}

export default function Header({ deporteActivo = 'futbol', onDeporteChange }: Props) {
  const router = useRouter();
  const [menuVisible,   setMenuVisible]   = useState(false);
  const [notifVisible,  setNotifVisible]  = useState(false);
  const [saldo,         setSaldo]         = useState<number | null>(null);
  const [notifs,        setNotifs]        = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [userId,        setUserId]        = useState<string>('');
  const cachedSaldo = useRef<number | null>(null);

  // ── Cargar saldo y notificaciones al enfocar ──────────────────────────────
  useFocusEffect(useCallback(() => {
    if (cachedSaldo.current !== null) setSaldo(cachedSaldo.current);
    WalletService.getSaldo()
      .then(s => { cachedSaldo.current = s; setSaldo(s); })
      .catch(() => {});

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      fetchNotifs(user.id);
    });
  }, []));

  const fetchNotifs = useCallback(async (uid: string) => {
    try {
      const { data } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(30);
      setNotifs(data || []);
    } catch {}
  }, []);

  // ── Abrir panel: marcar todas como leídas ────────────────────────────────
  const handleOpenNotifs = useCallback(async () => {
    setNotifVisible(true);
    if (!userId) return;
    setLoadingNotifs(true);
    try {
      // Refrescar lista
      const { data } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      setNotifs(data || []);

      // Marcar no leídas como leídas
      const noLeidas = (data || []).filter((n: any) => !n.leida);
      if (noLeidas.length > 0) {
        await supabase
          .from('notificaciones')
          .update({ leida: true })
          .eq('user_id', userId)
          .eq('leida', false);
        setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
      }
    } finally {
      setLoadingNotifs(false);
    }
  }, [userId]);

  // ── Borrar una notificación ───────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    await supabase.from('notificaciones').delete().eq('id', id);
  }, []);

  // ── Borrar todas las leídas ───────────────────────────────────────────────
  const handleDeleteAll = useCallback(async () => {
    const leidas = notifs.filter(n => n.leida);
    if (!leidas.length) return;
    const ids = leidas.map(n => n.id);
    setNotifs(prev => prev.filter(n => !ids.includes(n.id)));
    await supabase.from('notificaciones').delete().in('id', ids);
  }, [notifs]);

  const noLeidas = notifs.filter(n => !n.leida).length;
  const deporteLabel = DEPORTES.find(d => d.key === deporteActivo);
  const saldoLabel = saldo === null
    ? '...'
    : `$${saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  return (
    <View style={styles.header}>
      {/* Logo + selector deporte */}
      <Pressable style={styles.logoRow} onPress={() => setMenuVisible(true)}>
        <Text style={styles.headerTitle}>
          <Text style={styles.neonTextGreen}>Q</Text>
          <Text style={styles.logoWhite}>Pro</Text>
        </Text>
        <View style={styles.deportePill}>
          <Text style={styles.deportePillText}>
            {deporteLabel?.emoji} {deporteLabel?.label}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </View>
      </Pressable>

      {/* Derecha: saldo + campanita */}
      <View style={styles.rightGroup}>
        <Pressable style={styles.balanceButton} onPress={() => router.push('/wallet')}>
          <Text style={styles.balanceText}>{saldoLabel}</Text>
        </Pressable>

        <Pressable style={styles.bellBtn} onPress={handleOpenNotifs}>
          <Text style={styles.bellIcon}>🔔</Text>
          {noLeidas > 0 && (
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeTxt}>{noLeidas > 99 ? '99+' : noLeidas}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── Panel de notificaciones flotante ── */}
      <Modal
        visible={notifVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setNotifVisible(false)}>
          <View style={styles.notifOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.notifPanel}>
                {/* Cabecera panel */}
                <View style={styles.notifPanelHeader}>
                  <View style={styles.notifPanelTitleRow}>
                    <Text style={styles.notifPanelTitle}>Notificaciones</Text>
                    {noLeidas > 0 && (
                      <View style={styles.notifBadgeHeader}>
                        <Text style={styles.notifBadgeHeaderTxt}>{noLeidas} nueva{noLeidas > 1 ? 's' : ''}</Text>
                      </View>
                    )}
                  </View>
                  {notifs.some(n => n.leida) && (
                    <TouchableOpacity onPress={handleDeleteAll} style={styles.clearAllBtn}>
                      <Text style={styles.clearAllTxt}>🗑️ Limpiar leídas</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Lista */}
                {loadingNotifs ? (
                  <View style={styles.notifLoading}>
                    <ActivityIndicator color="#9B59B6" />
                  </View>
                ) : (
                  <ScrollView
                    style={styles.notifList}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                  >
                    {notifs.length === 0 ? (
                      <View style={styles.emptyWrap}>
                        <Text style={styles.emptyIcon}>🔕</Text>
                        <Text style={styles.emptyTxt}>Sin notificaciones</Text>
                        <Text style={styles.emptySubTxt}>Te avisaremos aquí sobre tus quinielas</Text>
                      </View>
                    ) : (
                      notifs.map((n) => {
                        const icon  = NOTIF_ICON[n.tipo]  ?? '📢';
                        const color = NOTIF_COLOR[n.tipo] ?? '#00E5FF';
                        const fecha = new Date(n.created_at).toLocaleString('es-MX', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        });
                        return (
                          <View
                            key={n.id}
                            style={[
                              styles.notifItem,
                              !n.leida && { borderLeftColor: color, borderLeftWidth: 3 },
                            ]}
                          >
                            <View style={[styles.notifIconWrap, { backgroundColor: `${color}18` }]}>
                              <Text style={{ fontSize: 18 }}>{icon}</Text>
                            </View>
                            <View style={styles.notifContent}>
                              <Text style={[styles.notifTitle, !n.leida && { color: '#FFF' }]}>
                                {n.titulo}
                              </Text>
                              <Text style={styles.notifMsg}>{n.mensaje}</Text>
                              <Text style={styles.notifFecha}>{fecha}</Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleDelete(n.id)}
                              style={styles.deleteBtn}
                              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                            >
                              <Text style={styles.deleteTxt}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Modal selector de deporte ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdown}>
                <Text style={styles.dropdownTitle}>Seleccionar deporte</Text>
                {DEPORTES.map((d) => (
                  <TouchableOpacity
                    key={d.key}
                    style={[
                      styles.dropdownItem,
                      deporteActivo === d.key && styles.dropdownItemActive,
                      d.proximamente && styles.dropdownItemDisabled,
                    ]}
                    onPress={() => {
                      if (!d.proximamente) {
                        onDeporteChange?.(d.key);
                        setMenuVisible(false);
                      }
                    }}
                    activeOpacity={d.proximamente ? 1 : 0.7}
                  >
                    <Text style={styles.dropdownEmoji}>{d.emoji}</Text>
                    <Text style={[
                      styles.dropdownLabel,
                      deporteActivo === d.key && styles.dropdownLabelActive,
                      d.proximamente && styles.dropdownLabelDisabled,
                    ]}>
                      {d.label}
                    </Text>
                    {d.proximamente && (
                      <View style={styles.proximamenteBadge}>
                        <Text style={styles.proximamenteText}>Próximamente</Text>
                      </View>
                    )}
                    {deporteActivo === d.key && !d.proximamente && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  logoRow:             { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle:         { fontSize: 22, fontWeight: 'bold' },
  neonTextGreen:       { color: '#2ECC71', fontWeight: 'bold', textShadowColor: 'rgba(46,204,113,0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  logoWhite:           { color: '#FFFFFF', fontWeight: 'bold' },
  deportePill:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1F26', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#2A2D35', gap: 4 },
  deportePillText:     { color: '#E0E0E0', fontSize: 13, fontWeight: '600' },
  chevron:             { color: '#A0A0A0', fontSize: 11 },

  // Saldo + campanita agrupados
  rightGroup:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceButton:       { backgroundColor: '#1C1F26', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2ECC71' },
  balanceText:         { color: '#2ECC71', fontWeight: 'bold', fontSize: 13 },

  // Campanita
  bellBtn:             { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35', justifyContent: 'center', alignItems: 'center' },
  bellIcon:            { fontSize: 18 },
  badgeWrap:           { position: 'absolute', top: -2, right: -2, backgroundColor: '#E74C3C', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#0A0C10' },
  badgeTxt:            { color: '#FFF', fontSize: 9, fontWeight: 'bold' },

  // Panel notificaciones
  notifOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  notifPanel:          { position: 'absolute', top: 70, right: 16, width: 320, maxHeight: 460, backgroundColor: '#15181F', borderRadius: 18, borderWidth: 1, borderColor: '#2A2D35', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 20 },
  notifPanelHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1E2330' },
  notifPanelTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifPanelTitle:     { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  notifBadgeHeader:    { backgroundColor: 'rgba(155,89,182,0.25)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#9B59B6' },
  notifBadgeHeaderTxt: { color: '#9B59B6', fontSize: 10, fontWeight: 'bold' },
  clearAllBtn:         { padding: 4 },
  clearAllTxt:         { color: '#E74C3C', fontSize: 11, fontWeight: '600' },
  notifLoading:        { padding: 32, alignItems: 'center' },
  notifList:           { maxHeight: 380 },

  // Item notificación
  notifItem:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1D24', borderLeftWidth: 0, borderLeftColor: 'transparent' },
  notifIconWrap:       { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifContent:        { flex: 1 },
  notifTitle:          { color: '#808080', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  notifMsg:            { color: '#505060', fontSize: 12, lineHeight: 17 },
  notifFecha:          { color: '#303040', fontSize: 10, marginTop: 4 },
  deleteBtn:           { padding: 2, alignSelf: 'flex-start', marginTop: 2 },
  deleteTxt:           { color: '#404050', fontSize: 14 },

  // Empty state
  emptyWrap:           { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon:           { fontSize: 40, marginBottom: 10, opacity: 0.4 },
  emptyTxt:            { color: '#505060', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  emptySubTxt:         { color: '#303040', fontSize: 12, textAlign: 'center' },

  // Selector deporte
  overlay:             { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-start', paddingTop: 90, paddingHorizontal: 20 },
  dropdown:            { backgroundColor: '#15181F', borderRadius: 16, borderWidth: 1, borderColor: '#2A2D35', paddingVertical: 8, overflow: 'hidden' },
  dropdownTitle:       { color: '#606060', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  dropdownItem:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#1E2028' },
  dropdownItemActive:  { backgroundColor: 'rgba(46,204,113,0.08)' },
  dropdownItemDisabled:{ opacity: 0.5 },
  dropdownEmoji:       { fontSize: 20 },
  dropdownLabel:       { color: '#E0E0E0', fontSize: 15, fontWeight: '600', flex: 1 },
  dropdownLabelActive: { color: '#2ECC71' },
  dropdownLabelDisabled:{ color: '#606060' },
  proximamenteBadge:   { backgroundColor: 'rgba(243,156,18,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#F39C12' },
  proximamenteText:    { color: '#F39C12', fontSize: 10, fontWeight: '700' },
  checkmark:           { color: '#2ECC71', fontSize: 16, fontWeight: 'bold' },
});
