import { supabase } from '../config/supabase';

interface SignUpMeta {
  nombre?: string;
  apellido?: string;
  username?: string;
  display_name?: string;
}

export const AuthService = {
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

    const userId = data.user?.id;
    if (userId && meta.username) {
      const fullName = [meta.nombre, meta.apellido].filter(Boolean).join(' ').trim();

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id:           userId,
          username:     meta.username,
          nombre:       meta.nombre ?? '',
          apellido:     meta.apellido ?? '',
          display_name: meta.display_name ?? '',
          full_name:    fullName || null,
        }, { onConflict: 'id' });

      if (profileError) {
        console.warn('[AuthService] profiles upsert:', profileError.message);
      }
    }

    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },
};
