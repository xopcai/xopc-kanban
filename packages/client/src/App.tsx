import { CheckSquare, GitBranch, LayoutGrid, List, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api/client';
import { LoginScreen } from './components/Auth/LoginScreen';
import { BoardView } from './components/Board/BoardView';
import { BulkActionsBar } from './components/Board/BulkActionsBar';
import { DialogHost } from './components/Dialog/DialogHost';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { ListView } from './components/List/ListView';
import { ShortcutsHelp } from './components/Shortcuts/ShortcutsHelp';
import { TaskGraphView } from './components/TaskGraph/TaskGraphView';
import { AppLogo } from './components/AppLogo';
import { SidebarProfileMenu } from './components/SidebarProfileMenu';
import { TaskDetailPanel } from './components/TaskDetail/TaskDetailPanel';
import { useCreateTask, workspaceKeys } from './hooks/useTasks';
import { useTaskEventsStream } from './hooks/useSSE';
import { useAuthStore } from './store/authStore';
import { useDialogStore } from './store/dialogStore';
import { useUiStore } from './store/uiStore';

/** Maps UI text size to root `font-size` so Tailwind `rem` typography scales consistently. */
function useSyncTextSize() {
  const textSize = useUiStore((s) => s.textSize);
  useEffect(() => {
    const px =
      textSize === 'sm' ? '14px' : textSize === 'lg' ? '17px' : '15px';
    document.documentElement.style.fontSize = px;
    document.documentElement.dataset.textSize = textSize;
  }, [textSize]);
}

function useSyncThemeClass() {
  const themeMode = useUiStore((s) => s.themeMode);
  useEffect(() => {
    const apply = () => {
      let dark = false;
      if (themeMode === 'dark') dark = true;
      else if (themeMode === 'light') dark = false;
      else dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    if (themeMode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [themeMode]);
}

function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useUiStore.getState();

      if (e.key === 'Escape') {
        if (useDialogStore.getState().dialog) {
          e.preventDefault();
          useDialogStore.getState().dismiss();
          return;
        }
        if (st.shortcutsOpen) {
          e.preventDefault();
          st.setShortcutsOpen(false);
          return;
        }
        if (st.commandOpen) return;
        if (st.createOpen) {
          e.preventDefault();
          st.setCreateOpen(false);
          return;
        }
        if (st.selectedTaskId) return;
        if (st.selectedTaskIds.length > 0) {
          e.preventDefault();
          st.clearSelection();
          return;
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        st.setCommandOpen(!st.commandOpen);
        return;
      }

      if (st.commandOpen) return;

      const target = e.target as HTMLElement;
      const inField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if (!inField) {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          e.preventDefault();
          st.setShortcutsOpen(true);
          return;
        }
        if (
          (e.key === 'b' || e.key === 'B') &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey
        ) {
          const vm = st.viewMode;
          if (vm === 'board' || vm === 'list') {
            e.preventDefault();
            st.setSelectionMode(!st.selectionMode);
          }
          return;
        }
        if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey) {
          st.setCreateOpen(true);
          return;
        }
        if (e.key === '1') {
          st.setViewMode('board');
          return;
        }
        if (e.key === '2') {
          st.setViewMode('list');
          return;
        }
        if (e.key === '3') {
          st.setViewMode('graph');
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function MainApp() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const qc = useQueryClient();
  const [agentKeyModal, setAgentKeyModal] = useState<string | null>(null);

  useTaskEventsStream(true);

  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const selectTask = useUiStore((s) => s.selectTask);
  const createOpen = useUiStore((s) => s.createOpen);
  const setCreateOpen = useUiStore((s) => s.setCreateOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const selectionMode = useUiStore((s) => s.selectionMode);
  const setSelectionMode = useUiStore((s) => s.setSelectionMode);

  const create = useCreateTask();
  const [newTitle, setNewTitle] = useState('');

  return (
    <div className="flex min-h-screen">
      <aside className="flex min-h-screen w-60 shrink-0 flex-col gap-2 bg-surface-base px-3 py-4">
        <div className="flex items-start gap-2.5 px-2">
          <AppLogo className="h-9 w-9" />
          <div className="min-w-0">
            <p className="text-xl font-semibold tracking-tight text-fg">
              {t('app.brand')}
            </p>
            <p className="text-xs leading-5 text-fg-subtle">{t('app.tagline')}</p>
          </div>
        </div>
        <nav className="mt-4 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              viewMode === 'board'
                ? 'bg-surface-active text-fg'
                : 'text-fg-secondary hover:bg-surface-hover'
            }`}
          >
            <LayoutGrid className="h-5 w-5 text-fg-subtle" />
            {t('nav.board')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              viewMode === 'list'
                ? 'bg-surface-active text-fg'
                : 'text-fg-secondary hover:bg-surface-hover'
            }`}
          >
            <List className="h-5 w-5 text-fg-subtle" />
            {t('nav.list')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('graph')}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              viewMode === 'graph'
                ? 'bg-surface-active text-fg'
                : 'text-fg-secondary hover:bg-surface-hover'
            }`}
          >
            <GitBranch className="h-5 w-5 text-fg-subtle" />
            {t('nav.graph')}
          </button>
        </nav>

        {user && (
          <SidebarProfileMenu
            user={user}
            onLogout={() => clearSession()}
            onNewAgent={() => {
              void (async () => {
                const name = await useDialogStore.getState().prompt({
                  title: t('auth.newAgent'),
                  placeholder: t('auth.agentNamePlaceholder'),
                  defaultValue: '',
                  confirmLabel: t('actions.create'),
                });
                if (!name?.trim()) return;
                try {
                  const out = await api.createAgent({ name: name.trim() });
                  setAgentKeyModal(out.apiKey);
                  void qc.invalidateQueries({ queryKey: workspaceKeys.actors });
                } catch (e) {
                  await useDialogStore.getState().alert({
                    message:
                      e instanceof Error ? e.message : t('auth.error'),
                  });
                }
              })();
            }}
            onOpenAllSettings={() => setCommandOpen(true)}
          />
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-surface-panel">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge-subtle px-6 py-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-fg">
              {t('app.tasksTitle')}
            </h1>
            <p className="text-sm leading-relaxed text-fg-secondary">
              {t('app.headerHint')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(viewMode === 'board' || viewMode === 'list') && (
              <button
                type="button"
                onClick={() => setSelectionMode(!selectionMode)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${
                  selectionMode
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-edge bg-surface-panel text-fg hover:bg-surface-hover'
                }`}
              >
                <CheckSquare className="h-4 w-4" />
                {selectionMode ? t('actions.selecting') : t('actions.select')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
            >
              <Plus className="h-4 w-4" />
              {t('actions.newTask')}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-6 py-4">
          {viewMode === 'board' ? (
            <BoardView onOpenTask={(id) => selectTask(id)} />
          ) : viewMode === 'list' ? (
            <ListView onOpenTask={(id) => selectTask(id)} />
          ) : (
            <TaskGraphView onOpenTask={(id) => selectTask(id)} />
          )}
        </div>
      </main>

      <CommandPalette />
      <ShortcutsHelp />
      <DialogHost />
      <BulkActionsBar />

      {createOpen && (
        <>
          <button
            type="button"
            aria-label={t('createModal.closeAria')}
            className="fixed inset-0 z-40 bg-[var(--overlay-scrim)]"
            onClick={() => setCreateOpen(false)}
          />
          <div className="fixed left-1/2 top-24 z-50 w-full max-w-md -translate-x-1/2 rounded-xl border border-edge bg-surface-panel p-4 shadow-elevated">
            <h2 className="text-base font-semibold text-fg">
              {t('createModal.title')}
            </h2>
            <input
              autoFocus
              className="mt-3 w-full rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm leading-6 text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              placeholder={t('createModal.titlePlaceholder')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const t = newTitle.trim();
                  if (!t) return;
                  create.mutate(
                    { title: t },
                    {
                      onSuccess: () => {
                        setNewTitle('');
                        setCreateOpen(false);
                      },
                    },
                  );
                }
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                onClick={() => setCreateOpen(false)}
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                onClick={() => {
                  const t = newTitle.trim();
                  if (!t) return;
                  create.mutate(
                    { title: t },
                    {
                      onSuccess: () => {
                        setNewTitle('');
                        setCreateOpen(false);
                      },
                    },
                  );
                }}
              >
                {t('actions.create')}
              </button>
            </div>
          </div>
        </>
      )}

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => selectTask(null)}
        />
      )}

      {agentKeyModal && (
        <>
          <button
            type="button"
            aria-label={t('auth.close')}
            className="fixed inset-0 z-[72] bg-[var(--overlay-scrim)]"
            onClick={() => setAgentKeyModal(null)}
          />
          <div className="fixed left-1/2 top-24 z-[73] w-full max-w-lg -translate-x-1/2 rounded-xl border border-edge bg-surface-panel p-4 shadow-elevated">
            <p className="text-sm text-fg-secondary">{t('auth.agentCreated')}</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-base p-3 text-xs text-fg">
              {agentKeyModal}
            </pre>
            <button
              type="button"
              className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              onClick={() => setAgentKeyModal(null)}
            >
              {t('auth.close')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  const { t } = useTranslation();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  const meQuery = useQuery({
    queryKey: ['auth', 'me', token],
    queryFn: () => api.me(),
    enabled: hydrated && Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (meQuery.data) setUser(meQuery.data);
  }, [meQuery.data, setUser]);

  useEffect(() => {
    if (hydrated && token && !meQuery.isFetching && meQuery.isError) {
      clearSession();
    }
  }, [hydrated, token, meQuery.isFetching, meQuery.isError, clearSession]);

  useSyncThemeClass();
  useSyncTextSize();
  useGlobalShortcuts();

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base text-fg-secondary">
        <AppLogo className="h-12 w-12 opacity-90" />
        {t('auth.loading')}
      </div>
    );
  }

  if (!token) {
    return <LoginScreen />;
  }

  if (!user && meQuery.isFetching) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base text-fg-secondary">
        <AppLogo className="h-12 w-12 opacity-90" />
        {t('auth.loading')}
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <MainApp />;
}
