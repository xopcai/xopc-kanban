import type { WorkspaceActorsResponse } from '../api/client';
import type { ActorType } from '../types';

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
