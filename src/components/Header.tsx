import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, Pressable,
  Modal, TouchableOpacity, TouchableWithoutFeedback,
  ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { WalletService } from '../services/wallet.service';
import { supabase } from '../config/supabase';
import { colors } from '../theme/colors';
import { SlidingTabs } from './SlidingTabs';

export type Deporte = 'futbol' | 'beisbol' | 'basquet';

const TABS_DEPORTE: { key: Deporte; label: string; emoji: string; disabled?: boolean }[] = [
  { key: 'futbol',  label: 'Fútbol',     emoji: '⚽' },
  { key: 'beisbol', label: 'Béisbol',    emoji: '⚾' },
  { key: 'basquet', label: 'Básquet',    emoji: '🏀', disabled: true },
];

const NOTIF_ICON: Record<string, string> = {
  ganador:          '🏆',
  perdedor:         '😔',
  info:             '📢',
  reembolso:        '💸',
  quiniela_cerrada: '🔒',
  quiniela_anulada: '❌',
  spei:             '🏦',
};

const NOTIF_COLOR: Record<string, string> = {
  ganador:          colors.notifGanador,
  perdedor:         colors.notifPerdedor,
  reembolso:        colors.notifReembolso,
  quiniela_cerrada: colors.notifCerrada,
  quiniela_anulada: colors.notifAnulada,
  spei:             colors.notifSpei,
  info:             colors.notifInfo,
};

interface Props {
  deporteActivo?: Deporte;
  onDeporteChange?: (d: Deporte) => void;
  onRefresh?: () => Promise<void> | void;
}

