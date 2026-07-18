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

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json();

    // MP envia: { type: "payment", action: "payment.updated", data: { id: "..." } }
    if (body.type !== "payment" || !body.data?.id) {
      return new Response("ignored", { status: 200 });
    }

    const paymentId = String(body.data.id);

    // Consultar el pago a la API de MP para verificarlo
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!mpRes.ok) throw new Error(`MP payment fetch failed: ${mpRes.status}`);

    const payment = await mpRes.json();
    const status           = payment.status;           // "approved" | "pending" | "rejected" ...
    const participacionId  = payment.external_reference; // lo seteamos al crear la preferencia
    const montoPagado      = Number(payment.transaction_amount ?? 0);

    if (!participacionId) {
      return new Response("no external_reference", { status: 200 });
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
        .select("quiniela_id")
        .single();

      if (partErr) throw partErr;

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
      await supabase.from("notificaciones").insert({
        user_id: payment.metadata?.user_id ?? null,
        tipo:    "pago_confirmado",
        titulo:  "✅ Pago confirmado",
        mensaje: `Tu pago de $${montoPagado} fue aprobado. ¡Ya estás inscrito!`,
        leida:   false,
      });

    } else if (status === "rejected" || status === "cancelled") {
      await supabase
        .from("participaciones")
        .update({ estado: "pendiente", mp_payment_id: paymentId })
        .eq("id", participacionId);
    }

    return new Response("ok", { status: 200 });
  } catch (e: any) {
    console.error("Webhook error:", e.message);
    // Siempre responder 200 a MP para que no reintente indefinidamente
    return new Response("error handled", { status: 200 });
  }
});
