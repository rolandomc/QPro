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

  let eventKey = '';

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

    eventKey = `${solicitud_id}:${accion}`;
    const eventState = await claimPaymentEvent(supabase, {
      source: 'procesar-retiro',
      externalId: eventKey,
      payload: { solicitud_id, accion, nota },
    });

    if (eventState === 'processed' || eventState === 'processing') {
      return json({ success: true, idempotent: true });
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

      await upsertNotification(supabase, {
        userId: solicitud.user_id,
        tipo: 'retiro_enviado',
        titulo: '💸 Retiro enviado',
        mensaje: `Tu retiro de $${solicitud.monto} MXN fue procesado. Revisa tu cuenta.`,
        referenciaId: solicitud.id,
        referenciaTipo: 'retiro_solicitud',
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

      await upsertNotification(supabase, {
        userId: solicitud.user_id,
        tipo: 'retiro_rechazado',
        titulo: '❌ Retiro rechazado',
        mensaje: nota
          ? `Tu retiro de $${solicitud.monto} MXN fue rechazado. Motivo: ${nota}. El saldo fue devuelto.`
          : `Tu retiro de $${solicitud.monto} MXN fue rechazado. El saldo fue devuelto a tu billetera.`,
        referenciaId: solicitud.id,
        referenciaTipo: 'retiro_solicitud',
      });
    }

    await markPaymentEventProcessed(supabase, 'procesar-retiro', eventKey, solicitud_id);

    return json({ success: true });

  } catch (err: any) {
    console.error('procesar-retiro catch:', err);
    try {
      if (eventKey) {
        await markPaymentEventFailed(
          createClient(SUPABASE_URL, SERVICE_KEY),
          'procesar-retiro',
          eventKey,
          null,
          err?.message ?? 'Error interno',
        );
      }
    } catch {}
    return json({ error: err.message ?? 'Error interno' }, 500);
  }
});

async function claimPaymentEvent(
  supabase: ReturnType<typeof createClient>,
  params: { source: string; externalId: string; payload: unknown },
): Promise<'claimed' | 'processed' | 'processing' | 'failed'> {
  const { source, externalId, payload } = params;
  const { data } = await supabase
    .from('payment_events')
    .insert({
      source,
      external_id: externalId,
      status: 'processing',
      payload: payload as any,
    })
    .select('status')
    .maybeSingle();

  if (data) return 'claimed';

  const { data: existing } = await supabase
    .from('payment_events')
    .select('status')
    .eq('source', source)
    .eq('external_id', externalId)
    .maybeSingle();

  return existing?.status ?? 'failed';
}

async function markPaymentEventProcessed(
  supabase: ReturnType<typeof createClient>,
  source: string,
  externalId: string,
  referenceId?: string | null,
) {
  await supabase
    .from('payment_events')
    .update({
      status: 'processed',
      reference_id: referenceId ?? null,
      reference_type: 'retiro_solicitud',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('source', source)
    .eq('external_id', externalId);
}

async function markPaymentEventFailed(
  supabase: ReturnType<typeof createClient>,
  source: string,
  externalId: string,
  referenceId: string | null,
  errorMessage: string,
) {
  await supabase
    .from('payment_events')
    .update({
      status: 'failed',
      reference_id: referenceId,
      reference_type: 'retiro_solicitud',
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('source', source)
    .eq('external_id', externalId);
}

async function upsertNotification(
  supabase: ReturnType<typeof createClient>,
  params: {
    userId: string;
    tipo: string;
    titulo: string;
    mensaje: string;
    referenciaId: string;
    referenciaTipo: string;
  },
) {
  const { userId, tipo, titulo, mensaje, referenciaId, referenciaTipo } = params;
  const { data: exists } = await supabase
    .from('notificaciones')
    .select('id')
    .eq('user_id', userId)
    .eq('tipo', tipo)
    .eq('referencia_id', referenciaId)
    .eq('referencia_tipo', referenciaTipo)
    .maybeSingle();

  if (exists) return;

  await supabase.from('notificaciones').insert({
    user_id: userId,
    tipo,
    titulo,
    mensaje,
    leida: false,
    referencia_id: referenciaId,
    referencia_tipo: referenciaTipo,
  });
}
