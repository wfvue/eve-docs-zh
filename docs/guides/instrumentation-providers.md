---
title: "Instrumentation Providers（实验性）"
description: "配置实验性的 instrumentation provider 布局：按文件拆分观测、控制输入输出捕获，并在导出前对 OpenTelemetry spans 做脱敏。"
---

# Instrumentation Providers（实验性）

官方原文：[Instrumentation Providers](https://eve.dev/docs/guides/instrumentation-providers)。

Instrumentation providers 把可观测性拆到 `agent/instrumentation/` 下的多个文件。每个文件可以处理 eve lifecycle events，或增加一个 OpenTelemetry destination，而不必接管整条 telemetry pipeline。

> **官方说明（experimental）：** 此 API 默认关闭，且可能不经弃用期直接变更。需要在 `agent.ts` 显式开启：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-sonnet-5",
  experimental: {
    instrumentationProviders: true,
  },
});
```

Provider 目录会**替换** `agent/instrumentation.ts`，两种布局不能同时使用。默认单文件 API 见 [可观测性](./instrumentation)。

## 添加 provider

文件名就是 provider slot。每个文件必须 default-export `defineInstrumentation(...)`、OpenTelemetry integration，或 `disableInstrumentation()`。

```text
agent/instrumentation/
  audit.ts       lifecycle event provider
  braintrust.ts  OpenTelemetry destination
  otel.ts        进程级 OpenTelemetry 设置
