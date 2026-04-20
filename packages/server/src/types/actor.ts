import type { AccountRole } from './accountRole.js';

export type ActorType = 'member' | 'agent';

export interface Actor {
  type: ActorType;
  id: string;
  /** Present for human members after auth; omitted for agents. */
  accountRole?: AccountRole;
}
