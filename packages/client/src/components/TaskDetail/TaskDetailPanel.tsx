import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAddDependency,
  useAddMemory,
  useCreateLabel,
  useCreateSubtask,
  useDeleteTask,
  useLabels,
  usePatchTask,
  useRemoveDependency,
  useSetTaskStatus,
  useTaskDependencies,
  useTaskDetail,
  useTaskList,
  useTaskMemory,
  useWorkspaceActors,
} from '../../hooks/useTasks';
import { useIsDark } from '../../hooks/useIsDark';
import { actorsToWorkspaceMembers } from '../../lib/members';
import { statusLabel } from '../../lib/taskOrdering';
import type { TaskStatus } from '../../types';
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
  const { data: actors } = useWorkspaceActors();
  const workspaceMembers = useMemo(
    () => (actors ? actorsToWorkspaceMembers(actors) : []),
    [actors],
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [dependsOnPick, setDependsOnPick] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');

  const taskLabel = (id: string) =>
    allTasks.find((x) => x.id === id)?.identifier ?? id.slice(0, 8);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
    }
  }, [task]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        className="fixed left-1/2 top-1/2 z-[63] flex max-h-[min(90dvh,56rem)] w-[calc(100vw-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-edge-subtle bg-surface-panel shadow-elevated sm:w-full"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-edge-subtle px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs leading-5 text-fg-subtle">
              {isLoading ? '…' : task?.identifier}
            </p>
            <h2
              id="task-detail-title"
              className="text-base font-semibold leading-6 text-fg truncate"
            >
              {t('detail.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-fg-subtle transition-colors duration-150 hover:bg-surface-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {isLoading || !task ? (
            <p className="text-sm text-fg-secondary">{t('loading.generic')}</p>
          ) : (
            <div className="flex flex-col gap-5">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium leading-6 text-fg">
                  {t('detail.fieldTitle')}
                </span>
                <input
                  className="rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveFields}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium leading-6 text-fg">
                  {t('detail.fieldDescription')}
                </span>
                <div data-color-mode={isDark ? 'dark' : 'light'}>
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
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium leading-6 text-fg">
                  {t('detail.fieldAssignee')}
                </span>
                <select
                  className="rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                    const [typ, id] = v.split('|') as ['member' | 'agent', string];
                    patch.mutate({
                      assigneeType: typ,
                      assigneeId: id,
                    });
                  }}
                >
                  <option value="">{t('detail.assigneeNone')}</option>
                  {workspaceMembers.map((m) => (
                    <option key={`${m.type}-${m.id}`} value={`${m.type}|${m.id}`}>
                      {t(`members.${m.id}`, { defaultValue: m.name })}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium leading-6 text-fg">
                  {t('detail.labels')}
                </span>
                <ul className="flex flex-col gap-1.5">
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
                <div className="flex flex-wrap items-end gap-2 pt-1">
                  <label className="flex min-w-[8rem] flex-1 flex-col gap-1">
                    <span className="text-xs text-fg-subtle">
                      {t('detail.newLabel')}
                    </span>
                    <input
                      className="rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                      className="h-10 w-14 cursor-pointer rounded-lg border border-edge bg-surface-panel"
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
                              labelIds: [...task.labels.map((l) => l.id), created.id],
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

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium leading-6 text-fg">
                  {t('detail.fieldStatus')}
                </span>
                <select
                  className="rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={task.status}
                  onChange={(e) => {
                    const s = e.target.value as TaskStatus;
                    setStatus.mutate(
                      { id: task.id, status: s },
                      {
                        onError: () => {
                          /* revert handled by invalidate */
                        },
                      },
                    );
                  }}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s, t)}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <h3 className="text-sm font-semibold leading-6 text-fg">
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
                    className="min-w-0 flex-1 rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    placeholder={t('detail.subtaskPlaceholder')}
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const t = subtaskTitle.trim();
                        if (!t) return;
                        addSubtask.mutate(
                          { title: t },
                          { onSuccess: () => setSubtaskTitle('') },
                        );
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-xl border border-edge bg-surface-panel px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                    onClick={() => {
                      const t = subtaskTitle.trim();
                      if (!t) return;
                      addSubtask.mutate(
                        { title: t },
                        { onSuccess: () => setSubtaskTitle('') },
                      );
                    }}
                  >
                    {t('detail.addSubtask')}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold leading-6 text-fg">
                  {t('detail.dependencies')}
                </h3>
                <p className="mt-1 text-xs leading-5 text-fg-subtle">
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
                    className="min-w-0 flex-1 rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

              <div>
                <h3 className="text-sm font-semibold leading-6 text-fg">
                  {t('detail.activity')}
                </h3>
                <div className="mt-2">
                  <MemoryTimeline items={memory} />
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <textarea
                    rows={3}
                    className="resize-y rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    placeholder={t('detail.notePlaceholder')}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="self-start rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                    onClick={() => {
                      const t = note.trim();
                      if (!t) return;
                      addMem.mutate(t, {
                        onSuccess: () => setNote(''),
                      });
                    }}
                  >
                    {t('detail.addNote')}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-edge-subtle pt-4">
                <button
                  type="button"
                  className="rounded-xl border border-edge bg-surface-panel px-4 py-2 text-sm font-medium text-fg transition-colors duration-150 hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                  onClick={() => {
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
                  }}
                >
                  {t('detail.deleteTask')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
