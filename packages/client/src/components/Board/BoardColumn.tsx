import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { Task, TaskStatus } from '../../types';
import { statusLabel } from '../../lib/taskOrdering';
import { TaskCard } from './TaskCard';

export function BoardColumn({
  status,
  tasks,
  onOpenTask,
  onRenameTask,
}: {
  status: TaskStatus;
  tasks: Task[];
  onOpenTask: (id: string) => void;
  onRenameTask: (id: string, title: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold leading-6 text-fg">
          {statusLabel(status)}
        </h3>
        <span className="text-xs leading-5 text-fg-subtle">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          'flex min-h-[200px] flex-col gap-2 rounded-xl bg-surface-base/80 p-2',
          isOver && 'ring-2 ring-accent ring-offset-2 ring-offset-surface-base',
        )}
      >
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onOpen={onOpenTask}
            onRename={onRenameTask}
          />
        ))}
      </div>
    </div>
  );
}
