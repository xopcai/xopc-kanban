import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  useAddDependency,
  useAddMemory,
  useDeleteTask,
  usePatchTask,
  useRemoveDependency,
  useSetTaskStatus,
  useTaskDependencies,
  useTaskDetail,
  useTaskList,
  useTaskMemory,
} from '../../hooks/useTasks';
import type { TaskStatus } from '../../types';
import { MemoryTimeline } from './MemoryTimeline';

const statuses: TaskStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
  'cancelled',
];

export function TaskDetailPanel({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose: () => void;
}) {
  const { data: task, isLoading } = useTaskDetail(taskId);
  const { data: memory = [] } = useTaskMemory(taskId);
  const patch = usePatchTask(taskId);
  const setStatus = useSetTaskStatus();
  const addMem = useAddMemory(taskId);
  const delTask = useDeleteTask();
  const { data: deps = [] } = useTaskDependencies(taskId);
  const { data: allTasks = [] } = useTaskList(false);
  const addDep = useAddDependency(taskId);
  const removeDep = useRemoveDependency(taskId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [dependsOnPick, setDependsOnPick] = useState('');

  const taskLabel = (id: string) =>
    allTasks.find((x) => x.id === id)?.identifier ?? id.slice(0, 8);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
    }
  }, [task]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveFields = () => {
    if (!task) return;
    if (title.trim() && title !== task.title) {
      patch.mutate({ title: title.trim() });
    }
    const desc = description.trim() || null;
    if (desc !== task.description) {
      patch.mutate({ description: desc });
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close detail"
        className="fixed inset-0 z-40 bg-black/20 transition-opacity duration-150 ease-out"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-edge-subtle bg-surface-panel shadow-elevated"
        style={{
          transform: 'translateX(0)',
          transition: 'transform 300ms ease-out',
        }}
      >
        <header className="flex items-center justify-between border-b border-edge-subtle px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs leading-5 text-fg-subtle">
              {isLoading ? '…' : task?.identifier}
            </p>
            <h2 className="text-base font-semibold leading-6 text-fg truncate">
              Task detail
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-fg-subtle transition-colors duration-150 hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isLoading || !task ? (
            <p className="text-sm text-fg-secondary">Loading…</p>
          ) : (
            <div className="flex flex-col gap-5">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium leading-6 text-fg">Title</span>
                <input
                  className="rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveFields}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium leading-6 text-fg">
                  Description
                </span>
                <textarea
                  rows={4}
                  className="resize-y rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={saveFields}
                  placeholder="Markdown supported later"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium leading-6 text-fg">Status</span>
                <select
                  className="rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={task.status}
                  onChange={(e) => {
                    const s = e.target.value as TaskStatus;
                    setStatus.mutate(
                      { id: task.id, status: s },
                      {
                        onError: () => {
                          /* revert handled by invalidate */
                        },
                      },
                    );
                  }}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              {task.children.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold leading-6 text-fg">
                    Subtasks
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {task.children.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-lg border border-edge-subtle px-2 py-1.5 text-sm text-fg-secondary"
                      >
                        {c.identifier} · {c.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold leading-6 text-fg">
                  Dependencies
                </h3>
                <p className="mt-1 text-xs leading-5 text-fg-subtle">
                  This task depends on prerequisites. Removing an edge updates the graph for everyone.
                </p>
                <ul className="mt-2 space-y-2">
                  {deps.length === 0 && (
                    <li className="text-sm text-fg-secondary">No linked edges.</li>
                  )}
                  {deps.map((e) => {
                    if (e.taskId === task.id) {
                      return (
                        <li
                          key={e.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-edge-subtle px-2 py-1.5 text-sm text-fg-secondary"
                        >
                          <span>
                            Depends on{' '}
                            <span className="font-medium text-fg">
                              {taskLabel(e.dependsOnId)}
                            </span>{' '}
                            <span className="text-fg-subtle">({e.type})</span>
                          </span>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            onClick={() => removeDep.mutate(e.id)}
                          >
                            Remove
                          </button>
                        </li>
                      );
                    }
                    return (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-edge-subtle px-2 py-1.5 text-sm text-fg-secondary"
                      >
                        <span>
                          Required by{' '}
                          <span className="font-medium text-fg">
                            {taskLabel(e.taskId)}
                          </span>{' '}
                          <span className="text-fg-subtle">({e.type})</span>
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          onClick={() => removeDep.mutate(e.id)}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    className="min-w-0 flex-1 rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    value={dependsOnPick}
                    onChange={(e) => setDependsOnPick(e.target.value)}
                  >
                    <option value="">Select prerequisite…</option>
                    {allTasks
                      .filter((x) => x.id !== task.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.identifier} — {x.title}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-xl border border-edge bg-surface-panel px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                    onClick={() => {
                      if (!dependsOnPick) return;
                      addDep.mutate(
                        { dependsOnId: dependsOnPick },
                        {
                          onSuccess: () => setDependsOnPick(''),
                          onError: (err) => {
                            window.alert(
                              err instanceof Error ? err.message : 'Failed to add',
                            );
                          },
                        },
                      );
                    }}
                  >
                    Link prerequisite
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold leading-6 text-fg">
                  Activity
                </h3>
                <div className="mt-2">
                  <MemoryTimeline items={memory} />
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <textarea
                    rows={3}
                    className="resize-y rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    placeholder="Add a note…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="self-start rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                    onClick={() => {
                      const t = note.trim();
                      if (!t) return;
                      addMem.mutate(t, {
                        onSuccess: () => setNote(''),
                      });
                    }}
                  >
                    Add note
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-edge-subtle pt-4">
                <button
                  type="button"
                  className="rounded-xl border border-edge bg-surface-panel px-4 py-2 text-sm font-medium text-fg transition-colors duration-150 hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                  onClick={() => {
                    if (!confirm('Delete this task?')) return;
                    delTask.mutate(task.id, {
                      onSuccess: () => onClose(),
                    });
                  }}
                >
                  Delete task
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
