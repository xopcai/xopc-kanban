import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Task, TaskStatus } from '../../types';
import { statusLabel } from '../../lib/taskOrdering';
import { TaskCard } from './TaskCard';

export function BoardColumn({
  status,
  tasks,
  onOpenTask,
  onRenameTask,
  selectionMode,
  selectedTaskIds,
  onToggleSelect,
  onContextMenu,
}: {
  status: TaskStatus;
  tasks: Task[];
  onOpenTask: (id: string) => void;
  onRenameTask: (id: string, title: string) => void;
  selectionMode: boolean;
  selectedTaskIds: string[];
  onToggleSelect: (id: string) => void;
  onContextMenu: (task: Task, e: MouseEvent) => void;
}) {
  const { t } = useTranslation();
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold leading-6 text-fg">
          {statusLabel(status, t)}
        </h3>
        <span className="text-xs leading-5 text-fg-subtle">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          'flex min-h-[200px] flex-col gap-2 rounded-xl border border-edge-subtle bg-surface-base p-2',
          isOver && 'ring-2 ring-accent ring-offset-2 ring-offset-surface-base',
        )}
      >
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onOpen={onOpenTask}
            onRename={onRenameTask}
            selectionMode={selectionMode}
            selected={selectedTaskIds.includes(t.id)}
            onToggleSelect={onToggleSelect}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    </div>
  );
}
