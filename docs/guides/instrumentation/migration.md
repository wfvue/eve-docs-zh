---
title: "迁移 Instrumentation"
description: "把单个 instrumentation.ts 拆为生命周期 instrumentation 与 OpenTelemetry destinations。"
url: "/observability/instrumentation-migration"
---

# 迁移 Instrumentation

官方原文：[Migrate Instrumentation](https://eve.dev/docs/observability/instrumentation-migration)。

把旧的 `agent/instrumentation.ts` 改成 `agent/instrumentation/` 下按路径命名的多个文件，并从 `agent.ts` 删除 `experimental.instrumentationProviders`：目录发现已默认开启。

## 先保留「仅元数据」行为

旧 API 省略 `recordInputs` / `recordOutputs` 时，两者默认都是 `false`。新布局只要存在 OTel destination，开发环境与 public 对话的默认策略会包含内容。因此迁移第一步应先写出明确上限：

```ts title="agent/instrumentation/otel.ts"
import { otel } from "eve/instrumentation/otel";

export default otel({
  functionId: "support-agent",
  traceChannelRequests: true,
  tracePolicy: () => ({
    emit: true,
    recordInputs: false,
    recordOutputs: false,
  }),
});
```

先逐个核对目的地的访问控制与保留策略，再有意识地放宽 `recordInputs` 或 `recordOutputs`。

## 迁移 OTel exporter

每个 exporter 写到独立 destination 文件；把启动阶段的 `registerOTel(...)` 替换成 `otelIntegration(...)`。若 exporter 来自 `@vercel/otel`，先安装：

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

这里的 destination policy 会继续维持「仅元数据」，即使以后放宽了共享 OTel policy。多个目的地就写多个文件，eve 会把它们合成一条 pipeline。

## 字段搬到哪里

| 旧 `agent/instrumentation.ts` 字段 | 新位置 |
| --- | --- |
| `setup` + `registerOTel` | 每个目的地一个 `otelIntegration()` 文件 |
| `functionId` | `otel({ functionId })` |
| `recordInputs` / `recordOutputs` | `otel({ tracePolicy })` |
| `traceChannelRequests` | `otel({ traceChannelRequests })` |
| `events["step.started"]` | `otelIntegration({ runtimeContext })` |

把需要附加 span 属性的 `step.started` 逻辑移到对应 destination 的 `runtimeContext`；若你处理的是 eve 生命周期事件，则另建一个 `defineInstrumentation(...)` 文件。

## 验证迁移

1. 运行 `eve build`。若旧 `agent/instrumentation.ts` 仍在，构建会失败并指向新目录。
2. 部署到 Vercel 前配置 trace sampling：至少一条规则的 rate 必须高于 0%，官方建议 Eve 项目设为 100%。
3. 跑一次 Agent turn，逐个目的地确认 traces、内容策略与脱敏结果。

采样配置见 [OpenTelemetry / 在 Vercel 开启 tracing](./otel#在-vercel-开启-tracing)。
