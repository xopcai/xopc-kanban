import { create } from 'zustand';

type AlertPayload = {
  kind: 'alert';
  title?: string;
  message: string;
  okLabel?: string;
  resolve: () => void;
};

type ConfirmPayload = {
  kind: 'confirm';
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

type PromptPayload = {
  kind: 'prompt';
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: string | null) => void;
};

export type DialogPayload = AlertPayload | ConfirmPayload | PromptPayload;

interface DialogStore {
  dialog: DialogPayload | null;
  alert: (opts: {
    title?: string;
    message: string;
    okLabel?: string;
  }) => Promise<void>;
  confirm: (opts: {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  prompt: (opts: {
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<string | null>;
  completeAlert: () => void;
  completeConfirm: (ok: boolean) => void;
  completePrompt: (value: string | null) => void;
  /** Backdrop / Esc: alert = OK; confirm = cancel; prompt = cancel */
  dismiss: () => void;
}

export const useDialogStore = create<DialogStore>((set, get) => ({
  dialog: null,

  alert: (opts) =>
    new Promise<void>((resolve) => {
      set({
        dialog: {
          kind: 'alert',
          ...opts,
          resolve: () => {
            resolve();
            set({ dialog: null });
          },
        },
      });
    }),

  confirm: (opts) =>
    new Promise<boolean>((resolve) => {
      set({
        dialog: {
          kind: 'confirm',
          ...opts,
          resolve: (ok) => {
            resolve(ok);
            set({ dialog: null });
          },
        },
      });
    }),

  prompt: (opts) =>
    new Promise<string | null>((resolve) => {
      set({
        dialog: {
          kind: 'prompt',
          ...opts,
          defaultValue: opts.defaultValue ?? '',
          resolve: (value: string | null) => {
            resolve(value);
            set({ dialog: null });
          },
        },
      });
    }),

  completeAlert: () => {
    const d = get().dialog;
    if (d?.kind === 'alert') d.resolve();
  },

  completeConfirm: (ok) => {
    const d = get().dialog;
    if (d?.kind === 'confirm') d.resolve(ok);
  },

  completePrompt: (value) => {
    const d = get().dialog;
    if (d?.kind === 'prompt') d.resolve(value);
  },

  dismiss: () => {
    const d = get().dialog;
    if (!d) return;
    if (d.kind === 'alert') d.resolve();
    else if (d.kind === 'confirm') d.resolve(false);
    else d.resolve(null);
  },
}));
