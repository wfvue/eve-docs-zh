---
title: "记忆（Memory）"
description: "把有作用域的跨 session 上下文接到内置、第三方或自定义 memory provider。"
---

# 记忆（Memory）

Memory 是 provider 支撑的能力：上下文可以比单个 session 活得更久。每个 memory slot 把一个 provider 绑到 eve 管理的 scope 和可见性策略。Provider 决定如何召回相关上下文、要不要捕获对话历史，以及给模型哪些操作。

官方说明：eve 管生命周期和面向模型的历史；provider 管存储、检索、保留和删除。白话一点：slot 是「这份记忆属于谁、什么时候塞进模型」；provider 是「记忆存在哪、怎么找回来」。官方原文：[Memory](https://eve.dev/docs/memory)。

这与 [状态（State）](./concepts/state) 不同：`defineState` 跟着一个 session 活和死；Memory 跨 sessions。

## eve 与 provider 的边界

| eve 拥有 | Provider 拥有 |
| --- | --- |
| 路径派生的 slots 和带前缀的 provider-tool 名 | 存储和索引 |
| Namespace 和受信任的 scope 解析 | 检索、排序和格式化 |
| 生命周期时机、召回消息归属、覆盖规则 | 捕获和抽取 |
| 模型上下文里的召回可见性 | 保留、删除和面向模型的记忆操作 |

因此一份有上限的文本文件、托管语义记忆服务，或应用自己的 store，都能接入同一套 Agent 生命周期，而不必共享存储模型。

## 选择 provider

每个 memory slot 都需要一个 provider。按召回和维护方式选：

| Provider | 状态 | 适合 |
| --- | --- | --- |
| `fileMemory()` | 内置 | 有上限、由模型自己维护的事实和偏好列表 |
| Supermemory | 第三方 | 语义召回、自动捕获、来源抽取，以及记忆工具 |
| 自定义 provider | 已支持 | 应用特定的检索、捕获、保留或面向模型的工具 |

**官方说明：** [Supermemory](https://github.com/supermemoryai/eve-supermemory#readme) 是第三方 provider：每个 turn 前召回相关上下文、捕获已完成 turn，并提供搜索、记忆管理和来源抽取工具。用 `eve add memory/supermemory` 安装。需要 Supermemory API key 和你选定的 memory scope。把敏感内容交给该服务前，先看它的保留与数据处理说明。**项目建议：** 大多数应用仍先用 `fileMemory()`；需要语义检索或自动捕获时再接 Supermemory 或自定义 provider。

## 使用文件记忆（Use file memory）

`fileMemory()` 为每个解析出的 scope 保存一份带索引的文档。文档在所选 backend 里，不在 Agent sandbox 文件系统里。Provider 在每个 turn 之前以及 compaction 之后召回这份文档，并给模型 `save_memory` 和 `remove_memory` 工具。

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

文件名创建 `profile` slot，所以工具暴露为 `profile__save_memory` 和 `profile__remove_memory`。Slot description 会加到两个工具描述前面，告诉模型这份 slot 该装什么。

文件记忆**不会**自动从对话抽取事实。模型自己决定何时调用 save / remove。条目拿到永久数字索引，provider 把文档作为一条稳定的 keyed message 召回，这样更新或清空后的文档会替换过期上下文。

Provider 会拒绝而不是截断或驱逐数据。`maxCharacters` 默认 4,000，限制的是完整召回消息（含标题和删除指引）。每条规范化条目最多 2,048 UTF-8 字节，整份存储文档最多 65,536 字节：

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

文件后端只改变 `fileMemory()` 把文档存在哪。它不改变文件记忆的召回行为或工具。需要语义检索、自动捕获或不同面向模型操作时，改实现 memory provider。

## 添加 memory slot

单个名为 `memory` 的 slot 写 `agent/memory.ts`；多个命名 slot 写 `agent/memory/<slot>.ts`。扁平文件和目录两种形式互斥：

```text
agent/
  memory/
    profile.ts
    workspace.ts
```

每个 slot 独立绑定 provider、description、scope、namespace 和可见性策略。同一个 provider 可以支撑多个 slot，而不会合并它们召回的上下文或工具。默认 namespace 包含 slot 名，所以即便 `profile` 和 `workspace` 解析到同一个 scope，也仍然分开。

例如 `profile.ts` 可以用 `fileMemory()` + `byPrincipal`，而 `workspace.ts` 用另一份 `fileMemory()` 实例加受信任的 workspace scope：

```ts title="agent/memory/workspace.ts"
import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";

export default defineMemory({
  description: "Remember shared conventions for the authenticated workspace.",
  provider: fileMemory(),
  scope(ctx) {
    const workspaceId = ctx.session.auth.current?.attributes.workspaceId;
    return typeof workspaceId === "string" ? workspaceId : null;
  },
});
```

## 选择作用域（Choose a scope）

`scope` 决定谁或什么共享这份记忆。可以是字符串、`null`，或返回字符串、字符串元组或 `null` 的 resolver。从受信任的认证或 channel metadata 解析租户和调用者身份，**永远不要**从模型输入读取：

```ts title="agent/memory/account.ts"
import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";

export default defineMemory({
  provider: fileMemory(),
  scope(ctx) {
    const caller = ctx.session.auth.current;
    const tenantId = caller?.attributes.tenantId;

    if (caller?.principalType !== "user" || typeof tenantId !== "string") {
      return null;
    }

    return [tenantId, caller.principalId];
  },
});
```

返回 `null` 会为这次操作禁用该 slot。eve 不会调用它的 namespace resolver、provider 或 tools，也永远不会回退到共享 scope。在 `eve dev` 中，诊断会点名被禁用的 slot 和返回 `null` 的 resolver，但不会记录解析值。

`byPrincipal` 使用 `auth.current`。它对匿名和 runtime principals 禁用 memory，并在本地开发返回共享的 `local-dev` scope。边界还需要租户、channel 或对话标识时，使用自定义 resolver。完整 scoped 设置见 [多租户记忆（Multi-tenant memory）](./patterns/multi-tenant-memory)。

eve 在调用 provider 之前校验并锁定 namespace 和 scope。每次 provider 操作都会收到：

- `memory.scope.key`：用于存储查找的版本化不透明 digest
- `memory.scope.namespace`：解析出的 namespace
- `memory.scope.value`：解析出的字符串或元组
- `memory.slot`：由路径派生的 slot 名

Provider **必须**把 `memory.scope.key` 当作每次读写的分区键。它保留元组边界，不会把原始 scope 组件持久化进 eve 的 durable attribution。

## 选择可见性（Choose visibility）

`visibility` 控制 slot 的 scope 变化后，eve 还会不会把先前召回的记录放进模型上下文。它不改变传给 provider 的 scope。

| 值 | Scope 变化后的行为 |
| --- | --- |
| `"scope"`（默认） | 隐藏该 slot 更早 scope 召回的记录 |
| `"session"` | 在当前 namespace 内保留更早召回的记录 |

只有当前 session 里可能出现的每个 scope 都属于同一受信任受众时，才用 `"session"`：

```ts
export default defineMemory({
  provider: fileMemory(),
  scope: byPrincipal,
  visibility: "session",
});
```

两种模式下 namespace 都是隔离边界。需要参与者之间硬隔离的应用必须用分开的 sessions；可见性无法撤回已经写进 assistant 回复的信息。

## 选择 namespace

Namespace 在应用 scope 之前分隔记忆域。省略 `namespace` 会使用 `defaultNamespace`，它包含 graph node 和 slot，以及部署感知的身份：

- 生产和其它 Vercel 环境使用 project 和 environment
- Preview 还会使用 branch 或 deployment identity
- 本地开发使用应用根目录的 digest，而不是原始路径

重新部署会保持同一个生产 namespace。Preview branches 不会意外共享记忆。需要显式域时设置字符串或 resolver：

```ts
export default defineMemory({
  namespace: "acme-support-v1",
  provider: fileMemory(),
  scope: byPrincipal,
});
```

自定义 namespace 是完整的；eve 不会再加隐藏后缀。返回 `null` 会禁用该 slot。Scope 先解析，所以被禁用的 scope 永远不会调用 namespace resolver。

## 构建自定义 provider

可用 provider 对不上你的存储或检索模型时，再写 provider。多数应用作者不需要这一层：一个 provider 包应暴露 `MemoryProvider` 或配置好的 factory，你把它传给 `defineMemory()`。

Provider 可以实现三块表面：

| 表面 | 职责 |
| --- | --- |
| `recall` | 在 turn 开始时、以及可选地在 compaction 之后返回相关消息 |
| `capture` | 在 turn settle 后或 compaction 前观察历史 |
| `tools` | 返回绑定到同一锁定 scope 的面向模型操作 |

下面每个 helper 在接到数据库或记忆服务 SDK 之前会故意抛错：

```ts title="agent/lib/semantic-memory-provider.ts"
import {
  defineMemoryProvider,
  type MemoryOperationContext,
  type MemoryRecallResult,
  type MemoryToolsContext,
  type MemoryToolSet,
} from "eve/memory";

async function recallFromYourService(_ctx: MemoryOperationContext): Promise<MemoryRecallResult> {
  throw new Error("Replace with retrieval from your memory service.");
}

async function captureWithYourService(_ctx: MemoryOperationContext): Promise<void> {
  throw new Error("Replace with capture into your memory service.");
}

async function createToolsForYourService(_ctx: MemoryToolsContext): Promise<MemoryToolSet | null> {
  throw new Error("Replace with tools backed by your memory service.");
}

export const semanticMemoryProvider = defineMemoryProvider({
  recall: {
    "turn.started": recallFromYourService,
    "compaction.completed": recallFromYourService,
  },
  capture: {
    "turn.completed": captureWithYourService,
    "compaction.requested": captureWithYourService,
  },
  tools: createToolsForYourService,
});
```

不需要的可选 handler 可以省略。例如 `fileMemory()` 实现 recall 和 tools，但没有自动 capture。替换 stubs 之后，像其它 provider 一样绑到 slot：

```ts title="agent/memory/profile.ts"
import { defineMemory } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";
import { semanticMemoryProvider } from "../lib/semantic-memory-provider";

export default defineMemory({
  provider: semanticMemoryProvider,
  scope: byPrincipal,
});
```

Provider tools 就是普通 `defineTool()` 值，所以 schemas、approvals 和 `toModelOutput` 都正常工作。eve 用 slot 名限定每个返回的 key，并让回调在进程重启或部署后仍可 replay。

## 召回行为（Recall behavior）

`recall["turn.started"]` 是必填的，在模型调用之前运行。`recall["compaction.completed"]` 可选，在 compaction checkpoint 之后运行。Handler 返回 `{ messages }`、`null` 或 `undefined`。每条召回项都会变成不受信任的 user-role message；provider 内容永远不会提升为 system instructions。

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

保持 provider 操作幂等，强制自己的大小和保留策略，并把召回内容当作用户控制的数据。

## 限制与覆盖

Namespaces、scope 组件和 provider item IDs 限制为 1,024 UTF-8 字节。Scope 元组最多 16 个非空组件；规范化 namespace 和 scope 输入合计最多 4,096 字节。Provider tool 名在加上 `<slot>__` 前缀后仍须满足普通 tool-name 语法。

应用自有的 `agent/tools/<slot>.ts` 会替换生成的 provider-tool wrapper；在那里导出 `disableTool()` 可以移除它。Extensions 不能贡献 memory slots，因为 scope 和生命周期所有权仍属于消费该能力的 Agent 或 subagent。

## 接下来读什么

- [多租户记忆（Multi-tenant memory）](./patterns/multi-tenant-memory)：按已认证租户和调用者隔离任意 provider
- [状态（State）](./concepts/state)：在单个 session 内保存 durable working data
- [默认 Harness](./concepts/default-harness)：理解 compaction 和上下文控制
- [动态能力（Dynamic capabilities）](./guides/dynamic-capabilities)：理解 provider tools 使用的普通 dynamic-tool 生命周期
