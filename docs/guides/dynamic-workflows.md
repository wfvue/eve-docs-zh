---
title: "动态工作流（Dynamic Workflows）"
description: "实验性的 Workflow 工具：让模型用自己生成的 JavaScript 编排子智能体，并作为一个 durable step 执行。"
---

# 动态工作流（Dynamic Workflows）

实验性的 `Workflow` 工具允许模型编写 JavaScript，把当前 Agent 自己的子智能体作为一个 durable step 协调起来。程序可以按顺序运行子智能体，把一个结果传给下一个，对一个列表 fan out，并合并结果。你启用这个能力后，由模型决定是否以及如何执行编排。

一个 turn 本来就可以调用多个子智能体，parallel tool calls 也会并发 dispatch。Workflow 增加的是 **程序化协调（programmatic coordination）**：程序可以根据前一个结果决定要运行多少个子智能体、哪个输出喂给哪个调用、以及如何汇总结果。这类逻辑很难用几个一次性 tool calls 表达。

> 官方目录现在把 Workflow 写在 [内置工具（Built-in Tools）](../concepts/built-in-tools)。本页是中文站保留的补充入口。启用 API 已从 `ExperimentalWorkflow` 改为 `experimental_workflow()`。

## 启用 Workflow 工具（Enable the Workflow tool）

从 `agent/tools/workflow.ts` 导出实验性定义。Helper 名带 experimental 警告，但模型实际看到的工具名是 `Workflow`：

```ts title="agent/tools/workflow.ts"
import { experimental_workflow } from "eve/tools/workflow";

export default experimental_workflow();
```

没有这个文件时，`Workflow` 工具保持关闭。它只有在 Agent 有值得协调的子智能体，例如 built-in `agent` 或声明式 subagents 时，才有价值：

```ts title="agent/subagents/analyst/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  description: "Analyzes one metric: queries, computes, writes a short finding.",
  model: "anthropic/claude-opus-4.8",
});
```

当用户要求生成每周业务复盘时，模型可以选择指标，并为每个指标并行运行一个 `analyst`，最后合并 findings。下面是模型可能生成的 JavaScript：它根据 runtime 决定的 metrics 列表 fan out 到多个 `analyst`，再合并结果：

```js
const metrics = ["revenue", "signups", "churn"];
const findings = await Promise.all(
  metrics.map((metric) => tools.analyst({ message: `Summarize last week's ${metric}.` })),
);
return findings.join("\n\n");
```

每次 `tools.analyst(...)` 调用都会 dispatch 一个 child subagent。因此 parent stream 会记录每个 metric 的 `subagent.called`，以及每个完成时的 `subagent.completed`。

一个 Workflow 程序总共最多 dispatch `maxSubagents` 次子智能体调用（默认 100）。超出预算的调用不会启动子 session。只有根 session 收到 `Workflow`；它启动的 children 既收不到 `Workflow` 也收不到内置 `agent`。

## Workflow 能编排什么（What a workflow can orchestrate）

Workflow 只能访问当前 Agent 自己的 agents：built-in `agent`（自己的 copy）、声明式 [子智能体（Subagents）](../../subagents)，以及 [远程 Agent（Remote agents）](../remote-agents)。范围就这些。不包括文件、网络、shell、skills 或 connections。Workflow 是子智能体之上的协调层，不是执行其它工作的地方。

每个调用仍然可以像直接 subagent delegation 一样，通过 `outputSchema` 请求结构化输出。

## JavaScript 在哪里运行（Where the JavaScript runs）

编排代码不会接触 Agent 进程本身。Runtime 会把程序文本交给一个小型隔离 JavaScript engine，也就是 QuickJS sandbox，在那里运行。Host realm 中的任何东西都不会跨过去，因此没有 `process`，没有 Agent 的 `globalThis`，也没有 `import` / `require`。

程序只能访问两类东西：桥接进来的 Agent functions，也就是 `tools.<name>`，以及普通语言内置能力。这是 allowlist，而不是 denylist。

## 持久性、审批和可观测性（Durability, approvals, and observability）

- **Durable**。整个编排算作一个 step。一起 dispatch 的 subagents 会并发运行。如果某个 run 因长耗时或 human-gated child 而 park，重启后会从离开的地方恢复。见 [执行模型与持久性](../../concepts/execution-model-and-durability)。
- **Approval-safe**。如果子智能体在中途需要 human approval（HITL），请求会浮现给用户；回答后 workflow 会像直接 delegation 一样继续。
- **Observable**。每个被编排的子智能体都会在 parent stream 上发出常规 `subagent.called` / `subagent.completed` events，并拥有自己的 child session 和 stream。

## 接下来读什么（What to read next）

- 官方完整说明 → [内置工具（Built-in Tools）](../../concepts/built-in-tools)
- 声明 workflow 要编排的子智能体 → [子智能体（Subagents）](../../subagents)
- 把另一个部署作为其中一个 agent 调用 → [远程 Agent（Remote agents）](../remote-agents)
