import { LayoutGrid, List, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BoardView } from './components/Board/BoardView';
import { ListView } from './components/List/ListView';
import { TaskDetailPanel } from './components/TaskDetail/TaskDetailPanel';
import { useCreateTask } from './hooks/useTasks';
import { useTaskEventsStream } from './hooks/useSSE';
import { useUiStore } from './store/uiStore';

export default function App() {
  useTaskEventsStream(true);

  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const selectTask = useUiStore((s) => s.selectTask);
  const createOpen = useUiStore((s) => s.createOpen);
  const setCreateOpen = useUiStore((s) => s.setCreateOpen);

  const create = useCreateTask();
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'c' || e.key === 'C') {
        setCreateOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCreateOpen]);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col gap-2 bg-surface-base px-3 py-4">
        <div className="px-2">
          <p className="text-xl font-semibold tracking-tight text-fg">XOPC</p>
          <p className="text-xs leading-5 text-fg-subtle">Task-native kanban</p>
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
            Board
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
            List
          </button>
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-surface-panel">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge-subtle px-6 py-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-fg">
              Tasks
            </h1>
            <p className="text-sm leading-relaxed text-fg-secondary">
              Drag cards to change status. Press <kbd className="rounded border border-edge px-1">C</kbd> to create.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
          >
            <Plus className="h-4 w-4" />
            New task
          </button>
        </header>

        <div className="flex-1 overflow-auto px-6 py-4">
          {viewMode === 'board' ? (
            <BoardView onOpenTask={(id) => selectTask(id)} />
          ) : (
            <ListView onOpenTask={(id) => selectTask(id)} />
          )}
        </div>
      </main>

      {createOpen && (
        <>
          <button
            type="button"
            aria-label="Close create"
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setCreateOpen(false)}
          />
          <div className="fixed left-1/2 top-24 z-50 w-full max-w-md -translate-x-1/2 rounded-xl border border-edge bg-surface-panel p-4 shadow-elevated">
            <h2 className="text-base font-semibold text-fg">New task</h2>
            <input
              autoFocus
              className="mt-3 w-full rounded-xl border border-edge px-3 py-2 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              placeholder="Title"
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
                Cancel
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
                Create
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
    </div>
  );
}
