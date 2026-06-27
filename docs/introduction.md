---
title: "简介"
description: "理解 eve agent 如何用文件组织、消息到达后会发生什么，以及项目增长时可以添加哪些构建块。"
---

# Introduction：简介

eve 是一个用于构建 durable agent 的框架。它把 Agent 写成 TypeScript 项目里的普通文件。

它不要求你维护一个巨大的配置对象，而是给 Agent 的每个组成部分一个清晰的位置：指令放在一个文件里，工具放在一个目录里，渠道放在另一个目录里。eve 会发现这些文件结构，并把它们转换成一个可以本地运行、对外提供 HTTP 服务、连接不同平台，并且能跨多轮持续工作的 Agent。

## 一个 eve 项目的整体样子

一个很小的 eve 应用大概长这样：

```text
my-agent/
├── package.json
└── agent/
    ├── agent.ts
    ├── instructions.md
    ├── tools/
    │   └── get_weather.ts
    ├── skills/
    │   └── plan_a_trip.md
    └── channels/
        └── slack.ts
```

读这个目录树，基本就能理解一个 eve 项目的大部分能力：

- `instructions.md` 告诉 Agent 它是谁，以及应该如何行动。
- [`agent.ts`](./agent-config) 选择模型，并配置运行时选项。
- [`tools/`](./tools) 保存模型可以调用的类型化函数。
- [`skills/`](./skills) 保存更长的操作流程，只有在有用时才会被模型加载。
- [`channels/`](./channels/overview) 把 Agent 连接到 HTTP 客户端、Slack、Discord，以及其它人们和它对话的地方。

刚开始只需要 `instructions.md` 和 `agent.ts`。当 Agent 需要更多能力时，再添加其它目录。

## 文件就是接口

eve 是 [filesystem-first](./reference/project-layout) 的。文件位置说明它做什么，文件路径通常也会给它命名。例如这个文件：

```text
agent/tools/get_weather.ts
```

会定义一个名为 `get_weather` 的工具：

```ts
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Get the weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  async execute({ city }) {
    return { city, condition: "Sunny" };
  },
});
```

这里没有一个需要额外同步的注册表。添加文件，eve 就能发现它；移动或重命名文件，它的身份也会跟着移动。完整 API 见 [Tools](./tools)。

## 当消息到达时会发生什么

无论消息来自 Web 应用、终端还是 Slack，eve 运行的流程都是同一套：

1. 把平台输入转换成一条消息。
2. 把指令、skills、tools 和会话历史交给模型。
3. 运行模型循环，并在需要时调用工具和子 Agent。
4. 保存 session，并持续流式输出事件。
5. 用对应平台期望的形式把结果送回去。

这样可以让 Agent 行为保持可移植。你的天气工具不需要知道问题是来自浏览器，还是来自 Slack。

## 默认就是持久的

一个 eve session 不只是一次请求和一次响应。它可以：

- 在工作进行时流式输出进度。
- 调用工具和子 Agent。
- 暂停等待[审批或人工回答](./tools)。
- 在收到回答后继续运行。
- 在多轮之间保持持久状态。

在底层，eve 使用开源的 [Workflow SDK](https://workflow-sdk.dev) 来让 session 具备持久、可恢复和崩溃安全的能力。eve 会处理这些机制，让你的工具专注于真正要完成的工作。

## 通过添加能力来扩展项目

随着 Agent 增长，每类关注点仍然有可预测的位置：

| 路径 | 什么时候需要添加 |
| --- | --- |
| [`connections/`](./connections) | 需要接入外部 MCP 或 OpenAPI 服务里的工具时 |
| [`hooks/`](./guides/hooks) | 需要响应生命周期事件或流式事件时 |
| [`sandbox/`](./sandbox) | 需要一个受控的文件和命令工作区时 |
| [`subagents/`](./subagents) | 需要把任务委派给专门的子 Agent 时 |
| [`schedules/`](./schedules) | 需要定时或周期性工作时 |
| `lib/` | 需要被其它 agent 文件复用的共享代码时 |

这样，项目在运行之前就已经是可读的。目录结构会告诉你这个 Agent 能做什么。

## 接下来读什么

- [快速开始](./getting-started)：脚手架生成并运行第一个 Agent。
- [Tools](./tools)：Agent 可以调用的类型化动作。
- [Instructions](./instructions)：塑造行为的常驻系统提示词。
- [Channels](./channels/overview)：从 Slack、Discord 或 Web UI 访问 Agent。
- [Connections](./connections)：从外部服务引入工具。
- [Project layout](./reference/project-layout)：`agent/` 下每个可编写位置的完整说明。
