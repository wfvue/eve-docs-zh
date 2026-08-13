---
title: "记住定义（Remember Definitions）"
description: "Build an Agent 教程第 6 步：用 defineState 跨 turn 记住团队的指标术语表。"
---

# 记住定义（Remember Definitions）

每个团队对分析助手都有内部定义。"活跃"指过去 30 天内有过购买，收入是净退款后的，一周从周一开始。每个 turn 都重新解释一遍是浪费。State 给 Agent 一个地方存放它们。

`defineState(name, initial)` 创建一个类型化、命名的 slot，在 session 内跨 step 和 turn boundaries 存活。你用 `get()` 读它，用 `update()` 改它。

## 定义术语表 slot

```ts title="agent/lib/glossary.ts"
import { defineState } from "eve/context";

export interface Glossary {
  readonly terms: Readonly<Record<string, string>>;
}

export const glossary = defineState<Glossary>("analytics.glossary", () => ({
  terms: {},
}));
```

## 读写它的工具

```ts title="agent/tools/define_metric.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import { glossary } from "../lib/glossary";

export default defineTool({
  description: "Record the team's definition of a metric so it persists across turns.",
  inputSchema: z.object({ term: z.string(), meaning: z.string() }),
  async execute({ term, meaning }) {
    glossary.update((g) => ({ terms: { ...g.terms, [term]: meaning } }));
    return glossary.get();
  },
});
```

```ts title="agent/tools/recall_metrics.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import { glossary } from "../lib/glossary";

export default defineTool({
  description: "Read the team's recorded metric definitions.",
  inputSchema: z.object({}),
  async execute() {
    return glossary.get();
  },
});
```

## 看它持久

```txt
> For us, an active customer is one with a purchase in the last 30 days.
  Remember that.
→ calls define_metric("active customer", "purchase in the last 30 days")

> How many active customers do we have?
→ recalls the definition, writes the matching SQL, answers
```

第二个 turn 是同一 session 里的独立 turn，但定义还在那里。State 在 step boundaries 打点，所以它是第 2 步的同一个持久性，现在应用到你自己数据上。

State 是 session scope 的，按 Agent 隔离，所以子智能体从全新 state 开始，永远看不到父级的。需要每个 turn 重置某些东西？在 lifecycle hook 里调用 `update(() => fresh)`。更多见 [State](../guides/state)。

→ 下一步：[团队手册（Team playbooks）](./team-playbooks)
了解更多：[State](../guides/state)
