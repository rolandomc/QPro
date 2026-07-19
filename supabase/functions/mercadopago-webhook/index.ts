import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MP_ACCESS_TOKEN      = Deno.env.get("MP_ACCESS_TOKEN")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  // MP hace GET para verificar que el endpoint existe
  if (req.method === "GET") {
    return new Response("OK", { status: 200 });
  }

  let paymentId = '';
  let participacionId = '';

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json();

    // MP envia: { type: "payment", action: "payment.updated", data: { id: "..." } }
    if (body.type !== "payment" || !body.data?.id) {
      return new Response("ignored", { status: 200 });
    }

    paymentId = String(body.data.id);

    // Consultar el pago a la API de MP para verificarlo
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!mpRes.ok) throw new Error(`MP payment fetch failed: ${mpRes.status}`);

    const payment = await mpRes.json();
    const status           = payment.status;           // "approved" | "pending" | "rejected" ...
    participacionId  = payment.external_reference; // lo seteamos al crear la preferencia
    const montoPagado      = Number(payment.transaction_amount ?? 0);

    if (!participacionId) {
      return new Response("no external_reference", { status: 200 });
    }

    const { data: currentPart } = await supabase
      .from('participaciones')
      .select('estado, mp_payment_id')
      .eq('id', participacionId)
      .maybeSingle();

    const event = await claimPaymentEvent(supabase, {
      source: 'mercadopago-webhook',
      externalId: paymentId,
      payload: payment,
    });

    const alreadyPaid = currentPart?.estado === 'pagado';
    const canReconcileApproved = status === 'approved' && !alreadyPaid;

    if (event === 'processing') {
      return new Response("ok", { status: 200 });
    }

    if (event === 'processed' && !canReconcileApproved) {
      return new Response("ok", { status: 200 });
    }

    const isTerminalStatus = status === 'approved' || status === 'rejected' || status === 'cancelled';
    if (!isTerminalStatus) {
      await markPaymentEventFailed(
        supabase,
        'mercadopago-webhook',
        paymentId,
        participacionId,
        `Estado no terminal: ${status}`,
      );
      return new Response("ok", { status: 200 });
    }

    if (status === "approved") {
      // 1. Actualizar participacion a pagado
      const { data: part, error: partErr } = await supabase
        .from("participaciones")
        .update({
          estado:         "pagado",
          monto_pagado:   montoPagado,
          mp_payment_id:  paymentId,
        })
        .eq("id", participacionId)
        .neq("estado", "pagado")
        .or(`mp_payment_id.is.null,mp_payment_id.eq.${paymentId}`)
        .select("quiniela_id, user_id")
        .maybeSingle();

      if (partErr) throw partErr;
      if (!part) {
        await markPaymentEventProcessed(supabase, 'mercadopago-webhook', paymentId, participacionId);
        return new Response("ok", { status: 200 });
      }

      // 2. Recalcular y actualizar premio_total de la quiniela
      const quinielaId = part.quiniela_id;

      const { data: quiniela } = await supabase
        .from("quinielas")
        .select("precio_entrada, porcentaje_admin, jugadores_minimos")
        .eq("id", quinielaId)
        .single();

      if (quiniela) {
        // Contar participantes pagados
        const { count: pagados } = await supabase
          .from("participaciones")
          .select("*", { count: "exact", head: true })
          .eq("quiniela_id", quinielaId)
          .eq("estado", "pagado");

        const pozo = (pagados ?? 0) * Number(quiniela.precio_entrada);
        const adminPct = Number(quiniela.porcentaje_admin ?? 0);
        const premioTotal = Math.round(pozo * (1 - adminPct / 100));

        await supabase
          .from("quinielas")
          .update({ premio_total: premioTotal })
          .eq("id", quinielaId);
      }

      // 3. Notificacion al usuario
      await upsertNotification(supabase, {
        userId: String(payment.metadata?.user_id ?? part.user_id ?? ''),
        tipo: 'pago_confirmado',
        titulo: '✅ Pago confirmado',
        mensaje: `Tu pago de $${montoPagado} fue aprobado. ¡Ya estás inscrito!`,
        referenciaId: participacionId,
        referenciaTipo: 'participacion_pago',
      });

    } else if (status === "rejected" || status === "cancelled") {
      await supabase
        .from("participaciones")
        .update({ estado: "pendiente", mp_payment_id: paymentId })
        .eq("id", participacionId);
    }

    await markPaymentEventProcessed(supabase, 'mercadopago-webhook', paymentId, participacionId);

    return new Response("ok", { status: 200 });
  } catch (e: any) {
    console.error("Webhook error:", e.message);
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      if (paymentId) {
        await markPaymentEventFailed(supabase, 'mercadopago-webhook', paymentId, participacionId || null, e?.message ?? 'Webhook error');
      }
    } catch {}
    // Siempre responder 200 a MP para que no reintente indefinidamente
    return new Response("error handled", { status: 200 });
  }
});

async function claimPaymentEvent(
  supabase: ReturnType<typeof createClient>,
  params: { source: string; externalId: string; payload: unknown; },
): Promise<'claimed' | 'processed' | 'processing' | 'failed'> {
  const { source, externalId, payload } = params;
  const { data, error } = await supabase
    .from('payment_events')
    .insert({
      source,
      external_id: externalId,
      status: 'processing',
      payload: payload as any,
    })
    .select('status')
    .maybeSingle();

  if (!error && data) return 'claimed';

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
      reference_type: 'participacion',
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
      reference_type: referenceId ? 'participacion' : null,
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
  if (!userId) return;

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
