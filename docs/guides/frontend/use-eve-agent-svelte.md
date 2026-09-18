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
- `send` / `respond` / `prewarm` / `resume` / `cancel` / `reset`：会话命令。

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

传 `prewarm: true` 可在 mount 与 reset 后准备 owned workflow（默认 `false`，第一次 send 才创建）。binding 会等 create acceptance、在 inbox 启动期间重试，并跨 turns 保持 session stream 打开。创建 / 失败 / 连接行为见 [前端概览 · Prewarm](./overview#prewarm-与持续流式)。

`cancel()` 会停止服务端 durable turn，binding 仍挂接到 settle。销毁组件只断开本地 stream，不会取消服务端执行。`reset()` 清空本地状态并开始新 session。传 `initialSession`、`initialEvents` 和 `resume: true` 可恢复已保存对话。详见 [前端概览](./overview)。

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
