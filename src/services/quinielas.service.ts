import { supabase } from '../config/supabase';

export const QuinielasService = {

  async getQuinielasAbiertas() {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('quinielas')
      .select('*, partidos(count), participaciones(count)')
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (!data) return data;

    const ids = data.map((q: any) => q.id);

    const [misParticipacionesRes, primerPartidoRes] = await Promise.all([
      user
        ? supabase
            .from('participaciones')
            .select('quiniela_id')
            .eq('user_id', user.id)
            .in('quiniela_id', ids)
        : Promise.resolve({ data: [] }),
      supabase
        .from('partidos')
        .select('quiniela_id, fecha_partido')
        .in('quiniela_id', ids)
        .order('orden', { ascending: true }),
    ]);

    const primerPartidoMap: Record<string, string> = {};
    for (const p of (primerPartidoRes.data || [])) {
      if (!primerPartidoMap[p.quiniela_id] && p.fecha_partido) {
        primerPartidoMap[p.quiniela_id] = p.fecha_partido;
      }
    }

    const yaParticipo = new Set(
      ((misParticipacionesRes as any).data || []).map((p: any) => p.quiniela_id)
    );

    return data.map((q: any) => ({
      ...q,
      jugadores_count:      q.participaciones?.[0]?.count ?? 0,
      ya_participo:         yaParticipo.has(q.id),
      fecha_primer_partido: primerPartidoMap[q.id] ?? q.fecha_cierre ?? null,
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
   * LÓGICA ANTI-DUPLICADOS:
   * - Si ya existe una participación con estado 'pendiente' → la reutiliza (mismo UUID).
   *   Esto cubre el caso de reintentar pago: mismo participacionId → mismo external_reference
   *   en MP → el webhook siempre actualiza la misma fila.
   * - Si no existe → la crea (primer acceso).
   * - Si existe con estado 'pagado', 'ganador' o 'perdedor' → lanza error para
   *   que details.tsx no permita volver a participar.
   *
   * Las selecciones se upsertean (onConflict participacion_id + partido_id) por si
   * el usuario cambió algún pick antes de reintentar el pago.
   */
  async guardarSelecciones(
    quinielaId: string,
    selecciones: Record<string, 'local' | 'empate' | 'visitante'>
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    // 1️⃣ Buscar participación existente para este usuario + quiniela
    const { data: existente } = await supabase
      .from('participaciones')
      .select('id, estado')
      .eq('user_id', user.id)
      .eq('quiniela_id', quinielaId)
      .maybeSingle();

    // 2️⃣ Si ya pagó, no permitir otra participación
    if (existente && ['pagado', 'ganador', 'perdedor'].includes(existente.estado)) {
      throw new Error('Ya tienes una participación pagada en esta quiniela.');
    }

    let participacion: any;

    if (existente) {
      // 3a️⃣ Reutilizar la participación pendiente existente → mismo UUID, mismo external_reference
      participacion = existente;
    } else {
      // 3b️⃣ Primera vez → crear participación nueva
      const { data: nueva, error: partError } = await supabase
        .from('participaciones')
        .insert({
          user_id:      user.id,
          quiniela_id:  quinielaId,
          monto_pagado: 0,
          estado:       'pendiente',
        })
        .select()
        .single();
      if (partError) throw partError;
      participacion = nueva;
    }

    // 4️⃣ Upsert de selecciones para que los picks siempre queden actualizados
    //    aunque el usuario haya cambiado alguno antes de reintentar el pago
    const seleccionesArray = Object.entries(selecciones).map(([partido_id, prediccion]) => ({
      participacion_id: participacion.id,
      partido_id,
      prediccion,
    }));

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
