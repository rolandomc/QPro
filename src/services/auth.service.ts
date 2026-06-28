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

    // Si el correo ya existe pero no está confirmado, Supabase devuelve
    // un user con identities vacío → lo tratamos como "ya registrado"
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error('Este correo ya está registrado. Revisa tu bandeja o inicia sesión.');
    }

    // Si hay sesión activa inmediatamente (email confirm desactivado),
    // creamos el perfil igual que antes
    if (data.session) {
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
    }
    // Si NO hay sesión = email confirm activado → el perfil se creará
    // cuando el usuario confirme su correo vía el trigger handle_new_user

    // Indicamos al caller si se requiere confirmar correo
    return {
      ...data,
      requiresEmailConfirmation: !data.session,
    };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Mensaje amigable para correo no confirmado
      if (error.message?.toLowerCase().includes('email not confirmed')) {
        throw new Error('Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.');
      }
      throw error;
    }
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
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
