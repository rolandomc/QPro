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

    if (!monto || monto <= 0)                               return json({ error: 'Monto inv\u00e1lido' }, 400);
    if (!metodo || !['spei','mercadopago'].includes(metodo)) return json({ error: 'M\u00e9todo inv\u00e1lido' }, 400);
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

      // Traer username Y nombre completo del perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', user.id)
        .single();

      const username   = profile?.username   ?? user.email;
      const fullName   = profile?.full_name  ?? null;
      const fechaStr   = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'QPro <onboarding@resend.dev>',
            to:      [ADMIN_EMAIL],
            subject: `\ud83d\udcb0 Solicitud de retiro \u2014 $${monto} MXN`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0f1116;color:#fff;border-radius:12px;padding:28px;border:1px solid #1e2128">
                <h2 style="margin:0 0 20px;color:#2ecc71">\ud83d\udcb8 Nueva solicitud de retiro</h2>
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  <tr style="border-bottom:1px solid #1e2128">
                    <td style="padding:10px 6px;color:#a0a0a0;width:140px"><b>Usuario</b></td>
                    <td style="padding:10px 6px">@${username}</td>
                  </tr>
                  ${fullName ? `
                  <tr style="border-bottom:1px solid #1e2128">
                    <td style="padding:10px 6px;color:#a0a0a0"><b>Nombre completo</b></td>
                    <td style="padding:10px 6px">${fullName}</td>
                  </tr>` : ''}
                  <tr style="border-bottom:1px solid #1e2128">
                    <td style="padding:10px 6px;color:#a0a0a0"><b>Email</b></td>
                    <td style="padding:10px 6px">${user.email}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #1e2128">
                    <td style="padding:10px 6px;color:#a0a0a0"><b>Monto</b></td>
                    <td style="padding:10px 6px"><b style="color:#2ecc71;font-size:16px">$${monto} MXN</b></td>
                  </tr>
                  <tr style="border-bottom:1px solid #1e2128">
                    <td style="padding:10px 6px;color:#a0a0a0"><b>M\u00e9todo</b></td>
                    <td style="padding:10px 6px">${metodo.toUpperCase()}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #1e2128">
                    <td style="padding:10px 6px;color:#a0a0a0"><b>Destino</b></td>
                    <td style="padding:10px 6px"><code style="background:#1c1f28;padding:3px 8px;border-radius:6px">${destinatario}</code></td>
                  </tr>
                  <tr style="border-bottom:1px solid #1e2128">
                    <td style="padding:10px 6px;color:#a0a0a0"><b>Solicitud ID</b></td>
                    <td style="padding:10px 6px"><code style="background:#1c1f28;padding:3px 8px;border-radius:6px;font-size:12px">${solicitud.id}</code></td>
                  </tr>
                  <tr>
                    <td style="padding:10px 6px;color:#a0a0a0"><b>Fecha</b></td>
                    <td style="padding:10px 6px">${fechaStr}</td>
                  </tr>
                </table>
                <div style="margin-top:24px;padding:14px;background:#1c1f28;border-radius:10px;text-align:center">
                  <p style="margin:0;color:#a0a0a0;font-size:13px">Accede al panel admin para procesar o rechazar este retiro.</p>
                </div>
              </div>`,
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
