import { supabase } from '../config/supabase';

export type CompetitionCode = 'PD' | 'PL' | 'MX1' | 'CL' | 'WC' | 'BL1' | 'SA' | 'FL1';

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';

export class AdminService {

  /** Verifica si el usuario autenticado tiene rol de admin */
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

  /** Trae partidos de football-data.org sin guardar nada en Supabase */
  static async fetchMatches(competition: CompetitionCode, matchday?: number) {
    const apiKey = process.env.EXPO_PUBLIC_FOOTBALL_API_KEY;
    if (!apiKey) throw new Error('EXPO_PUBLIC_FOOTBALL_API_KEY no configurada en .env');

    const url = matchday
      ? `${FOOTBALL_API_BASE}/competitions/${competition}/matches?matchday=${matchday}`
      : `${FOOTBALL_API_BASE}/competitions/${competition}/matches?status=SCHEDULED`;

    const res = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error de la API (${res.status}): ${text}`);
    }

    const data = await res.json();
    // Normalizar respuesta para que create.tsx la consuma igual
    const matches = (data.matches ?? []).map((m: any) => ({
      external_id: String(m.id),
      equipo_local: m.homeTeam?.shortName ?? m.homeTeam?.name ?? '?',
      equipo_visitante: m.awayTeam?.shortName ?? m.awayTeam?.name ?? '?',
      fecha_partido: m.utcDate,
    }));
    return { matches };
  }

  /** Crea la quiniela + inserta los partidos seleccionados en una sola operación */
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
    }>
  ) {
    // 1. Crear quiniela
    const { data: quiniela, error: errQ } = await supabase
      .from('quinielas')
      .insert({
        titulo,
        descripcion,
        precio_entrada: precioEntrada,
        premio_total: 0,
        estado: 'abierta',
        fecha_cierre: fechaCierre,
      })
      .select('id')
      .single();
    if (errQ) throw errQ;

    // 2. Insertar partidos vinculados
    const rows = partidos.map((p, i) => ({
      quiniela_id: quiniela.id,
      equipo_local: p.equipo_local,
      equipo_visitante: p.equipo_visitante,
      fecha_partido: p.fecha_partido,
      fixture_id: parseInt(p.external_id) || null,
      orden: i + 1,
    }));

    const { error: errP } = await supabase.from('partidos').insert(rows);
    if (errP) throw errP;

    return quiniela;
  }

  static async getQuinielas() {
    const { data, error } = await supabase
      .from('quinielas')
      .select('id, titulo, descripcion, precio_entrada, premio_total, estado, auto_resultados, created_at, partidos(count)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
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

  static async updateEstado(quinielaId: string, estado: string) {
    const { error } = await supabase
      .from('quinielas')
      .update({ estado })
      .eq('id', quinielaId);
    if (error) throw error;
  }

  static async setResultadoPartido(partidoId: string, resultado: 'local' | 'empate' | 'visitante') {
    const { error } = await supabase
      .from('partidos')
      .update({ resultado })
      .eq('id', partidoId);
    if (error) throw error;
  }

  static async recalcularAciertos(quinielaId: string) {
    const { data: participaciones, error: errPart } = await supabase
      .from('participaciones')
      .select('id')
      .eq('quiniela_id', quinielaId);
    if (errPart) throw errPart;
    if (!participaciones || participaciones.length === 0) return;

    const { data: partidos, error: errPart2 } = await supabase
      .from('partidos')
      .select('id, resultado')
      .eq('quiniela_id', quinielaId)
      .not('resultado', 'is', null);
    if (errPart2) throw errPart2;

    const resultadoMap = Object.fromEntries(
      (partidos ?? []).map(p => [p.id, p.resultado])
    );

    for (const part of participaciones) {
      const { data: sels } = await supabase
        .from('selecciones')
        .select('partido_id, prediccion')
        .eq('participacion_id', part.id);

      const aciertos = (sels ?? []).filter(
        s => resultadoMap[s.partido_id] && resultadoMap[s.partido_id] === s.prediccion
      ).length;

      await supabase
        .from('participaciones')
        .update({ aciertos })
        .eq('id', part.id);
    }
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
}
