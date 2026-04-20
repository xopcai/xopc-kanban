import type { TaskPriority, TaskStatus } from '../types';

export const STATUS_ORDER: TaskStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
  'cancelled',
];

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

export function comparePriority(a: TaskPriority, b: TaskPriority): number {
  return PRIORITY_RANK[a] - PRIORITY_RANK[b];
}

export function statusLabel(s: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    backlog: 'Backlog',
    todo: 'Todo',
    in_progress: 'In progress',
    in_review: 'Review',
    blocked: 'Blocked',
    done: 'Done',
    cancelled: 'Cancelled',
  };
  return labels[s];
}

export function priorityLabel(p: TaskPriority): string {
  if (p === 'none') return 'No priority';
  return p.replaceAll('_', ' ');
}
