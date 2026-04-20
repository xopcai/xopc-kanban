import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type AdminMemberRow } from '../../api/client';
import { workspaceKeys } from '../../hooks/useTasks';
import type { AccountRole } from '../../store/authStore';
import { useAuthStore } from '../../store/authStore';
import { useDialogStore } from '../../store/dialogStore';
import { useUiStore } from '../../store/uiStore';
import clsx from 'clsx';

function roleLabel(t: (k: string) => string, role: AccountRole): string {
  if (role === 'admin') return t('admin.roleBadgeAdmin');
  if (role === 'guest') return t('admin.roleBadgeGuest');
  return t('admin.roleBadgeMember');
}

function parseBatchLine(line: string): { email: string; displayName?: string } | null {
  const raw = line.trim();
  if (!raw || raw.startsWith('#')) return null;
  const tabParts = raw.split('\t');
  if (tabParts.length >= 2) {
    const email = tabParts[0].trim();
    const displayName = tabParts.slice(1).join('\t').trim();
    if (!email) return null;
    return displayName ? { email, displayName } : { email };
  }
  const commaIdx = raw.indexOf(',');
  if (commaIdx !== -1) {
    const email = raw.slice(0, commaIdx).trim();
    const displayName = raw.slice(commaIdx + 1).trim();
    if (!email) return null;
    return displayName ? { email, displayName } : { email };
  }
  return { email: raw };
}

function parseBatchText(text: string): { email: string; displayName?: string }[] {
  const lines = text.split(/\r?\n/);
  const out: { email: string; displayName?: string }[] = [];
  for (const line of lines) {
    const row = parseBatchLine(line);
    if (row) out.push(row);
  }
  return out;
}

type BatchAddOutcome = Awaited<ReturnType<typeof api.createAdminMembersBatch>>;

function formatBatchError(t: (k: string) => string, err: string): string {
  if (err === 'Duplicate in batch') return t('admin.duplicateInBatch');
  return err;
}

