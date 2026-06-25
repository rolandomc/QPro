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
   * Llama a la Edge Function para importar partidos de football-data.org
   * y guardarlos en la tabla `partidos` de la quiniela indicada.
   */
  async syncMatches(quinielaId: string, competitionCode: CompetitionCode, matchday?: number) {
    const { data, error } = await supabase.functions.invoke('sync-matches', {
      body: {
        quiniela_id: quinielaId,
        competition_code: competitionCode,
        matchday: matchday ?? undefined,
      },
    });

    if (error) throw error;
    return data as { success: boolean; inserted: number; competition: string; matches: any[] };
  },

  /**
   * Crear una nueva quiniela
   */
  async createQuiniela(titulo: string, descripcion: string, precioEntrada: number, fechaCierre: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase
      .from('quinielas')
      .insert({
        titulo,
        descripcion,
        precio_entrada: precioEntrada,
        fecha_cierre: fechaCierre,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Obtener todas las quinielas (vista admin)
   */
  async getQuinielas() {
    const { data, error } = await supabase
      .from('quinielas')
      .select('*, partidos(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Cambiar estado de una quiniela
   */
  async updateEstado(quinielaId: string, estado: 'abierta' | 'cerrada' | 'finalizada') {
    const { error } = await supabase
      .from('quinielas')
      .update({ estado })
      .eq('id', quinielaId);

    if (error) throw error;
  },

  /**
   * Verificar si el usuario tiene rol admin
   */
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
