---
title: "eve HTTP Channel"
description: "Agent 的默认 HTTP API：session 路由、认证与定制。"
---

# eve HTTP Channel

eve channel 是框架默认的 HTTP API。终端 UI、[`useEveAgent`](../guides/frontend/overview)、`curl` 以及任何 SDK 客户端在启动 session、发送消息和流式监听事件时，都会与它通信。`eveChannel()` 把规范的 session 路由挂载到 `/eve/v1/session*` 下，即使 `agent/channels/eve.ts` 不存在也默认启用。

每个运行中的 eve 应用都暴露自己的 API。`eve.dev` 只发布框架文档；它不是一个共享 API、授权服务器、MCP server 或 A2A server。每个部署都提供自己的 host 和认证策略。

当你的 Agent 需要 HTTP 访问时就用它，包括本地工具、浏览器前端、终端 UI 或其它 API 客户端。大多数应用永远不会写这个文件。只有当需要覆盖默认配置（通常是路由认证策略）时才添加 `agent/channels/eve.ts`。

```ts title="agent/channels/eve.ts"
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [vercelOidc(), localDev()],
});
```

## 路由（Routes）

应用暴露一个健康检查路由加上一组 eve channel 路由，用于检查 Agent、创建 session、发送后续消息、控制 session 和流式监听事件：

- `GET /eve/v1/health`（检查应用是否可达）
- `GET /eve/v1/info`（检查 Agent）
- `POST /eve/v1/session`（启动 session 并发送首条消息）
- `POST /eve/v1/session/:sessionId`（发送后续消息）
- `POST /eve/v1/session/:sessionId/cancel`（取消进行中的 turn）
- `POST /eve/v1/session/:sessionId/clear`（清空 session 的模型历史）
- `POST /eve/v1/session/:sessionId/compact`（压缩 session 的上下文）
- `POST /eve/v1/session/:sessionId/reset`（终结该 session）
- `GET /eve/v1/session/:sessionId/stream`（以 NDJSON 流式监听事件）

Session 路由只使用 durable session ID。先显式创建 session，然后把返回的 ID 放进每个后续消息、控制与流式请求的路径里。

### 启动并继续 session（Start and continue a session）

```sh
curl -X POST https://<deployment>/eve/v1/session \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the weather in Paris?"}'
# {"ok":true,"sessionId":"wrun_A","status":"accepted"}

curl -X POST https://<deployment>/eve/v1/session/wrun_A \
  -H "Content-Type: application/json" \
  -d '{"message":"How about tomorrow?"}'
```

第一个请求必须带 `message`。后续请求只接受 `message` 或 `inputResponses` 之一；用后者回答挂起的 HITL 请求：

```sh
curl -X POST https://<deployment>/eve/v1/session/wrun_A \
  -H "Content-Type: application/json" \
  -d '{"inputResponses":[{"requestId":"req_A","optionId":"approve"}]}'
```

后续消息默认使用 `turnPolicy: "steer"`。如果 turn 正在进行，eve 会先缓冲消息，再协作式地取消该 turn，然后把后续消息作为带新 turn ID 的替代 turn 启动。当后续消息应该等待当前 turn 结束时，在 `eveChannel(...)` 上设置 `turnPolicy: "queue"`。`inputResponses` 永远不会 steer。

向未知或已终结的 session ID 发送消息会返回 `409` 与：

```json
{"code":"session_not_active","error":"The session is no longer active.","ok":false}
```

TypeScript 客户端会把稳定 code 暴露为 `ClientError.code`。该路由从不创建或跟随替代 session。

### 流式监听事件（Stream events）

流式响应是换行分隔的 JSON（`application/x-ndjson; charset=utf-8`），每行一个事件对象：

```sh
curl -N https://<deployment>/eve/v1/session/wrun_A/stream
# {"type":"turn.started",...}
# {"type":"message.appended","data":{"messageDelta":"It is ",...}}
# {"type":"message.completed",...}
```

### 取消 turn（Cancel a turn）

用空 body 取消 session 的进行中 turn，或通过传入该 turn 流式事件上盖的 `turnId` 把取消范围限定到指定 turn：

```sh
curl -X POST https://<deployment>/eve/v1/session/wrun_A/cancel
# {"ok":true,"sessionId":"wrun_A","status":"accepted"}
```

取消是异步的：`"accepted"` 表示活跃 session 已 durable 排队该请求。请在流上以 `turn.cancelled` 后跟 `session.waiting` 确认实际取消——绝不要把取消当作失败。活跃的本地和远程子智能体会在父级 settle 之前被递归取消。取消前已发出的内容仍保留在事件流上，而 durable 模型历史只保留已经 settle 的内容。session 之后正常接受下一条消息。

已接受的取消返回 HTTP `202` 与 `sessionId`。不活跃的目标返回 HTTP `200` 与 `{"ok":true,"status":"no_active_turn"}`。

活跃 session 在已经 park 时也返回 `"accepted"`；driver 会把这种迟到或重复的取消当作 no-op 消费。未知或已终结的 session 返回 `"no_active_turn"`。指向任何其他 turn 的 `turnId` 同样会被接受并作为 no-op 消费，因此与 turn 边界竞争的受保护取消，无法停止调用方从未见过的 turn。

### 清空上下文（Clear context）

不替换 session 的情况下清空某个 session 的模型消息历史：

