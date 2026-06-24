import { useState } from 'react';
import type { HomeState } from './home.types';

// Hook de lógica para la pantalla Home
export function useHome(): HomeState & { refresh: () => void } {
  const [state, setState] = useState<HomeState>({
    isLoading: false,
    userName: 'Usuario',
    balance: 0,
  });

  const refresh = () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    // TODO: llamar a servicios reales
    setTimeout(() => {
      setState((prev) => ({ ...prev, isLoading: false }));
    }, 1000);
  };

  return { ...state, refresh };
}
