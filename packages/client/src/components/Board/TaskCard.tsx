import { useDraggable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { Task } from '../../types';

const priorityBar: Record<string, string> = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

export function TaskCard({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.85 : 1,
      }
    : undefined;

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(task.id)}
      className={clsx(
        'relative w-full rounded-xl border border-edge-subtle bg-surface-panel px-3 py-3 text-left',
        'transition-colors duration-150 ease-out hover:bg-surface-hover',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        'active:scale-95',
      )}
    >
      {task.priority !== 'none' && (
        <span
          className={clsx(
            'absolute left-0 top-3 bottom-3 w-0.5 rounded-full',
            priorityBar[task.priority] ?? 'bg-edge-subtle',
          )}
          aria-hidden
        />
      )}
      <div className="flex items-start gap-2 pl-1">
        <span
          className={clsx(
            'mt-1 h-2 w-2 shrink-0 rounded-full',
            task.status === 'backlog' && 'bg-status-backlog',
            task.status === 'todo' && 'bg-status-todo',
            task.status === 'in_progress' && 'bg-status-in_progress',
            task.status === 'in_review' && 'bg-status-in_review',
            task.status === 'blocked' && 'bg-status-blocked',
            task.status === 'done' && 'bg-status-done',
            task.status === 'cancelled' && 'bg-status-cancelled',
          )}
          title={task.status}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-5 text-fg-subtle">{task.identifier}</p>
          <p className="text-sm font-medium leading-6 text-fg">{task.title}</p>
        </div>
      </div>
    </button>
  );
}
