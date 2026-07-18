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
 * Usa fallback de proveedores para resultados:
 *  1) football-data.org
 *  2) API-Football (api-sports)
 *  3) TheSportsDB
 *
 * Secrets recomendados:
 *   FOOTBALL_DATA_API_KEY
 *   APISPORTS_API_KEY
 *   THESPORTSDB_API_KEY (opcional, default "3")
 *
 * Compatibilidad:
 *   FOOTBALL_API_KEY se toma como respaldo para APISPORTS_API_KEY.
 */

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const APISPORTS_BASE = 'https://v3.football.api-sports.io';
const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json';

function parseFootballDataResult(match: any): 'local' | 'empate' | 'visitante' | null {
  if (!match) return null;
  if (!['FINISHED', 'AWARDED'].includes(match.status)) return null;

  const home = match?.score?.fullTime?.home ?? match?.score?.fullTime?.homeTeam ?? null;
  const away = match?.score?.fullTime?.away ?? match?.score?.fullTime?.awayTeam ?? null;
  if (home === null || away === null) return null;

  if (home > away) return 'local';
  if (home === away) return 'empate';
  return 'visitante';
}

function parseApiSportsResult(fixture: any): 'local' | 'empate' | 'visitante' | null {
  if (!fixture) return null;
  const status = fixture?.fixture?.status?.short;
  if (!['FT', 'AET', 'PEN'].includes(status)) return null;

  const home = fixture?.goals?.home ?? null;
  const away = fixture?.goals?.away ?? null;
  if (home === null || away === null) return null;

  if (home > away) return 'local';
  if (home === away) return 'empate';
  return 'visitante';
}

function parseSportsDbResult(event: any): 'local' | 'empate' | 'visitante' | null {
  if (!event) return null;
  const status = String(event?.strStatus ?? '').toLowerCase();
  if (!status.includes('final')) return null;

  const home = event?.intHomeScore;
  const away = event?.intAwayScore;
  if (home === null || home === undefined || away === null || away === undefined) return null;

  const h = Number(home);
  const a = Number(away);
  if (Number.isNaN(h) || Number.isNaN(a)) return null;

  if (h > a) return 'local';
  if (h === a) return 'empate';
  return 'visitante';
}

async function resolveResultadoByProviders(
  fixtureId: string | number,
  keys: {
    footballDataKey: string;
    apiSportsKey: string;
    sportsDbKey: string;
  }
): Promise<'local' | 'empate' | 'visitante' | null> {
  const id = String(fixtureId);

  if (keys.footballDataKey) {
    try {
      const res = await fetch(`${FOOTBALL_DATA_BASE}/matches/${id}`, {
        headers: { 'X-Auth-Token': keys.footballDataKey, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        const parsed = parseFootballDataResult(json?.match ?? json);
        if (parsed) return parsed;
      }
    } catch {
      // Continúa con fallback
    }
  }

  if (keys.apiSportsKey) {
    try {
      const res = await fetch(`${APISPORTS_BASE}/fixtures?id=${id}`, {
        headers: { 'x-apisports-key': keys.apiSportsKey, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        const parsed = parseApiSportsResult(json?.response?.[0]);
        if (parsed) return parsed;
      }
    } catch {
      // Continúa con fallback
    }
  }

  if (keys.sportsDbKey) {
    try {
      const res = await fetch(`${THESPORTSDB_BASE}/${keys.sportsDbKey}/lookupevent.php?id=${id}`);
      if (res.ok) {
        const json = await res.json();
        const parsed = parseSportsDbResult(json?.events?.[0]);
        if (parsed) return parsed;
      }
    } catch {
      // Sin más proveedores
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const footballDataKey = Deno.env.get('FOOTBALL_DATA_API_KEY') ?? '';
    const apiSportsKey = Deno.env.get('APISPORTS_API_KEY') ?? Deno.env.get('FOOTBALL_API_KEY') ?? '';
    const sportsDbKey = Deno.env.get('THESPORTSDB_API_KEY') ?? '3';

    if (!footballDataKey && !apiSportsKey && !sportsDbKey) {
      return Response.json(
        { error: 'No hay keys configuradas para providers de resultados.' },
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

      // Fetch resultados con fallback de proveedores
      for (const partido of pendientes) {
        const resultado = await resolveResultadoByProviders(partido.fixture_id, {
          footballDataKey,
          apiSportsKey,
          sportsDbKey,
        });

        if (!resultado) continue;

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
