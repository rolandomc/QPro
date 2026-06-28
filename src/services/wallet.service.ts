import { supabase } from '../config/supabase';

export const WalletService = {
  /** Saldo actual del usuario autenticado */
  async getSaldo(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;
    const { data, error } = await supabase
      .rpc('get_wallet_saldo', { p_user_id: user.id });
    if (error) throw error;
    return Number(data ?? 0);
  },

  /** Últimas N transacciones del usuario incluyendo retiros pendientes */
  async getTransacciones(limit = 30) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Transacciones normales de wallet
    const { data: txs, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    // Retiros solicitados (pendientes/procesados/rechazados)
    const { data: retiros } = await supabase
      .from('retiro_solicitudes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Mapear retiros como movimientos para mostrar en historial
    const retirosComoTx = (retiros ?? []).map((r: any) => ({
      id: `retiro-${r.id}`,
      user_id: r.user_id,
      tipo: 'retiro',
      monto: -Math.abs(r.monto),
      descripcion: `Retiro ${r.metodo.toUpperCase()} · ${r.estado}`,
      referencia_id: r.id,
      created_at: r.created_at,
      estado: r.estado,
    }));

    // Combinar y ordenar por fecha
    const todos = [...(txs ?? []), ...retirosComoTx]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return todos;
  },

  /** Verificar si hay retiro pendiente */
  async tienePendiente(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from('retiro_solicitudes')
      .select('id')
      .eq('user_id', user.id)
      .eq('estado', 'pendiente')
      .limit(1);
    return (data ?? []).length > 0;
  },

  /** Enviar solicitud de retiro via Edge Function */
  async solicitarRetiro(params: {
    monto: number;
    metodo: 'spei' | 'mercadopago';
    clabe?: string;
    alias_mp?: string;
  }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No autenticado');

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error('Configuración incompleta');

    const res = await fetch(
      `${supabaseUrl}/functions/v1/notify-retiro`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params),
      }
    );

    let json: any = {};
    try { json = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
    return json;
  },
};
