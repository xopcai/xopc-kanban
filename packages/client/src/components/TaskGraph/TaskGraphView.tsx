import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTaskGraph, useTaskList } from '../../hooks/useTasks';
import type { Task } from '../../types';

const NODE_R = 40;
const W = 800;
const H = 560;

function layoutCircle(nodes: Task[], anchorId: string | null) {
  const n = nodes.length;
  const pos = new Map<string, { x: number; y: number }>();
  if (n === 0) return pos;

  const order = [...nodes].sort((a, b) => {
    if (anchorId) {
      if (a.id === anchorId) return -1;
      if (b.id === anchorId) return 1;
    }
    return a.identifier.localeCompare(b.identifier);
  });

  const cx = W / 2;
  const cy = H / 2;
  const ring = Math.min(W, H) / 2 - NODE_R - 24;
  order.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    pos.set(node.id, {
      x: cx + ring * Math.cos(angle),
      y: cy + ring * Math.sin(angle),
    });
  });
  return pos;
}

function shortenLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pad: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * pad,
    y1: y1 + uy * pad,
    x2: x2 - ux * pad,
    y2: y2 - uy * pad,
  };
}

export function TaskGraphView({
  onOpenTask,
}: {
  onOpenTask: (id: string) => void;
}) {
  const { data: tasks = [], isLoading: loadingTasks } = useTaskList(false);
  const [anchorId, setAnchorId] = useState<string | null>(null);

  useEffect(() => {
    if (anchorId) return;
    const first = tasks[0];
    if (first) setAnchorId(first.id);
  }, [tasks, anchorId]);

  const { data: graph, isLoading: loadingGraph } = useTaskGraph(anchorId);

  const positions = useMemo(
    () => layoutCircle(graph?.nodes ?? [], anchorId),
    [graph?.nodes, anchorId],
  );

  const loading = loadingTasks || (anchorId ? loadingGraph : false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium leading-6 text-fg">Anchor task</span>
          <select
            className="min-w-[220px] rounded-xl border border-edge bg-surface-panel px-3 py-2 text-sm leading-6 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={anchorId ?? ''}
            onChange={(e) => setAnchorId(e.target.value || null)}
          >
            <option value="">Select…</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.identifier} — {t.title}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm leading-relaxed text-fg-secondary">
          Arrows point from prerequisite → dependent. Connected component around the anchor.
        </p>
      </div>

      {loading && (
        <div className="rounded-xl border border-edge-subtle bg-surface-panel p-6 text-sm text-fg-secondary">
          Loading graph…
        </div>
      )}

      {!loading && !anchorId && (
        <div className="rounded-xl border border-edge-subtle bg-surface-panel p-8 text-sm text-fg-secondary">
          Create a task to view the dependency graph.
        </div>
      )}

      {!loading && anchorId && graph && (
        <div className="overflow-auto rounded-xl border border-edge-subtle bg-surface-panel p-4">
          <svg
            width={W}
            height={H}
            className="max-w-full"
            role="img"
            aria-label="Task dependency graph"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 Z" className="fill-fg-subtle" />
              </marker>
            </defs>

            {graph.edges.map((e) => {
              const pFrom = positions.get(e.dependsOnId);
              const pTo = positions.get(e.taskId);
              if (!pFrom || !pTo) return null;
              const { x1, y1, x2, y2 } = shortenLine(
                pFrom.x,
                pFrom.y,
                pTo.x,
                pTo.y,
                NODE_R + 2,
              );
              const dashed = e.type === 'related';
              return (
                <line
                  key={e.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className="stroke-fg-subtle"
                  strokeWidth={1.5}
                  strokeDasharray={dashed ? '6 4' : undefined}
                  markerEnd="url(#arrowhead)"
                />
              );
            })}

            {graph.nodes.map((node) => {
              const p = positions.get(node.id);
              if (!p) return null;
              const isAnchor = node.id === anchorId;
              return (
                <g key={node.id} transform={`translate(${p.x}, ${p.y})`}>
                  <circle
                    r={NODE_R}
                    className={clsx(
                      'cursor-pointer stroke transition-colors duration-150 ease-out',
                      isAnchor
                        ? 'fill-blue-50 stroke-accent'
                        : 'fill-surface-panel stroke-edge',
                    )}
                    onClick={() => onOpenTask(node.id)}
                  />
                  <text
                    textAnchor="middle"
                    y={4}
                    className="pointer-events-none fill-fg text-[11px] font-medium leading-none"
                  >
                    {node.identifier}
                  </text>
                  <text
                    textAnchor="middle"
                    y={20}
                    className="pointer-events-none fill-fg-secondary text-[10px] leading-none"
                  >
                    {node.title.length > 18
                      ? `${node.title.slice(0, 18)}…`
                      : node.title}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
