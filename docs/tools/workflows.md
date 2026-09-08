---
title: "Workflows as Tools（工作流工具）"
description: "用 defineWorkflowTool 定义 durable 工作流工具：可等待人、webhook 或定时器，中间不占计算。"
url: /tools/workflows
---

# Workflows as Tools（工作流工具）

官方原文：[Workflows as Tools](https://eve.dev/docs/tools/workflows)。

Workflow tool 用 `eve/tools` 的 `defineWorkflowTool` 定义，且 executor 的第一条语句是 `"use workflow"`。每次调用启动一条 durable Workflow run。适合等人、等 webhook / 定时器、委派子智能体，或在较长周期内协调可重试步骤。

Durable 挂起与后台执行相互独立：`defineWorkflowTool` 让 body 能在 durable wait 处挂起并释放计算；`execution: "background"` 决定父 Agent 是否在 body 结束前就收到 task receipt 并继续。两种执行模式都可以挂起。

体内使用 [Workflow SDK](https://workflow-sdk.dev)（`"use workflow"`、`"use step"`、`createHook`、`createWebhook`、`sleep`、重试与 replay）。eve 提供 `ctx.ask`（经 session channel 问答）和 `ctx.agent`（durable 子智能体委派）。用 `yield` 报告进度，用 `await` 工作流操作做 durable 等待；等待之后还要用的值放在局部变量里。

> **相对旧中文稿：** `eve/workflow` 入口与顶层 `ask(ctx, …)` / `agent(ctx, …)` 已移除；请改用 `defineWorkflowTool` + `ctx.ask` / `ctx.agent`。Webhook 由框架生成可公开 resume 的 token；需要确定性 token 时用 `createHook` + `resumeHook`。

## 定义一个 workflow tool

```ts title="agent/tools/deploy.ts"
import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { computePlan, runDeploy, type DeployPlan } from "../lib/deploy";

export default defineWorkflowTool({
  description: "Deploy a service to production. Pauses for a human to approve the plan.",
  inputSchema: z.object({ service: z.string() }),
  async execute({ service }, ctx) {
    "use workflow";
    const plan = await planDeploy(service);
    const answer = await ctx.ask({
      prompt: `Deploy ${service}?\n\n${plan.summary}`,
      display: "confirmation",
      options: [
        { id: "approve", label: "Deploy", style: "primary" },
        { id: "cancel", label: "Cancel" },
      ],
    });
    if (answer.optionId !== "approve") {
      return { deployed: false, reason: "rejected" };
    }
    return { deployed: true, url: await applyDeploy(plan) };
  },
});
```

### 规则（摘要）

- 默认导出 `defineWorkflowTool({ ... })`；`execute` 必须是 async / async generator，且第一条语句是 `"use workflow"`（缺 directive 是构建错误）。
- `"use step"` 标记顶层 async 函数为 step；副作用、时钟、随机、`process.env`、Node API 放在 step；body 可被 replay，须保持确定性。
- 从 `workflow` 导入 `createHook` / `createWebhook` / `sleep` / `FatalError`；`workflow/api` 的 `start` / `getRun` / `resumeHook` 放在 step。应用不必安装 SDK；新项目可在 tsconfig `types` 列入 `eve/workflow-modules`。
- Body 里的 `ctx` 有 `session`、`callId`、`toolName`、`abortSignal`、`agent`、`ask`。`getSandbox` / `getSkill` / `getToken` / `requireAuth` **不在** `WorkflowToolContext` 上——凭据在 step 里读 `process.env`。
- 工具输入必须是 JSON object。Workflow body 用于 `agent/tools/` 静态工具，不用于 `defineDynamic` 返回的工具。
- 给 `defineTool`、裸 tool 对象、channel / schedule handler 加 `"use workflow"` 会构建失败。

Workflow 导入会解析应用 `tsconfig.json` / `jsconfig.json` 里的 `paths` 别名，即使应用是 workspace package 也可以。eve 只打包从 Agent runtime 模块可达的 workflow 与 step 模块；宿主应用里无关的 workflow 留在 Agent bundle 之外。未解析的 workflow 导入会让构建失败，并在错误中指出缺失导入。

### 从旧 workflow tool 迁移

把 `defineTool` 换成 `defineWorkflowTool`，保留 `"use workflow"`，把 `agent(ctx, input)` / `ask(ctx, request)` 换成 `ctx.agent(input)` / `ctx.ask(request)`。需要显式类型时从 `eve/tools` 导入 `WorkflowToolContext` 等。

## 等待还是后台

两种模式都支持相同的 durable waits；按「父 Agent 何时拿到 tool result」选择：

| | 默认 | `execution: "background"` |
| --- | --- | --- |
| tool result | workflow 结束后的输出 | body 结束前的 `{ status: "working", taskId }` |
| 父 turn | 等该 tool call 结束 | 收到 receipt 后继续 |
| body 内 durable wait | 挂起 workflow；call 仍 pending | 挂起 workflow；父可独立继续 |
| run 结束 | 结算 pending tool call | 向父发 task 完成/失败 notification |
| 取消 | 取消 turn 即取消 run | `task_cancel`，或 session 结束 |

默认模式：模型需要答案才能继续。后台模式：对话应在任务 pending 时继续。普通 `defineTool` 也可设 `execution: "background"`，但其 executor 仍在发起 step 内跑，**不能**在 workflow wait 处挂起。对比见 [工具：后台执行](./overview#后台执行)。

`yield` 本身不会等人、也不会把工具切成后台。step 里的普通 Promise / Node 定时器也**不会**创建 durable 挂起——要用工作流操作。

## `ctx.ask` / `ctx.agent` / `yield`

- **`ctx.ask`**：在 session channel 上发 `input.requested`（渲染方式类似 `ask_question` / 审批），返回可 await 的答案；await 会挂起 run。请求属于 run 而非 turn；后台工具里可远长于发起 turn。结束 run（return / throw / 取消）会撤回 pending 请求。可用 `Promise.race([pending, sleep("4h")])` 加截止。
- **`ctx.agent`**：调用可见子智能体并等待结果。`key` 必填且在 run 内唯一（replay 身份）；并行调用用不同 key。`target` 是模型可见子智能体名；`agentId` 续跑已有 child；可带 `outputSchema`。
- **`yield`**：两种执行模式都可报告进度。后台下 `yield task.postMessage(message)` 才会请求父 Agent turn；调用 `task.postMessage` 只构造描述符。默认模式下显式 `return null` 也会回退到最后一次 yield——进度与最终结果形状不同时，请显式返回对象。

后台进度示例：

```ts title="agent/tools/remind_with_progress.ts"
import { defineWorkflowTool } from "eve/tools";
import { sleep } from "workflow";
import { z } from "zod";

export default defineWorkflowTool({
  description: "Schedule a reminder and report progress before waiting.",
  inputSchema: z.object({ note: z.string(), delay: z.string() }),
  execution: "background",
  async *execute({ note, delay }, ctx, task) {
    "use workflow";
    yield { status: "preparing reminder" };
    yield task.postMessage(`Reminder scheduled for ${delay}.`);
    await sleep(delay);
    return { reminder: note };
  },
});
```

## Webhook 回调

`createWebhook` 在 `/.well-known/workflow/v1/webhook/` 下铸 URL，由 eve 服务。外部系统完成后 POST；中间不跑代码。Webhook token **由框架生成**；需要确定性 token 时用 `createHook` + `resumeHook`。自定义 HTTP 响应：向 `createWebhook` 传 `respondWith: new Response(...)`。

## 取消：`ctx.abortSignal`

run 被取消时（等待工具的 steered turn；后台工具的 `task_cancel` / session 结束）`abortSignal` 会 abort，且 durable——能跨 replay。信号发出后，run 最多再等 30 秒让 body 收尾，然后无论是否收尾都按取消结束。停在 hook / `sleep` 上的 body 观察不到信号，宽限期结束即放弃。

## 项目建议

- 新代码一律 `defineWorkflowTool` + `ctx.*`，不要再依赖已移除的 `eve/workflow`。
- 进度用 `yield`；需要父 Agent 再想一轮时用 `task.postMessage`（仅后台）。
- 非幂等副作用放进 `"use step"`，并自备幂等键——dispatch 重试可能再开一条 run。

## 接下来读什么

- [工具（Tools）](./overview)
- [子智能体](../subagents)
- [人在环中](./human-in-the-loop)
