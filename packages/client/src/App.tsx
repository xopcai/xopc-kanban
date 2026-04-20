import {
  CheckSquare,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  List,
  Plus,
} from 'lucide-react';
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
import { ProjectHomeGrid } from './components/Projects/ProjectHomeGrid';
import { ProjectHeaderBar } from './components/Projects/ProjectHeaderBar';
import { ProjectHeaderRightRail } from './components/Projects/ProjectHeaderRightRail';
import { useCreateTask, useProjectsList, workspaceKeys } from './hooks/useTasks';
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
          if (st.workspaceScreen !== 'tasks') {
            return;
          }
          const vm = st.viewMode;
          if (vm === 'board' || vm === 'list') {
            e.preventDefault();
            st.setSelectionMode(!st.selectionMode);
          }
          return;
        }
        if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey) {
          if (st.workspaceScreen !== 'tasks' || !st.currentProjectId) {
            return;
          }
          st.setCreateOpen(true);
          return;
        }
        if (e.key === '1') {
          if (st.workspaceScreen !== 'tasks') {
            return;
          }
          st.setViewMode('board');
          return;
        }
        if (e.key === '2') {
          if (st.workspaceScreen !== 'tasks') {
            return;
          }
          st.setViewMode('list');
          return;
        }
        if (e.key === '3') {
          if (st.workspaceScreen !== 'tasks') {
            return;
          }
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

  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const selectTask = useUiStore((s) => s.selectTask);
  const createOpen = useUiStore((s) => s.createOpen);
  const setCreateOpen = useUiStore((s) => s.setCreateOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const selectionMode = useUiStore((s) => s.selectionMode);
  const setSelectionMode = useUiStore((s) => s.setSelectionMode);
  const workspaceScreen = useUiStore((s) => s.workspaceScreen);
  const setWorkspaceScreen = useUiStore((s) => s.setWorkspaceScreen);
  const currentProjectId = useUiStore((s) => s.currentProjectId);
  const setCurrentProjectId = useUiStore((s) => s.setCurrentProjectId);

  const projectsQuery = useProjectsList();

  useTaskEventsStream(
    workspaceScreen === 'tasks' && Boolean(currentProjectId),
  );

  useEffect(() => {
    const raw = projectsQuery.data;
    if (!raw) return;
    const list = raw.filter((p) => p.status !== 'cancelled');
    const cur = useUiStore.getState().currentProjectId;
    if (list.length === 0) {
      if (cur) useUiStore.getState().setCurrentProjectId(null);
      return;
    }
    if (cur && !list.some((p) => p.id === cur)) {
      useUiStore.getState().setCurrentProjectId(null);
      useUiStore.getState().setWorkspaceScreen('projects');
    }
  }, [projectsQuery.data]);

  useEffect(() => {
    if (workspaceScreen !== 'tasks') return;
    if (projectsQuery.isLoading) return;
    if (!currentProjectId) {
      setWorkspaceScreen('projects');
    }
  }, [
    workspaceScreen,
    currentProjectId,
    projectsQuery.isLoading,
    setWorkspaceScreen,
  ]);

  const openProject = (id: string) => {
    setCurrentProjectId(id);
    setWorkspaceScreen('tasks');
  };

  const create = useCreateTask();
  const [newTitle, setNewTitle] = useState('');

  const profileMenu =
    user && (
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
                message: e instanceof Error ? e.message : t('auth.error'),
              });
            }
          })();
        }}
        onOpenAllSettings={() => setCommandOpen(true)}
      />
    );

  const fixedSidebar = (
    <aside className="fixed left-0 top-0 z-[35] flex h-screen w-60 flex-col gap-2 overflow-visible border-r border-edge-subtle bg-surface-base px-3 py-4">
      <div className="flex shrink-0 items-start gap-2.5 px-2">
        <AppLogo className="h-9 w-9 shrink-0" />
        <div className="min-w-0">
          <p className="text-xl font-semibold tracking-tight text-fg">
            {t('app.brand')}
          </p>
          <p className="text-xs leading-5 text-fg-subtle">{t('app.tagline')}</p>
        </div>
      </div>
      <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-visible">
        <button
          type="button"
          onClick={() => setWorkspaceScreen('projects')}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            workspaceScreen === 'projects'
              ? 'bg-surface-active text-fg'
              : 'text-fg-secondary hover:bg-surface-hover'
          }`}
        >
          <FolderKanban className="h-5 w-5 text-fg-subtle" />
          {t('nav.projects')}
        </button>
        <button
          type="button"
          onClick={() => {
            setWorkspaceScreen('tasks');
            setViewMode('board');
          }}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            workspaceScreen === 'tasks' && viewMode === 'board'
              ? 'bg-surface-active text-fg'
              : 'text-fg-secondary hover:bg-surface-hover'
          }`}
        >
          <LayoutGrid className="h-5 w-5 text-fg-subtle" />
          {t('nav.board')}
        </button>
        <button
          type="button"
          onClick={() => {
            setWorkspaceScreen('tasks');
            setViewMode('list');
          }}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            workspaceScreen === 'tasks' && viewMode === 'list'
              ? 'bg-surface-active text-fg'
              : 'text-fg-secondary hover:bg-surface-hover'
          }`}
        >
          <List className="h-5 w-5 text-fg-subtle" />
          {t('nav.list')}
        </button>
        <button
          type="button"
          onClick={() => {
            setWorkspaceScreen('tasks');
            setViewMode('graph');
          }}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            workspaceScreen === 'tasks' && viewMode === 'graph'
              ? 'bg-surface-active text-fg'
              : 'text-fg-secondary hover:bg-surface-hover'
          }`}
        >
          <GitBranch className="h-5 w-5 text-fg-subtle" />
          {t('nav.graph')}
        </button>
      </nav>
      {profileMenu && (
        <div className="relative shrink-0 border-t border-edge-subtle pt-3">
          {profileMenu}
        </div>
      )}
    </aside>
  );

  const overlays = (
    <>
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
                  const title = newTitle.trim();
                  if (!title || !currentProjectId) return;
                  create.mutate(
                    { title, projectId: currentProjectId },
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
                  const title = newTitle.trim();
                  if (!title || !currentProjectId) return;
                  create.mutate(
                    { title, projectId: currentProjectId },
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
    </>
  );

  const taskMain =
    projectsQuery.isLoading && projectsQuery.data === undefined ? (
      <p className="text-sm text-fg-secondary">{t('loading.generic')}</p>
    ) : !currentProjectId ? (
      <p className="text-sm text-fg-secondary">{t('loading.generic')}</p>
    ) : viewMode === 'board' ? (
      <BoardView onOpenTask={(id) => selectTask(id)} />
    ) : viewMode === 'list' ? (
      <ListView onOpenTask={(id) => selectTask(id)} />
    ) : (
      <TaskGraphView onOpenTask={(id) => selectTask(id)} />
    );

  return (
    <>
      <div className="flex min-h-screen">
        {fixedSidebar}
        <div className="relative z-0 flex min-h-screen min-w-0 flex-1 flex-col bg-surface-panel pl-60">
          {workspaceScreen === 'projects' ? (
            <main className="flex-1 overflow-auto px-4 pb-10 pt-6 sm:px-6">
              <ProjectHomeGrid onOpenProject={openProject} />
            </main>
          ) : (
            <>
              <header className="shrink-0 border-b border-edge-subtle bg-surface-panel">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <ProjectHeaderBar />
                  </div>
                  {currentProjectId && (
                    <ProjectHeaderRightRail
                      projectId={currentProjectId}
                      onOpenCommandPalette={() => setCommandOpen(true)}
                      onOpenShortcuts={() => setShortcutsOpen(true)}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge-subtle px-4 py-2 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                      {t('projectWorkspace.viewLabel')}
                    </span>
                    <div className="flex rounded-xl border border-edge-subtle p-0.5">
                      {(
                        [
                          ['board', LayoutGrid, t('nav.board')] as const,
                          ['list', List, t('nav.list')] as const,
                          ['graph', GitBranch, t('nav.graph')] as const,
                        ]
                      ).map(([mode, Icon, label]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setViewMode(mode)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                            viewMode === mode
                              ? 'bg-surface-active text-fg'
                              : 'text-fg-secondary hover:bg-surface-hover'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(viewMode === 'board' || viewMode === 'list') && (
                      <button
                        type="button"
                        onClick={() => setSelectionMode(!selectionMode)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${
                          selectionMode
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-edge bg-surface-panel text-fg hover:bg-surface-hover'
                        }`}
                      >
                        <CheckSquare className="h-4 w-4" />
                        {selectionMode
                          ? t('actions.selecting')
                          : t('actions.select')}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!currentProjectId}
                      title={
                        !currentProjectId
                          ? t('projects.needProject')
                          : undefined
                      }
                      onClick={() => setCreateOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      {t('actions.newTask')}
                    </button>
                    <p className="hidden text-xs text-fg-subtle xl:block">
                      {t('app.headerHint')}
                    </p>
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
                {taskMain}
              </div>
            </>
          )}
        </div>
      </div>
      {overlays}
    </>
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
