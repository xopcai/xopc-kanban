import clsx from 'clsx';
import { useMemo, useState } from 'react';
import type { Task, TaskPriority } from '../../types';
import {
  comparePriority,
  priorityLabel,
  STATUS_ORDER,
  statusLabel,
} from '../../lib/taskOrdering';
import { useTaskList } from '../../hooks/useTasks';

type GroupBy = 'none' | 'status' | 'priority';
type SortKey = 'updated_desc' | 'updated_asc' | 'priority' | 'id' | 'title';

function sortTasks(tasks: Task[], sort: SortKey): Task[] {
  const out = [...tasks];
  switch (sort) {
    case 'updated_desc':
      return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'updated_asc':
      return out.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    case 'priority':
      return out.sort(
        (a, b) =>
          comparePriority(a.priority, b.priority) ||
          a.identifier.localeCompare(b.identifier),
      );
    case 'id':
      return out.sort((a, b) => a.number - b.number);
    case 'title':
      return out.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return out;
  }
}

export function ListView({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const { data: tasks = [], isLoading, isError, error } = useTaskList(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [sortKey, setSortKey] = useState<SortKey>('updated_desc');

  const sections = useMemo(() => {
    const sorted = sortTasks(tasks, sortKey);
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'All tasks', tasks: sorted }];
    }
    if (groupBy === 'status') {
      return STATUS_ORDER.map((status) => ({
        key: status,
        label: statusLabel(status),
        tasks: sorted.filter((t) => t.status === status),
      })).filter((s) => s.tasks.length > 0);
    }
    const priorities: TaskPriority[] = [
      'urgent',
      'high',
      'medium',
      'low',
      'none',
    ];
    return priorities.map((p) => ({
      key: p,
      label: priorityLabel(p),
      tasks: sorted.filter((t) => t.priority === p),
    })).filter((s) => s.tasks.length > 0);
  }, [tasks, groupBy, sortKey]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-edge-subtle bg-surface-panel p-8 text-sm text-fg-secondary">
        Loading tasks…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-edge-subtle bg-surface-panel p-8 text-sm text-danger">
        {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium leading-6 text-fg">
          <span className="text-fg-secondary">Group</span>
          <select
            className="rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          >
            <option value="none">None</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium leading-6 text-fg">
          <span className="text-fg-secondary">Sort</span>
          <select
            className="rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="updated_desc">Updated (newest)</option>
            <option value="updated_asc">Updated (oldest)</option>
            <option value="priority">Priority</option>
            <option value="id">ID (#)</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>

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
          {sections.map((section) => (
            <tbody key={section.key}>
              {groupBy !== 'none' && (
                <tr className="bg-surface-hover/80">
                  <td
                    colSpan={5}
                    className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-fg-secondary"
                  >
                    {section.label}
                    <span className="ml-2 font-normal text-fg-subtle">
                      ({section.tasks.length})
                    </span>
                  </td>
                </tr>
              )}
              {section.tasks.map((t) => (
                <ListRow key={t.id} task={t} onOpen={onOpenTask} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
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
