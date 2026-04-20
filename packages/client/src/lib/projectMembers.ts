import type { WorkspaceActorsResponse } from '../api/client';
import type { ProjectMember } from '../types';

export function projectMemberLabel(
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

export function projectMemberSubtitle(
  m: ProjectMember,
  actors: WorkspaceActorsResponse | undefined,
): string | null {
  if (m.actorType !== 'member' || !actors) return null;
  return actors.members.find((x) => x.id === m.actorId)?.email ?? null;
}
