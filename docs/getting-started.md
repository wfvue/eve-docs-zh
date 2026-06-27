---
title: "快速开始"
description: "安装 eve，生成第一个 Agent，添加一个工具，并在本地运行。"
---

# Getting Started：快速开始

eve 是一个 filesystem-first 的 durable agent 框架。你把能力写在 `agent/` 目录下，eve 负责运行模型循环、持久化每个 session，并通过 HTTP 和平台 channel 对外服务。本文会带你生成一个应用、添加一个工具、本地运行它，然后通过 HTTP 创建、流式读取并继续一个 session。

## 前置条件

- Node 24 或更高版本。
- npm，Node 会自带 npm。
- 一个模型凭据，见下文。

脚手架默认模型是 `anthropic/claude-sonnet-4.6`，它会通过 Vercel AI Gateway 路由。在运行 Agent 前，需要先设置下面两类凭据之一：

- Gateway 模型 ID 需要 `AI_GATEWAY_API_KEY`，或者使用 `vercel link` 拉取到的 `VERCEL_OIDC_TOKEN`。
- 直接调用模型提供商时，会使用该提供商的 AI SDK 包和 API Key。例如，从 `@ai-sdk/anthropic` 使用 `anthropic("claude-...")` 时，需要 `ANTHROPIC_API_KEY`。

你需要自行选择适合数据和场景的模型、提供商和 channel，并遵守每个模型提供商的条款以及数据处理要求。

如果跳过这一步，开发 TUI 会提示缺少凭据，它的 `/model` 命令会引导你粘贴密钥或关联项目。

## 快速开始

`npx` 可以在不提前安装 eve 的情况下运行 `eve init`：

```bash
npx eve@latest init my-agent
```

这个命令会：

- 用当前工作区或启动器使用的包管理器创建一个子目录，并使用 eve 的默认模型。
- 安装依赖并初始化 Git。
- 如果 `PATH` 上存在受支持的 coding-agent REPL（Claude Code、Codex、Cursor、Droid、Gemini CLI、opencode 或 Pi），会询问你是打开可用 REPL，还是启动开发服务器；否则会启动服务器，并打开交互式[终端 UI](./guides/dev-tui)。

输入一条消息，就可以看到模型循环开始运行。传入 `--channel-web-nextjs` 可以额外添加 Web Chat 应用。无论是否添加 Web Chat，每个应用都会带上内置 HTTP channel，也就是 `agent/channels/eve.ts`。

当你选择其中一个 REPL 时，eve 会带着项目专属 prompt 启动它，用来指导配置。这个 prompt 会区分 `eve dev` 和 `eve dev --no-ui`：前者会启动 eve 的 HMR 服务器和 Agent 终端 REPL；后者是可控的后台模式，适合做验证。

`eve init` 会占用终端，所以编辑生成出来的 Agent 之前，先按 Ctrl+C 停止它，把 shell 拿回来。这个命令不会创建 Vercel 项目，也不会执行部署。

如果要把 eve 加进已有项目，可以在已经有 `package.json` 且还没有 `agent/` 文件的目录里运行：

```bash
eve init .
```

eve 会补上缺失的 `eve`、`ai` 和 `zod` 依赖，但不会改动项目里已有的其它内容。eve 依赖和 Node engine 来自同一个 release。eve 会把 `engines.node` 固定到该 release 支持的最低 major，例如 `24.x`。如果现有版本范围允许的所有版本都还在这个 major 内，它会保留现有范围；否则会替换这个范围并打印警告。

## 手动安装

如果不使用 `eve init`，而是手动把 eve 接进已有应用，先在 `package.json` 里声明兼容的 Node 运行时：

```json
{
  "engines": {
    "node": "24.x"
  }
}
```

然后安装依赖，并编写运行时需要的两个文件。`eve init` 脚手架会自动为你添加 `ai` 和 `zod`；手动安装时需要把三个包都装上：

```bash
npm install eve@latest ai zod
```

### 项目文件

一个最小 Agent 只需要两个文件。需要工具时再添加。

`agent/instructions.md` 是常驻系统提示词：

```md
You are a concise assistant. Use tools when they are available.
```

`agent/agent.ts` 保存运行时配置：

```ts
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-sonnet-4.6",
});
```

在处理真实客户数据前，需要确认你选择的模型提供商条款、路由路径和数据保留设置适合这类数据。

即使只有这两个文件，Agent 也已经可以做真实工作。默认 harness 会开箱提供文件、shell、web 和委派工具。完整列表以及覆盖或禁用方法见 [Default harness](./concepts/default-harness)。

### 添加第一个工具

文件名会成为模型看到的工具名，并且必须是 snake_case ASCII。创建 `agent/tools/get_weather.ts`：

```ts
import { defineTool } from "eve/tools";
import { z } from "zod";

// 模型会把这个工具看成 `get_weather`，名称来自文件名。
export default defineTool({
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string().min(1) }),
  async execute({ city }) {
    return { city, condition: "Sunny", temperatureF: 72 };
  },
});
```

工具运行在你的应用运行时里，可以访问完整的 `process.env`，它们不是在 [sandbox](./sandbox) 里运行。更多内容见 [Tools](./tools)。

## 运行应用

脚手架生成的应用会带一个 `dev` script，所以在应用根目录运行：

```bash
npm run dev
```

手动安装路径不会自动生成 `dev` script。可以通过 `npx` 运行二进制命令：

