import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';

export default function RootLayout() {
  return (
    <>
      <StatusBar barStyle="light-content" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Pestañas Principales */}
        <Stack.Screen name="(tabs)" />
        
        {/* Pantallas Interiores (Navegación normal lateral) */}
        <Stack.Screen name="quiniela/details" />
        
        {/* Modales (Deslizan desde abajo) */}
        <Stack.Screen 
          name="wallet/index" 
          options={{ 
            presentation: 'modal', 
            animation: 'slide_from_bottom' 
          }} 
        />
      </Stack>
    </>
  );
}