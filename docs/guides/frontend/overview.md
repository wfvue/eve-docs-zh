---
title: "前端概览（Overview）"
description: "使用 useEveAgent 把 Eve Agent 接到浏览器聊天 UI 或 Agent UI。"
---

# 前端概览（Overview）

Frontend helpers 会把浏览器 chat UI 或 Agent UI 放在 Eve Agent 之上。`useEveAgent()` 会打开 durable session、发送 turns、流式接收回复，并把原始 event stream 转成可直接渲染的状态。React 是参考实现；[Vue](../use-eve-agent-vue) 和 [Svelte](../use-eve-agent-svelte) 提供相同 surface。

## 集成模型（The integration model）

浏览器 UI 是 Agent HTTP routes 的 client，也就是 [Eve channel](../../../channels/overview) 的 client。集成分两层：

- **Framework integration** 把 Eve routes 挂到你应用的同源 origin 上，因此浏览器不需要跨 CORS 边界，也不需要读环境变量来找 Agent。可选框架包括 [Next.js](../nextjs)（`withEve`）、[Nuxt](../nuxt)（`eve/nuxt` module）和 [SvelteKit](../sveltekit)（`eveSvelteKit` Vite plugin）。其它 stack 可以让 hook 直接访问 same-origin `/eve/v1/*` routes，或显式传 `host`。
- **Hook**（`useEveAgent`）保存 session state、streaming、errors 和 composer status。默认访问 same-origin Eve routes，例如 `/eve/v1/session`。

逐框架配置见 [Next.js](../nextjs)、[Nuxt](../nuxt) 和 [SvelteKit](../sveltekit)。脚本、server-to-server integrations、evals、tests 或不需要 framework UI state 的 custom clients，应直接使用 [TypeScript SDK](../../client/overview)。

## 基础聊天：React（Basic chat: React）

Hook 位于 `eve/react`。渲染 `data.messages`，用 `status` 控制 composer，用 `send` 发送文本：

```tsx
"use client";

import { useEveAgent } from "eve/react";

export function Chat() {
  const agent = useEveAgent();
  const isBusy = agent.status === "submitted" || agent.status === "streaming";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const message = String(form.get("message") ?? "").trim();
        if (message.length > 0) {
          void agent.send({ message });
        }
      }}
    >
      {agent.data.messages.map((message) => (
        <article key={message.id}>
          <header>{message.role}</header>
          {message.parts.map((part, index) =>
            part.type === "text" ? <p key={index}>{part.text}</p> : null,
          )}
        </article>
      ))}
      <input name="message" disabled={isBusy} />
      <button disabled={isBusy} type="submit">Send</button>
    </form>
  );
}
```

## 返回状态（Returned state）

`useEveAgent()` 返回当前 UI 状态和命令：

| Field | What it is |
| --- | --- |
| `data` | reducer 投影出的 UI state。默认是 `{ messages }`。 |
| `status` | `"ready"`、`"submitted"`、`"streaming"` 或 `"error"`，用于驱动 composer。 |
| `error` | 最近一次抛出的 `Error`。 |
| `events` | 当前 session 的原始 Eve stream events。 |
| `session` | 可序列化 session cursor：`sessionId`、`continuationToken`、`streamIndex`。 |
| `send` | 发送文本或完整 turn payload，例如 multi-part messages、HITL responses。 |
| `stop` | 中止当前请求。 |
| `reset` | 清空本地 events、data、errors 和 local session cursor。 |

大多数聊天 UI 只需要 `data.messages` 和 `status`。当你需要权威 wire events，例如持久化审计日志或构建自定义 projection 时，再使用 `events`。

`data.messages` 是遵循 AI SDK `UIMessage` 约定的 `EveMessage[]`，因此可以直接交给接受 `UIMessage[]` 的 AI SDK UI primitives。Parts 包含用户文本、assistant 文本、reasoning、tool calls、tool results、input requests 和 connection authorization prompts。

