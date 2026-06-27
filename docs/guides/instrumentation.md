---
title: "可观测性（instrumentation.ts）"
description: "在 instrumentation.ts 中用 OpenTelemetry 跟踪 Agent，读取 Eve 写出的 workflow run tags，并用 eve info 和常见失败表排查 discovery。"
---

# 可观测性（instrumentation.ts）

`instrumentation.ts` 用来配置 Eve Agent 的观测方式。Framework 会自动发现 `agent/instrumentation.ts`，并在 server 启动时、任何 Agent 代码运行之前执行它。只要该文件存在，就隐式启用 telemetry，没有额外的 `isEnabled` 开关。

如果你打算导出 telemetry，请在启用前确认 exporter 目标、数据类别以及必要的法律和合规审批。

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

任何兼容 OTel 的 backend 都可以使用，例如 Braintrust、Raindrop、Arize、Honeycomb、Datadog、Jaeger。安装所需 exporter package，然后在 callback 中配置它。

另外三个字段控制 AI SDK 在 spans 中记录什么，见 AI SDK 的 [telemetry reference](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)：

- `recordInputs`：在每个 step span 上记录完整 message history，默认 `true`。如果 inputs 包含敏感内容，或想减少 span payload size，请设置为 `false`。
- `recordOutputs`：在 spans 上记录模型输出，默认 `true`。设置为 `false` 可以关闭输出记录。
- `functionId`：覆盖 spans 上的 function name，默认是 Agent name。

对于敏感、受监管或生产数据，除非你已经审查 exporter 和数据保留路径，否则建议把 `recordInputs` 和 `recordOutputs` 都设为 `false`。

你需要自行确认任何 observability 或 eval provider 是否被允许接收导出的数据。

