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

最常见的 eval 是发送一个 turn，然后断言回复。`t.send(input)` 会在这个 turn settle 后 resolve；返回 turn 的 `.message` 就是 assistant 回复：

```ts title="evals/weather/brooklyn-forecast.eval.ts"
import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  async test(t) {
    const turn = await t.send("What is the weather in Brooklyn?");
    t.succeeded();
    t.check(turn.message, includes("Sunny"));
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

    await draft.session.send("Now send it.");
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

    const second = await first.session.send("What is my favorite word?");
    await t.require(second.sessionId, equals(first.sessionId));

    t.succeeded();
    second.messageIncludes("marigold");

    t.judge.autoevals
      .closedQA("The assistant remembers the user's favorite word across turns", {
        on: first.session.transcript,
      })
      .atLeast(0.8);
  },
});
```

## Drive API

每次 `t.session()` 或 `t.send()` 都会创建**新的独立对话**。要续跑，请通过返回的 session handle。所有 session 的事件都进入同一套 run-level assertions。

- `t.send(message, options?)`：发送一个 turn，并等待它 settle。它匹配 `ClientSession.send()`，resolve 后返回一个 turn，带有 `.message` 和 `.expectOk()`。
- `t.start(message)`：启动一个文本 turn，但在 server 接受后立刻返回。返回的 live turn 暴露 `.sessionId`、`.waitForEvent(...)`、`.cancel()` 和 `.result()`，用来协调仍在运行的工作。
- `t.cancel()`：请求协作取消主 session 的活跃 turn。`accepted` 和 `no_active_turn` 都是成功结果。
- `t.sendFile(text, path, mediaType?)`：把一个本地文件作为 data URL 附加。
- `t.requireInputRequest(filter?)`：记录一个 gate，要求刚好存在一个 pending request，并返回它。Filter 可以匹配工具名、action input、prompt、display 和 option ids。
- `t.respond(responses, options?)`：回答指定的 pending input requests，并把回答作为下一个 turn 发出去。
- `t.respondAll(optionId)`：用同一个 option 回答所有 pending input requests，并发送这些 responses 作为下一个 turn。
- `session.events`：该 session 捕获的事件；`session.transcript`：按 turn 顺序格式化观察到的 user/assistant 消息。
- `t.session(options?)`：创建 session 但不启动 turn、不消费 stream；在 `202` 时 resolve 为带 `.sessionId` / `.state` 的 `EveEvalSession`。
- `t.send(message, options?)`：一次创建 session 并发送首条消息，等 turn settle；返回的 turn 带 `.session` / `.message` / `.expectOk()`。
- `session.send` / `session.start` / `session.cancel` / `session.respond` / `session.respondAll` / `session.sendFile` / `session.requireInputRequest`：在该 session 上操作。

Transcript 使用 `User:` 和 `Assistant:` 标签，用空行分隔。它排除 reasoning、tool calls、tool results 和其它 session 的消息。每个 turn settle 后更新，所以在 `await session.send(...)`、`await session.respond(...)` 或 `await live.result()` 之后再读。

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
      const turn = await t.send(row.prompt);
      t.succeeded();
      t.check(turn.message, equals(row.sql));
    },
  }),
);
```

这些 loaders 是给 fixture 用的，不建议在运行时 Agent 代码里使用。


## 预热 session（Prewarming）

用 `t.session()` 在首条消息前创建 session：

```ts title="evals/prewarm.eval.ts"
import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

export default defineEval({
  async test(t) {
    const session = await t.session();
    const turn = await session.send("Greet Alice briefly.");
    await t.require(turn.sessionId, equals(session.sessionId));
    turn.event("session.started", { count: 1 });
    turn.event("turn.started", { count: 1, data: { turnId: "turn_0" } });
    t.succeeded();
  },
});
```

Acceptance **不是**初始化屏障；首条消息才跑 session 初始化。TypeScript client 会在 workflow inbox 仍在启动时做有界重试。每次调用创建独立 session（含并发）。已接受但未发消息的 session 也会进入 eval 结果与超时清理。

## 迁移现有 evals

把 `t.newSession()` / `t.prewarm()` 换成 `const session = await t.session()`。连续的 `t.send()` 改成 `session.send()`，或从第一次返回的 turn 走 `turn.session.send()`。身份、cursor、events、transcript 从 `session` 读；回复从 `turn.message` 读。`respond` / `requireInputRequest` / `cancel` 也从 `t` 挪到 `session`。

## 接下来读什么

- [Assertions](../assertions)：断言 eval 做了什么
- [Judge](../judge)：用 LLM judge 给质量评分
- [TypeScript client](../../guides/client/messages)：eval sessions 所基于的 send/turn 协议
