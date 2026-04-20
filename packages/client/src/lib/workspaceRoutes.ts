import type { ViewMode } from '../types';

export const WORKSPACE_VIEWS = ['board', 'list', 'graph'] as const satisfies readonly ViewMode[];

export function isWorkspaceView(s: string | undefined): s is ViewMode {
  return s !== undefined && (WORKSPACE_VIEWS as readonly string[]).includes(s);
}

export function projectWorkspacePath(projectId: string, view: ViewMode): string {
  return `/projects/${projectId}/${view}`;
}

export const PROJECTS_HOME_PATH = '/projects';