第三个 configurable surface 是 [runtime context](#runtime-context)，它会把每次 model call 的值附加到这些 spans 上。

## Runtime context（Runtime context）

_Runtime context_ 是一个 [AI SDK 概念](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)：一个会贯穿 generation lifecycle 的用户自定义对象。Eve 通过 `events["step.started"]` 暴露它。该 callback 会在 Eve 为一次 attempt 组装完 model input 后运行，并返回 `{ runtimeContext }`。因为 Eve 注册 AI SDK OpenTelemetry integration 时启用了 runtime context，这些返回值会被带到 model-call span 及其 children 上。

字段名是 `runtimeContext`，而不是 `metadata`，因为 AI SDK v7 把 per-call attributes 放在 runtime context 上，而不是独立 metadata 字段。

当这些值依赖当前 session、turn、step、channel 或 model input 时使用它：

```ts
import { defineInstrumentation, isChannel } from "eve/instrumentation";
import supportChannel from "./channels/support.js";

export default defineInstrumentation({
  events: {
    "step.started"(input) {
      if (!isChannel(input.channel, supportChannel)) {
        return undefined;
      }

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

Callback 会收到：

- `session`：session id、current / initiator auth、以及 parent session lineage。
- `turn`：stream turn id 和 sequence，例如 `turn_0`。
- `step`：turn 内从 0 开始的 step index。
- `channel`：channel 的 `kind` 和 active channel 投影出的 metadata。
- `modelInput`：最终传给 model call 的 instructions 和 messages。

Channel 通过 `kind` 暴露身份。对于 authored channels，格式是 `channel:<name>`，其中 `<name>` 是 `agent/channels/` 下的文件名，例如 `agent/channels/support.ts` 是 `channel:support`。Framework channels 使用 `http`、`schedule` 或 `subagent`；无法识别或缺失时会标准化为 `unknown`。该 kind 也会作为 `eve.channel.kind` span attribute 发出。Eve 会根据 channel 文件名生成 compiler-owned typings，所以你既可以检查 `input.channel.kind === "channel:support"`，也可以使用 `isChannel(input.channel, supportChannel)` 收窄。

Channel metadata 由 channel 自己决定。内置 channels 只暴露它们选择让观测系统看到的字段。例如 Slack 会从 durable channel state 投影 `channelId`、`teamId`、`threadTs` 和 `triggeringUserId`。自定义 channel 可以从 `defineChannel` 返回的 `metadata(state)` 暴露自己的投影。Runtime instrumentation 不会回退读取 raw channel state。

## Trace 层级（Trace hierarchy）

启用 telemetry 后，每个 turn 会生成类似下面的 trace：

```text
ai.eve.turn  {eve.session.id}
  +-- ai.streamText                           step 1
  |     +-- ai.streamText.doStream            model call
  |     +-- ai.toolCall  {toolName: search}   tool exec
  +-- ai.streamText                           step 2
  |     +-- ai.streamText.doStream
  |     +-- ai.toolCall  {toolName: read}
  +-- ai.streamText                           step 3 (final text)
```

Eve 为每个 turn 创建 `ai.eve.turn` parent span，并把 enriched telemetry 传给 AI SDK，让 model calls 和 tool executions 自动被 trace。Session、turn、step 和 channel context 会作为 framework 一侧的 runtime context 注入：`eve.version`、`eve.session.id`、`eve.environment`、`eve.turn.id`、`eve.turn.sequence`、`eve.step.index`、`eve.channel.kind`。它们会和你在 `events["step.started"]` callback 中返回到 `runtimeContext` 下的值一起附加到 spans 上。

## Workflow run tags（Workflow run tags）

和 OpenTelemetry 分开，Eve 会给每个 workflow run 打上 reserved `$eve.*` attributes。这些 tags 位于 Vercel Workflow run 上，可在 Workflow dashboard 查询，不在 OTel spans 上，也不需要你配置。它们是 framework-owned，会在每个 session、turn 和 subagent run 上自动发出，无论是否存在 `instrumentation.ts`。Authored code 不能设置或覆盖 `$eve.` namespace。

这些 tags 可以让 dashboard 重建单次 Agent invocation 背后的 run tree，并展示 model 和 token usage，而不读取 run bodies。

结构 tags 描述每个 run 在树中的位置：

- `$eve.type`：`"session"`、`"turn"` 或 `"subagent"`。
- `$eve.parent`：直接 parent 的 session id。
- `$eve.root`：整棵链的 root session id，可用 `$eve.root=<id>` 分组整棵树。
- `$eve.subagent`：compiled graph node id，仅 subagent runs。
- `$eve.trigger`：启动 run 的 channel kind。
- `$eve.title`：从第一条 user message 派生并截断的 title。

Per-turn usage tags 会写到 turn 的每个 step 上，并累计总数，最后一次写入生效：

- `$eve.model`：turn 使用的 model id。
- `$eve.input_tokens`、`$eve.output_tokens`、`$eve.cache_read_tokens`：累计 token counts。
- `$eve.tool_count`：turn 可用工具数量。

Tag writes 是 best-effort：失败时每个进程只记录一次，然后吞掉错误，所以 tag emit 失败不会破坏 Agent。

这些 tags 驱动 Vercel dashboard 中的 **Agent Runs** tab。部署到 Vercel 后，平台会自动识别 `eve` framework，并在项目 **Observability** tab 下展示 Agent Runs 视图，你可以浏览 sessions 并进入每段对话的 trace，不需要 `instrumentation.ts`。该 tab 目前按团队 gated。开启方式见 [部署（Deployment）](../deployment#在仪表盘查看运行view-runs-in-the-dashboard)。Agent Runs 和上面的 OpenTelemetry export 是两套东西；当你需要把 spans 发到 Braintrust、Datadog 或其它第三方 backend 时，使用 OTel。

> 默认情况下，telemetry 会记录完整 message history 和 model outputs。如果使用这些数据流，可能需要在隐私材料中披露。

## 调试（Debugging）

`eve info` 是查看 Eve 实际发现了什么的最快方式：active tools、skills、subagents、schedules、routes 和 discovery diagnostics。Eve 还会把可检查的 artifacts 写到 `.eve/`，即使 discovery 遇到错误也会保留：

| Artifact | 说明 |
| --- | --- |
| `agent-discovery-manifest.json` | Eve 在磁盘上发现了什么 |
| `diagnostics.json` | authored-shape errors 和 warnings |
| `compiled-agent-manifest.json` | runtime 会加载的 serialized surface |
| `module-map.mjs` | Eve import 的 compiled module entrypoints |

当 `eve build` 因 discovery errors 失败时，CLI 会打印完整 diagnostics report，包括 severity、message、source path，以及 diagnostics artifact 的路径。

### 常见失败（Common failures）

| Symptom | Likely cause and fix |
| --- | --- |
| Tool 没有被发现，模型看不到它 | 运行 `eve info`。确认文件位于正确位置：`agent/tools/<name>.ts`，并 default-export `defineTool(...)`。同时检查 `.eve/diagnostics.json` 是否有 shape errors。`schedules/` 只能位于 root。 |
| 模型不会调用本该调用的工具 | 收紧 tool `description` 和 `inputSchema`；把流程性指导放到 [技能（Skills）](../../skills)，不要塞进 description。用 `eve info` 确认它在 active set 中。 |
| 卡在 `session.waiting` | Turn parked 在 approval、question 或 connection sign-in 上。回答它，或用 `continuationToken` POST follow-up；过期 token 会被拒绝。 |
| 生产路由 401 | 这是预期行为：auth fail closed。把 `placeholderAuth()` 换成 route policy。`vercelOidc()` 只用于 Vercel-issued tokens；其它情况配置 `httpBasic()`、JWT/OIDC helpers 或自定义 `AuthFn`。见 [鉴权与路由保护（Auth and route protection）](../auth-and-route-protection)。 |
| Build 因 discovery errors 失败 | 阅读 CLI 输出和 `.eve/diagnostics.json`；确认 root 与 subagent boundary 有效，并且 secrets 来自环境变量。 |

## 接下来读什么（What to read next）

- [`agent.ts`](../../agent-config)
- [钩子（Hooks）](../hooks)：观察 runtime event stream
- [本地开发（Local Development）](../dev-tui)：在本地驱动 Agent
- [评测（Evals）](../../evals/overview)：可重复、可评分的检查
