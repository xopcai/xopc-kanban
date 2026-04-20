import type { ActorType } from '../types';

export interface WorkspaceMember {
  id: string;
  name: string;
  type: ActorType;
}

/** MVP workspace directory — assignee picker */
export const WORKSPACE_MEMBERS: WorkspaceMember[] = [
  { id: 'local-user', name: 'You', type: 'member' },
  { id: 'agent-demo', name: 'Demo Agent', type: 'agent' },
];
