import type {
  DependencyType,
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

export const api = {
  listTasks(params?: { rootOnly?: boolean }) {
    const q = new URLSearchParams();
    if (params?.rootOnly === true) q.set('rootOnly', '1');
    const suffix = q.toString() ? `?${q}` : '';
    return fetch(`/api/tasks${suffix}`).then((r) => parseJson<Task[]>(r));
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
  }) {
    return fetch('/api/tasks', {
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
