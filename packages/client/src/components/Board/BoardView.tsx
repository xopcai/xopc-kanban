import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMemo } from 'react';
import type { Task, TaskStatus } from '../../types';
import { STATUS_ORDER } from '../../lib/taskOrdering';
import {
  useSetTaskStatus,
  useTaskList,
  useUpdateTaskTitle,
} from '../../hooks/useTasks';
import { BoardColumn } from './BoardColumn';

const COLUMN_ORDER = STATUS_ORDER.filter((s) => s !== 'cancelled');

export function BoardView({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const { data: tasks = [], isLoading, isError, error } = useTaskList(true);
  const setStatus = useSetTaskStatus();
  const rename = useUpdateTaskTitle();

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const s of COLUMN_ORDER) map.set(s, []);
    for (const t of tasks) {
      if (t.status === 'cancelled') continue;
      const list = map.get(t.status);
      if (list) list.push(t);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.position - b.position || a.number - b.number);
    }
    return map;
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const taskId = e.active.id as string;
    const overId = e.over?.id as TaskStatus | undefined;
    if (!overId || !(COLUMN_ORDER as readonly TaskStatus[]).includes(overId)) {
      return;
    }
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === overId) return;
    setStatus.mutate({ id: taskId, status: overId });
  };

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
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMN_ORDER.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            tasks={grouped.get(status) ?? []}
            onOpenTask={onOpenTask}
            onRenameTask={(id, title) => rename.mutate({ id, title })}
          />
        ))}
      </div>
    </DndContext>
  );
}
