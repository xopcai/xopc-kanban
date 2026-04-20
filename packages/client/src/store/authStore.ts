import { create } from 'zustand';

const TOKEN_KEY = 'xopc-token';

export type AccountRole = 'admin' | 'member' | 'guest';

export type AuthUser =
  | {
      typ: 'member';
      id: string;
      email: string;
      displayName: string;
      accountRole: AccountRole;
    }
  | { typ: 'agent'; id: string; name: string; description: string | null };

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setSession: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser | null) => void;
  clearSession: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  setSession: (token, user) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
    set({ token, user });
  },
  setUser: (user) => set({ user }),
  clearSession: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    set({ token: null, user: null });
  },
  hydrate: () => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      set({ token: t, user: null, hydrated: true });
    } catch {
      set({ token: null, user: null, hydrated: true });
    }
  },
}));
