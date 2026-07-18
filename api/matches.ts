import type { VercelRequest, VercelResponse } from '@vercel/node';

const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json';
const LEAGUE_BY_COMP: Record<string, string> = {
  PD: '4335',
  PL: '4328',
  CL: '4480',
  WC: '4429',
  BL1: '4331',
  SA: '4332',
  FL1: '4334',
  BSA: '4351',
  MLS: '4346',
};

function inferSeason(dateRef: string): string {
  const d = new Date(dateRef);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  if (month >= 8) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function normalizeSportsDbStatus(raw: string | null | undefined): string {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('final')) return 'FINISHED';
  if (s.includes('live') || s.includes('in progress') || s.includes('2nd half') || s.includes('1st half')) return 'LIVE';
  return 'SCHEDULED';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { competition, matchday, status, dateFrom, dateTo } = req.query;

  if (!competition) {
    return res.status(400).json({ error: 'competition param is required' });
  }

  const params = new URLSearchParams();
  if (matchday) params.set('matchday', String(matchday));
  if (dateFrom) params.set('dateFrom', String(dateFrom));
  if (dateTo) params.set('dateTo', String(dateTo));
  if (status && status !== 'ALL') params.set('status', String(status));

  const query = params.toString();
  const url = `https://api.football-data.org/v4/competitions/${competition}/matches${query ? '?' + query : ''}`;

  const response = await fetch(url, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY! },
  });

  const data = await response.json();

  const hasPrimaryMatches = Array.isArray(data?.matches) && data.matches.length > 0;
  if (response.ok && hasPrimaryMatches) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status).json(data);
  }

  // Fallback: TheSportsDB cuando no hay partidos o falla la API primaria.
  const leagueId = LEAGUE_BY_COMP[String(competition)];
  if (!leagueId) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status).json(data);
  }

  const sportsKey = process.env.THESPORTSDB_API_KEY || '3';
  const seasonRef = String(dateFrom || dateTo || new Date().toISOString());
  const seasons = [inferSeason(seasonRef), inferSeason(new Date().toISOString())];

  let events: any[] = [];
  for (const season of seasons) {
    const sportsRes = await fetch(`${THESPORTSDB_BASE}/${sportsKey}/eventsseason.php?id=${leagueId}&s=${season}`);
    if (!sportsRes.ok) continue;
    const sportsJson = await sportsRes.json();
    if (Array.isArray(sportsJson?.events) && sportsJson.events.length > 0) {
      events = events.concat(sportsJson.events);
    }
  }

  if (events.length === 0) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status).json(data);
  }

  const fromTs = dateFrom ? new Date(String(dateFrom)).getTime() : null;
  const toTs = dateTo ? new Date(String(dateTo)).getTime() : null;
  const requested = String(status || 'SCHEDULED');

  const fallbackMatches = events
    .map((ev: any) => {
      const utcDate = ev?.strTimestamp || (ev?.dateEvent ? `${ev.dateEvent}T00:00:00Z` : null);
      if (!utcDate) return null;
      const ts = new Date(utcDate).getTime();
      if (Number.isNaN(ts)) return null;
      if (fromTs !== null && ts < fromTs) return null;
      if (toTs !== null && ts > toTs + 86_399_999) return null;

      const st = normalizeSportsDbStatus(ev?.strStatus);
      if (requested !== 'ALL' && st !== requested) return null;

      return {
        id: ev?.idEvent,
        utcDate,
        status: st,
        homeTeam: {
          name: ev?.strHomeTeam,
          shortName: ev?.strHomeTeam,
          crest: ev?.strHomeTeamBadge ?? null,
        },
        awayTeam: {
          name: ev?.strAwayTeam,
          shortName: ev?.strAwayTeam,
          crest: ev?.strAwayTeamBadge ?? null,
        },
        score: {
          fullTime: {
            home: ev?.intHomeScore !== null && ev?.intHomeScore !== undefined ? Number(ev.intHomeScore) : null,
            away: ev?.intAwayScore !== null && ev?.intAwayScore !== undefined ? Number(ev.intAwayScore) : null,
          },
        },
      };
    })
    .filter(Boolean);

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    matches: fallbackMatches,
    source: 'thesportsdb',
    fallbackUsed: true,
  });
}
