import type { WorkspaceActorsResponse } from '../api/client';
import type { ActorType, ProjectMember } from '../types';

export interface WorkspaceMember {
  id: string;
  name: string;
  type: ActorType;
}

export function actorsToWorkspaceMembers(
  a: WorkspaceActorsResponse,
): WorkspaceMember[] {
  return [
    ...a.members.map((m) => ({
      id: m.id,
      name: m.displayName,
      type: 'member' as const,
    })),
    ...a.agents.map((g) => ({
      id: g.id,
      name: g.name,
      type: 'agent' as const,
    })),
  ];
}

/** Resolve project ACL rows to assignee picker rows using global actor directory. */
export function projectMembersToWorkspaceMembers(
  members: ProjectMember[],
  actors: WorkspaceActorsResponse | undefined,
): WorkspaceMember[] {
  return members.map((m) => {
    if (m.actorType === 'member') {
      const row = actors?.members.find((x) => x.id === m.actorId);
      return {
        id: m.actorId,
        type: 'member' as const,
        name: row?.displayName ?? m.actorId.slice(0, 8),
      };
    }
    const row = actors?.agents.find((x) => x.id === m.actorId);
    return {
      id: m.actorId,
      type: 'agent' as const,
      name: row?.name ?? m.actorId.slice(0, 8),
    };
  });
}
