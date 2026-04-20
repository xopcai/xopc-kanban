# 认证与 HTTP API 概要

本文描述当前实现的鉴权方式与路由分层，细节以 `packages/server/src` 下代码为准。

## 1. JWT 载荷

使用 **HS256**，载荷字段包括：

- `sub`：主体 ID，即 `member.id` 或 `agent.id`
- `typ`：`member` | `agent`
- `exp` / `iat`：由 `hono/jwt` 签发（默认约 **7 天** 过期，见 `lib/token.ts`）

签发入口：人类登录/注册、`POST /api/auth/agent/exchange`。

## 2. 请求如何携带令牌

1. **常规 HTTP**：`Authorization: Bearer <jwt>`
2. **SSE（EventSource）**：浏览器无法自定义 Header，使用查询参数 `?access_token=<jwt>`（与中间件 `requireAuth` 一致）

注意：查询参数中的 token 可能出现在日志或 Referer；当前为 MVP 权衡，生产可收紧（例如 Cookie、或专用短期 SSE ticket）。

## 3. 中间件

`requireAuth`（`middleware/auth.ts`）：

- 从 Header 或 `access_token` 解析原始字符串
- 校验 JWT 后设置 Hono 变量：`actor: { type: 'member' | 'agent', id: string }`
- 业务服务（如 `TaskService`、`MemoryService`）从路由传入的 `actor` 写入 `creator` / `assignee` / `author`，不再使用硬编码默认用户

未携带或非法令牌返回 **401**。

## 4. 路由挂载（`index.ts`）

| 前缀 | 说明 |
|------|------|
| `/api/auth` | 注册、登录、当前用户、Agent API Key 换 JWT |
| `/api/agents` | 已登录 **member** 创建/列出 Agent（创建时返回一次性 apiKey） |
| `/api/workspace` | 工作区协作者（members + agents）等 |
| `/api/tasks` | 任务 CRUD、子任务、依赖、评论 memory 等 |
| `/api/labels` | 标签 |
| `/api/events` | SSE 等事件流 |
| `/api/agent` | Agent 相关占位/扩展路由 |

具体子路径以实现文件为准：`routes/auth.ts`、`routes/agents.ts`、`routes/workspace.ts`、`routes/tasks.ts` 等。

## 5. CORS

允许头包含 `Content-Type` 与 `Authorization`，便于浏览器跨域携带 JWT。

## 6. 客户端约定

- Token 存 **`localStorage`**（键名见 `packages/client/src/store/authStore.ts`）
- 统一通过 `apiFetch` 附加 `Authorization`；**401** 时对非登录类请求清理会话
- 应用壳层：`hydrate` → 有 token 则请求 `GET /api/auth/me` 恢复 `user`，失败则登出

## 7. 密码与注册

注册/登录请求体校验使用 Zod（如密码最小长度）；密码以 **bcrypt** 哈希存入 `member.password_hash`，接口响应永不返回密码或哈希。