## 发送与流式输出（Sending and streaming）

给 `send()` 传对象，支持 text、multi-part messages、attachments、HITL responses 和 per-turn context：

```tsx
await agent.send({ message: "Summarize this session." });

await agent.send({
  message: [
    { type: "text", text: "What is in this file?" },
    {
      type: "file",
      data: fileDataUrl,
      mediaType: "application/pdf",
      filename: "report.pdf",
    },
  ],
});
```

Assistant text、reasoning、tool calls 和 tool results 会随着到达流入 `data`，`status` 会从 `ready` 到 `submitted`、`streaming`，再回到 ready。调用 `stop()` 可以中止当前请求，`reset()` 可以清空本地状态，让下一次发送从一个新的 durable session 开始。

## Human-in-the-loop prompts（Human-in-the-loop prompts）

Tools 可以通过 `approval` opt in 审批，模型也可以用 `ask_question` 发问。服务端模型见 [Human-in-the-loop](../../../tools/human-in-the-loop)。两种情况都会在 stream 中发出 `input.requested` event。Pending request 会挂在最新 message 的 `dynamic-tool` part 上，位置是 `part.toolMetadata?.eve?.inputRequest`。读取它后，通过同一个 session 用 `send()` 回答：

```tsx
const request = agent.data.messages
  .at(-1)
  ?.parts.find((part) => part.type === "dynamic-tool" && part.toolMetadata?.eve?.inputRequest)
  ?.toolMetadata?.eve?.inputRequest;

if (request) {
  await agent.send({
    inputResponses: [{ requestId: request.requestId, optionId: "approve" }],
  });
}
```

`request.prompt` 和 `request.options` 足够渲染 approve / deny UI。默认 reducer 会先把 part 标记为已响应，然后在 Eve stream 恢复结果后再次更新。

## 授权提示（Authorization prompts）

Connections 和 tools 需要 OAuth 或其它 grant 时，会发出 `authorization.required`。默认 reducer 会把它投影成 `authorization` message part，里面有 display name、instructions、device code 和面向用户的 sign-in URL。把它作为普通 chat message 渲染，并保留 session cursor；callback 完成后，Eve 会恢复 parked turn，并在 `authorization.completed` 后更新该 part。

自定义状态机仍然可以直接使用 `events` 和 `onEvent` 中的 `authorization.required` / `authorization.completed`。

## 每个 turn 附加页面上下文（Attach page context per turn）

`clientContext` 会给下一次 model call 添加临时上下文。字符串或字符串数组会变成 user-role context messages；对象会被 JSON 序列化成一条 context message。它会跟随 message 或 HITL response 一起发送，不会单独 dispatch turn，也不会进入 durable session history：

```tsx
await agent.send({
  message: "What should I do on this screen?",
  clientContext: { route: "/billing", plan: "pro", seatsUsed: 4 },
});
```

如果要每个 turn 都附加同样上下文，而不想每个调用点都传，可以使用 `prepareSend`。它会在每次 send 前运行，并返回可能被增强的 turn：

```tsx
const agent = useEveAgent({
  prepareSend: (input) => ({
    ...input,
    clientContext: { route: location.pathname },
  }),
});
```

## 生命周期回调（Lifecycle callbacks）

除了 `onSessionChange`，hook 还接受几个 per-turn callbacks：

- `onEvent(event)`：每个 Eve stream event 到达时触发。
- `onError(error)`：turn 失败时带着最近的 `Error` 触发。
- `onFinish(snapshot)`：turn settle 后用最终 `{ data, status, session, ... }` snapshot 触发。

```tsx
const agent = useEveAgent({
  onEvent: (event) => console.debug(event.type),
  onError: (error) => toast.error(error.message),
  onFinish: (snapshot) => console.log(snapshot.status),
});
```

另外两个选项用于调整 turn 行为：

