import { supabase } from '../config/supabase';

export const QuinielasService = {

  async getQuinielasAbiertas() {
    const { data, error } = await supabase
      .from('quinielas')
      .select('*, partidos(count)')
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getFinalizadas() {
    // Trae las últimas 5 quinielas finalizadas con conteo de jugadores y ganador
    const { data, error } = await supabase
      .from('quinielas')
      .select(`
        id, titulo, precio_entrada, premio_total, created_at,
        participaciones(count)
      `)
      .eq('estado', 'finalizada')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;

    // Para cada quiniela buscar el ganador (estado = ganador)
    const resultado = await Promise.all((data || []).map(async (q: any) => {
      const { data: ganadores } = await supabase
        .from('participaciones')
        .select('user_id, aciertos')
        .eq('quiniela_id', q.id)
        .eq('estado', 'ganador')
        .order('aciertos', { ascending: false })
        .limit(1);

      let ganador_username: string | null = null;
      if (ganadores && ganadores.length > 0) {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', ganadores[0].user_id)
          .single();
        ganador_username = perfil?.username ?? null;
      }

      return {
        ...q,
        total_jugadores: q.participaciones?.[0]?.count ?? 0,
        ganador_username,
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

  async guardarSelecciones(
    quinielaId: string,
    selecciones: Record<string, 'local' | 'empate' | 'visitante'>
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: participacion, error: partError } = await supabase
      .from('participaciones')
      .insert({
        user_id: user.id,
        quiniela_id: quinielaId,
        monto_pagado: 0,
        estado: 'pendiente',
      })
      .select()
      .single();
    if (partError) throw partError;

    const seleccionesArray = Object.entries(selecciones).map(([partido_id, prediccion]) => ({
      participacion_id: participacion.id,
      partido_id,
      prediccion,
    }));
    const { error: selError } = await supabase.from('selecciones').insert(seleccionesArray);
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
