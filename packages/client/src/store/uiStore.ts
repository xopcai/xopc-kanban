import { create } from 'zustand';
import type { ViewMode } from '../types';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'xopc-theme';

function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

interface UiState {
  selectedTaskId: string | null;
  viewMode: ViewMode;
  createOpen: boolean;
  commandOpen: boolean;
  themeMode: ThemeMode;
  selectTask: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setCreateOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedTaskId: null,
  viewMode: 'board',
  createOpen: false,
  commandOpen: false,
  themeMode: readStoredTheme(),
  selectTask: (id) => set({ selectedTaskId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setCreateOpen: (open) => set({ createOpen: open }),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setThemeMode: (mode) => {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      /* ignore */
    }
    set({ themeMode: mode });
  },
}));
