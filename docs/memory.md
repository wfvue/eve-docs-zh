---
title: "记忆（Memory）"
description: "用内置或自定义 eve memory provider 召回并捕获有作用域的跨 session 上下文。"
---

# 记忆（Memory）

Memory 把 Agent 接到可以比单个 session 更长久的应用自有存储。Provider 在 turn 开始前召回相关上下文，可以在对话 settle 后捕获内容，也可以暴露操作同一锁定作用域的工具。

eve 拥有生命周期和面向模型的历史。Provider 拥有存储、检索、保留和删除。用内置的 bounded file provider 保存模型维护的事实，或实现自己的 provider 做应用特定的检索和捕获。

这与 [状态（State）](./concepts/state) 不同：`defineState` 跟着一个 session 活和死；Memory 跨 sessions。官方原文：[Memory](https://eve.dev/docs/memory)。

## 使用文件记忆（Use file memory）

`fileMemory()` 为每个解析出的 scope 保存一份带索引的文档，并给模型 `save_memory` 和 `remove_memory` 工具。它在每个 turn 之前以及 compaction 之后召回这份文档，但不会自动从对话中抽取事实。

```ts title="agent/memory/profile.ts"
import { defineMemory } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";
import { fileMemory } from "eve/memory/file";

export default defineMemory({
  description: "Remember stable facts and preferences about the caller.",
  provider: fileMemory(),
  scope: byPrincipal,
});
```

`profile` slot 暴露 `profile__save_memory` 和 `profile__remove_memory`。保存的条目会被规范化、分配永久数字索引，并作为一条稳定的 keyed message 召回。删除条目会在下一个边界替换之前召回的文档，包括删掉最后一条时，这样过期内容不会留在模型上下文里。

Provider 会拒绝而不是截断或驱逐数据。`maxCharacters` 默认 4,000，限制的是完整召回消息（含标题、删除指引、索引、分隔符和已保存文本）。如果结果消息会超过该上限，`save_memory` 会拒绝该条目。每条规范化条目最多 2,048 UTF-8 字节，整份存储文档最多 65,536 字节：

```ts
provider: fileMemory({ maxCharacters: 8_000 });
```

### 选择文件后端

不传 `backend` 时，`fileMemory()` 会惰性选择存储：

| 环境 | 后端 |
| --- | --- |
| 带 Blob 凭据的 Vercel（token，或带 OIDC 的 attached store） | Private Vercel Blob |
| 没有 Blob 配置的 Vercel | 报错，要求 attach Blob store |
| `eve dev` | 进程内共享的 in-memory storage |
| 其它环境 | 报错，要求显式 backend |

仅设置 `NODE_ENV=development` 不会选择 in-memory storage；Vercel 之外的 Blob token 也不会选择 Blob。测试时显式传入一份新的 in-memory backend：

```ts
import { fileMemory, inMemory } from "eve/memory/file";

provider: fileMemory({ backend: inMemory() });
```

`inMemory()` 在 backend 实例或进程被替换时丢失内容。其它 durable store 实现 `eve/memory/file` 的 `MemoryDocumentBackend`。它的 `write()` 必须有条件地替换完整文档，并在 `expectedVersion` 过期时抛出 `MemoryDocumentConflictError`。需要显式配置 Vercel Blob 凭据或 object prefix 时，使用 `eve/memory/file/vercel` 的 `vercelBlob()`。

## 添加 memory slot

单个名为 `memory` 的 slot 写 `agent/memory.ts`；多个命名 slot 写 `agent/memory/<name>.ts`。这两种形式互斥。

```ts title="agent/memory/profile.ts"
import { defineMemory, type MemoryOperationContext } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { profileStore } from "../lib/profile-store";

async function recallProfile(ctx: MemoryOperationContext) {
  const profile = await profileStore.get(ctx.memory.scope.key);
  if (profile === null) return null;

  return {
    messages: [{ id: "profile", content: JSON.stringify(profile) }],
  };
}

export default defineMemory({
  description: "Manage durable facts and preferences for the current caller.",
  scope: byPrincipal,
  provider: {
    recall: {
      "turn.started": recallProfile,
      "compaction.completed": recallProfile,
    },

    capture: {
      async "turn.completed"(ctx) {
        await profileStore.observe(ctx.memory.scope.key, ctx.messages, {
          operationId: ctx.operationId,
        });
      },
    },

    async tools(ctx) {
      return {
        save: defineTool({
          description: "Save one durable profile fact.",
          inputSchema: z.object({ key: z.string(), value: z.string() }),
          async execute(input) {
            await profileStore.put(ctx.memory.scope.key, input);
            return { saved: true };
          },
        }),
      };
    },
  },
});
```

文件名就是 slot 名。上面的 provider tool 暴露为 `profile__save`；slot description 会加到 tool description 前面。Provider tools 就是普通 `defineTool()` 值，所以 schemas、approvals 和 `toModelOutput` 都正常工作。它们的回调在进程重启或部署后仍可 replay。

多个 slot 共享一个 provider，或希望单独校验合同时，使用 `defineMemoryProvider()`：

```ts
import { defineMemoryProvider, type MemoryOperationContext } from "eve/memory";

async function recall(ctx: MemoryOperationContext) {
  return await recallFromStore(ctx.memory.scope.key, ctx.messages);
}

export const provider = defineMemoryProvider({
  recall: {
    "turn.started": recall,
    "compaction.completed": recall,
  },
});
```

## 选择作用域（Choose a scope）

`scope` 决定谁共享这份记忆。可以是字符串、`null`，或返回字符串、字符串元组或 `null` 的 resolver。从受信任的认证或 channel metadata 解析租户和调用者身份，**永远不要**从模型输入读取：

```ts title="agent/memory/account.ts"
import { defineMemory } from "eve/memory";

export default defineMemory({
  scope: (ctx) => {
    const caller = ctx.session.auth.current;
    const tenantId = caller?.attributes.tenantId;

    if (caller?.principalType !== "user" || typeof tenantId !== "string") {
      return null;
    }

    return [tenantId, caller.principalId];
  },
  provider,
});
```

返回 `null` 会为这次操作禁用该 slot。eve 不会调用它的 namespace resolver、provider 或 tools，也永远不会回退到共享 scope。在 `eve dev` 中，诊断会点名被禁用的 slot 和返回 `null` 的 resolver，但不会记录解析值。

`byPrincipal` 使用 `auth.current`。它对匿名和 runtime principals 禁用 memory，并在本地开发返回共享的 `local-dev` scope。边界还需要租户、channel 或对话标识时，使用自定义 resolver。

eve 校验 namespace 和 scope 后，把这些交给 provider：

- `memory.scope.key`：用于存储查找的版本化不透明 digest
- `memory.scope.namespace`：解析出的 namespace
- `memory.scope.value`：解析出的字符串或元组
- `memory.slot`：由路径派生的 slot 名

把 `memory.scope.key` 当作 provider 的分区键。它保留元组边界，不会把原始 scope 组件持久化进 eve 的 durable attribution。

## 选择 namespace

Namespace 在应用 scope 之前分隔记忆域。省略 `namespace` 会使用 `defaultNamespace`，它包含 graph node 和 slot，以及部署感知的身份：

- 生产和其它 Vercel 环境使用 project 和 environment
- Preview 还会使用 branch 或 deployment identity
- 本地开发使用应用根目录的 digest，而不是原始路径

重新部署会保持同一个生产 namespace。Preview branches 不会意外共享记忆。需要显式域时设置字符串或 resolver：

```ts
export default defineMemory({
  namespace: "acme-support-v1",
  scope: byPrincipal,
  provider,
});
```

自定义 namespace 是完整的；eve 不会再加隐藏后缀。返回 `null` 会禁用该 slot。Scope 先解析，所以被禁用的 scope 永远不会调用 namespace resolver。

## 召回行为（Recall behavior）

在生命周期 key 下注册 recall handlers。`"turn.started"` 是必填的，在模型调用之前运行。`"compaction.completed"` 可选，在 compaction checkpoint 之后运行。Handler 返回 `{ messages }`、`null` 或 `undefined`。每条召回项都会变成不受信任的 user-role message；provider 内容永远不会提升为 system instructions。

```ts
return {
  messages: [
    { id: "preferred-language", content: "The user prefers Spanish." },
    { content: "A relevant note without a stable identity." },
  ],
};
```

对可替换事实使用稳定 `id`。同一 slot、namespace 和 scope 里，后面带相同 ID 的项会覆盖前面的值。值完全相同则是 no-op。没有 ID 的项会累积，即使内容相同。后续结果省略更早的项并不会删除它。

所有活跃 slots 会在任何 recall 运行前锁定各自的 scope。它们看到同一份召回前历史，eve 原子提交校验后的结果。每次调用都有稳定的 `operationId`；把它当作 capture handlers 写入时的幂等键。

默认 `visibility: "scope"` 会在 scope 变化时隐藏该 slot 先前召回的记录。只有这些记录在余下 session 里跨 scope 变化仍然安全时，才设 `visibility: "session"`。Namespace 和 slot 边界仍然生效。

## 生命周期与 compaction

| 阶段 | Provider handler | 上下文 |
| --- | --- | --- |
| `turn.started` | `recall["turn.started"]` | 召回前的历史；当前投递在 `turn.input` |
| `turn.completed` | `capture["turn.completed"]` | 成功 turn 之后已 settle、已投影的历史 |
| `compaction.requested` | `capture["compaction.requested"]` | checkpoint 变化前的投影历史 |
| `compaction.completed` | `recall["compaction.completed"]` | checkpoint 加上规范化召回记录 |

Compaction 把召回记录排除在 summarizer 之外，只保留最新 keyed 值加上 unkeyed 值，然后对着新 checkpoint 再次召回。这样 provider 上下文仍然可归因，摘要也不会把它变成普通对话历史。

如果被覆盖的原始记录超过 512 条或 256 KiB，eve 可以不等正常 token 阈值就规范化它们。这会折叠被覆盖记录，而不改变 provider 的外部存储。

`clear()` 从 session 移除对话历史、召回记录、锁定的 scopes 和 memory replay bookkeeping。它不会删除 provider 外部存储里的数据。之后的 turn 可以再次召回那些数据。

## 失败行为

- 抛错或无效的 turn-start recall 会在模型调用前失败。任何 slot 的召回结果都不会提交。
- compaction 前的 capture 失败会让历史保持不变。
- compaction 后的 recall 失败会让自动 turn 失败。独立 compaction 会报告诊断并把 session 送回 waiting，因为 checkpoint 已经写完。
- 无效或抛错的 `tools()` 结果会在该 turn 被诊断并省略。
- 已完成 turn 的 capture 失败会在响应之后诊断，不会改写已完成的 turn。

保持 provider 操作幂等，强制后端大小和保留策略，并把召回内容当作用户控制的数据。

## 限制与覆盖

Namespaces、scope 组件和 provider item IDs 限制为 1,024 UTF-8 字节。Scope 元组最多 16 个非空组件；规范化 namespace 和 scope 输入合计最多 4,096 字节。Provider tool 名在加上 `__` 前缀后仍须满足普通 tool-name 语法。

应用自有的 `agent/tools/<name>.ts` 会替换生成的 provider-tool wrapper；在那里导出 `disableTool()` 可以移除它。Extensions 不能贡献 memory slots，因为 scope 和生命周期所有权仍属于消费该能力的 Agent 或 subagent。

## 接下来读什么

- [多租户记忆（Multi-tenant memory）](./patterns/multi-tenant-memory)：为应用存储定义租户和调用者 scope
- [状态（State）](./concepts/state)：在单个 session 内保存 durable working data
- [默认 Harness](./concepts/default-harness)：理解 compaction 和上下文控制
- [动态能力（Dynamic capabilities）](./guides/dynamic-capabilities)：理解 provider tools 使用的普通 dynamic-tool 生命周期
