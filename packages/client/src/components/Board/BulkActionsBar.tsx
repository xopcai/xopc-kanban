import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBulkTasks } from '../../hooks/useTasks';
import { STATUS_ORDER, statusLabel } from '../../lib/taskOrdering';
import type { TaskStatus } from '../../types';
import { useDialogStore } from '../../store/dialogStore';
import { useUiStore } from '../../store/uiStore';

const bulkStatuses = STATUS_ORDER.filter((s) => s !== 'cancelled');

export function BulkActionsBar() {
  const { t } = useTranslation();
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
        {t('bulk.selected', { count: selectedTaskIds.length })}
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
              onError: (err) => {
                void useDialogStore.getState().alert({
                  message:
                    err instanceof Error ? err.message : t('bulk.updateFailed'),
                });
              },
            },
          );
        }}
      >
        <option value="">{t('bulk.setStatus')}</option>
        {bulkStatuses.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s, t)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="rounded-xl border border-edge px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => {
          void (async () => {
            const ok = await useDialogStore.getState().confirm({
              message: t('bulk.deleteConfirm', {
                count: selectedTaskIds.length,
              }),
              danger: true,
              confirmLabel: t('actions.delete'),
            });
            if (!ok) return;
            bulk.mutate(
              { ids: selectedTaskIds, action: 'delete' },
              {
                onSuccess: () => {
                  clearSelection();
                  setSelectionMode(false);
                },
              },
            );
          })();
        }}
      >
        {t('actions.delete')}
      </button>
      <button
        type="button"
        className="ml-auto rounded-xl px-3 py-1.5 text-sm font-medium text-fg-subtle hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => clearSelection()}
      >
        {t('actions.clear')}
      </button>
    </div>
  );
}
