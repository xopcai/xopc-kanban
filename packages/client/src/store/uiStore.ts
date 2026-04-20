import { create } from 'zustand';
import type { TaskPriority, ViewMode, WorkspaceScreen } from '../types';

export type ThemeMode = 'light' | 'dark' | 'system';

/** UI root font scale (drives `html` font-size so `rem`-based UI scales together). */
export type TextSize = 'sm' | 'md' | 'lg';

const THEME_KEY = 'xopc-theme';
const TEXT_SIZE_KEY = 'xopc-text-size';
const CURRENT_PROJECT_KEY = 'xopc-current-project';
const WORKSPACE_SCREEN_KEY = 'xopc-workspace-screen';
/** @deprecated read for migration only */
const LEGACY_CONV_TEXT_KEY = 'xopc-conv-text';

function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

function readStoredCurrentProjectId(): string | null {
  try {
    const v = localStorage.getItem(CURRENT_PROJECT_KEY);
    if (v && v.length > 0) return v;
  } catch {
    /* ignore */
  }
  return null;
}

function readStoredWorkspaceScreen(): WorkspaceScreen {
  try {
    const v = localStorage.getItem(WORKSPACE_SCREEN_KEY);
    if (v === 'tasks' || v === 'projects') return v;
  } catch {
    /* ignore */
  }
  return 'projects';
}

function readStoredTextSize(): TextSize {
  try {
    let v = localStorage.getItem(TEXT_SIZE_KEY);
    if (!v) v = localStorage.getItem(LEGACY_CONV_TEXT_KEY);
    if (v === 'sm' || v === 'md' || v === 'lg') return v;
  } catch {
    /* ignore */
  }
  return 'md';
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
  /** Active project for task list / create; must match a row the user can access. */
  currentProjectId: string | null;
  /** Main area: project home grid vs task workspace. */
  workspaceScreen: WorkspaceScreen;
  viewMode: ViewMode;
  createOpen: boolean;
  commandOpen: boolean;
  shortcutsOpen: boolean;
  themeMode: ThemeMode;
  textSize: TextSize;
  taskFilters: TaskFiltersState;
  selectionMode: boolean;
  selectedTaskIds: string[];
  selectTask: (id: string | null) => void;
  setCurrentProjectId: (id: string | null) => void;
  setWorkspaceScreen: (screen: WorkspaceScreen) => void;
  setViewMode: (mode: ViewMode) => void;
  setCreateOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setTextSize: (size: TextSize) => void;
  setTaskFilters: (patch: Partial<TaskFiltersState>) => void;
  resetTaskFilters: () => void;
  setSelectionMode: (on: boolean) => void;
  toggleTaskSelected: (id: string) => void;
  clearSelection: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  selectedTaskId: null,
  currentProjectId: readStoredCurrentProjectId(),
  workspaceScreen: readStoredWorkspaceScreen(),
  viewMode: 'board',
  createOpen: false,
  commandOpen: false,
  shortcutsOpen: false,
  themeMode: readStoredTheme(),
  textSize: readStoredTextSize(),
  taskFilters: { ...defaultTaskFilters },
  selectionMode: false,
  selectedTaskIds: [],
  selectTask: (id) => set({ selectedTaskId: id }),
  setCurrentProjectId: (id) => {
    try {
      if (id) localStorage.setItem(CURRENT_PROJECT_KEY, id);
      else localStorage.removeItem(CURRENT_PROJECT_KEY);
    } catch {
      /* ignore */
    }
    set({ currentProjectId: id });
  },
  setWorkspaceScreen: (screen) => {
    try {
      localStorage.setItem(WORKSPACE_SCREEN_KEY, screen);
    } catch {
      /* ignore */
    }
    set({ workspaceScreen: screen });
  },
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
  setTextSize: (size) => {
    try {
      localStorage.setItem(TEXT_SIZE_KEY, size);
      localStorage.removeItem(LEGACY_CONV_TEXT_KEY);
    } catch {
      /* ignore */
    }
    set({ textSize: size });
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
