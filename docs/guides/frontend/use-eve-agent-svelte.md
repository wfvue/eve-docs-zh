---
title: "useEveAgent（Svelte）"
description: "用于从浏览器驱动 Eve Agent session 的 Svelte binding。"
---

# useEveAgent（Svelte）

`eve/svelte` 中的 `useEveAgent()` 是 Svelte 应用和 Eve session 通信的入口。它会打开 durable session、发送 turns，并把 stream events 折叠成组件可使用的 reactive state。

## 基础用法（Basic usage）

```svelte
<script lang="ts">
  import { useEveAgent } from "eve/svelte";

  const agent = useEveAgent();
</script>

{#each agent.data.messages as message}
  <article>
    <header>{message.role}</header>
    <pre>{JSON.stringify(message.parts, null, 2)}</pre>
  </article>
{/each}
```

## 返回内容（What it returns）

- `data`：投影后的 UI state。
- `status`：`ready`、`submitted`、`streaming` 或 `error`。
- `error`：最近错误。
- `events`：当前 session 的原始 events。
- `session`：当前 session cursor。
- `send`：发送文本或完整 turn。
- `stop`：中止当前请求。
- `reset`：清空状态并开始新 session。

## 发送消息（Send a message）

```svelte
<script lang="ts">
  import { useEveAgent } from "eve/svelte";

  const agent = useEveAgent();
  let message = $state("");
  let isBusy = $derived(agent.status === "submitted" || agent.status === "streaming");

  async function handleSubmit() {
    const text = message.trim();
    if (!text || isBusy) return;
    message = "";
    await agent.send({ message: text });
  }
</script>
```

## 停止、重置和恢复（Stop, reset, and resume）

`stop()` 会中止 in-flight stream。`reset()` 会清空本地状态并开始 fresh session。要在 reload 后恢复，请保存 `session` cursor 和 events，然后作为 `initialSession`、`initialEvents` 传回。

## 自定义 host 和 headers（Custom host and headers）

当 Eve server 不在 same origin 时，用 `host` 指向它；当 channel 需要额外凭据或租户信息时，通过 `auth` 或 `headers` 传入。

## 页面上下文（Page context）

`clientContext` 可以给下一次 model call 附加临时页面上下文。它跟随 message 或 input response 一起发送，不会单独创建 turn，也不会进入 durable session history。

## 生命周期回调（Lifecycle callbacks）

常用 callbacks 包括 `onEvent`、`onError`、`onFinish` 和 `onSessionChange`。常用行为选项包括 `optimistic` 和 `maxReconnectAttempts`。

## 自定义 reducer（Custom reducer）

默认 reducer 会把 events 投影成 `{ messages }`。需要其它数据结构时，可以传自定义 reducer。

## 接下来读什么（What to read next）

- [前端概览（Frontend overview）](../overview)
- [SvelteKit](../sveltekit)
- [TypeScript SDK](../../client/overview)
