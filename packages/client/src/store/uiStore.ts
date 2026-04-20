import { create } from 'zustand';
import type { ViewMode } from '../types';

interface UiState {
  selectedTaskId: string | null;
  viewMode: ViewMode;
  createOpen: boolean;
  selectTask: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setCreateOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedTaskId: null,
  viewMode: 'board',
  createOpen: false,
  selectTask: (id) => set({ selectedTaskId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setCreateOpen: (open) => set({ createOpen: open }),
}));
