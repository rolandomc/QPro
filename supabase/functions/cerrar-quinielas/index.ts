// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: cerrar-quinielas
// Invocada por pg_cron cada minuto.
// Busca quinielas abiertas con cierre_automatico=true cuyo primer_partido
// ya comenzó (primer_partido <= now()), las cierra y aplica la lógica de
// mínimos: si no se alcanzó → anula y reembolsa; si sí → cierra normal.
// ─────────────────────────────────────────────────────────────────────────────
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET        = Deno.env.get('CRON_SECRET') ?? '';

serve(async (req) => {
  // Verificar secret para que solo pg_cron/Supabase pueda invocarla
  const authHeader = req.headers.get('Authorization') ?? '';
  const token      = authHeader.replace('Bearer ', '');
  if (CRON_SECRET && token !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const resultados: any[] = [];

  // 1. Buscar quinielas candidatas al cierre automático
  const { data: candidatas, error: errQ } = await supabase
    .from('quinielas')
    .select('id, titulo, jugadores_minimos, precio_entrada')
    .eq('estado', 'abierta')
    .eq('cierre_automatico', true)
    .not('primer_partido', 'is', null)
    .lte('primer_partido', new Date().toISOString());

  if (errQ) {
    console.error('Error al buscar candidatas:', errQ.message);
    return new Response(JSON.stringify({ error: errQ.message }), { status: 500 });
  }

  if (!candidatas || candidatas.length === 0) {
    return new Response(JSON.stringify({ cerradas: 0, mensaje: 'Sin quinielas para cerrar' }), { status: 200 });
  }

  // 2. Procesar cada quiniela
  for (const q of candidatas) {
    try {
      // Contar jugadores pagados
      const { count } = await supabase
        .from('participaciones')
        .select('*', { count: 'exact', head: true })
        .eq('quiniela_id', q.id)
        .in('estado', ['pagado', 'ganador', 'perdedor']);

      const jugadoresPagados = count ?? 0;
      const valida           = jugadoresPagados >= q.jugadores_minimos;

      if (valida) {
        // ── Cierre normal ────────────────────────────────────────────────
        await supabase
          .from('quinielas')
          .update({ estado: 'cerrada' })
          .eq('id', q.id);

        resultados.push({ id: q.id, titulo: q.titulo, accion: 'cerrada', jugadores: jugadoresPagados });
        console.log(`✅ Cerrada: "${q.titulo}" (${jugadoresPagados} jugadores)`);
      } else {
        // ── Anulación + reembolsos ────────────────────────────────────────
        await supabase
          .from('quinielas')
          .update({ estado: 'anulada' })
          .eq('id', q.id);

        const { data: participantes } = await supabase
          .from('participaciones')
          .select('id, user_id, monto_pagado')
          .eq('quiniela_id', q.id)
          .eq('estado', 'pagado');

        let reembolsados = 0;
        for (const p of (participantes ?? [])) {
          const monto = p.monto_pagado ?? q.precio_entrada;

          // Acreditar wallet
          await supabase.rpc('incrementar_wallet', {
            p_user_id: p.user_id,
            p_monto:   monto,
          });

          // Registrar movimiento
          await supabase.from('wallet_movimientos').insert({
            user_id:     p.user_id,
            tipo:        'reembolso',
            monto,
            descripcion: `Reembolso automático: "${q.titulo}" anulada (${jugadoresPagados}/${q.jugadores_minimos} jugadores)`,
            quiniela_id: q.id,
          });

          // Marcar participación
          await supabase
            .from('participaciones')
            .update({ estado: 'reembolsado' })
            .eq('id', p.id);

          reembolsados++;
        }

        resultados.push({
          id: q.id,
          titulo: q.titulo,
          accion: 'anulada_y_reembolsada',
          jugadores: jugadoresPagados,
          minimo: q.jugadores_minimos,
          reembolsados,
        });
        console.log(`❌ Anulada: "${q.titulo}" (${jugadoresPagados}/${q.jugadores_minimos}) — ${reembolsados} reembolsos`);
      }
    } catch (err: any) {
      console.error(`Error procesando quiniela ${q.id}:`, err.message);
      resultados.push({ id: q.id, titulo: q.titulo, accion: 'error', error: err.message });
    }
  }

  return new Response(
    JSON.stringify({ cerradas: resultados.filter(r => r.accion === 'cerrada').length, resultados }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
