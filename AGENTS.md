# AGENTS.md — XOPC Kanban

面向在本仓库工作的自动化代理与人类贡献者：先读本文，再改代码。

## 权威文档

| 文档 | 用途 |
|------|------|
| [docs/task-native-design.md](docs/task-native-design.md) | 产品定位、Task 模型、API、Schema、目录规划、路线图 |
| [DESIGN.md](DESIGN.md) | 视觉与交互语言（Calm Intelligence）、语义色、排版、动效 |

实现 UI 或主题时以 **DESIGN.md** 为准；实现领域模型与接口时以 **task-native-design.md** 为准。二者冲突时，以 task-native-design 中的「工程落地」小节（如 `DESIGN.md` 摘要）为仲裁。

## 产品一句话

以 **Task 为原子** 的 AI 看板：人创建任务，未来由 AI 执行；MVP 聚焦 Task CRUD、状态机、图与记忆、看板/列表、SSE。Agent API 为预留，勿在 Phase 1 强行耦合执行引擎。

## 技术栈（规划）

- **Monorepo**：pnpm，`packages/server`（Hono + Node）+ `packages/client`（Vite + React 18 + TypeScript）
- **数据**：SQLite + better-sqlite3，Schema/迁移以 **drizzle-orm** 管理（设计见 task-native-design）
- **前端状态**：Zustand（UI / 选型）+ TanStack Query（服务端同步）；SSE 推送后 invalidate 查询
- **UI**：Tailwind + shadcn/ui，拖拽 @dnd-kit/core，图标 Lucide，Markdown 编辑器按设计文档选型

目录结构以 task-native-design **§4.1** 为蓝图；若仓库尚未生成 `packages/*`，新增代码时按该结构落位。

## 工作方式

1. **最小改动**：只改与任务相关的文件；不借机大重构、不删无关注释。
2. **对齐现有风格**：命名、导入、分层（routes → services → db）与已有文件一致。
3. **类型与安全**：Task 状态、优先级、Actor 类型等与文档中的联合类型对齐；API 与状态流转需可测、可校验。
4. **UI**：中性面 + 单一 `accent` 蓝；语义色仅用于状态点/反馈；`focus-visible`、尊重 `prefers-reduced-motion`；禁止 `transition-all`，动效限于 `transform` / `opacity`。
5. **数据库**：迁移可逆、命名清晰；JSON 列与文档一致（如 `acceptance_criteria`、`context_refs`）。

## 验证

在具备脚本后运行：`pnpm` 工作区内的 lint / typecheck / test（以根 `package.json` 为准）。修改 API 时同步考虑 SSE 事件形状（`TaskEvent`）与客户端订阅。

## 路线图提示

- **Phase 1**：Monorepo、Schema、Task CRUD、看板 + 拖拽、详情面板、SSE  
- **Phase 2**：Task Graph、Memory 时间线、列表与快捷键、深色主题  
- **Phase 3**：Agent API、AI assignee、执行日志  

当前需求若属于后续阶段，可预留类型与路由，但避免阻塞 MVP 交付。
