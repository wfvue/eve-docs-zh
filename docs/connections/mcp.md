---
title: "MCP 连接（MCP Connections）"
description: "把 Eve Agent 连接到远程 MCP Server，配置鉴权，并控制模型能发现哪些远程工具。"
---

# MCP 连接（MCP Connections）

MCP connection 会把 Eve 指向一个你没有直接编写的远程 MCP Server。远程服务器发布自己的 tools 和 schemas，Eve 再通过 `connection_search` 把匹配到的工具暴露给模型。

适合使用 MCP connection 的情况：

- 外部服务已经有 MCP Server。
- 远端服务自己维护工具 schema。
- 一个连接需要暴露一组相关远程工具。
- 远端能力不只是简单 HTTP operation，而是更适合用 MCP 语义表达。

如果服务只是发布了 HTTP API 契约，优先看 [OpenAPI connections](./openapi)。

## 定义一个 MCP connection

在 `agent/connections/` 下创建一个文件。文件名就是运行时连接名：

```txt
agent/connections/linear.ts
```

会注册为：

```txt
linear
```

远端工具会以这种形式暴露给模型：

```txt
linear__<tool>
```

示例：

```ts title="agent/connections/linear.ts"
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description: "Linear workspace: issues, projects, cycles, and comments.",
  auth: connect("mcp.linear.app/linear"),
});
```

`url` 必须支持 Streamable HTTP 或 SSE。`description` 是给模型看的，不是写给开发者自己的注释；它是 `connection_search` 判断是否查询这个连接的重要信号。

## 使用 Vercel Connect 做 OAuth

对于 OAuth 支撑的 MCP Server，官方推荐使用 Vercel Connect。Connect 会处理：

- 浏览器授权流程。
- 加密 token 存储。
- refresh。
- project access。
- Eve 的 authorization / resume 流程。

在运行 connection 的 Vercel 项目或 agent app 中：

```bash
npm install @vercel/connect
vercel link
vercel connect create mcp.linear.app --name linear
vercel connect attach <connector-uid> --yes
vercel env pull
```

然后在代码里使用 CLI 返回的 connector UID：

```ts
auth: connect("mcp.linear.app/linear")
```

默认情况下，`connect("...")` 是 user-scoped。第一次工具调用时，如果用户没有授权，Eve 会发出 `authorization.required` 事件，暂停当前 turn，等 OAuth 回调完成后继续。

前提是当前 session 已经有用户身份。如果没有用户身份，会失败并返回类似：

```txt
principal_required
```

如果 MCP Server 应该代表 Agent 自己运行，而不是代表用户运行，可以使用 app-scoped：

```ts title="agent/connections/linear.ts"
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description: "Linear workspace: issues, projects, cycles, and comments.",
  auth: connect({ connector: "mcp.linear.app/linear", principalType: "app" }),
});
```

App-scoped Connect auth 不会触发浏览器授权。Eve 会向 Connect 请求一个共享 app token。如果 connector 没有安装或无法签发 app token，调用会失败，需要运维或开发者修复连接配置。

## 静态 token 和 headers

如果你已经有 bearer token、API key、service account token 或自己实现的 OAuth 流程，可以用 `auth.getToken`：

```ts title="agent/connections/linear.ts"
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description: "Linear workspace: issues, projects, cycles, and comments.",
  auth: {
    getToken: async () => ({ token: process.env.LINEAR_API_TOKEN! }),
  },
});
```

Eve 会把返回的 token 作为：

```txt
Authorization: Bearer <token>
```

发送给远端服务。

如果远端需要非 Bearer 认证或额外 header，可以使用 `headers`：

```ts title="agent/connections/private-docs.ts"
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://docs.example.com/mcp",
  description: "Internal docs: search pages, owners, and recent changes.",
  headers: {
    "X-Api-Key": process.env.DOCS_API_KEY!,
  },
});
```

`auth` 和 `headers` 也可以写成函数，接收当前 session context。适合凭据、租户或路由依赖当前调用者的场景。

## 无鉴权连接

只有在服务本身明确公开、本地开发，或已经被其它安全层保护时，才应该省略 `auth` 和 `headers`：

