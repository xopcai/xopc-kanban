import { useAuthStore } from '../store/authStore';
import type { AccountRole, AuthUser } from '../store/authStore';
import type {
  DependencyType,
  Label,
  Project,
  ProjectMember,
  ProjectMemberRole,
  ProjectPriority,
  ProjectStatus,
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

/** Turn API error JSON (e.g. Zod `{ error: { issues: [...] } }`) into a short user-facing string. */
export function formatApiErrorBody(bodyText: string): string {
  const raw = bodyText.trim();
  if (!raw) return '';

  type ZodIssue = { message?: string; path?: unknown };
  type Parsed = {
    message?: string;
    error?:
      | string
      | {
          issues?: ZodIssue[];
          message?: string;
          name?: string;
        };
  };

  try {
    const j = JSON.parse(raw) as Parsed;
    if (typeof j.message === 'string' && j.message.trim()) {
      return j.message.trim();
    }
    const err = j.error;
    if (typeof err === 'string' && err.trim()) return err.trim();
    if (err && typeof err === 'object' && Array.isArray(err.issues)) {
      const msgs = err.issues
        .map((i) => (typeof i?.message === 'string' ? i.message.trim() : ''))
        .filter(Boolean);
      if (msgs.length > 0) return msgs.join(' ');
    }
    if (
      err &&
      typeof err === 'object' &&
      typeof err.message === 'string' &&
      err.message.trim()
    ) {
      return err.message.trim();
    }
  } catch {
    /* not JSON — fall through */
  }

  return raw.length > 280 ? `${raw.slice(0, 277)}…` : raw;
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    const msg = formatApiErrorBody(text) || res.statusText;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function parseEmpty(res: Response): Promise<void> {
  if (!res.ok) {
    const text = await res.text();
    const msg = formatApiErrorBody(text) || res.statusText;
    throw new Error(msg);
  }
}

export type ListTasksParams = {
  projectId: string;
  rootOnly?: boolean;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | '__none__';
  labelId?: string;
};

function buildTaskQuery(params: ListTasksParams): string {
  const q = new URLSearchParams();
  q.set('projectId', params.projectId);
  if (params.rootOnly === true) q.set('rootOnly', '1');
  if (params.status) q.set('status', params.status);
  if (params.priority) q.set('priority', params.priority);
  if (params.assigneeId === '__none__') q.set('assigneeId', '__none__');
  else if (params.assigneeId) q.set('assigneeId', params.assigneeId);
  if (params.labelId) q.set('labelId', params.labelId);
  return `?${q.toString()}`;
}

export type AdminMemberRow = {
  id: string;
  email: string;
  displayName: string;
  accountRole: AccountRole;
  createdAt: string;
};

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
      parseJson<{
        token: string;
        user: {
          id: string;
          email: string;
          displayName: string;
          accountRole: AccountRole;
        };
      }>(r),
    );
  },

  login(body: { email: string; password: string }) {
    return apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) =>
      parseJson<{
        token: string;
        user: {
          id: string;
          email: string;
          displayName: string;
          accountRole: AccountRole;
        };
      }>(r),
    );
  },

  me() {
    return apiFetch('/api/auth/me').then((r) => parseJson<AuthUser>(r));
  },

  listAdminMembers() {
    return apiFetch('/api/admin/members').then((r) =>
      parseJson<{ members: AdminMemberRow[] }>(r),
    );
  },

  createAdminMember(body: {
    email: string;
    displayName: string;
    password?: string;
    accountRole?: 'member' | 'guest';
  }) {
    return apiFetch('/api/admin/members', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(
      (r) =>
        parseJson<{
          user: {
            id: string;
            email: string;
            displayName: string;
            accountRole: AccountRole;
          };
          initialPassword?: string;
        }>(r),
    );
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

  listTasks(params: ListTasksParams) {
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
    /** Required for root tasks; omitted when creating under a parent via `parentId`. */
    projectId?: string;
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

  listProjects() {
    return apiFetch('/api/projects').then((r) => parseJson<Project[]>(r));
  },

  getProject(id: string) {
    return apiFetch(`/api/projects/${id}`).then((r) => parseJson<Project>(r));
  },

  createProject(body: {
    title: string;
    description?: string | null;
    icon?: string | null;
    status?: ProjectStatus;
    priority?: ProjectPriority;
    leadType?: 'member' | 'agent' | null;
    leadId?: string | null;
  }) {
    return apiFetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => parseJson<Project>(r));
  },

  patchProject(
    id: string,
    body: Partial<{
      title: string;
      description: string | null;
      icon: string | null;
      status: ProjectStatus;
      priority: ProjectPriority;
      leadType: 'member' | 'agent' | null;
      leadId: string | null;
      position: number;
    }>,
  ) {
    return apiFetch(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then((r) => parseJson<Project>(r));
  },

  archiveProject(id: string) {
    return apiFetch(`/api/projects/${id}/archive`, {
      method: 'POST',
    }).then((r) => parseJson<Project>(r));
  },

  listProjectMembers(projectId: string) {
    return apiFetch(`/api/projects/${projectId}/members`).then((r) =>
      parseJson<ProjectMember[]>(r),
    );
  },

  addProjectMember(
    projectId: string,
    body: {
      actorType: 'member' | 'agent';
      actorId: string;
      role?: ProjectMemberRole;
    },
  ) {
    return apiFetch(`/api/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => parseEmpty(r));
  },

  removeProjectMember(
    projectId: string,
    actorType: 'member' | 'agent',
    actorId: string,
  ) {
    const at = encodeURIComponent(actorType);
    const aid = encodeURIComponent(actorId);
    return apiFetch(`/api/projects/${projectId}/members/${at}/${aid}`, {
      method: 'DELETE',
    }).then((r) => parseEmpty(r));
  },

  patchProjectMemberRole(
    projectId: string,
    actorType: 'member' | 'agent',
    actorId: string,
    role: 'admin' | 'member',
  ) {
    const at = encodeURIComponent(actorType);
    const aid = encodeURIComponent(actorId);
    return apiFetch(`/api/projects/${projectId}/members/${at}/${aid}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }).then((r) => parseEmpty(r));
  },
};
