import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { isWritableAuthUser } from '../../lib/authPermissions';
import { projectWorkspacePath } from '../../lib/workspaceRoutes';
import type { Project } from '../../types';
import {
  useArchiveProject,
  useCreateProject,
  usePatchProject,
  useProjectsList,
} from '../../hooks/useTasks';
import { useAuthStore } from '../../store/authStore';
import { useDialogStore } from '../../store/dialogStore';
import { useUiStore } from '../../store/uiStore';

function coverStyle(p: Project): { background: string } {
  if (p.icon?.trim()) {
    return {
      background: `linear-gradient(145deg, var(--surface-hover), var(--surface-base))`,
    };
  }
  const hues = [220, 280, 190, 30, 340, 160];
  const n = p.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const h = hues[n % hues.length]!;
  const h2 = (h + 48) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${h} 42% 42%), hsl(${h2} 38% 32%))`,
  };
}

export function ProjectHomeGrid() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setCurrentProjectId = useUiStore((s) => s.setCurrentProjectId);
  const { data: projects = [], isLoading } = useProjectsList();
  const create = useCreateProject();
  const patch = usePatchProject();
  const archive = useArchiveProject();
  const [menuId, setMenuId] = useState<string | null>(null);

  const canManage =
    user?.typ === 'member' && isWritableAuthUser(user);
  const active = projects.filter((p) => p.status !== 'cancelled');

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
        useUiStore.getState().clearLastWorkspaceProjectIfMatch(p.id);
        if (useUiStore.getState().currentProjectId === p.id) {
          setCurrentProjectId(null);
        }
      },
      onError: (err) => {
        void useDialogStore.getState().alert({
          message: err instanceof Error ? err.message : t('auth.error'),
        });
      },
    });
  };

  const startCreate = async () => {
    if (!canManage) return;
    const title = await useDialogStore.getState().prompt({
      title: t('projects.create'),
      placeholder: t('projects.titlePlaceholder'),
      defaultValue: '',
      confirmLabel: t('actions.create'),
    });
    if (!title?.trim()) return;
    create.mutate(
      { title: title.trim() },
      {
        onError: (err) => {
          void useDialogStore.getState().alert({
            message: err instanceof Error ? err.message : t('auth.error'),
          });
        },
      },
    );
  };

  if (isLoading && active.length === 0) {
    return (
      <p className="text-sm text-fg-secondary">{t('loading.generic')}</p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          {t('projects.homeTitle')}
        </h1>
        <p className="mt-1 text-sm text-fg-secondary">{t('projects.homeSubtitle')}</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
        {active.map((p) => (
          <div
            key={p.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-edge-subtle bg-surface-panel shadow-sm transition-shadow hover:shadow-md"
          >
            <button
              type="button"
              onClick={() => navigate(projectWorkspacePath(p.id, 'board'))}
              className="flex flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <div
                className="relative flex h-28 items-center justify-center text-4xl"
                style={coverStyle(p)}
              >
                {p.icon?.trim() ? (
                  <span aria-hidden>{p.icon}</span>
                ) : (
                  <span className="text-3xl font-light text-white/90">
                    {p.title.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="border-t border-edge-subtle bg-surface-panel px-3 py-3">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-fg">
                  {p.title}
                </p>
                <p className="mt-1 text-xs text-fg-subtle">
                  {t(`projectStatus.${p.status}`)}
                </p>
              </div>
            </button>
            {canManage && (
              <div className="absolute right-2 top-2">
                <button
                  type="button"
                  aria-label={t('projects.cardMenu')}
                  className="rounded-lg bg-black/35 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuId(menuId === p.id ? null : p.id);
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuId === p.id && (
                  <>
                    <button
                      type="button"
                      aria-label={t('dialog.closeOverlay')}
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setMenuId(null)}
                    />
                    <div className="absolute right-0 z-50 mt-1 min-w-[9rem] rounded-xl border border-edge bg-surface-panel py-1 shadow-elevated">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface-hover"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId(null);
                          void renameProject(p);
                        }}
                      >
                        {t('projects.rename')}
                      </button>
                      {p.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm text-danger hover:bg-surface-hover"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(null);
                            void onArchive(p);
                          }}
                        >
                          {t('projects.archive')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {canManage && (
          <button
            type="button"
            onClick={() => void startCreate()}
            disabled={create.isPending}
            className="flex min-h-[11rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-edge-subtle bg-surface-base/50 text-fg-secondary transition-colors hover:border-accent/50 hover:bg-surface-hover/80 hover:text-fg disabled:opacity-50"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-panel text-accent shadow-sm">
              <Plus className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <span className="text-sm font-medium">{t('projects.createCard')}</span>
          </button>
        )}
      </div>

      {!canManage && active.length === 0 && (
        <p className="mt-8 text-sm text-fg-secondary">{t('projects.agentNoProjects')}</p>
      )}
      {canManage && active.length === 0 && !isLoading && (
        <p className="mt-8 text-sm text-fg-secondary">{t('projects.emptyList')}</p>
      )}
    </div>
  );
}
