# XOPC Kanban — Task-Native AI 看板 技术设计文档

> 版本：v0.1 | 状态：草稿

---

## 一、产品定位

### 1.1 一句话定义

一个以 **Task 为核心原子单位** 的 AI 看板系统：人创建任务，AI 数字人执行任务，系统持续追踪状态与成果。

### 1.2 与传统看板的本质区别

| 维度 | 传统看板（Jira / Trello） | Task-Native AI 看板 |
|------|--------------------------|---------------------|
| 执行者 | 人 | 人 + AI 数字人 |
| 任务粒度 | 人工拆解 | 系统自动分解（Task Graph） |
| 状态更新 | 人工拖拽 | AI 自动汇报 |
| 上下文 | 评论/附件 | Task Memory（持久记忆） |
| 交互范式 | 问答 / 表单 | 创建任务 → 等待结果 |

### 1.3 MVP 范围（第一阶段）

**包含：**
- Task 的 CRUD（创建、查看、编辑、删除）
- Task 状态机（Pending → In Progress → Done / Blocked / Cancelled）
- Task Graph（父子任务、依赖关系）
- Task Memory（任务附带的上下文记忆）
- 看板视图（Board View）+ 列表视图（List View）
- 实时状态更新（SSE）

**不包含（预留接口）：**
- AI 数字人执行引擎
- Agent Mesh 多 Agent 协作
- Task Protocol（任务间通讯）

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │Task Board│  │Task Graph│  │Task Detail│  │MemoryPanel│
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                    Zustand Store + React Query            │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / SSE
┌───────────────────────▼─────────────────────────────────┐
│                   Hono (Node.js)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │Task Router│  │Memory Router│  │Event Router│  │Agent API│
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                    Service Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ TaskService  │  │MemoryService │  │ EventBus(SSE) │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                  SQLite (better-sqlite3)                  │
│  tasks │ task_dependencies │ task_memory │ task_events   │
└─────────────────────────────────────────────────────────┘
```

### 2.1 分层说明

- **前端层**：Vite + React + TypeScript，Zustand 管理全局状态，React Query 处理服务端数据同步
- **API 层**：Hono 提供 RESTful API + SSE 实时推送，预留 `/api/agent/*` 路由供 AI 数字人接入
- **Service 层**：业务逻辑封装，TaskService / MemoryService / EventBus 解耦
- **数据层**：SQLite + better-sqlite3，单文件数据库，零配置，适合本地开发

---

## 三、核心需求

### 3.1 核心实体概览

系统由 4 个核心实体构成，层级关系如下：

```
Project（项目容器）
  └── Task（任务，原子单位）
        ├── Task（子任务，无限层级）
        ├── TaskComment（评论 / 活动日志）
        └── AgentRun（AI 执行记录，预留）
```

### 3.2 Task 对象模型

Task 是系统的原子单位，包含以下字段：

```typescript
// ── 执行者（人 or AI 数字人）──────────────────────────────
type ActorType = 'member' | 'agent';

interface Actor {
  type: ActorType;
  id: string;
  name: string;
  avatarUrl: string | null;
}

// ── 状态与优先级 ──────────────────────────────────────────
type TaskStatus =
  | 'backlog'       // 待规划（对应 Linear 的 Backlog）
  | 'todo'          // 待开始
  | 'in_progress'   // 进行中
  | 'in_review'     // 审核中（人工 or AI 自检）
  | 'blocked'       // 被阻塞
  | 'done'          // 已完成
  | 'cancelled';    // 已取消

type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

// ── Task 主体 ─────────────────────────────────────────────
interface Task {
  id: string;                      // nanoid 生成
  projectId: string | null;        // 所属项目（可无项目）
  number: number;                  // 工作区内自增编号，用于展示（如 #42）
  identifier: string;              // 可读标识符（如 XOPC-42）

  title: string;
  description: string | null;      // Markdown 正文

  status: TaskStatus;
  priority: TaskPriority;
  position: number;                // Float 排序，支持拖拽插入无需重排

  // 创建者（必填）
  creatorType: ActorType;
  creatorId: string;

  // 执行者（可选，支持人 or AI 数字人）
  assigneeType: ActorType | null;
  assigneeId: string | null;

  parentId: string | null;         // 父任务 ID（支持子任务树）
  labels: Label[];                 // 标签
  dueDate: string | null;

  // ── Task-Native 扩展字段 ──────────────────────────────
  intent: string;                  // 用户原始意图（自然语言，AI 接入后用于 Task Parsing）
  acceptanceCriteria: string[];    // 验收标准列表（比 goals 更工程化）
  contextRefs: ContextRef[];       // 上下文引用（文档链接、代码片段等）

  // 运行时聚合字段（不存库，由 API 计算返回）
  children: Task[];
  comments: TaskComment[];
  agentRuns: AgentRun[];

  createdAt: string;
  updatedAt: string;
}

// ── 标签 ─────────────────────────────────────────────────
interface Label {
  id: string;
  name: string;
  color: string;                   // hex 颜色
}

// ── 上下文引用 ────────────────────────────────────────────
interface ContextRef {
  type: 'url' | 'file' | 'snippet';
  title: string;
  value: string;
}

// ── 评论 / 活动日志（一张表承担两个职责）────────────────────
type CommentType =
  | 'comment'         // 普通评论
  | 'status_change'   // 状态变更日志（系统自动写入）
  | 'progress_update' // AI 进度汇报（Agent 写入）
  | 'system';         // 系统通知

interface TaskComment {
  id: string;
  taskId: string;
  authorType: ActorType;
  authorId: string;
  content: string;                 // Markdown
  type: CommentType;
  parentId: string | null;         // 支持回复嵌套
  createdAt: string;
  updatedAt: string;
}

// ── AI 执行记录（预留，Phase 3 实现）────────────────────────
type AgentRunStatus =
  | 'queued' | 'dispatched' | 'running'
  | 'completed' | 'failed' | 'cancelled';

interface AgentRun {
  id: string;
  taskId: string;
  agentId: string;
  status: AgentRunStatus;
  sessionId: string | null;        // AI 会话 ID，支持断点续跑
  workDir: string | null;
  result: unknown;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
```

### 3.2 Task 状态机

```
                    ┌─────────┐
                    │ pending │ ◄──────────────────┐
                    └────┬────┘                    │
                         │ start                   │ reopen
                    ┌────▼──────────┐              │
                    │  in_progress  │──────────────►│
                    └────┬──────┬──┘              done
                         │      │
                  block  │      │ complete
                         │      │
                    ┌────▼──┐  ┌▼────┐
                    │blocked│  │done │
                    └───────┘  └─────┘
                         │
                    unblock│
                         │
                    ┌─────▼──────────┐
                    │  in_progress   │
                    └────────────────┘

  任意状态 ──cancel──► cancelled
```

### 3.3 核心功能列表

#### F1：Task 管理
- 创建 Task（支持自然语言意图 + 结构化字段）
- 编辑 Task（内联编辑，Notion 风格）
- 删除 / 归档 Task
- 状态流转（拖拽 or 快捷键）
- 批量操作（批量状态变更、批量删除）

#### F2：Task Graph（任务图）
- 创建子任务（无限层级）
- 设置任务依赖（A 依赖 B 完成后才能开始）
- 可视化任务树（折叠/展开）
- 父任务进度自动聚合（子任务完成率 → 父任务进度）

#### F3：看板视图
- 按状态分列（Pending / In Progress / Blocked / Done）
- 卡片拖拽（跨列 = 状态变更）
- 卡片快速预览（hover 展示 Memory 摘要）
- 按 Assignee / Priority / Tag 筛选

#### F4：列表视图
- 表格形式展示所有 Task
- 支持排序（优先级、截止日期、更新时间）
- 支持分组（按状态、按 Assignee、按 Tag）
- 内联编辑

#### F5：Task Detail 面板
- 右侧滑出面板（Linear 风格）
- 完整字段编辑
- Task Memory 时间线（类似 GitHub Issue 的 Activity）
- 子任务列表（可展开）
- 依赖关系展示

#### F6：Task Memory
- 添加笔记（Markdown 编辑器）
- 记录决策（Decision Log）
- 上传成果物（文件链接 / 文本）
- AI 执行日志（预留，AI 接入后自动写入）

#### F7：实时更新（SSE）
- 任务状态变更实时推送到所有客户端
- AI 数字人执行进度实时推送（预留）
- 连接断开自动重连

#### F8：AI 数字人接入预留
- `/api/agent/tasks/:id/update` — AI 更新任务状态
- `/api/agent/tasks/:id/memory` — AI 写入执行记忆
- `/api/agent/tasks/:id/subtasks` — AI 创建子任务
- Agent 身份认证（API Key）

---

## 四、技术架构

### 4.1 目录结构

```
xopc-kanban/
├── packages/
│   ├── server/                    # Hono 后端
│   │   ├── src/
│   │   │   ├── index.ts           # 入口，Hono app 初始化
│   │   │   ├── db/
│   │   │   │   ├── schema.ts      # SQLite 表结构定义
│   │   │   │   ├── migrations/    # 数据库迁移脚本
│   │   │   │   └── client.ts      # better-sqlite3 实例
│   │   │   ├── routes/
│   │   │   │   ├── tasks.ts       # Task CRUD API
│   │   │   │   ├── memory.ts      # Task Memory API
│   │   │   │   ├── events.ts      # SSE 事件流
│   │   │   │   └── agent.ts       # AI Agent 接入 API（预留）
│   │   │   ├── services/
│   │   │   │   ├── TaskService.ts
│   │   │   │   ├── MemoryService.ts
│   │   │   │   └── EventBus.ts    # SSE 事件总线
│   │   │   └── types/
│   │   │       └── index.ts       # 共享类型定义
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── client/                    # React 前端
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── Board/         # 看板视图
│       │   │   │   ├── BoardView.tsx
│       │   │   │   ├── BoardColumn.tsx
│       │   │   │   └── TaskCard.tsx
│       │   │   ├── List/          # 列表视图
│       │   │   │   └── ListView.tsx
│       │   │   ├── TaskDetail/    # 任务详情面板
│       │   │   │   ├── TaskDetailPanel.tsx
│       │   │   │   ├── MemoryTimeline.tsx
│       │   │   │   └── SubTaskList.tsx
│       │   │   ├── TaskGraph/     # 任务图可视化
│       │   │   │   └── TaskGraphView.tsx
│       │   │   └── ui/            # 基础 UI 组件
│       │   ├── store/
│       │   │   ├── taskStore.ts   # Zustand Task 状态
│       │   │   └── uiStore.ts     # UI 状态（面板开关等）
│       │   ├── hooks/
│       │   │   ├── useTasks.ts    # React Query hooks
│       │   │   ├── useSSE.ts      # SSE 实时订阅
│       │   │   └── useTaskGraph.ts
│       │   ├── api/
│       │   │   └── client.ts      # API 请求封装
│       │   └── types/
│       │       └── index.ts
│       ├── package.json
│       └── vite.config.ts
│
├── package.json                   # monorepo 根
└── pnpm-workspace.yaml
```

### 4.2 数据库 Schema

> 设计参考 multica 的生产级数据模型，针对 SQLite 做了适配（TEXT 替代 UUID，JSON 替代 JSONB）。

```sql
-- ─────────────────────────────────────────────
-- 项目（Task 的容器层，可选归属）
-- ─────────────────────────────────────────────
CREATE TABLE project (
  id          TEXT PRIMARY KEY,                -- nanoid
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,                            -- emoji 或图标名
  status      TEXT NOT NULL DEFAULT 'planned'
              CHECK (status IN ('planned','in_progress','paused','completed','cancelled')),
  priority    TEXT NOT NULL DEFAULT 'none'
              CHECK (priority IN ('urgent','high','medium','low','none')),
  lead_type   TEXT CHECK (lead_type IN ('member','agent')),
  lead_id     TEXT,                            -- 负责人（人 or AI 数字人）
  position    REAL NOT NULL DEFAULT 0,         -- 浮点排序，拖拽无需重排
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ─────────────────────────────────────────────
-- 标签（工作区级别，可复用）
-- ─────────────────────────────────────────────
CREATE TABLE label (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  color TEXT NOT NULL                          -- hex 颜色，如 #6366f1
);

-- ─────────────────────────────────────────────
-- 任务主表（核心原子单位）
-- ─────────────────────────────────────────────
CREATE TABLE task (
  id          TEXT PRIMARY KEY,                -- nanoid
  project_id  TEXT REFERENCES project(id) ON DELETE SET NULL,
  number      INTEGER NOT NULL,                -- 工作区内自增编号（展示用，如 #42）
  identifier  TEXT NOT NULL,                   -- 可读标识符（如 XOPC-42）

  title       TEXT NOT NULL,
  description TEXT,                            -- Markdown 正文

  status      TEXT NOT NULL DEFAULT 'backlog'
              CHECK (status IN ('backlog','todo','in_progress','in_review','blocked','done','cancelled')),
  priority    TEXT NOT NULL DEFAULT 'none'
              CHECK (priority IN ('urgent','high','medium','low','none')),
  position    REAL NOT NULL DEFAULT 0,         -- 浮点排序，同列内拖拽排序

  -- 创建者（必填，人 or AI 数字人）
  creator_type TEXT NOT NULL CHECK (creator_type IN ('member','agent')),
  creator_id   TEXT NOT NULL,

  -- 执行者（可选）
  assignee_type TEXT CHECK (assignee_type IN ('member','agent')),
  assignee_id   TEXT,

  parent_id   TEXT REFERENCES task(id) ON DELETE SET NULL,  -- 父任务（子任务树）
  due_date    TEXT,

  -- Task-Native 扩展字段
  intent               TEXT DEFAULT '',        -- 用户原始意图（自然语言）
  acceptance_criteria  TEXT DEFAULT '[]',      -- JSON array，验收标准
  context_refs         TEXT DEFAULT '[]',      -- JSON array，上下文引用

  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ─────────────────────────────────────────────
-- 任务 ↔ 标签（多对多）
-- ─────────────────────────────────────────────
CREATE TABLE task_label (
  task_id   TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  label_id  TEXT NOT NULL REFERENCES label(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- ─────────────────────────────────────────────
-- 任务依赖关系（有向图，带关系类型）
-- 参考 multica：blocks / blocked_by / related
-- ─────────────────────────────────────────────
CREATE TABLE task_dependency (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  depends_on_id   TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'blocks'
                  CHECK (type IN ('blocks','blocked_by','related')),
  created_at      TEXT NOT NULL,
  UNIQUE (task_id, depends_on_id)
);

-- ─────────────────────────────────────────────
-- 评论 / 活动日志（一张表承担两个职责）
-- type = 'comment'         → 用户评论
-- type = 'status_change'   → 状态变更（系统自动写入）
-- type = 'progress_update' → AI 进度汇报（Agent 写入）
-- type = 'system'          → 系统通知
-- ─────────────────────────────────────────────
CREATE TABLE task_comment (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('member','agent')),
  author_id   TEXT NOT NULL,
  content     TEXT NOT NULL,                   -- Markdown
  type        TEXT NOT NULL DEFAULT 'comment'
              CHECK (type IN ('comment','status_change','progress_update','system')),
  parent_id   TEXT REFERENCES task_comment(id) ON DELETE CASCADE,  -- 回复嵌套
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ─────────────────────────────────────────────
-- AI 执行记录（预留，Phase 3 实现）
-- 与 Task 分离：一个 Task 可被多次执行（重试、重新分配）
-- 参考 multica agent_task_queue 的设计
-- ─────────────────────────────────────────────
CREATE TABLE agent_run (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  agent_id      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','dispatched','running','completed','failed','cancelled')),
  priority      INTEGER NOT NULL DEFAULT 0,
  session_id    TEXT,                          -- AI 会话 ID，支持断点续跑
  work_dir      TEXT,
  result        TEXT,                          -- JSON
  error         TEXT,
  dispatched_at TEXT,
  started_at    TEXT,
  completed_at  TEXT,
  created_at    TEXT NOT NULL
);

-- ─────────────────────────────────────────────
-- 索引
-- ─────────────────────────────────────────────
CREATE INDEX idx_task_project    ON task(project_id);
CREATE INDEX idx_task_status     ON task(status);
CREATE INDEX idx_task_assignee   ON task(assignee_type, assignee_id);
CREATE INDEX idx_task_parent     ON task(parent_id);
CREATE INDEX idx_task_number     ON task(number);

-- 部分索引：只索引待执行的 agent_run，减少索引体积
CREATE INDEX idx_agent_run_pending
  ON agent_run(task_id, priority DESC, created_at ASC)
  WHERE status IN ('queued','dispatched');

CREATE INDEX idx_task_comment_task ON task_comment(task_id);
CREATE INDEX idx_task_dependency_task ON task_dependency(task_id);
```

#### Schema 设计决策说明

| 决策点 | 选择 | 理由 |
|--------|------|------|
| `position REAL` | 浮点排序 | 拖拽插入两条记录之间取中间值，无需重排整列（Linear 经典技巧）|
| `task_comment` 承担 Activity Log | 一张表 | 比独立的 `task_memory` + `task_events` 更简洁，查询更统一 |
| `agent_run` 独立表 | Task 定义与执行分离 | 一个 Task 可被多次执行，每次执行是独立记录，支持重试和历史追溯 |
| `acceptance_criteria` 替代 `goals` | JSON array | 更工程化，可逐条勾选验收，AI 接入后可自动验证 |
| `task_dependency.type` | blocks / blocked_by / related | 比单向依赖更完整，支持双向关系语义 |
| `number` + `identifier` | 自增编号 + 可读标识符 | `number=42` 用于排序，`identifier=XOPC-42` 用于展示和引用 |

### 4.3 API 设计

#### Task API

```
GET    /api/tasks                    # 获取任务列表（支持过滤、排序、分页）
POST   /api/tasks                    # 创建任务
GET    /api/tasks/:id                # 获取任务详情（含子任务、Memory）
PATCH  /api/tasks/:id                # 更新任务字段
DELETE /api/tasks/:id                # 删除任务
PATCH  /api/tasks/:id/status         # 状态流转（带状态机校验）
POST   /api/tasks/:id/subtasks       # 创建子任务
GET    /api/tasks/:id/graph          # 获取任务图（含依赖关系）
```

#### Memory API

```
GET    /api/tasks/:id/memory         # 获取任务记忆列表
POST   /api/tasks/:id/memory         # 添加记忆条目
DELETE /api/tasks/:id/memory/:memId  # 删除记忆条目
```

#### SSE 事件流

```
GET    /api/events                   # 全局事件流（所有任务变更）
GET    /api/events/:taskId           # 单任务事件流
```

#### Agent API（预留）

```
POST   /api/agent/tasks/:id/update   # AI 更新任务状态和进度
POST   /api/agent/tasks/:id/memory   # AI 写入执行记忆
POST   /api/agent/tasks/:id/subtasks # AI 创建子任务
```

### 4.4 前端状态管理

```typescript
// Zustand Store 设计
interface TaskStore {
  // 状态
  tasks: Map<string, Task>;
  selectedTaskId: string | null;
  viewMode: 'board' | 'list' | 'graph';
  filters: TaskFilters;

  // 操作
  setTasks: (tasks: Task[]) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  selectTask: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setFilters: (filters: Partial<TaskFilters>) => void;
}

// React Query 负责服务端数据同步
// Zustand 负责 UI 状态和乐观更新
// SSE 负责实时推送 → 触发 React Query invalidate
```

### 4.5 SSE 实时推送设计

```typescript
// 服务端 EventBus
class EventBus {
  private clients: Map<string, Response> = new Map();

  subscribe(clientId: string, response: Response): void;
  unsubscribe(clientId: string): void;
  publish(event: TaskEvent): void;  // 广播给所有客户端
  publishToTask(taskId: string, event: TaskEvent): void;
}

// 事件格式
interface TaskEvent {
  type: 'task.created' | 'task.updated' | 'task.deleted'
      | 'task.status_changed' | 'memory.added';
  taskId: string;
  payload: unknown;
  timestamp: string;
}
```

### 4.6 技术选型汇总

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 后端框架 | **Hono** | 轻量、TypeScript 原生、Edge-ready，API 设计简洁 |
| 数据库 | **SQLite + better-sqlite3** | 零配置、单文件、同步 API 简单可靠 |
| 数据库迁移 | **drizzle-orm** | TypeScript 类型安全的 Schema 定义 + 迁移管理 |
| 前端框架 | **Vite + React 18 + TypeScript** | 开发体验最佳，生态成熟 |
| 状态管理 | **Zustand** | 轻量、无 boilerplate，适合中小型应用 |
| 服务端状态 | **React Query (TanStack Query)** | 缓存、同步、乐观更新一体化 |
| 拖拽 | **@dnd-kit/core** | 现代、无障碍、性能好，替代 react-beautiful-dnd |
| UI 组件 | **shadcn/ui + Tailwind CSS** | Notion/Linear 风格，可定制性强 |
| 图标 | **Lucide React** | Linear 同款图标库 |
| Markdown | **@uiw/react-md-editor** | 轻量 Markdown 编辑器 |
| 包管理 | **pnpm + monorepo** | 统一管理 server/client 两个包 |
| 实时通信 | **SSE（Server-Sent Events）** | 单向推送足够，比 WebSocket 更简单 |

---

## 五、UI 设计规范

> 完整设计语言规范见 `DESIGN.md`，本节为看板应用的落地摘要。

### 5.1 视觉气质：Calm Intelligence（沉静智能）

界面是背景，用户的任务是主角；AI 在需要时准确出现，不需要时不抢戏。

- **中性灰占绝对主导**（约 95% 面积），单一蓝色作为唯一强调色
- **信息密度高但不拥挤**：列表/工具栏偏紧，阅读区/空状态偏松
- **状态靠色点，不靠色块**：避免彩虹式看板列
- **层级靠表面色阶 + 细边框**，不靠重阴影；侧栏与主区无竖线切割

### 5.2 颜色系统

#### 表面层级（Light / Dark 双套）

| 语义 Token | Light | Dark | 用途 |
|-----------|-------|------|------|
| `surface-base` | `#f5f5f7` | `#1c1c1e` | 全局底层、侧栏背景 |
| `surface-panel` | `#ffffff` | `#2c2c2e` | 主内容区、卡片面 |
| `surface-hover` | `#e8e8ed` | `#3a3a3c` | 列表行悬停 |
| `surface-active` | `#dcdcde` | `#48484a` | 按下 / 选中 |

#### 文本色阶

| 层级 | Light | Dark | 用途 |
|------|-------|------|------|
| `fg` | `#1d1d1f` | `#f5f5f7` | 标题、正文 |
| `fg-secondary` | `#6e6e73` | `#a1a1a6` | 说明文字 |
| `fg-subtle` | `#86868b` | `#8e8e93` | 时间戳、元信息 |
| `fg-disabled` | `#aeaeb2` | `#636366` | 禁用态 |

#### 边框

| 层级 | Light | Dark |
|------|-------|------|
| `edge-subtle` | `#ebebed` | `#3a3a3c` |
| `edge` | `#d2d2d7` | `#48484a` |

#### 强调色（唯一彩色）

- **主蓝**：Light `#2563eb`（hover `#1d4ed8`）/ Dark `#3b82f6`（hover `#2563eb`）
- 用于：主按钮、关键选中态、链接、AI 相关操作入口
- **全屏强蓝不超过 2-3 处**

#### 任务状态色点（低饱和，仅点状使用）

```
backlog     → #86868b  ⬤  灰（未规划）
todo        → #6e6e73  ⬤  深灰（待开始）
in_progress → #2563eb  ⬤  蓝（进行中）
in_review   → #7c3aed  ⬤  紫（审核中）
blocked     → #ea580c  ⬤  橙（阻塞）
done        → #16a34a  ⬤  绿（完成）
cancelled   → #aeaeb2  ⬤  浅灰（取消）
```

#### 优先级色标

```
urgent → #ef4444  红
high   → #f97316  橙
medium → #eab308  黄
low    → #86868b  灰
none   → 不显示
```

#### Assignee 类型区分

```
member   → 用户头像（圆形）
agent    → 机器人图标，accent 蓝色调（区别于人类执行者）
```

### 5.3 字体与排版

- **字体栈**：系统无衬线（SF Pro / PingFang / Segoe UI），不引入额外字体
- **代码等宽**：SF Mono / Menlo / Consolas

| 层级 | Tailwind 类 | 尺寸 | 字重 | 场景 |
|------|------------|------|------|------|
| Title | `text-xl tracking-tight` | 20px | `semibold` | 页面标题、模态标题 |
| Heading | `text-base` | 16px | `semibold` | 卡片标题、区块标题 |
| Body | `text-sm leading-relaxed` | 14px | `normal` | 任务描述、评论正文 |
| UI | `text-sm leading-6` | 14px | `medium` | 按钮、列表项、标签（最常用）|
| Caption | `text-xs leading-5` | 12px | `normal` | 时间戳、编号、元信息 |

### 5.4 布局结构

```
┌──────────────────────────────────────────────────────┐
│  侧栏 240px          │  主内容区（fluid）              │
│  bg: surface-base    │  bg: surface-panel             │
│                      │                                │
│  · 导航项            │  ┌─ 工具栏（筛选/视图切换）──┐  │
│  · 项目列表          │  │  text-sm font-medium       │  │
│  · 快捷入口          │  └────────────────────────────┘  │
│                      │                                │
│  ← 无竖线分割 →      │  看板列 / 列表 / 任务图        │
│  仅靠色面区分        │                                │
└──────────────────────────────────────────────────────┘
                                        │
                              ┌─────────▼──────────┐
                              │  Task Detail 面板   │
                              │  右侧滑出，不跳页   │
                              │  宽约 480px         │
                              └────────────────────┘
```

- **侧栏**：`bg-surface-base`，宽 240px，导航行 `gap-1.5`，整行可点
- **主区**：`bg-surface-panel`，内容不无意义全宽拉伸
- **Detail 面板**：右侧滑出（Linear 风格），宽约 480px，`shadow-elevated`
- **侧栏与主区**：仅靠色面区分，**不加竖向分割线**

### 5.5 组件规范

#### 按钮
- **主按钮**：`bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium`，每屏最多一个
- **次要按钮**：`bg-surface-panel border border-edge rounded-xl`
- **最小命中高度 ≥ 44px**（含 padding）
- 按压：`active:scale-95 transition-colors`

#### 卡片（Task Card）
- `bg-surface-panel border border-edge-subtle rounded-xl`
- hover：`bg-surface-hover`
- 状态色点 `8px` 圆点，左侧或标题前
- 优先级色标：左侧 `2px` 竖条或图标

#### 输入框
- `bg-surface-panel border border-edge rounded-xl`
- focus：`ring-2 ring-accent`
- placeholder：`text-fg-subtle`

#### 图标
- 统一 **Lucide outline**
- 导航：`20px`，列表/按钮内：`16px`，空状态：`48px`
- 默认色：`text-fg-subtle`，激活：`text-fg`

### 5.6 动效规范

| 场景 | 时长 | 缓动 |
|------|------|------|
| 颜色 / 背景切换 | 150ms | `ease-out` |
| 面板滑入滑出 | 300ms | `ease-out` |
| 卡片拖拽 | 200ms | `ease-out` |
| 按压反馈 | 即时 | `active:scale-95` |

- 只动画 `transform` 与 `opacity`，**禁止** `transition-all`
- **必须**支持 `prefers-reduced-motion: reduce`

### 5.7 核心交互模式

- **快速创建**：任意位置按 `C` 键弹出创建面板（Linear 风格）
- **快速搜索**：`Cmd+K` 全局命令面板
- **状态切换**：卡片右键菜单 or 跨列拖拽
- **详情面板**：点击卡片 → 右侧滑出，不跳页，保持看板上下文
- **内联编辑**：双击标题直接编辑（Notion 风格）
- **键盘焦点**：所有可聚焦元素必须有 `focus-visible` 样式，鼠标操作不显示焦点环

---

## 六、开发路线图

### Phase 1 — 基础看板（MVP）
- [ ] Monorepo 项目初始化（pnpm + Hono + Vite）
- [ ] SQLite Schema + drizzle-orm 迁移
- [ ] Task CRUD API（Hono）
- [ ] 看板视图（Board View）+ 拖拽
- [ ] Task Detail 右侧面板
- [ ] SSE 实时更新

### Phase 2 — Task-Native 特性
- [ ] Task Graph（子任务 + 依赖关系）
- [ ] Task Memory 时间线
- [ ] 列表视图 + 分组排序
- [ ] 快捷键系统
- [ ] 深色主题

### Phase 3 — AI 数字人接入
- [ ] Agent API 路由实现
- [ ] AI Assignee 类型支持
- [ ] AI 执行日志实时展示
- [ ] Task 自动分解（Task Engine 接入）

---

## 七、关键设计决策

### 决策 1：为什么用 SQLite 而不是 PostgreSQL？
本地开发零配置，单文件数据库便于备份和迁移。Task-Native 系统的数据量在个人/小团队场景下完全够用。后续如需扩展，drizzle-orm 支持无缝切换到 PostgreSQL。

### 决策 2：为什么用 SSE 而不是 WebSocket？
AI 任务状态更新是单向的（服务端 → 客户端），SSE 足够且更简单。Hono 原生支持 SSE，无需额外库。

### 决策 3：为什么预留 Agent API 而不是现在就接入？
先把 UI + 数据层做扎实，确保 Task 模型设计合理，再接入 AI。避免 AI 能力不稳定影响核心产品体验。

### 决策 4：Zustand + React Query 双状态管理？
React Query 管理服务端数据（缓存、同步、失效），Zustand 管理纯 UI 状态（选中的 Task、面板开关、视图模式）。两者职责清晰，不重叠。
