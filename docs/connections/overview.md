---
title: "连接（Connections）"
description: "把外部 MCP 或 OpenAPI 服务暴露给模型，并让凭据始终留在模型上下文之外。"
---

# 连接（Connections）

Connection 用来把 Agent 接到你没有直接编写的外部服务上。这个外部服务可以是 MCP Server，例如 Linear、GitHub、数据仓库，也可以是任何带 OpenAPI 文档的 HTTP API。

Eve 会帮你处理很多原本需要手写的胶水代码：

- 发现远端工具。
- 把可用工具暴露给模型。
- 给连接工具统一命名。
- 在模型看不到凭据的前提下代理鉴权。
- 支持 approval、OAuth、静态 token、headers、按用户或租户动态解析连接。

Connection 通常放在：

```txt
agent/connections/
```

文件名会成为运行时连接名。例如：

```txt
agent/connections/linear.ts
```

会注册成连接：

```txt
linear
```

模型不会看到连接 URL 或凭据。它通过内置 `connection_search` 发现连接中的工具，并通过限定名调用：

```txt
<connection>__<tool>
```

例如：

```txt
linear__list_issues
```

## MCP connections

当外部服务已经提供 MCP Server 时，使用 MCP connection。MCP Server 会发布它自己的工具和 schema，Eve 会把匹配到的工具变成模型可调用的连接工具。

适合场景：

- 服务已经有 MCP Server。
- 远端工具 schema 由服务端动态维护。
- 一个连接需要暴露一组相关的远端工具。

详细见 [MCP connections](../mcp)。

## OpenAPI connections

当外部服务提供 OpenAPI 3.x 或 Swagger 2.0 文档时，使用 OpenAPI connection。Eve 会把文档里的 operation 转换成连接工具，通常一个 operation 对应一个工具。

适合场景：

- 服务已经有稳定 HTTP API 契约。
- 你希望从 OpenAPI 文档自动生成模型可见工具。
- 你需要通过 allow/block 过滤可见 operation。

详细见 [OpenAPI connections](../openapi)。

## 静态 token 鉴权

`getToken` 返回一个 `TokenResult`：

```ts
{ token: string; expiresAt?: number }
```

Eve 会在每次请求里发送：

```txt
Authorization: Bearer <token>
```

`getToken` 会在每次连接尝试时运行，所以你可以从环境变量、密钥管理器、内部 vault 或自己的 OAuth 交换逻辑中动态取 token。

如果 token 有明确过期时间，可以设置 `expiresAt`，单位是毫秒时间戳。这样 Eve 会提前刷新，而不是等到远端返回 `401`。

凭据不会进入对话历史，也不会交给模型。

## App auth 和 user auth 怎么选

连接凭据可以属于 Agent，也可以属于正在使用 Agent 的人。

| 凭据归属 | 适合场景 | 说明 |
| --- | --- | --- |
| App | Agent 使用一个共享服务账号、bot、installation 或 app credential。 | 默认形态。适合团队共享机器人、统一后台服务。 |
| User | 每个最终用户使用自己的第三方账号授权。 | 需要当前 session 已经有用户身份。 |
| User from a job | 后台任务沿用触发任务的用户授权。 | 需要通过已鉴权 channel 创建或继续 session。 |

`principalType: "user"` 的意思不是“稍后随便找个人确认”，而是“这个凭据绑定到当前 Eve session 里已经认证过的用户”。如果一个 schedule、内部 runtime 调用或 local dev session 没有用户身份，user-scoped connection 会失败，并返回类似 `principal_required` 的原因。

## 无鉴权连接

对于本地开发、公开服务或已经由外层网络保护的服务，可以不写 `auth`：

```ts title="agent/connections/local.ts"
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "http://localhost:3001/mcp",
  description: "Local dev server.",
});
```

不要把 no-auth connection 用在敏感第三方服务上，除非另有安全层保护。

## Headers

当远端服务需要非 Bearer 认证，例如 API Key header，或需要额外配置时，可以使用 `headers`：

```ts title="agent/connections/example.ts"
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://example.com/mcp",
  description: "Example service.",
  headers: {
    "X-Api-Key": process.env.EXAMPLE_API_KEY!,
  },
});
```

