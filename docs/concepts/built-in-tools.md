---
title: "内置工具（Built-in Tools）"
description: "eve 提供的默认和 opt-in 工具，包括 Workflow、glob、grep 和 sleep。"
---

# 内置工具（Built-in Tools）

eve 为每个 Agent 提供一套默认工具，以及用一个文件就能加入的额外工具。每个默认值占用你自己也会编写的 `agent/tools/<name>.ts` slot，所以 authored 定义会替换它，`disableTool()` 会移除它。用本页审查模型能调用什么、选择加入更多能力，或覆盖和禁用默认值。自定义工具见 [工具（Tools）](../tools)。

官方原文：[Built-in Tools](https://eve.dev/docs/concepts/built-in-tools)。

> 与旧版中文文档的差异：`glob` 和 `grep` **不再默认开启**；可复用定义从各自 `eve/tools/<slug>` 子路径导入，而不是 `eve/tools/defaults`。Workflow 的完整说明也迁到本页。

## 默认工具

默认工具不需要 import。确切集合取决于 Agent 和 session。`agent` 只在根 session 可用；`load_skill` 和 `connection_search` 只在 Agent 声明了对应资源时出现；`ask_question` 需要能请求用户输入的 session；`web_search` 需要受支持的模型 provider。Harness 只宣传当前 session 可用的工具。

默认 shell 和文件工具（`bash`、`read_file`、`write_file`）在应用里运行，并把工作代理进 Agent 的 [sandbox](../sandbox)。下表显示每个工具的效果落在哪里。

| 工具 | 作用 | 运行位置 |
| --- | --- | --- |
| `bash` | 运行 shell 命令。 | Sandbox |
| `read_file` | 读取带行号输出的文本文件（启用 read-before-write）。 | Sandbox FS |
| `write_file` | 写入完整文件；强制 read-before-write 和 stale-read 检测。 | Sandbox FS |
| `web_fetch` | 抓取 URL。 | App runtime |
| `web_search` | 搜索网页（provider 管理；从模型 provider 解析）。 | Provider |
| `todo` | 维护 durable 的 per-session todo 列表。 | App runtime |
| `ask_question` | 中途向用户提问或给选项，并 park 直到回答。没有 `execute`；模型用 `{ prompt, options?, allowFreeform? }` 调用。见 [人在环中](../tools/human-in-the-loop)。 | App runtime |
| `agent` | 从根 session 把子任务委派给根 Agent 的新副本。 | App runtime |
| `load_skill` | 把按需 [skill](../skills) 的 instructions 拉进当前 turn。只在声明 skills 时出现。 | App runtime |
| `connection_search` | 跨声明的 [connections](../connections) 发现工具；匹配的工具变成可直接调用。只在声明 connections 时出现。 | App runtime |

面向模型的文件工具接受绝对路径和以 `$HOME/` 开头的路径。eve 在调用非 shell 文件操作前把 `$HOME` 解析到 sandbox，所以打包 skill 引用（如 `$HOME/.agents/skills/<skill>/references/...`）在 `read_file`、`write_file` 以及 opt-in 的 `glob`、`grep` 之间一致工作。

注意：

- **`agent`** 只在根 session 可用。子级使用根的 instructions、tools、connections 和 sandbox，但从全新对话历史和新 [state](./state) 开始。子级既收不到 `agent` 也收不到 `Workflow`；声明的子智能体也不会收到内置 `agent`。见 [子智能体](../subagents)。
- **`load_skill`** 只把 instructions 拉进上下文，不增加新的执行面。
- **`connection_search`** 按限定名（例如 `linear__list_issues`）暴露 connection 工具。
- **`web_search`** 没有本地执行器。AI Gateway 模型默认用 Exa。要改用 Parallel，从 `agent/tools/web_search.ts` 导出 `webSearch({ provider: "parallel" })`。直接 provider 模型继续用原生搜索。要自己实现，用 `defineTool()` 覆盖。
- **`web_fetch`** 最多跟随十次重定向，每到一个目的地都重新做 SSRF 检查。非成功 HTTP 响应返回带响应体（如有）的纯文本失败结果，而不是让 tool call 失败。

生产使用前审查这些默认工具。对任何能访问文件系统、网络、shell 或敏感数据的工具，禁用、包装、限制或要求审批。

## 添加框架提供的工具

有些框架工具不在默认集合里。Agent 需要时添加对应文件：

| 工具 | 要导出的定义 | 用途 |
| --- | --- | --- |
| `glob` | `eve/tools/glob` 的 `glob` | 按 glob 模式查找 sandbox 文件。 |
| `grep` | `eve/tools/grep` 的 `grep` | 按正则搜索 sandbox 文件内容。 |
| `Workflow` | `eve/tools/workflow` 的 `experimental_workflow()` | 用生成的代码编排根 Agent 副本。 |
| `sleep` | `eve/tools/sleep` 的 `sleep()` | 暂停并 durable 恢复当前 turn。 |

例如用两个文件加入文件发现和内容搜索：

```ts title="agent/tools/glob.ts"
export { glob as default } from "eve/tools/glob";
```

```ts title="agent/tools/grep.ts"
export { grep as default } from "eve/tools/grep";
```

文件名提供面向模型的工具名。这些工具对着 Agent sandbox 运行，使用与 eve 框架实现相同的 schemas、results 和错误行为。需要改 description 或审批策略时，用 `defineTool({ ...glob, description: "..." })` 或 `defineTool({ ...grep, description: "..." })` 包装。

## 覆盖默认值

在同一 slug 下编写工具就会接管该名字的内置工具。存在 `agent/tools/write_file.ts` 即可替换内置 `write_file`：

```ts title="agent/tools/write_file.ts"
import { defineTool } from "eve/tools";
import { writeFile } from "eve/tools/write_file";

export default defineTool({
  ...writeFile,
  async execute(input, ctx) {
    console.log("[write_file]", input.path);
    return writeFile.execute(input, ctx);
  },
});
```

从各自子路径导入可复用定义：

| 定义 | Import | 默认注册 |
| --- | --- | --- |
| `bash` | `eve/tools/bash` | 是 |
| `readFile` | `eve/tools/read_file` | 是 |
| `writeFile` | `eve/tools/write_file` | 是 |
| `todo` | `eve/tools/todo` | 是 |
| `webFetch` | `eve/tools/web_fetch` | 是 |
| `loadSkill` | `eve/tools/load_skill` | 是 |
| `glob` | `eve/tools/glob` | 否 |
| `grep` | `eve/tools/grep` | 否 |

Import 定义不会把它加进 Agent；要从对应的 `agent/tools/*.ts` 文件导出。跳过展开，你的替代品就拥有自己的上下文。为 `todo` 新建的 `defineTool` 不会继承默认的 durable state key。

Provider 管理的 web search 有专用配置 helper：

```ts title="agent/tools/web_search.ts"
import { webSearch } from "eve/tools/web_search";

export default webSearch({ provider: "parallel" });
```

把 `provider` 设为 `"exa"` 或 `"parallel"`。没有这个文件时，AI Gateway 模型使用 Exa。

## 禁用默认值

从以工具 slug 命名的文件导出 `disableTool()` 哨兵：

```ts title="agent/tools/bash.ts"
import { disableTool } from "eve/tools";

export default disableTool();
```

用 `agent/tools/agent.ts` 移除仅根可用的 `agent` 委派工具。文件名不匹配任何已知框架工具时，解析会失败而不是默默什么都不做。

## 何时覆盖、禁用或编写新工具

- **覆盖**：想要相同能力但行为不同。从匹配的 `eve/tools/<slug>` 导入并包装。展开保留默认 description、schema 和框架 state（例如 `todo` 的 durable state key）。
- **禁用**：模型根本不该有这个能力。`disableTool()` 移除内置工具。
- **编写新工具**：harness 没有的能力。在 `agent/tools/` 下给新 slug。见 [工具（Tools）](../tools)。

## Workflow 工具

Opt-in 的实验性 `Workflow` 工具让模型编写 JavaScript，把当前 Agent 自己的子智能体作为一个 durable step 协调起来。程序可以按顺序运行它们、把一个结果喂给下一个、对列表 fan out 并合并结果。你启用能力，模型决定并运行编排。

一个 turn 本来就可以调用多个子智能体，parallel tool calls 也会并发 dispatch。Workflow 增加的是 **程序化协调**：程序可以根据前一个结果决定跑多少个子智能体、哪个输出喂给哪个调用、以及如何汇总。

`Workflow` 是面向模型的工具，不是 authored tools、hooks 或应用代码的 API。Authored code 不能提交 Workflow 程序，也不能用 `Workflow` 启动任意用户编写的 Vercel Workflow。应用代码要启动或继续 eve session 时用 [Client SDK](../guides/client/overview)。

### 启用 Workflow

从 `agent/tools/workflow.ts` 导出实验性定义。Helper 名带 experimental 警告，但模型看到的工具名是 `Workflow`：

```ts title="agent/tools/workflow.ts"
import { experimental_workflow } from "eve/tools/workflow";

export default experimental_workflow();
```

没有这个文件时，`Workflow` 保持关闭。它只有在 Agent 有值得协调的子智能体（或内置 `agent`）时才有价值。

模型可能生成这样的 JavaScript：按 runtime 决定的 metrics 列表 fan out 到多个 `analyst`，再合并结果：

```js
const metrics = ["revenue", "signups", "churn"];
const findings = await Promise.all(
  metrics.map((metric) => tools.analyst({ message: `Summarize last week's ${metric}.` })),
);
return findings.join("\n\n");
```

每次 `tools.analyst(...)` 调用都会 dispatch 一个 child subagent，parent stream 会记录 `subagent.called` / `subagent.completed`。

### Workflow 能编排什么

Workflow 只能到达当前 Agent 自己的 agents：内置 `agent`、声明的 [子智能体](../subagents) 和 [远程 Agent](../guides/remote-agents)。没有文件、网络、shell、skills 或 connections。每个调用仍可通过 `outputSchema` 请求结构化输出。

### 上限

**每个程序的调用预算。** 一个 Workflow 程序总共最多 dispatch `maxSubagents` 次子智能体调用（顺序和并行都算）。在 `experimental_workflow` 上配置，默认 100。超出预算的调用不会启动子 session；它们在程序内以 `WORKFLOW_SUBAGENT_LIMIT_REACHED` 错误结果结束，预算会写进 tool description，方便模型把 fan-out 控制在范围内。

**仅根编排。** 只有根 session 收到 `Workflow`。Workflow 启动的 children 既收不到 `Workflow` 也收不到内置 `agent`，所以程序不能递归。声明的 child 仍可调用自己目录里定义的子智能体。

### JavaScript 在哪里运行

编排代码不会接触 Agent 进程。Runtime 把程序文本交给小型隔离 JavaScript engine（QuickJS sandbox）。Host realm 什么都不会跨过去：没有 `process`、没有 Agent 的 `globalThis`、没有 `import`/`require`。程序只能访问桥接进来的 `tools.<name>` 和普通语言内置。这是 allowlist 而不是 denylist。

### 持久性、审批和可观测性

- **Durable**：整个编排算一个 step。一起 dispatch 的 subagents 并发运行；run 因长耗时或 human-gated child 而 park 时，重启后从离开的地方恢复。见 [执行模型与持久性](./execution-model-and-durability)。
- **Approval-safe**：需要 HITL 的子智能体会把请求浮现给用户，回答后 workflow 继续，和直接 delegation 一样。
- **Observable**：每个被编排的子智能体在 parent stream 上发出常规 `subagent.called` / `subagent.completed`，并拥有自己的 child session 和 stream。

中文站仍保留 [动态工作流（Dynamic Workflows）](../guides/dynamic-workflows) 作为补充入口；官方目录把 Workflow 放在本页。

## Opt-in 的 `sleep` 工具

框架也发布 durable `sleep` 工具，但默认不加入 Agent。用 `agent/tools/sleep.ts` 启用：

```ts
import { sleep } from "eve/tools/sleep";

export default sleep();
```

模型用 `{ seconds }` 调用它。暂停会休眠 durable turn workflow，不会保持应用 runtime 打开，时长过后同一个 turn 自动继续。一个模型响应发出并发 `sleep` 调用时，eve 等待最长请求的时长。

## 接下来读什么

- [工具（Tools）](../tools)
- [动态能力](../guides/dynamic-capabilities)
- [Sandbox](../sandbox)
- [子智能体](../subagents)
