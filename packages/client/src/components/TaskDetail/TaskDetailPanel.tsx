import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { MoreHorizontal, X } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAddDependency,
  useAddMemory,
  useCreateLabel,
  useCreateSubtask,
  useDeleteTask,
  useLabels,
  usePatchTask,
  useProjectsList,
  useRemoveDependency,
  useSetTaskStatus,
  useTaskDependencies,
  useTaskDetail,
  useTaskList,
  useTaskMemory,
  useProjectWorkspaceMembers,
} from '../../hooks/useTasks';
import { useIsDark } from '../../hooks/useIsDark';
import { statusLabel } from '../../lib/taskOrdering';
import type { TaskPriority, TaskStatus } from '../../types';
import { useDialogStore } from '../../store/dialogStore';
import { MemoryTimeline } from './MemoryTimeline';

const statuses: TaskStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
  'cancelled',
];

const priorities: TaskPriority[] = [
  'urgent',
  'high',
  'medium',
  'low',
  'none',
];

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:gap-4">
      <span className="shrink-0 pt-0.5 text-xs font-medium uppercase tracking-wide text-fg-subtle sm:w-24">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function TaskDetailPanel({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: task, isLoading } = useTaskDetail(taskId);
  const { data: memory = [] } = useTaskMemory(taskId);
  const { data: projects = [] } = useProjectsList();
  const patch = usePatchTask(taskId);
  const setStatus = useSetTaskStatus();
  const addMem = useAddMemory(taskId);
  const delTask = useDeleteTask();
  const { data: deps = [] } = useTaskDependencies(taskId);
  const { data: allTasks = [] } = useTaskList(false);
  const addDep = useAddDependency(taskId);
  const removeDep = useRemoveDependency(taskId);
  const addSubtask = useCreateSubtask(taskId);
  const { data: allLabels = [] } = useLabels();
  const createLabel = useCreateLabel();
  const isDark = useIsDark();
  const workspaceMembers = useProjectWorkspaceMembers();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [dependsOnPick, setDependsOnPick] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');
  const [moreOpen, setMoreOpen] = useState(false);
  const moreWrapRef = useRef<HTMLDivElement>(null);

  const taskLabel = (id: string) =>
    allTasks.find((x) => x.id === id)?.identifier ?? id.slice(0, 8);

  const projectTitle = useMemo(() => {
    if (!task?.projectId) return null;
    const p = projects.find((x) => x.id === task.projectId);
    return p?.title ?? null;
  }, [task?.projectId, projects]);

  const assigneeDisplay = useMemo(() => {
    if (!task?.assigneeId || !task.assigneeType) return null;
    const m = workspaceMembers.find(
      (x) => x.type === task.assigneeType && x.id === task.assigneeId,
    );
    if (m) return t(`members.${m.id}`, { defaultValue: m.name });
    return task.assigneeId;
  }, [task, workspaceMembers, t]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
    }
  }, [task]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (moreOpen) setMoreOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreWrapRef.current?.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  const saveFields = () => {
    if (!task) return;
    if (title.trim() && title !== task.title) {
      patch.mutate({ title: title.trim() });
    }
    const desc = description.trim() || null;
    if (desc !== (task.description ?? null)) {
      patch.mutate({ description: desc });
    }
  };

  const assigneeSelectValue =
    task && task.assigneeId && task.assigneeType
      ? `${task.assigneeType}|${task.assigneeId}`
      : '';

  const toggleLabelOnTask = (labelId: string, on: boolean) => {
    if (!task) return;
    const ids = new Set(task.labels.map((l) => l.id));
    if (on) ids.add(labelId);
    else ids.delete(labelId);
    patch.mutate({ labelIds: [...ids] });
  };

  const confirmDelete = () => {
    if (!task) return;
    void (async () => {
      const ok = await useDialogStore.getState().confirm({
        message: t('detail.deleteConfirm'),
        danger: true,
        confirmLabel: t('actions.delete'),
      });
      if (!ok) return;
      delTask.mutate(task.id, {
        onSuccess: () => onClose(),
      });
    })();
  };

  return (
    <>
      <button
        type="button"
        aria-label={t('detail.closeAria')}
        className="fixed inset-0 z-[62] bg-[var(--overlay-scrim)] transition-opacity duration-150 ease-out"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        className="fixed left-1/2 top-1/2 z-[63] flex max-h-[min(92dvh,52rem)] w-[calc(100vw-1rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-edge-subtle bg-surface-panel shadow-elevated sm:w-full"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-edge-subtle px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-lg bg-surface-active px-2 py-1 text-xs font-semibold tabular-nums text-fg-secondary">
              {isLoading ? '…' : task?.identifier}
            </span>
            <span className="truncate text-xs text-fg-subtle sm:text-sm">
              {t('detail.title')}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="relative" ref={moreWrapRef}>
              <button
                type="button"
                aria-label={t('detail.moreMenuAria')}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => setMoreOpen((o) => !o)}
                className="rounded-xl p-2 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {moreOpen && task && (
                <ul
                  className="absolute right-0 top-full z-10 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-edge-subtle bg-surface-panel py-1 shadow-elevated"
                  role="menu"
                >
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full px-3 py-2 text-left text-sm text-danger hover:bg-surface-hover"
                      onClick={() => {
                        setMoreOpen(false);
                        confirmDelete();
                      }}
                    >
                      {t('detail.deleteTask')}
                    </button>
                  </li>
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-fg-subtle transition-colors duration-150 hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {isLoading || !task ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <p className="text-sm text-fg-secondary">{t('loading.generic')}</p>
            </div>
          ) : (
            <>
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto border-edge-subtle md:border-r md:pr-px">
                <div className="px-4 py-4 sm:px-5 sm:py-5">
                  <label className="block" htmlFor="task-detail-title">
                    <span className="sr-only">{t('detail.fieldTitle')}</span>
                    <input
                      id="task-detail-title"
                      className="w-full border-0 bg-transparent text-xl font-semibold leading-snug text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel sm:text-2xl"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={saveFields}
                    />
                  </label>

                  <div className="mt-1 divide-y divide-edge-subtle">
                    <MetaRow label={t('detail.fieldStatus')}>
                      <select
                        className="w-full max-w-md rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-auto sm:min-w-[12rem]"
                        value={task.status}
                        onChange={(e) => {
                          const s = e.target.value as TaskStatus;
                          setStatus.mutate(
                            { id: task.id, status: s },
                            { onError: () => {} },
                          );
                        }}
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s, t)}
                          </option>
                        ))}
                      </select>
                    </MetaRow>

                    <MetaRow label={t('detail.fieldAssignee')}>
                      <select
                        className="w-full max-w-md rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-auto sm:min-w-[12rem]"
                        value={assigneeSelectValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) {
                            patch.mutate({
                              assigneeType: null,
                              assigneeId: null,
                            });
                            return;
                          }
                          const [typ, id] = v.split('|') as [
                            'member' | 'agent',
                            string,
                          ];
                          patch.mutate({
                            assigneeType: typ,
                            assigneeId: id,
                          });
                        }}
                      >
                        <option value="">{t('detail.assigneeNone')}</option>
                        {workspaceMembers.map((m) => (
                          <option
                            key={`${m.type}-${m.id}`}
                            value={`${m.type}|${m.id}`}
                          >
                            {t(`members.${m.id}`, { defaultValue: m.name })}
                          </option>
                        ))}
                      </select>
                    </MetaRow>

                    <MetaRow label={t('detail.fieldPriority')}>
                      <select
                        className="w-full max-w-md rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-auto sm:min-w-[12rem]"
                        value={task.priority}
                        onChange={(e) => {
                          patch.mutate({
                            priority: e.target.value as TaskPriority,
                          });
                        }}
                      >
                        {priorities.map((p) => (
                          <option key={p} value={p}>
                            {t(`priority.${p}`)}
                          </option>
                        ))}
                      </select>
                    </MetaRow>

                    {projectTitle && (
                      <MetaRow label={t('detail.fieldProject')}>
                        <p className="pt-0.5 text-sm text-fg">{projectTitle}</p>
                      </MetaRow>
                    )}
                  </div>

                  <div className="mt-5">
                    <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                      {t('detail.fieldDescription')}
                    </span>
                    <div
                      className="mt-2 rounded-xl border border-edge-subtle"
                      data-color-mode={isDark ? 'dark' : 'light'}
                    >
                      <MDEditor
                        value={description}
                        onChange={(v) => setDescription(v ?? '')}
                        textareaProps={{
                          onBlur: saveFields,
                        }}
                        height={200}
                        preview="edit"
                        visibleDragbar={false}
                      />
                    </div>
                  </div>

                  <div className="mt-6">
                    <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                      {t('detail.labels')}
                    </span>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {allLabels.map((lbl) => {
                        const on = task.labels.some((x) => x.id === lbl.id);
                        return (
                          <li key={lbl.id}>
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-secondary">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-edge text-accent focus:ring-accent"
                                checked={on}
                                onChange={(e) =>
                                  toggleLabelOnTask(lbl.id, e.target.checked)
                                }
                              />
                              <span
                                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: lbl.color }}
                                aria-hidden
                              />
                              <span className="text-fg">{lbl.name}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <label className="flex min-w-[8rem] flex-1 flex-col gap-1">
                        <span className="text-xs text-fg-subtle">
                          {t('detail.newLabel')}
                        </span>
                        <input
                          className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          placeholder={t('detail.labelNamePh')}
                          value={newLabelName}
                          onChange={(e) => setNewLabelName(e.target.value)}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-fg-subtle">
                          {t('detail.labelColor')}
                        </span>
                        <input
                          type="color"
                          className="h-10 w-14 cursor-pointer rounded-lg border border-edge bg-surface-base"
                          value={newLabelColor}
                          onChange={(e) => setNewLabelColor(e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        onClick={() => {
                          const n = newLabelName.trim();
                          if (!n || !task) return;
                          createLabel.mutate(
                            { name: n, color: newLabelColor },
                            {
                              onSuccess: (created) => {
                                setNewLabelName('');
                                patch.mutate({
                                  labelIds: [
                                    ...task.labels.map((l) => l.id),
                                    created.id,
                                  ],
                                });
                              },
                              onError: (err) => {
                                void useDialogStore.getState().alert({
                                  message:
                                    err instanceof Error
                                      ? err.message
                                      : t('detail.labelCreateErr'),
                                });
                              },
                            },
                          );
                        }}
                      >
                        {t('detail.labelCreateAdd')}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                      {t('detail.subtasks')}
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {task.children.length === 0 && (
                        <li className="text-sm text-fg-secondary">
                          {t('detail.noSubtasks')}
                        </li>
                      )}
                      {task.children.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-lg border border-edge-subtle px-2 py-1.5 text-sm text-fg-secondary"
                        >
                          {c.identifier} · {c.title}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        className="min-w-0 flex-1 rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        placeholder={t('detail.subtaskPlaceholder')}
                        value={subtaskTitle}
                        onChange={(e) => setSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const st = subtaskTitle.trim();
                            if (!st) return;
                            addSubtask.mutate(
                              { title: st },
                              { onSuccess: () => setSubtaskTitle('') },
                            );
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-xl border border-edge bg-surface-panel px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                        onClick={() => {
                          const st = subtaskTitle.trim();
                          if (!st) return;
                          addSubtask.mutate(
                            { title: st },
                            { onSuccess: () => setSubtaskTitle('') },
                          );
                        }}
                      >
                        {t('detail.addSubtask')}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                      {t('detail.dependencies')}
                    </h3>
                    <p className="mt-1 text-xs text-fg-subtle">
                      {t('detail.depsHint')}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {deps.length === 0 && (
                        <li className="text-sm text-fg-secondary">
                          {t('detail.noEdges')}
                        </li>
                      )}
                      {deps.map((e) => {
                        if (e.taskId === task.id) {
                          return (
                            <li
                              key={e.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-edge-subtle px-2 py-1.5 text-sm text-fg-secondary"
                            >
                              <span>
                                {t('detail.dependsOn', {
                                  id: taskLabel(e.dependsOnId),
                                  type: t(`detail.depType.${e.type}`),
                                })}
                              </span>
                              <button
                                type="button"
                                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                onClick={() => removeDep.mutate(e.id)}
                              >
                                {t('actions.remove')}
                              </button>
                            </li>
                          );
                        }
                        return (
                          <li
                            key={e.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-edge-subtle px-2 py-1.5 text-sm text-fg-secondary"
                          >
                            <span>
                              {t('detail.requiredBy', {
                                id: taskLabel(e.taskId),
                                type: t(`detail.depType.${e.type}`),
                              })}
                            </span>
                            <button
                              type="button"
                              className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                              onClick={() => removeDep.mutate(e.id)}
                            >
                              {t('actions.remove')}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        className="min-w-0 flex-1 rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        value={dependsOnPick}
                        onChange={(e) => setDependsOnPick(e.target.value)}
                      >
                        <option value="">{t('detail.prereqPlaceholder')}</option>
                        {allTasks
                          .filter((x) => x.id !== task.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.identifier} — {x.title}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className="rounded-xl border border-edge bg-surface-panel px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                        onClick={() => {
                          if (!dependsOnPick) return;
                          addDep.mutate(
                            { dependsOnId: dependsOnPick },
                            {
                              onSuccess: () => setDependsOnPick(''),
                              onError: (err) => {
                                void useDialogStore.getState().alert({
                                  message:
                                    err instanceof Error
                                      ? err.message
                                      : t('detail.depLinkFailed'),
                                });
                              },
                            },
                          );
                        }}
                      >
                        {t('detail.linkPrereq')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-edge-subtle bg-surface-panel md:w-[min(100%,20rem)] md:border-l md:border-t-0">
                <div className="shrink-0 border-b border-edge-subtle px-4 py-3 sm:px-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    {t('detail.participants')}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {assigneeDisplay ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-edge-subtle bg-surface-base py-1 pl-1 pr-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-active text-xs font-semibold text-fg-secondary">
                          {assigneeDisplay.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="max-w-[10rem] truncate text-sm text-fg">
                          {assigneeDisplay}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-fg-subtle">
                        {t('detail.assigneeNone')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    {t('detail.activity')}
                  </h3>
                  <div className="mt-2">
                    <MemoryTimeline items={memory} />
                  </div>
                </div>

                <div className="shrink-0 border-t border-edge-subtle p-4 sm:p-5">
                  <textarea
                    rows={3}
                    className="w-full resize-y rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    placeholder={t('detail.notePlaceholder')}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="mt-2 w-full rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-auto"
                    onClick={() => {
                      const nt = note.trim();
                      if (!nt) return;
                      addMem.mutate(nt, {
                        onSuccess: () => setNote(''),
                      });
                    }}
                  >
                    {t('detail.addNote')}
                  </button>
                </div>
              </aside>
            </>
          )}
        </div>
      </div>
    </>
  );
}
