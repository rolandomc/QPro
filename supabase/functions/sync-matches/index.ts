import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const FOOTBALL_API_KEY = Deno.env.get("FOOTBALL_DATA_API_KEY") ?? "";
const THESPORTSDB_API_KEY = Deno.env.get("THESPORTSDB_API_KEY") ?? "3";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json";

const COMPETITIONS: Record<string, string> = {
  "WC": "Mundial FIFA",
  "PL": "Premier League",
  "PD": "La Liga",
  "BL1": "Bundesliga",
  "SA": "Serie A",
  "FL1": "Ligue 1",
  "CL": "Champions League",
  "MX1": "Liga MX",
};

const THESPORTSDB_LEAGUE_BY_COMP: Record<string, string> = {
  "WC": "4429",
  "PL": "4328",
  "PD": "4335",
  "BL1": "4331",
  "SA": "4332",
  "FL1": "4334",
  "CL": "4480",
  "MX1": "4350",
};

function inferSeason(dateRef: string): string {
  const d = new Date(dateRef);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  if (month >= 8) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  try {
    const body = await req.json();
    const { quiniela_id, competition_code = "WC", matchday, preview_only = false } = body;

    // Provider 1: football-data.org
    let rawMatches: any[] = [];
    let source = "football-data";
    if (FOOTBALL_API_KEY) {
      let url = `https://api.football-data.org/v4/competitions/${competition_code}/matches?status=SCHEDULED`;
      if (matchday) url += `&matchday=${matchday}`;

      const response = await fetch(url, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
      });

      if (response.ok) {
        const apiData = await response.json();
        rawMatches = apiData.matches || [];
      }
    }

    // Provider 2: TheSportsDB (si no hubo resultados)
    if (rawMatches.length === 0) {
      const leagueId = THESPORTSDB_LEAGUE_BY_COMP[String(competition_code)];
      if (leagueId) {
        const seasons = [
          inferSeason(new Date().toISOString()),
          inferSeason(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()),
        ];

        const events: any[] = [];
        for (const season of seasons) {
          const res = await fetch(`${THESPORTSDB_BASE}/${THESPORTSDB_API_KEY}/eventsseason.php?id=${leagueId}&s=${season}`);
          if (!res.ok) continue;
          const json = await res.json();
          if (Array.isArray(json?.events) && json.events.length > 0) {
            events.push(...json.events);
          }
        }

        const now = Date.now();
        rawMatches = events
          .map((ev: any) => {
            const dt = ev?.strTimestamp || (ev?.dateEvent ? `${ev.dateEvent}T00:00:00Z` : null);
            if (!dt) return null;
            const ts = new Date(dt).getTime();
            if (Number.isNaN(ts) || ts < now) return null;

            return {
              id: ev?.idEvent,
              utcDate: dt,
              homeTeam: {
                shortName: ev?.strHomeTeam,
                name: ev?.strHomeTeam,
                crest: ev?.strHomeTeamBadge ?? null,
              },
              awayTeam: {
                shortName: ev?.strAwayTeam,
                name: ev?.strAwayTeam,
                crest: ev?.strAwayTeamBadge ?? null,
              },
            };
          })
          .filter(Boolean) as any[];

        source = "thesportsdb";
      }
    }

    if (rawMatches.length === 0) {
      return new Response(
        JSON.stringify({ success: true, inserted: 0, matches: [], competition: COMPETITIONS[competition_code] || competition_code, source }),
        { status: 200 }
      );
    }

    // Mapear al formato de nuestra app
    const mappedMatches = rawMatches.map((match: any, index: number) => ({
      external_id: String(match.id),
      equipo_local: match.homeTeam?.shortName || match.homeTeam?.name || "TBD",
      equipo_visitante: match.awayTeam?.shortName || match.awayTeam?.name || "TBD",
      fecha_partido: match.utcDate,
      logo_local: match.homeTeam?.crest ?? null,
      logo_visitante: match.awayTeam?.crest ?? null,
      orden: index + 1,
    }));

    // --- MODO PREVIEW: solo devolver los partidos, NO guardar nada ---
    if (preview_only) {
      return new Response(
        JSON.stringify({
          success: true,
          competition: COMPETITIONS[competition_code] || competition_code,
          source,
          matches: mappedMatches,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // --- MODO NORMAL: requiere quiniela_id y guarda en DB ---
    if (!quiniela_id) {
      return new Response(JSON.stringify({ error: "quiniela_id es requerido cuando preview_only es false" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const partidosFull = mappedMatches.map((m: any) => ({
      ...m,
      quiniela_id,
      resultado: null,
    }));

    let inserted: any[] | null = null;
    let insertError: any = null;

    const insertFull = await supabase
      .from("partidos")
      .upsert(partidosFull, { onConflict: "quiniela_id,external_id", ignoreDuplicates: false })
      .select();

    inserted = insertFull.data;
    insertError = insertFull.error;

    if (insertError?.message?.includes("logo_local") || insertError?.message?.includes("logo_visitante")) {
      const partidosBasic = mappedMatches.map((m: any) => ({
        external_id: m.external_id,
        equipo_local: m.equipo_local,
        equipo_visitante: m.equipo_visitante,
        fecha_partido: m.fecha_partido,
        orden: m.orden,
        quiniela_id,
        resultado: null,
      }));

      const insertBasic = await supabase
        .from("partidos")
        .upsert(partidosBasic, { onConflict: "quiniela_id,external_id", ignoreDuplicates: false })
        .select();

      inserted = insertBasic.data;
      insertError = insertBasic.error;
    }

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Error al guardar partidos", detail: insertError.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: inserted?.length || 0,
        competition: COMPETITIONS[competition_code] || competition_code,
        source,
        matches: inserted,
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Error interno", detail: err.message }),
      { status: 500 }
    );
  }
});
