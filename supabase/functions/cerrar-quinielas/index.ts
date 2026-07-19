// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: cerrar-quinielas
// Invocada por pg_cron cada minuto.
// Busca quinielas abiertas con cierre_automatico=true cuyo primer_partido
// ya comenzó (primer_partido <= now()), las cierra y aplica la lógica de
// mínimos: si no se alcanzó → anula y reembolsa; si sí → cierra normal.
// En ambos casos notifica a TODOS los participantes (pagados o pendientes).
// ─────────────────────────────────────────────────────────────────────────────
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET      = Deno.env.get('CRON_SECRET') ?? '';

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token      = authHeader.replace('Bearer ', '');
  if (CRON_SECRET && token !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const resultados: any[] = [];

  // 1. Buscar quinielas candidatas
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

  // Helper: insertar notificación para un usuario
  async function notificar(
    user_id: string,
    titulo: string,
    mensaje: string,
    tipo: string,
    referencia_id?: string,
    referencia_tipo?: string,
  ) {
    if (referencia_id && referencia_tipo) {
      const { data: existe } = await supabase
        .from('notificaciones')
        .select('id')
        .eq('user_id', user_id)
        .eq('tipo', tipo)
        .eq('referencia_id', referencia_id)
        .eq('referencia_tipo', referencia_tipo)
        .maybeSingle();
      if (existe) return;
    }

    const { error } = await supabase.from('notificaciones').insert({
      user_id,
      titulo,
      mensaje,
      tipo,
      leida: false,
      referencia_id: referencia_id ?? null,
      referencia_tipo: referencia_tipo ?? null,
    });
    if (error) console.error(`Error notificando ${user_id}:`, error.message);
  }

  // 2. Procesar cada quiniela
  for (const q of candidatas) {
    try {
      // Obtener TODOS los participantes (pagados y pendientes)
      const { data: todosParticipantes } = await supabase
        .from('participaciones')
        .select('id, user_id, estado, monto_pagado')
        .eq('quiniela_id', q.id);

      const todos        = todosParticipantes ?? [];
      const pagados      = todos.filter(p => ['pagado', 'ganador', 'perdedor'].includes(p.estado));
      const jugadoresPagados = pagados.length;
      const valida       = jugadoresPagados >= q.jugadores_minimos;

      if (valida) {
        // ── Cierre normal ────────────────────────────────────────────
        await supabase
          .from('quinielas')
          .update({ estado: 'cerrada' })
          .eq('id', q.id);

        // Notificar a todos los participantes
        for (const p of todos) {
          await notificar(
            p.user_id,
            '🔒 Quiniela cerrada',
            `La quiniela "${q.titulo}" ya cerró sus apuestas. ¡Suerte!`,
            'quiniela_cerrada',
          );
        }

        resultados.push({ id: q.id, titulo: q.titulo, accion: 'cerrada', jugadores: jugadoresPagados });
        console.log(`✅ Cerrada: "${q.titulo}" (${jugadoresPagados} jugadores)`);

      } else {
        // ── Anulación + reembolsos ────────────────────────────────────
        await supabase
          .from('quinielas')
          .update({ estado: 'anulada' })
          .eq('id', q.id);

        let reembolsados = 0;

        // Reembolsar solo a los pagados
        for (const p of pagados) {
          const monto = Number(p.monto_pagado) > 0 ? Number(p.monto_pagado) : q.precio_entrada;

          // Acreditar wallet
          await supabase.rpc('incrementar_wallet', {
            p_user_id: p.user_id,
            p_monto:   monto,
          });

          // Registrar movimiento en wallet (tabla consumida por wallet del usuario)
          const { data: txExiste } = await supabase
            .from('wallet_transactions')
            .select('id')
            .in('tipo', ['reembolso', 'ajuste_admin'])
            .eq('referencia_id', p.id)
            .maybeSingle();

          if (!txExiste) {
            await supabase.from('wallet_transactions').insert({
              user_id: p.user_id,
              tipo: 'ajuste_admin',
              monto,
              descripcion: `Reembolso: "${q.titulo}" anulada (${jugadoresPagados}/${q.jugadores_minimos} jugadores mínimos)`,
              referencia_id: p.id,
            });
          }

          // Marcar participación como reembolsado
          await supabase
            .from('participaciones')
            .update({ estado: 'reembolsado' })
            .eq('id', p.id);

          // Notificar reembolso
          await notificar(
            p.user_id,
            '💸 Reembolso acreditado',
            `La quiniela "${q.titulo}" fue anulada por no alcanzar el mínimo de jugadores. Se te reembolsaron $${monto} MXN a tu wallet.`,
            'reembolso',
            p.id,
            'participacion_reembolso',
          );

          reembolsados++;
        }

        // Notificar a participantes pendientes (no pagaron, solo les avisamos)
        const pendientes = todos.filter(p => !['pagado', 'ganador', 'perdedor'].includes(p.estado));
        for (const p of pendientes) {
          await notificar(
            p.user_id,
            '❌ Quiniela anulada',
            `La quiniela "${q.titulo}" fue anulada por no alcanzar el mínimo de ${q.jugadores_minimos} jugadores. No se realizó ningún cargo.`,
            'quiniela_anulada',
            p.id,
            'participacion_anulada',
          );
        }

        resultados.push({
          id: q.id,
          titulo: q.titulo,
          accion: 'anulada_y_reembolsada',
          jugadores: jugadoresPagados,
          minimo: q.jugadores_minimos,
          reembolsados,
          notificados_pendientes: pendientes.length,
        });
        console.log(`❌ Anulada: "${q.titulo}" (${jugadoresPagados}/${q.jugadores_minimos}) — ${reembolsados} reembolsos, ${pendientes.length} avisos`);
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
