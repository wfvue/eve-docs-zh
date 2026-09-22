---
title: "OpenTelemetry"
description: "配置 OpenTelemetry destinations、内容捕获、托管导出与 destination 级过滤。"
url: "/observability/otel"
---

# OpenTelemetry

官方原文：[OpenTelemetry](https://eve.dev/docs/observability/otel)。

eve 会自动配置内置 OTel destinations：`eve dev` 默认记录本地 traces；preview / production 默认导出到 Vercel Agent Runs。只用这些默认项时，不需要写 `otel()` 或 `otelIntegration()`。

## 配置 OpenTelemetry

两个函数都是按需使用：

- `otel()`：进程级 resource、sampler、propagators 与 trace capture policy；整个 Agent 最多一个。
- `otelIntegration()`：添加第三方 OTel destination；每个 exporter / processor 链一个文件。

需要控制所有 OTel destinations 能看到的内容时，添加：

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

共享 `tracePolicy` 是 OTel 内容捕获的**上限**：destination 不能恢复已被它排除的内容。它不影响 `defineInstrumentation()` 创建的生命周期 instrumentation。Audience 分类见 [Channels](../../channels/overview#audience)。

## 添加第三方 destination

先按 exporter 需要安装依赖，例如：

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
    headers: { "x-honeycomb-team": process.env.HONEYCOMB_API_KEY! },
  }),
});
```

需要自定义过滤或变换时可传 `spanProcessors`。上例的 `exportPolicy` 保留 span 元数据，但从这个 destination 删除输入与输出。

## 添加 runtime context

`runtimeContext` 可给每次 model attempt 的 AI SDK spans 附加 JSON 值。若要安全读取 typed channel metadata，先 import channel 定义并用 `isChannel` 收窄：

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

Resolver 会收到 channel、session、最终 model input、step 与 turn。`eve.` 前缀留给框架；被共享 trace policy 排除的内容也不会出现在 resolver 中。

## Trace 拓扑

普通 Agent turn 大致为：

```text
invoke_agent <agent>
  └── agent.step
        ├── chat <model>
        └── agent.action
              └── execute_tool <tool>
```

每个 turn 新开一条 trace。首次 subagent trace 用 `eve.link.type=agent.dispatch` 链到调用者，但这不是授权许可。远程 Agent 可用 `trustedForwarders` 接受调用方的 session lineage 与 trace 内容策略。用 `gen_ai.conversation.id` 在目的地中聚合同一对话的 traces。

## 管理内置 destinations

### 本地 traces

省略 `agent/instrumentation/local.ts` 会保留 `eve dev` 默认本地 traces。要重配就导出 `localTraces(...)`；要关闭：

```ts title="agent/instrumentation/local.ts"
import { disableInstrumentation } from "eve/instrumentation";
export default disableInstrumentation();
```

### Vercel Agent Runs

省略 `agent/instrumentation/agent-runs.ts` 会保留 preview / production 的默认导出。要重配就导出 `agentRuns(...)`；同样可用 `disableInstrumentation()` 关闭。

## 在 Vercel 开启 tracing

Vercel 项目至少需要一条 rate 大于 0% 的 [sampling rule](https://vercel.com/docs/tracing/always-on-tracing#enable-always-on-tracing) 才会采集 traces。官方建议 Eve 项目设为 **100%**：

1. 打开项目 **Settings → Tracing**。
2. 选择 **Add Sampling Rule**。
3. 选择环境并把 Rate 设为 `100%`。
4. 保存。

也可用 [`vercel traces config`](https://vercel.com/docs/cli/traces#manage-trace-sampling-rules) 管理；CLI 接受 1–100%，0% 规则需在 dashboard 添加。

## 按 destination 过滤

`otelIntegration()`、`localTraces()` 与 `agentRuns()` 接受一个 `exportPolicy` 或按顺序执行的数组：

```ts title="agent/instrumentation/agent-runs.ts"
import { agentRuns } from "eve/instrumentation/otel";

export default agentRuns({
  exportPolicy: {
    span: ({ name }) => ({ emit: name !== "internal.cache.refresh" }),
    attribute: ({ key }) =>
      key === "customer.id" ? { emit: false } : { emit: true },
  },
});
```

`span` 可返回 `{ emit: true }`、`{ emit: false }`，或 `{ redact: true, inputs: true, outputs: true }`。`attribute` 可保留、删除或 `{ replace: true, value }`。Span callback 抛错时，该 destination 丢弃 span。

进一步收窄内置 destination 时，可按 audience 脱敏：

```ts title="agent/instrumentation/agent-runs.ts"
import { agentRuns } from "eve/instrumentation/otel";

export default agentRuns({
  exportPolicy: {
    span: ({ audience }) =>
      audience === "public"
        ? { emit: true }
        : { redact: true, inputs: true, outputs: true },
  },
});
```

输入脱敏覆盖 prompts、instructions、documents 与工具参数；输出脱敏覆盖 responses、reasoning、工具结果、异常与状态。它只收窄当前 destination，不会改写发往其它 destinations 的 spans。

## 接下来读什么

- [Instrumentation](./instrumentation)：处理 eve 生命周期事件
- [迁移 Instrumentation](./migration)：替换旧 `agent/instrumentation.ts`
- [本地开发](../dev-tui)：在 TUI 中检查本地 traces
