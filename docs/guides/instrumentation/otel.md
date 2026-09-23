---
title: "OpenTelemetry"
description: "配置 OpenTelemetry destinations、内容捕获与第三方导出。"
---

# OpenTelemetry

官方原文：[OpenTelemetry](https://eve.dev/docs/observability/otel)（公开 URL `/docs/observability/otel`）。

`eve dev` **自动**记录本地 traces。用这个默认项时，不需要写 `otel()` 或 `localTraces()`。

> **官方说明：** 上游已移除「Vercel Agent Runs」默认导出与 `agentRuns()` 文档引导；预览 / 生产可观测性请用 `otel()` / `otelIntegration()` 与第三方 destinations。

## 配置 OpenTelemetry

`otel()` 与 `otelIntegration()` 都是可选的：

- 需要进程级设置（resource、sampler、propagators 或 trace 捕获策略）时才用 `otel()`；最多声明一次。
- 添加第三方 OpenTelemetry destination 时才用 `otelIntegration()`；每个 exporter / processor 链一个文件。

需要进程级设置、或要控制 eve 写进 OTel span 的内容时，添加 `agent/instrumentation/otel.ts`：

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

OpenTelemetry 的 `tracePolicy` 是所有 OTel destination 共享的捕获上限。某个 destination **不能**恢复被该策略排除的内容。它不影响用 `defineInstrumentation()` 创建的生命周期 instrumentation。渠道如何把对话分给该策略，见 [Audience](../../channels/overview#audience)。

## 添加 OpenTelemetry destination

把 traces 发到第三方 destination 时用本节。使用 `@vercel/otel` 的 exporter 前先安装：

```bash
pnpm add @vercel/otel
```

```ts title="agent/instrumentation/honeycomb.ts"
import { OTLPHttpProtoTraceExporter } from "@vercel/otel";
import { otelIntegration } from "eve/instrumentation/otel";

export default otelIntegration({
  exportPolicy: {
    span: () => ({ redact: true, inputs: true, outputs: true }),
  },
  traceExporter: new OTLPHttpProtoTraceExporter({
    url: "https://api.honeycomb.io/v1/traces",
    headers: {
      "x-honeycomb-team": process.env.HONEYCOMB_API_KEY!,
    },
  }),
});
```

自定义 destination 需要过滤或变换时，把 `spanProcessors` 传给 `otelIntegration()`。上例的 `exportPolicy` 保留 span metadata，同时从该 destination 去掉 inputs / outputs。

## 添加 runtime context

用 `runtimeContext` 给每次模型尝试的 AI SDK spans 加 JSON 值。需要类型化渠道元数据时，导入渠道定义并用 `isChannel` 收窄：

```ts title="agent/instrumentation/support.ts"
import { isChannel } from "eve/instrumentation";
import { otelIntegration } from "eve/instrumentation/otel";

import supportChannel from "../channels/support";

export default otelIntegration({
  runtimeContext(input) {
    if (!isChannel(input.channel, supportChannel)) return undefined;

    return {
      "support.channel_id": input.channel.metadata.channelId ?? "",
      "support.user_id": input.channel.metadata.triggeringUserId ?? "",
    };
  },
});
```

resolver 收到 channel、session、最终模型输入、step 与 turn。以 `eve.` 开头的 key 保留。被 `otel({ tracePolicy })` 排除的内容对 resolver 不可用。

## Trace 拓扑

普通 agent turn 在 OpenTelemetry destination 上的拓扑大致是：

```text
invoke_agent <agent>
  └── agent.step
        ├── chat <model>
        └── agent.action
              └── execute_tool <tool>
```

每个 turn 开新 trace。第一个子智能体 trace 用 `eve.link.type=agent.dispatch` 链到调用方；该 link **不是**授权。远程 Agent 上，`trustedForwarders` 让接收方接受发送方的 session lineage 与 trace-content 策略。见 [远程 Agent](../remote-agents#preserving-trace-content)。在 destination 的 span 搜索面用 `gen_ai.conversation.id` 找同一次对话的 traces。

## 本地 traces

`eve dev` 默认记录本地 traces。省略 `agent/instrumentation/local.ts` 即保留该默认。从该文件导出 `localTraces(...)` 可重配，或显式关闭：

```ts title="agent/instrumentation/local.ts"
import { disableInstrumentation } from "eve/instrumentation";

export default disableInstrumentation();
```

## 过滤 destination

`otelIntegration()` 与 `localTraces()` 接受一个 `exportPolicy` 对象，或按顺序执行的数组。每条策略在该 destination 的 processors 收到数据之前过滤 spans 与 attributes：

```ts title="agent/instrumentation/local.ts"
import { localTraces } from "eve/instrumentation/otel";

export default localTraces({
  exportPolicy: {
    span: ({ name }) => ({ emit: name !== "internal.cache.refresh" }),
    attribute: ({ key }) => (key === "customer.id" ? { emit: false } : { emit: true }),
  },
});
```

`span` 返回 `{ emit: true }` 原样保留；`{ emit: false }` 从该 destination 省略。要保留 span 但 redact 内容，返回带 `inputs: true` / `outputs: true`（或两者）的 `{ redact: true }`。redaction 隐含 emission，且至少要指定一个方向。抛错的 `span` 回调会从该 destination 丢掉该 span。`attribute` 返回 `{ emit: true }` / `{ emit: false }` / `{ replace: true, value }` 以保留、移除或改写单个 attribute。

### 从本地 traces redact 内容

在进程级 `otel({ tracePolicy })` 已放行某条 trace 之后，再用 redaction 收窄本地 destination 收到的内容。例如：本地 viewer 仍保留 spans，但非 public session 时 redact inputs / outputs：

```ts title="agent/instrumentation/local.ts"
import { localTraces } from "eve/instrumentation/otel";

export default localTraces({
  exportPolicy: {
    span: ({ audience }) =>
      audience === "public" ? { emit: true } : { redact: true, inputs: true, outputs: true },
  },
});
```

Input redaction 去掉 eve 已知的 prompt、instruction、document 与 tool-argument attributes；output redaction 去掉 response、reasoning、tool-result、exception 与 status attributes。Redaction 只收窄**本** destination，不会改发往其它 destination 的 spans。数组策略按顺序跑，每条收到前一条产出的 facade。

## 接下来读什么

- [Instrumentation](./instrumentation)：处理 eve 生命周期事件
- [迁移 Instrumentation](./migration)：替换 `agent/instrumentation.ts`
- [本地开发](../dev-tui)：在 TUI 里查看本地 traces
