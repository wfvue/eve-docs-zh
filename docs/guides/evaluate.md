---
title: "自动模型选择（Automatic Model Selection）"
description: "用 eve/models 的 auto 按请求自动选模型，或在工具与应用代码里用 eve/ai 的 evaluate 做类型化评判。"
---

# 自动模型选择

官方原文：[Automatic Model Selection](https://eve.dev/docs/guides/evaluate)。

## 这个概念解决什么问题

很多 Agent 不想永远绑死一个模型：难任务用更强的模型，日常问答用更快更便宜的。以前要么手写路由逻辑，要么在工具里自己拼一套「评判」。现在官方把两件事拆开：

1. **`auto`（`eve/models`）**：在推理开始前，从你给出的候选名单里，用 AI SDK 的 evaluation API 选一个模型。
2. **`evaluate`（`eve/ai`）**：在你自己的工具或应用代码里，对任意状态提出 choice / score / boolean 问题。

> ⚠️ **官方说明（beta）：** AI SDK 的 evaluation model 规范仍是实验性的，可能在 patch 版本里变化。

## 官方说明：从 Gateway 模型里选

默认情况下，`auto` 用 `typesafe-ai/jev` 做评估。和其它 AI SDK 模型字符串一样，除非你配置了全局默认 provider，否则走 [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)。

```ts title="agent/agent.ts"
import { defineAgent } from "eve";
import { auto } from "eve/models";

export default defineAgent({
  model: auto({
    options: {
      "openai/gpt-5.6-sol": "Difficult reasoning and engineering tasks",
      "openai/gpt-5.6-luna": "Routine tasks where fast completion matters",
    },
  }),
});
```

Gateway 认证方式和其它 AI SDK 模型一样。eve **不会**额外加 TypeSafe 凭据层。`eve dev` 期间，Gateway evaluator 与 Gateway 语言模型共用 `/login` 选中的连接。若已配置 AI SDK 默认 provider，开发期的字符串模型解析仍由它负责。TUI 页脚在使用 `auto` 时显示 `dynamic model`，并带上本 turn 解析出的模型，例如 `dynamic model · openai/gpt-5.6-luna`。

### 直接使用 provider 的 evaluation model

自行安装 provider 包，并传入它的 evaluation model；凭据与设置由该 provider 负责：

```sh
pnpm add @ai-sdk/typesafe-ai
```

```ts title="agent/agent.ts"
import { typeSafeAi } from "@ai-sdk/typesafe-ai";
import { defineAgent } from "eve";
import { auto } from "eve/models";

export default defineAgent({
  model: auto({
    model: typeSafeAi.evaluationModel("jev-latest"),
    options: {
      "openai/gpt-5.6-sol": "Difficult reasoning and engineering tasks",
      "openai/gpt-5.6-luna": "Routine tasks where fast completion matters",
    },
  }),
});
```

任何实现 AI SDK `Experimental_EvaluationModel` 合约的 provider 都可以用在这里。

### 路由到 provider 模型并覆盖 reasoning

`options` 的 **key** 是给评估器看的标签。字符串 value 表示「Gateway 模型 ID 就是这个 key」。需要 provider 实例、别名或按选项覆盖 reasoning 时，用对象形式：

```ts title="agent/agent.ts"
import { anthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";
import { auto } from "eve/models";

export default defineAgent({
  reasoning: "medium",
  model: auto({
    options: {
      "openai/gpt-5.6-sol": "Hard problems",
      my_secret_model: {
        model: anthropic("sonnet-5"),
        description: "Routine work that can use the direct Anthropic provider",
        reasoning: "low",
      },
    },
  }),
});
```

评估器只看到 option keys、描述和近期文本消息；**不会**收到 provider 凭据或序列化后的 LanguageModel。选中 `my_secret_model` 时，eve 再把 key 解析回你写的 Anthropic 模型。

支持的 reasoning 值：`"provider-default"`、`"none"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`。省略则继承 Agent 级 `reasoning`。

## 官方说明：在工具里调用 evaluate

用 `evaluate` 对传入的 `state` 提选择题、打分题或布尔题。默认仍是 `typesafe-ai/jev`，认证与 `auto` 相同（含 `eve dev` 的 `/login` Gateway）。传 `model` 可换其它 evaluation model ID 或 provider 实例；已配置的 AI SDK 默认 provider 优先于本地 Gateway 连接。

```ts title="agent/tools/classify-request.ts"
import { evaluate } from "eve/ai";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Choose the team that can help with a customer request.",
  inputSchema: z.object({ request: z.string().min(1).max(8000) }),
  async execute({ request }, ctx) {
    const result = await evaluate({
      state: { request },
      questions: {
        team: {
          type: "choice",
          instructions: "Select the team best suited to handle the request.",
          criteria: {
            billing: "Invoices, payments, and refunds",
            support: "Product questions and troubleshooting",
          },
        },
      },
      abortSignal: ctx.abortSignal,
    });
    return { team: result.answers.team.choice };
  },
});
```

上面的 choice 类型是 `"billing" | "support"`。每个问题按你写的 key 出现在 `result.answers`；结果还带 token usage、warnings、provider / response metadata。

`evaluate` 接受 AI SDK evaluation 选项（如 `maxRetries`、`headers`、`providerOptions`）。传 `abortSignal` 可取消。输入/答案校验、重试、provider 错误语义跟 AI SDK 一致。

也可以在工具外调用 `evaluate`——**不需要**活跃的 eve session。每次调用独立评估。`auto` 内部就用它，并加上下文所述的 per-turn 路由行为。

## 官方说明：用评估模型做工具审批

工具侧用 `eve/tools/approval` 的 `auto({ model? })`，让评估模型判断「这次调用能否自动跑，还是要人审批」。模型字符串 / provider 实例规则同上，默认 `typesafe-ai/jev`：

```ts title="agent/tools/deploy.ts"
import { defineTool } from "eve/tools";
import { auto } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  description: "Deploy an application.",
  inputSchema: z.object({ environment: z.string() }),
  approval: auto({ model: "typesafe-ai/jev" }),
  execute: ({ environment }) => deploy(environment),
});
```

评估模型会看工具名和输入是否有危险效果。标 caution、评审失败或输入不完整时，需要人工审批。分类器选项与数据处理见 [Human-in-the-loop](../tools/human-in-the-loop#approvals)。

## 运行时行为（白话）

1. `auto` 在**第一次** `step.started` 时评估——此时入站 prompt 已就绪、选中的语言模型尚未跑。
2. 同一 turn 里后续 tool-loop steps **复用**这次选择；新 turn 重新选；子 session 按自己的 prompt 路由。
3. 评估器最多拿到 8 条近期 user/assistant 文本消息，合计上限约 16,000 字符。没有 user 文本、或最新消息超限，会在打到 provider 之前失败。
4. 取消活跃 turn 会中止评估，且不会保留这次选择。

## 项目建议

- 候选名单写清楚「什么场景用谁」，评估器主要靠 description，不靠神秘 key。
- 敏感副作用不要只靠 `approval: auto()`；金融 / 不可逆操作仍建议 `always()` 或输入相关 policy。
- `evaluate` 适合工具内分类；Agent 级路由优先用 `auto`，避免在每个工具里重复写选模型逻辑。

## 常见误区

- 把 `eve/models` 的 `auto` 和 `eve/tools/approval` 的 `auto` 当成同一个导出——它们在不同子路径，职责不同。
- 以为 `auto` 会把 provider 凭据交给评估器——官方明确不会。
- 用 `defineDynamic` 的模型解析和 `auto` 混为一谈：前者是你自己写 resolver；后者是评估模型从 allowlist 里选。

## 接下来读什么

- [agent.ts](../agent-config)：静态模型、`defineDynamic` 与 `auto` 的入口
- [Human-in-the-loop](../tools/human-in-the-loop)：`approval: auto()` 与暂停协议
- [TypeScript API](../reference/typescript-api)：`eve/models`、`eve/ai` 导出一览
