import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { supabase } from '../src/config/supabase';

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [session, setSession] = useState<any>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // 1. Obtener sesión actual al arrancar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitialized(true);
    });

    // 2. Escuchar cambios de estado (login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      // Sin sesión y fuera de auth → mandar a login
      router.replace('/auth/login');
    } else if (session && inAuthGroup) {
      // Con sesión intentando entrar a auth → mandar al inicio
      router.replace('/(tabs)');
    }
  }, [session, isInitialized, segments]);

  // Splash de carga mientras se verifica la sesión
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0C10', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2ECC71" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Rutas Públicas */}
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />

        {/* Rutas Privadas */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="quiniela/details" />
        <Stack.Screen name="admin/index" />
        <Stack.Screen name="admin/create" />

        {/* Modales */}
        <Stack.Screen
          name="wallet/index"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </>
  );
}
