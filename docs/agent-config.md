---
title: "agent.ts"
description: "在 agent.ts 中使用 defineAgent 设置 Agent 运行时配置，包括模型、reasoning effort 和上下文压缩。"
---

# agent.ts

Agent 的 `agent.ts` 会调用从 `eve` 导出的 `defineAgent`，用来设置运行时配置。

## 设置模型

一个典型配置会选择一个模型：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-opus-4.8",
});
```

如果不需要运行时配置，可以省略根目录下的 `agent.ts`。这种情况下，eve 会在同一 slot 选择默认 `agent.ts` 源，配置为 `openai/gpt-5.6-luna-fast`；自己写这个文件会替换该默认源。如果存在 `agent.ts`，则必须提供 `model`。

对静态 AI Gateway model ID，也可以从项目根运行 `eve set --model anthropic/claude-opus-4.8`，或在本地 dev TUI 里用 `/model anthropic/claude-opus-4.8`。

`model` 可以是一个 Gateway 模型 ID 字符串，这会通过 [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) 路由。要直接调用某个模型提供商，并在代码里配置模型，则传入该提供商实现的 `LanguageModel`。

提供商专属的 AI SDK 包只是普通项目依赖。全新的 `eve init` 应用会包含核心 `ai` 包，但不会安装每个模型提供商的包。你需要安装自己导入的 provider 包，并设置该 provider 的 API key：

```bash
npm install @ai-sdk/anthropic
```

```ts title="agent/agent.ts"
import { anthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

export default defineAgent({
  model: anthropic("claude-opus-4-8"),
});
```

直接调用 provider 时，模型 ID 使用 provider 原生格式。以 Anthropic 为例，原生版本号使用连字符，例如 `claude-opus-4-8`；而上面的 Gateway ID 使用点号，例如 `anthropic/claude-opus-4.8`。

模型使用会受到你选择的提供商和路由路径的条款、数据处理承诺、保留策略以及可用控制项约束。通过 Gateway 路由的模型请查看 [AI Gateway model catalog](https://vercel.com/ai-gateway/models)；直接配置 `LanguageModel` 时，请查看对应 provider 的条款。

## Reasoning effort

设置 `reasoning` 可以通过 AI SDK 的跨 provider 选项控制模型 reasoning effort：

```ts title="agent/agent.ts"
export default defineAgent({
  model: "openai/gpt-5.5",
  reasoning: "high",
});
```

支持的值包括：`"provider-default"`、`"none"`、`"minimal"`、`"low"`、`"medium"`、`"high"` 和 `"xhigh"`。具体哪些级别可用，以及它们如何映射到 provider 原生设置，由所选模型和 provider 决定。如果需要 provider 专属的 reasoning 控制，请使用 `modelOptions.providerOptions`。

## Compaction

Compaction 会在接近上下文窗口时总结较早的轮次。它默认开启，所以通常只需要调整触发时机。降低 `thresholdPercent` 可以更早触发压缩：

```ts title="agent/agent.ts"
export default defineAgent({
  model: "anthropic/claude-opus-4.8",
  compaction: {
    thresholdPercent: 0.75, // 默认 0.9
  },
});
```

模型循环如何应用 compaction，见 [Default harness](./concepts/default-harness#compaction)。


## Runtime limits（运行时限额）

用 `limits` 配置框架侧运行时上限。Session **用量**限额会在累计的 provider 报告 token，或模型 token 费用达到配置后，阻止该 durable session 再发起下一次模型调用：

```ts title="agent/agent.ts"
export default defineAgent({
  model: "anthropic/claude-opus-4.8",
  limits: {
    maxInputTokensPerSession: 200_000,
    maxOutputTokensPerSession: 20_000,
    maxTokenCostUsdPerSession: 1.5,
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000,
  },
});
```

`sessionTimeoutMs` 是每个 session（含委派 session）的绝对寿命，默认 30 天，从创建起算，跨重启与重新部署仍有效。到期时 eve 会让进行中的 turn settle，再发 `session.completed` 并释放 continuation；下一条合格 channel 消息会开新 session。设为 `false` 可关闭超时。过期**不会**删除已存 session 数据。

输入 token、输出 token 与模型 token 费用**各自独立**检查。越过限额的那次模型调用仍会跑完（精确用量要等调用结束后才有）。下一次模型调用前，eve 会暂停 session，并给出确定性 continuation 提示：**Approve** 按各项配置重新开一扇预算窗；**Stop** 走标准取消路径（`turn.cancelled` → `session.waiting`）——这是用户决定，不是错误。session 仍可恢复；因仍超预算，下一条消息会再次弹出提示。

无法触达真人的 task-mode（如 schedules、无 input proxy 的委派）会跳过提示，并在下一次模型调用失败：token 预算对应 `SESSION_TOKEN_LIMIT_REACHED`，模型费用对应 `SESSION_TOKEN_COST_LIMIT_REACHED`。

省略 `maxInputTokensPerSession` 时，根 session 默认输入预算为 `40_000_000` provider 报告输入 token。`maxOutputTokensPerSession` 与 `maxTokenCostUsdPerSession` 默认未设。`maxTokenCostUsdPerSession` 是模型 token 费用的美元上限，**不含**工具或基础设施花费；费用取自每次模型 step 的上报值（AI Gateway 会提供），未上报费用的 step 不计入。任一项设为 `false` 即取消该轴上限。

委派子智能体没有固定默认配额：派发时按当前预算窗剩余额在本批本地子调用间均分；子智能体完成后的用量（含美元费用）会计回父级。批准 continuation 会为后续子授予打开新的父级窗口，但不抹掉终身累计用量。

> **官方说明：** 用量限额与继承规则以 [agent.ts](https://eve.dev/docs/agent-config) 当前页为准；中文页只抓要点。

## Workflow world

默认情况下，eve 会为宿主选择 Workflow SDK world：部署在 Vercel 上时使用 Vercel Workflow；本地开发或 `eve start` 时使用 SDK 的 local world。高级自托管部署可以在根 `agent.ts` 里选择要使用的 Workflow world 包：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-opus-4.8",
  experimental: {
    workflow: {
      world: "@workflow/world-postgres",
    },
  },
});
```

然后在应用里安装这个包。它应该导出一个默认 factory，或者导出 `createWorld()` 函数。版本需要固定到与你的 eve release 所使用的 `@workflow/*` 系列一致的版本上。当前是 `5.0.0-beta` 系列：

```bash
pnpm add @workflow/world-postgres@5.0.0-beta.x
```

npm 的 `latest` tag 可能滞后于这个系列，所以不固定版本可能会拉到不兼容的 major，并在 run replay 时出现 `ZodError: invalid_union`。

凭据和宿主专属选项应该放在 world 包读取的运行时环境变量里，而不是放在 `agent.ts` 中。以 Postgres world 为例，也就是把连接字符串或凭据放进它会读取的环境变量。如果已安装的包在 hosted output 中必须保持 external，请把它列入 `build.externalDependencies`。

## 其它 defineAgent 字段

`defineAgent` 还接收一些可选字段。导出的类型见 [TypeScript API](./reference/typescript-api)。

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `reasoning` | `AgentReasoningDefinition` | provider default | 跨 provider 的 reasoning effort，会转发给 Agent 每一轮的模型调用。 |
| `modelOptions` | `AgentModelOptionsDefinition` | 无 | 转发给模型调用的 provider 选项覆盖。 |
| `limits` | `AgentLimitsDefinition` | 字段相关 | 框架侧运行时限额。Session 默认 30 天后 complete；用量限额默认值与继承见上文。某项设为 `false` 即关闭。 |
| `experimental` | `{ workflow?: { world?: string } }` | 未设置 | 可选的实验性设置，可能在任意版本中变化或消失。请把它们视为不稳定能力。`workflow.world` 用来选择支撑 session 状态、队列、hooks 和 streams 的 Workflow world 包。 |
| `outputSchema` | Standard Schema 或 JSON Schema object | 无 | task-mode run 的结构化返回类型，例如 subagent、schedule 或 remote job。交互式对话轮次会忽略它，除非客户端为每条消息提供 schema。 |
| `build` | `{ externalDependencies?: string[] }` | 无 | hosted build 的打包控制。`externalDependencies` 会让列出的包在运行时保持 external，同时 eve 会编译 tools 和 channels 这类 authored modules，并把这些包 trace 进 hosted output。 |

`externalDependencies` 只是打包控制。它让指定包作为 hosted output 的运行时依赖保留下来；它不会授权、配置或审查这些包可能调用的第三方服务。

## 相邻设置放在哪里

| 关注点 | 位置 |
| --- | --- |
| Instructions prompt | `agent/instructions.md`，[Instructions](./instructions) |
| 每个工具的审批（HITL） | `agent/tools/*.ts`，[Tools](./tools) |
| 入站鉴权和网络策略 | channel 层，[Auth & route protection](./guides/auth-and-route-protection) |
| Sandbox / workspace | `agent/sandbox/`，[Sandbox](./sandbox) |
| Telemetry 和调试 | `agent/instrumentation.ts`，[Instrumentation](./guides/instrumentation) |

## 接下来读什么

- [Default harness](./concepts/default-harness)：了解这个配置驱动的模型循环和内置工具。
- [TypeScript API](./reference/typescript-api)：查看每个 `defineAgent` 字段和类型。
- [Subagents](./subagents)：了解 `description` 要求和 child-agent 配置。
