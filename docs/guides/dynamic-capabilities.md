---
title: "动态能力（Dynamic Capabilities）"
description: "使用 defineDynamic 在运行时解析 tools、skills 和 instructions，理解 resolver events、执行顺序，以及 dynamic tools 如何跨 step boundaries 保留。"
---

# 动态能力（Dynamic Capabilities）

`defineDynamic` 会基于 session event 在运行时解析 tools、skills 和 instructions，而不是在启动前静态声明它们。当正确能力只有在 session 开始之后才知道时，就应该使用它：例如能力取决于 caller、tenant、feature flags 或外部数据。[工具（Tools）](../../tools)、[技能（Skills）](../../skills) 和 [指令（Instructions）](../../instructions) 文档都会把各自的 dynamic form 指向这里。

## 动态工具（Dynamic tools）

给 `defineDynamic` 传入一个 `events` object。每个 handler 可以返回一个 `defineTool(...)`、一个 `Record<string, defineTool(...)>`，或返回 `null` 表示没有工具。每个 entry 都必须包在 `defineTool()` 里，这个 wrapper 会给它们打标，让它们的 `execute` functions 可以跨 workflow step boundaries 保留。

下面的例子会为每张 warehouse table 生成一个 tool。返回 map 时，每个 key 就是模型看到的 tool name，例如 `orders`、`users` 等。

```ts title="agent/tools/query.ts"
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { listTables, runReadOnly } from "../lib/warehouse.js";

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) =>
      Object.fromEntries(
        (await listTables()).map((t) => [
          t.name,
          defineTool({
            description: `Query ${t.name}. Columns: ${t.columns.join(", ")}`,
            inputSchema: z.object({ sql: z.string() }),
            execute: ({ sql }) => runReadOnly(t.name, sql),
          }),
        ]),
      ),
  },
});
```

### `execute` 必须是内联函数（`execute` must be an inline function）

`execute` 必须写成直接放在属性值上的 inline function expression、arrow 或 method shorthand。Bundler transform 不会识别 `execute: myFn` 或 `execute: makeFn()`，因此这些工具可能在第一步可用，但无法在 replay 时保留。Replay 指 crash 或 resume 后重新运行某个 step，见 [执行模型与持久性（Execution model & durability）](../../concepts/execution-model-and-durability)。后续 steps 中，transform 会从保存的 closure variables 重建每个 `execute`，而不是重新运行 resolver，所以它必须是 inline。

### 命名（Naming）

| 返回形状 | 文件 | Tool name(s) |
| --- | --- | --- |
| 单个 `defineTool` | `agent/tools/analytics.ts` | `analytics` |
| map `{ export, query }` | `agent/tools/tenant.ts` | `export`, `query` |

返回单个 tool 时，tool 名称和 static tool 一样，来自文件 slug。返回 map 时，每个 entry 使用 **bare key** 作为名称，不会自动加 slug prefix。如果 bare name 可能冲突，请手动命名空间化，例如返回 `{ "tenant__export": … }`。

### 冲突（Conflicts）

动态 tool 或 skill 如果和某个 **authored** 名称相同，会覆盖它；也就是说，可以按 caller 替换内置能力。两个 **dynamic** resolvers 发出同名能力则是真正的歧义，会抛错；需要手动给其中一个 key 加命名空间。

### 事件（Events）

| Event | Resolver 运行时机 | Tools 可用于 |
| --- | --- | --- |
| `session.started` | 每个 session 一次 | session 内所有 model call |
| `turn.started` | 每个 turn 一次 | 当前 turn 内所有 model call |
| `step.started` | 每次 model call 前 | 这一次 model call |

### 执行顺序（Execution order）

一个 stream event 触发时，会按以下顺序执行：

1. Channel adapter handler 运行，event 被写入 durable stream。
2. Stream-event [钩子（Hooks）](../hooks) 触发。
3. 订阅该 event 的 dynamic tool resolvers 运行并更新 tool set。

Tool loop 会在每次 model call 之前读取当前 tool set，所以 turn 中途的更新会在下一次 model call 可见。

同一个文件可以声明多个 event handlers，最近一次触发的 handler 拥有该文件的 tool set。可以在 `turn.started` 重新 resolve，替换 `session.started` 返回的工具：

```ts title="agent/tools/catalog.ts"
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { runReadOnly, searchCatalog } from "../lib/catalog.js";

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => ({
      query: defineTool({
        description: "Run a read-only query.",
        inputSchema: z.object({ sql: z.string() }),
        execute: ({ sql }) => runReadOnly(sql),
      }),
    }),
    // 每个 turn 重新解析，替换本文件 session.started 产生的后续工具
    "turn.started": async (_event, ctx) => ({
      search: defineTool({
        description: "Search the catalog.",
        inputSchema: z.object({ term: z.string() }),
        execute: ({ term }) => searchCatalog(term),
      }),
    }),
  },
});
```

不同文件中的 resolvers 会并发运行。

## 动态技能（Dynamic skills）

动态 skills 文件会根据 principal 解析某个 caller 能加载哪些 [技能（Skills）](../../skills)。它只会在 `session.started` 和 `turn.started` 解析，`step.started` 保留给 dynamic tools。可以读取 `ctx.session.auth` 或 channel metadata，然后返回一个 `defineSkill(...)`（名称来自文件 slug）或 `null`：

```ts title="agent/skills/team_playbook.ts"
import { defineDynamic, defineSkill } from "eve/skills";
import { PLAYBOOKS } from "../lib/playbooks.js";

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => {
      const team = ctx.session.auth.current?.attributes.team;
      const markdown = team ? PLAYBOOKS[team] : undefined;
      return markdown ? defineSkill({ markdown }) : null;
    },
  },
});
```

调用者所在 team 会获得自己的 playbook，作为 loadable skill 暴露给模型；其它人则什么都拿不到。

Skills 采用和 tools 相同的命名规则：单个 `defineSkill(...)` 使用文件 slug，map 使用每个 entry 的 bare key。如果可能冲突，请手动给 key 加命名空间。Dynamic skill 会覆盖同名 authored skill；两个 dynamic resolvers 发出同名 skill 会抛错。

## 动态指令（Dynamic instructions）

动态 instructions 文件会以同样方式解析 per-session system prompt，通常基于 principal、tenant 或外部数据返回 `defineInstructions(...)`：

```ts title="agent/instructions/persona.ts"
import { defineDynamic, defineInstructions } from "eve/instructions";

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => {
      const plan = ctx.session.auth.current?.attributes.plan ?? "free";
      return defineInstructions({
        markdown: `The caller is on the ${plan} plan. Match the depth of your answers to it.`,
      });
    },
  },
});
```

Dynamic skills 和 dynamic instructions 都会在 prompt 组装之前解析，因此模型会看到适合当前 caller 的 instructions 和 skill set，同时不会把这些上下文暴露给其他人。

## 接下来读什么（What to read next）

- 这些能力建立在 static tool 基础之上 → [工具（Tools）](../../tools)
- 内置工具以及如何覆盖它们 → [默认 Harness（Default harness）](../../concepts/default-harness)
- 给 tool 或 connection 接入外部服务鉴权 → [鉴权与路由保护（Auth & route protection）](../auth-and-route-protection)
- 给 resolvers 读取的 durable per-session memory → [状态（State）](../state)
