import { useDraggable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statusLabel } from '../../lib/taskOrdering';
import type { Task } from '../../types';

const priorityBar: Record<string, string> = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

type MainAreaProps = HTMLAttributes<HTMLDivElement> & {
  ref?: never;
};

function TaskCardContent({
  task,
  selectionMode,
  selected,
  onToggleSelect,
  mainAreaProps,
  titleContent,
}: {
  task: Task;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  mainAreaProps: MainAreaProps;
  titleContent: ReactNode;
}) {
  const { t } = useTranslation();
  const { className: mainClassName, ...mainRest } = mainAreaProps;

  return (
    <>
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(task.id)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="mt-1.5 h-4 w-4 shrink-0 rounded border-edge text-accent focus:ring-accent"
          aria-label={t('list.selectTaskAria', { id: task.identifier })}
        />
      )}
      <div
        className={clsx('min-w-0 flex-1 text-left', mainClassName)}
        {...mainRest}
      >
        {task.priority !== 'none' && (
          <span
            className={clsx(
              'absolute left-2 top-3 bottom-3 w-0.5 rounded-full',
              selectionMode ? 'left-8' : 'left-2',
              priorityBar[task.priority] ?? 'bg-edge-subtle',
            )}
            aria-hidden
          />
        )}
        <div
          className={clsx(
            'flex items-start gap-2',
            task.priority !== 'none' && 'pl-1.5',
            selectionMode && task.priority !== 'none' && 'pl-2',
          )}
        >
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
            title={statusLabel(task.status, t)}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-5 text-fg-subtle">{task.identifier}</p>
            {titleContent}
            {task.labels.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {task.labels.map((l) => (
                  <span
                    key={l.id}
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-fg"
                    style={{
                      backgroundColor: `${l.color}22`,
                      color: l.color,
                    }}
                  >
                    {l.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function TaskCardDragOverlay({
  task,
  selectionMode,
  selected,
}: {
  task: Task;
  selectionMode: boolean;
  selected: boolean;
}) {
  return (
    <div
      className={clsx(
        'relative flex w-64 gap-2 rounded-xl border border-edge-subtle bg-surface-panel px-2 py-3',
        'shadow-lg ring-1 ring-black/5 dark:ring-white/10',
        selected && 'ring-2 ring-accent ring-offset-2 ring-offset-surface-base',
      )}
      role="presentation"
    >
      <TaskCardContent
        task={task}
        selectionMode={selectionMode}
        selected={selected}
        onToggleSelect={() => {}}
        mainAreaProps={{
          className: 'cursor-grabbing',
        }}
        titleContent={
          <p className="text-sm font-medium leading-6 text-fg">{task.title}</p>
        }
      />
    </div>
  );
}

export function TaskCard({
  task,
  onOpen,
  onRename,
  selectionMode,
  selected,
  onToggleSelect,
  onContextMenu,
}: {
  task: Task;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onContextMenu: (task: Task, e: MouseEvent) => void;
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
        opacity: isDragging ? 0 : 1,
      }
    : isDragging
      ? { opacity: 0 }
      : undefined;

  const mainAreaProps: MainAreaProps & {
    role: 'button';
    tabIndex: number;
  } = {
    ...listeners,
    ...attributes,
    role: 'button',
    tabIndex: 0,
    className: 'cursor-grab active:cursor-grabbing',
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen(task.id);
      }
    },
    onClick: () => {
      if (editing || selectionMode) return;
      if (openTimer.current) clearTimeout(openTimer.current);
      openTimer.current = setTimeout(() => onOpen(task.id), 220);
    },
    onDoubleClick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (selectionMode) return;
      if (openTimer.current) {
        clearTimeout(openTimer.current);
        openTimer.current = null;
      }
      setEditing(true);
    },
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="presentation"
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(task, e);
      }}
      className={clsx(
        'relative flex gap-2 rounded-xl border border-edge-subtle bg-surface-panel px-2 py-3',
        'transition-[opacity,background-color] duration-150 ease-out hover:bg-surface-hover',
        selected && 'ring-2 ring-accent ring-offset-2 ring-offset-surface-base',
      )}
    >
      <TaskCardContent
        task={task}
        selectionMode={selectionMode}
        selected={selected}
        onToggleSelect={onToggleSelect}
        mainAreaProps={mainAreaProps}
        titleContent={
          editing ? (
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
                  const next = draft.trim();
                  if (next && next !== task.title) onRename(task.id, next);
                  setEditing(false);
                }
              }}
              onBlur={() => {
                const next = draft.trim();
                if (next && next !== task.title) onRename(task.id, next);
                setEditing(false);
              }}
            />
          ) : (
            <p className="text-sm font-medium leading-6 text-fg">{task.title}</p>
          )
        }
      />
    </div>
  );
}
