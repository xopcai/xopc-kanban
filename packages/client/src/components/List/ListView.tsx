import clsx from 'clsx';
import { useMemo, useState } from 'react';
import type { ListTasksParams } from '../../api/client';
import { TaskFilterBar } from '../Filters/TaskFilterBar';
import { useTaskList } from '../../hooks/useTasks';
import { WORKSPACE_MEMBERS } from '../../lib/members';
import {
  comparePriority,
  priorityLabel,
  STATUS_ORDER,
  statusLabel,
} from '../../lib/taskOrdering';
import { useUiStore } from '../../store/uiStore';
import type { Label, Task, TaskPriority } from '../../types';

type GroupBy = 'none' | 'status' | 'priority' | 'assignee' | 'label';
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

function assigneeGroupKey(task: Task): string {
  if (!task.assigneeId) return '__unassigned__';
  return `${task.assigneeType ?? 'member'}|${task.assigneeId}`;
}

function assigneeGroupLabel(key: string): string {
  if (key === '__unassigned__') return 'Unassigned';
  const [type, id] = key.split('|') as ['member' | 'agent', string];
  const m = WORKSPACE_MEMBERS.find((x) => x.id === id && x.type === type);
  return m?.name ?? id;
}

function primaryLabelGroup(task: Task): { key: string; label: string } {
  if (!task.labels.length) {
    return { key: '__none__', label: 'No label' };
  }
  const sorted = [...task.labels].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const first = sorted[0]!;
  return { key: first.id, label: first.name };
}

function labelOrderForSections(tasks: Task[], labelCatalog: Label[]) {
  const ids = new Set<string>();
  for (const t of tasks) {
    if (!t.labels.length) ids.add('__none__');
    else ids.add(primaryLabelGroup(t).key);
  }
  const ordered: { key: string; label: string }[] = [];
  for (const l of [...labelCatalog].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (ids.has(l.id)) ordered.push({ key: l.id, label: l.name });
  }
  if (ids.has('__none__')) {
    ordered.unshift({ key: '__none__', label: 'No label' });
  }
  return ordered;
}

export function ListView({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const taskFilters = useUiStore((s) => s.taskFilters);
  const selectionMode = useUiStore((s) => s.selectionMode);
  const selectedTaskIds = useUiStore((s) => s.selectedTaskIds);
  const toggleTaskSelected = useUiStore((s) => s.toggleTaskSelected);

  const listFilters = useMemo((): Omit<ListTasksParams, 'rootOnly'> => {
    const f: Omit<ListTasksParams, 'rootOnly'> = {};
    if (taskFilters.priority) f.priority = taskFilters.priority;
    if (taskFilters.assigneeId === '__none__') f.assigneeId = '__none__';
    else if (taskFilters.assigneeId) f.assigneeId = taskFilters.assigneeId;
    if (taskFilters.labelId) f.labelId = taskFilters.labelId;
    return f;
  }, [taskFilters]);

  const { data: tasks = [], isLoading, isError, error } = useTaskList(
    true,
    listFilters,
  );

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
    if (groupBy === 'priority') {
      const priorities: TaskPriority[] = [
        'urgent',
        'high',
        'medium',
        'low',
        'none',
      ];
      return priorities
        .map((p) => ({
          key: p,
          label: priorityLabel(p),
          tasks: sorted.filter((t) => t.priority === p),
        }))
        .filter((s) => s.tasks.length > 0);
    }
    if (groupBy === 'assignee') {
      const keys = new Set(sorted.map(assigneeGroupKey));
      const ordered = [...keys].sort((a, b) =>
        assigneeGroupLabel(a).localeCompare(assigneeGroupLabel(b)),
      );
      return ordered.map((key) => ({
        key,
        label: assigneeGroupLabel(key),
        tasks: sorted.filter((t) => assigneeGroupKey(t) === key),
      }));
    }
    const labelCatalog: Label[] = [];
    for (const t of sorted) {
      for (const l of t.labels) {
        if (!labelCatalog.some((x) => x.id === l.id)) labelCatalog.push(l);
      }
    }
    const order = labelOrderForSections(sorted, labelCatalog);
    return order
      .map(({ key, label }) => ({
        key,
        label,
        tasks: sorted.filter((t) => primaryLabelGroup(t).key === key),
      }))
      .filter((s) => s.tasks.length > 0);
  }, [tasks, groupBy, sortKey]);

  const colCount = selectionMode ? 6 : 5;

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
      <TaskFilterBar />
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
            <option value="assignee">Assignee</option>
            <option value="label">Label</option>
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
              {selectionMode && (
                <th className="w-10 px-2 py-2 font-medium" aria-label="Select" />
              )}
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
                    colSpan={colCount}
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
                <ListRow
                  key={t.id}
                  task={t}
                  onOpen={onOpenTask}
                  selectionMode={selectionMode}
                  selected={selectedTaskIds.includes(t.id)}
                  onToggleSelected={() => toggleTaskSelected(t.id)}
                />
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
  selectionMode,
  selected,
  onToggleSelected,
}: {
  task: Task;
  onOpen: (id: string) => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const onRowClick = () => onOpen(task.id);

  return (
    <tr
      className="cursor-pointer border-b border-edge-subtle transition-colors duration-150 ease-out hover:bg-surface-hover last:border-0"
      onClick={onRowClick}
    >
      {selectionMode && (
        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-edge text-accent focus:ring-accent"
            checked={selected}
            onChange={() => onToggleSelected()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${task.identifier}`}
          />
        </td>
      )}
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
