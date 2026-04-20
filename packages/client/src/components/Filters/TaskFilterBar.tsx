import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useLabels, useProjectWorkspaceMembers } from '../../hooks/useTasks';
import { priorityLabel } from '../../lib/taskOrdering';
import type { TaskPriority } from '../../types';
import { useUiStore } from '../../store/uiStore';

const priorities: TaskPriority[] = [
  'urgent',
  'high',
  'medium',
  'low',
  'none',
];

export function TaskFilterBar({
  className,
  embedded,
}: {
  className?: string;
  /** When true, omit the standalone panel chrome (for toolbar / header rows). */
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const filters = useUiStore((s) => s.taskFilters);
  const setTaskFilters = useUiStore((s) => s.setTaskFilters);
  const resetTaskFilters = useUiStore((s) => s.resetTaskFilters);
  const { data: labels = [] } = useLabels();
  const workspaceMembers = useProjectWorkspaceMembers();

  const active =
    filters.priority !== '' ||
    filters.assigneeId !== '' ||
    filters.labelId !== '';

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-2 sm:gap-3',
        embedded ? 'min-w-0' : 'rounded-xl border border-edge-subtle bg-surface-base/60 px-3 py-2',
        className,
      )}
    >
      <label className="flex min-w-0 flex-row items-center gap-2">
        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-fg-subtle">
          {t('filters.priority')}
        </span>
        <select
          className="min-w-[120px] rounded-xl border border-edge bg-surface-panel px-2 py-1.5 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={filters.priority}
          onChange={(e) =>
            setTaskFilters({
              priority: e.target.value as TaskPriority | '',
            })
          }
        >
          <option value="">{t('filters.all')}</option>
          {priorities.map((p) => (
            <option key={p} value={p}>
              {priorityLabel(p, t)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-row items-center gap-2">
        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-fg-subtle">
          {t('filters.assignee')}
        </span>
        <select
          className="min-w-[140px] rounded-xl border border-edge bg-surface-panel px-2 py-1.5 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={filters.assigneeId}
          onChange={(e) =>
            setTaskFilters({
              assigneeId: e.target.value as typeof filters.assigneeId,
            })
          }
        >
          <option value="">{t('filters.all')}</option>
          <option value="__none__">{t('filters.unassigned')}</option>
          {workspaceMembers.map((m) => (
            <option key={`${m.type}-${m.id}`} value={m.id}>
              {t(`members.${m.id}`, { defaultValue: m.name })}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-row items-center gap-2">
        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-fg-subtle">
          {t('filters.label')}
        </span>
        <select
          className="min-w-[140px] rounded-xl border border-edge bg-surface-panel px-2 py-1.5 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={filters.labelId}
          onChange={(e) => setTaskFilters({ labelId: e.target.value })}
        >
          <option value="">{t('filters.all')}</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!active}
        onClick={() => resetTaskFilters()}
        className="rounded-xl border border-edge bg-surface-panel px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t('filters.clear')}
      </button>
    </div>
  );
}
