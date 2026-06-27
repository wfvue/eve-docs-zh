---
title: "报告器（Reporters）"
description: "把 eval 结果发送到 Braintrust experiments 或 JUnit XML。Eve 自己运行并评分全部 eval。"
---

# 报告器（Reporters）

Eve 会自己运行并评分全部 eval；reporters 负责把结果发送出去。CLI 默认会打印 console summary（每个 eval 一行，包含失败断言及其消息），而 `eve/evals/reporters` 中的 reporters 可以在此基础上增加输出目标。

你需要自行确认任何 observability 或 eval provider 是否被允许接收导出的数据。

Reporters 可以挂在两个位置。通常做法是在 `evals.config.ts` 中声明它们，这样它们会观察本次 run 的 **每个** eval，适合共享目标，例如一个 Braintrust experiment，避免在每个文件里重复声明 reporter。也可以把 reporters 写在单个 eval 的 `reporters` 字段上，把某个输出目标限制到该 eval，或限制到共享同一个 reporter 实例的一组 eval。

## Braintrust

`Braintrust(...)` 会把 eval 结果上传到 Braintrust experiments。通常把一个实例放在 config 里，让它覆盖整个 run：

```ts title="evals/evals.config.ts"
import { defineEvalConfig } from "eve/evals";
import { Braintrust } from "eve/evals/reporters";

export default defineEvalConfig({
  judge: { model: "openai/gpt-5.4-mini" },
  reporters: [Braintrust({ projectName: "weather-agent" })],
});
```

只想给部分 eval 配一个目标？可以挂在单个 eval 上：

```ts title="evals/brooklyn-forecast.eval.ts"
import { defineEval } from "eve/evals";
import { Braintrust } from "eve/evals/reporters";

export default defineEval({
  reporters: [Braintrust({ projectName: "weather-agent" })],
  async test(t) {
    await t.send("What is the weather in Brooklyn?");
    t.succeeded();
  },
});
```

Reporter config 可以接收可选的 `projectName` 和 `experimentName`，还可以指定一个 base experiment（通过 name 或 id）用于 diff。Gate assertions 会以 `gate:` 前缀记录为 binary scores，这样 experiments 可以像 diff soft-score regression 一样 diff gate regression。Eval 的 `metadata` 也会随 reporters 一起传递。

一个 reporter instance 会观察引用它的 evals。把同一个实例共享给多个 eval（来自 config、`shared.ts` export，或数据集数组里的每一项），这些结果会进入同一个 experiment。即使某个 eval 同时列出了 config reporter，也不会重复上报。

Braintrust 需要在应用里安装它的 SDK，并提供环境 credentials：安装 `braintrust` 包（`npm install braintrust`），并设置 `BRAINTRUST_API_KEY`。传入 `--skip-report` 可以运行 eval 但不发送结果，同时也会禁用 config reporters，适合本地迭代。

## JUnit

`JUnit({ filePath })` 会写出 JUnit XML，用于 CI annotations。CLI 参数 `--junit <path>` 也能做同样的事，而且通常更合适，因为 CI 拥有输出路径，而不是 eval 文件本身：

```bash
eve eval --strict --junit .eve/junit.xml
```

每个 eval 会变成一个按路径派生 id 命名的 `<testcase>`；失败的 gates 和 execution errors 会变成 failures，而 `t.skip(reason)` 会生成 JUnit `<skipped>` 结果。

## 自定义 reporters

自定义 reporter 需要实现 `eve/evals/reporters` 导出的 `EvalReporter` interface，并接收和内置 reporters 一样的结构化结果。Runner 会调用三个 lifecycle methods，每个方法都可以返回 promise，用于远程上传这类异步工作：

```ts
interface EvalReporter {
  onRunStart(evaluations: readonly EveEval[], target: EveEvalTarget): void | Promise<void>;
  onEvalComplete(result: EveEvalResult): void | Promise<void>;
  onRunComplete(summary: EveEvalRunSummary): void | Promise<void>;
}
```

`onRunStart` 在任何 eval 运行之前调用一次；`onEvalComplete` 在每个被观察的 eval 完成后调用，并携带它的 checks、scores 和 verdict；`onRunComplete` 在整个 run 完成后调用一次，并携带聚合 summary。只有当目标输出没有被内置 reporters 覆盖时，才需要自定义 reporter。每次 run 下 `.eve/evals/` 里的 artifacts 已经会捕获全部信息，足够临时检查使用。

## 接下来读什么

- [Running evals](./running)：console output、`--json` 和 artifacts
- [Judge](./judge)：报告里的分数是什么意思
