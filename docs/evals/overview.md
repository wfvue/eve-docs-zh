---
title: "评测概览（Overview）"
description: "用 defineEval 为 Eve Agent 定义可重复、可评分的检查，并通过 eve eval 运行。"
---

# 评测概览（Overview）

Eval 是一种带评分的检查：它会让你的 Agent 运行真实 session，然后对结果打分。这样当你修改 prompt 或 tool 时，就能及时发现回归。你可以驱动 Agent 完成一个或多个 turn，断言它做了什么：运行是否完成、是否调用了正确工具、回复是否包含正确文本；也可以把结果发送到 Braintrust。

Evals 会走用户实际访问的同一套 HTTP surface。Runner 会启动一个真实 Agent server，或者指向一个已有 server，通过 [TypeScript client](../guides/client/overview) 协议驱动 session，并对返回结果评分。因此，一个通过的 eval 表示：Agent 能启动、能接受请求，并产生了你断言的结果。

## `defineEval`

Eve 会在应用根目录的 `evals/` 下发现 `.eval.ts` 文件。默认情况下，一个文件就是一个 eval。一个文件也可以默认导出数组，用来基于数据集展开多个 eval，见 [Cases](./cases)。文件路径就是 eval 的身份，所以不需要手写 `id` 或 `name`。目录用于分组：`evals/weather/brooklyn-forecast.eval.ts` 的 id 是 `weather/brooklyn-forecast`。

```text
my-agent/
├── agent/
├── evals/
│   ├── evals.config.ts
│   ├── smoke.eval.ts
│   └── weather/
│       ├── brooklyn-forecast.eval.ts
│       └── no-tools-for-greetings.eval.ts
└── package.json
```

一个 eval 本质上就是一个 `async test(t)` 函数。你用 `t` 驱动 Agent，也用同一个 `t` 对运行结果做断言：

```ts title="evals/weather/brooklyn-forecast.eval.ts"
import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Basic message and tool-usage coverage for the weather agent.",
  async test(t) {
    await t.send("What is the weather in Brooklyn?");
    t.succeeded();
    t.calledTool("get_weather");
    t.check(t.reply, includes("Sunny"));
  },
});
```

`test` 是唯一必填字段。其它字段都是可选的：`description`、`judge`、`tags`、`metadata`、`timeoutMs` 和 `reporters`。初始化模板会把 `evals/**/*.ts` 加入 `tsconfig.json`，因此 eval 代码会和应用一起做类型检查。

## `evals.config.ts`

每个 `evals/` 目录根部都需要且只能有一个 `evals.config.ts`。它声明所有 eval 共享的默认值：

```ts title="evals/evals.config.ts"
import { defineEvalConfig } from "eve/evals";
import { Braintrust } from "eve/evals/reporters";

export default defineEvalConfig({
  judge: { model: "openai/gpt-5.4-mini" },
  reporters: [Braintrust({ projectName: "my-agent" })],
});
```

所有配置都是可选的。`judge` 设置 [LLM-as-judge](./judge) 断言（`t.judge.*`）默认使用的模型；如果整棵 eval 树都是确定性评测，可以省略它。`reporters`、`maxConcurrency` 和 `timeoutMs` 则补齐其它默认值。配置里的 `reporters` 会观察本次运行中的每个 eval，所以应该在这里放一个 `Braintrust()`，而不是给每个 eval 都重复写一遍。CLI 参数（如 `--max-concurrency`、`--timeout`）和单个 eval 上的值优先级高于配置默认值。

## 确定性的 fixture models

当 eval fixture 只想测试 Eve runtime，而不想真正调用模型 provider 时，可以使用 `mockModel`。静态 fixture 可以一行搞定：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

