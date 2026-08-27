---
title: "状态（State）"
description: "使用 defineState 保存每个 session 的 durable memory：get() 和 update() 会跨 step boundaries 持久化。"
---

# 状态（State）

`defineState` 是 Agent 每个 session 下的 typed、named durable memory slot。它适合用来让 Agent 在 conversation turns 之间记住某些工作状态，例如运行中的预算、术语表、检查清单，并且不需要为这些短期状态单独搭建外部存储。

这些值会跨 workflow step boundaries 保留，因此可以撑过崩溃、重新部署和持续数天的 sessions。

> 官方目录把 State 放在 Concepts 下，完整中文见 [状态（State）](../concepts/state)。本页保留为 Guides 下的历史路径。

```ts
import { defineState } from "eve/context";

const budget = defineState("my-agent.budget", () => ({ count: 0, cap: 25 }));
```

调用 `defineState(name, initial)` 时传入一个稳定的字符串 `name`，建议用 Agent 命名空间前缀隔离；再传入一个 `initial` 函数，用来在第一次读取该 slot 时产生初始值。返回的是一个 `StateHandle<T>`：

- `get()`：读取当前值。当前 context 首次访问时返回 `initial()`。
- `update(fn)`：用 `fn(current)` 替换当前值。

把 handle 在 module scope 声明一次，然后在需要读写这个 slot 的地方 import 它。从 tool、hook 或其它 framework-managed runtime code 中使用。

`get()` 和 `update()` 需要 active eve context。在 tools、hooks 或 framework-managed code 之外调用会抛错。

## 在 turn 之间重置状态

State 默认是 durable 的，不会在 turn 之间自动重置。如果希望每个 turn 都从干净状态开始，可以在 lifecycle [钩子（Hooks）](../hooks) 的 `turn.started` 中覆盖它。

## 状态不会与子智能体共享

每个 [子智能体](../../subagents) 都从自己的 fresh state 开始。`defineState` 的值永远不会跨 parent / child boundary。

## State、Memory 与连接侧存储

`defineState` 保存的是 conversation-scoped working memory，它和 session 一起存在和消亡。需要跨 session 存活的上下文，应接入一等 [记忆（Memory）](../../memory) provider。只有希望数据必须通过显式模型 tool call 查询、而不是自动 recall 时，才改用一般 [连接（Connections）](../../connections)。

## 接下来读什么

- 官方 Concepts 路径 → [状态（State）](../../concepts/state)
- 跨 session 的长期记忆 → [记忆（Memory）](../../memory)
- 租户隔离 → [多租户记忆](../../patterns/multi-tenant-memory)
- Step durability → [执行模型与持久性](../../concepts/execution-model-and-durability)
