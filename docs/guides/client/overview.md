---
title: "TypeScript SDK 概览（TypeScript SDK Overview）"
description: "使用 Client、sessions、auth 和 health checks 从 TypeScript 调用 Eve Agent。"
---

# TypeScript SDK 概览（TypeScript SDK Overview）

`eve/client` entrypoint 是 Eve 默认 HTTP API 的 typed client。它适合脚本、server-to-server integrations、tests、evals、backend jobs，或想使用 session protocol 但不想手写 POST 和 NDJSON stream loop 的 custom UIs。

浏览器聊天 UI 优先看 [`useEveAgent`](../../frontend/overview)。Wire-level 细节见 [Sessions, runs & streaming](../../../concepts/sessions-runs-and-streaming)。Client 位于二者之间：比 frontend hooks 更底层，但比原始 HTTP 更高层。

## 创建 client（Create a client）

一个 `Client` 会绑定 host、auth policy、header policy 和 stream reconnection budget：

```ts
import { Client } from "eve/client";

const client = new Client({
  host: "http://127.0.0.1:3000",
});
```

`host` 是 Eve routes 挂载的 origin。在 same-origin browser integration 中通常是 `""`；脚本和 backend services 通常传完整 URL。

## 检查 health（Check health）

脚本需要在创建 session 前快速失败时，使用 `health()`：

```ts
const health = await client.health();
console.log(health.status, health.workflowId);
```

非 2xx 响应会抛 `ClientError`，其中包含 HTTP `status` 和 response `body`。

## Inspect Agent（Inspect an agent）

使用 `info()` 检查 development agent。Client 会在返回前解析并验证完整 response：

```ts
const info = await client.info();
console.log(info.agent.name, info.agent.model.id);
```

## 鉴权（Authentication）

当 [Eve channel](../../../channels/eve) route 需要凭据时，传入 `auth`：

```ts
const client = new Client({
  host: "https://agent.example.com",
  auth: {
    bearer: async () => await getAccessToken(),
  },
});
```

Bearer values 和 Basic auth values 可以是字符串，也可以是函数。函数会在每次 HTTP call 前运行，包括 stream reconnects。

Vercel OIDC-protected deployment 可以使用 `vercelOidc`。Client 会每次请求解析 token，并把它同时作为 bearer credential 和 Vercel trusted-OIDC header 发送：

```ts
import { getVercelOidcToken } from "@vercel/oidc";

const client = new Client({
  host: "https://agent.example.com",
  auth: {
    vercelOidc: {
      token: async () => await getVercelOidcToken(),
    },
  },
});
```

使用 `headers` 传 route-specific credentials，例如 bypass tokens 或 tenant hints。和 `auth` 一样，它可以是静态或动态：

```ts
const client = new Client({
  host: "https://agent.example.com",
  headers: async () => ({
    "x-vercel-protection-bypass": await getBypassToken(),
  }),
  redirect: "manual",
});
```

携带 credentials 的 clients 建议设置 `redirect` 为 `"manual"` 或 `"error"`，避免 fetch 把自定义 authorization headers 转发到其它 origin。该策略会应用到 inspection requests、custom fetches、session creation 和 event streams。

单个 turn 也可以附加 per-request headers：

```ts
const response = await session.send({
  message: "Run the check.",
  headers: { "x-request-id": requestId },
});

await response.result();
```

## Sessions（Sessions）

每段对话创建一个 `ClientSession`：

```ts
const session = client.session();
```

一个 client 可以同时拥有多个 sessions。每个 session 追踪自己的 `sessionId`、`continuationToken` 和 stream cursor：

```ts
const alice = client.session();
const bob = client.session();

const aliceResponse = await alice.send("Summarize account A.");
await aliceResponse.result();

const bobResponse = await bob.send("Summarize account B.");
await bobResponse.result();
```

接下来的页面会覆盖 session lifecycle：

- [消息（Messages）](../messages)：发送 turns 并收集结果
- [续接（Continuations）](../continuations)：持久化并恢复 sessions
- [流式输出（Streaming）](../streaming)：实时渲染 events
- [输出 Schema（Output schema）](../output-schema)：请求结构化结果

## 接下来读什么（What to read next）

- [Eve channel](../../../channels/eve)：这个 client 调用的 HTTP API
- [Sessions, runs & streaming](../../../concepts/sessions-runs-and-streaming)：原始 HTTP contract
- [前端（Frontend）](../../frontend/overview)：使用 `useEveAgent` 构建浏览器 UI
