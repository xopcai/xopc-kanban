import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ListTasksParams } from '../api/client';
import { api } from '../api/client';
import { projectWorkspacePath } from '../lib/workspaceRoutes';
import { projectMembersToWorkspaceMembers } from '../lib/members';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import type { DependencyType, TaskStatus } from '../types';
import { useMemo } from 'react';

export const workspaceKeys = {
  actors: ['workspace', 'actors'] as const,
};

export const projectKeys = {
  all: ['projects'] as const,
  list: ['projects', 'list'] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
  members: (id: string) => ['projects', 'members', id] as const,
};

export function useWorkspaceActors() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: workspaceKeys.actors,
    queryFn: () => api.listWorkspaceActors(),
    enabled: Boolean(token),
  });
}

export const taskKeys = {
  all: ['tasks'] as const,
  list: (params: ListTasksParams) =>
    [
      ...taskKeys.all,
      'list',
      params.projectId,
      params.rootOnly ?? false,
      params.status ?? '',
      params.priority ?? '',
      params.assigneeId ?? '',
      params.labelId ?? '',
    ] as const,
  labels: ['labels'] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  memory: (id: string) => [...taskKeys.all, 'memory', id] as const,
  graph: (id: string) => [...taskKeys.all, 'graph', id] as const,
  deps: (id: string) => [...taskKeys.all, 'deps', id] as const,
};

export function useTaskList(
  rootOnly = true,
  filters: Omit<ListTasksParams, 'rootOnly' | 'projectId'> = {},
) {
  const projectId = useUiStore((s) => s.currentProjectId);
  const params: ListTasksParams | null = projectId
    ? { projectId, rootOnly, ...filters }
    : null;
  return useQuery({
    queryKey: params ? taskKeys.list(params) : [...taskKeys.all, 'list', 'none'],
    queryFn: () => api.listTasks(params!),
    enabled: Boolean(params),
  });
}

export function useProjectsList() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: projectKeys.list,
    queryFn: () => api.listProjects(),
    enabled: Boolean(token),
  });
}

export function useProjectMembers(projectId: string | null) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: projectKeys.members(projectId ?? ''),
    queryFn: () => api.listProjectMembers(projectId!),
    enabled: Boolean(token && projectId),
  });
}

/** Members of the current project, shaped for assignee filters and menus. */
export function useProjectWorkspaceMembers() {
  const projectId = useUiStore((s) => s.currentProjectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: actors } = useWorkspaceActors();
  return useMemo(
    () => projectMembersToWorkspaceMembers(members, actors),
    [members, actors],
  );
}

export function useCreateProject() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: api.createProject,
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: projectKeys.all });
      navigate(projectWorkspacePath(row.id, 'board'));
    },
  });
}

export function usePatchProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: { id: string } & Parameters<typeof api.patchProject>[1]) =>
      api.patchProject(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.archiveProject,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.all });
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useAddProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof api.addProjectMember>[1]) =>
      api.addProjectMember(projectId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.members(projectId) });
    },
  });
}

export function useRemoveProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      actorType,
      actorId,
    }: {
      actorType: 'member' | 'agent';
      actorId: string;
    }) => api.removeProjectMember(projectId, actorType, actorId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.members(projectId) });
    },
  });
}

export function usePatchProjectMemberRole(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      actorType,
      actorId,
      role,
    }: {
      actorType: 'member' | 'agent';
      actorId: string;
      role: 'admin' | 'member';
    }) => api.patchProjectMemberRole(projectId, actorType, actorId, role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.members(projectId) });
    },
  });
}

export function useLabels() {
  return useQuery({
    queryKey: taskKeys.labels,
    queryFn: () => api.listLabels(),
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createLabel,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.labels });
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useBulkTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.bulkTasks,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useTaskDetail(id: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => api.getTask(id!),
    enabled: Boolean(id),
  });
}

export function useTaskMemory(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.memory(taskId ?? ''),
    queryFn: () => api.listMemory(taskId!),
    enabled: Boolean(taskId),
  });
}

export function useTaskGraph(anchorId: string | null) {
  return useQuery({
    queryKey: taskKeys.graph(anchorId ?? ''),
    queryFn: () => api.getTaskGraph(anchorId!),
    enabled: Boolean(anchorId),
  });
}

export function useTaskDependencies(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.deps(taskId ?? ''),
    queryFn: () => api.listDependencies(taskId!),
    enabled: Boolean(taskId),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTask,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useCreateSubtask(parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string | null }) =>
      api.createSubtask(parentId, body),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useUpdateTaskTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patchTask(id, { title }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useQuickPatchTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: { id: string } & Parameters<typeof api.patchTask>[1]) =>
      api.patchTask(id, body),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function usePatchTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof api.patchTask>[1]) =>
      api.patchTask(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useSetTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: TaskStatus;
      note?: string;
    }) => api.setTaskStatus(id, status, note),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useAddMemory(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.addMemory(taskId, content),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.memory(taskId) });
      void qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

export function useDeleteMemory(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memId: string) => api.deleteMemory(taskId, memId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.memory(taskId) });
      void qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useAddDependency(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { dependsOnId: string; type?: DependencyType }) =>
      api.addDependency(taskId, input),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useRemoveDependency(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (edgeId: string) => api.removeDependency(taskId, edgeId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
