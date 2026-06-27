---
title: "输出 Schema（Output Schema）"
description: "从 Eve client turn 请求结构化结果，并从 MessageResult 中读取 typed data。"
---

# 输出 Schema（Output Schema）

当调用方需要结构化数据，而不仅仅是 assistant 文本时，可以在 client turn 上传 `outputSchema`。Runtime 会让模型在 turn settle 前满足该 schema，然后把最终 payload 作为 `result.completed` 发出。

## JSON Schema（JSON Schema）

原始 JSON Schema object 可以直接使用：

```ts
import { Client } from "eve/client";

interface Summary {
  title: string;
  count: number;
}

const outputSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    count: { type: "integer" },
  },
  required: ["title", "count"],
} as const;

const client = new Client({ host: "http://127.0.0.1:3000" });
const session = client.session();

const response = await session.send<Summary>({
  message: "Summarize this turn.",
  outputSchema,
});

const result = await response.result();

console.log(result.data?.title);
console.log(result.data?.count);
```

当 turn 没有产生结构化结果时，`result.data` 是 `undefined`。

## Standard Schema（Standard Schema）

Client 也接受 Zod、Valibot、ArkType 等 Standard Schema 实现。请求发送前，schema 会被 lowering 成 JSON Schema：

```ts
import { z } from "zod";

const summarySchema = z.object({
  title: z.string(),
  count: z.number().int(),
});

type Summary = z.infer<typeof summarySchema>;

const response = await session.send<Summary>({
  message: "Summarize this turn.",
  outputSchema: summarySchema,
});

const { data } = await response.result();
```

服务端是 validation 的权威。Client 会根据 generic 和 schema 给 `MessageResult.data` 提供类型，但不会在 client-side 重新验证 streamed payload。

## 流式读取 result event（Stream the result event）

手动消费 events 时，读取 `result.completed`：

```ts
const response = await session.send<Summary>({
  message: "Summarize this turn.",
  outputSchema,
});

for await (const event of response) {
  if (event.type === "result.completed") {
    const summary = event.data.result as Summary;
    console.log(summary.title);
  }
}
```

如果已消费 event list 中出现多个 `result.completed`，`result()` 会把最近一个作为 `data` 返回。

## 携带 output schema 发送 payload（Send payloads with output schema）

`outputSchema` 既可以和 string shorthand 搭配，也可以和 object-form sends 搭配。当你需要 schema、headers、signal、context、attachments 或 HITL responses 时，使用 object form：

```ts
const response = await session.send<Summary>({
  message: "Summarize this PDF.",
  clientContext: { reportId: "rpt_123" },
  outputSchema,
});

const result = await response.result();
```

它也可以用于 follow-up turns 和 HITL response turns：

```ts
const response = await session.send({
  inputResponses: [{ requestId, optionId: "approve" }],
  message: "Return the approved action as structured output.",
  outputSchema,
});

const result = await response.result();
```

## Per-turn 作用域（Per-turn scope）

Client `outputSchema` 只作用于发送它的那个 turn，不会变成整段对话的永久设置：

```ts
const response = await session.send({ message: "Return a structured summary.", outputSchema });
await response.result();

const followUpResponse = await session.send("Now answer normally.");
const followUp = await followUpResponse.result();

console.log(followUp.data); // undefined，除非这个 turn 也请求了 schema
```

如果是属于 Agent 或 subagent 定义本身的 task-mode output，请看 [`agent.ts`](../../../agent-config#outputschema) 和 [子智能体（Subagents）](../../../subagents)。

## 接下来读什么（What to read next）

- [消息（Messages）](../messages)：用 `send()` 发送 turns
- [流式输出（Streaming）](../streaming)：实时处理 `result.completed`
- [`agent.ts`](../../../agent-config#outputschema)：配置 task-mode output
