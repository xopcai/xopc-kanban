import {
  GitCommit,
  MessageSquare,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TaskComment } from '../../types';

function dayKey(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function MemoryTimeline({ items }: { items: TaskComment[] }) {
  const { t, i18n } = useTranslation();

  const typeMeta = useMemo(
    () =>
      ({
        comment: { labelKey: 'memory.typeNote' as const, Icon: MessageSquare },
        status_change: { labelKey: 'memory.typeStatus' as const, Icon: Workflow },
        progress_update: {
          labelKey: 'memory.typeProgress' as const,
          Icon: Sparkles,
        },
        system: { labelKey: 'memory.typeSystem' as const, Icon: GitCommit },
      }) satisfies Record<
        TaskComment['type'],
        { labelKey: string; Icon: typeof MessageSquare }
      >,
    [],
  );

  const grouped = useMemo(() => {
    const sorted = [...items].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    );
    const map: { day: string; rows: TaskComment[] }[] = [];
    for (const row of sorted) {
      const day = dayKey(row.createdAt, i18n.language);
      const last = map[map.length - 1];
      if (last && last.day === day) last.rows.push(row);
      else map.push({ day, rows: [row] });
    }
    return map;
  }, [items, i18n.language]);

  if (items.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-fg-secondary">
        {t('memory.empty')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {grouped.map((g) => (
        <section key={g.day}>
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            {g.day}
          </p>
          <ul className="mt-2 flex flex-col gap-2 border-l border-edge-subtle pl-3">
            {g.rows.map((m) => {
              const meta = typeMeta[m.type];
              const Icon = meta.Icon;
              return (
                <li
                  key={m.id}
                  className="relative rounded-xl border border-edge-subtle bg-surface-panel py-2 pl-9 pr-3"
                >
                  <span className="absolute left-2 top-2.5 text-fg-subtle">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium capitalize leading-5 text-fg-secondary">
                      {t(meta.labelKey)}
                    </span>
                    <time className="text-xs leading-5 text-fg-subtle">
                      {new Date(m.createdAt).toLocaleTimeString(i18n.language, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">
                    {m.content}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
