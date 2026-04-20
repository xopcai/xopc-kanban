import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ListTasksParams } from '../../api/client';
import type { Task, TaskStatus } from '../../types';
import { actorsToWorkspaceMembers } from '../../lib/members';
import { STATUS_ORDER } from '../../lib/taskOrdering';
import { TaskFilterBar } from '../Filters/TaskFilterBar';
import {
  useDeleteTask,
  useQuickPatchTask,
  useSetTaskStatus,
  useTaskList,
  useUpdateTaskTitle,
  useWorkspaceActors,
} from '../../hooks/useTasks';
import { useUiStore } from '../../store/uiStore';
import { BoardColumn } from './BoardColumn';
import { TaskContextMenu } from './TaskContextMenu';

const COLUMN_ORDER = STATUS_ORDER.filter((s) => s !== 'cancelled');

export function BoardView({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const { t } = useTranslation();
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
  const setStatus = useSetTaskStatus();
  const rename = useUpdateTaskTitle();
  const quickPatch = useQuickPatchTask();
  const delTask = useDeleteTask();
  const { data: actors } = useWorkspaceActors();
  const workspaceMembers = useMemo(
    () => (actors ? actorsToWorkspaceMembers(actors) : []),
    [actors],
  );

  const [menu, setMenu] = useState<{
    task: Task;
    x: number;
    y: number;
  } | null>(null);

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
        {t('loading.tasks')}
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
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMN_ORDER.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              tasks={grouped.get(status) ?? []}
              onOpenTask={onOpenTask}
              onRenameTask={(id, title) => rename.mutate({ id, title })}
              selectionMode={selectionMode}
              selectedTaskIds={selectedTaskIds}
              onToggleSelect={toggleTaskSelected}
              onContextMenu={(task, e) =>
                setMenu({ task, x: e.clientX, y: e.clientY })
              }
            />
          ))}
        </div>
      </DndContext>
      {menu && (
        <TaskContextMenu
          task={menu.task}
          x={menu.x}
          y={menu.y}
          workspaceMembers={workspaceMembers}
          onClose={() => setMenu(null)}
          onOpenDetail={() => onOpenTask(menu.task.id)}
          onSetStatus={(s) =>
            setStatus.mutate({ id: menu.task.id, status: s })
          }
          onAssign={(memberId, typ) => {
            if (memberId === null) {
              quickPatch.mutate({
                id: menu.task.id,
                assigneeType: null,
                assigneeId: null,
              });
            } else {
              quickPatch.mutate({
                id: menu.task.id,
                assigneeType: typ,
                assigneeId: memberId,
              });
            }
          }}
          onDelete={() => {
            if (!confirm(`Delete ${menu.task.identifier}?`)) return;
            delTask.mutate(menu.task.id);
          }}
        />
      )}
    </div>
  );
}
