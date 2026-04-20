import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';

const ROWS: { keys: string; action: string }[] = [
  { keys: '⌘K / Ctrl+K', action: 'Command palette' },
  { keys: 'C', action: 'New task' },
  { keys: '1 · 2 · 3', action: 'Board / List / Graph' },
  { keys: 'B', action: 'Toggle selection mode (board & list)' },
  { keys: '?', action: 'Keyboard shortcuts' },
  { keys: 'Esc', action: 'Close dialogs; clear bulk selection' },
];

export function ShortcutsHelp() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close shortcuts"
        className="fixed inset-0 z-[60] bg-[var(--overlay-scrim)]"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="fixed left-1/2 top-20 z-[61] w-full max-w-md -translate-x-1/2 rounded-xl border border-edge bg-surface-panel p-4 shadow-elevated"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="shortcuts-title" className="text-base font-semibold text-fg">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs leading-5 text-fg-subtle">
          Shortcuts are disabled while typing in inputs. Graph view uses the
          same navigation keys.
        </p>
        <table className="mt-4 w-full border-collapse text-left text-sm">
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.action} className="border-t border-edge-subtle">
                <td className="py-2 pr-3 font-mono text-xs text-fg-secondary">
                  {row.keys}
                </td>
                <td className="py-2 text-fg">{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
