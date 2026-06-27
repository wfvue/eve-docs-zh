---
title: "用例（Cases）"
description: "使用 test(t) 编写 single-turn 和 multi-turn eval，并让一个文件基于数据集展开多个 eval。"
---

# 用例（Cases）

默认情况下，每个 eval 文件就是一个带评分的 case；一个文件也可以通过默认导出数组，从一个数据集展开成多个 eval。Runner 会针对目标执行每个 `test(t)` 函数，捕获所有事件，并根据你记录的 [assertions](../assertions) 计算 verdict。无论是 single-turn、多轮、human-in-the-loop（HITL），还是基于数据集的 eval，形状都是一样的：一个 `async test(t)` 函数，负责驱动 Agent，并在函数内直接断言。

在添加 case 之前，先在 `evals/` 根目录创建必需的配置文件。如果不需要共享 judge、reporter、并发或 timeout 设置，空配置就够了：

```ts title="evals/evals.config.ts"
import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({});
```

## Single-turn evals

最常见的 eval 是发送一个 turn，然后断言回复。`t.send(input)` 会在这个 turn settle 后 resolve，`t.reply` 是最后一条 assistant message：

```ts title="evals/weather/brooklyn-forecast.eval.ts"
import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  async test(t) {
    await t.send("What is the weather in Brooklyn?");
    t.succeeded();
    t.check(t.reply, includes("Sunny"));
  },
});
```

有些 eval 只关心行为，不关心文本。此时可以只断言运行和工具调用，完全跳过内容检查：

```ts title="evals/weather/no-tools-for-greetings.eval.ts"
import { defineEval } from "eve/evals";

export default defineEval({
  async test(t) {
    await t.send("Hello!");
    t.succeeded();
    t.notCalledTool("get_weather");
  },
});
```

## 用目录组织 eval

Eval 的身份来自文件路径，所以目录就是分组机制。`evals/weather/brooklyn-forecast.eval.ts` 的 id 是 `weather/brooklyn-forecast`，执行 `eve eval weather` 会运行 `evals/weather/` 下的全部 eval。共享常量和 helper 放在相邻的非 eval 文件中，也就是任何不以 `.eval.ts` 结尾的文件：

```text
evals/
├── evals.config.ts
├── weather/
│   ├── shared.ts                    # helper，不是 eval
│   ├── brooklyn-forecast.eval.ts
│   └── no-tools-for-greetings.eval.ts
└── smoke.eval.ts
```

## Multi-turn evals

可以按顺序驱动多个 turn，用来测试分支、HITL approvals、结构化输出、附件或多个 session。因为断言写在函数里，所以中间值就是本地变量。你可以在下一轮覆盖回复之前先 judge 一个 draft，然后继续往下走。

```ts title="evals/draft-then-send.eval.ts"
import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  async test(t) {
    const draft = await t.send("Draft the follow-up email.");
    t.check(draft.message, includes("Best regards"));
    t.judge.autoevals.closedQA("professional tone", { on: draft.message }).atLeast(0.6);

    await t.send("Now send it.");
    t.calledTool("send_email");
  },
});
```

对中间 turn 使用 scoped assertions。当后续控制流依赖某个 value-level check 时，`t.require` 会记录一个 gate，并在失败时停止脚本：

```ts title="evals/session-continuity.eval.ts"
import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

export default defineEval({
  async test(t) {
    const first = await t.send("My favorite word is marigold.");

    const second = await t.send("Thanks for remembering.");
    await t.require(second.sessionId, equals(first.sessionId));

    t.succeeded();
    second.messageIncludes("Thanks for remembering.");
  },
});
```

## Drive API

`t` 会驱动主 session；`t.newSession()` 会返回同一 target 上的独立 `EveEvalSession`，它的事件也会进入同一个 run-level assertions。

- `t.send(input)`：发送一个 turn，并等待它 settle。它接受和 `ClientSession.send()` 相同的输入，可以是字符串，也可以是结构化 message；resolve 后返回一个 turn，带有 `.message` 和 `.expectOk()`。
- `t.sendFile(text, path, mediaType?)`：把一个本地文件作为 data URL 附加。
- `t.requireInputRequest(filter?)`：记录一个 gate，要求刚好存在一个 pending request，并返回它。Filter 可以匹配工具名、action input、prompt、display 和 option ids。
- `t.respond(...responses)`：回答指定的 pending input requests，并把回答作为下一个 turn 发出去。
- `t.respondAll(optionId)`：用同一个 option 回答所有 pending input requests，并发送这些 responses 作为下一个 turn。
- `t.reply`：最后一条 assistant message（或 `null`）；`t.sessionId` 是当前 session id；`t.events` 是目前捕获到的完整 typed event stream。

每个 `send`（以及 `respond` / `respondAll`）都会 resolve 成一个不可变 turn，包含 `.message`、`.data`、`.events`、`.inputRequests`、`.toolCalls`、`.sessionId`、`.status` 和 `.expectOk()`。使用 `.sessionId` 可以关联 turn，或把后续工作附加到产生该 turn 的 session。`expectOk()` 只会在该 turn 以 failed 结束时抛出；一个 session 保持 open、等待下一条消息，是成功 turn 的正常结束状态。

只有当下一步操作依赖中间 turn 必须成功时，才需要使用 `expectOk()`。最终的 `t.succeeded()` 已经会记录一个完整 run 的 gate。

如果想针对当前目标有意跳过一个 eval，请在发送消息或记录断言之前调用 `t.skip(reason)`。Skipped eval 会单独报告，不影响退出码。

每个 session 的 events 都会被捕获到结果和 artifacts 里。`t.log(message)` 会把 debug 行写入 eval artifact；传入 `--verbose` 时，也会在运行过程中同步输出到 stdout。`t.signal` 是一个 `AbortSignal`，会在 timeout 时触发。

如果要驱动由 channel webhook 或 schedule 在 eval 外部创建的 session，请看 [Targets](../targets)。

## 数据集：导出数组

如果想让一个文件基于数据集展开多个 eval，可以默认导出一个由 `defineEval(...)` 组成的数组。Eval module 是 ESM，因此 top-level `await` 可以加载任意数据。Ids 会根据文件名加上数组顺序里的 zero-padded index 派生出来，例如 `sql/0000`、`sql/0001` 等。`loadJson`、`loadYaml`（来自 `eve/evals/loaders`）会相对于应用根目录解析 fixture 文件：

```ts title="evals/sql.eval.ts"
import { defineEval } from "eve/evals";
import { loadYaml } from "eve/evals/loaders";
import { equals } from "eve/evals/expect";

const doc = await loadYaml("evals/data/cases.yaml");
const rows = doc.evals as readonly { task: string; prompt: string; sql: string }[];

export default rows.map((row) =>
  defineEval({
    description: row.task,
    async test(t) {
      await t.send(row.prompt);
      t.succeeded();
      t.check(t.reply, equals(row.sql));
    },
  }),
);
```

这些 loaders 是给 fixture 用的，不建议在运行时 Agent 代码里使用。

## 接下来读什么

- [Assertions](../assertions)：断言 eval 做了什么
- [Judge](../judge)：用 LLM judge 给质量评分
- [TypeScript client](../../guides/client/messages)：eval sessions 所基于的 send/turn 协议
