import { Bot, Crown, Search, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAddProjectMember,
  usePatchProjectMemberRole,
  useProjectMembers,
  useRemoveProjectMember,
  useWorkspaceActors,
} from '../../hooks/useTasks';
import {
  projectMemberLabel,
  projectMemberSubtitle,
} from '../../lib/projectMembers';
import type { ProjectMember } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useDialogStore } from '../../store/dialogStore';
import clsx from 'clsx';

export function ProjectMembersPanel({
  projectId,
  className,
}: {
  projectId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: actors } = useWorkspaceActors();
  const addMember = useAddProjectMember(projectId);
  const removeMember = useRemoveProjectMember(projectId);
  const patchRole = usePatchProjectMemberRole(projectId);
  const [addPick, setAddPick] = useState('');
  const [q, setQ] = useState('');

  const canManageProject = useMemo(() => {
    if (user?.typ !== 'member') return false;
    if (user.accountRole === 'guest') return false;
    const self = members.find(
      (m) => m.actorType === 'member' && m.actorId === user.id,
    );
    return self?.role === 'owner' || self?.role === 'admin';
  }, [members, user]);

  const memberIdSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of members) {
      s.add(`${m.actorType}:${m.actorId}`);
    }
    return s;
  }, [members]);

  const addOptions = useMemo(() => {
    if (!actors) return [];
    const out: {
      key: string;
      label: string;
      actorType: 'member' | 'agent';
      actorId: string;
    }[] = [];
    for (const m of actors.members) {
      const key = `member:${m.id}`;
      if (!memberIdSet.has(key)) {
        out.push({
          key,
          label: `${m.displayName} (${m.email})`,
          actorType: 'member',
          actorId: m.id,
        });
      }
    }
    for (const a of actors.agents) {
      const key = `agent:${a.id}`;
      if (!memberIdSet.has(key)) {
        out.push({
          key,
          label: `${a.name} (agent)`,
          actorType: 'agent',
          actorId: a.id,
        });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [actors, memberIdSet]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) =>
      projectMemberLabel(m, actors).toLowerCase().includes(needle),
    );
  }, [members, q, actors]);

  return (
    <div
      className={clsx(
        'flex max-h-[min(70vh,32rem)] flex-col bg-surface-panel',
        className,
      )}
    >
      <div className="border-b border-edge-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">
          {t('members.sidebarTitle')}
        </h2>
        <p className="mt-0.5 text-xs text-fg-subtle">
          {t('members.sidebarHint')}
        </p>
      </div>

      <div className="border-b border-edge-subtle p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            className="w-full rounded-xl border border-edge bg-surface-base py-2 pl-8 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            placeholder={t('members.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {canManageProject && addOptions.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-edge-subtle p-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fg-subtle">
              {t('projects.addMember')}
            </span>
            <select
              className="rounded-xl border border-edge bg-surface-base px-2 py-2 text-xs text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={addPick}
              onChange={(e) => setAddPick(e.target.value)}
            >
              <option value="">{t('graph.selectPlaceholder')}</option>
              {addOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!addPick || addMember.isPending}
            className="rounded-xl bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            onClick={() => {
              const opt = addOptions.find((o) => o.key === addPick);
              if (!opt) return;
              addMember.mutate(
                {
                  actorType: opt.actorType,
                  actorId: opt.actorId,
                  role: 'member',
                },
                {
                  onSuccess: () => setAddPick(''),
                  onError: (err) => {
                    void useDialogStore.getState().alert({
                      message:
                        err instanceof Error ? err.message : t('auth.error'),
                    });
                  },
                },
              );
            }}
          >
            {t('members.inviteAdd')}
          </button>
        </div>
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.map((m: ProjectMember) => (
          <li
            key={`${m.actorType}:${m.actorId}`}
            className="mb-1 flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-surface-hover"
          >
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                m.actorType === 'agent'
                  ? 'bg-accent/15 text-accent'
                  : 'bg-surface-panel text-fg-secondary'
              }`}
            >
              {m.actorType === 'agent' ? (
                <Bot className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="truncate text-sm font-medium text-fg">
                  {projectMemberLabel(m, actors)}
                </p>
                {m.role === 'owner' && (
                  <Crown
                    className="h-3.5 w-3.5 shrink-0 text-amber-500"
                    aria-label={t('projects.role.owner')}
                  />
                )}
              </div>
              {projectMemberSubtitle(m, actors) && (
                <p className="truncate text-xs text-fg-subtle">
                  {projectMemberSubtitle(m, actors)}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
                  {t(`projects.role.${m.role}`)}
                </span>
                {canManageProject && m.role !== 'owner' && (
                  <>
                    <select
                      className="max-w-[5.5rem] rounded border border-edge bg-surface-panel px-1 py-0.5 text-[10px] text-fg"
                      value={m.role === 'admin' ? 'admin' : 'member'}
                      onChange={(e) => {
                        const role = e.target.value as 'admin' | 'member';
                        patchRole.mutate(
                          {
                            actorType: m.actorType,
                            actorId: m.actorId,
                            role,
                          },
                          {
                            onError: (err) => {
                              void useDialogStore.getState().alert({
                                message:
                                  err instanceof Error
                                    ? err.message
                                    : t('auth.error'),
                              });
                            },
                          },
                        );
                      }}
                    >
                      <option value="admin">{t('projects.role.admin')}</option>
                      <option value="member">
                        {t('projects.role.member')}
                      </option>
                    </select>
                    <button
                      type="button"
                      className="text-[10px] font-medium text-fg-subtle hover:text-danger"
                      onClick={() => {
                        removeMember.mutate(
                          { actorType: m.actorType, actorId: m.actorId },
                          {
                            onError: (err) => {
                              void useDialogStore.getState().alert({
                                message:
                                  err instanceof Error
                                    ? err.message
                                    : t('auth.error'),
                              });
                            },
                          },
                        );
                      }}
                    >
                      {t('actions.remove')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
