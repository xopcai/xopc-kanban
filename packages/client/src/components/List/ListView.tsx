import clsx from 'clsx';
import type { Task } from '../../types';
import { useTaskList } from '../../hooks/useTasks';

export function ListView({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const { data: tasks = [], isLoading, isError, error } = useTaskList(true);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-edge-subtle bg-surface-panel p-8 text-sm text-fg-secondary">
        Loading tasks…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-edge-subtle bg-surface-panel p-8 text-sm text-red-600">
        {(error as Error).message}
      </div>
    );
  }

  const sorted = [...tasks].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );

  return (
    <div className="overflow-hidden rounded-xl border border-edge-subtle bg-surface-panel">
      <table className="w-full border-collapse text-left text-sm leading-6">
        <thead className="border-b border-edge-subtle bg-surface-base text-fg-secondary">
          <tr>
            <th className="px-4 py-2 font-medium">ID</th>
            <th className="px-4 py-2 font-medium">Title</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Priority</th>
            <th className="px-4 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <ListRow key={t.id} task={t} onOpen={onOpenTask} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListRow({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (id: string) => void;
}) {
  return (
    <tr
      className="cursor-pointer border-b border-edge-subtle transition-colors duration-150 ease-out hover:bg-surface-hover last:border-0"
      onClick={() => onOpen(task.id)}
    >
      <td className="px-4 py-2 font-mono text-xs text-fg-subtle">
        {task.identifier}
      </td>
      <td className="px-4 py-2 font-medium text-fg">{task.title}</td>
      <td className="px-4 py-2">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={clsx(
              'h-2 w-2 rounded-full',
              task.status === 'backlog' && 'bg-status-backlog',
              task.status === 'todo' && 'bg-status-todo',
              task.status === 'in_progress' && 'bg-status-in_progress',
              task.status === 'in_review' && 'bg-status-in_review',
              task.status === 'blocked' && 'bg-status-blocked',
              task.status === 'done' && 'bg-status-done',
              task.status === 'cancelled' && 'bg-status-cancelled',
            )}
          />
          <span className="text-fg-secondary">{task.status}</span>
        </span>
      </td>
      <td className="px-4 py-2 text-fg-secondary">{task.priority}</td>
      <td className="px-4 py-2 text-fg-subtle">
        {new Date(task.updatedAt).toLocaleString()}
      </td>
    </tr>
  );
}
