import { ChevronDown, ChevronLeft, Info, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  PROJECTS_HOME_PATH,
  projectWorkspacePath,
} from '../../lib/workspaceRoutes';
import type { Project, ProjectPriority, ProjectStatus } from '../../types';
import { usePatchProject, useProjectsList } from '../../hooks/useTasks';
import { useAuthStore } from '../../store/authStore';
import { useDialogStore } from '../../store/dialogStore';
import { useUiStore } from '../../store/uiStore';

const FAVORITES_KEY = 'xopc-favorite-projects';

function loadFavoriteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function saveFavoriteIds(ids: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

const PROJECT_STATUSES: ProjectStatus[] = [
  'planned',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
];

const PROJECT_PRIORITIES: ProjectPriority[] = [
  'urgent',
  'high',
  'medium',
  'low',
  'none',
];

function avatarCoverGradient(id: string): string {
  const hues = [220, 280, 190, 30, 340, 160];
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const h = hues[n % hues.length]!;
  const h2 = (h + 48) % 360;
  return `linear-gradient(135deg, hsl(${h} 42% 42%), hsl(${h2} 38% 32%))`;
}

function ProjectAvatar({
  project,
  className = '',
}: {
  project: Project | null;
  className?: string;
}) {
  if (!project) {
    return (
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-edge-subtle bg-surface-base text-xs text-fg-subtle ${className}`}
      >
        …
      </div>
    );
  }
  if (project.icon?.trim()) {
    return (
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-edge-subtle bg-surface-base text-xl leading-none ${className}`}
      >
        {project.icon}
      </div>
    );
  }
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-edge-subtle text-sm font-semibold text-white ${className}`}
      style={{ background: avatarCoverGradient(project.id) }}
    >
      {project.title.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function ProjectHeaderBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const viewMode = useUiStore((s) => s.viewMode);
  const currentProjectId = useUiStore((s) => s.currentProjectId);
  const setCurrentProjectId = useUiStore((s) => s.setCurrentProjectId);

  const { data: projects = [], isLoading } = useProjectsList();
  const patch = usePatchProject();

  const active = useMemo(
    () => projects.filter((p) => p.status !== 'cancelled'),
    [projects],
  );
  const current = useMemo(
    () => active.find((p) => p.id === currentProjectId) ?? null,
    [active, currentProjectId],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [favorites, setFavorites] = useState(loadFavoriteIds);
  const pickerWrapRef = useRef<HTMLDivElement>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [formStatus, setFormStatus] = useState<ProjectStatus>('planned');
  const [formPriority, setFormPriority] = useState<ProjectPriority>('none');

  const isStarred = currentProjectId ? favorites.has(currentProjectId) : false;

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!pickerWrapRef.current?.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  useEffect(() => {
    if (!current || !editOpen) return;
    setFormTitle(current.title);
    setFormDescription(current.description ?? '');
    setFormIcon(current.icon ?? '');
    setFormStatus(current.status);
    setFormPriority(current.priority);
  }, [current, editOpen]);

  const toggleStar = () => {
    if (!currentProjectId) return;
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(currentProjectId)) next.delete(currentProjectId);
      else next.add(currentProjectId);
      saveFavoriteIds(next);
      return next;
    });
  };

  const saveProject = () => {
    if (!current || !formTitle.trim()) return;
    patch.mutate(
      {
        id: current.id,
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        icon: formIcon.trim() || null,
        status: formStatus,
        priority: formPriority,
      },
      {
        onSuccess: () => setEditOpen(false),
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
      <span className="text-sm text-fg-subtle">{t('loading.generic')}</span>
    );
  }

  if (active.length === 0) {
    return (
      <span className="text-sm text-fg-secondary">{t('projects.noProjects')}</span>
    );
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => navigate(PROJECTS_HOME_PATH)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge-subtle bg-surface-panel text-fg-secondary shadow-sm transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={t('projects.backToProjects')}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <ProjectAvatar project={current} />

        <div
          className="relative flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5"
          ref={pickerWrapRef}
        >
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="flex min-w-0 max-w-[min(100%,18rem)] items-center gap-1 rounded-xl py-1 pl-1 pr-2 text-left transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:max-w-md"
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
          >
            <span className="truncate text-base font-semibold text-fg sm:text-lg">
              {current?.title ?? t('projects.pickProject')}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-fg-subtle transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <button
            type="button"
            disabled={!user || !current}
            title={t('projects.editInfoAria')}
            onClick={() => user && current && setEditOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge-subtle bg-surface-panel text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('projects.editInfoAria')}
          >
            <Info className="h-4 w-4" />
          </button>

          <button
            type="button"
            disabled={!currentProjectId}
            onClick={toggleStar}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge-subtle bg-surface-panel transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 ${
              isStarred ? 'text-amber-500' : 'text-fg-secondary'
            }`}
            aria-label={
              isStarred ? t('projects.unstarProject') : t('projects.starProject')
            }
            aria-pressed={isStarred}
          >
            <Star
              className={`h-4 w-4 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`}
            />
          </button>

          {pickerOpen && (
            <ul
              className="absolute left-0 top-full z-50 mt-1 max-h-72 min-w-[min(100vw-8rem,280px)] overflow-y-auto rounded-xl border border-edge bg-surface-panel py-1 shadow-elevated"
              role="listbox"
            >
              {active.map((p) => (
                <li key={p.id} role="option" aria-selected={p.id === currentProjectId}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover ${
                      p.id === currentProjectId ? 'bg-surface-active/50' : ''
                    }`}
                    onClick={() => {
                      setCurrentProjectId(p.id);
                      setPickerOpen(false);
                      navigate(projectWorkspacePath(p.id, viewMode));
                    }}
                  >
                    <ProjectAvatar project={p} className="!h-8 !w-8 !text-base" />
                    <span className="min-w-0 flex-1 truncate font-medium text-fg">
                      {p.title}
                    </span>
                    {favorites.has(p.id) && (
                      <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {editOpen && current ? (
        <>
          <button
            type="button"
            aria-label={t('createModal.closeAria')}
            className="fixed inset-0 z-[55] bg-[var(--overlay-scrim)]"
            onClick={() => setEditOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-project-title"
            className="fixed left-1/2 top-24 z-[56] w-full max-w-md -translate-x-1/2 rounded-2xl border border-edge-subtle bg-surface-panel p-5 shadow-elevated"
          >
            <h2
              id="edit-project-title"
              className="text-lg font-semibold text-fg"
            >
              {t('projects.editModalTitle')}
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-fg-subtle">
                  {t('projects.fieldTitle')}
                </span>
                <input
                  className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-fg-subtle">
                  {t('projects.fieldDescription')}
                </span>
                <textarea
                  rows={3}
                  className="resize-y rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-fg-subtle">
                  {t('projects.fieldIcon')}
                </span>
                <input
                  className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  placeholder={t('projects.fieldIconPlaceholder')}
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-fg-subtle">
                  {t('projects.fieldStatus')}
                </span>
                <select
                  className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={formStatus}
                  onChange={(e) =>
                    setFormStatus(e.target.value as ProjectStatus)
                  }
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`projectStatus.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-fg-subtle">
                  {t('projects.fieldPriority')}
                </span>
                <select
                  className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={formPriority}
                  onChange={(e) =>
                    setFormPriority(e.target.value as ProjectPriority)
                  }
                >
                  {PROJECT_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {t(`priority.${p}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-fg hover:bg-surface-hover"
                onClick={() => setEditOpen(false)}
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                disabled={!formTitle.trim() || patch.isPending}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                onClick={() => saveProject()}
              >
                {t('projects.save')}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

