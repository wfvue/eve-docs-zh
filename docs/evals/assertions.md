---
title: "断言（Assertions）"
description: "Scoped methods、value assertions、matcher mini-language，以及 gate / soft severity。"
---

# 断言（Assertions）

Assertions 用来给 `test(t)` 函数产生的结果评分。每个 assertion 都会记录一个结果，并返回一个可链式调用的 handle。Runner 会读取所有记录下来的结果来计算 verdict，因此一次 run 会报告所有失败的断言，而不是在第一个失败处直接终止。

确定性断言有两类 surface：scoped methods，以及用 `t.check` 对特定 value 评分。模型评分的断言见 [Judge](./judge)。

## Scoped assertions

Scoped assertions 不需要显式传入 value，并且默认是 gate。写在 `t` 上的 assertion 会在 `test` 结束后检查整个 run。Session assertion 会在调用时 snapshot 那个 session；turn assertion 则检查某个不可变 response。一个 scope 如果因为 unanswered human-in-the-loop（HITL）input 暂停，就称为 **parked**。

| Assertion | 断言内容 |
| --- | --- |
| `t.succeeded()` | run 没有失败，也没有因为未回答的 HITL input 而 parked |
| `t.parked()` | run 干净地 parked 在 HITL input 上 |
| `t.messageIncludes(token)` | 拼接后的 assistant 文本包含 `token`，可以是 string 或 RegExp |
| `turn.outputEquals(value)` / `.outputMatches(schema)` | turn/session structured output 深度相等，或通过 Standard Schema 验证 |
| `t.calledTool(name, opts?)` | 有匹配的 tool call 完成，支持 `input`、`output`、`status`、`count` |
| `t.loadedSkill(skill, opts?)` | `t.calledTool("load_skill", { input: { skill }, ...opts })` 的快捷写法 |
| `t.notCalledTool(name)` | 任意 lifecycle state 中都没有请求过 `name` |
| `t.toolOrder([...names])` | 工具请求按给定顺序出现 |
| `t.usedNoTools()` | 完全没有工具调用 |
| `t.maxToolCalls(n)` | 工具调用最多 `n` 次 |
| `t.noFailedActions()` | 没有 tool、subagent 或 skill action 报告 failure |
| `t.calledSubagent(name, opts?)` | 发生过 subagent delegation，支持 `remoteUrl`、`output` constraints |
| `t.event(type, opts?)` / `t.notEvent(type, opts?)` | typed event 是否存在、data 是否匹配、count 是否匹配 |
| `t.eventOrder([...matchers])` | 匹配的 event groups 按顺序出现 |
| `t.eventsSatisfy(label, predicate)` | 逃生口：对 typed event stream 写任意 predicate |

`succeeded()` 同时接受已经 closed 的 session，以及仍然健康地 open、等待下一条用户消息的 session；它会拒绝 protocol failure 和未回答的 HITL。Structured output assertions 位于 turns 和 independent sessions 上，因为那里 output 的含义没有歧义，见 [output schema guide](../guides/client/output-schema)。

```ts
await t.send("What is the weather in Brooklyn?");
t.succeeded();
t.calledTool("get_weather");
```

同一套 vocabulary 在 multi-turn eval 和外部创建的 session eval 中也能自然收窄 scope：

```ts
const first = await t.send("Call get_weather for Brooklyn");
first.calledTool("get_weather", { count: 1 });

const attached = await t.target.attachSession(sessionId);
attached.succeeded();
attached.messageIncludes("Sunny");
```

`t.calledTool` 和 `t.usedNoTools` 是互斥的；同一个 run 里二者不要同时断言。

## 用 `t.check` 做 value assertions

`t.check(value, assertion)` 会用 `eve/evals/expect` 里的 builder 对显式 value 评分。这个 value 可以是 `t.reply`、某个 turn 的 `.message`、解析后的 JSON，或你自己计算出的任意本地变量：

```ts
import { includes, equals, matches, satisfies, similarity } from "eve/evals/expect";

t.check(t.reply, includes(/sunny/i)); // substring 或 RegExp（gate）
t.check(parsed, equals({ city: "Brooklyn" })); // 深度结构相等（gate）
t.check(parsed, matches(WeatherSchema)); // Standard Schema，例如 Zod（gate）
t.check(t.reply, similarity("Sunny, 72F")); // 0–1 Levenshtein 模糊相似度（soft）
t.check(
  latencyMs,
  satisfies((value) => value < 1_000, "latency under one second"),
);
```

| Builder | 评分内容 | 默认值 |
| --- | --- | --- |
| `includes(value)` | 强制转成 string 后包含 substring，或匹配 RegExp | gate |
| `equals(value)` | 深度结构相等 | gate |
| `matches(schema)` | 通过 Standard Schema 验证 | gate |
| `similarity(expected)` | 标准化 Levenshtein similarity，1 表示完全相同 | soft |
| `satisfies(fn, label)` | 自定义 boolean predicate | gate |

