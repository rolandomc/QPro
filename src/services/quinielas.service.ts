import { supabase } from '../config/supabase';

export const QuinielasService = {
  /**
   * Obtener quinielas abiertas para los usuarios
   */
  async getQuinielasAbiertas() {
    const { data, error } = await supabase
      .from('quinielas')
      .select(`
        *,
        partidos(count)
      `)
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Obtener partidos de una quiniela
   */
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
   * Guardar selecciones del usuario + crear participacion
   */
  async guardarSelecciones(
    quinielaId: string,
    selecciones: Record<string, 'local' | 'empate' | 'visitante'>
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    // 1. Crear participacion
    const { data: participacion, error: partError } = await supabase
      .from('participaciones')
      .insert({
        user_id: user.id,
        quiniela_id: quinielaId,
        monto_pagado: 0, // se actualiza al confirmar pago
        estado: 'pendiente',
      })
      .select()
      .single();

    if (partError) throw partError;

    // 2. Guardar cada seleccion
    const seleccionesArray = Object.entries(selecciones).map(([partido_id, prediccion]) => ({
      participacion_id: participacion.id,
      partido_id,
      prediccion,
    }));

    const { error: selError } = await supabase
      .from('selecciones')
      .insert(seleccionesArray);

    if (selError) throw selError;

    return participacion;
  },

  /**
   * Verificar si el usuario ya participó en una quiniela
   */
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
