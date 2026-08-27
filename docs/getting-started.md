---
title: "快速开始"
description: "安装 eve，生成第一个 Agent，添加一个工具，并在本地运行。"
---

# Getting Started：快速开始

eve 是一个 filesystem-first 的 durable agent 框架。你把能力写在 `agent/` 目录下，eve 负责运行模型循环、持久化每个 session，并通过 HTTP 和平台 channel 对外服务。本文会带你生成一个应用、添加一个工具、本地运行它，然后通过 HTTP 创建、流式读取并继续一个 session。

官方原文：[Getting Started](https://eve.dev/docs/getting-started)。中文页保留 HTTP 走查；官方 live 页更强调项目布局。

## 前置条件

- Node 24 或更高版本。
- npm，Node 会自带 npm。
- 一个模型凭据，见下文。

脚手架默认模型通过 Vercel AI Gateway 路由。在运行 Agent 前，需要先设置 `AI_GATEWAY_API_KEY`，或用 `vercel link` 拉取 `VERCEL_OIDC_TOKEN`。直接调用模型提供商时，安装对应 AI SDK provider 包并设置该提供商的 API Key。

你需要自行选择适合数据和场景的模型、提供商和 channel，并遵守每个模型提供商的条款以及数据处理要求。

如果跳过这一步，开发 TUI 会提示缺少凭据，它的 `/model` 命令会引导你粘贴密钥或关联项目。

## 快速开始

```bash
npx eve@latest init my-agent
```

这个命令会创建项目、安装依赖并初始化 Git。脚手架完成后，eve 会询问是启动开发服务器，还是（如果安装了受支持的 coding agent）打开该 coding agent。

如果要把 eve 加进已有项目，在已经有 `package.json` 且还没有 `agent/` 文件的目录里运行：

```bash
npx eve@latest init .
```

eve 会补上缺失的 `eve`、`ai` 和 `zod` 依赖，但不会改动项目里已有的其它内容。

### 自定义初始化

要用不同的 AI Gateway 模型或 reasoning effort 初始化，传入 `--model` 或 `--reasoning`：

```bash
npx eve@latest init my-agent --model openai/gpt-5.6-terra --reasoning high
```

## 运行应用

脚手架完成后选择 **Start eve dev**，或在项目根目录运行：

```bash
npm run dev
```

这会启动一次交互式 session，你可以给 Agent 发消息。手动安装路径用 `npx eve dev`。其它命令见 [CLI](./reference/cli) 和 [终端 UI](./guides/dev-tui)。

## 项目布局

eve 通过遍历 `agent/` 下的文件系统构建 Agent。最小 Agent 需要 `instructions.md`；默认配置够用时 `agent.ts` 可选。完整 slot 表见 [项目布局](./reference/project-layout)。

跨 session 记忆写在 `agent/memory/`，可复用能力包挂在 `agent/extensions/`。默认工具、覆盖和 opt-in（`glob`、`grep`、`Workflow`、`sleep`）见 [内置工具](./concepts/built-in-tools)。

## 手动安装

```bash
npm install eve@latest ai zod
```

在 `package.json` 里声明 Node.js 24，然后创建 `agent/instructions.md`；需要运行时配置时再写 `agent/agent.ts`。添加第一个工具时，文件名会成为模型看到的工具名：

```ts title="agent/tools/get_weather.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string().min(1) }),
  async execute({ city }) {
    return { city, condition: "Sunny", temperatureF: 72 };
  },
});
```

工具运行在应用 runtime，不是 [sandbox](./sandbox)。更多见 [Tools](./tools)。

## 发送一条消息

每个 eve 应用都暴露同一套稳定 HTTP API。先启动一个 durable session：

```bash
curl -X POST http://127.0.0.1:3000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"What is the weather in Brooklyn?"}'
```

响应里有 `continuationToken` 和 `x-eve-session-id`。连接到：

```bash
curl http://127.0.0.1:3000/eve/v1/session/<sessionId>/stream
```

完整事件集合见 [Sessions, runs and streaming](./concepts/sessions-runs-and-streaming)。

## 接下来读什么

- [项目布局](./reference/project-layout) 和 [教程](./tutorial/first-agent)
- [Instructions](./instructions) 和 [Tools](./tools)
- [记忆（Memory）](./memory) 与 [内置工具](./concepts/built-in-tools)
- [Channels](./channels/overview)、[Extensions](./extensions)、[添加集成](./install-integrations)
- [Frontend](./guides/frontend/overview) 和 [TypeScript SDK](./guides/client/overview)
- [执行模型与持久性](./concepts/execution-model-and-durability)
