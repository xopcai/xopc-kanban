import { create } from 'zustand';
import type { TaskPriority, ViewMode } from '../types';

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

export type AssigneeFilter = '' | '__none__' | string;

export interface TaskFiltersState {
  priority: '' | TaskPriority;
  assigneeId: AssigneeFilter;
  labelId: string;
}

const defaultTaskFilters: TaskFiltersState = {
  priority: '',
  assigneeId: '',
  labelId: '',
};

interface UiState {
  selectedTaskId: string | null;
  viewMode: ViewMode;
  createOpen: boolean;
  commandOpen: boolean;
  shortcutsOpen: boolean;
  themeMode: ThemeMode;
  taskFilters: TaskFiltersState;
  selectionMode: boolean;
  selectedTaskIds: string[];
  selectTask: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setCreateOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setTaskFilters: (patch: Partial<TaskFiltersState>) => void;
  resetTaskFilters: () => void;
  setSelectionMode: (on: boolean) => void;
  toggleTaskSelected: (id: string) => void;
  clearSelection: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  selectedTaskId: null,
  viewMode: 'board',
  createOpen: false,
  commandOpen: false,
  shortcutsOpen: false,
  themeMode: readStoredTheme(),
  taskFilters: { ...defaultTaskFilters },
  selectionMode: false,
  selectedTaskIds: [],
  selectTask: (id) => set({ selectedTaskId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setCreateOpen: (open) => set({ createOpen: open }),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setThemeMode: (mode) => {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      /* ignore */
    }
    set({ themeMode: mode });
  },
  setTaskFilters: (patch) =>
    set({ taskFilters: { ...get().taskFilters, ...patch } }),
  resetTaskFilters: () => set({ taskFilters: { ...defaultTaskFilters } }),
  setSelectionMode: (on) =>
    set((s) => ({
      selectionMode: on,
      selectedTaskIds: on ? s.selectedTaskIds : [],
    })),
  toggleTaskSelected: (id) =>
    set((s) => {
      const has = s.selectedTaskIds.includes(id);
      const selectedTaskIds = has
        ? s.selectedTaskIds.filter((x) => x !== id)
        : [...s.selectedTaskIds, id];
      return { selectedTaskIds };
    }),
  clearSelection: () => set({ selectedTaskIds: [] }),
}));
