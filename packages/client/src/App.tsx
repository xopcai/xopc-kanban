import {
  CheckSquare,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  List,
  Plus,
  Shield,
  Users,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavigateFunction } from 'react-router-dom';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { api } from './api/client';
import { AdminAccountsPage } from './components/Admin/AdminAccountsPage';
import { LoginScreen } from './components/Auth/LoginScreen';
import { BoardView } from './components/Board/BoardView';
import { TaskFilterBar } from './components/Filters/TaskFilterBar';
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
import { useSidebarResize } from './hooks/useSidebarResize';
import { useCreateTask, useProjectsList, workspaceKeys } from './hooks/useTasks';
import { useTaskEventsStream } from './hooks/useSSE';
import { isWritableAuthUser } from './lib/authPermissions';
import {
  PROJECTS_HOME_PATH,
  isWorkspaceView,
  projectWorkspacePath,
} from './lib/workspaceRoutes';
import { useAuthStore } from './store/authStore';
import { useDialogStore } from './store/dialogStore';
import { useUiStore } from './store/uiStore';
import type { ViewMode } from './types';

/** Current route project, or last opened task workspace (e.g. user is on /projects). */
function resolveProjectIdForTaskNav(): string | null {
  const st = useUiStore.getState();
  return st.currentProjectId ?? st.getLastWorkspaceProjectId();
}

/** Maps UI text size to root `font-size` so Tailwind `rem`-based UI scales together. */
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

function useGlobalShortcuts(navigate: NavigateFunction, canWrite: boolean) {
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
          if (!canWrite) return;
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
          if (!canWrite) return;
          if (st.workspaceScreen !== 'tasks' || !st.currentProjectId) {
            return;
          }
          st.setCreateOpen(true);
          return;
        }
        if (e.key === '1') {
          const pid = resolveProjectIdForTaskNav();
          if (!pid) return;
          e.preventDefault();
          navigate(projectWorkspacePath(pid, 'board'));
          return;
        }
        if (e.key === '2') {
          const pid = resolveProjectIdForTaskNav();
          if (!pid) return;
          e.preventDefault();
          navigate(projectWorkspacePath(pid, 'list'));
          return;
        }
        if (e.key === '3') {
          const pid = resolveProjectIdForTaskNav();
          if (!pid) return;
          e.preventDefault();
          navigate(projectWorkspacePath(pid, 'graph'));
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, canWrite]);
}

function ProjectIndexRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return <Navigate to={PROJECTS_HOME_PATH} replace />;
  return <Navigate to={projectWorkspacePath(projectId, 'board')} replace />;
}

function ProjectsHomePage() {
  useLayoutEffect(() => {
    useUiStore.getState().setWorkspaceScreen('projects');
    useUiStore.getState().setCurrentProjectId(null);
    useUiStore.getState().selectTask(null);
  }, []);

  return (
    <main className="flex-1 overflow-auto px-4 pb-10 pt-6 sm:px-6">
      <ProjectHomeGrid />
    </main>
  );
}

