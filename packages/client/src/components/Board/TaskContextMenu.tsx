import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Task, TaskStatus } from '../../types';
import { STATUS_ORDER, statusLabel } from '../../lib/taskOrdering';
import { WORKSPACE_MEMBERS } from '../../lib/members';

const menuStatuses = STATUS_ORDER.filter((s) => s !== 'cancelled');

export function TaskContextMenu({
  task,
  x,
  y,
  onClose,
  onOpenDetail,
  onSetStatus,
  onAssign,
  onDelete,
}: {
  task: Task;
  x: number;
  y: number;
  onClose: () => void;
  onOpenDetail: () => void;
  onSetStatus: (s: TaskStatus) => void;
  onAssign: (memberId: string | null, type: 'member' | 'agent' | null) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [onClose]);

  const style: CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 280),
    zIndex: 80,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="min-w-[200px] rounded-xl border border-edge bg-surface-panel py-1 shadow-elevated"
      role="menu"
      aria-label={t('contextMenu.aria', { id: task.identifier })}
    >
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface-hover focus:bg-surface-hover focus:outline-none"
        onClick={() => {
          onOpenDetail();
          onClose();
        }}
      >
        {t('contextMenu.openDetail')}
      </button>
      <div className="my-1 border-t border-edge-subtle" />
      <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        {t('contextMenu.status')}
      </p>
      {menuStatuses.map((s) => (
        <button
          key={s}
          type="button"
          role="menuitem"
          className="block w-full px-3 py-1.5 text-left text-sm text-fg-secondary hover:bg-surface-hover focus:outline-none"
          onClick={() => {
            onSetStatus(s);
            onClose();
          }}
        >
          {t('contextMenu.statusArrow', {
            label: statusLabel(s, t),
          })}
        </button>
      ))}
      <div className="my-1 border-t border-edge-subtle" />
      <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        {t('contextMenu.assign')}
      </p>
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-sm text-fg-secondary hover:bg-surface-hover focus:outline-none"
        onClick={() => {
          onAssign(null, null);
          onClose();
        }}
      >
        {t('contextMenu.unassign')}
      </button>
      {WORKSPACE_MEMBERS.map((m) => (
        <button
          key={m.id}
          type="button"
          className="block w-full px-3 py-1.5 text-left text-sm text-fg-secondary hover:bg-surface-hover focus:outline-none"
          onClick={() => {
            onAssign(m.id, m.type);
            onClose();
          }}
        >
          {t(`members.${m.id}`, { defaultValue: m.name })}
        </button>
      ))}
      <div className="my-1 border-t border-edge-subtle" />
      <button
        type="button"
        className="block w-full px-3 py-2 text-left text-sm text-danger hover:bg-surface-hover focus:outline-none"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        {t('contextMenu.delete')}
      </button>
    </div>
  );
}
