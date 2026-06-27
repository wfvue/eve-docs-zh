---
title: "useEveAgent（Vue）"
description: "用于从浏览器驱动 Eve Agent session 的 Vue composable。"
---

# useEveAgent（Vue）

`eve/vue` 中的 `useEveAgent()` 是 Vue 应用和 Eve session 通信的入口。它会打开一个 long-lived session、发送 turns，并把每个 stream event 折叠成可以绑定到模板的 reactive data。Nuxt 会通过 [module](../nuxt) 自动导入它，[前端概览（Frontend overview）](../overview) 说明了共享模型。

## 基础用法（Basic usage）

从 `eve/vue` 导入 composable。它的状态以 `ComputedRef` 暴露，因此在模板中会自动 unwrapped：

```vue
<script setup lang="ts">
import { useEveAgent } from "eve/vue";

const { data } = useEveAgent();
</script>

<template>
  <div v-for="message in data.messages" :key="message.id">
    <p>{{ message.role }}: {{ message.parts }}</p>
  </div>
</template>
```

## 返回内容（What it returns）

| Property | Type | Description |
| --- | --- | --- |
| `data` | `ComputedRef<TData>` | 投影后的状态。默认 reducer 下是 `EveMessageData`，也就是 `messages`。 |
| `status` | `ComputedRef<UseEveAgentStatus>` | `"ready"`、`"submitted"`、`"streaming"` 或 `"error"`。 |
| `error` | `ComputedRef<Error \| undefined>` | 最近的 transport-level error。 |
| `events` | `ComputedRef<readonly HandleMessageStreamEvent[]>` | 当前 session 的原始 server events。 |
| `session` | `ComputedRef<SessionState>` | 当前 session state snapshot。 |
| `send` | `(input: SendTurnPayload) => Promise<void>` | 发送文本或完整 turn，例如 multipart、附件、HITL responses。 |
| `stop` | `() => void` | 中止 in-flight request。 |
| `reset` | `() => void` | 清空状态并开始新 session。 |

前五个是 `ComputedRef`，后面是方法。可以按需 destructure，refs 会在 destructuring 后保持响应性。在 `<script>` 中通过 `.value` 读取，在 `<template>` 中直接读取。

## 发送消息（Send a message）

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useEveAgent } from "eve/vue";

const { send } = useEveAgent();
const message = ref("");

async function handleSubmit() {
  const text = message.value.trim();
  if (!text) return;
  message.value = "";
  await send({ message: text });
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="message" placeholder="Type a message..." />
    <button type="submit">Send</button>
  </form>
</template>
```

纯文本之外的内容也通过 `send()` 发送。附件遵循 AI SDK `UserContent` 格式。文件数据要作为 base64 `data:` URL 发送，这样才能通过 JSON transport。

## Human-in-the-loop prompts（Human-in-the-loop prompts）

工具可以通过 `approval` opt in 审批，见 [工具（Tools）](../../../tools)。触发后，pending request 会作为最新 message 上的 `dynamic-tool` part 出现，位置是 `part.toolMetadata?.eve?.inputRequest`。读取它后，用同一个 session 发送 `send({ inputResponses })` 回答：

```ts
import type { EveDynamicToolPart, EveMessagePart } from "eve/vue";

const { data, send } = useEveAgent();

const isDynamicToolPart = (part: EveMessagePart): part is EveDynamicToolPart =>
  part.type === "dynamic-tool";

const request = data.value.messages
  .at(-1)
  ?.parts.filter(isDynamicToolPart)
  .map((part) => part.toolMetadata?.eve?.inputRequest)
  .find((value) => value !== undefined);

if (request) {
  await send({
    inputResponses: [{ requestId: request.requestId, optionId: "approve" }],
  });
}
```

查找并回答 pending request 的流程在各框架中一致。更长示例见 [前端概览（Frontend overview）](../overview)。

## 停止、重置和恢复（Stop, reset, and resume）

`stop()` 会中止 in-flight stream。`reset()` 会清空状态并开始 fresh session。要在 reload 后恢复，可以传 `initialSession` 和 `initialEvents`，并用 `onSessionChange` 持久化 cursor：

```ts
const agent = useEveAgent({
  initialSession: savedSessionState,
  initialEvents: savedEvents,
  onSessionChange: (session) => {
    localStorage.setItem("eve-session", JSON.stringify(session));
  },
});
```

## 自定义 host 和 credentials（Custom host and credentials）

当 Eve server 不在 same origin 时，用 `host` 指向它，并通过 `auth` 或 `headers` 附加凭据。传函数时，它会在每次请求前重新解析：

```ts
const agent = useEveAgent({
  host: "https://agent.example.com",
  headers: async () => ({
    authorization: `Bearer ${await getAccessToken()}`,
  }),
});
```

## 每个 turn 附加页面上下文（Attach page context per turn）

`clientContext` 会给下一次 model call 添加 ephemeral context。字符串或字符串数组变成 user-role context messages；对象会 JSON 序列化成一条 context message。它会跟随 message 或 HITL response 一起发送，不会单独 dispatch turn，也不会进入 durable session history：

```ts
await send({
  message: "What should I do on this screen?",
  clientContext: { route: "/billing", plan: "pro", seatsUsed: 4 },
});
```

要给每个 turn 都附加同样上下文，可以传 `prepareSend`。它会在每次 send 前运行，并返回可能增强后的 turn：

```ts
const agent = useEveAgent({
  prepareSend: (input) => ({
    ...input,
    clientContext: { route: location.pathname },
  }),
});
```

## 生命周期回调（Lifecycle callbacks）

Composable 接受几个 per-turn callbacks：

- `onEvent(event)`：每个 Eve stream event 到达时触发。
- `onError(error)`：turn 失败时携带最近的 `Error` 触发。
- `onFinish(snapshot)`：turn settle 后携带最终 snapshot 触发。
- `onSessionChange(session)`：session cursor 推进时触发，可用于持久化并支持 reload 恢复。

```ts
const agent = useEveAgent({
  onEvent: (event) => console.debug(event.type),
  onError: (error) => console.error(error.message),
  onFinish: (snapshot) => console.log(snapshot.status),
});
```

还有两个常用选项：

- `optimistic`：默认 `true`，会在 Eve 用 `message.received` 确认前先把 user message 投影到 `data`。这些只是 reducer-facing projection events；`events` 仍然是权威 stream。
- `maxReconnectAttempts`：默认 `3`，表示每个 turn 的 stream reconnect 预算。

## 自定义 reducer（Custom reducer）

默认 reducer 会把 events 投影成 `{ messages }`（`EveMessageData`）。要自定义 `data` 形状，可以传实现 `EveAgentReducer<TData>` 的 reducer。`reduce(data, event)` 会收到权威 Eve events 和 client projection events，例如 `client.message.submitted`、`client.message.failed`、`client.input.responded`。

## 接下来读什么（What to read next）

- [前端概览（Frontend overview）](../overview)
- [Nuxt](../nuxt)
- [TypeScript SDK](../../client/overview)
