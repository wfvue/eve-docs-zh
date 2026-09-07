---
title: "内置工具（Built-in Tools）"
description: "eve 提供的默认与 opt-in 工具；可用 defaultTools: false 与 disableTool() 关掉默认能力。"
---

# 内置工具（Built-in Tools）

eve 为每个 Agent 提供一套默认工具，以及用一个文件就能加入的额外工具。每个默认值占用你也会编写的 `agent/tools/<name>.ts` slot：authored 定义会替换它，`disableTool()` 会移除它。用本页审查模型能调用什么、按需加入更多能力，或覆盖 / 禁用默认值。自定义工具见 [工具（Tools）](../tools)。

官方原文：[Built-in Tools](https://eve.dev/docs/concepts/built-in-tools)。

> **相对旧中文稿（2026-09-07）：** 上游 #3069 大幅扩充本页：可选默认工具可用 `defaultTools: false` 整批关掉，再按工具用 `eve add tool/<name>` 加回；每个默认工具都有覆盖 / 禁用示例。`connection_search` 在有 connections 时即使 `defaultTools: false` 仍会保留。`glob` / `grep` / `sleep` 仍是 opt-in。

## 默认工具

默认工具不需要 import。确切集合取决于 Agent 和 session；harness 只宣传当前 session 可用的工具。

### 关闭可选默认工具

可选默认工具默认开启，除非在 `agent/agent.ts` 设 `defaultTools: false`：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  defaultTools: false,
  model: "openai/gpt-5.4",
});
```

这会关掉下文描述的**可选**默认工具。需要哪些再用各节的 `eve add tool/...` 加回。`agent/tools/` 下已有文件（含同名替换，例如 `agent/tools/bash.ts`）仍然可用。

当 Agent 声明了 connections 时，`connection_search` **仍会保留**——它是访问连接工具的入口，即使 `defaultTools` 为 `false`。

### `bash`

在 Agent 的 [sandbox](../sandbox) 里跑 shell 命令。

```sh
eve add tool/bash
```

```ts title="agent/tools/bash.ts"
export { default } from "eve/tools/bash";
```

包装定义可改 description、审批策略或 executor：

```ts title="agent/tools/bash.ts"
import { defineTool } from "eve/tools";
import { bash } from "eve/tools/bash";

export default defineTool({
  ...bash,
  description: "Run approved project maintenance commands.",
  async execute(input, ctx) {
    console.info("Running sandbox command", input.command);
    return bash.execute(input, ctx);
  },
});
```

只禁用 `bash`：

```ts title="agent/tools/bash.ts"
import { disableTool } from "eve/tools";

export default disableTool();
```

### `read_file`

从 sandbox 读文本文件，带行号输出。接受绝对路径和以 `$HOME/` 开头的路径。

```sh
eve add tool/read_file
```

覆盖 / 禁用方式同 `bash`：从 `eve/tools/read_file` 导入 `readFile` 包装，或 `export default disableTool()`。

### `write_file`

在 sandbox 写完整文件；强制 read-before-write 与 stale-read 检测。路径规则同 `read_file`。

```sh
eve add tool/write_file
```

可包装后限制写入范围，例如只允许 `/workspace/`：

```ts title="agent/tools/write_file.ts"
import { defineTool } from "eve/tools";
import { writeFile } from "eve/tools/write_file";

export default defineTool({
  ...writeFile,
  description: "Write approved project files in the sandbox.",
  async execute(input, ctx) {
    if (!input.filePath.startsWith("/workspace/")) {
      throw new Error("write_file is limited to /workspace");
    }
    return writeFile.execute(input, ctx);
  },
});
```

### `web_fetch`

从**应用 runtime** 抓取 URL。最多跟随十次重定向，每个目的地都做 SSRF 检查。非成功响应返回带响应体（如有）的纯文本，而不是让 tool call 失败。

```sh
eve add tool/web_fetch
```

可包装后限制允许的 hostname。

### `web_search`

由 provider 管理的网页搜索；只在受支持的模型 provider 上出现。AI Gateway 模型默认用 Exa；直连 provider 模型用其原生搜索。

```sh
eve add tool/web_search
```

```ts title="agent/tools/web_search.ts"
import { webSearch } from "eve/tools/web_search";

