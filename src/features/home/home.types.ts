// Tipos del módulo Home

export interface HomeState {
  isLoading: boolean;
  userName: string;
  balance: number;
}

export interface HomeAction {
  type: 'SET_LOADING' | 'SET_USER' | 'SET_BALANCE';
  payload?: unknown;
}
