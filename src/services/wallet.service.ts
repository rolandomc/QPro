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

  /** Últimas N transacciones del usuario */
  async getTransacciones(limit = 20) {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  /** Historial de retiros solicitados */
  async getRetiros() {
    const { data, error } = await supabase
      .from('retiro_solicitudes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return data ?? [];
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

    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-retiro`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al solicitar retiro');
    return json;
  },
};
