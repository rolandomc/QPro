import React, { createContext, useContext, useState } from 'react';

export type Deporte = 'futbol' | 'beisbol' | 'basquet';

interface DeporteContextValue {
  deporteActivo: Deporte;
  setDeporteActivo: (d: Deporte) => void;
}

const DeporteContext = createContext<DeporteContextValue>({
  deporteActivo: 'futbol',
  setDeporteActivo: () => {},
});

export function DeporteProvider({ children }: { children: React.ReactNode }) {
  const [deporteActivo, setDeporteActivo] = useState<Deporte>('futbol');
  return (
    <DeporteContext.Provider value={{ deporteActivo, setDeporteActivo }}>
      {children}
    </DeporteContext.Provider>
  );
}

export function useDeporte() {
  return useContext(DeporteContext);
}
