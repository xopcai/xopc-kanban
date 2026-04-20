import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTaskList } from '../../hooks/useTasks';
import { projectWorkspacePath } from '../../lib/workspaceRoutes';
import { useUiStore, type ThemeMode } from '../../store/uiStore';
import type { ViewMode } from '../../types';

export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const themeMode = useUiStore((s) => s.themeMode);

  const { data: tasks = [] } = useTaskList(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQ('');
      return;
    }
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, setOpen]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return tasks.slice(0, 8);
    return tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          t.identifier.toLowerCase().includes(s),
      )
      .slice(0, 12);
  }, [tasks, q]);

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  if (!open) return null;

  const goView = (mode: ViewMode) =>
    run(() => {
      const st = useUiStore.getState();
      const pid = st.currentProjectId ?? st.getLastWorkspaceProjectId();
      if (pid) {
        navigate({
          pathname: projectWorkspacePath(pid, mode),
          search: location.search,
          hash: location.hash,
        });
      } else {
        useUiStore.getState().setViewMode(mode);
      }
    });

  const openTask = (taskId: string) =>
    run(() => {
      const st = useUiStore.getState();
      const pid = st.currentProjectId ?? st.getLastWorkspaceProjectId();
      const vm = st.viewMode;
      if (pid) {
        const next = new URLSearchParams(location.search);
        next.set('task', taskId);
        navigate({
          pathname: projectWorkspacePath(pid, vm),
          search: `?${next.toString()}`,
        });
      } else {
        useUiStore.getState().selectTask(taskId);
      }
    });

  return (
    <>
      <button
        type="button"
        aria-label={t('command.closeAria')}
        className="fixed inset-0 z-[60] bg-[var(--overlay-scrim)]"
        onClick={() => setOpen(false)}
      />
      <div
        className="fixed left-1/2 top-20 z-[70] w-full max-w-lg -translate-x-1/2 rounded-xl border border-edge bg-surface-panel shadow-elevated"
        role="dialog"
        aria-modal="true"
        aria-label={t('command.ariaLabel')}
      >
        <div className="border-b border-edge-subtle p-3">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('command.searchPlaceholder')}
            className="w-full rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-2 py-2">
          {filtered.length > 0 && (
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              {t('command.sectionTasks')}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {filtered.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="flex w-full flex-col rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={() => openTask(task.id)}
                >
                  <span className="font-medium leading-6 text-fg">
                    {task.title}
                  </span>
                  <span className="text-xs leading-5 text-fg-subtle">
                    {task.identifier} · {task.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-3 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            {t('command.sectionNavigate')}
          </p>
          <ul className="flex flex-col gap-0.5">
            <li>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium leading-6 text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => goView('board')}
              >
                {t('command.boardView')}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium leading-6 text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => goView('list')}
              >
                {t('command.listView')}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium leading-6 text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => goView('graph')}
              >
                {t('command.graphView')}
              </button>
            </li>
          </ul>

          <p className="mt-3 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            {t('command.sectionActions')}
          </p>
          <ul className="flex flex-col gap-0.5">
            <li>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium leading-6 text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() =>
                  run(() => useUiStore.getState().setCreateOpen(true))
                }
              >
                {t('command.newTask')}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium leading-6 text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() =>
                  run(() => {
                    const { themeMode: cur, setThemeMode } =
                      useUiStore.getState();
                    const order: ThemeMode[] = ['system', 'light', 'dark'];
                    const i = order.indexOf(cur);
                    setThemeMode(order[(i + 1) % order.length]!);
                  })
                }
              >
                {t('command.themeCycle', {
                  mode: t(`theme.${themeMode}`),
                })}
              </button>
            </li>
          </ul>
        </div>

        <footer className="border-t border-edge-subtle px-3 py-2 text-xs leading-5 text-fg-subtle">
          {t('command.footer')}
        </footer>
      </div>
    </>
  );
}
