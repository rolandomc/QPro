// ============================================================
// MLB Stats API Service
// Base URL: https://statsapi.mlb.com/api/v1
// Sin API key, sin registro, 100% gratuita
// ============================================================

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

// ─── Tipos ─────────────────────────────────────────────────────────────────────
export interface MLBGame {
  gamePk:           number;
  equipo_local:     string;   // nombre corto del equipo home
  equipo_visitante: string;   // nombre corto del equipo away
  fecha_partido:    string;   // ISO string UTC
  estado_juego:     string;   // Preview | Live | Final | Postponed | Cancelled
  marcador_local:     number | null;
  marcador_visitante: number | null;
  venue:            string;
  serieInfo:        string;   // ej. "Game 1" o ""
}

export interface MLBTeam {
  id:           number;
  name:         string;
  shortName:    string;
  abbreviation: string;
  division:     string;
  league:       string;
}

export interface MLBStanding {
  teamName:    string;
  wins:        number;
  losses:      number;
  pct:         string;
  gamesBack:   string;
  division:    string;
  league:      string;
}

// ─── Helper fetch ──────────────────────────────────────────────────────────
async function mlbFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${MLB_BASE}${endpoint}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`MLB API error ${res.status}: ${endpoint}`);
  return res.json() as Promise<T>;
}

// ─── Mapear juego raw → MLBGame ─────────────────────────────────────────────
function mapGame(g: any): MLBGame {
  const home  = g.teams?.home;
  const away  = g.teams?.away;
  const score = g.linescore ?? g;

  return {
    gamePk:             g.gamePk,
    equipo_local:       home?.team?.shortName ?? home?.team?.name ?? '?',
    equipo_visitante:   away?.team?.shortName ?? away?.team?.name ?? '?',
    fecha_partido:      g.gameDate,
    estado_juego:       g.status?.detailedState ?? g.status?.abstractGameState ?? 'Preview',
    marcador_local:     home?.score ?? null,
    marcador_visitante: away?.score ?? null,
    venue:              g.venue?.name ?? '',
    serieInfo:          g.seriesDescription ?? '',
  };
}

// ============================================================
export class MLBService {

  // ─── Juegos de una fecha (YYYY-MM-DD) ───────────────────────────────
  static async getGamesByDate(date: string): Promise<MLBGame[]> {
    const data = await mlbFetch<any>(
      `/schedule?sportId=1&date=${date}&hydrate=team,linescore,venue`
    );
    const games: MLBGame[] = [];
    for (const day of (data.dates ?? [])) {
      for (const g of (day.games ?? [])) {
        games.push(mapGame(g));
      }
    }
    return games;
  }

  // ─── Juegos de un rango de fechas ──────────────────────────────────
  static async getGamesByRange(dateFrom: string, dateTo: string): Promise<MLBGame[]> {
    const data = await mlbFetch<any>(
      `/schedule?sportId=1&startDate=${dateFrom}&endDate=${dateTo}&hydrate=team,linescore,venue`
    );
    const games: MLBGame[] = [];
    for (const day of (data.dates ?? [])) {
      for (const g of (day.games ?? [])) {
        games.push(mapGame(g));
      }
    }
    return games;
  }

  // ─── Detalle de un juego por gamePk ─────────────────────────────────
  static async getGameDetail(gamePk: number): Promise<MLBGame | null> {
    try {
      const data = await mlbFetch<any>(
        `/schedule?sportId=1&gamePk=${gamePk}&hydrate=team,linescore,venue`
      );
      const game = data.dates?.[0]?.games?.[0];
      return game ? mapGame(game) : null;
    } catch {
      return null;
    }
  }

  // ─── Resultado final de un juego (para calificar quinielas) ─────────────
  // Retorna 'local' | 'visitante' | null (si no ha terminado)
  static async getResultado(
    gamePk: number
  ): Promise<'local' | 'visitante' | null> {
    const game = await MLBService.getGameDetail(gamePk);
    if (!game) return null;
    const finalStates = ['Final', 'Game Over', 'Completed Early'];
    if (!finalStates.includes(game.estado_juego)) return null;
    if (game.marcador_local === null || game.marcador_visitante === null) return null;
    if (game.marcador_local > game.marcador_visitante) return 'local';
    if (game.marcador_visitante > game.marcador_local) return 'visitante';
    // En béisbol no hay empate, pero por seguridad:
    return null;
  }

  // ─── Todos los equipos MLB ───────────────────────────────────────────────
  static async getTeams(): Promise<MLBTeam[]> {
    const data = await mlbFetch<any>(
      `/teams?sportId=1&hydrate=division,league`
    );
    return (data.teams ?? []).map((t: any): MLBTeam => ({
      id:           t.id,
      name:         t.name,
      shortName:    t.shortName ?? t.teamName ?? t.name,
      abbreviation: t.abbreviation ?? '',
      division:     t.division?.name ?? '',
      league:       t.league?.name ?? '',
    }));
  }

  // ─── Standings (posiciones por división) ─────────────────────────────
  // leagueId: 103 = AL, 104 = NL
  static async getStandings(): Promise<MLBStanding[]> {
    const data = await mlbFetch<any>(
      `/standings?leagueId=103,104&season=${new Date().getFullYear()}&standingsTypes=regularSeason&hydrate=team,division,league`
    );
    const standings: MLBStanding[] = [];
    for (const record of (data.records ?? [])) {
      const division = record.division?.name ?? '';
      const league   = record.league?.name  ?? '';
      for (const tr of (record.teamRecords ?? [])) {
        standings.push({
          teamName:  tr.team?.name ?? '?',
          wins:      tr.wins,
          losses:    tr.losses,
          pct:       tr.winningPercentage ?? '.000',
          gamesBack: tr.gamesBack ?? '-',
          division,
          league,
        });
      }
    }
    return standings;
  }

  // ─── Juegos de hoy ─────────────────────────────────────────────────────
  static async getTodayGames(): Promise<MLBGame[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return MLBService.getGamesByDate(today);
  }
}
