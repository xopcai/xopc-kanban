import type { TaskComment } from '../../types';

export function MemoryTimeline({ items }: { items: TaskComment[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-fg-secondary">
        No activity yet. Add a note below.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((m) => (
        <li
          key={m.id}
          className="rounded-xl border border-edge-subtle bg-surface-panel px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs capitalize leading-5 text-fg-subtle">
              {m.type.replaceAll('_', ' ')}
            </span>
            <time className="text-xs leading-5 text-fg-subtle">
              {new Date(m.createdAt).toLocaleString()}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">
            {m.content}
          </p>
        </li>
      ))}
    </ul>
  );
}
