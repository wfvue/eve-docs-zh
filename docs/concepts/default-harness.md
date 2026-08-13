---
title: "默认 Harness（The Harness）"
description: "eve 如何在一次 Agent turn 中管理模型上下文与内置工具。"
---

# 默认 Harness（The Harness）

默认 harness 是 eve 内置的 Agent 循环。它管理模型调用、压缩和工具执行。你可以用自己 Agent 特有的能力扩展它。要了解 turn 如何 checkpoint 和恢复，读 [执行模型与持久性（Execution model and durability）](./execution-model-and-durability)。

## 压缩（Compaction）

Harness 让长 session 不会溢出模型的上下文窗口。在把对话与 `thresholdPercent`（默认 `0.9`）比较之前，它先加上用于压缩的 checkpoint prompt 的估计固定开销。然后摘要更早的 turn 并继续。Prompt 要求压缩模型区分已完成的进度和决策与剩余工作，并保留继续所需的约束、偏好、数据和引用。当 eve 再次压缩时，它把上一个 checkpoint 单独传入，且不做 transcript 的逐消息截断，然后用更新的 checkpoint 替换它。摘要使用当前 turn 模型，除非你覆盖。在 `agent.ts` 的 [`compaction`](../agent-config#compaction) 下调节它何时、如何触发：

```ts title="agent/agent.ts"
export default defineAgent({
  model: "anthropic/claude-opus-4.8",
  compaction: {
    thresholdPercent: 0.75,
  },
});
```

压缩也会自动保留框架自己的工具状态。它重置 read-before-write 追踪（因此之后的写入会重新读取那个读证据已被摘要掉的文件），并重新注入活跃 todo 列表，让模型跨摘要保留任务列表。没有 per-tool hook 可配置。

客户端和渠道也可以在 turn 之间请求压缩。调用 `ClientSession.compact()`、渠道路由的 `compact(address)`，或 `attachSession(sessionId).compact()`。请求不会追加用户消息；如果 turn 正在运行，eve 会排队直到该 turn settle。成功的手动压缩发出与自动压缩相同的 `compaction.requested` 和 `compaction.completed` 事件，后跟 `session.waiting`。

要丢弃模型消息历史而不是摘要它，调用上述任意 handle 上对应的 `clear()` 方法。Clear 保留 session 身份、system prompt、配置的 tools 和 skills、durable state、limits 和 sandbox。它的流边界是 `context.cleared` 后跟 `session.waiting`。

## 内置工具（Built-in tools）

内置工具不需要 import。确切集合取决于 Agent 和 session。`agent` 只在根 session 可用；`load_skill` 和 `connection_search` 只在 Agent 声明了对应资源时出现；`ask_question` 需要一个能请求用户输入的 session；`web_search` 需要受支持的模型 provider。Harness 只宣传当前 session 可用的工具。

Shell 和文件工具（`bash`、`read_file`、`write_file`、`glob`、`grep`）在应用里运行，并把它们的工作代理进 Agent 的 [sandbox](../sandbox)。下表显示每个工具的效果落在哪里。

| 工具 | 作用 | 运行位置 |
| --- | --- | --- |
| `bash` | 运行 shell 命令。 | Sandbox |
| `read_file` | 读取带行号输出的文本文件（启用 read-before-write）。 | Sandbox FS |
| `write_file` | 写入完整文件；强制 read-before-write 和 stale-read 检测。 | Sandbox FS |
| `glob` | 按 glob 模式查找文件。 | Sandbox FS |
| `grep` | 按正则搜索文件内容。 | Sandbox FS |
| `web_fetch` | 抓取 URL。 | App runtime |
| `web_search` | 搜索网页（provider 管理；从模型 provider 解析）。 | Provider |
| `todo` | 维护 durable 的 per-session todo 列表。 | App runtime |
| `ask_question` | 在 turn 中途向用户提出澄清问题或选择，并 park 直到他们回答。没有 `execute`；模型用 `{ prompt, options?, allowFreeform? }` 调用它。见 [Human-in-the-loop](../guides/human-in-the-loop)。 | App runtime |
| `agent` | 从根 session 把子任务委派给根 Agent 的新副本。 | App runtime |
| `load_skill` | 把按需 [skill](../skills) 的 instructions 拉进当前 turn。只在 Agent 声明 skills 时出现。 | App runtime |
| `connection_search` | 跨声明的 [connections](../connections) 发现工具；匹配的工具变成可直接调用。只在 Agent 声明 connections 时出现。 | App runtime |

面向模型的文件工具接受绝对路径和以 `$HOME/` 开头的路径。eve 在调用非 shell 文件操作之前把 `$HOME` 解析到 sandbox，所以打包 skill 引用（如 `$HOME/.agents/skills/<skill>/references/...`）在 `read_file`、`write_file`、`glob` 和 `grep` 之间一致工作。

注意：

- **`agent`** 只在根 session 可用。它的子级使用根的 instructions、tools、connections 和 sandbox，但从全新的对话历史和新 [state](../guides/state) 开始。子级既不会收到 `agent` 也不会收到 `Workflow`；声明的子智能体也不会收到内置 `agent`。见 [子智能体（Subagents）](../subagents)。
- **`load_skill`** 只把 instructions 拉进上下文。它不增加新的执行面，因为行为仍来自 Agent 已有的工具。
- **`connection_search`** 按限定名（例如 `linear__list_issues`）暴露 connection 的工具，模型随后可以直接调用。只在 Agent 有 connections 时注册。
- **`web_search`** 没有本地执行器；provider 运行它。AI Gateway 模型默认用 Exa。要改用 Parallel，从 `agent/tools/web_search.ts` 导出 `webSearch({ provider: "parallel" })`。直接 provider 模型继续使用它们的原生搜索实现。要提供你自己的实现，用 `defineTool()` 覆盖它。

在生产使用前审查这些内置工具。对任何能访问文件系统、网络、shell 或敏感数据的工具，禁用、包装、限制或要求审批。

## 覆盖默认工具（Override a default）

在同一个 slug 下写一个工具，它就会接管那个名字的内置工具。存在 `agent/tools/write_file.ts` 文件即可替换内置 `write_file`：

```ts title="agent/tools/write_file.ts"
import { defineTool } from "eve/tools";
import { writeFile } from "eve/tools/defaults";

export default defineTool({
  ...writeFile, // keep the default description, schema, and executor
  async execute(input, ctx) {
    console.log("[write_file]", input.path);
    return writeFile.execute(input, ctx);
  },
});
```

框架默认值可以从 `eve/tools/defaults` 导入（`bash`、`readFile`、`writeFile`、`glob`、`grep`、`webFetch`、`todo`、`loadSkill`），所以你可以展开、包装或修补它们。跳过展开，你的替代品就拥有自己的上下文。为 `todo` 新建的 `defineTool` 不会继承框架的 durable state key。

Provider 管理的 web search 有一个专用配置 helper，而不是可执行的默认值：

```ts title="agent/tools/web_search.ts"
import { webSearch } from "eve/tools";

export default webSearch({ provider: "parallel" });
```

把 `provider` 设为 `"exa"` 或 `"parallel"`。没有这个文件时，AI Gateway 模型使用 Exa。

## 禁用默认工具（Disable a default）

从以工具 slug 命名的文件导出 `disableTool()` 哨兵。文件名决定移除哪个默认值：

```ts title="agent/tools/bash.ts"
import { disableTool } from "eve/tools";

export default disableTool();
```

用 `agent/tools/agent.ts` 移除仅根可用的 `agent` 委派工具。根 session 随后不会收到用于委派给自己的新副本的工具，模型也永远看不到那个工具。

如果文件名不匹配任何已知框架工具，解析会失败而不是默默什么都不做，所以拼写错误在构建时就暴露，而不是移除错误的工具。

## 何时覆盖、禁用或编写新工具

三个动作塑造 harness。选哪个取决于模型是否应该保留内置能力。

- **覆盖**：想要相同能力但行为不同。从 `eve/tools/defaults` 展开默认值并包装它（日志、额外守卫、不同后端），模型仍会看到一个该名字的工具。展开保留默认值的 description、schema 和任何框架 state，比如 `todo` 工具的 durable state key。去掉展开，你的替代品就拥有自己的上下文，丢掉那些接线。
- **禁用**：模型根本不应该有这个能力。`disableTool()` 哨兵移除内置工具，模型永远看不到它。对于不该运行 shell 命令或抓取任意 URL 的 Agent，用它锁死 `bash` 或 `web_fetch`。
- **编写新工具**：想要 harness 没有的能力。在 `agent/tools/` 下给它一个新 slug，它加入内置工具而不是替换一个。编写模型见 [工具（Tools）](../tools)。

## 可选的 `Workflow` 工具

一个实验性的 `Workflow` 工具随框架发布，但默认关闭。要打开它，从 `agent/tools/workflow.ts` 导出它的定义：

```ts
import { experimental_workflow } from "eve/tools";

export default experimental_workflow({ maxSubagents: 100 });
```

打开后，模型可以从模型编写的 JavaScript 编排 Agent 自己的子智能体，全部作为一个 durable step。该工具仅根可用——被委派的子智能体 session 永远看不到它——而且一个程序最多可以 dispatch 配置的 `maxSubagents` 次调用（默认 100）。见 [动态工作流（Dynamic workflows）](../guides/dynamic-workflows)。

## 可选的 `sleep` 工具

框架也发布一个 durable 的 `sleep` 工具，但默认不加入 Agent。用 `agent/tools/sleep.ts` 启用它：

```ts
import { sleep } from "eve/tools/sleep";

export default sleep();
```

当在再次检查进度或状态之前等待有用时，模型用 `{ seconds }` 调用它。暂停会休眠 durable turn workflow，所以它不会保持应用 runtime 打开，时长过后同一个 turn 自动继续。如果一个模型响应发出并发 `sleep` 调用，eve 会等待最长请求的时长。

## 接下来读什么（What to read next）

- [工具（Tools）](../tools)：定义你自己的工具，用审批门禁它们，并用 `toModelOutput` 塑造输出
- [动态能力（Dynamic capabilities）](../guides/dynamic-capabilities)：用 `defineDynamic` 按 session 生成工具集
- [Sandbox](../sandbox)：shell 和文件工具运行所在的 sandbox
