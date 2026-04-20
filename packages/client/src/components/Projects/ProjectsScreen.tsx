import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceActorsResponse } from '../../api/client';
import {
  useAddProjectMember,
  useArchiveProject,
  useCreateProject,
  usePatchProject,
  usePatchProjectMemberRole,
  useProjectMembers,
  useProjectsList,
  useRemoveProjectMember,
  useWorkspaceActors,
} from '../../hooks/useTasks';
import { actorsToWorkspaceMembers } from '../../lib/members';
import type { Project, ProjectMember } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useDialogStore } from '../../store/dialogStore';
import { useUiStore } from '../../store/uiStore';

function memberLabel(
  m: ProjectMember,
  actors: WorkspaceActorsResponse | undefined,
): string {
  if (!actors) return `${m.actorType}:${m.actorId.slice(0, 8)}`;
  if (m.actorType === 'member') {
    const row = actors.members.find((x) => x.id === m.actorId);
    return row?.displayName ?? m.actorId;
  }
  const row = actors.agents.find((x) => x.id === m.actorId);
  return row?.name ?? m.actorId;
}

export function ProjectsScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setCurrentProjectId = useUiStore((s) => s.setCurrentProjectId);
  const { data: projects = [], isLoading } = useProjectsList();
  const { data: actors } = useWorkspaceActors();
  const create = useCreateProject();
  const patch = usePatchProject();
  const archive = useArchiveProject();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [addPick, setAddPick] = useState('');

  useEffect(() => {
    if (!projects.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !projects.some((p) => p.id === selectedId)) {
      setSelectedId(projects[0]!.id);
    }
  }, [projects, selectedId]);

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const { data: members = [] } = useProjectMembers(selectedId);
  const addMember = useAddProjectMember(selectedId ?? '');
  const removeMember = useRemoveProjectMember(selectedId ?? '');
  const patchRole = usePatchProjectMemberRole(selectedId ?? '');

  const canManageProjects = user?.typ === 'member';

  const memberIdSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of members) {
      s.add(`${m.actorType}:${m.actorId}`);
    }
    return s;
  }, [members]);

  const addOptions = useMemo(() => {
    if (!actors) return [];
    const out: { key: string; label: string; actorType: 'member' | 'agent'; actorId: string }[] = [];
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

  const workspaceMembers = useMemo(
    () => (actors ? actorsToWorkspaceMembers(actors) : []),
    [actors],
  );

  const renameProject = async (p: Project) => {
    const title = await useDialogStore.getState().prompt({
      title: t('projects.renameTitle'),
      defaultValue: p.title,
      placeholder: t('projects.titlePlaceholder'),
      confirmLabel: t('projects.save'),
    });
    if (!title?.trim()) return;
    patch.mutate(
      { id: p.id, title: title.trim() },
      {
        onError: (err) => {
          void useDialogStore.getState().alert({
            message: err instanceof Error ? err.message : t('auth.error'),
          });
        },
      },
    );
  };

  const onArchive = async (p: Project) => {
    const ok = await useDialogStore.getState().confirm({
      message: t('projects.archiveConfirm', { title: p.title }),
      danger: true,
      confirmLabel: t('projects.archive'),
    });
    if (!ok) return;
    archive.mutate(p.id, {
      onSuccess: () => {
        if (useUiStore.getState().currentProjectId === p.id) {
          const rest = projects.filter((x) => x.id !== p.id && x.status !== 'cancelled');
          setCurrentProjectId(rest[0]?.id ?? null);
        }
      },
      onError: (err) => {
        void useDialogStore.getState().alert({
          message: err instanceof Error ? err.message : t('auth.error'),
        });
      },
    });
  };

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-fg">{t('projects.heading')}</h2>
        <p className="mt-1 text-sm text-fg-secondary">{t('projects.subtitle')}</p>
      </div>

      {canManageProjects && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-fg-subtle">
              {t('projects.newTitle')}
            </span>
            <input
              className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('projects.titlePlaceholder')}
            />
          </label>
          <button
            type="button"
            disabled={!newTitle.trim() || create.isPending}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            onClick={() => {
              const title = newTitle.trim();
              if (!title) return;
              create.mutate(
                { title },
                {
                  onSuccess: () => setNewTitle(''),
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
            {t('projects.create')}
          </button>
        </div>
      )}

      {!canManageProjects && (
        <p className="text-sm text-fg-secondary">{t('projects.agentHint')}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-fg-subtle">{t('loading.generic')}</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-fg-secondary">{t('projects.emptyList')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-edge-subtle bg-surface-base text-xs uppercase tracking-wide text-fg-subtle">
              <tr>
                <th className="px-3 py-2 font-semibold">{t('projects.colTitle')}</th>
                <th className="px-3 py-2 font-semibold">{t('projects.colStatus')}</th>
                <th className="px-3 py-2 font-semibold">{t('detail.fieldAssignee')}</th>
                {canManageProjects && (
                  <th className="px-3 py-2 font-semibold">{t('projects.colActions')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className={`cursor-pointer border-b border-edge-subtle last:border-0 ${
                    selectedId === p.id ? 'bg-surface-active/60' : 'hover:bg-surface-hover'
                  }`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <td className="px-3 py-2 font-medium text-fg">{p.title}</td>
                  <td className="px-3 py-2 text-fg-secondary">
                    {t(`projectStatus.${p.status}`)}
                  </td>
                  <td className="px-3 py-2 text-fg-secondary">
                    {p.leadId && p.leadType
                      ? (() => {
                          const m = workspaceMembers.find(
                            (w) => w.type === p.leadType && w.id === p.leadId,
                          );
                          return m?.name ?? p.leadId;
                        })()
                      : '—'}
                  </td>
                  {canManageProjects && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-accent hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            void renameProject(p);
                          }}
                        >
                          {t('projects.rename')}
                        </button>
                        {p.status !== 'cancelled' && (
                          <button
                            type="button"
                            className="text-xs font-medium text-fg-secondary hover:text-fg"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onArchive(p);
                            }}
                          >
                            {t('projects.archive')}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-fg">
            {t('projects.membersHeading', { title: selected.title })}
          </h3>

          {canManageProjects && addOptions.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[220px] flex-1 flex-col gap-1">
                <span className="text-xs font-medium text-fg-subtle">
                  {t('projects.addMember')}
                </span>
                <select
                  className="rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-fg hover:bg-surface-hover disabled:opacity-50"
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
                {t('projects.add')}
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-edge">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="border-b border-edge-subtle bg-surface-base text-xs uppercase tracking-wide text-fg-subtle">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t('projects.colActor')}</th>
                  <th className="px-3 py-2 font-semibold">{t('projects.colRole')}</th>
                  {canManageProjects && (
                    <th className="px-3 py-2 font-semibold">{t('projects.colActions')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={`${m.actorType}:${m.actorId}`} className="border-b border-edge-subtle last:border-0">
                    <td className="px-3 py-2 text-fg">
                      {memberLabel(m, actors)}
                      <span className="ml-2 text-xs text-fg-subtle">({m.actorType})</span>
                    </td>
                    <td className="px-3 py-2">
                      {m.role === 'owner' || !canManageProjects ? (
                        <span className="text-fg-secondary">{t(`projects.role.${m.role}`)}</span>
                      ) : (
                        <select
                          className="rounded-lg border border-edge bg-surface-panel px-2 py-1 text-xs text-fg"
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
                          <option value="member">{t('projects.role.member')}</option>
                        </select>
                      )}
                    </td>
                    {canManageProjects && (
                      <td className="px-3 py-2">
                        {m.role !== 'owner' && (
                          <button
                            type="button"
                            className="text-xs font-medium text-fg-secondary hover:text-fg"
                            onClick={() => {
                              removeMember.mutate(
                                {
                                  actorType: m.actorType,
                                  actorId: m.actorId,
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
                            {t('actions.remove')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
