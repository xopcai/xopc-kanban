# 领域与数据模型

本文整理 **xopc-kanban** 当前实现中的领域概念与持久化模型，便于 onboarding 与演进时对照。

## 1. 仓库与运行时

| 包 | 技术栈 | 职责 |
|----|--------|------|
| `packages/server` | Hono、SQLite（`better-sqlite3`）、Drizzle ORM | REST API、SSE、鉴权、业务服务 |
| `packages/client` | React 18、Vite、TanStack Query、Zustand | 看板 / 列表 / 图视图、登录态、调用 API |

数据文件位置由服务端配置决定（常见为仓库内 SQLite 文件，通过 Drizzle `push` / 迁移与 `schema.ts` 对齐）。

## 2. 核心领域概念

### 2.1 Actor（行动者）

系统中「谁在做」统一抽象为 **Actor**，类型为 `member`（人类）或 `agent`（自动化主体）。

- **人类（member）**：邮箱 + 密码注册；登录后持有 **JWT**，`sub` 为 `member.id`。
- **Agent**：由已登录人类创建；通过 **API Key**（`credentialId.secret`）在 `/api/auth/agent/exchange` 换得 **agent JWT**，`sub` 为 `agent.id`。

任务、评论、分配等字段用 **成对的 `*Type` + `*Id`** 指向 Actor，而不是多态外键到单表：

| 语义 | 字段 |
|------|------|
| 创建者 | `creatorType` + `creatorId` |
| 负责人 | `assigneeType` + `assigneeId`（可空） |
| 评论作者 | `authorType` + `authorId` |

`member` / `agent` 表与上述 ID 解耦存储：历史数据可出现尚未迁移的占位 ID（如 `local-user`），新写入应使用真实 member/agent 的 UUID。

### 2.2 Project（项目）

顶层容器：`project` 表描述项目元数据（标题、描述、状态、优先级等）。任务可关联 `projectId`（可空）。

### 2.3 Task（任务）

核心实体：状态机、优先级、排序位置、父子关系（`parentId`）、可选截止日期。扩展字段包括 `intent`、`acceptanceCriteria`（JSON 数组序列化）、`contextRefs`（JSON 数组序列化）等，供 Task-Native / AI 工作流使用（见 [task-native-design.md](./task-native-design.md)）。

### 2.4 Label（标签）

独立目录表 `label`；任务与标签多对多通过 `task_label`。

### 2.5 Task Graph（依赖）

`task_dependency` 存储有向依赖边，`type` 为 `blocks` | `blocked_by` | `related`。

### 2.6 Task Memory / 评论

统一落在 **`task_comment`** 表：通过 `type` 区分 `comment`、`status_change`、`progress_update`、`system` 等。支持 `parentId` 嵌套回复。客户端「Memory 时间线」与部分评论能力均基于该表（服务层见 `MemoryService` / `TaskService`）。

### 2.7 Agent Run（预留执行记录）

`agent_run` 关联 `taskId` 与 `agentId`，记录队列状态、会话、结果等，供后续 Agent 执行引擎接入；与登录用 `agent` 账号表不同（后者是身份，前者是一次运行实例）。

## 3. 数据库表一览（Drizzle）

下列与 `packages/server/src/db/schema.ts` 一致；时间字段在 SQLite 中为 ISO 8601 字符串。

### 3.1 身份与凭据

| 表 | 说明 |
|----|------|
| `member` | `id`, `email`（唯一）, `password_hash`, `display_name`, `created_at`, `updated_at` |
| `agent` | `id`, `name`, `description`, `created_by_member_id` → `member.id`（可空，删除 member 时置空）, 时间戳 |
| `agent_credential` | `id`（公开 Key Id）, `agent_id` → `agent.id`（级联删）, `secret_hash`, `created_at` |

API Key 明文格式：`{credentialId}.{rawSecret}`，仅创建时返回一次；服务端只存 `secret` 的哈希。

### 3.2 项目与任务

| 表 | 说明 |
|----|------|
| `project` | 项目元数据；`lead_type` / `lead_id` 与 Task 侧 Actor 模式一致 |
| `task` | 任务主表；`creator_*` 必填，`assignee_*` 可空；`parent_id` 自引用 |
| `label` | 标签定义 |
| `task_label` | `(task_id, label_id)` 复合主键 |
| `task_dependency` | 依赖边 |
| `task_comment` | 评论与 memory 条目 |
| `agent_run` | Agent 运行记录（扩展用） |

### 3.3 关系示意（Mermaid）

```mermaid
erDiagram
  member ||--o{ agent : creates
  agent ||--|{ agent_credential : has
  project ||--o{ task : contains
  task ||--o{ task : parent
  task ||--o{ task_label : has
  label ||--o{ task_label : tagged
  task ||--o{ task_dependency : from
  task ||--o{ task_dependency : to
  task ||--o{ task_comment : has
  task_comment ||--o{ task_comment : replies
  task ||--o{ agent_run : runs
```

## 4. 与客户端类型的对应

`packages/client/src/types/index.ts` 中的 `Task`、`TaskComment`、`Label`、`ActorType` 等与 API JSON 形状对齐；协作者列表来自 `GET /api/workspace/actors`，在前端映射为 `WorkspaceMember[]`（`lib/members.ts`），用于筛选器与负责人下拉。

## 5. 环境变量（服务端）

| 变量 | 作用 |
|------|------|
| `JWT_SECRET` | HS256 签名密钥；生产环境必须设置且长度 ≥ 16 |
| `PORT` | 监听端口，默认 `8787` |
| `NODE_ENV` | `production` 时未配置 `JWT_SECRET` 将抛错 |

开发环境未设置 `JWT_SECRET` 时使用内置占位密钥（**禁止用于生产**）。
