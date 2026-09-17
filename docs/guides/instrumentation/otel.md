---
title: "OpenTelemetry"
description: "在 Instrumentation Providers 布局下配置 OpenTelemetry destinations、内容捕获与托管导出。"
---

# OpenTelemetry

官方原文：[OpenTelemetry](https://eve.dev/docs/observability/otel)。

> **官方说明（experimental / beta）：** 本 API 实验性，可能无弃用期就变更。本页要求启用实验性 [Instrumentation Providers](./providers) 布局。

用 `eve/instrumentation/otel` 的内置 API 配置 eve 的 OpenTelemetry pipeline。

## 配置 OpenTelemetry（Configure OpenTelemetry）

配置分两部分：

- `otel()`：进程级设置（resource、sampler、propagators、trace capture policy）；最多声明一次
- `otelIntegration()`：增加一个 destination；每个 exporter / processor 链一个文件

需要进程级设置或控制写入 OTel spans 的内容时，添加 `agent/instrumentation/otel.ts`：

```ts title="agent/instrumentation/otel.ts"
import { otel } from "eve/instrumentation/otel";

export default otel({
  resource: { "deployment.environment": process.env.VERCEL_ENV ?? "development" },
  tracePolicy: ({ audience, environment }) => ({
    emit: true,
    recordInputs: audience === "public" || environment === "development",
    recordOutputs: audience === "public" || environment === "development",
  }),
});
```

OpenTelemetry 的 `tracePolicy` 是所有 OTel destinations 共享的捕获上限；destination **不能**恢复被该策略排除的内容。它不影响用 `defineInstrumentation()` 写的 lifecycle-event providers。Channel 如何把对话分类并交给该策略，见 [Audience](../../channels/overview#audience)。

## 添加 destination（Add an OpenTelemetry destination）

多数 Agent 只需 destination：

```ts title="agent/instrumentation/braintrust.ts"
import { BraintrustExporter } from "@braintrust/otel";
import { otelIntegration } from "eve/instrumentation/otel";

export default otelIntegration({
  traceExporter: new BraintrustExporter({ filterAISpans: true }),
});
```

需要过滤或变换时，向 `otelIntegration()` 传 `spanProcessors`。`exportPolicy` 用于下面的内置 `localTraces()` / `agentRuns()`。

## Trace 拓扑（Trace topology）

普通 agent turn 大致为：

```text
invoke_agent <agent>
  └── agent.step
        ├── chat <model>
        └── agent.action
              └── execute_tool <tool>
```

每个 turn 开新 trace。首次子智能体 trace 用 `eve.link.type=agent.dispatch` 链到 caller；该 link **不是**授权许可。远程 Agent 上，`trustedForwarders` 让接收方接受发送方的 session lineage 与 trace 内容策略。见[远程 Agent](../remote-agents#preserving-trace-content)。用 `gen_ai.conversation.id` 在 destination 的 span 搜索里找同对话的 traces。

## 管理内置 destinations（Manage built-in destinations）

Provider 布局有两个环境相关默认：

- `local`：`eve dev` 期间记本地 traces
- `agent-runs`：在 preview / production 导出到 Vercel Agent Runs

省略这些文件即保留默认。要重配，从对应文件 export `localTraces()` 或 `agentRuns()`。要显式关闭：

```ts title="agent/instrumentation/local.ts"
import { disableInstrumentation } from "eve/instrumentation";

export default disableInstrumentation();
```

## 过滤托管 destination（Filter a managed destination）

`localTraces()` / `agentRuns()` 接受 `exportPolicy`，在该 destination 的 processors 收到之前过滤 spans / attributes：

```ts title="agent/instrumentation/agent-runs.ts"
import { agentRuns } from "eve/instrumentation/otel";

export default agentRuns({
  exportPolicy: {
    span: ({ name }) => name !== "internal.cache.refresh",
    attribute: ({ key }) =>
      key === "customer.id" ? { action: "drop" } : { action: "keep" },
  },
});
```

`span` 返回 `false` 则本 destination 省略该 span；`attribute` 可 `keep` / `drop` / `replace`。

### 进一步收窄内置 destination

在进程级 `otel({ tracePolicy })` 已准入之后，可用内容 redactors 再收窄。例如 Agent Runs 保留 spans，但除非 session 为 public，否则脱敏 inputs / outputs：

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
  ),
});
```

`redactSpanInputs()` / `redactSpanOutputs()` 只收窄**本** destination，不改写发往其它 destination 的 spans。

## 接下来读什么

- [Instrumentation Providers](./providers)
- [Instrumentation](./overview)：单文件 API
- [本地开发（Dev TUI）](../dev-tui)
