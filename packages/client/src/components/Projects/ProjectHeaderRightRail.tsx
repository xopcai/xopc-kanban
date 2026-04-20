import { Bot, HelpCircle, Menu, User } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectMembers, useWorkspaceActors } from '../../hooks/useTasks';
import { projectMemberLabel } from '../../lib/projectMembers';
import type { ProjectMember } from '../../types';
import { ProjectMembersPanel } from './ProjectMembersPanel';

const VISIBLE_AVATARS = 5;

export function ProjectHeaderRightRail({
  projectId,
  onOpenCommandPalette,
  onOpenShortcuts,
}: {
  projectId: string;
  onOpenCommandPalette: () => void;
  onOpenShortcuts: () => void;
}) {
  const { t } = useTranslation();
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: actors } = useWorkspaceActors();
  const [panelOpen, setPanelOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [panelOpen]);

  const sortedMembers = useMemo(() => {
    const roleOrder = (r: ProjectMember['role']) =>
      r === 'owner' ? 0 : r === 'admin' ? 1 : 2;
    return [...members].sort(
      (a, b) => roleOrder(a.role) - roleOrder(b.role),
    );
  }, [members]);

  const visible = sortedMembers.slice(0, VISIBLE_AVATARS);
  const extra = Math.max(0, sortedMembers.length - VISIBLE_AVATARS);

  return (
    <div
      ref={wrapRef}
      className="relative flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3"
    >
      <button
        type="button"
        onClick={() => setPanelOpen((o) => !o)}
        className="flex items-center rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
      >
        <span className="flex -space-x-2">
          {visible.length === 0 && (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-edge-subtle bg-surface-base text-fg-subtle"
              title={t('members.sidebarTitle')}
            >
              <User className="h-3.5 w-3.5" />
            </span>
          )}
          {visible.map((m) => (
            <span
              key={`${m.actorType}:${m.actorId}`}
              className={`relative z-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-panel text-[10px] font-semibold ring-0 first:z-[1] ${
                m.actorType === 'agent'
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-active text-fg-secondary'
              }`}
              title={projectMemberLabel(m, actors)}
            >
              {m.actorType === 'agent' ? (
                <Bot className="h-3.5 w-3.5" />
              ) : (
                <span className="leading-none">
                  {projectMemberLabel(m, actors)
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
              )}
            </span>
          ))}
          {extra > 0 && (
            <span className="z-[2] flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-panel bg-surface-hover text-xs font-medium text-fg-secondary">
              +{extra}
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="rounded-full border border-edge-subtle bg-surface-panel px-3 py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg"
      >
        {t('projectHeader.invite')}
      </button>

      <div className="hidden h-6 w-px bg-edge-subtle sm:block" />

      <div className="flex items-center gap-0.5 sm:gap-1">
        <HeaderIconButton
          label={t('projectHeader.appMenu')}
          onClick={onOpenCommandPalette}
        >
          <Menu className="h-4 w-4" />
        </HeaderIconButton>
        <HeaderIconButton
          label={t('projectHeader.help')}
          onClick={onOpenShortcuts}
        >
          <HelpCircle className="h-4 w-4" />
        </HeaderIconButton>
      </div>

      {panelOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(calc(100vw-2rem),20rem)] overflow-hidden rounded-2xl border border-edge-subtle shadow-elevated">
          <ProjectMembersPanel projectId={projectId} className="max-h-[70vh]" />
        </div>
      )}
    </div>
  );
}

function HeaderIconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {children}
    </button>
  );
}
