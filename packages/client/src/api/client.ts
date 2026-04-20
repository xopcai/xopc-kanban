import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../store/authStore';
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

function shouldClearSessionOn401(url: string): boolean {
  return (
    !url.includes('/api/auth/login') &&
    !url.includes('/api/auth/register') &&
    !url.includes('/api/auth/agent/exchange')
  );
}

export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init?.headers);
  const method = (init?.method ?? 'GET').toUpperCase();
  if (
    method !== 'GET' &&
    method !== 'HEAD' &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && shouldClearSessionOn401(input)) {
    useAuthStore.getState().clearSession();
  }
  return res;
}

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

export type WorkspaceActorsResponse = {
  members: {
    type: 'member';
    id: string;
    displayName: string;
    email: string;
  }[];
  agents: { type: 'agent'; id: string; name: string }[];
};

export const api = {
  register(body: { email: string; password: string; displayName: string }) {
    return apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) =>
      parseJson<{ token: string; user: { id: string; email: string; displayName: string } }>(
        r,
      ),
    );
  },

  login(body: { email: string; password: string }) {
    return apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) =>
      parseJson<{ token: string; user: { id: string; email: string; displayName: string } }>(
        r,
      ),
    );
  },

  me() {
    return apiFetch('/api/auth/me').then((r) => parseJson<AuthUser>(r));
  },

  listWorkspaceActors() {
    return apiFetch('/api/workspace/actors').then((r) =>
      parseJson<WorkspaceActorsResponse>(r),
    );
  },

  createAgent(body: { name: string }) {
    return apiFetch('/api/agents', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(
      (r) =>
        parseJson<{
          agent: { id: string; name: string; description: string | null };
          apiKey: string;
        }>(r),
    );
  },

  listAgents() {
    return apiFetch('/api/agents').then(
      (r) => parseJson<{ id: string; name: string; description: string | null }[]>(r),
    );
  },

  listTasks(params?: ListTasksParams) {
    return apiFetch(`/api/tasks${buildTaskQuery(params)}`).then((r) =>
      parseJson<Task[]>(r),
    );
  },

  bulkTasks(body: {
    ids: string[];
    action: 'delete' | 'set_status';
    status?: TaskStatus;
  }) {
    return apiFetch('/api/tasks/batch', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => parseJson<{ ok: boolean }>(r));
  },

  listLabels() {
    return apiFetch('/api/labels').then((r) => parseJson<Label[]>(r));
  },

  createLabel(body: { name: string; color: string }) {
    return apiFetch('/api/labels', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => parseJson<Label>(r));
  },

  getTaskGraph(taskId: string) {
    return apiFetch(`/api/tasks/${taskId}/graph`).then((r) =>
      parseJson<TaskGraphResponse>(r),
    );
  },

  listDependencies(taskId: string) {
    return apiFetch(`/api/tasks/${taskId}/dependencies`).then((r) =>
      parseJson<TaskDependencyEdge[]>(r),
    );
  },

  addDependency(
    taskId: string,
    body: { dependsOnId: string; type?: DependencyType },
  ) {
    return apiFetch(`/api/tasks/${taskId}/dependencies`, {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => parseJson<TaskDependencyEdge>(r));
  },

  removeDependency(taskId: string, edgeId: string) {
    return apiFetch(`/api/tasks/${taskId}/dependencies/${edgeId}`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
    });
  },

  getTask(id: string) {
    return apiFetch(`/api/tasks/${id}`).then((r) => parseJson<Task>(r));
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
    return apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => parseJson<Task>(r));
  },

  createSubtask(
    parentId: string,
    body: { title: string; description?: string | null },
  ) {
    return apiFetch(`/api/tasks/${parentId}/subtasks`, {
      method: 'POST',
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
    return apiFetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then((r) => parseJson<Task>(r));
  },

  setTaskStatus(id: string, status: TaskStatus, note?: string) {
    return apiFetch(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }).then((r) => parseJson<Task>(r));
  },

  deleteTask(id: string) {
    return apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
    });
  },

  listMemory(taskId: string) {
    return apiFetch(`/api/tasks/${taskId}/memory`).then((r) =>
      parseJson<TaskComment[]>(r),
    );
  },

  addMemory(taskId: string, content: string) {
    return apiFetch(`/api/tasks/${taskId}/memory`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }).then((r) => parseJson<TaskComment>(r));
  },

  deleteMemory(taskId: string, memId: string) {
    return apiFetch(`/api/tasks/${taskId}/memory/${memId}`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
    });
  },
};