选择能表达“正确性”的最便宜 builder。精确匹配太严格、judge model 又太重时，`similarity` 是中间选择。更细腻的评分请使用 [judge](./judge)。

## Matcher mini-language

`t.calledTool` 和 `t.calledSubagent` 都接收 matcher object。Tools 支持 `{ input, output, status, count }`；subagents 支持 `{ remoteUrl, output, status, count }`。默认只匹配 `status: "completed"` 的 calls；如果要检查 lifecycle，请显式使用 `"pending"`、`"failed"` 或 `"rejected"`。`count` 表示满足所有给定 constraint 的 calls 精确数量。

Matcher value 可以是 literal（objects 做 partial-deep-match）、RegExp，或返回 boolean 的 predicate function：

```ts
t.calledTool("bash", { input: { command: /^pwd/ }, count: 1 });

t.calledTool("echo", { output: (value) => String(value).includes(marker) });

parked.calledTool("guarded", { status: "pending", count: 1 });
t.calledTool("guarded", { output: /approved/, count: 1 });

t.calledSubagent("weather", {
  remoteUrl: (value) => value === process.env.WEATHER_AGENT_URL,
  output: /72F/,
});
```

`requireInputRequest` 会对 `input`、`prompt` 和 `display` 使用同一套 matcher language。它的 `optionIds` matcher 接收按顺序排列的 option ids；如果传 literal array，则必须和完整有序列表完全一致：

```ts
const request = session.requireInputRequest({
  toolName: "ask_question",
  optionIds: ["red", "blue"],
});
```

## Run state 和派生 facts

除了原始 `t.events` stream，runner 还会派生 assertion 会读取的 typed facts：tool calls（name、input、output、lifecycle status）、subagent calls 和 HITL input requests。一个 turn 结束后 session 仍然 open、等待下一条消息，是成功 turn 的正常结束状态；因为未回答的 HITL input 而 parked 会被单独跟踪。

Typed event matching 支持 presence、absence、exact counts、partial event data 和 ordering：

```ts
turn.notEvent("result.completed");
turn.eventOrder([
  { type: "subagent.called", data: { name: "researcher" }, count: 2 },
  { type: "subagent.completed", data: { subagentName: "researcher" }, count: 2 },
]);
```

当 protocol invariant 需要跨 event 关联时，`eventsSatisfy` 仍然是逃生口：

```ts
t.eventsSatisfy("assistant reply includes the marker", (events) =>
  events.some((e) => e.type === "message.completed" && e.data.message?.includes(marker)),
);
```

## 必需前置条件

已经记录的 assertions 不会 throw，也不能 await。当后续控制流依赖某个 value 时，使用 `await t.require(value, assertion)`。它会记录一个 gate；通过时返回原 value，失败时停止 test body，且不会添加重复的 execution error：

```ts
await t.require(
  sessionIds,
  satisfies((ids) => ids.length > 0, "dispatch started a session"),
);
await t.target.attachSession(sessionIds[0]!);
```

当后续代码需要 protocol data 时，可以使用对应的 `require*` lookups：

```ts
const call = turn.requireToolCall("search");
const request = session.requireInputRequest({ toolName: "guarded" });
```

## Severity

每个 assertion 都返回一个可链式调用的 handle。Severity 挂在断言自身上，因此不需要维护一个单独的 thresholds map。

- `.gate(threshold?)` 是硬门槛。miss 会把 eval 标记为 `failed`，并让 `eve eval` 非零退出。
- `.soft(threshold?)` 是跟踪数据。低于阈值会把 eval 标记为 `scored`，只有在 `--strict` 下才是 fatal。没有 threshold 时，它只是 tracked-only，永远不会失败。
- `.atLeast(threshold)` 是带阈值的 soft（等价于 `.soft(threshold)`）。

默认值已经覆盖常见情况，所以通常不需要设置 severity。Run-level methods 和 `includes` / `equals` / `matches` 默认是 gates；`similarity` 和所有 `t.judge.*` 默认是 soft。只有当你想偏离默认时再显式标注：

```ts
t.calledTool("get_weather").soft(); // 把工具调用作为指标记录，不阻断
t.check(t.reply, similarity("Sunny")).atLeast(0.8); // --strict 下低于 0.8 失败
t.check(t.reply, includes("error")).soft(); // 只跟踪，不让构建失败
```

## 接下来读什么

- [Judge](./judge)：带阈值的 LLM-graded assertions
- [Cases](./cases)：assertions 绑定在哪里
- [Running evals](./running)：verdict 如何映射到退出码
