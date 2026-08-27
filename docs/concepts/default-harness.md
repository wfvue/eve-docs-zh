---
title: "默认 Harness（The Harness）"
description: "eve 如何在一次 Agent turn 中管理模型上下文与压缩。"
---

# 默认 Harness（The Harness）

默认 harness 是 eve 内置的 Agent 循环。它管理模型调用、压缩和工具执行。面向模型的默认值和可用 opt-in 见 [内置工具（Built-in Tools）](./built-in-tools)。要了解 turn 如何 checkpoint 和恢复，读 [执行模型与持久性](./execution-model-and-durability)。

官方原文：[Default Harness](https://eve.dev/docs/concepts/default-harness)。

## 压缩（Compaction）

Harness 让长 session 不会溢出模型的上下文窗口。在把对话与 `thresholdPercent`（默认 `0.9`）比较之前，它先加上用于压缩的 checkpoint prompt 的估计固定开销。然后摘要更早的 turn 并继续。Prompt 要求压缩模型区分已完成的进度和决策与剩余工作，并保留继续所需的约束、偏好、数据和引用。当 eve 再次压缩时，它把上一个 checkpoint 单独传入，且不做 transcript 的逐消息截断，然后用更新的 checkpoint 替换它。摘要使用当前 turn 模型，除非你覆盖。在 `agent.ts` 的 [`compaction`](../agent-config) 下调节它何时、如何触发：

```ts title="agent/agent.ts"
export default defineAgent({
  model: "anthropic/claude-opus-4.8",
  compaction: {
    thresholdPercent: 0.75,
  },
});
```

压缩也会自动保留框架自己的工具状态。它重置 read-before-write 追踪（因此之后的写入会重新读取那个读证据已被摘要掉的文件），并重新注入活跃 todo 列表，让模型跨摘要保留任务列表。没有 per-tool hook 可配置。

一等 [记忆（Memory）](../memory) 参与另一套生命周期。eve 会在 compaction 前请 providers capture，把可归因的召回记录排除在 summarizer 之外，保留它们规范化后的最新值，并在 checkpoint 之后再次召回。

客户端和渠道也可以在 turn 之间请求压缩。调用 `ClientSession.compact()`、渠道路由的 `compact(address)`，或 `attachSession(sessionId).compact()`。请求不会追加用户消息；如果 turn 正在运行，eve 会排队直到该 turn settle。成功的手动压缩发出与自动压缩相同的 `compaction.requested` 和 `compaction.completed` 事件，后跟 `session.waiting`。

要丢弃模型消息历史而不是摘要它，调用上述任意 handle 上对应的 `clear()` 方法。Clear 保留 session 身份、system prompt、配置的 tools 和 skills、durable state、limits 和 sandbox。它会移除召回的 memory 记录和框架 memory bookkeeping，但不会删除 memory provider 外部存储里的数据。它的流边界是 `context.cleared` 后跟 `session.waiting`。

## 接下来读什么

- [内置工具](./built-in-tools)：审查默认和 opt-in 框架工具，并配置面向模型的工具集
- [执行模型与持久性](./execution-model-and-durability)
- [上下文控制](./context-control)
- [记忆（Memory）](../memory)：把有作用域的跨 session 上下文接到 harness 生命周期