export default defineAgent({
  model: mockModel("A deterministic reply"),
});
```

当回复依赖对话内容时，可以传入 callback。callback 会收到 Eve 提供的 prompt 视图，包括 `lastUserMessage`、`userMessages`、`userMessageCount`、可用 `tools` 和已有 `toolResults`：

```ts title="agent/agent.ts"
export default defineAgent({
  model: mockModel(
    ({ lastUserMessage, userMessageCount }) => `Turn ${userMessageCount}: ${lastUserMessage}`,
  ),
});
```

callback 也可以返回 `{ text, toolCalls, usage }`，用于确定性的工具循环或显式 token 计数。只有当 fixture 还需要自定义模型身份时，才需要使用 options 形式：

```ts title="agent/agent.ts"
model: mockModel({
  modelId: "weather-script",
  provider: "my-fixtures",
  respond: ({ toolResults }) =>
    toolResults.length === 0
      ? { toolCalls: [{ name: "get_weather", input: { city: "Brooklyn" } }] }
      : `Weather: ${JSON.stringify(toolResults[0]?.output)}`,
});
```

如果没有提供 response，`mockModel()` 默认使用 `"Mock response"`。它支持 generated 和 streamed 两种回复，能派生确定性的 response metadata，并估算 token usage。因为 model 是 Agent 定义的一部分，所以它适合专门的 fixture agent；无论 fixture 在本地还是部署目标上运行，都会保持 mocked。

## `t` 上下文

`t` 既是驱动器，也是断言入口。这里没有单独的 `input`、`run`、`checks` 或 `scores` 字段。你写普通控制流，一边发送 turn，一边在函数内直接断言。

- **驱动 Agent**：`t.send(...)`、`t.respond(...)`、`t.respondAll(...)`、`t.sendFile(...)`、`t.requireInputRequest(...)`、`t.newSession()`。通过 `t.reply`（最后一条 assistant message）、`t.sessionId` 和 `t.events` 读取返回内容。见 [Cases](./cases)。
- **断言**有三类 surface，下面会介绍。

## 三种断言 surface

每种 surface 对应不同类型的判断：

- **Scoped methods** 读取 `t` 上的最终完整 run；在独立 session 上调用时，会 snapshot 该 session；在不可变的 `EveEvalTurn` 上调用时，会检查该 turn。见 [Assertions](./assertions)。
- **`t.check(value, assertion)`** 用 `eve/evals/expect` 中的确定性 builder 对显式值打分，例如 `t.check(t.reply, includes("sunny"))`。可以检查 `t.reply`、中间草稿、解析后的 JSON 或任何其它值。见 [Assertions](./assertions)。
- **`t.judge.autoevals.*`** 是 LLM-as-judge surface，例如 `t.judge.autoevals.closedQA("cites a source")`。默认会对 `t.reply` 评分，使用配置好的 judge model，而不是被测试的 Agent 模型。见 [Judge](./judge)。

## Gate 与 soft

每个断言都会返回一个可链式调用的 handle，因此严重程度直接挂在断言本身上，不需要单独的 thresholds map。

- **Gates** 是硬门槛。gate 失败会让 eval 标记为 `failed`，并让 `eve eval` 以非零状态码退出。Run-level methods、`includes`、`equals` 和 `matches` 默认都是 gate。
- **Soft** 断言是可跟踪数据。它们会进入 reports 和 artifacts；如果低于阈值，会把 eval 标记为 `scored`（可见但不致命，除非传入 `--strict`）。`similarity` 和所有 `t.judge.*` 断言默认都是 soft。没有阈值的 soft 断言只会被记录，永远不会失败。

可以按断言覆盖默认值：`.gate(threshold?)` 提升为硬 gate，`.soft(threshold?)` 降级为可跟踪，`.atLeast(threshold)` 表示带阈值的 soft 断言。

```ts
t.succeeded(); // gate
t.calledTool("get_weather").soft(); // 作为指标记录，不阻断
t.judge.autoevals.closedQA("cites a source"); // soft，仅记录，无阈值
t.judge.autoevals.factuality(reference).atLeast(0.7); // soft，--strict 下低于 0.7 会失败
```

如果后续脚本逻辑必须依赖某个 gate 先通过，可以使用 `await t.require(value, assertion)`。如果某个目标能力暂不支持，并且你想有意跳过当前 eval，可以把 `t.skip(reason)` 作为第一步。

## 使用 `eve eval` 运行评测

```bash
eve eval                       # 针对本地 dev server 运行所有发现的 eval
eve eval weather               # 运行单个 eval，或 evals/weather/ 下所有 eval
eve eval --url https://<app>   # 指向已有 server 或部署目标
```

退出码 `0` 表示每个 eval 都通过了 gate。完整参数、退出码和 CI 建议见 [Running evals](./running)。

## 一个好的 baseline

大多数应用只需要少量 smoke evals 就能起步。用 `t.succeeded()` 加一两个内容检查断言行为，把数据集 fixture 放在 `evals/data/` 里；只有当你需要模糊评分或共享结果 review 时，再使用 judge 或 Braintrust。在 CI 中，建议运行 `eve eval --strict`，这样 soft threshold miss 也会阻断构建。

## 接下来读什么

本节其它页面会覆盖每个部分：

- [Cases](./cases)：single-turn eval、多轮 scripted eval、dataset fan-out
- [Assertions](./assertions)：run-level methods 和 `t.check` value assertions，包括 matchers 和 severity
- [Judge](./judge)：LLM-as-judge 评分和 judge model
- [Targets](./targets)：同一组 eval 文件如何跑本地或远程目标
- [Reporters](./reporters)：Braintrust experiments 和 JUnit XML
- [Running evals](./running)：`eve eval` CLI、退出码和 artifacts
- [Tools](../tools)：大多数 eval 会断言的工具 surface
