import type {
  DependencyType,
  Label,
  Task,
  TaskComment,
  TaskDependencyEdge,
  TaskGraphResponse,
  TaskPriority,
  TaskStatus,
} from '../types';

const jsonHeaders = { 'Content-Type': 'application/json' };

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export type ListTasksParams = {
  rootOnly?: boolean;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | '__none__';
  labelId?: string;
};

function buildTaskQuery(params?: ListTasksParams): string {
  const q = new URLSearchParams();
  if (params?.rootOnly === true) q.set('rootOnly', '1');
  if (params?.status) q.set('status', params.status);
  if (params?.priority) q.set('priority', params.priority);
  if (params?.assigneeId === '__none__') q.set('assigneeId', '__none__');
  else if (params?.assigneeId) q.set('assigneeId', params.assigneeId);
  if (params?.labelId) q.set('labelId', params.labelId);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const api = {
  listTasks(params?: ListTasksParams) {
    return fetch(`/api/tasks${buildTaskQuery(params)}`).then((r) =>
      parseJson<Task[]>(r),
    );
  },

  bulkTasks(body: {
    ids: string[];
    action: 'delete' | 'set_status';
    status?: TaskStatus;
  }) {
    return fetch('/api/tasks/batch', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }).then((r) => parseJson<{ ok: boolean }>(r));
  },

  listLabels() {
    return fetch('/api/labels').then((r) => parseJson<Label[]>(r));
  },

  createLabel(body: { name: string; color: string }) {
    return fetch('/api/labels', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }).then((r) => parseJson<Label>(r));
  },

  getTaskGraph(taskId: string) {
    return fetch(`/api/tasks/${taskId}/graph`).then((r) =>
      parseJson<TaskGraphResponse>(r),
    );
  },

  listDependencies(taskId: string) {
    return fetch(`/api/tasks/${taskId}/dependencies`).then((r) =>
      parseJson<TaskDependencyEdge[]>(r),
    );
  },

  addDependency(
    taskId: string,
    body: { dependsOnId: string; type?: DependencyType },
  ) {
    return fetch(`/api/tasks/${taskId}/dependencies`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }).then((r) => parseJson<TaskDependencyEdge>(r));
  },

  removeDependency(taskId: string, edgeId: string) {
    return fetch(`/api/tasks/${taskId}/dependencies/${edgeId}`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
    });
  },

  getTask(id: string) {
    return fetch(`/api/tasks/${id}`).then((r) => parseJson<Task>(r));
  },

  createTask(body: {
    title: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    intent?: string;
    parentId?: string | null;
    labelIds?: string[];
  }) {
    return fetch('/api/tasks', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }).then((r) => parseJson<Task>(r));
  },

  createSubtask(
    parentId: string,
    body: { title: string; description?: string | null },
  ) {
    return fetch(`/api/tasks/${parentId}/subtasks`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }).then((r) => parseJson<Task>(r));
  },

  patchTask(
    id: string,
    body: Partial<{
      title: string;
      description: string | null;
      priority: TaskPriority;
      intent: string;
      position: number;
      assigneeType: 'member' | 'agent' | null;
      assigneeId: string | null;
      labelIds: string[];
    }>,
  ) {
    return fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }).then((r) => parseJson<Task>(r));
  },

  setTaskStatus(id: string, status: TaskStatus, note?: string) {
    return fetch(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ status, note }),
    }).then((r) => parseJson<Task>(r));
  },

  deleteTask(id: string) {
    return fetch(`/api/tasks/${id}`, { method: 'DELETE' }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
    });
  },

  listMemory(taskId: string) {
    return fetch(`/api/tasks/${taskId}/memory`).then((r) =>
      parseJson<TaskComment[]>(r),
    );
  },

  addMemory(taskId: string, content: string) {
    return fetch(`/api/tasks/${taskId}/memory`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ content }),
    }).then((r) => parseJson<TaskComment>(r));
  },

  deleteMemory(taskId: string, memId: string) {
    return fetch(`/api/tasks/${taskId}/memory/${memId}`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
    });
  },
};
