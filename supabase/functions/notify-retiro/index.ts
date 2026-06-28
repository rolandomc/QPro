import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')    ?? '';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!;

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
    const supabase   = createClient(SUPABASE_URL, SUPABASE_KEY);
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'No autenticado' }, 401);

    const body = await req.json();
    const { monto, metodo, clabe, alias_mp } = body;

    if (!monto || monto <= 0)                               return json({ error: 'Monto inválido' }, 400);
    if (!metodo || !['spei','mercadopago'].includes(metodo)) return json({ error: 'Método inválido' }, 400);
    if (metodo === 'spei' && !clabe)                        return json({ error: 'CLABE requerida' }, 400);
    if (metodo === 'mercadopago' && !alias_mp)              return json({ error: 'Alias MP requerido' }, 400);

    // Bloquear duplicado
    const { data: pendiente } = await supabase
      .from('retiro_solicitudes')
      .select('id')
      .eq('user_id', user.id)
      .eq('estado', 'pendiente')
      .limit(1);
    if ((pendiente ?? []).length > 0) {
      return json({ error: 'Ya tienes un retiro pendiente. Espera a que sea procesado.' }, 400);
    }

    // Verificar saldo
    const { data: saldoData, error: saldoErr } = await supabase
      .rpc('get_wallet_saldo', { p_user_id: user.id });
    if (saldoErr) throw saldoErr;
    const saldo = Number(saldoData ?? 0);
    if (saldo < monto) {
      return json({ error: `Saldo insuficiente. Disponible: $${saldo.toFixed(2)}` }, 400);
    }

    // Guardar solicitud
    const { data: solicitud, error: insertError } = await supabase
      .from('retiro_solicitudes')
      .insert({ user_id: user.id, monto, metodo, clabe: clabe ?? null, alias_mp: alias_mp ?? null, estado: 'pendiente' })
      .select()
      .single();
    if (insertError) throw insertError;

    // Descontar saldo
    await supabase.from('wallet_transactions').insert({
      user_id:       user.id,
      tipo:          'retiro',
      monto:         -Math.abs(monto),
      descripcion:   `Retiro ${metodo.toUpperCase()} solicitado`,
      referencia_id: solicitud.id,
    });

    // Email admin
    if (RESEND_API_KEY && ADMIN_EMAIL) {
      const destinatario = metodo === 'spei' ? `CLABE: ${clabe}` : `Alias MP: ${alias_mp}`;
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'QPro <onboarding@resend.dev>',
            to:      [ADMIN_EMAIL],
            subject: `💰 Solicitud de retiro — $${monto} MXN`,
            html: `<h2>Nueva solicitud de retiro</h2>
              <table style="font-family:sans-serif;font-size:14px">
                <tr><td><b>Usuario:</b></td><td>${profile?.username ?? user.email}</td></tr>
                <tr><td><b>Email:</b></td><td>${user.email}</td></tr>
                <tr><td><b>Monto:</b></td><td><b style="color:#27ae60">$${monto} MXN</b></td></tr>
                <tr><td><b>Método:</b></td><td>${metodo.toUpperCase()}</td></tr>
                <tr><td><b>Destino:</b></td><td>${destinatario}</td></tr>
                <tr><td><b>ID:</b></td><td><code>${solicitud.id}</code></td></tr>
              </table>`,
          }),
        });
        if (!emailRes.ok) console.error('Resend error:', await emailRes.json().catch(() => ({})));
      } catch (e) { console.error('Email exception:', e); }
    }

    return json({ success: true, solicitud_id: solicitud.id });

  } catch (err: any) {
    console.error('notify-retiro error:', err);
    return json({ error: err.message ?? 'Error interno' }, 500);
  }
});
