---
title: "Judge"
description: "通过 t.judge.autoevals 使用 LLM judge 给 eval 评分，在断言上设置阈值，并配置 judge model。"
---

# Judge

当没有确定性 [assertion](./assertions) 能表达什么叫“好”时，例如事实正确性、摘要质量或自由形式标准，可以用 LLM judge 给 run 评分。`t.judge.*` 是唯一由模型支撑的 assertion surface，并且它使用的 judge model 会和被测试的 Agent 分开解析。Eve 只会用它评分，绝不会用它替换被测 Agent。

```ts
import { defineEval } from "eve/evals";

export default defineEval({
  async test(t) {
    await t.send("Explain quantum tunneling to a 10-year-old.");
    t.succeeded();
    t.judge.autoevals.closedQA("uses no math beyond arithmetic").atLeast(0.8);
  },
});
```

## Graders

Judges 位于 `t.judge.autoevals` 下。这个 namespace 来自 [Braintrust autoevals](https://github.com/braintrustdata/autoevals) grader family，因此 factuality 和 closedQA 的语义来自 autoevals，而不是 Eve 自己发明的。每个 grader 默认对 `t.reply` 评分，并且默认是 soft（跟踪但不 gate）：

| Grader | 评分内容 |
| --- | --- |
| `t.judge.autoevals.factuality(expected)` | 回复与 expected answer 的事实一致性，使用 A–E buckets |
| `t.judge.autoevals.summarizes(expected)` | 回复对 expected text 的摘要质量 |
| `t.judge.autoevals.closedQA(criteria)` | 回复是否满足一个自由形式 yes/no 标准，不需要 expected answer 匹配 |
| `t.judge.autoevals.sql(expected)` | 两段 SQL 语句的语义等价性 |

Reference 或 criteria 是第一个位置参数。后面可以跟一个 options object：

- `on` 是要评分的值，默认是 `t.reply`。也可以传入中间草稿或解析后的值。
- `model` 和 `modelOptions` 是单次 judge 调用的覆盖配置，见下文。

```ts
const draft = await t.send("Draft the welcome email.");
t.judge.autoevals.closedQA("professional tone", { on: draft.message }).atLeast(0.6);
```

## Soft scoring 和 thresholds

Judge assertions 是 soft，所以 threshold 直接挂在 assertion handle 上，不需要单独的 thresholds map：

- **没有 threshold**：只记录。分数会进入 reports 和 artifacts，永远不会让 eval 失败。适合观察指标但不阻断。
- `.atLeast(threshold)`：soft bar。低于阈值会把 eval 标记为 `scored`，只有在 `eve eval --strict` 下才会 fatal。
- `.gate(threshold)`：把 judge 提升成硬 gate，低于阈值会直接让 eval 失败。

```ts
t.judge.autoevals.closedQA("cites a source"); // 仅跟踪，永不失败
t.judge.autoevals.closedQA("cites a source").atLeast(0.6); // soft，--strict 下低于 0.6 失败
t.judge.autoevals.factuality(reference).gate(0.8); // 0.8 的硬 gate
```

一次 judge assertion 会运行一次 judge，并消耗 token。因此只有在确定性方法表达不了时才使用 judge。Judge 调用会在记录 assertion 时启动，runner 会在 finalize 阶段等待所有 judge 结束；assertion handle 本身有意设计成不可 await。

## 配置 judge model

Runner 构造 `t` 时会解析一次 judge model。它 **永远不是** 被测 Agent 的 model。解析优先级有三层，越内层优先级越高：

1. **Per-call**：`t.judge.autoevals.closedQA("…", { model, modelOptions })`。
2. **Per-eval**：`defineEval({ judge: { model, modelOptions }, test })`。
3. **Project default**：在 `evals.config.ts` 里 `defineEvalConfig({ judge: { model, modelOptions } })`。

```ts title="evals/evals.config.ts"
import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  judge: { model: "openai/gpt-5.4-mini" }, // 本 eval tree 的默认 judge
});
```

```ts title="evals/quantum.eval.ts"
import { defineEval } from "eve/evals";

export default defineEval({
  judge: { model: "anthropic/claude-opus-4.8" }, // 当前 eval 使用更强 judge
  async test(t) {
    await t.send("Explain quantum tunneling to a 10-year-old.");
    t.judge.autoevals.factuality(reference).atLeast(0.7);
    t.judge.autoevals.closedQA("is concise", { model: "anthropic/claude-haiku-4.5" }); // 单次调用使用更便宜 judge
  },
});
```

`evals.config.ts` 中的 `judge` 是可选的。一整棵完全确定性的 eval tree 可以省略它。如果在没有解析到 judge model 的情况下调用 `t.judge.*`，会记录一个 failed gate：runner 会在 `test` 函数执行后对 assertion 评分，缺失 model 会抛出，并让 eval 以该消息失败。

**字符串 model id**（例如 `"anthropic/claude-opus-4.8"`）会走 Vercel AI Gateway，并要求环境里有 `AI_GATEWAY_API_KEY` 或 `VERCEL_OIDC_TOKEN`。**AI SDK `LanguageModel` instance** 会被直接使用。配置了 model 但没有 credentials 时，由 judge 支撑的 eval 会显式 skipped，而不是失败，因此 run 会报告 skip，避免伪错误。Provider-specific judge settings 可以通过 `modelOptions.providerOptions` 传入。

## 接下来读什么

- [Assertions](./assertions)：确定性的 run-level 和 value assertions
- [Reporters](./reporters)：把 judged scores 发到 Braintrust experiments
- [Targets](./targets)：judge-backed evals 如何跑本地或远程目标
