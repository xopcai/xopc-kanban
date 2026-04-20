import { useEffect, useMemo, useRef, useState } from 'react';
import { useTaskList } from '../../hooks/useTasks';
import { useUiStore, type ThemeMode } from '../../store/uiStore';
import type { ViewMode } from '../../types';

const THEME_LABEL: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export function CommandPalette() {
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
    run(() => useUiStore.getState().setViewMode(mode));

  return (
    <>
      <button
        type="button"
        aria-label="Close command palette"
        className="fixed inset-0 z-[60] bg-[var(--overlay-scrim)]"
        onClick={() => setOpen(false)}
      />
      <div
        className="fixed left-1/2 top-20 z-[70] w-full max-w-lg -translate-x-1/2 rounded-xl border border-edge bg-surface-panel shadow-elevated"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="border-b border-edge-subtle p-3">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks or choose an action…"
            className="w-full rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-2 py-2">
          {filtered.length > 0 && (
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              Tasks
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="flex w-full flex-col rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={() =>
                    run(() => useUiStore.getState().selectTask(t.id))
                  }
                >
                  <span className="font-medium leading-6 text-fg">
                    {t.title}
                  </span>
                  <span className="text-xs leading-5 text-fg-subtle">
                    {t.identifier} · {t.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-3 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Navigate
          </p>
          <ul className="flex flex-col gap-0.5">
            <li>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium leading-6 text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => goView('board')}
              >
                Board view
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium leading-6 text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => goView('list')}
              >
                List view
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium leading-6 text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => goView('graph')}
              >
                Graph view
              </button>
            </li>
          </ul>

          <p className="mt-3 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Actions
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
                New task
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
                Theme: {THEME_LABEL[themeMode]} (cycle)
              </button>
            </li>
          </ul>
        </div>

        <footer className="border-t border-edge-subtle px-3 py-2 text-xs leading-5 text-fg-subtle">
          <kbd className="rounded border border-edge px-1">Esc</kbd> close ·{' '}
          <kbd className="rounded border border-edge px-1">⌘K</kbd> toggle
        </footer>
      </div>
    </>
  );
}
