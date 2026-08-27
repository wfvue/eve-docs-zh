---
title: "Chat SDK"
description: "用一个 channel 把任意 Vercel Chat SDK adapter 接到 Agent，使用你自己的凭据和 state store。"
---

# Chat SDK

Chat SDK channel 把 Agent 接到任意 [Vercel Chat SDK](https://chat-sdk.dev) adapter。你挑选 adapter（`@chat-adapter/slack`、`@resend/chat-sdk-adapter` 等），为关心的消息注册 handlers，再调用 `send` 把每个 turn 交给 eve。用它到达 eve 没有一等渠道的表面，或想用 Chat SDK 自己的凭据和 state 原语，而不是 [Vercel Connect](../guides/auth-and-route-protection)。契约见 [渠道（Channels）](./overview)。

你提供 adapter 和 state store：adapter 拥有提供商认证、webhook 校验和投递；eve 拥有 session dispatch、streaming、typing 和 human-in-the-loop。像 [Slack](./slack) 这样的一等渠道使用自己的 channel APIs，并可通过 Vercel Connect 或你直接配置的环境变量管理凭据。

官方原文：[Chat SDK](https://eve.dev/docs/channels/chat-sdk)。

## 安装

加上 eve、Chat SDK core（`chat`）、一个 adapter 和一个 state adapter。下面用 Resend email adapter 加 in-memory state store：

```bash
npm install eve@latest chat @resend/chat-sdk-adapter @chat-adapter/state-memory
```

换成匹配你表面的 adapter，例如 `@chat-adapter/slack`、`@chat-adapter/discord`、`@chat-adapter/telegram`。任何 Chat SDK adapter 都可以。

## 添加渠道

`chatSdkChannel` 返回 `{ bot, channel, send }`。在 `bot` 上注册 Chat SDK handlers，从这些 handlers 调用 `send` 启动或恢复 eve session，并把 `channel` 作为模块默认导出：

```ts title="agent/channels/resend.ts"
import { createMemoryState } from "@chat-adapter/state-memory";
import { createResendAdapter } from "@resend/chat-sdk-adapter";
import type { Message, Thread } from "chat";
import { chatSdkChannel } from "eve/channels/chat-sdk";

export const { bot, channel, send } = chatSdkChannel({
  userName: "Resend Bot",
  adapters: {
    resend: createResendAdapter({
      fromAddress: "hello@example.com",
      fromName: "Resend Bot",
    }),
  },
  state: createMemoryState(),
  streaming: false,
});

bot.onNewMention(async (thread: Thread, message: Message) => {
  await thread.subscribe();
  await send(message.text, { thread });
});

bot.onSubscribedMessage(async (thread: Thread, message: Message) => {
  await send(message.text, { thread });
});

export default channel;
```

`adapters` 是 adapter 名到实例的 map；每个条目挂自己的 webhook。`state` 接受任意 Chat SDK state adapter：`createMemoryState()` 适合本地开发，生产请用 durable adapter（Redis、Upstash 等），这样 thread subscriptions 和入站去重能撑过重启。`send` 接受普通字符串、AI SDK `UserContent` 数组或 `SendPayload`，且必须从正在运行的 Chat SDK handler 内部调用——它在当前 webhook 上 dispatch turn。

渠道文件就位后部署：

```bash
eve deploy
```

## 配置 webhook 路由

每个 adapter 在 `/eve/v1/{adapterName}` 注册 `GET` 和 `POST` handlers，所以上面的 `resend` adapter 服务在 `/eve/v1/resend`。把提供商 webhook（Resend inbound 地址、Slack Event Subscriptions URL 等）指到该路径。Adapter 处理入站方法。例如 X 用 `GET` 做 webhook 校验 challenge，用 `POST` 投递事件。

用 `route` 覆盖每个 adapter 的基路径，或用 `routes` 钉死单个 adapter 的路径：

```ts
export const { bot, channel, send } = chatSdkChannel({
  userName: "Resend Bot",
  adapters: { resend: createResendAdapter({ fromAddress: "hello@example.com" }) },
  state: createMemoryState(),
  route: "/webhooks", // resend 现在挂在 /webhooks/resend
  routes: { resend: "/webhooks/inbound-email" }, // 或精确钉死
});
```

提供商要求固定 URL，或迁移已有端点又不想改提供商设置时，用 `routes`。

## 渠道如何处理消息

### Dispatch

你通过在 `bot` 上注册 handlers 并调用 `send` 来选择哪些 Chat SDK 事件启动 turn：

- `bot.onNewMention(thread, message)` 在新的 `@mention`（或 email 这类表面的新入站 thread）时触发。想让同一 thread 后续回复继续到达 Agent 时调用 `thread.subscribe()`。
- `bot.onSubscribedMessage(thread, message)` 在已订阅 thread 的后续消息时触发。
- 发出它们的 adapters 还可以用 `bot.onAction`、`bot.onReaction` 和 `bot.onSlashCommand`。

`send(input, options)` 启动或恢复 eve session。你传入的 `thread` 决定 continuation token 和持久化的 channel state，所以回复会回到原始 thread。`options` 接受 `{ thread, auth?, title?, mode?, callback?, adapterName?, turnPolicy? }`。`title` 设置 eve session 的显示标题，不改模型消息；`auth` 把已认证 principal 附到 turn。

### Steering

消息默认 `turnPolicy: "steer"`：eve turn 进行中发来的消息会被 durable 缓冲，然后取消该 turn 并作为替代启动。想让当前 turn 先完成时设 `turnPolicy: "queue"`。

基于取消的 steering 会发出 `turn.cancelled`，替代消息用新的 turn ID 启动新 turn。被中断 turn 的部分输出和已完成副作用不会回滚。没有活跃 turn 时，消息正常发送。可以在 `chatSdkChannel({ turnPolicy })` 上设一次，或按 `send(...)` 覆盖。

这个策略控制重叠的 eve turns。Chat SDK 单独的 `concurrency` 选项控制重叠的 webhook handlers；每个入站消息都应立刻到达 steering 路径时用 `concurrency: "concurrent"`。

### 投递

默认 handlers 会把 Agent 回复发回 thread——不需要 `events` 覆盖。完成的 assistant messages 作为 markdown（`{ markdown: … }`）发布，这样 adapters 渲染富文本和 email HTML，而不是原始字符串。

Streaming 默认开启：渠道先发一条初始消息，再按 token 到达编辑它（`message.appended`），由 `streamingEditIntervalMs` 节流（默认 `1000`）。对每个 turn 只投递一条消息的表面（例如 email）设 `streaming: false`，这样回复在完成时发布一次而不是编辑。

Typing indicators 在 adapter 支持的地方自动发布：`turn.started` 上是 `Working…`，`actions.requested` 上是 tool status。

### 可选能力会优雅降级

不是所有 adapters 都实现每种操作。当 adapter 的 `startTyping` 或 `editMessage` 抛出 `NotImplementedError`（或 code 为 `NOT_IMPLEMENTED` 的错误）时，渠道会吞掉它：跳过 typing indicators，streaming 编辑在余下 session 回退到单次最终发布。你不必在自己的 handlers 里守卫可选能力。同一谓词导出为 `isNotImplemented`，自定义 `events` 时可以用。

传入 `events` 覆盖任意默认。Handlers 收到 `(eventData, channel, ctx)`，重建的 Chat SDK thread 在 `channel.thread` 上。

### Human-in-the-loop（HITL）

HITL prompts 渲染成带按钮的 Chat SDK `Card`。按钮点击会自动恢复 parked session——渠道已经为你接好 `bot.onAction`。如果应用已经在用默认前缀，用 `inputActionPrefix`（默认 `eve_input:`）改 action-id 前缀；提供 `resolveInputAuth` 可在 resume 时带上用户或租户 auth。

### 主动 sessions

没有入站 webhook 时，从 schedule `run` handler 用 `to(channel, target).send(message, { auth })` 启动 session，或从另一个 channel 用 `ctx.to(channel, target).send(...)`。target 是序列化的 Chat SDK thread，或只有提供商原生 thread id 时用 `{ threadId, adapterName }`。

### 附件

`send` 接受纯文本或 AI SDK `UserContent` 数组。要转发 Chat SDK 消息的附件，用 `messageToUserContent` 转换：没有附件时返回 `message.text`，有附件时返回 `UserContent` 数组（文本加上每个附件 URL 的一个 file part）。远程文件 URL 如何在模型调用前被 staging，见 [自定义渠道的文件上传](./custom)。

## 配置参考

| 选项 | 默认 | 用途 |
| --- | --- | --- |
| `adapters` | — | adapter 名到 Chat SDK adapter 实例的 map。每个条目一个 webhook。 |
| `state` | — | 用于 subscriptions、locks 和去重的 Chat SDK state adapter。 |
| `userName` | — | Bot 显示名（标准 Chat SDK `ChatConfig` 字段）。 |
| `route` | `/eve/v1` | 生成 adapter webhooks 的基路径（`{route}/{adapter}`）。 |
| `routes` | — | 固定或迁移 webhook URL 的按 adapter 路径覆盖。 |
| `streaming` | `true` | 先发后改的 streaming。每个 turn 一条消息的表面设 `false`。 |
| `streamingEditIntervalMs` | `1000` | streaming 编辑之间的最短间隔。 |
| `events` | 内置 | 按事件 handlers。提供的 handler 替换该内置默认。 |
| `inputActionPrefix` | `eve_input:` | 默认 HITL 按钮 action ids 的前缀。 |
| `resolveInputAuth` | `null` | HITL 按钮点击恢复 session 时应用的 auth resolver。 |
| `webhook` | — | 额外的 Chat SDK webhook 选项（eve 拥有 `waitUntil`）。 |

其它 Chat SDK `ChatConfig` 字段（例如 `concurrency`）也会被接受并透传。

## 接下来读什么

- [渠道概览](./overview)
- [自定义渠道](./custom)
- [鉴权与路由保护](../guides/auth-and-route-protection)
