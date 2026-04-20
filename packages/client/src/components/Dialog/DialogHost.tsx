import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDialogStore } from '../../store/dialogStore';

/**
 * Renders the active modal from `useDialogStore` (alert / confirm / prompt).
 * Mount once inside the logged-in shell (e.g. `MainApp`).
 */
export function DialogHost() {
  const { t } = useTranslation();
  const dialog = useDialogStore((s) => s.dialog);
  const completeAlert = useDialogStore((s) => s.completeAlert);
  const completeConfirm = useDialogStore((s) => s.completeConfirm);
  const completePrompt = useDialogStore((s) => s.completePrompt);
  const dismiss = useDialogStore((s) => s.dismiss);

  const [promptValue, setPromptValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialog?.kind === 'prompt') {
      setPromptValue(dialog.defaultValue ?? '');
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [dialog]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !useDialogStore.getState().dialog) return;
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dismiss]);

  if (!dialog) return null;

  const cancelLabel = t('actions.cancel');
  const primaryLabel =
    dialog.kind === 'confirm' || dialog.kind === 'prompt'
      ? (dialog.confirmLabel ?? t('dialog.confirm'))
      : t('dialog.confirm');

  return (
    <>
      <button
        type="button"
        aria-label={t('dialog.closeOverlay')}
        className="fixed inset-0 z-[80] bg-[var(--overlay-scrim)]"
        onClick={() => dismiss()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        className="fixed left-1/2 top-1/2 z-[81] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-edge-subtle bg-surface-panel p-4 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="app-dialog-title" className="text-base font-semibold text-fg">
          {dialog.kind === 'prompt'
            ? dialog.title
            : dialog.kind === 'alert'
              ? (dialog.title ?? t('dialog.notice'))
              : (dialog.title ?? t('dialog.confirmTitle'))}
        </h2>
        {dialog.kind === 'prompt' && dialog.message && (
          <p className="mt-2 text-sm leading-relaxed text-fg-secondary">{dialog.message}</p>
        )}
        {dialog.kind !== 'prompt' && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg-secondary">
            {dialog.message}
          </p>
        )}
        {dialog.kind === 'prompt' && (
          <input
            ref={inputRef}
            type="text"
            className="mt-3 w-full rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm leading-6 text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            placeholder={dialog.placeholder}
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                completePrompt(promptValue.trim() || null);
              }
            }}
          />
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {dialog.kind === 'alert' && (
            <button
              type="button"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
              onClick={() => completeAlert()}
            >
              {dialog.okLabel ?? t('dialog.ok')}
            </button>
          )}
          {dialog.kind === 'confirm' && (
            <>
              <button
                type="button"
                className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                onClick={() => completeConfirm(false)}
              >
                {dialog.cancelLabel ?? cancelLabel}
              </button>
              <button
                type="button"
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${
                  dialog.danger
                    ? 'bg-danger hover:opacity-90'
                    : 'bg-accent hover:bg-accent-hover'
                }`}
                onClick={() => completeConfirm(true)}
              >
                {primaryLabel}
              </button>
            </>
          )}
          {dialog.kind === 'prompt' && (
            <>
              <button
                type="button"
                className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                onClick={() => completePrompt(null)}
              >
                {dialog.cancelLabel ?? cancelLabel}
              </button>
              <button
                type="button"
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                onClick={() => completePrompt(promptValue.trim() || null)}
              >
                {primaryLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
