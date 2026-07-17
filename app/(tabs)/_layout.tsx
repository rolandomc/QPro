import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/config/supabase';
import { colors, radii, shadows, text } from '../../src/theme';

const TAB_CONFIG = [
  { name: 'index',   title: 'Quinielas',  icon: 'football'    },
  { name: 'results', title: 'Resultados', icon: 'stats-chart' },
  { name: 'profile', title: 'Perfil',     icon: null          },
] as const;

const ACCENT     = colors.primary;
const IND_MARGIN = 8; // margen a cada lado de la pastilla dentro de cada tab

// ─── Badge ───────────────────────────────────────────────────────────────────────
function NotifBadge({ color }: { color: string }) {
  const [noLeidas, setNoLeidas] = useState(0);
  useEffect(() => {
    let channel: any;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from('notificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('leida', false);
      setNoLeidas(count ?? 0);
      channel = supabase.channel('notif-badge')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, async () => {
          const { count: c } = await supabase
            .from('notificaciones')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id).eq('leida', false);
          setNoLeidas(c ?? 0);
        }).subscribe();
    };
    init();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);
  return (
    <View>
      <Ionicons name="person" size={22} color={color} />
      {noLeidas > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{noLeidas > 99 ? '99+' : noLeidas}</Text>
        </View>
      )}
    </View>
  );
}

// ─── FloatingTabBar ────────────────────────────────────────────────────────────
function FloatingTabBar({ state, navigation }: any) {
  const insets    = useSafeAreaInsets();
  const barBottom = Platform.OS === 'web' ? 20 : insets.bottom + 12;
  const translateX = useRef(new Animated.Value(0)).current;
  const indWidth   = useRef(new Animated.Value(0)).current;

  // Medimos el layout real de cada tab button
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);

  const currentIndex = TAB_CONFIG.findIndex(
    t => t.name === state.routes[state.index]?.name,
  );

  useEffect(() => {
    const layout = tabLayouts[currentIndex];
    if (!layout) return;
    const targetX = layout.x + IND_MARGIN;
    const targetW = layout.width - IND_MARGIN * 2;
    Animated.parallel([
      Animated.spring(translateX, { toValue: targetX, friction: 7, tension: 80, useNativeDriver: false }),
      Animated.spring(indWidth,   { toValue: targetW, friction: 7, tension: 80, useNativeDriver: false }),
    ]).start();
  }, [currentIndex, tabLayouts, indWidth, translateX]);

  const inner = (
    <View style={styles.tabsRow}>
      {/* Indicador deslizante */}
      {tabLayouts.length === TAB_CONFIG.length && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slideIndicator,
            { width: indWidth, transform: [{ translateX }] },
          ]}
        />
      )}

      {TAB_CONFIG.map((tab, i) => {
        const route     = state.routes.find((r: any) => r.name === tab.name);
        if (!route) return null;
        const isFocused = state.routes[state.index]?.name === tab.name;
        const clr       = isFocused ? '#FFF' : 'rgba(255,255,255,0.4)';

        const onPress = () => {
          const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !ev.defaultPrevented) navigation.navigate(tab.name);
        };

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={onPress}
            activeOpacity={0.8}
            onLayout={e => {
              const { x, width } = e.nativeEvent.layout;
              setTabLayouts(prev => {
                const next = [...prev];
                next[i] = { x, width };
                return next;
              });
            }}
          >
            {tab.name === 'profile'
              ? <NotifBadge color={clr} />
              : <Ionicons name={tab.icon as any} size={22} color={clr} />}
            <Text style={[styles.tabLabel, { color: clr }]}>{tab.title}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.floatingWrapper, { bottom: barBottom },
        { backdropFilter: 'blur(20px) saturate(180%)', backgroundColor: 'rgba(7,10,18,0.72)' } as any]}>
        <View style={styles.glassBorder} pointerEvents="none" />
        {inner}
      </View>
    );
  }
  return (
    <View style={[styles.floatingWrapper, { bottom: barBottom }]}>
      <BlurView intensity={70} tint="systemUltraThinMaterialDark"
        style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
      <View style={styles.blurOverlay} pointerEvents="none" />
      <View style={styles.glassBorder} pointerEvents="none" />
      {inner}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index"         options={{ title: 'Quinielas'  }} />
      <Tabs.Screen name="results"        options={{ title: 'Resultados' }} />
      <Tabs.Screen name="profile"        options={{ title: 'Perfil'     }} />
      <Tabs.Screen name="notificaciones" options={{ href: null         }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute', left: 20, right: 20, borderRadius: radii.xl, overflow: 'hidden',
    ...shadows.xl,
  },
  blurOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,13,22,0.35)' },
  glassBorder: { ...StyleSheet.absoluteFillObject, borderRadius: radii.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  tabsRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  slideIndicator: {
    position: 'absolute',
    top: 8, bottom: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(53,208,127,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(53,208,127,0.45)',
    shadowColor: ACCENT,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4, zIndex: 1 },
  tabLabel: { ...text.caption, fontSize: 10, letterSpacing: 0.2 },
  badge: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: colors.error, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
});