export default function Header({ deporteActivo = 'futbol', onDeporteChange, onRefresh }: Props) {
  const router = useRouter();
  const [notifVisible,  setNotifVisible]  = useState(false);
  const [saldo,         setSaldo]         = useState<number | null>(null);
  const [notifs,        setNotifs]        = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [userId,        setUserId]        = useState<string>('');
  const [hiddenIds,     setHiddenIds]     = useState<Set<string>>(new Set());
  const [spinning,      setSpinning]      = useState(false);
  const cachedSaldo = useRef<number | null>(null);
  const spinAnim    = useRef(new Animated.Value(0)).current;
  const spinLoop    = useRef<Animated.CompositeAnimation | null>(null);

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
        .limit(50);
      setNotifs(data || []);
    } catch {}
  }, []);

  const handleOpenNotifs = useCallback(async () => {
    setNotifVisible(true);
    if (!userId) return;
    setLoadingNotifs(true);
    try {
      const { data } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifs(data || []);
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

  const handleHide = useCallback((id: string) => {
    setHiddenIds(prev => { const next = new Set(prev); next.add(id); return next; });
  }, []);

  const handleHideAllRead = useCallback(() => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      notifs.filter(n => n.leida).forEach(n => next.add(n.id));
      return next;
    });
  }, [notifs]);

  const handleRefreshPress = useCallback(async () => {
    if (!onRefresh || spinning) return;
    setSpinning(true);
    spinAnim.setValue(0);
    spinLoop.current = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 700, useNativeDriver: true })
    );
    spinLoop.current.start();
    try {
      await onRefresh();
    } finally {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
      setSpinning(false);
    }
  }, [onRefresh, spinning, spinAnim]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const visibleNotifs = notifs.filter(n => !hiddenIds.has(n.id));
  const noLeidas  = visibleNotifs.filter(n => !n.leida).length;
  const hayLeidas = visibleNotifs.some(n => n.leida);

  const saldoLabel = saldo === null
    ? '...'
    : `$${saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  return (
    <View style={styles.container}>
      {/* Fila superior: logo + saldo + refresh + campanita */}
      <View style={styles.topRow}>
        <Text style={styles.headerTitle}>
          <Text style={styles.neonTextGreen}>Q</Text>
          <Text style={styles.logoWhite}>Pro</Text>
        </Text>

        <View style={styles.rightGroup}>
          <Pressable style={styles.balanceButton} onPress={() => router.push('/wallet')}>
            <Text style={styles.balanceText}>{saldoLabel}</Text>
          </Pressable>

          {onRefresh && (
            <Pressable
              style={[styles.iconBtn, spinning && styles.iconBtnActive]}
              onPress={handleRefreshPress}
              disabled={spinning}
            >
              <Animated.Text style={[styles.refreshIcon, { transform: [{ rotate: spin }] }]}>
                ↻
              </Animated.Text>
            </Pressable>
          )}

          <Pressable style={styles.bellBtn} onPress={handleOpenNotifs}>
            <Text style={styles.bellIcon}>🔔</Text>
            {noLeidas > 0 && (
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeTxt}>{noLeidas > 99 ? '99+' : noLeidas}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Fila inferior: SlidingTabs de deporte */}
      {onDeporteChange && (
        <View style={styles.tabsRow}>
          <SlidingTabs
            tabs={TABS_DEPORTE.filter(t => !t.disabled).map(t => ({ key: t.key, label: t.label, emoji: t.emoji }))}
            activeKey={deporteActivo === 'basquet' ? 'futbol' : deporteActivo}
            onChange={(key) => onDeporteChange(key as Deporte)}
            barColor="#15181F"
            pillColor="#2A2D35"
          />
        </View>
      )}

      {/* Panel notificaciones */}
      <Modal visible={notifVisible} transparent animationType="fade" onRequestClose={() => setNotifVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setNotifVisible(false)}>
          <View style={styles.notifOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.notifPanel}>
                <View style={styles.notifPanelHeader}>
                  <View style={styles.notifPanelTitleRow}>
                    <Text style={styles.notifPanelTitle}>Notificaciones</Text>
                    {noLeidas > 0 && (
                      <View style={styles.notifBadge}>
                        <Text style={styles.notifBadgeTxt}>{noLeidas} nueva{noLeidas > 1 ? 's' : ''}</Text>
                      </View>
                    )}
                  </View>
                  {hayLeidas && (
                    <TouchableOpacity onPress={handleHideAllRead} style={styles.clearAllBtn}>
                      <Text style={styles.clearAllTxt}>✕ Ocultar leídas</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {loadingNotifs ? (
                  <View style={styles.notifLoading}><ActivityIndicator color={colors.primary} /></View>
                ) : (
                  <ScrollView style={styles.notifList} showsVerticalScrollIndicator={false} bounces={false}>
                    {visibleNotifs.length === 0 ? (
                      <View style={styles.emptyWrap}>
                        <Text style={styles.emptyIcon}>🔕</Text>
                        <Text style={styles.emptyTxt}>Sin notificaciones</Text>
                        <Text style={styles.emptySubTxt}>Te avisaremos aquí sobre tus quinielas</Text>
                      </View>
                    ) : (
                      visibleNotifs.map((n) => {
                        const icon  = NOTIF_ICON[n.tipo]  ?? '📢';
                        const color = NOTIF_COLOR[n.tipo] ?? colors.notifInfo;
                        const fecha = new Date(n.created_at).toLocaleString('es-MX', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        });
                        return (
                          <View key={n.id} style={[
                            styles.notifItem,
                            n.leida ? styles.notifItemRead : [styles.notifItemUnread, { borderLeftColor: color }],
                          ]}>
                            <View style={[styles.notifIconWrap, { backgroundColor: color + '28' }]}>
                              <Text style={styles.notifIconText}>{icon}</Text>
                            </View>
                            <View style={styles.notifContent}>
                              <Text style={n.leida ? styles.notifTitleRead : styles.notifTitleUnread}>{n.titulo}</Text>
                              <Text style={n.leida ? styles.notifMsgRead   : styles.notifMsgUnread}>{n.mensaje}</Text>
                              <Text style={styles.notifFecha}>{fecha}</Text>
                            </View>
                            {n.leida && (
                              <TouchableOpacity onPress={() => handleHide(n.id)} style={styles.hideBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                <Text style={styles.hideBtnTxt}>✕</Text>
                              </TouchableOpacity>
                            )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { backgroundColor: 'transparent' },
  topRow:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 10 },
  tabsRow:            { paddingHorizontal: 20, paddingBottom: 10 },
  headerTitle:        { fontSize: 22, fontWeight: 'bold' },
  neonTextGreen:      { color: colors.primary, fontWeight: 'bold', textShadowColor: 'rgba(46,204,113,0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  logoWhite:          { color: colors.text, fontWeight: 'bold' },
  rightGroup:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceButton:      { backgroundColor: colors.surface, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: colors.primary },
  balanceText:        { color: colors.primary, fontWeight: 'bold', fontSize: 13 },
  iconBtn:            { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  iconBtnActive:      { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  refreshIcon:        { color: colors.textMuted, fontSize: 18, lineHeight: 20 },
  bellBtn:            { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  bellIcon:           { fontSize: 18 },
  badgeWrap:          { position: 'absolute', top: -2, right: -2, backgroundColor: colors.error, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: colors.background },
  badgeTxt:           { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  notifOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  notifPanel:         { position: 'absolute', top: 70, right: 16, width: 320, maxHeight: 480, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 24, elevation: 24 },
  notifPanelHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  notifPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifPanelTitle:    { color: colors.text, fontWeight: 'bold', fontSize: 16 },
  notifBadge:         { backgroundColor: 'rgba(155,89,182,0.3)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#9B59B6' },
  notifBadgeTxt:      { color: '#C589E8', fontSize: 11, fontWeight: 'bold' },
  clearAllBtn:        { paddingVertical: 4, paddingHorizontal: 6, backgroundColor: 'rgba(231,76,60,0.12)', borderRadius: 8 },
  clearAllTxt:        { color: '#FF7B6B', fontSize: 11, fontWeight: '700' },
  notifLoading:       { padding: 32, alignItems: 'center' },
  notifList:          { maxHeight: 400 },
  notifItem:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  notifItemUnread:    { backgroundColor: colors.cardElevated, borderLeftWidth: 3 },
  notifItemRead:      { backgroundColor: colors.card },
  notifIconWrap:      { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifIconText:      { fontSize: 18 },
  notifContent:       { flex: 1 },
  notifTitleUnread:   { color: '#FFFFFF', fontWeight: '700', fontSize: 13, marginBottom: 3 },
  notifMsgUnread:     { color: '#D8DCF0', fontSize: 12, lineHeight: 18 },
  notifTitleRead:     { color: colors.textMuted, fontWeight: '600', fontSize: 13, marginBottom: 3 },
  notifMsgRead:       { color: colors.textFaint, fontSize: 12, lineHeight: 18 },
  notifFecha:         { color: colors.textFaint, fontSize: 10, marginTop: 4 },
  hideBtn:            { padding: 2, alignSelf: 'flex-start', marginTop: 2 },
  hideBtnTxt:         { color: colors.textFaint, fontSize: 14, fontWeight: '600' },
  emptyWrap:          { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon:          { fontSize: 40, marginBottom: 10, opacity: 0.4 },
  emptyTxt:           { color: colors.textMuted, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  emptySubTxt:        { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
});
