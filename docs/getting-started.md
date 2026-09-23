---
title: "快速开始"
description: "创建 eve 项目、配置模型凭据，并运行第一个 Agent。"
---

# Getting Started：快速开始

官方原文：[Getting Started](https://eve.dev/docs/getting-started)。

eve 是 filesystem-first 的 durable agent 框架。先从一个 `agent/` 起步；项目怎么组织、槽位怎么命名，见[项目结构](./concepts/project-structure)与 [Agent Files](./reference/agent-files)。

## 前置条件

你需要：

- Node.js 24 或更高版本
- npm（Node.js 自带）
- Agent 所用模型的凭据

在终端 UI 里连接 ChatGPT 订阅、Vercel 账户，或 AI Gateway / OpenAI / Anthropic API key。开始聊天**不需要**先有 Vercel 项目。

请选择符合你数据处理与合规要求的模型、提供商和 channel。

## 创建项目

从一个 `agent/` 里的根 Agent 开始。

用项目名运行 `eve init`：

```bash
npx eve@latest init my-agent
```

该命令会创建项目、安装依赖、初始化 Git，并打开终端 UI。eve 会复用已有模型连接，或打开 `/login`。连上之后直接输入第一条消息。Channel 与集成是可选的；需要时用 `/add`。

在 `/add` 里可按名称或能力搜索，例如 `iMessage` 或 `SMS`。选择器会匹配条目名、地址、标题与描述。选中后安装并完成必要设置。

启动时状态行会显示 eve 在等什么。若选 Vercel 账户，在浏览器完成登录并按提示选 team；eve 会检查该 team 的 AI Gateway 访问，应用连接后再回到 composer。只改账户、team 或 key **不会**重建 Agent。连上之后即可发第一条消息，Agent 信息在后台刷新，无需重启。

要把 eve 加进已有 `package.json` 的项目，在创建任何 `agent/` 文件之前，于项目根运行：

```bash
npx eve@latest init .
```

eve 会补上缺失的 `eve`、`ai`、`zod` 依赖，不改动项目已有文件。

### 自定义初始化

要用不同的 AI Gateway 模型或 reasoning effort，传 `--model` 或 `--reasoning`：

```bash
npx eve@latest init my-agent --model openai/gpt-6-luna --reasoning high
```

## 运行 Agent

交互式初始化结束后会打开终端 UI。之后再回来时：

```bash
cd my-agent
npm run dev
```

这会启动交互式 session。改 `agent/instructions.md` 调整行为，改 `agent/agent.ts` 配置模型；eve 会在工作时热重载。

<a id="project-layout"></a>
<a id="agent-directory-layout"></a>
<a id="naming-from-paths"></a>
<a id="recommended-layout"></a>
<a id="nested-layout"></a>
<a id="agent-files-and-directories"></a>
<a id="files-available-in-the-sandbox"></a>
<a id="local-subagents"></a>
<a id="flat-layout"></a>
<a id="debug-file-discovery"></a>

## 组织项目

要加第二个根 Agent，或决定前端放哪，见[项目结构](./concepts/project-structure)。支持的文件与发现规则见 [Agent Files](./reference/agent-files)。中文实践对照也可看 [项目布局](./reference/project-layout)。

## 手动安装

不想用脚手架时，安装运行时依赖：

```bash
npm install eve@latest ai zod
```

在 `package.json` 声明 Node.js 24，然后创建 `agent/instructions.md`；需要运行时配置时再写 `agent/agent.ts`。

添加第一个工具时，文件名即模型看到的工具名：

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

工具跑在应用 runtime，不是 [sandbox](./sandbox)。更多见 [Tools](./tools)。

## 发送一条消息（中文补充）

每个 eve 应用暴露同一套稳定 HTTP API。先启动 durable session：

```bash
curl -X POST http://127.0.0.1:3000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"What is the weather in Brooklyn?"}'
```

响应里有 `continuationToken` 和 `x-eve-session-id`。再连到：

```bash
curl http://127.0.0.1:3000/eve/v1/session/<sessionId>/stream
```

完整事件集合见 [Sessions, runs and streaming](./concepts/sessions-runs-and-streaming)。

## 继续教程

[教程](./tutorial/first-agent) 会逐步做一个数据分析 Agent：tools、state、sandbox 分析、可复用 skills、人工审批，再到部署。

教程之后按任务继续：

| 目标 | 阅读 |
| --- | --- |
| 给模型可运行的代码 | [Tools](./tools) |
| 连接外部 MCP / OpenAPI | [Connections](./connections) |
| 通过 Slack、Discord 等沟通 | [Channels](./channels/overview) |
| 做浏览器界面 | [Frontend](./guides/frontend/overview) |
| 测试 Agent 行为 | [Evals](./evals/overview) |
| 加固并部署 | [鉴权](./guides/auth-and-route-protection)，再 [部署](./guides/deployment/overview) |

Session、turn、durable step 与 parked work 的心智模型，见[执行模型与持久性](./concepts/execution-model-and-durability)。
