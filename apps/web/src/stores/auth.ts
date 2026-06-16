import { create } from 'zustand';
import {
  clearStoredToken,
  readStoredToken,
  redirectToLoginIfNeeded,
} from '../lib/authSession';

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
  sessionExpired: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: readStoredToken(),
  setToken: (token) => {
    if (token) localStorage.setItem('qk_token', token);
    else clearStoredToken();
    set({ token });
  },
  logout: () => {
    clearStoredToken();
    set({ token: null });
  },
  sessionExpired: () => {
    clearStoredToken();
    set({ token: null });
    redirectToLoginIfNeeded();
  },
}));
