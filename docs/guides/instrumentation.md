---
title: "可观测性（instrumentation.ts）"
description: "在 instrumentation.ts 中用 OpenTelemetry 跟踪 Agent，读取 Eve 写出的 workflow run tags，并用 eve info 和常见失败表排查 discovery。"
---

# 可观测性（instrumentation.ts）

`instrumentation.ts` 用来配置 Eve Agent 的观测方式。Framework 会自动发现 `agent/instrumentation.ts`，并在 server 启动时、任何 Agent 代码运行之前执行它。只要该文件存在，就隐式启用 telemetry，没有额外的 `isEnabled` 开关。

如果你打算导出 telemetry，请在启用前确认 exporter 目标、数据类别以及必要的法律和合规审批。

> **官方说明（experimental）：** Instrumentation provider API 默认关闭。开启 `experimental.instrumentationProviders` 后可使用「一文件一 provider」布局、方向性内容捕获和按 destination 脱敏。设置与限制见 [Instrumentation Providers](./instrumentation-providers)。

## 三种可观测性 surface（Three observability surfaces）

Eve 通过三种不同 surface 观察 Agent。它们不都写在这个文件里，输出位置也不同：

| Surface | 是否在 `instrumentation.ts` 配置 | 含义 |
| --- | --- | --- |
| **Workflow run tags**（`$eve.*`） | 否，自动发出 | Framework 拥有的 Vercel Workflow run attributes。用于让 dashboard 把 session、turn 和 subagent runs 串成树，并展示模型和 token usage。 |
| **OpenTelemetry export** | 是：`setup`、`recordInputs`、`recordOutputs`、`functionId` | AI SDK spans 导出到哪里，以及记录哪些内容。 |
| **Runtime context events** | 是：`events["step.started"]` | 每次 model call 写入 AI SDK runtime context 的值，AI SDK 会把它们带到 spans 上。 |

后两种 configurable surface 会把 AI SDK spans 发送到你的 OpenTelemetry backend。Workflow run tags 是独立系统，可以在 Workflow dashboard 查询，而不是写到 OTel spans 上。下面先讲当前文件中能配置的内容；[Workflow run tags](#workflow-run-tags) 章节说明 Eve 自动发出的内容。

## 定义 instrumentation（Define instrumentation）

```ts title="agent/instrumentation.ts"
import { BraintrustExporter } from "@braintrust/otel";
import { defineInstrumentation } from "eve/instrumentation";
import { registerOTel } from "@vercel/otel";

export default defineInstrumentation({
  setup: ({ agentName }) =>
    registerOTel({
      serviceName: agentName,
      traceExporter: new BraintrustExporter({
        parent: `project_name:${agentName}`,
        filterAISpans: true,
      }),
    }),
});
```

把 `defineInstrumentation` 的结果作为 default export 导出。

## OpenTelemetry（OpenTelemetry）

用 `setup` callback 注册你的 OTel provider，例如 `@vercel/otel` 里的 `registerOTel`。Framework 会在 server startup 时调用它，并传入解析后的 Agent name。`context.agentName` 在编译时从你的项目解析，优先使用 package `name`，否则使用 app directory name，因此不需要硬编码 service name。

任何兼容 OTel 的 backend 都可以使用。安装所需 exporter package，然后在 callback 中配置它。

另外三个字段控制 AI SDK 在 spans 中记录什么：

- `recordInputs`：在每个 step span 上记录完整 message history。
- `recordOutputs`：在 spans 上记录模型输出。
- `functionId`：覆盖 spans 上的 function name，默认是 Agent name。

对于敏感、受监管或生产数据，除非你已经审查 exporter 和数据保留路径，否则建议谨慎开启内容记录。

第三个 configurable surface 是 runtime context，它会把每次 model call 的值附加到这些 spans 上。详见官方 [Observability](https://eve.dev/docs/guides/instrumentation) 与本站 [Instrumentation Providers](./instrumentation-providers)。

## Workflow run tags（Workflow run tags）

和 OpenTelemetry 分开，Eve 会给每个 workflow run 打上 reserved `$eve.*` attributes。这些 tags 位于 Vercel Workflow run 上，可在 Workflow dashboard 查询。它们是 framework-owned，会在每个 session、turn 和 subagent run 上自动发出。

这些 tags 驱动 Vercel dashboard 中的 **Agent Runs** tab。开启方式见 [部署到 Vercel](./deployment/vercel#在仪表盘查看运行)。

## 调试（Debugging）

`eve info` 是查看 Eve 实际发现了什么的最快方式。当 `eve build` 因 discovery errors 失败时，CLI 会打印完整 diagnostics report。

## 接下来读什么（What to read next）

- [Instrumentation Providers](./instrumentation-providers)
- [`agent.ts`](../agent-config)
- [钩子（Hooks）](./hooks)
- [本地开发（Local Development）](./dev-tui)
- [评测（Evals）](../evals/overview)
