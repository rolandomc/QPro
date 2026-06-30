import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Platform,
  TouchableOpacity, Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/config/supabase';

const TAB_CONFIG = [
  { name: 'index',   title: 'Quinielas',  icon: 'football'    },
  { name: 'results', title: 'Resultados', icon: 'stats-chart' },
  { name: 'profile', title: 'Perfil',     icon: null          },
] as const;

const ACCENT = '#9B59B6';

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

// ─── FloatingTabBar con indicador deslizante ──────────────────────────────────────
function FloatingTabBar({ state, navigation }: any) {
  const insets     = useSafeAreaInsets();
  const barBottom  = Platform.OS === 'web' ? 20 : insets.bottom + 12;
  const translateX = useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(0);

  const currentIndex = TAB_CONFIG.findIndex(
    t => t.name === state.routes[state.index]?.name
  );

  useEffect(() => {
    if (barWidth === 0) return;
    const tabW = barWidth / TAB_CONFIG.length;
    Animated.spring(translateX, {
      toValue:   currentIndex * tabW + 6,
      friction:  7,
      tension:   80,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, barWidth]);

  const tabW = barWidth > 0 ? barWidth / TAB_CONFIG.length - 12 : 0;

  const inner = (
    <View
      style={styles.tabsRow}
      onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
    >
      {/* Indicador deslizante */}
      {barWidth > 0 && (
        <Animated.View
          style={[
            styles.slideIndicator,
            {
              width:     tabW,
              transform: [{ translateX }],
              backgroundColor: 'rgba(155,89,182,0.28)',
              shadowColor: ACCENT,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {TAB_CONFIG.map((tab) => {
        const route    = state.routes.find((r: any) => r.name === tab.name);
        if (!route) return null;
        const isFocused  = state.routes[state.index]?.name === tab.name;
        const iconColor  = isFocused ? '#FFF' : 'rgba(255,255,255,0.4)';
        const labelColor = isFocused ? '#FFF' : 'rgba(255,255,255,0.4)';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(tab.name);
        };

        const icon = tab.name === 'profile'
          ? <NotifBadge color={iconColor} />
          : <Ionicons name={tab.icon as any} size={22} color={iconColor} />;

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={onPress}
            activeOpacity={0.8}
          >
            {icon}
            <Text style={[styles.tabLabel, { color: labelColor }]}>{tab.title}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (Platform.OS === 'web') {
    const webGlass: any = {
      backdropFilter:       'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      backgroundColor:      'rgba(18,21,28,0.72)',
    };
    return (
      <View style={[styles.floatingWrapper, { bottom: barBottom }, webGlass]}>
        <View style={styles.glassBorder} pointerEvents="none" />
        {inner}
      </View>
    );
  }

  return (
    <View style={[styles.floatingWrapper, { bottom: barBottom }]}>
      <BlurView
        intensity={70}
        tint="systemUltraThinMaterialDark"
        style={StyleSheet.absoluteFill}
        experimentalBlurMethod="dimezisBlurView"
      />
      <View style={styles.blurOverlay} pointerEvents="none" />
      <View style={styles.glassBorder} pointerEvents="none" />
      {inner}
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0C10' } }}
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
    position:      'absolute',
    left:           24,
    right:          24,
    borderRadius:   28,
    overflow:       'hidden',
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity:  0.45,
    shadowRadius:   24,
    elevation:      20,
  },
  blurOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,12,16,0.35)' },
  glassBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },

  tabsRow: {
    flexDirection:     'row',
    paddingVertical:    10,
    paddingHorizontal:  6,
    position:          'relative',
    overflow:          'visible',
  },

  slideIndicator: {
    position:      'absolute',
    top:            8,
    bottom:         8,
    borderRadius:   18,
    borderWidth:     1,
    borderColor:    'rgba(155,89,182,0.55)',
    shadowOpacity:  0.7,
    shadowRadius:   10,
    shadowOffset:  { width: 0, height: 0 },
    elevation:      6,
  },

  tabItem: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:             4,
    paddingVertical: 2,
    zIndex:          1,
  },
  tabLabel: {
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing:  0.2,
  },

  badge: {
    position:          'absolute',
    top:               -4,
    right:             -6,
    backgroundColor:   '#E74C3C',
    borderRadius:       8,
    minWidth:           16,
    height:             16,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal:  3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
});
