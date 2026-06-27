---
title: "会话上下文（Session Context）"
description: "Runtime helpers：ctx.session、ctx.getSandbox、ctx.getSkill 和 defineState。"
---

# 会话上下文（Session Context）

Eve 通过传给 tool `execute`、hook handlers、channel event handlers、connection auth/header resolvers 的 `ctx` 参数暴露 runtime state：

- `ctx.session`：session metadata、turn、auth 和 parent lineage。
- `ctx.getSandbox()`：当前 Agent 的 live sandbox handle。
- `ctx.getSkill(identifier)`：当前 Agent 可见的 named skill handle。
- `defineState(name, initial)`：带 `get()` / `update()` 的 typed durable state，从 `eve/context` 导入。

这些 API 只在 active authored runtime execution 中可用，包括 tools、channel event handlers 和 authored hooks。它们在 managed context 之外调用会抛错。

## `ctx.session`

`ctx.session` 暴露当前执行的 durable runtime metadata。

```ts title="agent/tools/who_called_me.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Return the active session metadata.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    return {
      sessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
      turnSequence: ctx.session.turn.sequence,
      currentCaller: ctx.session.auth.current?.principalId,
      initiator: ctx.session.auth.initiator?.principalId,
      parentSessionId: ctx.session.parent?.sessionId,
      parentCallId: ctx.session.parent?.callId,
    };
  },
});
```

Public session fields：

- `auth.current`
- `auth.initiator`
- `id`
- `turn.id`
- `turn.sequence`
- optional `parent`

行为：

- `auth.current` 是当前 inbound turn 的 caller。
- `auth.initiator` 是启动 durable session 的 caller。
- 未保护的 Agent 会把二者暴露为 `null`。
- Top-level schedule sessions 会暴露 framework app principal：`principalId: "eve:app"`，`principalType: "runtime"`。
- `parent` 存在于 child subagent sessions 中，包含 parent `callId`、`sessionId`、`rootSessionId` 和 `turn`。

## `ctx.getSandbox()`

`ctx.getSandbox()` 返回当前 Agent sandbox 的 live handle。

```ts
const sandbox = await ctx.getSandbox();
const result = await sandbox.run({ command: "npm test" });
```

行为：

- 不接收参数。每个 Agent 正好有一个 sandbox。
- 它是 async，因为 Eve 会懒绑定或恢复 sandbox state。
- 只有当 active runtime path 附加了 sandbox access 时才可用。
- Visibility 是 node-local。子智能体看到自己的 sandbox，而不是父 Agent 的 sandbox。

`SandboxSession` 还暴露 `resolvePath(path)`，会把逻辑 `/workspace/...` 位置解析为 live backend-native path。 authored code 需要在传给 shell 或 child process 之前拿到真实路径时使用它。

Lifecycle 细节见 [沙盒（Sandbox）](../../sandbox)。

## `ctx.getSkill(identifier)`

`ctx.getSkill(identifier)` 返回当前 Agent 可见的 named skill handle。

```ts
const skill = ctx.getSkill("research");
const notes = await skill.file("references/checklist.md").text();
```

行为：

- 它是同步的。文件内容会从 active sandbox 懒读取。
- 只有当 active runtime path 附加了 sandbox access 时才可用。
- `identifier` 是 path-derived skill id。
- Visibility 跟随当前 Agent 的 sandbox。
- 缺失 skill 会在 file accessor 读取 missing sandbox path 时暴露。
- 返回的 handle 暴露 `name` 和 `file(relativePath)`。

完整 authoring model 见 [技能（Skills）](../../skills)。

## 使用 `defineState` 自定义状态（Custom state with `defineState`）

当 Agent 需要 tools、hooks 和 channel handlers 共享 durable typed state 时，使用 `defineState`。State 会跨 workflow step boundaries 保留。把 handle 声明在 module scope，让所有 importer 共享它：

```ts title="agent/lib/budget.ts"
import { defineState } from "eve/context";

interface BudgetState {
  readonly count: number;
  readonly cap: number;
}

export const budget = defineState<BudgetState>("myapp.budget", () => ({
  count: 0,
  cap: 25,
}));
```

`get()` 读取当前值，首次访问时返回 `initial()`；`update(fn)` 对当前值应用一个函数。二者都只能在 managed scope 中调用。完整读写模型和工具、hook 示例见 [状态（State）](../state)。

## 这些 API 在哪里可用（Where these APIs work）

安全位置：

- `defineTool(...).execute(input, ctx)` 内部。
- connection `auth: (ctx) => provider` 和 `headers: (ctx) => values` resolvers 内部。
- Eve 在 runtime 中执行的 authored callbacks 内部。
- 同一个 authored execution chain 的异步边界之后。

不安全位置：

- top-level module evaluation。
- build scripts。
- discovery-time code paths。

在 active Eve runtime context 之外调用时，它们会立即抛错，并在消息里说明所需 scope。

## 工作原理（How it works）

Framework 会在调用 authored code 之前设置 context container：

1. Runtime 填入 durable seed values，例如 auth、session id 和 compiled bundle。
2. 每个 step 之前，framework 会从 durable state 派生 step-local values，例如 session metadata、sandbox access 和 skill access。
3. Authored code 在 managed scope 内运行，因此 `ctx` 和 `defineState` accessors 可以自动解析。
4. Step 结束后，framework 会把 mutable state，例如 sandbox changes，提交回 durable session。

Framework 负责管理这个 lifecycle。Authored code 只需要使用 `ctx` 和 public accessors。

## 接下来读什么（What to read next）

- [状态（State）](../state)
- [Sessions, runs & streaming](../../concepts/sessions-runs-and-streaming)
- [子智能体（Subagents）](../../subagents)
- [技能（Skills）](../../skills)