```

下面这个 provider 只记录 action 耗时与身份，不接收工具参数或结果：

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

`ctx.state` 是该 provider + 本次操作作用域下的 JSON 存储，能跨 durable suspension 存活，终端事件后释放。

## 控制输入与输出

每个 provider 有独立的 `tracePolicy`，决定是否收到事件，以及事件是否携带 input / output 内容。

```ts title="agent/instrumentation/audit.ts"
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  tracePolicy: ({ audience }) => ({
    emit: true,
    recordInputs: audience === "public",
    recordOutputs: audience === "public",
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

策略会收到 `agentName`、`audience`，以及可用时的 `channelType`。`audience` 为 `"public"`、`"private"` 或 `"unknown"`。

默认策略：对所有 audience 发出元数据；仅对 `public` 会话包含 inputs/outputs。也可显式返回：

| 决策 | 结果 |
| --- | --- |
| `false` 或 `{ emit: false }` | 本 provider 不参与该 trace |
| `true` | 按默认的 audience 感知内容规则发出 |
| `{ emit: true, recordInputs, recordOutputs }` | 按选定内容方向发出 |

Inputs 包括模型 prompts、工具参数、channel 输入和用户回复。Outputs 包括模型回复、工具结果、请求用户输入、provider 元数据和错误细节。事件类型上的内容字段是可选的，因为策略可能去掉它们。

一个 provider 的策略不影响其它 provider，也不影响 OpenTelemetry pipeline。策略抛错时，该 provider fail-closed。

## 在自定义 provider 里脱敏

Lifecycle events 是不可变快照。把需要的字段复制到目标专用 payload，再脱敏这份副本后再发送：

```ts
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  tracePolicy: () => ({
    emit: true,
    recordInputs: true,
    recordOutputs: false,
  }),
  events: {
    "action.started": async (event) => {
      await sendAuditRecord({
        id: event.idempotencyKey,
        input: redactApiKey(event.input),
        kind: event.kind,
        name: event.name,
      });
    },
  },
});
```

目标完全不需要某一侧内容时，优先用 `recordInputs: false` / `recordOutputs: false`；只有需要「部分字段」时才做字段级脱敏。

## 添加 OpenTelemetry destination

OpenTelemetry 配置分两部分：

- `otel()`：进程级设置（resource、sampler、propagators、trace capture policy），最多声明一次。
- `otelIntegration()`：增加一个 destination，每个 exporter / processor chain 一个文件。

多数 Agent 只需要 destination：

```ts title="agent/instrumentation/braintrust.ts"
import { BraintrustExporter } from "@braintrust/otel";
import { otelIntegration } from "eve/instrumentation/otel";

export default otelIntegration({
  traceExporter: new BraintrustExporter({ filterAISpans: true }),
});
```

需要进程级设置或控制写入 OTel spans 的内容时，再加 `agent/instrumentation/otel.ts`：

```ts title="agent/instrumentation/otel.ts"
import { otel } from "eve/instrumentation/otel";

export default otel({
  resource: { "deployment.environment": process.env.VERCEL_ENV ?? "development" },
  tracePolicy: ({ audience }) => ({
    emit: true,
    recordInputs: audience === "public",
    recordOutputs: audience === "public",
  }),
});
```

OTel 的 `tracePolicy` 是其 destinations 的捕获上限：destination 无法恢复被该策略排除的内容。它不影响 `defineInstrumentation()` 生命周期 providers。

## 对托管 OTel destinations 脱敏

`localTraces()` 和 `agentRuns()` 接受 `exportPolicy`。用内置 redactors 在 destination 的 processors 收到 span 前移除已知 input/output attributes：

```ts title="agent/instrumentation/agent-runs.ts"
import {
  agentRuns,
  composeSpanExportPolicies,
  redactSpanInputs,
  redactSpanOutputs,
} from "eve/instrumentation/otel";

export default agentRuns({
  exportPolicy: composeSpanExportPolicies(
    redactSpanInputs(({ audience }) => audience !== "public"),
    redactSpanOutputs(({ audience }) => audience !== "public"),
    {
      attribute: ({ key }) =>
        key === "user.email" ? { action: "replace", value: "[redacted]" } : { action: "keep" },
    },
  ),
});
```

`redactSpanInputs()` 去掉已知 prompts、instructions、documents、工具参数；`redactSpanOutputs()` 去掉已知 responses、reasoning、工具结果、异常细节等。策略按声明顺序执行，只作用于该 destination。

`localTraces()` / `agentRuns()` 仍接受 `recordInputs` / `recordOutputs`，但已弃用——请改用 `exportPolicy` 里的 redactors。

`otelIntegration()` 不接受 `exportPolicy`：用进程级 `otel({ tracePolicy })`，或提供会在 exporter 前过滤的 destination-specific `SpanProcessor`。

## 内置 slots

Provider 布局有两个环境相关默认：

- `local`：`eve dev` 期间记录本地 traces
- `agent-runs`：生产环境导出到 Vercel Agent Runs

省略这些文件会保留默认。从匹配文件导出 `localTraces()` / `agentRuns()` 可重配置；显式禁用：

```ts title="agent/instrumentation/local.ts"
import { disableInstrumentation } from "eve/instrumentation";

export default disableInstrumentation();
```

## Lifecycle events

Providers 可处理 session、channel delivery、turn、model attempt、model call、action、input request、tool call 等事件。Start 与 terminal 事件共享 `idempotencyKey`，可作 destination 行 ID。

普通工具会同时发出 `action.*` 和 `tool.call.*`。用 `action.*` 看 eve 的 durable dispatch（tools、skills、subagents、remote agents）；只有需要 AI SDK 进程内工具边界时才用 `tool.call.*`。

不同 provider 的 handlers 并发运行且故障隔离，不要依赖执行顺序。用 `flush` 排空缓冲，用 `shutdown` 释放资源。

## 项目建议

- 生产落地前先评估 destination 的数据保留与合规要求。
- 公开渠道与私聊的 audience 差异很大：默认「仅 public 带内容」通常更稳妥。
- 需要细粒度脱敏时，优先 `exportPolicy` / 字段级 redact，而不是把整段英文 prompts 原样落盘。

## 接下来读什么

- [可观测性](./instrumentation)：默认 `instrumentation.ts` API 与 trace 层级
- [本地开发](./dev-tui)：在 TUI 里查看本地 traces
- [Hooks](./hooks)：在 instrumentation provider API 之外响应 runtime 事件
