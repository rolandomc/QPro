import { supabase } from '../config/supabase';

export type CompetitionCode = 'WC' | 'PL' | 'PD' | 'BL1' | 'SA' | 'FL1' | 'CL' | 'MX1';

export const COMPETITIONS: Record<CompetitionCode, string> = {
  WC: '🌍 Mundial FIFA',
  PL: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  PD: '🇪🇸 La Liga',
  BL1: '🇩🇪 Bundesliga',
  SA: '🇮🇹 Serie A',
  FL1: '🇫🇷 Ligue 1',
  CL: '⭐ Champions League',
  MX1: '🇲🇽 Liga MX',
};

export const AdminService = {

  /**
   * PASO 1: Solo CONSULTA partidos desde la Edge Function.
   * NO los guarda en DB todavía — los regresa para que el admin elija.
   */
  async fetchMatches(competitionCode: CompetitionCode, matchday?: number) {
    const { data, error } = await supabase.functions.invoke('sync-matches', {
      body: {
        competition_code: competitionCode,
        matchday: matchday ?? undefined,
        preview_only: true, // <-- flag para que la EF no inserte nada
      },
    });
    if (error) throw error;
    return data as { success: boolean; competition: string; matches: any[] };
  },

  /**
   * PASO 2: Crear quiniela y guardar SOLO los partidos seleccionados por el admin.
   */
  async createQuinielaConPartidos(
    titulo: string,
    descripcion: string,
    precioEntrada: number,
    fechaCierre: string,
    partidosSeleccionados: any[],  // array de objetos partido de la API
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    // 1. Crear la quiniela
    const { data: quiniela, error: qError } = await supabase
      .from('quinielas')
      .insert({
        titulo,
        descripcion,
        precio_entrada: precioEntrada,
        fecha_cierre: fechaCierre,
        created_by: user.id,
        estado: 'abierta',
      })
      .select()
      .single();
    if (qError) throw qError;

    // 2. Insertar solo los partidos que el admin seleccionó
    const rows = partidosSeleccionados.map((p) => ({
      quiniela_id: quiniela.id,
      external_id: String(p.external_id ?? p.id),
      equipo_local: p.equipo_local ?? p.homeTeam?.name ?? p.homeTeam,
      equipo_visitante: p.equipo_visitante ?? p.awayTeam?.name ?? p.awayTeam,
      fecha_partido: p.fecha_partido ?? p.utcDate,
    }));

    const { error: pError } = await supabase.from('partidos').insert(rows);
    if (pError) throw pError;

    return quiniela;
  },

  /** Obtener todas las quinielas (vista admin) */
  async getQuinielas() {
    const { data, error } = await supabase
      .from('quinielas')
      .select('*, partidos(count)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /** Cambiar estado de una quiniela */
  async updateEstado(quinielaId: string, estado: 'abierta' | 'cerrada' | 'finalizada') {
    const { error } = await supabase
      .from('quinielas')
      .update({ estado })
      .eq('id', quinielaId);
    if (error) throw error;
  },

  /** Verificar si el usuario tiene rol admin */
  async isAdmin(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    return data?.role === 'admin';
  },
};
