import { supabase } from '../config/supabase';

interface SignUpMeta {
  nombre?: string;
  apellido?: string;
  username?: string;
  display_name?: string;
}

export const AuthService = {
  /**
   * Registrar un nuevo usuario.
   * Crea la cuenta en Supabase Auth y luego inserta/actualiza
   * el perfil en public.profiles.
   */
  async signUp(email: string, password: string, meta: SignUpMeta = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre:       meta.nombre ?? '',
          apellido:     meta.apellido ?? '',
          username:     meta.username ?? '',
          display_name: meta.display_name ?? '',
        },
      },
    });
    if (error) throw error;

    // Insertar perfil en public.profiles si se obtuvo el usuario
    const userId = data.user?.id;
    if (userId && meta.username) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id:           userId,
          username:     meta.username,
          nombre:       meta.nombre ?? '',
          apellido:     meta.apellido ?? '',
          display_name: meta.display_name ?? '',
        }, { onConflict: 'id' });

      // No bloqueamos el registro si el upsert falla (p.ej. columna inexistente)
      // El trigger de Supabase o una migración futura puede completarlo.
      if (profileError) {
        console.warn('[AuthService] profiles upsert:', profileError.message);
      }
    }

    return data;
  },

  /**
   * Iniciar sesión con email y contraseña
   */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  /**
   * Cerrar sesión
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Obtener la sesión activa
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Obtener el usuario actual
   */
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },
};
