---
title: "可观测性（Instrumentation）"
description: "在 instrumentation.ts 中用 OpenTelemetry 跟踪 Agent，读取 Eve 写出的 workflow run tags，并用 eve info 和常见失败表排查 discovery。"
---

# 可观测性（Instrumentation）

官方原文：[Instrumentation](https://eve.dev/docs/observability/instrumentation)（公开 URL 在 `/docs/observability/...`；本站镜像 GitHub 路径 `docs/guides/instrumentation/`）。

用 `agent/instrumentation.ts` 配置 Eve Agent 的 OpenTelemetry。Framework 会发现该文件，并在 server 启动、任何 Agent 代码运行之前执行它。

## 配置 OpenTelemetry（Configure OpenTelemetry）

把 `defineInstrumentation(...)` 作为 default export 放在 `agent/instrumentation.ts`。eve 会在启动时调用其中的 `setup`：

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

用 `setup` 注册 OTel provider；eve 会传入解析后的 Agent name，无需硬编码 service name。任意兼容 OTel 的 backend 都可以。

默认只记元数据，不含模型 / 工具 / memory-record 内容。审查 exporter 目标与保留路径后，再按需开启：

- `recordInputs`：记录 message history 与 recalled memory records；默认 `false`
- `recordOutputs`：记录模型输出；默认 `false`
- `functionId`：覆盖 spans 上的 function name；默认是 Agent name

Session 的 channel **audience** 是内容捕获的第二道闸。在 Vercel 的 preview / production 上，eve 只对 `public` session 记录 inputs / outputs；本地开发的 local tracing 默认保留全部内容。详见 [本地 traces](#本地-traceslocal-traces)。

默认 eve HTTP channel 的 audience：

| Session 创建者 | Audience |
| --- | --- |
| 匿名调用方 | `unknown` |
| 已鉴权的 `user` / `service` / `runtime` | `private` |
| 其它 principal 类型 | `unknown` |

只对**刻意公开**的流量设 `audience: "public"`。其它内置 channel 自行分类对话。见 [eve channel Audience](../../channels/eve#audience) 与 [自定义 channel 对话 audience](../../channels/custom#对话-audienceconversation-audience)。

## 添加 runtime context（Add runtime context）

用 `events["step.started"]` 给 AI SDK runtime context 附加值；AI SDK 会把它们带到 model-call span 及其子 spans：

```ts title="agent/instrumentation.ts"
import { defineInstrumentation, isChannel } from "eve/instrumentation";
import supportChannel from "./channels/support";

export default defineInstrumentation({
  events: {
    "step.started"(input) {
      if (!isChannel(input.channel, supportChannel)) return undefined;

      return {
        runtimeContext: {
          "support.channel_id": input.channel.metadata.channelId ?? "",
          "support.user_id": input.channel.metadata.triggeringUserId ?? "",
        },
      };
    },
  },
});
```

回调能看到 session、turn、step、channel 与最终 model input。对 authored channel，先 import 定义并用 `isChannel`，再读其类型化 metadata。Runtime instrumentation **只**收到 channel 显式暴露的 metadata，不会回退到原始 channel state。

## Trace 拓扑（Trace topology）

注册了 OTel provider 时，每个 turn 大致长这样：

```text
ai.eve.turn  {eve.session.id}
  +-- invoke_agent <model>
        +-- step 1
        |     +-- chat <model>
        |     +-- execute_tool search
        +-- step 2 ...
```

eve 创建 `ai.eve.turn` 父 span，并把 telemetry 交给 [AI SDK](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)。设 `traceChannelRequests: true` 可为每个入站 channel HTTP 请求建一个 OTel `SERVER` span（默认 `false`）；该 span 用路由模板与 method，不记录具体 URL、session ID、token、headers、body 或 query。

## 本地 traces（Local traces）

没有 `agent/instrumentation.ts` 时，`eve dev` 会在 `.eve/traces/` 下为每个 turn 记一份有界 trace。可用 Dev TUI 的 [`/traces`](../dev-tui#logs-and-traces) 或退出后的 [`eve traces`](../../reference/cli#eve-traces) 查看。

本地 traces **默认保留**模型 / 工具 / memory-record 内容。在 `.env.local` 设 `EVE_TRACES_CONTENT=off` 可省略。一旦编写了 `agent/instrumentation.ts`，就由其中的 `recordInputs` / `recordOutputs` 控制 OTel provider 的内容。

## Workflow run tags

与 OpenTelemetry 分开，eve 给每个 Workflow run 打上保留的 `$eve.*` 属性。这些是框架拥有的属性，可在 Workflow dashboard 查询，而不是写到 OTel spans 上。无论有没有 `instrumentation.ts` 都会发出。

结构性 tags 描述 run 在树中的位置：`$eve.type`、`$eve.parent`、`$eve.root`、`$eve.subagent`、`$eve.trigger`、`$eve.schedule`、`$eve.title`、`$eve.trace_id`（采样 trace 种子，不是跨对话身份）。每个 turn 还会累计 `$eve.model`、token 类与 `$eve.tool_count`，驱动 Vercel **Observability** 里的 **Agent Runs**。开启方式见 [部署到 Vercel](../deployment/vercel#inspect-agent-runs)。

## 排查 discovery（Debug discovery）

跑 `eve info` 查看发现的 instrumentation 与诊断。`.eve/` 下还有 `agent-discovery-manifest.json`、`diagnostics.json`、`compiled-agent-manifest.json`、`module-map.mjs`。

| 现象 | 下一步 |
| --- | --- |
| Instrumentation 未被发现 | `eve info`，确认文件槽位，读 `.eve/diagnostics.json` |
| 工具未被发现 | 确认在 `agent/tools/`、default-export `defineTool(...)`，并出现在 `eve info` |
| `eve build` 报 discovery 错误 | 读打印诊断与 `.eve/diagnostics.json` |

## Instrumentation Providers（实验）

[Instrumentation Providers](./providers) 是实验性的多文件替代方案，**不能**与 `agent/instrumentation.ts` 同用。需要独立 lifecycle-event providers、多个 OTel destinations、方向性内容捕获或按 destination 脱敏时再用。OTel 专用 API 见 [OpenTelemetry](./otel)。

## 项目建议

- 公开 URL 记 `/docs/observability/...`；本站内部链接用 `guides/instrumentation`。
- 匿名流量默认 `unknown`：只有刻意公开时才设 `public`。
