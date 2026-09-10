---
title: "报告器（Reporters）"
description: "把 eval 结果发送到 Braintrust、Datadog Experiments 或 JUnit XML。Eve 自己运行并评分全部 eval。"
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

Reporter config 可以接收可选的 `projectName` 和 `experimentName`，还可以指定一个 base experiment（通过 name 或 id）用于 diff。Gate assertions 会以 `gate:` 前缀记录为 binary scores，这样 experiments 可以像 diff soft-score regression 一样 diff gate regression。重复名称会加 `#2`、`#3` 等后缀；用 `.label(name)` 可以给它们更有意义的名字。失败断言细节写在 Braintrust metadata 的 `eveFailedAssertions`；观察到的 traces 写在 `eveTraceIds` 与 `eveTraceContexts`。Eval 的 `metadata` 也会随 reporters 一起传递。

一个 reporter instance 会观察引用它的 evals。把同一个实例共享给多个 eval（来自 config、`shared.ts` export，或数据集数组里的每一项），这些结果会进入同一个 experiment。即使某个 eval 同时列出了 config reporter，也不会重复上报。

Braintrust 需要在应用里安装它的 SDK，并提供环境 credentials：安装 `braintrust` 包（`npm install braintrust`），并设置 `BRAINTRUST_API_KEY`。传入 `--skip-report` 可以运行 eval 但不发送结果，同时也会禁用 config reporters，适合本地迭代。

## Datadog

`Datadog(...)` 会把 eval assertion scores 上传到 Datadog LLM Observability Experiment。通常把一个实例放在 config 里，覆盖整个 run：

```ts title="evals/evals.config.ts"
import { defineEvalConfig } from "eve/evals";
import { Datadog } from "eve/evals/reporters";

export default defineEvalConfig({
  reporters: [Datadog({ projectName: "weather-agent" })],
});
```

Reporter 会创建一个 Datadog Experiment，每个完成的 eve eval 提交一条 synthetic experiment span，把该 eval 的 assertion scores 关联为 experiment metrics，并在 run 结束后打印 Experiment URL。未开启 input recording 时，外部 Experiment 用占位 dataset，span 随 eval 完成提交。设 `recordInputs: true` 时，reporter 会在 evals 全部结束后创建并推送带版本的 Datadog dataset、为每个 eval 加一条 record、再以该 dataset 版本启动 Experiment，并把 dataset record id 传给对应 span，同时打印 Dataset 与 Experiment URL。之所以要缓冲，是因为命令式 eval 的第一次 `t.send(...)` 输入要等该 eval 跑完才知道。`dd-trace` 负责生成 dataset record、experiment trace 与 experiment span 标识；reporter **不会**改写或链接 Agent 运行时的 OpenTelemetry spans。

Assertion metrics 默认用描述性断言名：字母、数字、下划线、连字符以外的字符会规范成下划线，gate 标签加 `gate_` 前缀，重复或保留名加数字后缀。例如 `succeeded` 变成 `gate_succeeded`，`calledTool(get_stock_quote)` 变成 `gate_calledTool_get_stock_quote`。作者可在断言 handle 上用 `.label("stable name")` 选定稳定 metric 名。断言名可能含作者写的期望，导出敏感 eval 前先审查。只有目标也被批准接收原始断言名标签和失败断言消息时，才设 `recordAssertionDetails: true`。

Datadog 需要在应用里安装 `dd-trace`，并配置 Datadog credentials。官方对照版本为 `dd-trace@6.13.0`：`npm install dd-trace@6.13.0`，并按需设置 `DD_API_KEY`、`DD_APP_KEY`、`DD_SITE`。默认只记录 assertion scores、eval metadata 和 target URL 的 origin。若目标也被批准接收 prompts / outputs / 作者期望 / 执行错误信息，再分别打开 `recordInputs`、`recordOutputs`、`recordExpectedOutputs`、`recordErrors`。`recordInputs` 会把 eval 输入写进关联的 dataset record 与 experiment span；输入取自第一次 `t.send(...)`，没有 message event 时回退到 eval description。开启 `recordExpectedOutputs` 时，期望输出取自 eval `metadata.expectedOutput` / `metadata.expected` / `metadata.expected_output`，并同时写入 dataset record 与 experiment span；没有作者期望时，仅含输入的 dataset record 仍然有效。这些 expected-output key 不会进入通用 metadata payload。Target URL 的 credentials、path、query、fragment **永远不会**上报。

## JUnit

`JUnit({ filePath })` 会写出 JUnit XML，用于 CI annotations。CLI 参数 `--junit <path>` 也能做同样的事，而且通常更合适，因为 CI 拥有输出路径，而不是 eval 文件本身：

```bash
eve eval --strict --junit .eve/junit.xml
```

每个 eval 会变成一个按路径派生 id 命名的 `<testcase>`；失败的 gates 和 execution errors 会变成 failures，而 `t.skip(reason)` 会生成 JUnit `<skipped>` 结果。

## 自定义 reporters

自定义 reporter 需要实现 `eve/evals/reporters` 导出的 `EvalReporter` interface，并接收和内置 reporters 一样的结构化结果。Runner 会调用这些 lifecycle methods；每个方法都可以返回 promise，用于远程上传这类异步工作：

```ts
interface EvalReporter {
  onRunStart(evaluations: readonly EveEval[], target: EveEvalTarget): void | Promise<void>;
  onEvalStart?(event: EveEvalStartEvent): void | Promise<void>;
  onSessionStart?(event: EveEvalSessionStartEvent): void | Promise<void>;
  onEvalComplete(result: EveEvalResult, context?: EveEvalCompleteContext): void | Promise<void>;
  onRunComplete(summary: EveEvalRunSummary): void | Promise<void>;
}
```

`onRunStart` 在任何 eval 运行之前调用一次；`onRunComplete` 在整个 run 完成后调用一次，并携带聚合 summary。在这一次 run 里：

- `onEvalStart`：eval 被调度时触发，含定义、target 与开始时间
- `onSessionStart`：eve 收到该 session 的第一个 trace context 后触发一次，含 `sessionId`、`primary`，以及带 `traceId` / `spanId` / `traceFlags` 的 `traceContext`
- `onEvalComplete`：携带 checks、scores、verdict；runner 还会提供 `context`，其中包括该 eval 各 session 收集到的全部 distinct trace contexts（同样可从 `result.result.traceContexts` 读）

一个 eval 可能创建多个 session，长 session 也可能产生多条 traces，所以完成时暴露的是列表而不是单个 trace id。`onEvalStart` 还没有 trace，因为 Agent session 尚未启动。若 target 未配置 tracing，则不会触发 `onSessionStart`，完成时的 trace 列表为空。

即便多个 eval 并发，单个 eval 的 reporter 回调仍保持顺序：eval start → traced session starts → completion。只有目标输出没有被内置 reporters 覆盖时，才需要自定义 reporter。每次 run 下 `.eve/evals/` 里的 artifacts 已保留 trace contexts 与结果，足够临时检查。

## 接下来读什么

- [Running evals](./running)：console output、`--json` 和 artifacts
- [Judge](./judge)：报告里的分数是什么意思
