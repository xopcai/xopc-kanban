# 文档索引

| 文档 | 说明 |
|------|------|
| [领域与数据模型](./domain-model.md) | 仓库结构、核心概念、数据库表与关系、Actor 与鉴权要点 |
| [认证与 HTTP API](./auth-and-api.md) | JWT、公开路由、受保护路由、客户端约定 |
| [Task-Native 技术设计](./task-native-design.md) | 产品定位、整体架构与 Task-Native 方向的扩展设计（历史稿） |

实现细节以代码为准：`packages/server/src/db/schema.ts`（Drizzle 表定义）、`packages/server/src/index.ts`（路由挂载）。
