import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../api/client';
import type { TaskStatus } from '../types';

export const taskKeys = {
  all: ['tasks'] as const,
  list: (rootOnly?: boolean) => [...taskKeys.all, 'list', rootOnly] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  memory: (id: string) => [...taskKeys.all, 'memory', id] as const,
};

export function useTaskList(rootOnly = true) {
  return useQuery({
    queryKey: taskKeys.list(rootOnly),
    queryFn: () => api.listTasks({ rootOnly }),
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

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTask,
    onSuccess: () => {
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
