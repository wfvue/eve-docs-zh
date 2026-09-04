---
title: "内置工具（Built-in Tools）"
description: "eve 提供的默认和 opt-in 工具，包括 glob、grep 和 sleep；后台子智能体走任务生命周期。"
---

# 内置工具（Built-in Tools）

eve 为每个 Agent 提供一套默认工具，以及用一个文件就能加入的额外工具。每个默认值占用你自己也会编写的 `agent/tools/<name>.ts` slot，所以 authored 定义会替换它，`disableTool()` 会移除它。用本页审查模型能调用什么、选择加入更多能力，或覆盖和禁用默认值。自定义工具见 [工具（Tools）](../tools)。

官方原文：[Built-in Tools](https://eve.dev/docs/concepts/built-in-tools)。

> **相对旧中文稿：** `glob` / `grep` 仍非默认；可复用定义从各自 `eve/tools/<slug>` 导入。面向模型的实验性 `Workflow` 编排工具已从本页移除——durable 编排请看 [Workflows as Tools](../tools/workflows)；子智能体委派统一走 **background 任务**。

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

面向模型的文件工具接受绝对路径和以 `$HOME/` 开头的路径。eve 在调用非 shell 文件操作前把 `$HOME` 解析到 sandbox，所以打包 skill 引用在 `read_file`、`write_file` 以及 opt-in 的 `glob`、`grep` 之间一致工作。

注意：

- **`agent`** 只在根 session 可用，并且**始终后台运行**。调用立刻返回 task receipt，后续通过 task notifications 投递更新或最终结果。子级使用根的 instructions、tools、connections 和 sandbox，但从全新对话历史和新 [state](./state) 开始。子级既收不到 `agent` 也收不到 `Workflow`；声明的子智能体也不会收到内置 `agent`。见 [子智能体](../subagents)。
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
| `sleep` | `eve/tools/sleep` 的 `sleep()` | 暂停并 durable 恢复当前 turn。 |

例如用两个文件加入文件发现和内容搜索：

```ts title="agent/tools/glob.ts"
export { glob as default } from "eve/tools/glob";
```

```ts title="agent/tools/grep.ts"
export { grep as default } from "eve/tools/grep";
```

文件名提供面向模型的工具名。这些工具对着 Agent sandbox 运行。需要改 description 或审批策略时，用 `defineTool({ ...glob, description: "..." })` 包装。

长等待、审批、webhook 等 durable 编排，请写 `"use workflow"` 的工具，见 [Workflows as Tools](../tools/workflows)。

## 覆盖默认值

在同一 slug 下编写工具就会接管该名字的内置工具：

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

## 禁用默认值

```ts title="agent/tools/bash.ts"
import { disableTool } from "eve/tools";

export default disableTool();
```

用 `agent/tools/agent.ts` 移除仅根可用的 `agent` 委派工具。根 session 将无法委派给自己的新副本。文件名不匹配任何已知框架工具时，解析会失败而不是默默什么都不做。

## 何时覆盖、禁用或编写新工具

- **覆盖**：想要相同能力但行为不同。从匹配的 `eve/tools/<slug>` 导入并包装。
- **禁用**：模型根本不该有这个能力。`disableTool()` 移除内置工具。
- **编写新工具**：harness 没有的能力。在 `agent/tools/` 下给新 slug。见 [工具（Tools）](../tools)。需要 durable 等待时，把 `execute` 写成 workflow，见 [Workflows as Tools](../tools/workflows)。

## Opt-in 的 `sleep` 工具

框架也发布 durable `sleep` 工具，但默认不加入 Agent。用 `agent/tools/sleep.ts` 启用：

```ts
import { sleep } from "eve/tools/sleep";

export default sleep();
```

模型用 `{ seconds }` 调用它。每次调用作为 durable tool workflow 运行，不会保持应用 runtime 打开，时长过后同一个 turn 自动继续。并发 `sleep` 并行执行，turn 在最长请求时长结束后继续。

## 接下来读什么

- [工具（Tools）](../tools)
- [Workflows as Tools](../tools/workflows)
- [动态能力](../guides/dynamic-capabilities)
- [Sandbox](../sandbox)
- [子智能体](../subagents)
