export type ActorType = 'member' | 'agent';

export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'blocked'
  | 'done'
  | 'cancelled';

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export type CommentType =
  | 'comment'
  | 'status_change'
  | 'progress_update'
  | 'system';

export type DependencyType = 'blocks' | 'blocked_by' | 'related';

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface ContextRef {
  type: 'url' | 'file' | 'snippet';
  title: string;
  value: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorType: ActorType;
  authorId: string;
  content: string;
  type: CommentType;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string | null;
  number: number;
  identifier: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  creatorType: ActorType;
  creatorId: string;
  assigneeType: ActorType | null;
  assigneeId: string | null;
  parentId: string | null;
  labels: Label[];
  dueDate: string | null;
  intent: string;
  acceptanceCriteria: string[];
  contextRefs: ContextRef[];
  children: Task[];
  comments: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskDependencyEdge {
  id: string;
  taskId: string;
  dependsOnId: string;
  type: DependencyType;
  createdAt: string;
}

export interface TaskGraphResponse {
  root: Task;
  nodes: Task[];
  edges: TaskDependencyEdge[];
}

export type TaskEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.status_changed'
  | 'task.dependency_changed'
  | 'memory.added';

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  payload: unknown;
  timestamp: string;
}
