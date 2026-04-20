import { create } from 'zustand';
import type { TaskPriority, ViewMode, WorkspaceScreen } from '../types';

export type ThemeMode = 'light' | 'dark' | 'system';

/** UI root font scale (drives `html` font-size so `rem`-based UI scales together). */
export type TextSize = 'sm' | 'md' | 'lg';

const THEME_KEY = 'xopc-theme';
const TEXT_SIZE_KEY = 'xopc-text-size';
const CURRENT_PROJECT_KEY = 'xopc-current-project';
/** Last project opened in task workspace; kept when returning to /projects for sidebar shortcuts. */
const LAST_WORKSPACE_PROJECT_KEY = 'xopc-last-workspace-project';
const SIDEBAR_WIDTH_KEY = 'xopc-sidebar-width';
/** @deprecated read for migration only */
const LEGACY_CONV_TEXT_KEY = 'xopc-conv-text';

export const SIDEBAR_WIDTH_MIN_PX = 200;
export const SIDEBAR_WIDTH_MAX_PX = 480;
export const SIDEBAR_WIDTH_DEFAULT_PX = 240;

function clampSidebarWidthPx(w: number): number {
  return Math.min(
    SIDEBAR_WIDTH_MAX_PX,
    Math.max(SIDEBAR_WIDTH_MIN_PX, Math.round(w)),
  );
}

function readStoredSidebarWidthPx(): number {
  try {
    const v = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (v) {
      const n = Number.parseInt(v, 10);
      if (!Number.isNaN(n)) return clampSidebarWidthPx(n);
    }
  } catch {
    /* ignore */
  }
  return SIDEBAR_WIDTH_DEFAULT_PX;
}

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

function readStoredLastWorkspaceProjectId(): string | null {
  try {
    const v = localStorage.getItem(LAST_WORKSPACE_PROJECT_KEY);
    if (v && v.length > 0) return v;
  } catch {
    /* ignore */
  }
  return null;
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
  /** Left sidebar width (px); persisted for layout preference. */
  sidebarWidthPx: number;
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
  setSidebarWidthPx: (w: number) => void;
  setTaskFilters: (patch: Partial<TaskFiltersState>) => void;
  resetTaskFilters: () => void;
  setSelectionMode: (on: boolean) => void;
  toggleTaskSelected: (id: string) => void;
  clearSelection: () => void;
  /** Remember last task workspace project (sidebar / shortcuts when not on a project route). */
  rememberWorkspaceProject: (id: string) => void;
  getLastWorkspaceProjectId: () => string | null;
  clearLastWorkspaceProjectIfMatch: (id: string) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  selectedTaskId: null,
  currentProjectId: readStoredCurrentProjectId(),
  /** Driven by the URL after hydration; initial value avoids a null flash before first route sync. */
  workspaceScreen: 'projects' as WorkspaceScreen,
  viewMode: 'board',
  createOpen: false,
  commandOpen: false,
  shortcutsOpen: false,
  themeMode: readStoredTheme(),
  textSize: readStoredTextSize(),
  sidebarWidthPx: readStoredSidebarWidthPx(),
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
  setWorkspaceScreen: (screen) => set({ workspaceScreen: screen }),
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
  setSidebarWidthPx: (w) => {
    const cw = clampSidebarWidthPx(w);
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(cw));
    } catch {
      /* ignore */
    }
    set({ sidebarWidthPx: cw });
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
  rememberWorkspaceProject: (id) => {
    try {
      localStorage.setItem(LAST_WORKSPACE_PROJECT_KEY, id);
    } catch {
      /* ignore */
    }
  },
  getLastWorkspaceProjectId: () => readStoredLastWorkspaceProjectId(),
  clearLastWorkspaceProjectIfMatch: (id) => {
    try {
      const cur = localStorage.getItem(LAST_WORKSPACE_PROJECT_KEY);
      if (cur === id) localStorage.removeItem(LAST_WORKSPACE_PROJECT_KEY);
    } catch {
      /* ignore */
    }
  },
}));
