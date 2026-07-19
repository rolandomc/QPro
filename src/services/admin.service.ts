import { supabase } from '../config/supabase';

export type CompetitionCode = 'PD' | 'PL' | 'MX1' | 'CL' | 'WC' | 'BL1' | 'SA' | 'FL1' | 'BSA' | 'MLS';
export type MatchStatus = 'SCHEDULED' | 'FINISHED' | 'LIVE' | 'ALL';

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const THESPORTSDB_API_BASE = 'https://www.thesportsdb.com/api/v1/json';

const THESPORTSDB_LEAGUE_BY_COMP: Partial<Record<CompetitionCode, string>> = {
  PD: '4335',
  PL: '4328',
  CL: '4480',
  WC: '4429',
  BL1: '4331',
  SA: '4332',
  FL1: '4334',
  MX1: '4350',
  BSA: '4351',
  MLS: '4346',
};

function buildSportsDbUrl(apiKey: string, path: string): string {
  return `${THESPORTSDB_API_BASE}/${apiKey}/${path}`;
}

function inferSeason(dateRef: string): string {
  const d = new Date(dateRef);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  // Temporada típica fútbol: inicia aprox. en agosto.
  if (month >= 8) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function normalizeSportsDbStatus(ev: any): MatchStatus {
  const s = String(ev?.strStatus ?? '').toLowerCase();
  const hasScores = ev?.intHomeScore !== null && ev?.intHomeScore !== undefined &&
                    ev?.intAwayScore !== null && ev?.intAwayScore !== undefined;
  if (hasScores) return 'FINISHED';
  if (s.includes('final')) return 'FINISHED';
  if (s.includes('postponed') || s.includes('canceled') || s.includes('cancelled')) return 'ALL';
  if (s.includes('live') || s.includes('in progress') || s.includes('2nd half') || s.includes('1st half')) return 'LIVE';
  return 'SCHEDULED';
}

function dedupeMatches<T extends { external_id: string; fecha_partido: string }>(matches: T[]): T[] {
  const map = new Map<string, T>();
  for (const m of matches) {
    const key = `${m.external_id}_${m.fecha_partido}`;
    if (!map.has(key)) map.set(key, m);
  }
  return Array.from(map.values()).sort((a, b) => new Date(a.fecha_partido).getTime() - new Date(b.fecha_partido).getTime());
}

function shouldIncludeByStatus(normalized: MatchStatus, requested: MatchStatus | undefined): boolean {
  const rq = requested ?? 'SCHEDULED';
  if (rq === 'ALL') return true;
  return normalized === rq;
}

async function fetchSportsDbTeamBadge(
  apiKey: string,
  teamId: string | undefined,
  cache: Record<string, string | null>,
): Promise<string | null> {
  if (!teamId) return null;
  if (Object.prototype.hasOwnProperty.call(cache, teamId)) return cache[teamId];
  try {
    const res = await fetch(buildSportsDbUrl(apiKey, `lookupteam.php?id=${teamId}`));
    if (!res.ok) {
      cache[teamId] = null;
      return null;
    }
    const json = await res.json();
    const badge = json?.teams?.[0]?.strBadge ?? null;
    cache[teamId] = badge;
    return badge;
  } catch {
    cache[teamId] = null;
    return null;
  }
}

async function fetchMatchesFromSportsDb(
  competition: CompetitionCode,
  options?: {
    matchday?: number;
    status?: MatchStatus;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const leagueId = THESPORTSDB_LEAGUE_BY_COMP[competition];
  if (!leagueId) return [];

  const apiKey = process.env.EXPO_PUBLIC_THESPORTSDB_API_KEY || '3';
  const seasonRef = options?.dateFrom || options?.dateTo || new Date().toISOString();
  const futureRef = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
  const candidateSeasons = Array.from(new Set([
    inferSeason(seasonRef),
    inferSeason(new Date().toISOString()),
    inferSeason(futureRef),
  ]));

  const events: any[] = [];
  for (const season of candidateSeasons) {
    const res = await fetch(buildSportsDbUrl(apiKey, `eventsseason.php?id=${leagueId}&s=${season}`));
    if (!res.ok) continue;
    const json = await res.json();
    if (Array.isArray(json?.events) && json.events.length > 0) {
      events.push(...json.events);
    }
  }

  if (events.length === 0) return [];

  const badgeCache: Record<string, string | null> = {};
  const requestedStatus = options?.status ?? 'SCHEDULED';
  const hasDateRange = !!(options?.dateFrom || options?.dateTo);
  const fromTs = options?.dateFrom
    ? new Date(options.dateFrom).getTime()
    : (!hasDateRange && requestedStatus === 'SCHEDULED' ? Date.now() - 60 * 60 * 1000 : null);
  const toTs = options?.dateTo ? new Date(options.dateTo).getTime() : null;

  const mapped = await Promise.all(
    events.map(async (ev: any) => {
      const dt = ev?.strTimestamp || (ev?.dateEvent ? `${ev.dateEvent}T00:00:00Z` : null);
      if (!dt) return null;
      const when = new Date(dt).getTime();
      if (Number.isNaN(when)) return null;
      if (fromTs !== null && when < fromTs) return null;
      if (toTs !== null && when > toTs + 86_399_999) return null;

      const status = normalizeSportsDbStatus(ev);
      if (!shouldIncludeByStatus(status, options?.status)) return null;

      const homeBadge =
        ev?.strHomeTeamBadge ??
        await fetchSportsDbTeamBadge(apiKey, ev?.idHomeTeam, badgeCache);
      const awayBadge =
        ev?.strAwayTeamBadge ??
        await fetchSportsDbTeamBadge(apiKey, ev?.idAwayTeam, badgeCache);

      return {
        external_id:      String(ev?.idEvent ?? ''),
        equipo_local:     ev?.strHomeTeam ?? '?',
        equipo_visitante: ev?.strAwayTeam ?? '?',
        fecha_partido:    dt,
        status,
        marcador: {
          home: ev?.intHomeScore !== null && ev?.intHomeScore !== undefined ? Number(ev.intHomeScore) : null,
          away: ev?.intAwayScore !== null && ev?.intAwayScore !== undefined ? Number(ev.intAwayScore) : null,
        },
        logo_local: homeBadge,
        logo_visitante: awayBadge,
      };
    })
  );

  return dedupeMatches(mapped.filter(Boolean));
}

function getMatchesUrl(competition: string, params: URLSearchParams): string {
  const query = params.toString();
  if (typeof window !== 'undefined' && !__DEV__) {
    return `/api/matches?competition=${competition}${query ? '&' + query : ''}`;
  }
  return `${FOOTBALL_API_BASE}/competitions/${competition}/matches${query ? '?' + query : ''}`;
}

export class AdminService {

  static async isAdmin(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (error || !data) return false;
      return data.role === 'admin';
    } catch {
      return false;
    }
  }

  static async fetchMatches(
    competition: CompetitionCode,
    options?: {
      matchday?: number;
      status?: MatchStatus;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    const params = new URLSearchParams();

    const md = options?.matchday;
    if (md !== undefined && md !== null) {
      const mdInt = Math.floor(md);
      if (mdInt >= 1 && mdInt <= 46) params.set('matchday', String(mdInt));
    }

    const hasDateRange = !!(options?.dateFrom || options?.dateTo);
    if (hasDateRange) {
      if (options?.dateFrom) params.set('dateFrom', options.dateFrom);
      if (options?.dateTo)   params.set('dateTo',   options.dateTo);
    } else {
      const st = options?.status ?? 'SCHEDULED';
      if (st !== 'ALL') params.set('status', st);
    }

    const url = getMatchesUrl(competition, params);

    const headers: Record<string, string> = {};
    if (typeof window === 'undefined' || __DEV__) {
      const apiKey = process.env.EXPO_PUBLIC_FOOTBALL_API_KEY;
      if (!apiKey) throw new Error('EXPO_PUBLIC_FOOTBALL_API_KEY no configurada en .env');
      headers['X-Auth-Token'] = apiKey;
    }

    let primaryError = '';
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.message ?? await res.text();
        throw new Error(`Error de la API (${res.status}): ${msg}`);
      }

      const data = await res.json();
      const matches = dedupeMatches((data.matches ?? []).map((m: any) => ({
        external_id:      String(m.id),
        equipo_local:     m.homeTeam?.shortName ?? m.homeTeam?.name ?? '?',
        equipo_visitante: m.awayTeam?.shortName ?? m.awayTeam?.name ?? '?',
        fecha_partido:    m.utcDate,
        status:           m.status,
        marcador:         m.score?.fullTime ?? null,
        logo_local:       m.homeTeam?.crest ?? null,
        logo_visitante:   m.awayTeam?.crest ?? null,
      })));

      if (matches.length > 0) {
        return { matches, source: 'football-data' as const, fallbackUsed: false };
      }
    } catch (e: any) {
      primaryError = e?.message ?? 'Fallo en API primaria';
    }

    const fallbackMatches = await fetchMatchesFromSportsDb(competition, options);
    if (fallbackMatches.length > 0) {
      return {
        matches: fallbackMatches,
        source: 'thesportsdb' as const,
        fallbackUsed: true,
        fallbackReason: primaryError || 'Sin resultados en API primaria',
      };
    }

    if (primaryError) throw new Error(primaryError);
    return { matches: [], source: 'football-data' as const, fallbackUsed: false };
  }

  // ─── Crear quiniela con partidos ──────────────────────────────────────────────
  static async createQuinielaConPartidos(
    titulo: string,
    descripcion: string,
    liga: string,
    precioEntrada: number,
    fechaCierre: string,
    partidos: {
      external_id: string;
      equipo_local: string;
      equipo_visitante: string;
      fecha_partido: string;
      logo_local?: string | null;
      logo_visitante?: string | null;
    }[],
    jugadoresMinimos: number = 5,
    porcentajeAdmin: number = 10,
    cierreAutomatico: boolean = true,
    primerPartido: string | null = null,
  ) {
    const insertPayloadFull = {
      titulo,
      descripcion,
      liga,
      deporte:           'futbol',
      precio_entrada:     precioEntrada,
      premio_total:       0,
      estado:             'abierta',
      fecha_cierre:       fechaCierre,
      jugadores_minimos:  jugadoresMinimos,
      porcentaje_admin:   porcentajeAdmin,
      cierre_automatico:  cierreAutomatico,
      primer_partido:     primerPartido,
    };

    let quiniela: any;

    const { data: dataFull, error: errFull } = await supabase
      .from('quinielas')
      .insert(insertPayloadFull)
      .select('id')
      .single();

    if (errFull) {
      const msg = errFull.message ?? '';
      const missingCoreConfig = msg.includes('jugadores_minimos') ||
                                msg.includes('porcentaje_admin') ||
                                msg.includes('cierre_automatico') ||
                                msg.includes('primer_partido');
      if (missingCoreConfig) {
        throw new Error('Faltan columnas clave en la tabla quinielas (jugadores_minimos/porcentaje_admin/cierre_automatico/primer_partido). Ejecuta migraciones con supabase db push.');
      }

      const missingLigaOrDeporte = msg.includes('liga') || msg.includes('deporte');
      if (missingLigaOrDeporte) {
        const { data: dataPartial, error: errPartial } = await supabase
          .from('quinielas')
          .insert({
            titulo,
            descripcion,
            precio_entrada:    precioEntrada,
            premio_total:      0,
            estado:            'abierta',
            fecha_cierre:      fechaCierre,
            jugadores_minimos: jugadoresMinimos,
            porcentaje_admin:  porcentajeAdmin,
            cierre_automatico: cierreAutomatico,
            primer_partido:    primerPartido,
          })
          .select('id')
          .single();
        if (errPartial) throw errPartial;
        quiniela = dataPartial;
      } else {
        throw errFull;
      }
    } else {
      quiniela = dataFull;
    }

    const rowsFull = partidos.map((p, i) => ({
      quiniela_id:      quiniela.id,
      equipo_local:     p.equipo_local,
      equipo_visitante: p.equipo_visitante,
      fecha_partido:    p.fecha_partido,
      fixture_id:       parseInt(p.external_id) || null,
      logo_local:       p.logo_local ?? null,
      logo_visitante:   p.logo_visitante ?? null,
      orden:            i + 1,
    }));

    const { error: errPFull } = await supabase.from('partidos').insert(rowsFull);
    if (errPFull) {
      const missingLogoCols = errPFull.message?.includes('logo_local') || errPFull.message?.includes('logo_visitante');
      if (!missingLogoCols) throw errPFull;

      const rowsBasic = partidos.map((p, i) => ({
        quiniela_id:      quiniela.id,
        equipo_local:     p.equipo_local,
        equipo_visitante: p.equipo_visitante,
        fecha_partido:    p.fecha_partido,
        fixture_id:       parseInt(p.external_id) || null,
        orden:            i + 1,
      }));
      const { error: errPBasic } = await supabase.from('partidos').insert(rowsBasic);
      if (errPBasic) throw errPBasic;
    }
    return quiniela;
  }

  // ─── Obtener quinielas — incluye campo deporte ──────────────────────────────
  static async getQuinielas() {
    const { data, error } = await supabase
      .from('quinielas')
      .select('id, titulo, descripcion, liga, precio_entrada, premio_total, estado, deporte, auto_resultados, jugadores_minimos, porcentaje_admin, cierre_automatico, primer_partido, created_at, partidos(count)')
      .order('created_at', { ascending: false });

    if (!error) return data;

    // Fallback si alguna columna no existe (migración pendiente)
    const missingCol = error.message?.includes('cierre_automatico') ||
                       error.message?.includes('primer_partido') ||
                       error.message?.includes('jugadores_minimos') ||
                       error.message?.includes('porcentaje_admin') ||
                       error.message?.includes('deporte') ||
                       error.message?.includes('liga');

    if (!missingCol) throw error;

    const { data: dataBasic, error: errBasic } = await supabase
      .from('quinielas')
      .select('*, partidos(count)')
      .order('created_at', { ascending: false });

    if (errBasic) throw errBasic;

    return (dataBasic ?? []).map((q: any) => ({
      ...q,
      deporte:            q.deporte            ?? 'futbol',
      jugadores_minimos:  Number(q.jugadores_minimos ?? 0),
      porcentaje_admin:   Number(q.porcentaje_admin ?? 0),
      cierre_automatico:  q.cierre_automatico  ?? false,
      primer_partido:     q.primer_partido     ?? null,
    }));
  }

  // ─── Cerrar quiniela ───────────────────────────────────────────────────────────────
  static async cerrarQuiniela(quinielaId: string): Promise<{ valida: boolean; jugadoresPagados: number }> {
    const { data: q, error: errQ } = await supabase
      .from('quinielas')
      .select('id, jugadores_minimos, precio_entrada, titulo')
      .eq('id', quinielaId)
      .single();
    if (errQ || !q) throw errQ ?? new Error('Quiniela no encontrada');

    const { count } = await supabase
      .from('participaciones')
      .select('*', { count: 'exact', head: true })
      .eq('quiniela_id', quinielaId)
      .in('estado', ['pagado', 'ganador', 'perdedor']);

    const jugadoresPagados = count ?? 0;
    const valida = jugadoresPagados >= (q.jugadores_minimos ?? 2);

    if (valida) {
      const { error } = await supabase
        .from('quinielas')
        .update({ estado: 'cerrada' })
        .eq('id', quinielaId);
      if (error) throw error;
    } else {
      const { error: errAnul } = await supabase
        .from('quinielas')
        .update({ estado: 'anulada' })
        .eq('id', quinielaId);
      if (errAnul) throw errAnul;

      const { data: participantes, error: errP } = await supabase
        .from('participaciones')
        .select('id, user_id, monto_pagado')
        .eq('quiniela_id', quinielaId)
        .in('estado', ['pagado']);
      if (errP) throw errP;

      for (const p of (participantes ?? [])) {
        const monto = p.monto_pagado ?? q.precio_entrada;

        await supabase.rpc('incrementar_wallet', {
          p_user_id: p.user_id,
          p_monto:   monto,
        });

        const { data: txExiste } = await supabase
          .from('wallet_transactions')
          .select('id')
          .in('tipo', ['reembolso', 'ajuste_admin'])
          .eq('referencia_id', p.id)
          .maybeSingle();

        if (!txExiste) {
          await supabase.from('wallet_transactions').insert({
            user_id:       p.user_id,
            tipo:          'ajuste_admin',
            monto:         monto,
            descripcion:   `Reembolso: quiniela "${q.titulo}" anulada por no alcanzar el mínimo de jugadores`,
            referencia_id: p.id,
          });
        }

        await supabase
          .from('participaciones')
          .update({ estado: 'reembolsado' })
          .eq('id', p.id);

        const { data: notifExiste } = await supabase
          .from('notificaciones')
          .select('id')
          .eq('user_id', p.user_id)
          .eq('tipo', 'reembolso')
          .eq('referencia_id', p.id)
          .eq('referencia_tipo', 'participacion_reembolso')
          .maybeSingle();

        if (!notifExiste) {
          await supabase.from('notificaciones').insert({
            user_id: p.user_id,
            tipo: 'reembolso',
            titulo: '💸 Reembolso acreditado',
            mensaje: `La quiniela "${q.titulo}" fue anulada por no alcanzar el mínimo de jugadores. Se te reembolsaron $${monto} MXN a tu wallet.`,
            leida: false,
            referencia_id: p.id,
            referencia_tipo: 'participacion_reembolso',
          });
        }
      }
    }

    return { valida, jugadoresPagados };
  }

  static async updateEstado(quinielaId: string, estado: string) {
    const { error } = await supabase
      .from('quinielas')
      .update({ estado })
      .eq('id', quinielaId);
    if (error) throw error;
  }

  static async getPartidos(quinielaId: string) {
    const { data, error } = await supabase
      .from('partidos')
      .select('*')
      .eq('quiniela_id', quinielaId)
      .order('orden', { ascending: true });
    if (error) throw error;
    return data;
  }

  static async setResultadoPartido(partidoId: string, resultado: 'local' | 'empate' | 'visitante') {
    const { error } = await supabase
      .from('partidos')
      .update({ resultado })
      .eq('id', partidoId);
    if (error) throw error;
  }

  static async recalcularAciertos(quinielaId: string) {
    const { error } = await supabase.rpc('recalcular_aciertos', { p_quiniela_id: quinielaId });
    if (error) throw error;
  }

  static async getParticipantes(quinielaId: string) {
    const { data, error } = await supabase
      .from('participaciones')
      .select('id, estado, monto_pagado, aciertos, created_at, profiles(username)')
      .eq('quiniela_id', quinielaId)
      .order('aciertos', { ascending: false });
    if (error) throw error;
    return data;
  }

  static async getJugadoresPagados(quinielaId: string): Promise<number> {
    const { count } = await supabase
      .from('participaciones')
      .select('*', { count: 'exact', head: true })
      .eq('quiniela_id', quinielaId)
      .in('estado', ['pagado', 'ganador', 'perdedor']);
    return count ?? 0;
  }
}