function ProjectWorkspacePage() {
  const { t } = useTranslation();
  const { projectId, view } = useParams<{
    projectId: string;
    view: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const canWrite = isWritableAuthUser(user);
  const selectTask = useUiStore((s) => s.selectTask);
  const setSelectionMode = useUiStore((s) => s.setSelectionMode);
  const selectionMode = useUiStore((s) => s.selectionMode);
  const setCreateOpen = useUiStore((s) => s.setCreateOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const projectsQuery = useProjectsList();

  useLayoutEffect(() => {
    if (!projectId || !isWorkspaceView(view)) return;
    useUiStore.getState().setCurrentProjectId(projectId);
    useUiStore.getState().rememberWorkspaceProject(projectId);
    useUiStore.getState().setWorkspaceScreen('tasks');
    useUiStore.getState().setViewMode(view);
  }, [projectId, view]);

  useEffect(() => {
    if (!projectId || !isWorkspaceView(view)) return;
    const tid = searchParams.get('task');
    selectTask(tid && tid.length > 0 ? tid : null);
  }, [searchParams, selectTask, projectId, view]);

  if (!projectId) {
    return <Navigate to={PROJECTS_HOME_PATH} replace />;
  }
  if (!isWorkspaceView(view)) {
    return <Navigate to={projectWorkspacePath(projectId, 'board')} replace />;
  }
  const vm: ViewMode = view;

  const onOpenTask = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('task', id);
    setSearchParams(next, { replace: false });
  };

  const goView = (mode: ViewMode) => {
    navigate({
      pathname: projectWorkspacePath(projectId, mode),
      search: location.search,
      hash: location.hash,
    });
  };

  const taskMain =
    projectsQuery.isLoading && projectsQuery.data === undefined ? (
      <p className="text-sm text-fg-secondary">{t('loading.generic')}</p>
    ) : vm === 'board' ? (
      <BoardView onOpenTask={onOpenTask} />
    ) : vm === 'list' ? (
      <ListView onOpenTask={onOpenTask} />
    ) : (
      <TaskGraphView onOpenTask={onOpenTask} />
    );

  return (
    <>
      <header className="shrink-0 border-b border-edge-subtle bg-surface-panel">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <ProjectHeaderBar />
          </div>
          <ProjectHeaderRightRail
            projectId={projectId}
            onOpenCommandPalette={() => setCommandOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-edge-subtle px-4 py-2 sm:px-6">
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
                  onClick={() => goView(mode)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    vm === mode
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
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2">
            {(vm === 'board' || vm === 'list') && <TaskFilterBar embedded />}
            {(vm === 'board' || vm === 'list') && canWrite && (
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
                {selectionMode ? t('actions.selecting') : t('actions.select')}
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent enabled:active:scale-95"
              >
                <Plus className="h-4 w-4" />
                {t('actions.newTask')}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">{taskMain}</div>
    </>
  );
}

function MainApp() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [agentKeyModal, setAgentKeyModal] = useState<string | null>(null);
  const canWrite = isWritableAuthUser(user);

  const viewMode = useUiStore((s) => s.viewMode);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const selectTask = useUiStore((s) => s.selectTask);
  const createOpen = useUiStore((s) => s.createOpen);
  const setCreateOpen = useUiStore((s) => s.setCreateOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const workspaceScreen = useUiStore((s) => s.workspaceScreen);
  const currentProjectId = useUiStore((s) => s.currentProjectId);

  /** Admin pages reuse `workspaceScreen` from the previous route; exclude them from task/project nav highlights. */
  const onAdminRoute = location.pathname.startsWith('/admin');

  const { widthPx: sidebarWidthPx, onResizePointerDown } = useSidebarResize();

  const projectsQuery = useProjectsList();

  useGlobalShortcuts(navigate, canWrite);

  useEffect(() => {
    const m = /^\/projects\/([^/]+)\/(board|list|graph)$/.exec(
      location.pathname,
    );
    if (!m || !projectsQuery.data) return;
    const pid = m[1]!;
    const allowed = projectsQuery.data.filter((p) => p.status !== 'cancelled');
    if (!allowed.some((p) => p.id === pid)) {
      useUiStore.getState().clearLastWorkspaceProjectIfMatch(pid);
      navigate(PROJECTS_HOME_PATH, { replace: true });
    }
  }, [location.pathname, projectsQuery.data, navigate]);

  useTaskEventsStream(
    workspaceScreen === 'tasks' && Boolean(currentProjectId),
  );

  const closeTaskDetail = () => {
    const next = new URLSearchParams(location.search);
    if (next.has('task')) {
      next.delete('task');
      const q = next.toString();
      navigate(
        { pathname: location.pathname, search: q ? `?${q}` : '' },
        { replace: true },
      );
    } else {
      selectTask(null);
    }
  };

  const create = useCreateTask();
  const [newTitle, setNewTitle] = useState('');

  const profileMenu =
    user && (
      <SidebarProfileMenu
        user={user}
        onOpenAdminAccounts={
          user.typ === 'member' ? () => navigate('/admin/accounts') : undefined
        }
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
    <aside
      className="fixed left-0 top-0 z-[35] flex h-screen flex-col gap-2 overflow-visible border-r border-edge-subtle bg-surface-base px-3 py-4"
      style={{ width: sidebarWidthPx }}
    >
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
          onClick={() => navigate(PROJECTS_HOME_PATH)}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            workspaceScreen === 'projects' && !onAdminRoute
              ? 'bg-surface-active text-fg'
              : 'text-fg-secondary hover:bg-surface-hover'
          }`}
        >
          <FolderKanban className="h-5 w-5 text-fg-subtle" />
          {t('nav.projects')}
        </button>
        {user && user.typ === 'member' && (
          <button
            type="button"
            onClick={() => navigate('/admin/accounts')}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              onAdminRoute
                ? 'bg-surface-active text-fg'
                : 'text-fg-secondary hover:bg-surface-hover'
            }`}
          >
            {user.accountRole === 'admin' ? (
              <Shield className="h-5 w-5 text-fg-subtle" />
            ) : (
              <Users className="h-5 w-5 text-fg-subtle" />
            )}
            {t('admin.navLink')}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const id = resolveProjectIdForTaskNav();
            if (id) navigate(projectWorkspacePath(id, 'board'));
            else navigate(PROJECTS_HOME_PATH);
          }}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            workspaceScreen === 'tasks' && viewMode === 'board' && !onAdminRoute
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
            const id = resolveProjectIdForTaskNav();
            if (id) navigate(projectWorkspacePath(id, 'list'));
            else navigate(PROJECTS_HOME_PATH);
          }}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            workspaceScreen === 'tasks' && viewMode === 'list' && !onAdminRoute
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
            const id = resolveProjectIdForTaskNav();
            if (id) navigate(projectWorkspacePath(id, 'graph'));
            else navigate(PROJECTS_HOME_PATH);
          }}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            workspaceScreen === 'tasks' && viewMode === 'graph' && !onAdminRoute
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
      <button
        type="button"
        aria-label={t('nav.resizeSidebar')}
        onPointerDown={onResizePointerDown}
        className="absolute inset-y-0 right-0 z-[40] w-3 translate-x-1/2 cursor-col-resize border-0 bg-transparent p-0 touch-none hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
      />
    </aside>
  );

  const overlays = (
    <>
      <CommandPalette />
      <ShortcutsHelp />
      <DialogHost />
      <BulkActionsBar />

      {createOpen && canWrite && (
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
        <TaskDetailPanel taskId={selectedTaskId} onClose={closeTaskDetail} />
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

  return (
    <>
      <div className="flex min-h-screen">
        {fixedSidebar}
        <div
          className="relative z-0 flex min-h-screen min-w-0 flex-1 flex-col bg-surface-panel"
          style={{ paddingLeft: sidebarWidthPx }}
        >
          <Routes>
            <Route
              path="/"
              element={<Navigate to={PROJECTS_HOME_PATH} replace />}
            />
            <Route path="/projects" element={<ProjectsHomePage />} />
            <Route path="/admin/accounts" element={<AdminAccountsPage />} />
            <Route path="/projects/:projectId" element={<ProjectIndexRedirect />} />
            <Route
              path="/projects/:projectId/:view"
              element={<ProjectWorkspacePage />}
            />
            <Route
              path="*"
              element={<Navigate to={PROJECTS_HOME_PATH} replace />}
            />
          </Routes>
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
