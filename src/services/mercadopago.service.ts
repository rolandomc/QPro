import { supabase } from '../config/supabase';

export const MercadoPagoService = {
  /**
   * Llama a la Edge Function que crea la preferencia en MP
   * y devuelve la URL de pago (init_point).
   */
  async crearPreferencia(participacionId: string, quinielaId: string): Promise<{
    preference_id: string;
    init_point: string;
    sandbox_init_point: string;
  }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No autenticado');

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const res = await fetch(
      `${supabaseUrl}/functions/v1/crear-preferencia-mp`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ participacion_id: participacionId, quiniela_id: quinielaId }),
      }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al crear preferencia MP');
    return json;
  },
};