```sh
curl -X POST https://<deployment>/eve/v1/session/wrun_A/clear
# {"ok":true,"sessionId":"wrun_A","status":"accepted"}
```

已接受的 clear 会发出 `context.cleared` 后跟 `session.waiting`。下一条消息使用同一个 session，但没有之前的模型消息；system prompt、tools、skills、durable state、limits 和 session-scoped sandbox 保持不变。

### 压缩上下文（Compact context）

不发送消息的情况下压缩某个 session 的上下文：

```sh
curl -X POST https://<deployment>/eve/v1/session/wrun_A/compact
# {"ok":true,"sessionId":"wrun_A","status":"accepted"}
```

压缩是异步的。成功的操作会发出 `compaction.requested` 和 `compaction.completed`，然后回到 `session.waiting`。当 turn 活跃时，压缩会等它 settle。如果摘要失败，session 仍带着之前的 history 回到 `session.waiting`。

### 重置 session（Reset a session）

Reset 终结性地退役指定的 session ID：

```sh
curl -X POST https://<deployment>/eve/v1/session/wrun_A/reset \
  -H "Content-Type: application/json" \
  -d '{"reason":"Start over"}'
# {"ok":true,"previousSessionId":"wrun_A","status":"reset"}
```

重置后，旧 ID 不能再接受消息。用 `POST /eve/v1/session` 显式启动替代 session。

控制路由从不创建 session。当 ID 已不活跃时，`compact`、`clear` 和 `reset` 返回 `"no_active_session"`。Session 消息与控制请求/响应体不接受也不返回 continuation token。为兼容起见，流式 `session.waiting` 事件保留了 `data.continuationToken`：对于 channel 地址化 session 它是 channel 本地 token，对于纯 ID session 它是不可变的 session ID。新客户端应通过固定的 session handle 继续，而不是读取该字段。

完整的 event 集合、操作结果和 cursor 行为见 [Sessions, runs & streaming](../concepts/sessions-runs-and-streaming)。

## CORS

eve channel 默认不碰 CORS。传 `cors: true` 可以启用带 preflight 处理的宽松浏览器 CORS，或传一个 options 对象来收窄 origins、methods 和 headers。路由认证仍会在实际的 session 请求上运行。

只有浏览器客户端直接调用该 channel 时才启用或收窄 CORS：

```ts title="agent/channels/eve.ts"
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [vercelOidc(), localDev()],
  cors: {
    origin: "https://app.example.com",
    methods: ["GET", "POST"],
    allowedHeaders: ["authorization", "content-type"],
  },
});
```

## 认证（Authentication）

`auth` 选项决定谁能调用 `/eve/v1/info` 和 session 路由。内置 helper 覆盖开发和可信基础设施：

- `localDev()` 在本地开发期间接受请求。
- `vercelOidc()` 让本地 CLI 能触达已部署的 Agent，也让团队里的其他内部部署可以调用它。

两者在生产环境都不接受浏览器用户或外部客户端。对公开应用，把 channel 接到你自己的认证（Clerk、Auth.js、你自己的 OIDC/JWT 校验、API-key 校验器，或任何自定义 `AuthFn`）。Vercel OIDC 是可选的；只在 Vercel 签发的部署 token 是你信任模型的一部分时才使用它。

`eve init` 会脚手架出一个带生产占位符的 `agent/channels/eve.ts`，让你在上线前替换它。生成的 channel 先校验 Vercel OIDC，再回退到 localhost 访问，并包含 `placeholderAuth()`——在你换成真实认证之前，它在生产环境返回 setup-focused 401。删除该文件后 eve 回退到 `[vercelOidc(), localDev(), placeholderAuth()]`，这会拒绝所有生产流量。

完整的认证模型和 helper 清单见 [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)。

## 定制（Customization）

用 `onMessage` 在 Agent 看到用户消息之前添加请求特定上下文，用 `events` 观察该 channel 创建的 session 的流式事件：

```ts title="agent/channels/eve.ts"
import { eveChannel, defaultEveAuth } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [vercelOidc(), localDev()],
  onMessage(ctx, message) {
    const callerId = ctx.eve.caller?.principalId ?? "anonymous";
    return {
      auth: defaultEveAuth(ctx),
      context: [`HTTP caller ${callerId} sent: ${message}`],
    };
  },
  events: {
    "message.completed"(eventData, _channel, ctx) {
      console.log("eve response completed", {
        sessionId: ctx.session.id,
      });
    },
  },
});
```

`onMessage` 必须返回一个 auth 结果。一条成功的规范 eve HTTP 消息总是会 dispatch，因此总是产生或继续一个 session。

## 客户端（Clients）

这个 API 的浏览器侧在 [前端（Frontend）](../guides/frontend/overview) 文档中，`useEveAgent` 从 React UI 驱动 eve channel。

对脚本、服务端到服务端调用、evals、测试和自定义客户端，使用 [TypeScript SDK](../guides/client/overview)。它封装了 ID 地址化的 session 路由、流式 cursor 和重连循环。

## 接下来读什么（What to read next）

- [前端（Frontend）](../guides/frontend/overview)：从浏览器 UI 用 `useEveAgent` 驱动 eve channel
- [TypeScript SDK](../guides/client/overview)：从 TypeScript 调用 eve channel
- [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)：路由认证策略
- [Sessions, runs & streaming](../concepts/sessions-runs-and-streaming)：该 channel 暴露的路由
