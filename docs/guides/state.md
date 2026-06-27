---
title: "状态（State）"
description: "使用 defineState 保存每个 session 的 durable memory：get() 和 update() 会跨 step boundaries 持久化。"
---

# 状态（State）

`defineState` 是 Agent 每个 session 下的 typed、named durable memory slot。它适合用来让 Agent 在 conversation turns 之间记住某些工作状态，例如运行中的预算、术语表、检查清单，并且不需要为这些短期状态单独搭建外部存储。

这些值会跨 workflow step boundaries 保留，因此可以撑过崩溃、重新部署和持续数天的 sessions。

```ts
import { defineState } from "eve/context";

const budget = defineState("my-agent.budget", () => ({ count: 0, cap: 25 }));
```

调用 `defineState(name, initial)` 时传入一个稳定的字符串 `name`，建议用 Agent 命名空间前缀隔离；再传入一个 `initial` 函数，用来在第一次读取该 slot 时产生初始值。返回的是一个 `StateHandle<T>`：

- `get()`：读取当前值。当前 context 首次访问时返回 `initial()`。
- `update(fn)`：用 `fn(current)` 替换当前值。

把 handle 在 module scope 声明一次，然后在需要读写这个 slot 的地方 import 它。从 tool、hook 或其它 framework-managed runtime code 中使用：

```ts title="agent/lib/budget.ts"
import { defineState } from "eve/context";

export const budget = defineState("my-agent.budget", () => ({ count: 0, cap: 25 }));
```

```ts title="agent/tools/spend.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import { budget } from "../lib/budget.js";
import { runQuery } from "../lib/warehouse.js";

export default defineTool({
  description: "Run a query, counting it against the session budget.",
  inputSchema: z.object({ sql: z.string() }),
  async execute({ sql }) {
    const { count, cap } = budget.get();
    if (count >= cap) throw new Error("Query budget exhausted for this session.");
    budget.update((s) => ({ ...s, count: s.count + 1 }));
    return runQuery(sql);
  },
});
```

`get()` 和 `update()` 需要 active Eve context。在 tools、hooks 或 framework-managed code 之外调用会抛错。

## 在 turn 之间重置状态（Reset state between turns）

State 默认是 durable 的，不会在 turn 之间自动重置。如果希望每个 turn 都从干净状态开始，可以在 lifecycle [钩子（Hooks）](../hooks) 的 `turn.started` 中覆盖它：

```ts title="agent/hooks/reset-budget.ts"
import { defineHook } from "eve/hooks";
import { budget } from "../lib/budget.js";

export default defineHook({
  events: {
    async "turn.started"() {
      budget.update(() => ({ count: 0, cap: 25 }));
    },
  },
});
```

Hook 和 tool import 的是同一个 module-scope `budget` handle，因此二者读写的是同一个 slot。

## 状态不会与子智能体共享（State is never shared with subagents）

每个 [子智能体（Subagents）](../../subagents) 都从自己的 fresh state 开始，无论它是内置 `agent` copy，还是声明式 specialist。`defineState` 的值永远不会跨 parent / child boundary，即使 child 是同一个 Agent 的 copy。

## State 与连接侧存储的区别（State vs. connection-side storage）

`defineState` 保存的是 conversation-scoped working memory，它和 session 一起存在和消亡，例如 counters、当前 plan、用户在这次对话里告诉你的信息。它是 Agent 的短期记忆，在 session 生命周期内 durable。

任何需要比 session 更长久、要跨 sessions 或 users 共享、或需要独立于 turn 查询的数据，都应该放到外部存储里，可以是 [连接（Connections）](../../connections)，也可以是你自己的数据库。

## 接下来读什么（What to read next）

- 在 dynamic resolvers 中读取 state → [动态能力（Dynamic capabilities）](../dynamic-capabilities)
- Step durability 的工作方式 → [执行模型与持久性（Execution model & durability）](../../concepts/execution-model-and-durability)
- 和 state 一起可用的 `ctx` accessors → [TypeScript API](../../reference/typescript-api)
