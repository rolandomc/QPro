import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Obtener el usuario del JWT
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401 });
    }

    const { participacion_id, quiniela_id } = await req.json();
    if (!participacion_id || !quiniela_id) {
      return new Response(JSON.stringify({ error: "Faltan parametros" }), { status: 400 });
    }

    // Obtener datos de la quiniela
    const { data: quiniela, error: qErr } = await supabase
      .from("quinielas")
      .select("titulo, precio_entrada")
      .eq("id", quiniela_id)
      .single();
    if (qErr || !quiniela) throw new Error("Quiniela no encontrada");

    // Obtener perfil del usuario
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, email")
      .eq("id", user.id)
      .single();

    const appUrl = Deno.env.get("APP_URL") ?? "https://www.qpro.lat";

    // Crear preferencia en Mercado Pago
    const body = {
      items: [{
        id:          quiniela_id,
        title:       `QPro — ${quiniela.titulo}`,
        quantity:    1,
        unit_price:  Number(quiniela.precio_entrada),
        currency_id: "MXN",
      }],
      payer: {
        email: profile?.email ?? user.email,
      },
      external_reference: participacion_id,
      back_urls: {
        success: `${appUrl}/pago/exito?quinielaId=${quiniela_id}`,
        // Incluimos quinielaId para que la pantalla de fallo pueda ofrecer "Reintentar"
        failure: `${appUrl}/pago/fallo?quinielaId=${quiniela_id}`,
        pending: `${appUrl}/pago/pendiente?quinielaId=${quiniela_id}`,
      },
      auto_return:          "approved",
      notification_url:     `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
      statement_descriptor: "QPRO",
      metadata: {
        participacion_id,
        quiniela_id,
        user_id: user.id,
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!mpRes.ok) {
      const err = await mpRes.text();
      throw new Error(`MP error: ${err}`);
    }

    const preference = await mpRes.json();

    // Guardar preference_id en la participacion
    await supabase
      .from("participaciones")
      .update({ mp_preference_id: preference.id })
      .eq("id", participacion_id);

    return new Response(
      JSON.stringify({
        preference_id: preference.id,
        init_point:    preference.init_point,
        sandbox_init_point: preference.sandbox_init_point,
      }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
