import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Modal, FlatList, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { AdminService } from '../../src/services/admin.service';
import { QuinielasService } from '../../src/services/quinielas.service';
import { supabase } from '../../src/config/supabase';
import DateTimePicker from '../../src/components/DateTimePicker';

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDisplay(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}h`;
}
function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

type FiltroEstado = 'todas' | 'abierta' | 'cerrada' | 'finalizada' | 'nula';
type FiltroSPEI   = 'todos' | 'pendiente_revision' | 'spei_pendiente' | 'pagado';

const FILTROS: { key: FiltroEstado; label: string; color: string }[] = [
  { key: 'todas',     label: 'Todas',     color: '#9B59B6' },
  { key: 'abierta',  label: 'Abiertas',  color: '#2ECC71' },
  { key: 'cerrada',  label: 'Cerradas',  color: '#3498DB' },
  { key: 'finalizada', label: 'Canceladas', color: '#E74C3C' },
  { key: 'nula',     label: 'Nulas',     color: '#A0A0A0' },
];

const FILTROS_SPEI: { key: FiltroSPEI; label: string; color: string }[] = [
  { key: 'todos',              label: 'Todos',            color: '#9B59B6' },
  { key: 'spei_pendiente',     label: '⏳ Por revisar',   color: '#F39C12' },
  { key: 'pendiente_revision', label: '👁 Rev. manual',   color: '#3498DB' },
  { key: 'pagado',             label: '✅ Aprobados',     color: '#2ECC71' },
];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [quinielas,            setQuinielas]            = useState<any[]>([]);
  const [loading,              setLoading]              = useState(true);
  const [refreshing,           setRefreshing]           = useState(false);
  const [actionLoading,        setActionLoading]        = useState<string | null>(null);
  const [usuariosModal,        setUsuariosModal]        = useState(false);
  const [usuarios,             setUsuarios]             = useState<any[]>([]);
  const [loadingUsuarios,      setLoadingUsuarios]      = useState(false);
  const [quinielaSeleccionada, setQuinielaSeleccionada] = useState('');
  const [proximaFecha,         setProximaFecha]         = useState('');
  const [savingFecha,          setSavingFecha]          = useState(false);
  const [configExpanded,       setConfigExpanded]       = useState(false);
  const [pickerVisible,        setPickerVisible]        = useState(false);
  const [retirosPendientes,    setRetirosPendientes]    = useState(0);

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');

  // ── Comprobantes SPEI ─────────────────────────────────────────────────────
  const [todosSpei,            setTodosSpei]            = useState<any[]>([]);
  const [filtroSPEI,           setFiltroSPEI]           = useState<FiltroSPEI>('todos');
  const [speiExpanded,         setSpeiExpanded]         = useState(false);
  const [aprobandoId,          setAprobandoId]          = useState<string | null>(null);

  // ── Retiros inline ────────────────────────────────────────────────────────
  const [retirosExpanded,      setRetirosExpanded]      = useState(false);
  const [retirosData,          setRetirosData]          = useState<any[]>([]);
  const [loadingRetiros,       setLoadingRetiros]       = useState(false);
  const [accionandoRetiro,     setAccionandoRetiro]     = useState<string | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const loadQuinielas = useCallback(async () => {
    try {
      const [data, fecha, { count }] = await Promise.all([
        AdminService.getQuinielas(),
        QuinielasService.getProximaFecha(),
        supabase
          .from('retiro_solicitudes')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'pendiente')
          .then(r => ({ count: r.count ?? 0 })),
      ]);
      setQuinielas(data || []);
      setProximaFecha(fecha ?? '');
      setRetirosPendientes(count);

      // Cargar TODOS los pagos SPEI (pendientes + aprobados + revisión manual)
      const { data: speiData } = await supabase
        .from('participaciones')
        .select('id, user_id, monto_pagado, clave_rastreo, comprobante_url, comprobante_enviado_at, ultimo_error_spei, created_at, quiniela_id, estado, comprobante_validado, spei_datos_ocr')
        .in('estado', ['spei_pendiente', 'pendiente_revision', 'pagado'])
        .not('comprobante_url', 'is', null)
        .order('comprobante_enviado_at', { ascending: false });

      const parts = speiData || [];
      if (parts.length > 0) {
        const userIds = [...new Set(parts.map((p: any) => p.user_id))];
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);
        const profsMap: Record<string, string> = {};
        (profs || []).forEach((p: any) => { profsMap[p.id] = p.username; });
        const enriched = parts.map((p: any) => ({ ...p, username: profsMap[p.user_id] ?? 'usuario' }));
        setTodosSpei(enriched);
        const pendientes = enriched.filter((p: any) => ['spei_pendiente', 'pendiente_revision'].includes(p.estado));
        if (pendientes.length > 0) setSpeiExpanded(true);
      } else {
        setTodosSpei([]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); loadQuinielas(); }, []));

  const quinielasFiltradas = filtroEstado === 'todas'
    ? quinielas
    : filtroEstado === 'nula'
      ? quinielas.filter(q => !q.estado || q.estado === 'nula')
      : quinielas.filter(q => q.estado === filtroEstado);

  // Filtro SPEI aplicado
  const speiFiltrados = filtroSPEI === 'todos'
    ? todosSpei
    : todosSpei.filter(p => p.estado === filtroSPEI);

  const speiPendientesCount = todosSpei.filter(p => ['spei_pendiente', 'pendiente_revision'].includes(p.estado)).length;

  const handleToggleRetiros = async () => {
    const next = !retirosExpanded;
    setRetirosExpanded(next);
    if (next && retirosData.length === 0) {
      setLoadingRetiros(true);
      try {
        const { data, error } = await supabase
          .from('retiro_solicitudes')
          .select('id, user_id, monto, metodo, clabe, alias_mp, estado, nota_admin, created_at, profiles:user_id ( username )')
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: true });
        if (error) throw error;
        setRetirosData(data ?? []);
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setLoadingRetiros(false);
      }
    }
  };

  const llamarEdgeFunction = async (solicitud_id: string, accion: 'pagar' | 'rechazar') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No autenticado');
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/procesar-retiro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ solicitud_id, accion }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al procesar');
    return json;
  };

  const handlePagarRetiro = (item: any) => {
    const destino = item.metodo === 'spei' ? `CLABE: ${item.clabe}` : `Alias MP: ${item.alias_mp}`;
    Alert.alert(
      '💸 Confirmar pago',
      `¿Marcar como pagado el retiro de\n\n@${item.profiles?.username}\n$${item.monto} MXN\n${destino}?\n\n⚠️ Solo confirma si ya hiciste la transferencia.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, ya pagué',
          onPress: async () => {
            setAccionandoRetiro(item.id + '_pagar');
            try {
              await llamarEdgeFunction(item.id, 'pagar');
              setRetirosData(prev => prev.filter(r => r.id !== item.id));
              setRetirosPendientes(p => Math.max(0, p - 1));
              Alert.alert('✅ Listo', 'Retiro marcado como pagado.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setAccionandoRetiro(null);
            }
          },
        },
      ]
    );
  };

  const handleRechazarRetiro = (item: any) => {
    Alert.alert(
      '❌ Rechazar retiro',
      `¿Rechazar el retiro de @${item.profiles?.username} por $${item.monto} MXN?\n\nEl saldo será devuelto automáticamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setAccionandoRetiro(item.id + '_rechazar');
            try {
              await llamarEdgeFunction(item.id, 'rechazar');
              setRetirosData(prev => prev.filter(r => r.id !== item.id));
              setRetirosPendientes(p => Math.max(0, p - 1));
              Alert.alert('Rechazado', 'Solicitud rechazada y saldo devuelto.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setAccionandoRetiro(null);
            }
          },
        },
      ]
    );
  };

  const handleAprobarSPEI = (item: any) => {
    Alert.alert(
      '✅ Aprobar Pago',
      `¿Confirmas que el pago de @${item.username} es válido?\n\nClave: ${item.clave_rastreo ?? 'N/A'}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            setAprobandoId(item.id);
            try {
              const { error } = await supabase
                .from('participaciones')
                .update({
                  estado:               'pagado',
                  comprobante_validado: true,
                  monto_pagado:         item.monto_pagado || 50,
                  fecha_pago:           new Date().toISOString(),
                  ultimo_error_spei:    null,
                })
                .eq('id', item.id);
              if (error) throw error;
              await supabase
                .from('admin_notificaciones')
                .update({ leida: true })
                .eq('participacion_id', item.id);
              setTodosSpei(prev => prev.map(p => p.id === item.id
                ? { ...p, estado: 'pagado', comprobante_validado: true }
                : p
              ));
              Alert.alert('¡Aprobado!', `El pago de @${item.username} fue confirmado.`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setAprobandoId(null);
            }
          },
        },
      ],
    );
  };

  const handlePickerConfirm = (date: Date) => {
    setPickerVisible(false);
    setProximaFecha(date.toISOString());
  };

  const handleGuardarFecha = async () => {
    setSavingFecha(true);
    try {
      await QuinielasService.setProximaFecha(proximaFecha || null);
      Alert.alert('Guardado', proximaFecha
        ? 'Los usuarios verán el countdown en la pantalla principal.'
        : 'Countdown ocultado.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingFecha(false);
    }
  };

  const handleLimpiar = async () => {
    setProximaFecha('');
    await QuinielasService.setProximaFecha(null).catch(() => {});
  };

  const handleVerUsuarios = async (quinielaId: string, titulo: string) => {
    setQuinielaSeleccionada(titulo);
    setUsuariosModal(true);
    setLoadingUsuarios(true);
    try {
      const { data: parts, error: partsError } = await supabase
        .from('participaciones')
        .select('id, user_id, estado, monto_pagado, aciertos, created_at')
        .eq('quiniela_id', quinielaId)
        .order('created_at', { ascending: false });
      if (partsError) throw partsError;
      const userIds = (parts || []).map((p: any) => p.user_id);
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);
      const profsMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { profsMap[p.id] = p.username; });
      setUsuarios((parts || []).map((p: any) => ({ ...p, username: profsMap[p.user_id] ?? 'usuario' })));
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setUsuariosModal(false);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const handleCerrarApuestas = (quinielaId: string, titulo: string) => {
    Alert.alert('Cerrar Apuestas', `¿Cerrar "${titulo}"?\n\nYa nadie podrá participar.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar', style: 'destructive', onPress: async () => {
        setActionLoading(quinielaId + '_cerrar');
        try {
          await AdminService.updateEstado(quinielaId, 'cerrada');
          setQuinielas(prev => prev.map(q => q.id === quinielaId ? { ...q, estado: 'cerrada' } : q));
          Alert.alert('Cerrada', `"${titulo}" ya no acepta participaciones.`);
        } catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionLoading(null); }
      }},
    ]);
  };

  const handleCancelar = (quinielaId: string, titulo: string) => {
    Alert.alert('Cancelar', `¿Cancelar "${titulo}" definitivamente?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, Cancelar', style: 'destructive', onPress: async () => {
        setActionLoading(quinielaId + '_cancelar');
        try {
          await AdminService.updateEstado(quinielaId, 'finalizada');
          setQuinielas(prev => prev.map(q => q.id === quinielaId ? { ...q, estado: 'finalizada' } : q));
          Alert.alert('Cancelada', `"${titulo}" fue marcada como finalizada.`);
        } catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionLoading(null); }
      }},
    ]);
  };

  const getEstadoColor     = (e: string) => e === 'abierta' ? '#2ECC71' : e === 'cerrada' ? '#3498DB' : '#A0A0A0';
  const getEstadoPartColor = (e: string) => ({ pagado: '#2ECC71', pendiente: '#F39C12', ganador: '#9B59B6', perdedor: '#E74C3C' }[e] ?? '#A0A0A0');
  const totalBolsa = quinielas.reduce((acc, q) => acc + (q.premio_total ?? 0), 0);

  const speiEstadoColor = (estado: string) => {
    if (estado === 'pagado') return '#2ECC71';
    if (estado === 'pendiente_revision') return '#3498DB';
    return '#F39C12';
  };
  const speiEstadoLabel = (estado: string) => {
    if (estado === 'pagado') return '✅ Aprobado';
    if (estado === 'pendiente_revision') return '👁 Rev. manual';
    return '⏳ Pendiente';
  };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#9B59B6" />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Panel Admin</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadQuinielas(); setRetirosData([]); }} tintColor="#9B59B6" />}
      >
        {/* Stats */}
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

        {/* ── Comprobantes SPEI ── */}
        <TouchableOpacity
          style={[styles.speiHeader, speiPendientesCount > 0 && styles.speiHeaderAlert]}
          onPress={() => setSpeiExpanded(v => !v)}
        >
          <View style={styles.speiHeaderLeft}>
            <Text style={styles.speiEmoji}>🧾</Text>
            <View>
              <Text style={styles.speiHeaderTitle}>Comprobantes SPEI</Text>
              <Text style={styles.speiHeaderSub}>
                {speiPendientesCount > 0
                  ? `${speiPendientesCount} por revisar · ${todosSpei.filter(p => p.estado === 'pagado').length} aprobados`
                  : `${todosSpei.filter(p => p.estado === 'pagado').length} aprobados · sin pendientes`}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {speiPendientesCount > 0 && (
              <View style={styles.speiBadge}>
                <Text style={styles.speiBadgeCount}>{speiPendientesCount}</Text>
              </View>
            )}
            <Text style={styles.speiChevron}>{speiExpanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {speiExpanded && (
          <View style={styles.speiList}>
            {/* Filtros SPEI */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              {FILTROS_SPEI.map(f => {
                const activo = filtroSPEI === f.key;
                const cnt = f.key === 'todos' ? todosSpei.length : todosSpei.filter(p => p.estado === f.key).length;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filtroPill, activo && { backgroundColor: f.color, borderColor: f.color }, !activo && { borderColor: f.color }]}
                    onPress={() => setFiltroSPEI(f.key)}
                  >
                    <Text style={[styles.filtroPillText, { color: activo ? '#000' : f.color }]}>{f.label}</Text>
                    <View style={[styles.filtroCount, activo ? { backgroundColor: 'rgba(0,0,0,0.2)' } : { backgroundColor: `${f.color}22` }]}>
                      <Text style={[styles.filtroCountText, { color: activo ? '#000' : f.color }]}>{cnt}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {speiFiltrados.length === 0 ? (
              <Text style={styles.speiEmpty}>✅ Sin registros para este filtro.</Text>
            ) : (
              speiFiltrados.map((item) => {
                // Parsear datos OCR si existen
                let ocrData: Record<string, any> | null = null;
                if (item.spei_datos_ocr) {
                  try { ocrData = typeof item.spei_datos_ocr === 'string' ? JSON.parse(item.spei_datos_ocr) : item.spei_datos_ocr; } catch (_) {}
                }
                const yaAprobado = item.estado === 'pagado';
                return (
                  <View key={item.id} style={[styles.speiCard, yaAprobado && { borderColor: '#2ECC7144' }]}>
                    <View style={styles.speiCardHeader}>
                      <Text style={styles.speiUser}>@{item.username}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.speiMonto}>${item.monto_pagado || '?'}</Text>
                        <View style={[styles.speiEstadoBadge, { borderColor: speiEstadoColor(item.estado) }]}>
                          <Text style={[styles.speiEstadoTxt, { color: speiEstadoColor(item.estado) }]}>{speiEstadoLabel(item.estado)}</Text>
                        </View>
                      </View>
                    </View>

                    {item.clave_rastreo ? (
                      <Text style={styles.speiClave}>🔑 {item.clave_rastreo}</Text>
                    ) : (
                      <Text style={styles.speiClaveNull}>⚠️ Sin clave de rastreo</Text>
                    )}

                    {item.ultimo_error_spei ? (
                      <Text style={styles.speiError} numberOfLines={2}>{item.ultimo_error_spei}</Text>
                    ) : null}

                    {/* Datos OCR extraídos por la API */}
                    {ocrData && (
                      <View style={styles.ocrBox}>
                        <Text style={styles.ocrTitle}>📊 Datos extraídos por OCR</Text>
                        {Object.entries(ocrData).map(([k, v]) => (
                          <View key={k} style={styles.ocrRow}>
                            <Text style={styles.ocrKey}>{k}</Text>
                            <Text style={styles.ocrVal} numberOfLines={1}>{String(v)}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <Text style={styles.speiDate}>
                      {item.comprobante_enviado_at ? formatDisplay(item.comprobante_enviado_at) : ''}
                    </Text>

                    <View style={styles.speiActions}>
                      {item.comprobante_url ? (
                        <TouchableOpacity
                          style={styles.speiVerBtn}
                          onPress={() => Linking.openURL(item.comprobante_url)}
                        >
                          <Text style={styles.speiVerText}>🖼 Ver comprobante</Text>
                        </TouchableOpacity>
                      ) : null}
                      {!yaAprobado && (
                        <TouchableOpacity
                          style={[styles.speiAprobarBtn, aprobandoId === item.id && { opacity: 0.6 }]}
                          onPress={() => handleAprobarSPEI(item)}
                          disabled={aprobandoId === item.id}
                        >
                          {aprobandoId === item.id
                            ? <ActivityIndicator size="small" color="#000" />
                            : <Text style={styles.speiAprobarText}>✅ Aprobar</Text>}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── Gestionar Retiros ── */}
        <TouchableOpacity
          style={[styles.retirosBtn, retirosPendientes > 0 && styles.retirosBtnAlert]}
          onPress={handleToggleRetiros}
        >
          <View style={styles.retirosBtnLeft}>
            <Text style={styles.retirosEmoji}>💸</Text>
            <View>
              <Text style={styles.retirosBtnTitle}>Gestionar Retiros</Text>
              <Text style={styles.retirosBtnSub}>
                {retirosPendientes > 0
                  ? `${retirosPendientes} solicitud${retirosPendientes > 1 ? 'es' : ''} pendiente${retirosPendientes > 1 ? 's' : ''}`
                  : 'Sin solicitudes pendientes'}
              </Text>
            </View>
          </View>
          <View style={styles.retirosBtnRight}>
            {retirosPendientes > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeCount}>{retirosPendientes}</Text>
              </View>
            )}
            <Text style={styles.retirosChevron}>{retirosExpanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {retirosExpanded && (
          <View style={styles.retirosList}>
            {loadingRetiros ? (
              <ActivityIndicator color="#F39C12" style={{ paddingVertical: 20 }} />
            ) : retirosData.length === 0 ? (
              <Text style={styles.retirosEmpty}>🎉 Sin retiros pendientes por procesar.</Text>
            ) : (
              retirosData.map((item) => {
                const pagando    = accionandoRetiro === item.id + '_pagar';
                const rechazando = accionandoRetiro === item.id + '_rechazar';
                const ocupado    = pagando || rechazando;
                return (
                  <View key={item.id} style={styles.retiroCard}>
                    <View style={styles.retiroCardHeader}>
                      <View style={styles.retiroAvatarCircle}>
                        <Text style={styles.retiroAvatarTxt}>{(item.profiles?.username ?? 'U')[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.retiroUser}>@{item.profiles?.username ?? 'usuario'}</Text>
                        <Text style={styles.retiroFecha}>{formatFecha(item.created_at)}</Text>
                      </View>
                      <View style={[styles.retiroMetodoBadge, item.metodo === 'spei' ? styles.retiroMetodoSPEI : styles.retiroMetodoMP]}>
                        <Text style={[styles.retiroMetodoTxt, item.metodo === 'spei' ? { color: '#3498DB' } : { color: '#00B1EA' }]}>
                          {item.metodo === 'spei' ? '🏦 SPEI' : '💳 MP'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.retiroMonto}>${Number(item.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })} <Text style={styles.retiroMxn}>MXN</Text></Text>
                    <View style={styles.retiroDestinoBox}>
                      <Text style={styles.retiroDestinoLabel}>{item.metodo === 'spei' ? 'CLABE' : 'Alias / CVU'}</Text>
                      <Text style={styles.retiroDestinoVal} numberOfLines={1}>
                        {item.metodo === 'spei' ? item.clabe : item.alias_mp}
                      </Text>
                    </View>
                    <View style={styles.retiroAcciones}>
                      <TouchableOpacity
                        style={[styles.retiroRechazarBtn, ocupado && { opacity: 0.4 }]}
                        onPress={() => handleRechazarRetiro(item)}
                        disabled={ocupado}
                      >
                        {rechazando
                          ? <ActivityIndicator color="#E74C3C" size="small" />
                          : <Text style={styles.retiroRechazarTxt}>✕ Rechazar</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.retiroPagarBtn, ocupado && { opacity: 0.4 }]}
                        onPress={() => handlePagarRetiro(item)}
                        disabled={ocupado}
                      >
                        {pagando
                          ? <ActivityIndicator color="#000" size="small" />
                          : <Text style={styles.retiroPagarTxt}>✓ Ya pagué</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
            <TouchableOpacity style={styles.retirosVerTodosBtn} onPress={() => router.push('/admin/retiros')}>
              <Text style={styles.retirosVerTodosTxt}>Ver todos los retiros →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Configurar próxima quiniela */}
        <TouchableOpacity style={styles.configHeader} onPress={() => setConfigExpanded(v => !v)}>
          <Text style={styles.configHeaderText}>⏰ Configurar Próxima Quiniela</Text>
          <Text style={styles.configChevron}>{configExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {configExpanded && (
          <View style={styles.configBox}>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setPickerVisible(true)}>
              <Text style={styles.datePickerIcon}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.datePickerLabel}>Seleccionar fecha y hora</Text>
                <Text style={styles.datePickerValue}>
                  {proximaFecha ? formatDisplay(proximaFecha) : 'Sin fecha configurada'}
                </Text>
              </View>
              <Text style={styles.datePickerArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.configBtns}>
              <TouchableOpacity style={[styles.configBtn, styles.configBtnSave]} onPress={handleGuardarFecha} disabled={savingFecha || !proximaFecha}>
                {savingFecha ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.configBtnSaveText}>Guardar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.configBtn, styles.configBtnClear]} onPress={handleLimpiar}>
                <Text style={styles.configBtnClearText}>Limpiar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity style={[styles.createBtn, styles.neonBorderPurple]} onPress={() => router.push('/admin/create')}>
          <Text style={styles.createBtnText}>+ Diseñar Nueva Quiniela</Text>
        </TouchableOpacity>

        {/* Quinielas con filtros */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Quinielas</Text>
          <Text style={styles.sectionCount}>
            {quinielasFiltradas.length}{filtroEstado !== 'todas' ? ` / ${quinielas.length}` : ''}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtrosContainer}>
          {FILTROS.map(f => {
            const activo = filtroEstado === f.key;
            const count = f.key === 'todas'
              ? quinielas.length
              : f.key === 'nula'
                ? quinielas.filter(q => !q.estado || q.estado === 'nula').length
                : quinielas.filter(q => q.estado === f.key).length;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filtroPill, activo && { backgroundColor: f.color, borderColor: f.color }, !activo && { borderColor: f.color }]}
                onPress={() => setFiltroEstado(f.key)}
              >
                <Text style={[styles.filtroPillText, { color: activo ? '#000' : f.color }]}>{f.label}</Text>
                <View style={[styles.filtroCount, activo ? { backgroundColor: 'rgba(0,0,0,0.2)' } : { backgroundColor: `${f.color}22` }]}>
                  <Text style={[styles.filtroCountText, { color: activo ? '#000' : f.color }]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {quinielasFiltradas.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {quinielas.length === 0 ? 'No hay quinielas creadas aún.' : `No hay quinielas con estado "${filtroEstado}".`}
            </Text>
          </View>
        )}

        {quinielasFiltradas.map((q) => (
          <TouchableOpacity key={q.id} style={styles.card} onPress={() => router.push(`/admin/quiniela/${q.id}`)} activeOpacity={0.75}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{q.titulo}</Text>
              <View style={[styles.estadoBadge, { borderColor: getEstadoColor(q.estado) }]}>
                <Text style={[styles.estadoBadgeText, { color: getEstadoColor(q.estado) }]}>{q.estado?.toUpperCase() ?? 'NULA'}</Text>
              </View>
              <Text style={styles.cardArrow}>›</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.infoText}>🎦 Partidos: {q.partidos?.[0]?.count ?? 0}</Text>
              <Text style={styles.infoText}>💰 Entrada: <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>${q.precio_entrada}</Text></Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.infoText}>👥 Mín: <Text style={{ color: '#F39C12', fontWeight: 'bold' }}>{q.jugadores_minimos ?? 0}</Text></Text>
              <Text style={styles.infoText}>🏠 Casa: <Text style={{ color: '#9B59B6', fontWeight: 'bold' }}>{q.porcentaje_admin ?? 0}%</Text></Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={(e) => { e.stopPropagation?.(); handleVerUsuarios(q.id, q.titulo); }}>
                <Text style={styles.actionText}>👥 Usuarios</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, q.estado !== 'abierta' && styles.disabledBtn]}
                disabled={q.estado !== 'abierta' || actionLoading === q.id + '_cerrar'}
                onPress={(e) => { e.stopPropagation?.(); handleCerrarApuestas(q.id, q.titulo); }}
              >
                {actionLoading === q.id + '_cerrar'
                  ? <ActivityIndicator size="small" color="#3498DB" />
                  : <Text style={[styles.actionText, q.estado !== 'abierta' && { color: '#505050' }]}>🔒 Cerrar</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.dangerBtn, q.estado === 'finalizada' && styles.disabledBtn]}
                disabled={q.estado === 'finalizada' || actionLoading === q.id + '_cancelar'}
                onPress={(e) => { e.stopPropagation?.(); handleCancelar(q.id, q.titulo); }}
              >
                {actionLoading === q.id + '_cancelar'
                  ? <ActivityIndicator size="small" color="#E91E63" />
                  : <Text style={[styles.dangerText, q.estado === 'finalizada' && { color: '#505050' }]}>❌ Cancelar</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <DateTimePicker
        visible={pickerVisible}
        initialDate={proximaFecha ? new Date(proximaFecha) : new Date()}
        onConfirm={handlePickerConfirm}
        onCancel={() => setPickerVisible(false)}
      />

      {/* Modal participantes */}
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
                      <Text style={styles.userEmail}>@{item.username}</Text>
                      <Text style={styles.userMeta}>Aciertos: {item.aciertos ?? 0}</Text>
                    </View>
                    <View style={[styles.partEstadoBadge, { borderColor: getEstadoPartColor(item.estado) }]}>
                      <Text style={[styles.partEstadoBadgeText, { color: getEstadoPartColor(item.estado) }]}>{item.estado?.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.userMonto}>${item.monto_pagado ?? 0}</Text>
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
  container:            { flex: 1, backgroundColor: '#0A0C10' },
  header:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backButton:           { width: 60 },
  backText:             { color: '#9B59B6', fontSize: 16 },
  title:                { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  content:              { padding: 15, paddingBottom: 40 },

  statsContainer:       { flexDirection: 'row', backgroundColor: '#15181F', borderRadius: 12, paddingVertical: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35' },
  statBox:              { flex: 1, alignItems: 'center' },
  statValue:            { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  statLabel:            { color: '#A0A0A0', fontSize: 12 },

  speiHeader:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#15181F', borderRadius: 12, padding: 16, marginBottom: 4, borderWidth: 1.5, borderColor: '#2A2D35' },
  speiHeaderAlert:      { borderColor: '#2ECC71' },
  speiHeaderLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  speiEmoji:            { fontSize: 28 },
  speiHeaderTitle:      { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  speiHeaderSub:        { color: '#A0A0A0', fontSize: 12, marginTop: 2 },
  speiBadge:            { backgroundColor: '#2ECC71', borderRadius: 12, minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  speiBadgeCount:       { color: '#000', fontWeight: 'bold', fontSize: 12 },
  speiChevron:          { color: '#2ECC71', fontSize: 12 },
  speiList:             { backgroundColor: '#15181F', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35', gap: 10 },
  speiEmpty:            { color: '#2ECC71', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  speiCard:             { backgroundColor: '#1C1F26', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2A2D35' },
  speiCardHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  speiUser:             { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  speiMonto:            { color: '#2ECC71', fontWeight: 'bold', fontSize: 16 },
  speiEstadoBadge:      { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  speiEstadoTxt:        { fontSize: 10, fontWeight: 'bold' },
  speiClave:            { color: '#A0A0A0', fontSize: 11, marginBottom: 4, fontFamily: 'monospace' },
  speiClaveNull:        { color: '#F39C12', fontSize: 11, marginBottom: 4 },
  speiError:            { color: '#E74C3C', fontSize: 10, marginBottom: 4, fontStyle: 'italic' },
  speiDate:             { color: '#505050', fontSize: 10, marginBottom: 8 },
  speiActions:          { flexDirection: 'row', gap: 8 },
  speiVerBtn:           { flex: 1, backgroundColor: '#1C1F26', paddingVertical: 9, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#3498DB' },
  speiVerText:          { color: '#3498DB', fontSize: 12, fontWeight: '600' },
  speiAprobarBtn:       { flex: 1, backgroundColor: '#2ECC71', paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  speiAprobarText:      { color: '#000', fontSize: 12, fontWeight: 'bold' },

  // OCR data box
  ocrBox:               { backgroundColor: '#12151C', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#2A2D35', gap: 4 },
  ocrTitle:             { color: '#9B59B6', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  ocrRow:               { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  ocrKey:               { color: '#505050', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', flex: 1 },
  ocrVal:               { color: '#E0E0E0', fontSize: 10, fontWeight: '600', flex: 2, textAlign: 'right' },

  retirosBtn:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#15181F', borderRadius: 12, padding: 16, marginBottom: 4, borderWidth: 1.5, borderColor: '#2A2D35' },
  retirosBtnAlert:      { borderColor: '#F39C12' },
  retirosBtnLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  retirosEmoji:         { fontSize: 28 },
  retirosBtnTitle:      { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  retirosBtnSub:        { color: '#A0A0A0', fontSize: 12, marginTop: 2 },
  retirosBtnRight:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:                { backgroundColor: '#E74C3C', borderRadius: 12, minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeCount:           { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  retirosChevron:       { color: '#F39C12', fontSize: 12 },

  retirosList:          { backgroundColor: '#15181F', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35', gap: 10 },
  retirosEmpty:         { color: '#2ECC71', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  retiroCard:           { backgroundColor: '#1C1F26', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2A2D35' },
  retiroCardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  retiroAvatarCircle:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#15181F', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2D35' },
  retiroAvatarTxt:      { color: '#F39C12', fontWeight: 'bold', fontSize: 15 },
  retiroUser:           { color: '#FFF', fontWeight: '700', fontSize: 13 },
  retiroFecha:          { color: '#505050', fontSize: 10, marginTop: 1 },
  retiroMetodoBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  retiroMetodoSPEI:     { backgroundColor: 'rgba(52,152,219,0.1)', borderColor: 'rgba(52,152,219,0.3)' },
  retiroMetodoMP:       { backgroundColor: 'rgba(0,177,234,0.1)', borderColor: 'rgba(0,177,234,0.3)' },
  retiroMetodoTxt:      { fontSize: 11, fontWeight: '700' },
  retiroMonto:          { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  retiroMxn:            { color: '#505050', fontSize: 13 },
  retiroDestinoBox:     { backgroundColor: '#12151C', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#2A2D35' },
  retiroDestinoLabel:   { color: '#505050', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  retiroDestinoVal:     { color: '#E0E0E0', fontWeight: '600', fontSize: 12 },
  retiroAcciones:       { flexDirection: 'row', gap: 8 },
  retiroRechazarBtn:    { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center', borderWidth: 1.5, borderColor: '#E74C3C', backgroundColor: 'rgba(231,76,60,0.07)' },
  retiroRechazarTxt:    { color: '#E74C3C', fontSize: 12, fontWeight: 'bold' },
  retiroPagarBtn:       { flex: 2, backgroundColor: '#2ECC71', paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  retiroPagarTxt:       { color: '#000', fontSize: 12, fontWeight: 'bold' },
  retirosVerTodosBtn:   { marginTop: 4, paddingVertical: 10, alignItems: 'center' },
  retirosVerTodosTxt:   { color: '#F39C12', fontSize: 13, fontWeight: '600' },

  configHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#15181F', borderRadius: 10, padding: 14, marginBottom: 4, borderWidth: 1, borderColor: '#F39C12' },
  configHeaderText:     { color: '#F39C12', fontWeight: 'bold', fontSize: 14 },
  configChevron:        { color: '#F39C12', fontSize: 12 },
  configBox:            { backgroundColor: '#15181F', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#2A2D35' },
  datePickerBtn:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1F26', borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#F39C12', gap: 10 },
  datePickerIcon:       { fontSize: 24 },
  datePickerLabel:      { color: '#A0A0A0', fontSize: 11, marginBottom: 2 },
  datePickerValue:      { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  datePickerArrow:      { color: '#F39C12', fontSize: 22 },
  configBtns:           { flexDirection: 'row', gap: 10 },
  configBtn:            { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  configBtnSave:        { backgroundColor: '#F39C12' },
  configBtnSaveText:    { color: '#000', fontWeight: 'bold', fontSize: 14 },
  configBtnClear:       { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#555' },
  configBtnClearText:   { color: '#A0A0A0', fontWeight: 'bold', fontSize: 14 },

  createBtn:            { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20, borderWidth: 1 },
  neonBorderPurple:     { borderColor: '#9B59B6', backgroundColor: 'rgba(155,89,182,0.1)' },
  createBtnText:        { color: '#9B59B6', fontWeight: 'bold', fontSize: 16 },

  sectionHeaderRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle:         { color: '#A0A0A0', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  sectionCount:         { color: '#505050', fontSize: 12 },

  filtrosContainer:     { paddingBottom: 12, gap: 8 },
  filtroPill:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, backgroundColor: 'transparent' },
  filtroPillText:       { fontSize: 12, fontWeight: '700' },
  filtroCount:          { borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  filtroCountText:      { fontSize: 11, fontWeight: 'bold' },

  emptyBox:             { padding: 30, alignItems: 'center' },
  emptyText:            { color: '#505050', fontSize: 14 },

  card:                 { backgroundColor: '#15181F', borderRadius: 12, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#2A2D35' },
  cardHeader:           { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  cardTitle:            { flex: 1, color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  estadoBadge:          { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  estadoBadgeText:      { fontSize: 10, fontWeight: 'bold' },
  cardArrow:            { color: '#505050', fontSize: 18 },
  cardInfo:             { flexDirection: 'row', gap: 16, marginBottom: 6 },
  infoText:             { color: '#A0A0A0', fontSize: 13 },
  cardActions:          { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn:            { flex: 1, backgroundColor: '#1C1F26', padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35' },
  actionText:           { color: '#3498DB', fontSize: 12, fontWeight: '600' },
  dangerBtn:            { borderColor: '#E74C3C' },
  dangerText:           { color: '#E74C3C', fontSize: 12, fontWeight: '600' },
  disabledBtn:          { opacity: 0.4 },

  modalOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox:             { backgroundColor: '#15181F', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader:          { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  modalTitle:           { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  modalSubtitle:        { flex: 1, color: '#A0A0A0', fontSize: 13 },
  modalClose:           { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2A2D35', alignItems: 'center', justifyContent: 'center' },
  modalCloseText:       { color: '#FFF', fontSize: 16 },

  userRow:              { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2D35', gap: 10 },
  userRank:             { color: '#505050', fontSize: 13, width: 28 },
  userEmail:            { color: '#FFF', fontSize: 14, fontWeight: '600' },
  userMeta:             { color: '#A0A0A0', fontSize: 11, marginTop: 2 },
  partEstadoBadge:      { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  partEstadoBadgeText:  { fontSize: 9, fontWeight: 'bold' },
  userMonto:            { color: '#2ECC71', fontWeight: 'bold', fontSize: 14, minWidth: 50, textAlign: 'right' },
});
