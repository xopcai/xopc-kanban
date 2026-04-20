import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { workspaceKeys } from '../../hooks/useTasks';
import type { AccountRole } from '../../store/authStore';
import { useDialogStore } from '../../store/dialogStore';
import { useUiStore } from '../../store/uiStore';
import clsx from 'clsx';

function roleLabel(t: (k: string) => string, role: AccountRole): string {
  if (role === 'admin') return t('admin.roleBadgeAdmin');
  if (role === 'guest') return t('admin.roleBadgeGuest');
  return t('admin.roleBadgeMember');
}

export function AdminAccountsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    useUiStore.getState().setWorkspaceScreen('projects');
    useUiStore.getState().setCurrentProjectId(null);
    useUiStore.getState().selectTask(null);
  }, []);
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [accountRole, setAccountRole] = useState<'member' | 'guest'>('member');
  const [lastPassword, setLastPassword] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin', 'members'],
    queryFn: () => api.listAdminMembers(),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.createAdminMember({
        email: email.trim(),
        displayName: displayName.trim(),
        password: password.trim() || undefined,
        accountRole,
      }),
    onSuccess: async (data) => {
      setEmail('');
      setDisplayName('');
      setPassword('');
      if (data.initialPassword) setLastPassword(data.initialPassword);
      await qc.invalidateQueries({ queryKey: ['admin', 'members'] });
      void qc.invalidateQueries({ queryKey: workspaceKeys.actors });
    },
    onError: async (e) => {
      await useDialogStore.getState().alert({
        message: e instanceof Error ? e.message : t('auth.error'),
      });
    },
  });

  return (
    <main className="flex-1 overflow-auto px-4 pb-10 pt-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-fg-secondary hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('admin.backToProjects')}
        </button>

        <h1 className="text-xl font-semibold text-fg">{t('admin.accountsTitle')}</h1>
        <p className="mt-1 text-sm text-fg-secondary">{t('admin.accountsHint')}</p>

        {lastPassword && (
          <div
            className={clsx(
              'mt-6 rounded-xl border border-accent/30 bg-accent/5 p-4',
            )}
          >
            <p className="text-sm font-medium text-fg">{t('admin.initialPasswordTitle')}</p>
            <p className="mt-1 text-xs text-fg-secondary">{t('admin.initialPasswordHint')}</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-base p-3 text-sm text-fg">
              {lastPassword}
            </pre>
            <button
              type="button"
              className="mt-3 rounded-xl border border-edge px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-hover"
              onClick={() => setLastPassword(null)}
            >
              {t('auth.close')}
            </button>
          </div>
        )}

        <form
          className="mt-8 flex flex-col gap-4 rounded-xl border border-edge-subtle bg-surface-panel p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim() || !displayName.trim()) return;
            createMut.mutate();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fg-subtle">{t('admin.email')}</span>
            <input
              type="email"
              required
              className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fg-subtle">
              {t('admin.displayName')}
            </span>
            <input
              type="text"
              required
              className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fg-subtle">
              {t('admin.optionalPassword')}
            </span>
            <input
              type="password"
              autoComplete="new-password"
              className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fg-subtle">{t('admin.accountRole')}</span>
            <select
              className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={accountRole}
              onChange={(e) => setAccountRole(e.target.value as 'member' | 'guest')}
            >
              <option value="member">{t('admin.roleMember')}</option>
              <option value="guest">{t('admin.roleGuest')}</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={createMut.isPending}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {createMut.isPending ? t('auth.loading') : t('admin.createUser')}
          </button>
        </form>

        <h2 className="mt-10 text-sm font-semibold text-fg">{t('admin.membersList')}</h2>
        {listQuery.isLoading ? (
          <p className="mt-2 text-sm text-fg-secondary">{t('loading.generic')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-edge-subtle rounded-xl border border-edge-subtle bg-surface-panel">
            {(listQuery.data?.members ?? []).map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{m.displayName}</p>
                  <p className="truncate text-xs text-fg-subtle">{m.email}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-surface-base px-2 py-0.5 text-xs font-medium text-fg-secondary">
                  {roleLabel(t, m.accountRole)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
