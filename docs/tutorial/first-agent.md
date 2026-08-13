---
title: "你的第一个 Agent（Your First Agent）"
description: "Build an Agent 教程第 1 步：脚手架分析助手、给它分析师人设、运行它并提问。"
---

# 你的第一个 Agent（Your First Agent）

Build an Agent 教程端到端构建一个应用：数据分析助手。你用自然语言提问，在接下来的九步里它学会查询仓库、在 sandbox 里运行分析、记住你团队的指标定义，并在不询问的情况下拒绝超出你的查询预算。

第 1 步让它开口说话。脚手架打包了一个小型示例数据集，所以你的第一个问题零设置即可工作。

## 前置条件

- Node 24 或更新版本，以及 npm。
- 一个模型凭证。脚手架的默认模型走 [Vercel AI Gateway](../getting-started)，所以你需要 `AI_GATEWAY_API_KEY`（或通过 `vercel link` 拉取的 `VERCEL_OIDC_TOKEN`）。直接 provider 模型（如 `anthropic("claude-opus-4-8")`）需要那个 provider 的 AI SDK 包和 key，这里是 `@ai-sdk/anthropic` 和 `ANTHROPIC_API_KEY`。

如果你还没跑过 eve，先完成 [Getting Started](../getting-started)。没有凭证时，下面的 "Run the agent" 会在 runtime 尝试触达模型时失败；dev TUI 的 `/model` 流程会带你粘贴 key 或关联项目。

## 脚手架 Agent

```sh
npx eve@latest init analytics-assistant
cd analytics-assistant
```

命令写出带 eve 默认模型和内置 HTTP API channel（`agent/channels/eve.ts`）的 starter agent、安装依赖、初始化 Git 并启动 dev server。继续下面的编辑前先停掉 server。它不创建 Vercel 项目，也不部署。`init` 创建 `analytics-assistant/` 目录，所以跑后续命令前先 `cd` 进去。

## 设置模型

`agent/agent.ts` 持有模型和配置。分析工作用有能力的模型：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-opus-4.8",
});
```

## 给它分析师人设

`agent/instructions.md` 是常驻 system prompt。把 starter 文本替换成数据分析师的常驻身份：

```md title="agent/instructions.md"
You are a senior data analyst. You answer questions about the team's data.
- Prefer exact numbers to hand-waving. If you can compute it, compute it.
- State the assumptions behind any number you report (date range, filters, grain).
- Use the tools available to you rather than guessing. If you cannot answer from
the data, say so plainly.
```

Instructions 是身份和常驻规则。按需流程属于 skills（第 7 步），动作属于 tools（第 3 步）。见 [Instructions](../instructions)。

## 运行 Agent

```sh
npm run dev
```

`init` 脚手架写了一个 `dev` 脚本，从项目的 `node_modules` 运行 `eve dev` 二进制。本地 runtime 启动，dev TUI 打开。先问一个它能用常识回答的问题：

```txt
What's a good way to measure week-over-week retention?
```

你得到遵循分析师人设的回复。它现在还看不到你的数据（第 3 步才有）。先看看幕后发生了什么。

→ 下一步：[它如何运行（How it runs）](./how-it-runs)
了解更多：[Getting Started](../getting-started) · [Instructions](../instructions)
