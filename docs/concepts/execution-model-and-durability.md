---
title: "执行模型与持久性（Execution Model and Durability）"
description: "eve session 如何运行：durable 对话、按 step 打点的 turn，以及稍后恢复的 parked work。"
---

# 执行模型与持久性（Execution Model and Durability）

eve session 是一次 durable 对话。它可以运行数天，并且在你不做任何工作的情况下扛过进程重启和重新部署。你编写能力（tools、instructions、channels），eve 运行循环。

官方原文：[Execution Model and Durability](https://eve.dev/docs/concepts/execution-model-and-durability)。

## Sessions、turns 和 steps

工作嵌套在三个层级：session（整段 durable 对话）、turn（一条用户消息触发的工作）、step（turn 内的 durable checkpoint）。每个 turn 作为 durable workflow 运行。详见官方页与 [Sessions 和 streaming](./sessions-runs-and-streaming)。

## Parked work

有些工作必须等待，包括人类审批 [tool](../tools)、[connection](../connections) 的交互式 OAuth 登录。在这些点，turn 会 durable 地 park。Workflow 挂起，不持有 compute，直到等待的输入到达。

后台工具与子智能体则返回**任务回执**，turn 可以继续；随后由 task notifications 送达进度或结果。

## 子智能体（Subagents）

一个 turn 可以把工作交给 [subagent](../subagents)。每个子智能体有自己的上下文和 durable session；声明的子智能体还有自己的 sandbox、skills 和 state。

## 接下来读什么

- [Sessions 和 streaming](./sessions-runs-and-streaming)
- [安全模型](./security-model)
- [Workflows as Tools](../tools/workflows)
- [子智能体](../subagents)
