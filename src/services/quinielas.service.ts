import type { SeleccionConGoles } from '../components/MatchSelectionCard';
import { supabase } from '../config/supabase';

export const QuinielasService = {

  async getQuinielasStatsPublic(quinielaIds: string[]) {
    if (!quinielaIds.length) return [];
    const { data, error } = await supabase.rpc('get_quinielas_stats_public', {
      p_quiniela_ids: quinielaIds,
    });
    if (error) throw error;
    return data ?? [];
  },

  async getQuinielaRankingPublic(quinielaId: string, limit = 5000) {
    const { data, error } = await supabase.rpc('get_quiniela_ranking_public', {
      p_quiniela_id: quinielaId,
      p_limit: limit,
    });
    if (error) throw error;
    return data ?? [];
  },

  async getQuinielasAbiertas() {
    const rpc = await supabase.rpc('get_quinielas_abiertas_public');
    if (!rpc.error) {
      return (rpc.data ?? []).map((q: any) => ({
        ...q,
        partidos: [{ count: Number(q.total_partidos ?? 0) }],
        jugadores_count: Number(q.jugadores_count ?? 0),
        ya_participo: !!q.ya_participo,
        fecha_primer_partido: q.fecha_primer_partido ?? q.fecha_cierre ?? null,
      }));
    }

    // Fallback de resiliencia para entornos con migraciones parciales.
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('quinielas')
      .select('id, titulo, descripcion, precio_entrada, premio_total, estado, fecha_cierre, created_at, partidos(count)')
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const ids = (data ?? []).map((q: any) => q.id);
    let statsMap = new Map<string, any>();
    if (ids.length > 0) {
      try {
        const stats = await this.getQuinielasStatsPublic(ids);
        statsMap = new Map((stats ?? []).map((s: any) => [s.id, s]));
      } catch {
        statsMap = new Map();
      }
    }

    const [misParticipacionesRes] = await Promise.all([
      user && ids.length > 0
        ? supabase
            .from('participaciones')
            .select('quiniela_id')
            .eq('user_id', user.id)
            .in('quiniela_id', ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const yaParticipo = new Set(((misParticipacionesRes as any).data || []).map((p: any) => p.quiniela_id));

    return (data ?? []).map((q: any) => ({
      ...q,
      ...(statsMap.get(q.id) ?? {}),
      liga: statsMap.get(q.id)?.liga ?? null,
      deporte: statsMap.get(q.id)?.deporte ?? 'futbol',
      jugadores_minimos: Number(statsMap.get(q.id)?.jugadores_minimos ?? 0),
      porcentaje_admin: Number(statsMap.get(q.id)?.porcentaje_admin ?? 0),
      cierre_automatico: !!statsMap.get(q.id)?.cierre_automatico,
      primer_partido: statsMap.get(q.id)?.primer_partido ?? null,
      jugadores_count: Number(statsMap.get(q.id)?.jugadores_count ?? 0),
      ya_participo: yaParticipo.has(q.id),
      fecha_primer_partido: statsMap.get(q.id)?.fecha_primer_partido ?? q.fecha_cierre ?? null,
    }));
  },

  async getFinalizadas() {
    const { data, error } = await supabase
      .from('quinielas')
      .select(`id, titulo, precio_entrada, premio_total, created_at, participaciones(count)`)
      .eq('estado', 'finalizada')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;

    const resultado = await Promise.all((data || []).map(async (q: any) => {
      const { data: tops } = await supabase
        .from('participaciones')
        .select('user_id, aciertos, estado, monto_pagado, premio_ganado')
        .eq('quiniela_id', q.id)
        .order('aciertos', { ascending: false })
        .limit(3);

      const top3 = await Promise.all((tops || []).map(async (p: any) => {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', p.user_id)
          .single();
        return {
          username:      perfil?.username ?? 'Usuario',
          aciertos:      p.aciertos ?? 0,
          estado:        p.estado,
          monto_pagado:  p.monto_pagado ?? 0,
          premio_ganado: p.premio_ganado ?? 0,
        };
      }));

      const totalJugadores = q.participaciones?.[0]?.count ?? 0;
      const premioReal = q.premio_total > q.precio_entrada
        ? q.premio_total
        : totalJugadores * q.precio_entrada;

      return {
        ...q,
        total_jugadores: totalJugadores,
        premio_total: premioReal,
        top3,
      };
    }));

    return resultado;
  },

  async getProximaFecha(): Promise<string | null> {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'proxima_quiniela_fecha')
      .single();
    return data?.value ?? null;
  },

  async setProximaFecha(fecha: string | null) {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'proxima_quiniela_fecha', value: fecha });
    if (error) throw error;
  },

  async guardarPushToken(token: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    const { error } = await supabase
      .from('push_tokens')
      .upsert({ user_id: user.id, token }, { onConflict: 'user_id,token' });
    if (error) throw error;
  },

  async getPartidos(quinielaId: string) {
    const { data, error } = await supabase
      .from('partidos')
      .select('*')
      .eq('quiniela_id', quinielaId)
      .order('orden', { ascending: true });
    if (error) throw error;
    return data;
  },

  /**
   * Crea o reutiliza la participación pendiente del usuario para esta quiniela.
   *
   * AHORA incluye goles predichos por partido + suma total para desempate.
   *
   * LÓGICA ANTI-DUPLICADOS:
   * - Si ya existe una participación con estado 'pendiente' → la reutiliza (mismo UUID).
   * - Si no existe → la crea (primer acceso).
   * - Si existe con estado 'pagado', 'ganador' o 'perdedor' → lanza error.
   */
  async guardarSelecciones(
    quinielaId: string,
    selecciones: Record<string, SeleccionConGoles>
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    // 1. Buscar participación existente para este usuario + quiniela
    const { data: existente } = await supabase
      .from('participaciones')
      .select('id, estado')
      .eq('user_id', user.id)
      .eq('quiniela_id', quinielaId)
      .maybeSingle();

    // 2. Si ya pagó, no permitir otra participación
    if (existente && ['pagado', 'ganador', 'perdedor'].includes(existente.estado)) {
      throw new Error('Ya tienes una participación pagada en esta quiniela.');
    }

    // 3. Calcular total de goles predichos (para desempate)
    const totalGolesPredichos = Object.values(selecciones).reduce(
      (acc, s) => acc + (s.golesLocal ?? 0) + (s.golesVisitante ?? 0),
      0
    );

    let participacion: any;

    if (existente) {
      // 4a. Reutilizar participación pendiente → actualizar total_goles_predichos
      const { error: updErr } = await supabase
        .from('participaciones')
        .update({ total_goles_predichos: totalGolesPredichos })
        .eq('id', existente.id);
      if (updErr) throw updErr;
      participacion = existente;
    } else {
      // 4b. Primera vez → crear participación con total_goles_predichos
      const { data: nueva, error: partError } = await supabase
        .from('participaciones')
        .insert({
          user_id:               user.id,
          quiniela_id:           quinielaId,
          monto_pagado:          0,
          estado:                'pendiente',
          total_goles_predichos: totalGolesPredichos,
        })
        .select()
        .single();
      if (partError) throw partError;
      participacion = nueva;
    }

    // 5. Upsert de selecciones con goles incluidos
    const seleccionesArray = Object.entries(selecciones).map(
      ([partido_id, sel]) => ({
        participacion_id:           participacion.id,
        partido_id,
        prediccion:                 sel.prediccion,
        goles_local_predichos:      sel.golesLocal,
        goles_visitante_predichos:  sel.golesVisitante,
      })
    );

    const { error: selError } = await supabase
      .from('selecciones')
      .upsert(seleccionesArray, { onConflict: 'participacion_id,partido_id' });
    if (selError) throw selError;

    return participacion;
  },

  async yaParticipo(quinielaId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from('participaciones')
      .select('id')
      .eq('user_id', user.id)
      .eq('quiniela_id', quinielaId)
      .single();
    return !!data;
  },
};
