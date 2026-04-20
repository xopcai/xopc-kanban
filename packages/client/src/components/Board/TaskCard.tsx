import { useDraggable } from '@dnd-kit/core';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
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
  onRename,
}: {
  task: Task;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task },
    });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    [],
  );

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.85 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(task.id);
        }
      }}
      onClick={() => {
        if (editing) return;
        if (openTimer.current) clearTimeout(openTimer.current);
        openTimer.current = setTimeout(() => onOpen(task.id), 220);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (openTimer.current) {
          clearTimeout(openTimer.current);
          openTimer.current = null;
        }
        setEditing(true);
      }}
      className={clsx(
        'relative w-full cursor-grab rounded-xl border border-edge-subtle bg-surface-panel px-3 py-3 text-left active:cursor-grabbing',
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
          {editing ? (
            <input
              autoFocus
              className="mt-0.5 w-full rounded-lg border border-edge bg-surface-panel px-2 py-1 text-sm font-medium leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  setDraft(task.title);
                  setEditing(false);
                }
                if (e.key === 'Enter') {
                  const t = draft.trim();
                  if (t && t !== task.title) onRename(task.id, t);
                  setEditing(false);
                }
              }}
              onBlur={() => {
                const t = draft.trim();
                if (t && t !== task.title) onRename(task.id, t);
                setEditing(false);
              }}
            />
          ) : (
            <p className="text-sm font-medium leading-6 text-fg">{task.title}</p>
          )}
        </div>
      </div>
    </div>
  );
}
