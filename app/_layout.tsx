import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StatusBar, View } from 'react-native';
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitialized(true);
    });
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
    return () => subscription.unsubscribe();
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
      <View style={{ flex: 1, backgroundColor: '#0A0C10', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2ECC71" />
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
