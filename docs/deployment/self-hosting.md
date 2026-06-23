# Eve 自部署指南

## 一句话结论

Eve 可以自部署，不是只能部署在 Vercel。

但自部署不是简单的 `npm run start` 就完事。生产化需要重点处理：

```txt
Node 版本
模型 provider
Workflow 状态存储
鉴权
Sandbox
反向代理
日志和可观测性
```

## 推荐架构

如果项目只做 SPA，不做 SSR，推荐：

```txt
apps/web      # React + Vite SPA
apps/api      # Hono 业务 API
apps/agent    # Eve / Workflow Agent Runtime
packages/*    # shared/db/document/agent-core 等共享包
```

运行关系：

```txt
浏览器 SPA
  → /api/*  Hono API
  → /eve/*  Eve Agent 服务
```

生产环境可以用 Nginx/Caddy 做反向代理：

```txt
/        → web 静态文件
/api/*   → apps/api
/eve/*   → apps/agent
```

## Node 版本

Eve 当前要求较新的 Node 版本。建议自部署时直接用 Docker 固定 Node 版本，避免污染服务器全局环境。

示例：

```dockerfile
FROM node:24-bookworm-slim
```

## 模型 provider

自部署时不一定要依赖 Vercel AI Gateway。

可以直接使用 AI SDK provider，例如 DeepSeek：

```ts
import { defineAgent } from "eve";
import { deepseek } from "@ai-sdk/deepseek";

export default defineAgent({
  model: deepseek(process.env.DEEPSEEK_MODEL ?? "deepseek-chat"),
});
```

环境变量：

```txt
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat
```

## Workflow 持久化

不要把生产环境长期依赖默认本地文件存储。

推荐自部署使用 Postgres World：

```txt
WORKFLOW_TARGET_WORLD="@workflow/world-postgres"
WORKFLOW_POSTGRES_URL="postgres://user:password@postgres:5432/eve"
```

Postgres World 的意义：

```txt
PostgreSQL 保存 workflow runs/events/steps/hooks
graphile-worker 做任务队列和重试
PostgreSQL NOTIFY/LISTEN 做事件分发
```

## 鉴权

不要让 `/eve/v1/session` 裸奔。

至少要保护这些路由：

```txt
POST /eve/v1/session
POST /eve/v1/session/:sessionId
GET  /eve/v1/session/:sessionId/stream
```

开发环境可以用 `localDev()`。内网测试可以用 Basic Auth。生产建议接你们自己的 JWT、OIDC 或自定义 AuthFn。

## Sandbox

第一阶段建议：

```txt
Docker sandbox + deny-all 网络
```

不要让 Agent 默认拥有任意外网访问、任意 shell 和正式数据写入能力。

敏感业务动作应该通过自定义工具完成，由后端控制权限、审批、审计和幂等。

## 最小 Docker Compose 思路

```yaml
services:
  web:
    build: ./apps/web

  api:
    build: ./apps/api
    environment:
      DATABASE_URL: postgres://app:app@postgres:5432/app

  agent:
    build: ./apps/agent
    environment:
      PORT: 3000
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
      WORKFLOW_TARGET_WORLD: "@workflow/world-postgres"
      WORKFLOW_POSTGRES_URL: postgres://app:app@postgres:5432/app

  postgres:
    image: pgvector/pgvector:pg17
```

## 常见误区

### 误区一：自部署必须用 Vercel AI Gateway

不是。可以直接用 AI SDK provider。

### 误区二：装 Nitro 就必须做 SSR

不是。Nitro 在 Eve/Workflow 里主要提供服务端运行层，不代表你的前端必须 SSR。

### 误区三：Hono 和 Eve 不能共存

可以共存。Hono 管业务 API，Eve 管 Agent Runtime。也可以把 Eve 独立成 `apps/agent`。

## 官方链接

- https://eve.dev/docs/guides/deployment
- https://workflow-sdk.dev/worlds/postgres