`headers` 可以和 `auth` 叠加，也可以用于 MCP 和 OpenAPI 两类 connection。

## 按调用者动态解析 auth 和 headers

如果凭据、租户或路由依赖当前调用者，可以让 `auth` 或 `headers` 写成函数。Eve 会在当前 turn 内调用它，并传入和 tool / hook 类似的 session context。

```ts title="agent/connections/warehouse.ts"
import { defineOpenAPIConnection } from "eve/connections";

export default defineOpenAPIConnection({
  spec: "https://warehouse.example.com/openapi.json",
  description: "The caller's tenant-scoped warehouse.",
  auth: (ctx) => ({
    principalType: "user",
    getToken: async () => ({
      token: await tenantToken(ctx.session.auth.current),
    }),
  }),
  headers: (ctx) => ({
    "X-Tenant-Id": tenantId(ctx.session.auth.current),
  }),
});
```

这种 resolver 只是补充 connection auth，不会替你完成入站请求鉴权。入站请求仍然应该在 channel / route auth 层完成用户识别。

## Connection 级审批

如果希望连接里的每个远端工具都经过人工确认，可以给 connection 配置 `approval`：

```ts title="agent/connections/linear.ts"
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description: "Linear workspace.",
  auth: { getToken: async () => ({ token: process.env.LINEAR_API_TOKEN! }) },
  approval: once(),
});
```

常见 helper：

- `never()`：不审批。
- `once()`：每个 session 第一次调用时审批。
- `always()`：每次调用都审批。

对会创建、修改、删除、发送、购买、访问敏感数据的远端工具，建议配置 approval、allow-list 或其它安全策略。

## 通过 Vercel Connect 做交互式 OAuth

如果远端服务使用 OAuth，并且你希望每个最终用户通过自己的浏览器授权，可以使用 [Vercel Connect](https://vercel.com/docs/connect)。

`@vercel/connect/eve` 提供的 `connect()` 会处理：

- 浏览器 consent 流程。
- 加密 token 存储。
- token refresh。
- Eve 的 authorization.required / resume 流程。

```ts title="agent/connections/linear.ts"
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description: "Linear workspace: issues, projects, cycles, and comments.",
  auth: connect("linear/myagent"),
});
```

`connect("linear/myagent")` 默认是 user-scoped。第一次调用时，如果当前用户还没有授权，Eve 会发出 `authorization.required` 事件，暂停 turn，等回调完成后继续。

如果远端服务应该作为 Agent 自己运行，而不是代表最终用户运行，可以改成 app-scoped：

```ts
auth: connect({ connector: "linear/myagent", principalType: "app" })
```

## 自托管 OAuth

如果你不使用 Vercel Connect，也可以用 `defineInteractiveAuthorization` 自己实现 OAuth。它通常包含三个步骤：

- `getToken`：每次调用前检查是否已有 token，没有就抛出需要授权的错误。
- `startAuthorization`：生成给用户访问的授权 URL，并让 turn 持久暂停。
- `completeAuthorization`：处理 OAuth 回调，交换 token，然后恢复 turn。

这种模式适合私有化、自托管或接入内部身份系统。

## 常见问题

| 现象 | 可能原因 | 处理方式 |
| --- | --- | --- |
| `principal_required` | user-scoped connection 没有当前用户身份。 | 让 channel route auth 返回用户身份，或改成 app-scoped。 |
| 有 `authorization.required` 但 UI 没反应 | 前端或 channel 没渲染授权挑战。 | 从 stream event 读取 challenge，并在回调后继续同一个 session。 |
| 本地 OAuth 可用，部署后失败 | 项目没有正确绑定 Connect client，或部署环境缺少 Vercel OIDC/project scope。 | 重新 link / attach / env pull 并部署。 |
| 远端拒绝请求 | URL、transport、auth scheme、headers 或 token 错误。 | 检查连接配置和远端日志。 |

## 安全建议

Connection 很容易把大面积外部能力暴露给模型。生产环境建议：

- 优先使用 allow-list 缩小远端工具范围。
- 对写入、删除、发送、支付、敏感读取等工具加 approval。
- 不要把凭据写进 prompt、instructions、skills 或工具输出。
- 按用户、租户、channel 做最小权限隔离。
- 让后端服务继续承担最终权限、审计和幂等控制。
