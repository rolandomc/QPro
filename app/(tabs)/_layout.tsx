import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Platform,
  TouchableOpacity, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';
import { supabase } from '../../src/config/supabase';

// ─── Badge de notificaciones ──────────────────────────────────────────────────
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

// ─── Tab item con animación spring ─────────────────────────────────────────
function TabItem({
  icon, label, active, onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useState(new Animated.Value(1))[0];

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(scale,  { toValue: 1,    friction: 4, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity style={styles.tabItem} onPress={handlePress} activeOpacity={1}>
      <Animated.View
        style={[
          styles.tabIconWrap,
          active && styles.tabIconWrapActive,
          { transform: [{ scale }] },
        ]}
      >
        {active && <View style={styles.activeGlow} />}
        {icon}
      </Animated.View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Tab bar flotante liquid-glass (sin expo-blur) ────────────────────────
function FloatingTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter(
    (_: any, i: number) => descriptors[state.routes[i].key].options.href !== null,
  );

  const barBottom = Platform.OS === 'web' ? 20 : insets.bottom + 12;

  // Estilos glass: en web usamos backdropFilter vía style inline
  const glassStyle: any = Platform.OS === 'web'
    ? {
        backdropFilter:        'blur(20px) saturate(180%)',
        WebkitBackdropFilter:  'blur(20px) saturate(180%)',
        backgroundColor:       'rgba(18,21,28,0.62)',
      }
    : {
        backgroundColor: 'rgba(18,21,28,0.82)',
      };

  return (
    <View style={[styles.floatingWrapper, { bottom: barBottom }, glassStyle]}>
      {/* Borde glass luminoso */}
      <View style={styles.glassBorder} pointerEvents="none" />

      {/* Items */}
      <View style={styles.tabsRow}>
        {visibleRoutes.map((route: any) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === state.routes.indexOf(route);
          const label     = options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          const iconColor = isFocused ? '#FFF' : 'rgba(255,255,255,0.45)';
          let icon: React.ReactNode = null;
          if (route.name === 'index')   icon = <Ionicons name="football"    size={22} color={iconColor} />;
          if (route.name === 'results') icon = <Ionicons name="stats-chart" size={22} color={iconColor} />;
          if (route.name === 'profile') icon = <NotifBadge color={iconColor} />;

          return (
            <TabItem
              key={route.key}
              icon={icon}
              label={label}
              active={isFocused}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Layout principal ─────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0C10' },
      }}
    >
      <Tabs.Screen name="index"         options={{ title: 'Quinielas'  }} />
      <Tabs.Screen name="results"        options={{ title: 'Resultados' }} />
      <Tabs.Screen name="profile"        options={{ title: 'Perfil'     }} />
      <Tabs.Screen name="notificaciones" options={{ href: null         }} />
    </Tabs>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  floatingWrapper: {
    position:      'absolute',
    left:          24,
    right:         24,
    borderRadius:  30,
    overflow:      'hidden',
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius:  24,
    elevation:     20,
  },

  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    borderWidth:  1,
    borderColor:  'rgba(255,255,255,0.12)',
  },

  tabsRow: {
    flexDirection:    'row',
    paddingVertical:  10,
    paddingHorizontal: 8,
  },

  tabItem: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
  },

  tabIconWrap: {
    width:          52,
    height:         36,
    borderRadius:   18,
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'visible',
  },

  tabIconWrapActive: {
    backgroundColor: 'rgba(155,89,182,0.28)',
    borderWidth:   1,
    borderColor:   'rgba(155,89,182,0.55)',
    shadowColor:   '#9B59B6',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius:  10,
    elevation:     6,
  },

  activeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius:    18,
    backgroundColor: 'rgba(155,89,182,0.18)',
    transform:       [{ scale: 1.4 }],
  },

  tabLabel: {
    fontSize:      10,
    fontWeight:    '600',
    color:         'rgba(255,255,255,0.4)',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color:      '#FFF',
    fontWeight: '700',
  },

  badge: {
    position:          'absolute',
    top:               -4,
    right:             -6,
    backgroundColor:   '#E74C3C',
    borderRadius:      8,
    minWidth:          16,
    height:            16,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color:      '#FFF',
    fontSize:   9,
    fontWeight: 'bold',
  },
});