```bash
npx eve dev
```

eve 二进制还提供其它命令。你可以给每个命令加上 `npx` 前缀，或者在 `package.json` 里添加对应 script：

- `eve info`：显示当前可用路由和已编译产物。
- `eve build`：把 Agent 编译进 `.eve/`，并构建宿主输出。
- `eve start`：服务已构建输出。
- `eve dev`：启动本地运行时，并打开交互式[终端 UI](./guides/dev-tui)。

在开发 TUI 中输入一条消息，就能按顺序看到执行过程：先是 `get_weather` 调用，然后是它的结果，最后是回复。

同一个 CLI 也可以指向一个部署地址。`npx eve dev https://your-app.vercel.app` 可以驱动已部署应用，适合预览和生产冒烟测试。见 [Deployment](./guides/deployment)。

## 发送一条消息

每个 eve 应用都会暴露同一套稳定 HTTP API。先启动一个 durable session：

```bash
curl -X POST http://127.0.0.1:3000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"What is the weather in Brooklyn?"}'
```

响应里会有两个后面会复用的东西：

- JSON body 里的 `continuationToken`，用于继续这段对话。
- `x-eve-session-id` header，用于标识要流式读取的 run。

## 流式读取 session

连接到 session stream：

```bash
curl http://127.0.0.1:3000/eve/v1/session/<sessionId>/stream
```

这个 stream 是 NDJSON，内容类型为 `application/x-ndjson; charset=utf-8`。这次运行里，你会看到几个生命周期事件：

- `session.started`
- `actions.requested`，也就是 `get_weather` 调用
- `action.result`
- `message.completed`，也就是最终回复
- `session.completed`

`reasoning.appended` 和 `message.appended` 是可选的实时增量事件。不能展示增量输出的客户端可以忽略它们，只依赖 `reasoning.completed` 和 `message.completed`。

注意：在应用中展示、存储或传输 reasoning 事件时，需要考虑隐私、保密性和用户体验方面的影响。

完整事件集合还覆盖更多生命周期、human-in-the-loop 和授权事件，包括 `input.requested`、`turn.failed`、`authorization.required` 和 `authorization.completed`。每个事件及其数据结构见 [Sessions, runs and streaming](./concepts/sessions-runs-and-streaming)。

## 发送后续消息

当 session 等待下一条用户消息时，带上 token 发送 follow-up：

```bash
curl -X POST http://127.0.0.1:3000/eve/v1/session/<sessionId> \
  -H 'content-type: application/json' \
  -d '{"continuationToken":"<token>","message":"Now do Queens."}'
```

完整契约见 [Sessions, runs and streaming](./concepts/sessions-runs-and-streaming)。

## 让 coding agent 帮你搭建

如果是 Claude Code、Cursor 这类 coding agent 在帮你做配置，可以把下面这段 prompt 给它：

```text
Set up an eve agent for the user. eve is a filesystem-first TypeScript framework for durable agents, published as the npm package eve. Read its docs: once eve is installed they are bundled in the package at node_modules/eve/docs; before eve is installed, read the published Introduction and Getting Started pages. If the project has no eve app, scaffold one with `npx eve@latest init <name>`; add `--channel-web-nextjs` only when the user wants Web Chat. In a coding-agent launch, init installs dependencies and prints the project-specific dev command instead of starting the interactive terminal UI. A fresh project also initializes Git; an existing app keeps its repository and scripts. To add eve to an existing app, run `eve init .`, or install the dependencies by hand with `npm install eve@latest ai zod` (init adds ai and zod; the by-hand path needs all three). Make sure agent/agent.ts and agent/instructions.md exist, then add a first typed tool at agent/tools/get_weather.ts using defineTool from eve/tools with a Zod inputSchema and an inline execute. Start eve in a controllable background process with `npx eve dev --no-ui`, wait for the server URL, then exercise the HTTP API: create a session with POST /eve/v1/session, attach to GET /eve/v1/session/:id/stream, and send a follow-up with the returned continuationToken. Stop the dev process after verification. Verify with the project's typecheck, adapt model and provider choices to the project, and do not commit unless the user asks.
```

简化版可以这样理解：

```text
Set up an eve agent: read the eve docs (bundled at node_modules/eve/docs once eve is installed), scaffold with `npx eve@latest init <name>` (or `npm install eve@latest ai zod` in an existing app), add a typed tool at agent/tools/get_weather.ts, run it with `npx eve dev --no-ui`, then create a session, stream it, and send a follow-up.
```

一旦 `eve` 成为依赖，这个包会内置完整文档，所以 Agent 可以在本地从 `node_modules/eve/docs/` 读取，不需要联网获取。

如果在搭建之后还想添加平台 channel，可以在交互式终端里运行：

```bash
eve channels add slack
```

init flags 见上面的[快速开始](#快速开始)。

## 接下来读什么

- [Instructions](./instructions) 和 [Tools](./tools)：核心构建块。
- [Channels](./channels/overview)：从 Slack、Discord 或 Web UI 访问 Agent。
- [Frontend](./guides/frontend/overview)：用 `useEveAgent` 构建浏览器聊天。
- [TypeScript SDK](./guides/client/overview)：从脚本或服务端代码调用 Agent。
- [Sessions, runs and streaming](./concepts/sessions-runs-and-streaming)：durable session 模型。
- [Build an agent](./tutorial/first-agent)：完整端到端教程。
