import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../../src/theme/colors';
import { supabase } from '../../src/config/supabase';

// Inyecta CSS para forzar el tab bar arriba del safe area en PWA
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    /* Fuerza el tab bar a subir ignorando safe-area-inset-bottom */
    [data-testid="tab-bar"],
    div[style*="position: fixed"][style*="bottom"] {
      padding-bottom: 0 !important;
      margin-bottom: 0 !important;
    }
    /* Override global safe area que Expo aplica en web */
    .css-view-175oi2r[style*="paddingBottom"] {
      padding-bottom: 0px !important;
    }
  `;
  document.head.appendChild(style);
}

function NotifIcon({ color }: { color: string }) {
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    let channel: any;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from('notificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('leida', false);
      setNoLeidas(count ?? 0);
      channel = supabase
        .channel('notif-badge')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, async () => {
          const { count: c } = await supabase
            .from('notificaciones')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('leida', false);
          setNoLeidas(c ?? 0);
        })
        .subscribe();
    };
    init();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  return (
    <View>
      <Ionicons name="person" size={24} color={color} />
      {noLeidas > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{noLeidas > 99 ? '99+' : noLeidas}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.card,
        borderTopColor: colors.border,
        // Altura generosa + sin padding extra en web
        height: Platform.OS === 'web' ? 58 : undefined,
        paddingBottom: Platform.OS === 'web' ? 0 : undefined,
        paddingTop: Platform.OS === 'web' ? 0 : undefined,
        position: Platform.OS === 'web' ? 'fixed' as any : 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
      },
      tabBarItemStyle: {
        // Centra icon+label verticalmente dentro del tab
        paddingVertical: Platform.OS === 'web' ? 6 : 0,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
        // Sube la etiqueta para que quede pegada al icono
        marginTop: Platform.OS === 'web' ? -4 : 0,
        marginBottom: Platform.OS === 'web' ? 4 : 0,
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Quinielas', tabBarIcon: ({ color }) => <Ionicons name="football" size={22} color={color} /> }} />
      <Tabs.Screen name="results" options={{ title: 'Resultados', tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <NotifIcon color={color} /> }} />
      <Tabs.Screen name="notificaciones" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#E74C3C', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
});
