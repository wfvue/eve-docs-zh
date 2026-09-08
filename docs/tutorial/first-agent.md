---
title: "你的第一个 Agent（Your First Agent）"
description: "脚手架分析助手、给它分析师人设、运行它并提问。"
---

# 你的第一个 Agent（Your First Agent）

若想按自己的场景定制学习体验，可先从 [eve 模板画廊](https://eve.dev/templates) 起步，或直接让编码 Agent 按用例搭建。例如：

- “做一个用团队文档回答问题的 eve Slack Agent。”
- “做一个用可观测工具排查告警的 eve 事故响应 Agent。”
- “做一个会分拣 issue、总结 PR 的 eve GitHub 维护 Agent。”

若更喜欢循序渐进，继续本教程。它端到端构建一个应用：**数据分析助手**。你用自然语言提问；在大约八步里，它学会查询示例数据、在 sandbox 里做分析、记住团队的指标定义，并在超出查询预算前征求确认。

第 1 步先让它开口。第 3 步会创建贯穿全教程的本地小数据集。完成本教程**不需要**仓库或 Vercel Connect 账户。[连接仓库](./connect-a-warehouse) 是 Agent 跑通后的可选后续。

## 前置条件

- Node 24 或更新版本，以及 npm。
- 可用的模型凭证，按 [Getting Started](../getting-started) 配置。沿用你在那里已经测通的模型和凭证即可。

如果你还没跑过 eve，先完成 [Getting Started](../getting-started)。没有凭证时，下面的「运行 Agent」会在 runtime 触达模型时失败；dev TUI 的 `/model` 流程会带你粘贴 key 或关联项目。

## 脚手架 Agent

```sh
npx eve@latest init analytics-assistant
cd analytics-assistant
```

命令写出 starter agent 与内置 HTTP API channel（`agent/channels/eve.ts`）、安装依赖、初始化 Git，并**询问**是否启动 dev server。若已启动，继续下面的编辑前先停掉。它不创建 Vercel 项目，也不部署。`init` 创建 `analytics-assistant/` 目录，所以跑后续命令前先 `cd` 进去。

## 沿用已配置的模型

`agent/agent.ts` 持有模型和配置。沿用 Getting Started 里已测通的模型和凭证即可；本教程不要求换 provider。若新项目需要配置，先在 dev TUI 用 `/model`，再发第一个问题。

## 给它分析师人设

`agent/instructions.md` 是常驻 system prompt。把 starter 文本替换成数据分析师的常驻身份：

```md title="agent/instructions.md"
You are a senior data analyst. You answer questions about the team's data.
- Prefer exact numbers to hand-waving. If you can compute it, compute it.
- State the assumptions behind any number you report (date range, filters, grain).
- Use the tools available to you rather than guessing. If you cannot answer from
the data, say so plainly.
```

Instructions 是身份和常驻规则。按需流程属于 skills（第 6 步），动作属于 tools（第 3 步）。见 [Instructions](../instructions)。

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
