import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Edge Function: fetch-resultados
 *
 * Puede llamarse de dos formas:
 *  1. Manual (desde la app admin): POST con body { quiniela_id: "xxx" }
 *  2. Automático (pg_cron cada 5 min): POST sin body → procesa todas las
 *     quinielas cerradas con auto_resultados = true
 *
 * Usa la API de API-Football (api-football.com) para obtener resultados.
 * Configura FOOTBALL_API_KEY en los secrets de Supabase:
 *   supabase secrets set FOOTBALL_API_KEY=tu_key
 */

const FOOTBALL_API_BASE = 'https://v3.football.api-sports.io';

Deno.serve(async (req: Request) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const apiKey = Deno.env.get('FOOTBALL_API_KEY');
    if (!apiKey) {
      return Response.json(
        { error: 'FOOTBALL_API_KEY no configurada. Ejecuta: supabase secrets set FOOTBALL_API_KEY=tu_key' },
        { status: 500 }
      );
    }

    // Determinar qué quinielas procesar
    let quinielaIds: string[] = [];

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    if (body.quiniela_id) {
      // Modo manual: quiniela específica
      quinielaIds = [body.quiniela_id];
    } else {
      // Modo automático: todas las quinielas cerradas con auto habilitado
      const { data: quinielas } = await supabaseClient
        .from('quinielas')
        .select('id')
        .in('estado', ['abierta', 'cerrada'])
        .eq('auto_resultados', true);
      quinielaIds = (quinielas ?? []).map((q: any) => q.id);
    }

    if (quinielaIds.length === 0) {
      return Response.json({ message: 'No hay quinielas para procesar', actualizados: 0 });
    }

    let totalActualizados = 0;

    for (const quinielaId of quinielaIds) {
      // Traer partidos sin resultado que tengan fixture_id (ID de la API)
      const { data: partidos } = await supabaseClient
        .from('partidos')
        .select('id, fixture_id, resultado')
        .eq('quiniela_id', quinielaId)
        .not('fixture_id', 'is', null);

      if (!partidos || partidos.length === 0) continue;

      const pendientes = partidos.filter((p: any) => !p.resultado);
      if (pendientes.length === 0) continue;

      // Fetch resultados de la API para cada partido pendiente
      for (const partido of pendientes) {
        const res = await fetch(
          `${FOOTBALL_API_BASE}/fixtures?id=${partido.fixture_id}`,
          {
            headers: {
              'x-apisports-key': apiKey,
              'Content-Type': 'application/json',
            },
          }
        );

        const json = await res.json();
        const fixture = json.response?.[0];
        if (!fixture) continue;

        const status = fixture.fixture?.status?.short;
        // Solo procesar partidos terminados (FT, AET, PEN)
        if (!['FT', 'AET', 'PEN'].includes(status)) continue;

        const goalsHome = fixture.goals?.home ?? 0;
        const goalsAway = fixture.goals?.away ?? 0;

        let resultado: 'local' | 'empate' | 'visitante';
        if (goalsHome > goalsAway) resultado = 'local';
        else if (goalsHome === goalsAway) resultado = 'empate';
        else resultado = 'visitante';

        await supabaseClient
          .from('partidos')
          .update({ resultado })
          .eq('id', partido.id);

        totalActualizados++;
      }

      // Recalcular aciertos si hubo actualizaciones
      if (totalActualizados > 0) {
        const { data: participaciones } = await supabaseClient
          .from('participaciones')
          .select('id')
          .eq('quiniela_id', quinielaId);

        const { data: partidosConResultado } = await supabaseClient
          .from('partidos')
          .select('id, resultado')
          .eq('quiniela_id', quinielaId)
          .not('resultado', 'is', null);

        const resultadoMap = Object.fromEntries(
          (partidosConResultado ?? []).map((p: any) => [p.id, p.resultado])
        );

        for (const part of participaciones ?? []) {
          const { data: sels } = await supabaseClient
            .from('selecciones')
            .select('partido_id, prediccion')
            .eq('participacion_id', part.id);

          const aciertos = (sels ?? []).filter(
            (s: any) => resultadoMap[s.partido_id] === s.prediccion
          ).length;

          await supabaseClient
            .from('participaciones')
            .update({ aciertos })
            .eq('id', part.id);
        }
      }
    }

    return Response.json({ actualizados: totalActualizados, message: `${totalActualizados} partido(s) actualizados` });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
