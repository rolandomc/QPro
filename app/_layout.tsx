import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Platform, StatusBar, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../src/config/supabase';
import { DeporteProvider } from '../src/context/DeporteContext';
import '../src/utils/alertPatch';

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const haloPulse = useRef(new Animated.Value(0.65)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(haloPulse, {
          toValue: 0.65,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -6,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    intro.start();
    pulseLoop.start();
    floatLoop.start();

    return () => {
      pulseLoop.stop();
      floatLoop.stop();
    };
  }, [haloPulse, logoFloat, logoOpacity, logoScale, subtitleOpacity]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!document.querySelector('link[rel="manifest"]')) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = '/manifest.json';
        document.head.appendChild(link);
      }
      const metaTags = [
        { name: 'apple-mobile-web-app-capable',          content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
        { name: 'apple-mobile-web-app-title',            content: 'QPro' },
        { name: 'theme-color',                           content: '#0A0C10' },
      ];
      metaTags.forEach(({ name, content }) => {
        if (!document.querySelector(`meta[name="${name}"]`)) {
          const meta = document.createElement('meta');
          meta.name = name; meta.content = content;
          document.head.appendChild(meta);
        }
      });
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const [{ data: { session } }] = await Promise.all([
          supabase.auth.getSession(),
          new Promise((resolve) => setTimeout(resolve, 1200)),
        ]);
        if (!mounted) return;
        setSession(session);
      } catch (error) {
        console.warn('No se pudo inicializar sesion (red):', error);
        if (!mounted) return;
        setSession(null);
      } finally {
        if (mounted) setIsInitialized(true);
      }
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setSession(session);
        router.replace('/auth/reset-password');
        return;
      }
      if (event === 'USER_UPDATED') {
        setIsPasswordRecovery(false);
      }
      setSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (isPasswordRecovery) return;
    const inAuthGroup = segments[0] === 'auth';
    const inPagoGroup = segments[0] === 'pago';
    const inResetPassword = segments[1] === 'reset-password';
    if (!session && !inAuthGroup && !inPagoGroup) {
      router.replace('/auth/login');
    } else if (session && inAuthGroup && !inResetPassword) {
      router.replace('/(tabs)');
    }
  }, [session, isInitialized, segments, isPasswordRecovery]);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: '#060910', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ position: 'absolute', top: 0, right: 0, left: 0, bottom: 0 }}>
          <View style={{ position: 'absolute', top: 80, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(46,204,113,0.12)' }} />
          <View style={{ position: 'absolute', bottom: 140, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(91,155,213,0.12)' }} />
        </View>

        <Animated.View
          style={{
            position: 'absolute',
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: 'rgba(46,204,113,0.14)',
            opacity: haloPulse,
            transform: [{ scale: haloPulse }],
          }}
        />

        <Animated.View
          style={{
            alignItems: 'center',
            transform: [{ translateY: logoFloat }, { scale: logoScale }],
            opacity: logoOpacity,
          }}
        >
          <View style={{
            width: 188,
            height: 188,
            borderRadius: 34,
            backgroundColor: '#0A0C10',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            shadowColor: '#2ECC71',
            shadowOpacity: 0.3,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 12 },
            elevation: 18,
          }}>
            <Image
              source={require('../assets/images/splash-icon.png')}
              style={{ width: 176, height: 176, borderRadius: 24 }}
              resizeMode="contain"
            />
          </View>

          <Animated.Text
            style={{
              marginTop: 24,
              color: '#D5DBE6',
              fontSize: 13,
              letterSpacing: 2.4,
              textTransform: 'uppercase',
              opacity: subtitleOpacity,
              fontWeight: '700',
            }}
          >
            Cargando QPro
          </Animated.Text>

          <View style={{ marginTop: 14 }}>
            <ActivityIndicator size="small" color="#2ECC71" />
          </View>
        </Animated.View>

        <Text style={{ position: 'absolute', bottom: 42, color: '#6F7A8C', fontSize: 11, letterSpacing: 1.4 }}>
          Pools deportivos en tiempo real
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DeporteProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0A0C10" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="auth/forgot-password" />
          <Stack.Screen name="auth/reset-password" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="quiniela/details" />
          <Stack.Screen name="admin/index" />
          <Stack.Screen name="admin/create" />
          <Stack.Screen name="wallet/index" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="pago/exito" />
          <Stack.Screen name="pago/fallo" />
          <Stack.Screen name="pago/pendiente" />
        </Stack>
      </DeporteProvider>
    </GestureHandlerRootView>
  );
}