export default webSearch({ provider: "parallel" });
```

也可用 `defineTool()` 完全替换成自建检索；或 `disableTool()` 关掉。

### `todo`

维护 session 级 durable todo 列表。

```sh
eve add tool/todo
```

包装时请 **spread** 原定义，以保留 durable state key。

### `ask_question`

向用户提问或给选项，然后 park turn 直到回答。只在 session 能请求用户输入时出现。见 [人在环中](../tools/human-in-the-loop)。

```sh
eve add tool/ask_question
```

可用普通 authored tool 替换其「请求输入」行为，或 `disableTool()`。

### `agent`

把子任务委派给根 Agent 的新副本。**仅根可用**，始终后台运行，立刻返回 task receipt。子级拿到根的 instructions、tools、connections、sandbox，但从全新对话历史和 [state](./state) 开始。见 [子智能体](../subagents)。

```sh
eve add tool/agent
```

框架行为**不能**被包装覆盖。要恢复就 re-export 上面的定义；要关掉：

```ts title="agent/tools/agent.ts"
import { disableTool } from "eve/tools";

export default disableTool();
```

### `task_cancel`

让根 session 取消后台任务。框架行为不可覆盖；可 re-export 或 `disableTool()`。

```sh
eve add tool/task_cancel
```

### `task_update`

让后台任务向父级报告进度；只出现在被委派的 task session。框架行为不可覆盖。

```sh
eve add tool/task_update
```

### `load_skill`

把按需 [skill](../skills) 的 instructions 拉进当前 turn。只在 Agent 声明 skills 时出现；本身不增加执行面。

```sh
eve add tool/load_skill
```

可包装 description，或 `disableTool()`。

### `connection_search`

跨声明的 [connections](../connections) 发现工具，并按限定名（如 `linear__list_issues`）直接可调。有 connections 时 eve **自动**加入，即使 `defaultTools: false`——因此没有 `eve add` 命令。

authored 的 `agent/tools/connection_search.ts` 会替换框架行为。需要引用框架定义时从 `eve/tools/connection_search` 导入。在此 slot **导出 `disableTool()` 是错误**：有 connections 的 Agent 必须能做连接发现。

---

生产前请审查这些默认工具。对任何能碰文件系统、网络、shell 或敏感数据的工具，禁用、包装、限制或要求审批。

## Opt-in 框架工具

这些**默认不加**。Agent 需要时再加。

### `glob` / `grep`

按 glob 找 sandbox 文件 / 用正则搜内容：

```sh
eve add tool/glob
eve add tool/grep
```

```ts title="agent/tools/glob.ts"
export { default } from "eve/tools/glob";
```

用 `defineTool({ ...glob, description: "..." })` 包装即可定制。删文件即移除工具；它们不是默认工具，一般不必 `disableTool()`。

### `sleep`

暂停并 durable 恢复当前 turn。模型用 `{ seconds }` 调用；等待不占用应用 runtime。并发调用并行执行，turn 在最长等待结束后继续。

```sh
eve add tool/sleep
```

```ts title="agent/tools/sleep.ts"
import { sleep } from "eve/tools/sleep";

export default sleep();
```

定制时用 `defineWorkflowTool` 包装 `sleep()`：

```ts title="agent/tools/sleep.ts"
import { defineWorkflowTool } from "eve/tools";
import { sleep } from "eve/tools/sleep";

export default defineWorkflowTool({
  ...sleep(),
  description: "Pause before checking an external operation again.",
});
```

## 项目建议

- 最小权限：生产 Agent 优先 `defaultTools: false`，再只加回确实需要的工具。
- 有 connections 时记得：`connection_search` 关不掉；用 connection 侧的 allow / approval 收窄面。
- `agent` / `task_*` 是框架契约工具，不要指望「包装改行为」——要么恢复默认，要么禁用。

## 接下来读什么

- [工具（Tools）](../tools)
- [动态能力](../guides/dynamic-capabilities)
- [Sandbox](../sandbox)
- [子智能体](../subagents)
