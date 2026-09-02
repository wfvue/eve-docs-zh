---
title: "文件记忆（File Memory）"
description: "配置内置 fileMemory()：每个 scope 一份由模型维护的有限文档，带 save / remove 工具。"
---

# 文件记忆（File Memory）

`eve/memory/file` 的 `fileMemory()` 是 eve 内置的 memory provider。它为每个解析出的 scope 保留一份小文档，在每个 turn 前以及 compaction 后召回，并给模型两个维护工具。适合「一小份 durable 事实和偏好就够」的场景；需要语义检索或自动捕获时，换 [其它 provider](./overview#选择-provider)。

官方原文：[File Memory](https://eve.dev/docs/memory/file)。

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

## 行为说明

Provider 实现 recall 和 tools，**没有**自动 capture。模型决定何时调用 `profile__save_memory` 和 `profile__remove_memory`（这里 `profile` 是 slot 名）。Slot 的 `description` 会加到两个工具描述前面。

每条保存的条目拿到永久数字索引，模型之后用它删除。Provider 把整份文档作为一条带稳定 ID 的消息召回，所以更新或清空后的文档会**替换**先前召回的副本，而不是堆在旁边。

超出限制的写入会被拒绝，而不是截断或驱逐旧条目：

| 限制 | 值 |
| --- | --- |
| 召回消息 | `maxCharacters`，默认 4,000 |
| 单条条目 | 空白规范化后 2,048 UTF-8 字节 |
| 存储文档 | 65,536 字节 |

`maxCharacters` 限制的是完整召回消息（含标题和删除指引）：

```ts
provider: fileMemory({ maxCharacters: 8_000 });
```

保存与已有条目完全相同的文本是 no-op。对同一文档的并发写入使用乐观版本，冲突时重试。

## 存储后端

文档存在 backend 里，**不**在 Agent sandbox 文件系统。不传 `backend` 时，`fileMemory()` 在首次使用时惰性选择：

| 环境 | 后端 |
| --- | --- |
| 带 Blob 凭据的 Vercel（token，或带 OIDC 的 attached store） | Private Vercel Blob |
| 没有 Blob 配置的 Vercel | 报错，要求 attach Blob store |
| `eve dev` | 进程内共享的 in-memory storage |
| 其它环境 | 报错，要求显式 backend |

仅设置 `NODE_ENV=development` **不会**选择 in-memory；Vercel 之外的 Blob token 也**不会**选择 Blob。

### In-memory

测试或一次性环境传入全新的 in-memory backend。backend 实例或进程被替换时内容会丢失：

```ts
import { fileMemory, inMemory } from "eve/memory/file";

provider: fileMemory({ backend: inMemory() });
```

### Vercel Blob

需要显式配置凭据或 object prefix、而不是靠环境探测时，用 `eve/memory/file/vercel` 的 `vercelBlob()`：

```ts
import { fileMemory } from "eve/memory/file";
import { vercelBlob } from "eve/memory/file/vercel";

provider: fileMemory({
  backend: vercelBlob({ prefix: "eve/memory/support-agent" }),
});
```

`vercelBlob()` 接受 `token`、`oidcToken`、`storeId`、`prefix`。默认 prefix 是 `eve/memory/file`；文档以 private 形式存在 `<prefix>/<scope key>/MEMORY.md`。

### 自定义 backend

实现 `eve/memory/file` 的 `MemoryDocumentBackend`，把文档放到别的 store：

```ts
import { MemoryDocumentConflictError, type MemoryDocumentBackend } from "eve/memory/file";

export function kvBackend(store: KvStore): MemoryDocumentBackend {
  return {
    async read({ key }) {
      const row = await store.get(key);
      return row ? { content: row.content, version: row.version } : null;
    },
    async write({ key, content, expectedVersion }) {
      const ok = await store.compareAndSet(key, content, expectedVersion);
      if (!ok) throw new MemoryDocumentConflictError(key);
      return { content, version: await store.version(key) };
    },
  };
}
```

`write()` 必须替换完整文档，并在 `expectedVersion` 不再匹配时抛出 `MemoryDocumentConflictError`。`expectedVersion` 为 `null` 表示文档尚不存在。

Backend **只**改变文档存在哪，不改变文件记忆的召回格式或工具。需要不同的检索、捕获或工具时，请 [构建 Memory Provider](./custom-provider)。
