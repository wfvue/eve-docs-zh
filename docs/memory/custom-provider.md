---
title: "构建 Memory Provider"
description: "实现 recall、capture 与 tools 契约，让任意 store 或记忆服务支撑 eve memory slot。"
---

# 构建 Memory Provider

Memory provider 是带 `recall`、以及可选 `capture` / `tools` 的对象。eve 在 Agent 生命周期的固定节点调用这些 handlers，并传入锁定的 scope key、投影后的对话，以及稳定的 operation ID。只要能在这把 key 下读写，就能当 provider。可以做成导出 factory 的库，也可以直接写在 Agent 里。

官方原文：[Build a Memory Provider](https://eve.dev/docs/memory/custom-provider)。

```ts title="agent/lib/notes-memory.ts"
import { defineMemoryProvider } from "eve/memory";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { notes } from "./notes-db";

export function notesMemory() {
  return defineMemoryProvider({
    recall: {
      async "turn.started"(ctx) {
        const rows = await notes.search({
          partition: ctx.memory.scope.key,
          query: ctx.turn.input,
          limit: 5,
        });
        return {
          messages: rows.map((row) => ({ id: row.id, content: row.text })),
        };
      },
    },
    capture: {
      async "turn.completed"(ctx) {
        await notes.ingest({
          partition: ctx.memory.scope.key,
          idempotencyKey: ctx.operationId,
          messages: ctx.messages,
        });
      },
    },
    async tools(ctx) {
      return {
        forget: defineTool({
          description: "Delete a remembered note by its ID.",
          inputSchema: z.object({ id: z.string() }),
          async execute({ id }) {
            await notes.delete({ partition: ctx.memory.scope.key, id });
            return { deleted: true };
          },
        }),
      };
    },
  });
}
```

像其它 provider 一样绑到 slot：

```ts title="agent/memory/notes.ts"
import { defineMemory } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";
import { notesMemory } from "../lib/notes-memory";

export default defineMemory({
  description: "Notes the caller has asked the agent to remember.",
  provider: notesMemory(),
  scope: byPrincipal,
});
```

模型看到的工具名是 `notes__forget`；slot description 会加到工具描述前面。

## Provider 契约

`defineMemoryProvider()` 接受三块表面。不需要的 handler 可以省略；例如 `fileMemory()` 实现 recall 和 tools，但没有 capture。

| 表面 | Handlers | 职责 |
| --- | --- | --- |
| `recall` | `"turn.started"`（必填）、`"compaction.completed"` | 返回要放进模型上下文的消息 |
| `capture` | `"turn.completed"`、`"compaction.requested"` | 观察已 settle 的历史并写入 store |
| `tools` | 一个函数 | 返回绑定到锁定 scope 的面向模型操作 |

### 操作上下文

每个 handler 收到 `MemoryOperationContext`：

| 字段 | 含义 |
| --- | --- |
| `memory.scope.key` | namespace + scope 的不透明、版本化 digest。每次读写都用它做分区键。 |
| `memory.scope.namespace` | 解析出的 namespace 字符串 |
| `memory.scope.value` | 解析出的 scope 字符串或元组 |
| `memory.slot` | 由路径派生的 slot 名 |
| `messages` | 本阶段投影后的对话历史 |
| `operationId` | 按 session、sequence、phase、slot 稳定。用作幂等键。 |
| `abortSignal` | 操作取消信号 |
| `session` | Session ID、认证及其它 `SessionContext` 字段 |

阶段特有字段：

- `turn.started` / `turn.completed` 增加 `turn`（含 turn `id`、`input` 消息、`sequence`）
- `compaction.requested` 增加 `compaction.modelId` 与 `compaction.usageInputTokens`；独立 compaction 时 `turn` 为 `null`
- `compaction.completed` 增加 `compaction.modelId`；`turn` 可能为 `null`

`tools()` 收到带相同 `memory` / `turn` 字段，外加普通 dynamic-resolve 上下文的 `MemoryToolsContext`。

### 召回结果

Recall handler 返回 `{ messages }`、`null` 或 `undefined`。每条消息有 `content` 和可选 `id`：

```ts
return {
  messages: [
    { id: "preferred-language", content: "The user prefers Spanish." },
    { content: "A relevant note without a stable identity." },
  ],
};
```

eve 把每条消息以归属到该 slot 的 **user-role** 消息加入模型上下文。Provider 内容永远不会提升为 system instructions。

对可替换事实使用稳定 `id`。同一 slot、namespace、scope 里，后面带相同 ID 的消息会覆盖前面的；内容完全相同则是 no-op。没有 ID 的消息会累积，即使内容重复。后续结果省略更早的 ID **不会**删除它——召回只能覆盖，不能撤回。

### Tools

`tools()` 返回 `defineTool()` 值的 map，或 `null`。eve 把每个 key 限定为 `<slot>__<key>`；限定名须以字母开头，只含字母、数字、下划线或短横线，且最多 64 字符。Schemas、`approval`、`outputSchema`、`toModelOutput` 与手写 tools 一样可用。

Tool 闭包到当前 turn 的锁定 scope，模型无法把它重定向到其它租户或调用者。eve 保证每个 tool 回调在进程重启或部署后仍可 replay。

## 生命周期

| 阶段 | Handler | `messages` 包含 |
| --- | --- | --- |
| `turn.started` | `recall["turn.started"]` | 召回前的历史；新投递在 `turn.input` |
| `turn.completed` | `capture["turn.completed"]` | 成功 turn 后已 settle 的历史 |
| `compaction.requested` | `capture["compaction.requested"]` | checkpoint 变化前的历史 |
| `compaction.completed` | `recall["compaction.completed"]` | checkpoint 加上规范化召回记录 |

Turn 开始时，eve 在任何 recall 运行前解析并锁定所有活跃 slots 的 scope。所有 slots 看到同一份召回前历史，eve 原子提交校验后的结果。

Compaction 期间，eve 把召回记录排除在 summarizer 之外，保留每个 keyed 记录的最新值以及全部 unkeyed 记录，然后对着新 checkpoint 调用 `recall["compaction.completed"]`。这样 provider 内容仍可归因，摘要也不会把它变成普通对话历史。若被覆盖的原始记录超过 512 条或 256 KiB，eve 可不等正常 token 阈值就规范化——这只改 session 历史，不动 provider store。

对 session 调用 `clear()` 会清掉历史、召回记录、锁定 scopes 和 replay bookkeeping，但 **不动** provider store；之后的 turn 仍会再次召回相同数据。

## 失败行为

- 抛错或无效的 `recall["turn.started"]` 会在模型调用前失败整个 turn；任何 slot 的召回结果都不会提交。
- 抛错的 `capture["compaction.requested"]` 让历史保持不变。
- 抛错的 `recall["compaction.completed"]` 会让自动 turn 失败。独立 compaction 时 eve 记录错误并把 session 送回 waiting（checkpoint 已经写完）。
- 无效或抛错的 `tools()` 结果会被记录，并在该 turn 省略。
- 抛错的 `capture["turn.completed"]` 在响应之后记录，不会改写已完成的 turn。

## 要求

Providers 必须：

- 每次读写都按 `memory.scope.key` 分区。做语义检索时，把 key 放进查询本身，而不是全局搜索后再过滤。
- 把 `operationId` 当幂等键。eve 可能用同一 ID 重放 handler；重放 recall 却得到不同结果是错误。
- 强制自己的大小与保留策略。eve **不会**截断或过期 provider 内容。
- 把召回内容当作用户控制的数据。

eve 对传入 / 传出 provider 的值强制这些上限：

| 值 | 限制 |
| --- | --- |
| Namespace | 1,024 UTF-8 字节 |
| 每个 scope 组件 | 1,024 UTF-8 字节 |
| Scope 元组 | 16 个组件 |
| 规范化 namespace + scope 合计 | 4,096 字节 |
| 召回消息 `id` | 1,024 UTF-8 字节 |

## 接下来读什么

- [记忆概览](./overview)：slots、scope、namespace、visibility
- [文件记忆](./file)：内置 provider，可作参考实现
- [动态能力](../guides/dynamic-capabilities)：provider tools 走的 dynamic-tool 生命周期
- [默认 Harness](../concepts/default-harness)：内置循环里的 compaction
