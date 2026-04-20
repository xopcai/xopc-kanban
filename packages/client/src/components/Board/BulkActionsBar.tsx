import { useEffect, useState } from 'react';
import { useBulkTasks } from '../../hooks/useTasks';
import type { TaskStatus } from '../../types';
import { STATUS_ORDER } from '../../lib/taskOrdering';
import { useUiStore } from '../../store/uiStore';

const bulkStatuses = STATUS_ORDER.filter((s) => s !== 'cancelled');

export function BulkActionsBar() {
  const selectedTaskIds = useUiStore((s) => s.selectedTaskIds);
  const clearSelection = useUiStore((s) => s.clearSelection);
  const setSelectionMode = useUiStore((s) => s.setSelectionMode);
  const bulk = useBulkTasks();
  const [statusPick, setStatusPick] = useState<TaskStatus | ''>('');

  useEffect(() => {
    setStatusPick('');
  }, [selectedTaskIds.join('|')]);

  if (selectedTaskIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[55] flex max-w-[min(96vw,720px)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-edge bg-surface-panel px-4 py-3 shadow-elevated">
      <span className="text-sm font-medium text-fg">
        {selectedTaskIds.length} selected
      </span>
      <select
        className="rounded-xl border border-edge bg-surface-panel px-2 py-1.5 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        value={statusPick}
        onChange={(e) => {
          const v = e.target.value as TaskStatus;
          if (!v) return;
          bulk.mutate(
            { ids: selectedTaskIds, action: 'set_status', status: v },
            {
              onSettled: () => setStatusPick(''),
              onSuccess: () => {
                clearSelection();
              },
              onError: (err) =>
                window.alert(err instanceof Error ? err.message : 'Bulk update failed'),
            },
          );
        }}
      >
        <option value="">Set status…</option>
        {bulkStatuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="rounded-xl border border-edge px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => {
          if (!confirm(`Delete ${selectedTaskIds.length} tasks?`)) return;
          bulk.mutate(
            { ids: selectedTaskIds, action: 'delete' },
            {
              onSuccess: () => {
                clearSelection();
                setSelectionMode(false);
              },
            },
          );
        }}
      >
        Delete
      </button>
      <button
        type="button"
        className="ml-auto rounded-xl px-3 py-1.5 text-sm font-medium text-fg-subtle hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => clearSelection()}
      >
        Clear
      </button>
    </div>
  );
}
