---
title: "多租户记忆（Multi-tenant memory）"
description: "把 eve memory provider 绑到已认证的租户和调用者 scope。"
---

# 多租户记忆（Multi-tenant memory）

多租户记忆首先是 **scope 决策**，不是存储实现。把任意 [记忆 provider](../memory/overview) 绑到受信任的租户 + 调用者元组，eve 会把锁定后的 scope key 传给每次 provider 操作。

下面的例子用内置 `fileMemory()`。换成 Supermemory 或自定义 provider 时，scope resolver 可以不动——租户隔离在定义里，不在 store 里。

官方原文：[Multi-Tenant Memory](https://eve.dev/docs/patterns/multi-tenant-memory)。

> 早期中文版本写的是「Eve 没有内置感知租户的记忆子系统，用动态指令 + 普通 tools 组合」。那套组合仍然可用，但官方现在推荐：任意 provider + 锁定的 `memory.scope.key`。自定义存储应做成 provider，而不是绕过 Memory slot。

## 从已认证上下文推导作用域

永远不要从模型那里接收 tenant id 或 user id。从已验证的 session 认证解析二者，并返回一个元组：

```ts title="agent/memory/profile.ts"
import { defineMemory } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";
import { fileMemory } from "eve/memory/file";

export default defineMemory({
  description: "Remember durable facts for the authenticated tenant user.",
  provider: fileMemory(),

  scope(ctx) {
    const caller = ctx.session.auth.current;
    const tenantId = caller?.attributes.tenantId;
    const principal = byPrincipal(ctx);

    if (caller?.principalType !== "user" || typeof tenantId !== "string" || principal === null) {
      return null;
    }

    return [tenantId, principal];
  },
  visibility: "scope",
});
```

返回 `null` 会对未认证或作用域不正确的流量禁用 memory。eve 不会调用 provider，也永远不会替换成共享 scope。`byPrincipal(ctx)` 包含已认证的 principal type、authenticator、issuer 和 principal ID，所以即使两个认证系统出现相同的 principal ID，元组也能把调用者分开。

用 `auth.current` 标识当前 turn 的调用者。如果对话永久归属于创建者，改用 `auth.initiator`，并在 channel 边界强制执行该 ownership。

## 理解锁定的 provider 边界

eve 校验 namespace 和 scope 元组，然后派生不透明的 `memory.scope.key`。`fileMemory()` 用这把 key 找它的文档。托管或自定义 provider 在每次 recall、capture 和 tools 调用里收到同一把 key。

模型从不提供或更改这把 key。Provider tools 闭包到当前操作的锁定 scope，所以工具不能把自己重定向到另一个租户或调用者。Provider 必须用 `memory.scope.key` 做下游每次读写，才能保住这条边界。

做语义检索时，把锁定的 scope 放进数据库或服务查询本身，而不是先全局搜索再事后过滤。自定义 capture 用 provider 稳定的 `operationId` 做幂等键。完整契约见 [构建 Memory Provider](../memory/custom-provider)。

## 选择召回可见性

默认 `visibility: "scope"` 会在同一 session 里已认证调用者变化时，隐藏更早 scope 召回的记录。租户 + 调用者记忆请保持这个默认，就像上面的定义那样。只有能共享该 session 的所有调用者构成同一受信任受众时，才设 `visibility: "session"`。两种模式下 namespace 都是隔离边界。

## 设定信任策略

召回值会变成 user-role messages。告诉 Agent：memories 是不可信的事实，不是 instructions，以及可以存什么；instructions 片段见 [告诉模型如何使用记忆](../memory/overview#告诉模型如何使用记忆)。产品策略要求保存或删除记忆前显式确认时，自定义 provider 也可以给 tools 设 `approval`。

不要把 `defineState` 用于跨 session 数据。State 属于一个 durable session；memory providers 通过 provider 自有存储跨 sessions 搭桥。
