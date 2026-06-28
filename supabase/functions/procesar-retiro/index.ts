import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'No autenticado' }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') return json({ error: 'No autorizado' }, 403);

    const body = await req.json();
    const { solicitud_id, accion, nota } = body;

    if (!solicitud_id || !['pagar', 'rechazar'].includes(accion)) {
      return json({ error: 'Parámetros inválidos' }, 400);
    }

    const { data: solicitud, error: solError } = await supabase
      .from('retiro_solicitudes')
      .select('*')
      .eq('id', solicitud_id)
      .single();

    if (solError) return json({ error: `Error leyendo solicitud: ${solError.message}` }, 500);
    if (!solicitud) return json({ error: 'Solicitud no encontrada' }, 404);
    if (solicitud.estado !== 'pendiente') return json({ error: `Ya procesada (estado: ${solicitud.estado})` }, 400);

    if (accion === 'pagar') {
      const { error: updateError } = await supabase
        .from('retiro_solicitudes')
        .update({
          estado:     'pagado',
          nota_admin: nota ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitud_id)
        .eq('estado', 'pendiente');

      if (updateError) {
        console.error('Error update retiro:', updateError);
        return json({ error: `Error al actualizar: ${updateError.message}` }, 500);
      }

      const { data: check, error: checkError } = await supabase
        .from('retiro_solicitudes')
        .select('estado')
        .eq('id', solicitud_id)
        .single();

      if (checkError) {
        console.error('Error verificando estado:', checkError);
        return json({ error: `Error verificando estado: ${checkError.message}` }, 500);
      }

      if (check?.estado !== 'pagado') {
        console.error('Estado no cambió, valor actual:', check?.estado);
        return json({ error: `El estado no se actualizó (actual: ${check?.estado})` }, 500);
      }

      await supabase
        .from('wallet_transactions')
        .update({ descripcion: `Retiro ${solicitud.metodo.toUpperCase()} — enviado` })
        .eq('referencia_id', solicitud.id)
        .eq('tipo', 'retiro');

      await supabase.from('notificaciones').insert({
        user_id: solicitud.user_id,
        titulo:  '💸 Retiro enviado',
        mensaje: `Tu retiro de $${solicitud.monto} MXN fue procesado. Revisa tu cuenta.`,
      });

    } else {
      const { error: updateError } = await supabase
        .from('retiro_solicitudes')
        .update({
          estado:     'rechazado',
          nota_admin: nota ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitud_id)
        .eq('estado', 'pendiente');

      if (updateError) {
        console.error('Error rechazando retiro:', updateError);
        return json({ error: `Error al rechazar: ${updateError.message}` }, 500);
      }

      const { error: txError } = await supabase.from('wallet_transactions').insert({
        user_id:       solicitud.user_id,
        tipo:          'ajuste_admin',
        monto:         Math.abs(Number(solicitud.monto)),
        descripcion:   `Devolución retiro rechazado — ${nota ?? 'sin motivo'}`,
        referencia_id: solicitud.id,
      });

      if (txError) {
        console.error('Error devolviendo saldo:', txError);
        return json({ error: `Rechazado pero error devolviendo saldo: ${txError.message}` }, 500);
      }

      await supabase.from('notificaciones').insert({
        user_id: solicitud.user_id,
        titulo:  '❌ Retiro rechazado',
        mensaje: nota
          ? `Tu retiro de $${solicitud.monto} MXN fue rechazado. Motivo: ${nota}. El saldo fue devuelto.`
          : `Tu retiro de $${solicitud.monto} MXN fue rechazado. El saldo fue devuelto a tu billetera.`,
      });
    }

    return json({ success: true });

  } catch (err: any) {
    console.error('procesar-retiro catch:', err);
    return json({ error: err.message ?? 'Error interno' }, 500);
  }
});