```ts title="agent/connections/local.ts"
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "http://localhost:3001/mcp",
  description: "Local dev MCP server.",
});
```

不要把无鉴权连接用于敏感第三方服务。

## 过滤远端工具

MCP Server 可能暴露很宽的读写能力。建议用 `tools.allow` 或 `tools.block` 限制模型能发现的工具。

二者只能选一个。

```ts title="agent/connections/linear.ts"
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description: "Linear: read issue and project data.",
  auth: connect("mcp.linear.app/linear"),
  tools: { allow: ["search_issues", "get_issue"] },
});
```

生产环境更推荐 `allow`，也就是最小可用工具面。特别是远端服务同时暴露写入、删除、发布能力时，不要让模型看到全部工具。

## 连接级审批

当 MCP 工具会创建、修改、删除、发送消息、传输数据、购买或访问敏感数据时，应该加审批：

```ts title="agent/connections/linear.ts"
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description: "Linear workspace.",
  auth: connect("mcp.linear.app/linear"),
  approval: once(),
});
```

- `once()`：每个 session 第一次调用时审批。
- `always()`：每次调用都审批。
- `never()`：不审批。

OAuth 和 approval 可以叠加：Eve 会先记录审批，再进入 OAuth 暂停流程，恢复后不会对同一个已批准调用重复询问。

## 按工具名或输入做审批

远端 MCP Server 可能同时包含安全的读取工具和危险的写入工具。给整个 connection 配 `always()` 会让无害读取也频繁弹审批。此时可以写自定义 approval policy。

```ts title="agent/connections/social.ts"
import { defineMcpClientConnection } from "eve/connections";

const DELETE_TOOLS = ["delete_draft", "delete_thread"];
const PUBLISH_TOOLS = ["create_draft", "edit_draft"];

const publishesNow = (input: unknown): boolean => {
  const body = (input as { requestBody?: { publish_at?: unknown } })?.requestBody;
  return typeof body?.publish_at === "string" && body.publish_at.length > 0;
};

export default defineMcpClientConnection({
  url: "https://mcp.example.com/mcp",
  description: "Social publishing: draft, schedule, and manage posts.",
  auth: { getToken: async () => ({ token: process.env.SOCIAL_API_KEY! }) },
  approval: ({ toolName, toolInput }) => {
    if (DELETE_TOOLS.some((t) => toolName.includes(t))) return "user-approval";
    if (PUBLISH_TOOLS.some((t) => toolName.includes(t))) {
      return publishesNow(toolInput) ? "user-approval" : "not-applicable";
    }
    return "not-applicable";
  },
});
```

注意两点：

- `toolName` 是限定名，例如 `social__delete_draft`，不是远端裸工具名。匹配时可以用 `.includes()` 或 `.endsWith()`。
- `toolInput` 是模型生成的原始输入，类型和 shape 都不能完全信任，读取嵌套字段要防御式处理。

返回 `"user-approval"` 会暂停等待人工确认；返回 `"not-applicable"` 会直接执行；也可以返回 `"approved"` 或 `"denied"` 自动决策。

## 常见问题

| 现象 | 检查点 |
| --- | --- |
| `principal_required` | user-scoped `connect("...")` 在没有已认证用户的 session 中运行。应在 route auth 中返回 user，或改成 app-scoped。 |
| 模型找不到远端工具 | 改进 connection `description`，并检查 `tools.allow` / `tools.block`。 |
| OAuth 本地可用，部署后失败 | 确认 Connect connector 已 attach 到部署项目，并检查 `connect("...")` 中的 UID。 |
| 远端拒绝请求 | 检查 MCP URL、transport、auth scheme、headers 和 token。 |

## 接下来读什么

- [连接概览](./overview)：共享鉴权、headers、approval 和按调用者解析的模式。
- [OpenAPI connections](./openapi)：从 OpenAPI operation 生成工具。
- [鉴权与路由保护](../guides/auth-and-route-protection)：route auth 与交互式 OAuth 生命周期。
- [安全模型](../concepts/security-model)：connection 凭据如何避免暴露给模型。