export function AdminAccountsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const sidebarWidthPx = useUiStore((s) => s.sidebarWidthPx);
  const canManage = user?.typ === 'member' && user.accountRole === 'admin';
  /** Horizontal center of main column (viewport minus fixed sidebar). */
  const mainColumnCenterX = `calc((100vw + ${sidebarWidthPx}px) / 2)`;
  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);

  const accountsHint =
    user?.typ === 'member' && user.accountRole === 'guest'
      ? t('admin.accountsHintGuest')
      : canManage
        ? t('admin.accountsHint')
        : t('admin.accountsHintReadOnly');

  useLayoutEffect(() => {
    useUiStore.getState().setWorkspaceScreen('projects');
    useUiStore.getState().setCurrentProjectId(null);
    useUiStore.getState().selectTask(null);
  }, []);
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchRole, setBatchRole] = useState<AccountRole>('member');
  const [batchOutcome, setBatchOutcome] = useState<BatchAddOutcome | null>(null);

  const [editing, setEditing] = useState<AdminMemberRow | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<AccountRole>('member');
  const [editPassword, setEditPassword] = useState('');

  useEffect(() => {
    if (!editing && !addOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (editing) setEditing(null);
      if (addOpen) setAddOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [editing, addOpen]);

  useEffect(() => {
    if (!canManage) {
      setAddOpen(false);
      setEditing(null);
    }
  }, [canManage]);

  const listQuery = useQuery({
    queryKey: ['admin', 'members'],
    queryFn: () => api.listAdminMembers(),
  });

  const batchMut = useMutation({
    mutationFn: () => {
      const entries = parseBatchText(batchText);
      if (entries.length === 0) {
        throw new Error(t('admin.batchEmpty'));
      }
      return api.createAdminMembersBatch({
        accountRole: batchRole,
        entries,
      });
    },
    onSuccess: async (data) => {
      setBatchOutcome(data);
      setAddOpen(false);
      setBatchText('');
      await qc.invalidateQueries({ queryKey: ['admin', 'members'] });
      void qc.invalidateQueries({ queryKey: workspaceKeys.actors });
    },
    onError: async (e) => {
      await useDialogStore.getState().alert({
        message: e instanceof Error ? e.message : t('auth.error'),
      });
    },
  });

  const patchMut = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('No member selected');
      const body: {
        email?: string;
        displayName?: string;
        accountRole?: AccountRole;
        password?: string;
      } = {};
      const em = editEmail.trim().toLowerCase();
      if (em !== editing.email.toLowerCase()) body.email = em;
      const dn = editDisplayName.trim();
      if (dn !== editing.displayName) body.displayName = dn;
      if (editRole !== editing.accountRole) body.accountRole = editRole;
      const pw = editPassword.trim();
      if (pw) body.password = pw;
      if (Object.keys(body).length === 0) {
        throw new Error(t('admin.noChanges'));
      }
      return api.patchAdminMember(editing.id, body);
    },
    onSuccess: async (data) => {
      if (data.token) {
        setSession(data.token, {
          typ: 'member',
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName,
          accountRole: data.user.accountRole,
        });
      } else {
        const u = useAuthStore.getState().user;
        if (u?.typ === 'member' && u.id === data.user.id) {
          setUser({
            typ: 'member',
            id: data.user.id,
            email: data.user.email,
            displayName: data.user.displayName,
            accountRole: data.user.accountRole,
          });
        }
      }
      setEditing(null);
      setEditPassword('');
      await qc.invalidateQueries({ queryKey: ['admin', 'members'] });
      void qc.invalidateQueries({ queryKey: workspaceKeys.actors });
    },
    onError: async (e) => {
      await useDialogStore.getState().alert({
        message: e instanceof Error ? e.message : t('auth.error'),
      });
    },
  });

  function openEdit(m: AdminMemberRow) {
    setEditing(m);
    setEditEmail(m.email);
    setEditDisplayName(m.displayName);
    setEditRole(m.accountRole);
    setEditPassword('');
  }

  return (
    <main className="flex-1 overflow-auto px-4 pb-10 pt-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-fg">{t('admin.accountsTitle')}</h1>
            <p className="mt-1 text-sm text-fg-secondary">{accountsHint}</p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setBatchOutcome(null);
                setAddOpen(true);
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              <UserPlus className="h-4 w-4" />
              {t('admin.addMembers')}
            </button>
          )}
        </div>

        {canManage &&
          batchOutcome &&
          (batchOutcome.created.length > 0 || batchOutcome.failed.length > 0) && (
          <div
            className={clsx(
              'mt-6 rounded-xl border border-edge-subtle bg-surface-panel p-4',
              batchOutcome.failed.length > 0 && 'border-amber-500/40',
            )}
          >
            <p className="text-sm font-medium text-fg">
              {t('admin.batchSummaryLine', {
                created: batchOutcome.created.length,
                failed: batchOutcome.failed.length,
              })}
            </p>
            <p className="mt-1 text-xs text-fg-secondary">{t('admin.defaultPasswordExplain')}</p>

            {batchOutcome.created.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[280px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-edge-subtle text-xs font-medium text-fg-subtle">
                      <th className="py-2 pr-3">{t('admin.email')}</th>
                      <th className="py-2">{t('admin.batchTablePassword')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchOutcome.created.map((row) => (
                      <tr
                        key={row.user.id}
                        className="border-b border-edge-subtle/70 last:border-0"
                      >
                        <td className="py-2 pr-3 font-mono text-xs text-fg">{row.user.email}</td>
                        <td className="py-2 font-mono text-xs text-fg">{row.initialPassword}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {batchOutcome.failed.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {t('admin.batchFailedTitle')}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-fg-secondary">
                  {batchOutcome.failed.map((f) => (
                    <li key={`${f.email}-${f.error}`}>
                      <span className="font-mono text-fg">{f.email}</span>
                      {' — '}
                      {formatBatchError(t, f.error)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              className="mt-4 rounded-xl border border-edge px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-hover"
              onClick={() => setBatchOutcome(null)}
            >
              {t('auth.close')}
            </button>
          </div>
        )}

        <h2 className="mt-10 text-sm font-semibold text-fg">{t('admin.membersList')}</h2>
        {listQuery.isLoading ? (
          <p className="mt-2 text-sm text-fg-secondary">{t('loading.generic')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-edge-subtle rounded-xl border border-edge-subtle bg-surface-panel">
            {(listQuery.data?.members ?? []).map((m) => (
              <li key={m.id}>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => openEdit(m)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-surface-hover"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{m.displayName}</p>
                      <p className="truncate text-xs text-fg-subtle">{m.email}</p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-surface-base px-2 py-0.5 text-xs font-medium text-fg-secondary">
                      {roleLabel(t, m.accountRole)}
                    </span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{m.displayName}</p>
                      <p className="truncate text-xs text-fg-subtle">{m.email}</p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-surface-base px-2 py-0.5 text-xs font-medium text-fg-secondary">
                      {roleLabel(t, m.accountRole)}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && addOpen && (
        <>
          <button
            type="button"
            aria-label={t('dialog.closeOverlay')}
            className="fixed top-0 right-0 bottom-0 z-[55] bg-[var(--overlay-scrim)]"
            style={{ left: sidebarWidthPx }}
            onClick={() => setAddOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-add-members-title"
            className="fixed top-1/2 z-[56] max-h-[min(36rem,calc(100vh-2rem))] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-edge-subtle bg-surface-panel p-5 shadow-elevated"
            style={{ left: mainColumnCenterX }}
          >
            <h2 id="admin-add-members-title" className="text-lg font-semibold text-fg">
              {t('admin.addMembersTitle')}
            </h2>
            <p className="mt-1 text-xs text-fg-secondary">{t('admin.batchFormatHint')}</p>
            <p className="mt-1 text-xs text-fg-subtle">{t('admin.defaultPasswordExplain')}</p>

            <label className="mt-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-fg-subtle">{t('admin.accountRole')}</span>
              <select
                className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                value={batchRole}
                onChange={(e) => setBatchRole(e.target.value as AccountRole)}
              >
                <option value="admin">{t('admin.roleAdmin')}</option>
                <option value="member">{t('admin.roleMember')}</option>
                <option value="guest">{t('admin.roleGuest')}</option>
              </select>
            </label>

            <label className="mt-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-fg-subtle">{t('admin.batchLinesLabel')}</span>
              <textarea
                rows={10}
                spellCheck={false}
                placeholder={t('admin.batchLinesPlaceholder')}
                className="resize-y rounded-xl border border-edge bg-surface-base px-3 py-2 font-mono text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
              />
            </label>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-fg hover:bg-surface-hover"
                onClick={() => setAddOpen(false)}
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                disabled={batchMut.isPending}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                onClick={() => batchMut.mutate()}
              >
                {batchMut.isPending ? t('auth.loading') : t('admin.batchSubmit')}
              </button>
            </div>
          </div>
        </>
      )}

      {canManage && editing && (
        <>
          <button
            type="button"
            aria-label={t('dialog.closeOverlay')}
            className="fixed top-0 right-0 bottom-0 z-[55] bg-[var(--overlay-scrim)]"
            style={{ left: sidebarWidthPx }}
            onClick={() => setEditing(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-edit-member-title"
            className="fixed top-24 z-[56] w-full max-w-md -translate-x-1/2 rounded-2xl border border-edge-subtle bg-surface-panel p-5 shadow-elevated"
            style={{ left: mainColumnCenterX }}
          >
            <h2 id="admin-edit-member-title" className="text-lg font-semibold text-fg">
              {t('admin.editMemberTitle')}
            </h2>

            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-fg-subtle">{t('admin.email')}</span>
                <input
                  type="email"
                  autoComplete="off"
                  className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
                <span className="text-xs text-fg-subtle">{t('admin.editEmailHint')}</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-fg-subtle">
                  {t('admin.displayName')}
                </span>
                <input
                  type="text"
                  className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-fg-subtle">{t('admin.accountRole')}</span>
                <select
                  className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as AccountRole)}
                >
                  <option value="admin">{t('admin.roleAdmin')}</option>
                  <option value="member">{t('admin.roleMember')}</option>
                  <option value="guest">{t('admin.roleGuest')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-fg-subtle">
                  {t('admin.resetPasswordOptional')}
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder={t('admin.resetPasswordPlaceholder')}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-fg hover:bg-surface-hover"
                onClick={() => setEditing(null)}
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                disabled={
                  patchMut.isPending || !editDisplayName.trim() || !editEmail.trim()
                }
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                onClick={() => patchMut.mutate()}
              >
                {patchMut.isPending ? t('auth.loading') : t('admin.saveMember')}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
