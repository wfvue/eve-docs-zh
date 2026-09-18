---
title: "前端概览（Overview）"
description: "使用 useEveAgent 把 Eve Agent 接到浏览器聊天 UI 或 Agent UI。"
---

# 前端概览（Overview）

已有浏览器应用、需要接到 eve Agent 时看本页。`useEveAgent()` 打开 durable session、发送 turns、流式接收回复，并把原始 event stream 转成可渲染状态。React 是参考实现；[Vue](./use-eve-agent-vue) 与 [Svelte](./use-eve-agent-svelte) 提供同一表面。官方原文：[Frontend Overview](https://eve.dev/docs/guides/frontend/overview)。前后端是对等服务还是框架集成，见[项目结构](../../concepts/project-structure#configure-a-web-deployment)。


## Prewarm 与持续流式

传 `prewarm: true` 可在聊天挂载后、以及每次 `reset` 后，先创建 durable session、**不**启动 turn：

```tsx
import { useEveAgent } from "eve/react";

export function Chat() {
  const agent = useEveAgent({ prewarm: true });
  return <button onClick={agent.reset}>New chat</button>;
}
```

在 **React** 里，`prewarm` 是活的 boolean：可用组件 state 等到用户开始输入再预热：

```tsx
const [message, setMessage] = useState("");
const agent = useEveAgent({ prewarm: message.length > 0 });
```

初始为 `true`，或之后从 `false` 变为 `true`，都会准备当前 owned session；再改回 `false` **不会**中止创建或丢弃已有 session。Vue / Svelte 在 binding 创建时读一次 `prewarm`；交互驱动创建请调用返回的 `prewarm()` 方法。

默认 `prewarm: false`（第一次 send 才创建）。只有应用的 auth、headers、聊天记录绑定都就绪后再设为 `true`；若这些在 submit handler 里才准备，请保持默认。

Prewarm 会启动 workflow 并建立 inbox，然后在 session hooks / 动态定义 / sandbox 之前停泊。首条消息经 channel 的 `onMessage`，为初始化与 `turn_0` 提供身份与上下文。显式 `prewarm()` 与 `client.sessions.create()` 一样在 `202 Accepted` 时 resolve，不等初始化事件；并发调用共享同一次 create。Composer 保持 `"ready"`。并发 `send()` 只等 acceptance，再 post 消息；inbox 仍在启动时，客户端对 `409 session_not_ready` 有界退避最多约 20 秒。

Hook 会跨 turns 与空闲期持续消费**同一** session stream；turn settle **不会**关掉连接。传输在断线或服务端可续约的 60 秒 lease 后从 cursor 重连。`reset()` 复用 hook 实例并清空对话；若 reset 后 `prewarm` 仍为 true，会准备下一个 owned session。显式传入的 `session` 始终外部拥有，不会被 prewarm / reset 替换。

`error` / `onError` 覆盖 session 创建、流式、resume 或 turn 失败；无人等待的 send 时，失败的 prewarm 也会报到这里。`onSessionChange` 在创建、cursor 前进或 reset 清空时触发。传给 `send()` 的 headers 作用于该 turn 请求，并成为连续 session stream 下次重连时的凭据。

## 返回状态要点

大多数聊天 UI 只需要 `data.messages` 和 `status`。

`resume: true` 配合 `initialSession` 时，mount 后会从 durable stream 重建投影。`status === "resuming"` 期间可渲染已 hydrate 的 `data`，但应禁用发消息与 HITL；不要展示取消或进行中 turn 的进度控件。要用 follow-up **steer** 活跃 turn 时，用 `turnPolicy: "steer"` 发送：答案输出或本地工具执行开始前，eve 会打断待进行的模型生成并在同一 turn 继续校正；正在执行的 tools 先收尾并 checkpoint；答案开始后等到下一已提交的 Workflow 边界。推理与搜索进度不算答案输出。hook 在完成前保持挂接（`await agent.send(message, { turnPolicy: "steer" })`）。catch-up 发现进行中 turn 会先变 `"streaming"` 再跟到边界；流会报告初始 durable 尾部，catch-up 可在不关连接、不等空闲超时的情况下结束；**已结算尾部直接变 `"ready"`**，更新的 turn 或 pending authorization 则保持 `"streaming"`，连接继续接收后续事件。终态 session 失败变 `"error"`。

`data.messages` 是 Eve 拥有的消息投影。根 Agent 委派时，其 stream 会发出带 `childSessionId` 的 `subagent.called`，admit 后发出携带 working 任务回执的 `subagent.completed`；后续更新与最终结果经 task notifications 唤醒父级。详细子级进度在 child session 的 stream 上，不会压平进根 `data.messages`。需要 live 子级活动时，用底层 [Client SDK](../client/overview) attach 该 ID。完整契约见 [父级看到什么](../../subagents#父级看到什么)。

## 接下来读什么

- [Sessions, runs & streaming](../../concepts/sessions-runs-and-streaming)
- [子智能体](../../subagents)
- [Client SDK](../client/overview)
- [Next.js](./nextjs)
