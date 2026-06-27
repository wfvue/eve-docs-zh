---
title: "钩子（Hooks）"
description: "从 agent/hooks/ 订阅 runtime stream events。"
---

# 钩子（Hooks）

Hooks 是 Eve 给 runtime event stream 预留的 authored extension points。一个 hook 会订阅 stream events，并在每个事件被 durable 记录之后执行副作用，例如审计日志、指标和告警，或把每个 session 和 message 持久化到你自己的数据库用于分析。

当你只是想观察 Agent 做了什么，而不是新增一个工具、context provider 或 channel adapter handler 时，就应该使用 hook。Channel adapter handler 是 channel adapter 上定义的 handler，见 [渠道（Channels）](../../channels)。

## 定义一个 hook（Define a hook）

```ts title="agent/hooks/audit.ts"
import { defineHook } from "eve/hooks";

export default defineHook({
  events: {
    async "session.started"(_event, ctx) {
      console.info("session started", { sessionId: ctx.session.id });
    },
    async "message.completed"(event) {
      console.info("model finished", { length: event.data.message?.length ?? 0 });
    },
  },
});
```

Hook 的 slug 来自相对路径 basename：`agent/hooks/audit.ts` 是 `"audit"`，`agent/hooks/auth/load-profile.ts` 是 `"auth/load-profile"`。

`defineHook`、`HookDefinition` 和 `HookContext` 都从 `eve/hooks` 导出。

一个 hook 文件在 `events` map 中声明 stream-event subscribers，key 是 event type，`*` 会匹配所有事件。可以订阅 [Sessions, runs and streaming](../../concepts/sessions-runs-and-streaming) 中记录的任意 runtime stream vocabulary，包括 `session.started`、`turn.completed`、`message.completed` 和 `action.result` 等 lifecycle events。Handlers 只用于观察，不能注入模型上下文。要给 runtime model messages 提供内容，请在 `agent/instructions/` 中使用 `defineDynamic` 和 `defineInstructions`。

## Hook 结构和上下文（Hook structure and context）

每个 handler 都会收到同一个 `HookContext`：

```ts
interface HookContext {
  readonly agent: { readonly name: string; readonly nodeId?: string };
  readonly channel: { readonly kind?: string; readonly continuationToken?: string };
  readonly session: { readonly id: string };
}
```

### 收窄工具结果（Narrowing tool results）

`toolResultFrom` 可以把 `action.result` event 收窄为某个 authored tool 或 MCP connection，并返回 typed output。它从 `eve/tools` 导入：

```ts
import { defineHook } from "eve/hooks";
import { toolResultFrom } from "eve/tools";
import getWeather from "../tools/get-weather";
import linear from "../connections/linear";

export default defineHook({
  events: {
    "action.result"(event) {
      // Authored tool: output 会被推断为该工具的返回类型
      const weather = toolResultFrom(event.data.result, getWeather);
      if (weather) {
        console.log(weather.output.temperature);
      }

      // MCP connection: output 是 unknown，toolName 是 qualified
      const linearResult = toolResultFrom(event.data.result, linear);
      if (linearResult) {
        console.log(linearResult.connectionToolName, linearResult.output);
      }
    },
  },
});
```

当 result 不匹配，或 `isError` 为 `true` 时返回 `undefined`。对于 authored tools，返回值包含 `{ output, toolName, callId }`，其中 `output` 是该 tool 的 `TOutput`。对于 connections，返回值包含 `{ output, toolName, connectionToolName, callId }`，其中 `output` 是 `unknown`。

## 执行顺序（Execution order）

一个 stream event 触发时，会按以下顺序执行：

1. **Emit**。Channel adapter handler 运行，然后 event 被写入 durable stream。
2. **Hooks**。Stream-event hooks 触发，先运行 typed handlers，再运行 `*` wildcard。返回值会被忽略。
3. **Dynamic tool resolvers**。订阅该 event type 的 resolvers 运行并更新 tool set。

Hooks 总是在 event 已经 durable 记录之后运行。因此，即使 hook 抛错，stream 本身仍保持一致。

## Hook 抛错会怎样（What happens when a hook throws）

抛错的 handler 会沿 emit composer 传播，并表现为 `turn.failed`。如果订阅 failure-cascade event 的 hook 自己也抛错，会升级为 `session.failed`。如果需要更稳妥的语义，请在 hook 内部用 `try` / `catch` 包住逻辑。Eve 会把抛错的 hook 视为真实失败。

## 子智能体隔离（Subagent isolation）

子智能体可以拥有自己的 `agent/hooks/` 目录。子智能体 hooks 只在子智能体 scope 内触发。父 Agent hooks 不会监听子智能体 turn，子智能体 hooks 也只能看到自己的上下文。

## Hook、工具和 Provider 的区别（Hook vs tool vs provider）

| 需求 | 使用 |
| --- | --- |
| 观察 runtime events，例如 audit、metrics、alerting | `events.<type>`，或 channel adapter handler |
| 按需给模型提供结构化输入 | tool |
| 让一个值在整个 step 中可用 | context provider |
| 订阅平台特定事件 | channel adapter handler |

Stream-event hooks 和 channel adapter event handlers 在结构上相同。当你写的是 adapter-specific 行为时，选择 channel adapter handler；当你写的是 agent-level 行为，并希望它跨所有 channels 触发时，选择 `events.*`。两者同时注册时都会触发。

## 接下来读什么（What to read next）

- [工具（Tools）](../../tools)
- [上下文控制（Context control）](../../concepts/context-control)
- [Session context](../../reference/typescript-api)
- [Sessions, runs and streaming](../../concepts/sessions-runs-and-streaming)
