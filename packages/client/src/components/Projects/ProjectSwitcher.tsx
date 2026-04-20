import { useTranslation } from 'react-i18next';
import { useProjectsList } from '../../hooks/useTasks';
import { useUiStore } from '../../store/uiStore';

export function ProjectSwitcher() {
  const { t } = useTranslation();
  const currentProjectId = useUiStore((s) => s.currentProjectId);
  const setCurrentProjectId = useUiStore((s) => s.setCurrentProjectId);
  const { data: projects = [], isLoading } = useProjectsList();

  const active = projects.filter((p) => p.status !== 'cancelled');

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
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
        {t('projects.current')}
      </span>
      <select
        className="max-w-[min(100vw-12rem,280px)] rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        value={currentProjectId ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          setCurrentProjectId(v || null);
        }}
      >
        {active.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </label>
  );
}
