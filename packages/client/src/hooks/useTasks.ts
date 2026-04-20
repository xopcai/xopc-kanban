import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { ListTasksParams } from '../api/client';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { DependencyType, TaskStatus } from '../types';

export const workspaceKeys = {
  actors: ['workspace', 'actors'] as const,
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
  list: (params: ListTasksParams | undefined) =>
    [
      ...taskKeys.all,
      'list',
      params?.rootOnly ?? false,
      params?.status ?? '',
      params?.priority ?? '',
      params?.assigneeId ?? '',
      params?.labelId ?? '',
    ] as const,
  labels: ['labels'] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  memory: (id: string) => [...taskKeys.all, 'memory', id] as const,
  graph: (id: string) => [...taskKeys.all, 'graph', id] as const,
  deps: (id: string) => [...taskKeys.all, 'deps', id] as const,
};

export function useTaskList(
  rootOnly = true,
  filters: Omit<ListTasksParams, 'rootOnly'> = {},
) {
  const params: ListTasksParams = { rootOnly, ...filters };
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () => api.listTasks(params),
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
