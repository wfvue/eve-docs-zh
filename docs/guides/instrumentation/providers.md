---
title: "Instrumentation Providers"
description: "配置实验性 instrumentation providers、处理 lifecycle events，并控制每个 provider 收到的内容。"
---

# Instrumentation Providers

官方原文：[Instrumentation Providers](https://eve.dev/docs/observability/instrumentation-providers)。

> **官方说明（experimental / beta）：** 本 API 实验性，可能无弃用期就变更。

Instrumentation providers 把可观测性拆到 `agent/instrumentation/` 下的多个文件。每个 provider 处理 eve lifecycle events，但不拥有整条 telemetry pipeline。OpenTelemetry destinations 用内置 [OpenTelemetry APIs](./otel) 配置。

在 `agent.ts` 里显式开启：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-sonnet-5",
  experimental: {
    instrumentationProviders: true,
  },
});
```

Provider 目录会**替换** `agent/instrumentation.ts`，二者不能同用。单文件 API 见 [Instrumentation](./overview)。

## 添加 provider（Add a provider）

文件名标识 provider 槽位。Lifecycle-event provider 必须 default-export `defineInstrumentation(...)` 或 `disableInstrumentation()`。OTel 声明见 [OpenTelemetry](./otel)。

```text
agent/instrumentation/
  audit.ts  lifecycle event provider
```

示例：只记动作耗时与身份，不收工具参数 / 结果：

```ts title="agent/instrumentation/audit.ts"
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  events: {
    "action.started": (event, ctx) => {
      ctx.state.set({ name: event.name, startedAt: Date.now() });
    },
    "action.completed": (event, ctx) => {
      const started = ctx.state.get() as { name: string; startedAt: number } | undefined;
      if (started === undefined) return;

      console.log({
        action: started.name,
        durationMs: Date.now() - started.startedAt,
        outcome: event.outcome,
      });
    },
  },
});
```

`ctx.state` 是 scoped 到该 provider 与本次 operation 的 JSON 存储，能扛过 durable 挂起，终端事件后释放。

## 控制 inputs / outputs（Control inputs and outputs）

每个 provider 有独立的 `tracePolicy`，决定是否采样该 trace，以及事件是否含 input / output 内容：

```ts title="agent/instrumentation/audit.ts"
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  tracePolicy: ({ audience, environment }) => ({
    emit: true,
    recordInputs: audience === "public" || environment === "development",
    recordOutputs: audience === "public" || environment === "development",
  }),
  events: {
    "model.call.started": (event) => {
      console.log("input", event.input);
    },
    "model.call.completed": (event) => {
      console.log("output", event.content);
    },
  },
});
```

函数收到 `agentName`、`channel`、`audience`、`mode`、`environment`、`principalType`。`audience` 为 `public` / `private` / `unknown`；`environment` 为 `development` / `preview` / `production`。

无策略或返回 `true` 时，eve 给该 provider 发元数据；内容默认：

| Environment | Audience | Content |
| --- | --- | --- |
| Development | 任意 | Inputs 与 outputs |
| Preview / production | `public` | Inputs 与 outputs |
| Preview / production | `private` 或 `unknown` | 仅元数据 |

返回 `{ emit: false }` 跳过采样；返回 `{ emit: true, recordInputs, recordOutputs }` 显式选择两个方向。省略的内容字段对 handler 不可用。

Channel 在创建 session 时一次性指定 audience；它控制**内容捕获**，不是访问权。`public` / `private` / `unknown` 如何派生见 [Audience](../../channels/overview#audience)。

## 在自定义 provider 里脱敏（Redact）

Lifecycle events 是不可变快照。把需要的字段拷到 destination 专用 payload，再脱敏后发送。优先用 `recordInputs: false` / `recordOutputs: false` 整向省略；只有 destination 需要部分内容时才做字段级脱敏。

## Lifecycle events

Providers 可处理 session、channel delivery、turn、model attempt / call、action、input request、tool call 等事件。开始与终端事件共享 `idempotencyKey`，可用作 destination 行 ID。

普通工具会同时发 `action.*` 与 `tool.call.*`：用 `action.*` 看 eve 的 durable dispatch 生命周期（含 tools / skills / subagents / remote）；只有需要 AI SDK 进程内工具边界时才用 `tool.call.*`。

不同 provider 的 handlers **并发**且失败隔离，不要依赖执行顺序。用 `flush` 排空缓冲，用 `shutdown` 释放资源。

## 接下来读什么

- [Instrumentation](./overview)：单文件 API
- [OpenTelemetry](./otel)：OTel destinations 与托管导出
- [本地开发（Dev TUI）](../dev-tui)：在 TUI 里看本地 traces
- [Hooks](../hooks)：在 instrumentation provider API 之外响应 runtime 事件
