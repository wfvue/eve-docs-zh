---
title: "Judge"
description: "用 evaluation model 通过 criteria、类型化问题或批次给 eval 打分，并为每条断言设阈值。"
---

# Judge

官方原文：[Judge](https://eve.dev/docs/evals/judge)。

当确定性 [assertion](./assertions) 表达不了「什么叫好」时，用 `t.judge(...)`。它调用 [`evaluate`（`eve/ai`）](../guides/evaluate#官方说明在工具里调用-evaluate)，默认 `typesafe-ai/jev`（TypeSafe AI 的 [Jev evaluation model](https://vercel.com/i/what-is-jev)）。Judge 与被测 Agent **分开**，只用于评分。

```ts
import { defineEval } from "eve/evals";

export default defineEval({
  async test(t) {
    await t.send("Explain quantum tunneling to a 10-year-old.");
    t.succeeded();
    t.judge("The response uses no math beyond arithmetic.").atLeast(0.8);
  },
});
```

不必先写 judge 配置。凭据见下文 [配置 judge model](#配置-judge-model)。

## Graders

`t.judge` 接受 criteria 字符串、单个类型化问题，或一批命名问题。字符串会变成「回复是否满足这些标准」的 boolean 题。单个问题返回一个 assertion handle；批次为每个问题返回一个 handle。

| Question | Assertion score |
| --- | --- |
| Criteria 字符串或 `boolean` | 返回的为真概率，0–1 |
| `score` | 返回的 rubric 位置 ÷ 最高 level index |
| `choice` | 所选选项等于 `expected` 时为 1，否则 0 |

Boolean 分数是模型估计，**不保证**校准后的置信度。Rubric 至少两级，从差到好。SDK 可能返回分数位置；eve 归一化到断言阈值用的 0–1。

```ts
t.judge({
  type: "score",
  instructions: "Grade the response's clarity.",
  criteria: ["Unclear", "Mostly clear", "Clear and concise"],
})
  .label("clarity")
  .atLeast(0.6);
```

## Soft scoring 与阈值

默认 soft（跟踪但不 gate）。用 `.atLeast` / `.atMost` 等阈值方法把判断变成硬门。详见 [Assertions](./assertions)。

## 配置 judge model

解析顺序：

1. 每次调用：`t.judge("…", { model, modelOptions })`
2. 每个 eval：`defineEval({ judge: { model, modelOptions }, test })`
3. 项目默认：`defineEvalConfig({ judge: { model, modelOptions } })`
4. `evaluate` 的默认模型，当前为 `typesafe-ai/jev`

per-eval 的 `judge` 会替换项目级配置；per-call 字段再覆盖。`judge` 与其 `model` 可选；纯确定性 eval 不会发 evaluation 请求。

```ts title="evals/evals.config.ts"
import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  judge: { model: "typesafe-ai/jev" },
});
```

字符串 ID 走 AI SDK 默认 provider；未配置时走 Vercel AI Gateway。Gateway 用 `AI_GATEWAY_API_KEY` 或 Vercel OIDC；`evaluate` 也会尊重 eve 已有的本地 Gateway 连接。显式 provider evaluation model 用该 provider 的凭据：

```ts
import { openai } from "@ai-sdk/openai";

t.judge("The response addresses the request.", {
  model: openai.evaluationModel("gpt-6-luna"),
  modelOptions: { providerOptions: { openai: { reasoningEffort: "high" } } },
});
```

请用 provider 的 `evaluationModel` factory，**不要**传语言模型实例。Gateway 接受原生 evaluation 模型如 `typesafe-ai/jev`；传入 `openai/gpt-6-luna` 这类语言模型 ID **不会**自动选 OpenAI adapter——语言模型请用上面的 evaluation-model 实例。

缺凭据、非法答案、不支持的问题类型与 provider 错误都会变成失败的 gate（即使是 tracked-only 判断），不会静默 skip 或换模型。

## 诊断与迁移

报告使用 `judge.boolean` / `judge.score` / `judge.choice`；批次断言名还带 question key。

> **官方说明（BREAKING）：** autoevals graders 已移除。把 `t.judge.autoevals.closedQA(criteria, options)` 换成 `t.judge(criteria, options)`。分数现在是概率而非二元 yes/no，请对照样例重看阈值。事实性 / 摘要 / SQL 等价等请写显式问题，并把参考放进共享 state。

把已配置的语言模型实例改成 evaluation model 实例。`modelOptions.providerOptions`、assertion labels 与阈值方法仍可用。[Braintrust reporting](./reporters) 继续独立接受 judge 分数。

## 接下来读什么

- [Assertions](./assertions)
- [Automatic model selection / evaluate](../guides/evaluate)
- [Evals overview](./overview)
