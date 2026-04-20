export type ActorType = 'member' | 'agent';

export interface Actor {
  type: ActorType;
  id: string;
}