- `optimistic`：默认 `true`，会在 Eve 通过 `message.received` 确认之前，先把提交的 user message 投影进 `data`。这些只是 reducer-facing projection events；`events` 仍然是权威 Eve stream。
- `maxReconnectAttempts`：默认 `3`，每个 turn 的 stream reconnect 预算。

## 自定义 reducer（Custom reducer）

默认 reducer 会把 events 投影成 `{ messages }`（`EveMessageData`）。需要其它 `data` 形状时，传入实现 `EveAgentReducer<TData>` 的 `reducer`：

```tsx
import { useEveAgent } from "eve/react";
import type { EveAgentReducer } from "eve/react";

interface ToolLog {
  readonly toolCalls: number;
}

const toolCounter: EveAgentReducer<ToolLog> = {
  initial: () => ({ toolCalls: 0 }),
  reduce: (data, event) =>
    event.type === "actions.requested" ? { toolCalls: data.toolCalls + 1 } : data,
};

const agent = useEveAgent({ reducer: toolCounter });
```

`reduce(data, event)` 会收到权威 Eve stream events，也会收到 client projection events，例如 `client.message.submitted`、`client.message.failed`、`client.input.responded`。如果需要 optimistic 和 HITL 状态，也要处理这些 client events；否则原样返回 `data` 即可。

## 可恢复 sessions（Resumable sessions）

浏览器对话在服务端是 durable 的。为了 reload 后恢复，需要持久化已渲染 event log 和 `session` cursor：

```tsx
import type { HandleMessageStreamEvent, SessionState } from "eve/client";

type SavedEveChat = {
  events?: readonly HandleMessageStreamEvent[];
  session?: SessionState;
};
```

需要保存完整 `session` object，也就是 `sessionId`、`continuationToken`、`streamIndex`，而不是单个字段。Session cursor 让 Eve 继续 durable conversation；event log 让 UI 不必 replay 整个 stream 就能渲染历史消息。数据库型 chat app 通常应在 `onEvent` 中持久化 stream events，并在 `onFinish` 中保存最终 snapshot。

多个 chat threads 应为每个 thread 保存一份 event log 和 session cursor。`host`、`reducer`、`session`、`initialEvents`、`initialSession`、`auth`、`headers`、`maxReconnectAttempts` 和 `optimistic` 都会在 hook 创建 store 时读取，因此切换 thread 时建议 remount chat component，例如 `key={chat.id}`。

## 自定义 host 和 headers（Custom hosts and headers）

当 Eve server 不同源时传 `host`；当 channel 需要凭据时传 `auth` 或 `headers`。Function values 会在每次 HTTP request 前重新解析，包括 reconnects：

```tsx
const agent = useEveAgent({
  host: "https://agent.example.com",
  auth: {
    bearer: async () => await getAccessToken(),
  },
});
```

## 分框架集成（Per-framework integration）

| Framework | Integration | Hook |
| --- | --- | --- |
| Next.js | [`withEve`](../nextjs) | [`useEveAgent`（React）](#基础聊天reactbasic-chat-react) |
| Nuxt | [`eve/nuxt` module](../nuxt) | [`useEveAgent`（Vue）](../use-eve-agent-vue) |
| SvelteKit | [`eveSvelteKit` plugin](../sveltekit) | [`useEveAgent`（Svelte）](../use-eve-agent-svelte) |
| Any React | same-origin 或 `host` | [`useEveAgent`（React）](#基础聊天reactbasic-chat-react) |

## 接下来读什么（What to read next）

- [Sessions, runs & streaming](../../../concepts/sessions-runs-and-streaming)：event stream 和 session cursor
- [Channels](../../../channels/overview)：hook 访问的 HTTP routes
- [TypeScript SDK](../../client/overview)：frontend hooks 下面的 lower-level client
- [Next.js](../nextjs)：把 Eve 接入 Next.js app 的逐步配置
