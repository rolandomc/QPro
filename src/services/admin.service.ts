import { supabase } from '../config/supabase';

export type CompetitionCode = 'PD' | 'PL' | 'MX1' | 'CL' | 'WC' | 'BL1' | 'SA' | 'FL1' | 'BSA' | 'MLS';
export type MatchStatus = 'SCHEDULED' | 'FINISHED' | 'LIVE' | 'ALL';

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';

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

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.message ?? await res.text();
      throw new Error(`Error de la API (${res.status}): ${msg}`);
    }

    const data = await res.json();
    const matches = (data.matches ?? []).map((m: any) => ({
      external_id:      String(m.id),
      equipo_local:     m.homeTeam?.shortName ?? m.homeTeam?.name ?? '?',
      equipo_visitante: m.awayTeam?.shortName ?? m.awayTeam?.name ?? '?',
      fecha_partido:    m.utcDate,
      status:           m.status,
      marcador:         m.score?.fullTime ?? null,
    }));
    return { matches };
  }

  // ─── Crear quiniela con partidos ──────────────────────────────────────────
  static async createQuinielaConPartidos(
    titulo: string,
    descripcion: string,
    precioEntrada: number,
    fechaCierre: string,
    partidos: Array<{
      external_id: string;
      equipo_local: string;
      equipo_visitante: string;
      fecha_partido: string;
    }>,
    jugadoresMinimos: number = 5,
    porcentajeAdmin: number = 10,
    cierreAutomatico: boolean = true,
    primerPartido: string | null = null,
  ) {
    // Intentamos insertar con las columnas nuevas; si fallan (migración pendiente),
    // reintentamos sin ellas para no bloquear al admin.
    const insertPayloadFull = {
      titulo,
      descripcion,
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
      // Si el error es por columna inexistente, reintentamos sin las columnas nuevas
      const missingCol = errFull.message?.includes('cierre_automatico') ||
                         errFull.message?.includes('primer_partido') ||
                         errFull.message?.includes('jugadores_minimos') ||
                         errFull.message?.includes('porcentaje_admin');
      if (!missingCol) throw errFull;

      // Fallback: insertar solo con columnas base
      const { data: dataBasic, error: errBasic } = await supabase
        .from('quinielas')
        .insert({
          titulo,
          descripcion,
          precio_entrada: precioEntrada,
          premio_total:   0,
          estado:         'abierta',
          fecha_cierre:   fechaCierre,
        })
        .select('id')
        .single();
      if (errBasic) throw errBasic;
      quiniela = dataBasic;
    } else {
      quiniela = dataFull;
    }

    const rows = partidos.map((p, i) => ({
      quiniela_id:      quiniela.id,
      equipo_local:     p.equipo_local,
      equipo_visitante: p.equipo_visitante,
      fecha_partido:    p.fecha_partido,
      fixture_id:       parseInt(p.external_id) || null,
      orden:            i + 1,
    }));

    const { error: errP } = await supabase.from('partidos').insert(rows);
    if (errP) throw errP;
    return quiniela;
  }

  // ─── Obtener quinielas — tolerante a columnas faltantes ──────────────────
  static async getQuinielas() {
    // Intento 1: select completo con columnas nuevas
    const { data, error } = await supabase
      .from('quinielas')
      .select('id, titulo, descripcion, precio_entrada, premio_total, estado, auto_resultados, jugadores_minimos, porcentaje_admin, cierre_automatico, primer_partido, created_at, partidos(count)')
      .order('created_at', { ascending: false });

    if (!error) return data;

    // Si el error es por columnas inexistentes (migración pendiente), select reducido
    const missingCol = error.message?.includes('cierre_automatico') ||
                       error.message?.includes('primer_partido') ||
                       error.message?.includes('jugadores_minimos') ||
                       error.message?.includes('porcentaje_admin');

    if (!missingCol) throw error;

    // Intento 2: columnas base únicamente
    const { data: dataBasic, error: errBasic } = await supabase
      .from('quinielas')
      .select('id, titulo, descripcion, precio_entrada, premio_total, estado, created_at, partidos(count)')
      .order('created_at', { ascending: false });

    if (errBasic) throw errBasic;

    // Rellenar con defaults para que la UI no explote
    return (dataBasic ?? []).map((q: any) => ({
      ...q,
      jugadores_minimos:  q.jugadores_minimos  ?? 5,
      porcentaje_admin:   q.porcentaje_admin   ?? 10,
      cierre_automatico:  q.cierre_automatico  ?? false,
      primer_partido:     q.primer_partido     ?? null,
    }));
  }

  // ─── Cerrar quiniela (verifica minimo y anula si no cumple) ───────────────
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

        await supabase.from('wallet_movimientos').insert({
          user_id:     p.user_id,
          tipo:        'reembolso',
          monto:       monto,
          descripcion: `Reembolso: quiniela "${q.titulo}" anulada por no alcanzar el mínimo de jugadores`,
          quiniela_id: quinielaId,
        });

        await supabase
          .from('participaciones')
          .update({ estado: 'reembolsado' })
          .eq('id', p.id);
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
