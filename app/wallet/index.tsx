import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable,
  ActivityIndicator, RefreshControl, Alert,
  Modal, TouchableOpacity, TextInput, TouchableWithoutFeedback,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { WalletService } from '../../src/services/wallet.service';

const TIPO_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  premio:        { emoji: '🏆', color: '#2ECC71', label: 'Premio' },
  participacion: { emoji: '🎮', color: '#E74C3C', label: 'Participación' },
  retiro:        { emoji: '💸', color: '#F39C12', label: 'Retiro' },
  ajuste_admin:  { emoji: '⚙️',  color: '#A0A0A0', label: 'Ajuste' },
};

const ESTADO_COLOR: Record<string, string> = {
  pendiente:  '#F39C12',
  procesado:  '#2ECC71',
  rechazado:  '#E74C3C',
};

function formatMonto(monto: number) {
  const abs = Math.abs(monto).toLocaleString('es-MX', { minimumFractionDigits: 2 });
  return monto >= 0 ? `+$${abs}` : `-$${abs}`;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function WalletScreen() {
  const router = useRouter();

  const [saldo,         setSaldo]         = useState<number>(0);
  const [transacciones, setTransacciones] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [hayPendiente,  setHayPendiente]  = useState(false);

  // Modal retiro
  const [modalRetiro, setModalRetiro] = useState(false);
  const [metodo,      setMetodo]      = useState<'spei' | 'mercadopago'>('spei');
  const [monto,       setMonto]       = useState('');
  const [clabe,       setClabe]       = useState('');
  const [aliasMP,     setAliasMP]     = useState('');
  const [enviando,    setEnviando]    = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, tx, pendiente] = await Promise.all([
        WalletService.getSaldo(),
        WalletService.getTransacciones(),
        WalletService.tienePendiente(),
      ]);
      setSaldo(s);
      setTransacciones(tx);
      setHayPendiente(pendiente);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData();
  }, []));

  const abrirModalRetiro = () => {
    if (saldo <= 0) {
      Alert.alert('Sin saldo', 'Aún no tienes saldo para retirar.');
      return;
    }
    if (hayPendiente) {
      Alert.alert(
        '⏳ Retiro en proceso',
        'Ya tienes una solicitud pendiente. Espera a que sea procesada antes de solicitar otro retiro.',
      );
      return;
    }
    setModalRetiro(true);
  };

  const handleRetirarTodo = () => setMonto(saldo.toFixed(2));

  const handleSolicitarRetiro = async () => {
    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido'); return;
    }
    if (montoNum > saldo) {
      Alert.alert('Saldo insuficiente', `Tu saldo disponible es $${saldo.toFixed(2)} MXN`); return;
    }
    if (metodo === 'spei' && clabe.length !== 18) {
      Alert.alert('Error', 'La CLABE debe tener 18 dígitos'); return;
    }
    if (metodo === 'mercadopago' && !aliasMP.trim()) {
      Alert.alert('Error', 'Ingresa tu alias de Mercado Pago'); return;
    }

    setEnviando(true);
    try {
      await WalletService.solicitarRetiro({
        monto: montoNum,
        metodo,
        clabe:    metodo === 'spei'        ? clabe.trim()   : undefined,
        alias_mp: metodo === 'mercadopago' ? aliasMP.trim() : undefined,
      });
      setModalRetiro(false);
      setMonto(''); setClabe(''); setAliasMP('');
      await loadData();
      Alert.alert(
        '✅ Solicitud enviada',
        'Tu solicitud de retiro fue recibida. La procesaremos en un máximo de 24 horas.',
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2ECC71" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>Mi Billetera</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor="#2ECC71"
            colors={['#2ECC71']}
          />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo Disponible</Text>
          <Text style={styles.balanceValue}>
            ${saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
            <Text style={styles.currency}>MXN</Text>
          </Text>

          {hayPendiente && (
            <View style={styles.pendienteAlert}>
              <Text style={styles.pendienteAlertTxt}>⏳ Tienes un retiro en proceso</Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.withdrawBtn, hayPendiente && styles.withdrawBtnDisabled]}
              onPress={abrirModalRetiro}
            >
              <Text style={styles.withdrawText}>💸 Solicitar Retiro</Text>
            </Pressable>
          </View>
          <Text style={styles.retiroNota}>⏱ Retiros procesados en máx. 24 horas</Text>
        </View>

        {/* Movimientos */}
        <Text style={styles.sectionTitle}>Historial de Movimientos</Text>
        <View style={styles.historyContainer}>
          {transacciones.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyText}>Aún no hay movimientos</Text>
              <Text style={styles.emptySubtext}>Tus premios y participaciones aparecerán aquí</Text>
            </View>
          ) : (
            transacciones.map((tx) => {
              const cfg = TIPO_CONFIG[tx.tipo] ?? { emoji: '💰', color: '#FFF', label: tx.tipo };
              const estadoColor = tx.estado ? (ESTADO_COLOR[tx.estado] ?? '#A0A0A0') : undefined;
              return (
                <View key={tx.id} style={styles.txItem}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txEmoji}>{cfg.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.txLabel}>{cfg.label}</Text>
                        {tx.estado && (
                          <View style={[styles.estadoPill, { backgroundColor: `${estadoColor}22`, borderColor: estadoColor }]}>
                            <Text style={[styles.estadoPillTxt, { color: estadoColor }]}>{tx.estado}</Text>
                          </View>
                        )}
                      </View>
                      {tx.descripcion ? <Text style={styles.txDesc}>{tx.descripcion}</Text> : null}
                      <Text style={styles.txFecha}>{formatFecha(tx.created_at)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.txMonto, { color: tx.monto >= 0 ? '#2ECC71' : '#E74C3C' }]}>
                    {formatMonto(tx.monto)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal Retiro */}
      <Modal visible={modalRetiro} transparent animationType="slide" onRequestClose={() => setModalRetiro(false)}>
        <TouchableWithoutFeedback onPress={() => setModalRetiro(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>💸 Solicitar Retiro</Text>
                  <Text style={styles.modalSaldo}>
                    Saldo disponible:{' '}
                    <Text style={{ color: '#2ECC71' }}>${saldo.toFixed(2)} MXN</Text>
                  </Text>

                  {/* Monto + botón retirar todo */}
                  <Text style={styles.inputLabel}>Monto a retirar (MXN)</Text>
                  <View style={styles.montoRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Ej. 500"
                      placeholderTextColor="#505050"
                      keyboardType="decimal-pad"
                      value={monto}
                      onChangeText={setMonto}
                    />
                    <TouchableOpacity style={styles.todoBtn} onPress={handleRetirarTodo}>
                      <Text style={styles.todoBtnTxt}>Todo</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Método */}
                  <Text style={styles.inputLabel}>Método de pago</Text>
                  <View style={styles.metodoRow}>
                    <TouchableOpacity
                      style={[styles.metodoPill, metodo === 'spei' && styles.metodoPillActive]}
                      onPress={() => setMetodo('spei')}
                    >
                      <Text style={[styles.metodoPillTxt, metodo === 'spei' && styles.metodoPillTxtActive]}>SPEI</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.metodoPill, metodo === 'mercadopago' && styles.metodoPillActive]}
                      onPress={() => setMetodo('mercadopago')}
                    >
                      <Text style={[styles.metodoPillTxt, metodo === 'mercadopago' && styles.metodoPillTxtActive]}>Mercado Pago</Text>
                    </TouchableOpacity>
                  </View>

                  {metodo === 'spei' ? (
                    <>
                      <Text style={styles.inputLabel}>CLABE interbancaria (18 dígitos)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="000000000000000000"
                        placeholderTextColor="#505050"
                        keyboardType="numeric"
                        maxLength={18}
                        value={clabe}
                        onChangeText={setClabe}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.inputLabel}>Alias / CVU de Mercado Pago</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="tu.alias"
                        placeholderTextColor="#505050"
                        autoCapitalize="none"
                        value={aliasMP}
                        onChangeText={setAliasMP}
                      />
                    </>
                  )}

                  <View style={styles.modalBtns}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalRetiro(false)} disabled={enviando}>
                      <Text style={styles.cancelBtnTxt}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.confirmBtn, enviando && { opacity: 0.6 }]}
                      onPress={handleSolicitarRetiro}
                      disabled={enviando}
                    >
                      {enviando
                        ? <ActivityIndicator color="#000" />
                        : <Text style={styles.confirmBtnTxt}>Confirmar</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#0A0C10' },
  centered:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backButton:          { width: 60 },
  backText:            { color: '#2ECC71', fontSize: 16 },
  title:               { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  content:             { padding: 15, paddingBottom: 50 },
  balanceCard:         { backgroundColor: '#15181F', borderRadius: 20, padding: 25, alignItems: 'center', marginBottom: 25, borderWidth: 1.5, borderColor: '#2ECC71' },
  balanceLabel:        { color: '#A0A0A0', fontSize: 14, marginBottom: 8 },
  balanceValue:        { color: '#FFF', fontSize: 40, fontWeight: 'bold', marginBottom: 14 },
  currency:            { fontSize: 18, color: '#2ECC71' },
  pendienteAlert:      { backgroundColor: 'rgba(243,156,18,0.12)', borderRadius: 10, borderWidth: 1, borderColor: '#F39C12', paddingHorizontal: 14, paddingVertical: 7, marginBottom: 14 },
  pendienteAlertTxt:   { color: '#F39C12', fontSize: 13, fontWeight: '600' },
  actionRow:           { width: '100%', marginBottom: 12 },
  withdrawBtn:         { backgroundColor: '#1C1F26', paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35' },
  withdrawBtnDisabled: { opacity: 0.4 },
  withdrawText:        { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  retiroNota:          { color: '#505050', fontSize: 11, marginTop: 4 },
  sectionTitle:        { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  historyContainer:    { backgroundColor: '#15181F', borderRadius: 16, borderWidth: 1, borderColor: '#2A2D35', overflow: 'hidden' },
  emptyHistory:        { padding: 40, alignItems: 'center', gap: 8 },
  emptyEmoji:          { fontSize: 40 },
  emptyText:           { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  emptySubtext:        { color: '#505050', fontSize: 13, textAlign: 'center' },
  txItem:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1E2028' },
  txLeft:              { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  txEmoji:             { fontSize: 24 },
  txLabel:             { color: '#FFF', fontWeight: '600', fontSize: 14 },
  txDesc:              { color: '#A0A0A0', fontSize: 12, marginTop: 1 },
  txFecha:             { color: '#505050', fontSize: 11, marginTop: 2 },
  txMonto:             { fontWeight: 'bold', fontSize: 15 },
  estadoPill:          { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  estadoPillTxt:       { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  // Modal
  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:           { backgroundColor: '#15181F', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: '#2A2D35', gap: 4 },
  modalTitle:          { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  modalSaldo:          { color: '#A0A0A0', fontSize: 13, marginBottom: 16 },
  inputLabel:          { color: '#A0A0A0', fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  montoRow:            { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input:               { backgroundColor: '#0A0C10', borderRadius: 12, borderWidth: 1, borderColor: '#2A2D35', color: '#FFF', padding: 12, fontSize: 15 },
  todoBtn:             { backgroundColor: 'rgba(46,204,113,0.12)', borderRadius: 12, borderWidth: 1, borderColor: '#2ECC71', paddingHorizontal: 14, paddingVertical: 13 },
  todoBtnTxt:          { color: '#2ECC71', fontWeight: 'bold', fontSize: 13 },
  metodoRow:           { flexDirection: 'row', gap: 10, marginBottom: 4 },
  metodoPill:          { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: '#0A0C10', borderWidth: 1, borderColor: '#2A2D35' },
  metodoPillActive:    { backgroundColor: 'rgba(46,204,113,0.1)', borderColor: '#2ECC71' },
  metodoPillTxt:       { color: '#606060', fontWeight: '600' },
  metodoPillTxtActive: { color: '#2ECC71', fontWeight: '700' },
  modalBtns:           { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:           { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35' },
  cancelBtnTxt:        { color: '#A0A0A0', fontWeight: 'bold' },
  confirmBtn:          { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#2ECC71' },
  confirmBtnTxt:       { color: '#000', fontWeight: 'bold', fontSize: 15 },
});
