import { supabase } from '../config/supabase';

export class AdminService {

  /**
   * Verifica si el usuario autenticado tiene rol de admin
   * en la tabla profiles.
   */
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

  static async getQuinielas() {
    const { data, error } = await supabase
      .from('quinielas')
      .select(`
        id, titulo, descripcion, precio_entrada, premio_total, estado, auto_resultados, created_at,
        partidos(count)
      `)
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
