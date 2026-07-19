// ============================================================
// MLB Admin Service
// Crea y gestiona quinielas de béisbol usando la MLB Stats API
// Sigue el mismo patrón que admin.service.ts
// ============================================================
import { supabase } from '../config/supabase';
import { MLBService } from './mlb.service';

export interface MLBPartidoInput {
  gamePk:           number;
  equipo_local:     string;
  equipo_visitante: string;
  fecha_partido:    string;   // ISO UTC
  estado_juego?:    string;
}

// ============================================================
export class MLBAdminService {

  // ─── Traer juegos disponibles de un rango de fechas ─────────────────
  // Úsalo en el formulario del admin para mostrar los juegos disponibles
  static async fetchGames(
    dateFrom: string,
    dateTo:   string,
  ): Promise<MLBPartidoInput[]> {
    const games = await MLBService.getGamesByRange(dateFrom, dateTo);
    // Solo juegos programados o en vivo (no cancelados/postponed)
    return games
      .filter(g => !['Cancelled', 'Postponed'].includes(g.estado_juego))
      .map((g): MLBPartidoInput => ({
        gamePk:           g.gamePk,
        equipo_local:     g.equipo_local,
        equipo_visitante: g.equipo_visitante,
        fecha_partido:    g.fecha_partido,
        estado_juego:     g.estado_juego,
      }));
  }

  // ─── Crear quiniela de béisbol con juegos MLB ───────────────────────
  static async createQuinielaMLB(
    titulo:           string,
    descripcion:      string,
    precioEntrada:    number,
    fechaCierre:      string,
    partidos:         MLBPartidoInput[],
    jugadoresMinimos: number  = 5,
    porcentajeAdmin:  number  = 10,
    cierreAutomatico: boolean = true,
    numGanadores:     1 | 3   = 3,
    porcentajesPremios: number[] = [60, 25, 15],
  ): Promise<{ id: string }> {
    if (partidos.length === 0) throw new Error('Debes seleccionar al menos 1 juego');

    const numGanadoresSafe: 1 | 3 = Number(numGanadores) === 1 ? 1 : 3;
    const porcentajesSafe = numGanadoresSafe === 1
      ? [100]
      : [
          Number(porcentajesPremios?.[0] ?? 60) || 60,
          Number(porcentajesPremios?.[1] ?? 25) || 25,
          Number(porcentajesPremios?.[2] ?? 15) || 15,
        ];

    // Primer juego (fecha más temprana) como referencia de cierre
    const primerPartido = partidos
      .map(p => p.fecha_partido)
      .sort()[0] ?? null;

    // ─ Insertar quiniela ────────────────────────────────────────────────
    const { data: quiniela, error: errQ } = await supabase
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
        deporte:           'beisbol',       // ← distingue de fútbol
        num_ganadores:     numGanadoresSafe,
        porcentajes_premios: porcentajesSafe,
      })
      .select('id')
      .single();

    if (errQ) throw errQ;

    const { error: cfgErr } = await supabase
      .from('quinielas')
      .update({
        num_ganadores: numGanadoresSafe,
        porcentajes_premios: porcentajesSafe,
      })
      .eq('id', quiniela.id);
    if (cfgErr) {
      throw new Error(`No se pudo guardar la configuración de ganadores (Top ${numGanadoresSafe}). ${cfgErr.message}`);
    }

    // ─ Insertar partidos (juegos MLB) ────────────────────────────────
    const rows = partidos.map((p, i) => ({
      quiniela_id:      quiniela.id,
      equipo_local:     p.equipo_local,
      equipo_visitante: p.equipo_visitante,
      fecha_partido:    p.fecha_partido,
      mlb_game_pk:      p.gamePk,          // ← ID de la MLB Stats API
      estado_juego:     p.estado_juego ?? 'Preview',
      deporte:          'beisbol',
      orden:            i + 1,
    }));

    const { error: errP } = await supabase.from('partidos').insert(rows);
    if (errP) throw errP;

    return quiniela;
  }

  // ─── Sincronizar resultados de todos los partidos MLB pendientes ─────────
  // Llama este método manualmente desde el admin o con un cron job
  // Retorna cuántos partidos fueron actualizados
  static async sincronizarResultados(): Promise<number> {
    // Buscar partidos MLB sin resultado y cuya fecha ya pasó
    const { data: pendientes, error } = await supabase
      .from('partidos')
      .select('id, mlb_game_pk, quiniela_id')
      .eq('deporte', 'beisbol')
      .is('resultado', null)
      .not('mlb_game_pk', 'is', null)
      .lte('fecha_partido', new Date().toISOString());

    if (error) throw error;
    if (!pendientes || pendientes.length === 0) return 0;

    let actualizados = 0;

    for (const partido of pendientes) {
      try {
        const resultado = await MLBService.getResultado(partido.mlb_game_pk);
        if (!resultado) continue; // juego aún no finalizado

        // Obtener marcador para guardar también
        const game = await MLBService.getGameDetail(partido.mlb_game_pk);

        const { error: errU } = await supabase
          .from('partidos')
          .update({
            resultado,
            estado_juego:       'Final',
            marcador_local:     game?.marcador_local     ?? null,
            marcador_visitante: game?.marcador_visitante ?? null,
          })
          .eq('id', partido.id);

        if (!errU) actualizados++;
      } catch (e) {
        // No detener el loop si falla un juego
        console.warn(`Error sincronizando gamePk ${partido.mlb_game_pk}:`, e);
      }
    }

    return actualizados;
  }

  // ─── Sincronizar y recalcular aciertos de quinielas MLB activas ────────
  // Sincroniza resultados + dispara recalcular_aciertos por quiniela
  static async sincronizarYRecalcular(): Promise<{ actualizados: number; quinielas: number }> {
    const actualizados = await MLBAdminService.sincronizarResultados();
    if (actualizados === 0) return { actualizados: 0, quinielas: 0 };

    // Obtener quinielas MLB cerradas (con todos los partidos ya con resultado)
    const { data: quinielasCerradas } = await supabase
      .from('quinielas')
      .select('id')
      .eq('deporte', 'beisbol')
      .in('estado', ['cerrada']);

    let quinielasRecalculadas = 0;
    for (const q of (quinielasCerradas ?? [])) {
      // Verificar si todos los partidos tienen resultado
      const { count: sinResultado } = await supabase
        .from('partidos')
        .select('*', { count: 'exact', head: true })
        .eq('quiniela_id', q.id)
        .is('resultado', null);

      if ((sinResultado ?? 1) === 0) {
        const { error } = await supabase.rpc('recalcular_aciertos', { p_quiniela_id: q.id });
        if (!error) quinielasRecalculadas++;
      }
    }

    return { actualizados, quinielas: quinielasRecalculadas };
  }

  // ─── Obtener quinielas MLB (para el panel admin) ──────────────────────
  static async getQuinielasMLB() {
    const { data, error } = await supabase
      .from('quinielas')
      .select('id, titulo, descripcion, precio_entrada, premio_total, estado, jugadores_minimos, porcentaje_admin, cierre_automatico, primer_partido, created_at, partidos(count)')
      .eq('deporte', 'beisbol')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  // ─── Obtener partidos MLB de una quiniela con marcadores ──────────────
  static async getPartidosMLB(quinielaId: string) {
    const { data, error } = await supabase
      .from('partidos')
      .select('id, equipo_local, equipo_visitante, fecha_partido, mlb_game_pk, resultado, estado_juego, marcador_local, marcador_visitante, orden')
      .eq('quiniela_id', quinielaId)
      .eq('deporte', 'beisbol')
      .order('orden', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
}
