---
title: "Durable Tools（工作流工具）"
description: "把 tool 的 execute 写成 Workflow：可等待人、webhook 或定时器；默认等待结果，也可 background 回执。"
url: /tools/workflows
---

# Durable Tools（工作流工具）

官方原文：[Durable Tools](https://eve.dev/docs/tools/workflows)。

工具的 `execute` 可以是一个 workflow。eve 为每次 tool call 启动一条 durable run；**默认会等待**：run 的返回值就是 tool result，无论等多久。run 在等人、等 webhook 或 sleep 时，turn 会 park，中间不占计算。同一工具标成 `execution: "background"` 时，模型先拿到 receipt；run 结束后 eve 再用返回值唤醒 Agent。

工具体内就是 [Workflow SDK](https://workflow-sdk.dev)：`"use workflow"`、`"use step"`、`createHook`、`createWebhook`、`sleep`、重试与 replay。eve 额外提供 `eve/workflow` 的 `ask`（会话 channel 上的人来回答）和 `agent`（从 workflow tool 委派）。每次 `yield` 被当作 durable 进度报告。

> **官方说明：** 这是正式的 durable tool 模型。原先面向模型的实验性 `Workflow` 编排工具已被这条路径与后台 subagents（任务生命周期）取代相关叙事；子智能体委派走 background task，详见 [子智能体](../subagents)。

## 写一个

```ts title="agent/tools/deploy.ts"
import { defineTool } from "eve/tools";
import { ask } from "eve/workflow";
import { z } from "zod";

export default defineTool({
  description: "Deploy a service to production. Pauses for a human to approve the plan.",
  inputSchema: z.object({ service: z.string() }),
  async execute({ service }, ctx) {
    "use workflow";

    const plan = await planDeploy(service);
    const answer = await ask(ctx, {
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

async function planDeploy(service: string) {
  "use step";
  return computePlan(service);
}

async function applyDeploy(plan: DeployPlan) {
  "use step";
  return runDeploy(plan);
}
```

模型调用 `deploy` → turn park → 人批准后 run 恢复 → 返回一个 tool result。

### 规则（摘要）

- `"use workflow"` 单独成行，作为 `execute`（或作为 `execute` 引用的顶层 async 函数）的第一条语句。
- `"use step"` 标记顶层 async 函数为 step；副作用、时钟、随机、`process.env`、Node API 放在 step 里；workflow body 可被 replay，须保持确定性。
- 从 `workflow` 导入 `createHook` / `createWebhook` / `sleep` / `FatalError`；`workflow/api` 的 `start` / `getRun` / `resumeHook` 放在 step 里。应用不必安装 SDK；新项目可在 tsconfig `types` 列入 `eve/workflow-modules`。
- Body 里的 `ctx` 有 `session`、`callId`、`toolName`、`abortSignal`。`getSandbox` / `getSkill` / `getToken` / `requireAuth` 在 body 里会抛错——凭据在 step 里读。
- 工具输入必须是 JSON object。Workflow body 用于 `agent/tools/` 下的静态工具，不用于 `defineDynamic` 返回的工具。

## 等待还是后台

| | 默认 | `execution: "background"` |
| --- | --- | --- |
| tool result | run 的返回值 | `{ status: "working", taskId }` |
| run 存活期间的 turn | park | 继续 |
| run 结束 | 结果落到该 tool call | 用结果或错误唤醒 Agent |
| 进度（`yield`） | turn 上的 `action.partial` | 用 note 唤醒 Agent |
| 取消 | 取消 turn 即取消 run | `task_cancel`，或 session 结束 |

模型需要答案才能继续时用等待；等待可能长过对话、或希望用户继续聊时用后台。后台工具与其它 background tools 一样，需要根 Agent 的 `experimental.tasks`。

## `ask`：问人

`ask` 在 session 上发布 `input.requested`（渲染方式与 `ask_question` / 工具审批类似），并返回 answer 恢复用的 hook。Await 会挂起 run，直到有回复。因为它是 hook，可以和 SDK 构造组合，例如与 `sleep` 竞速设 deadline。

要点：

- 请求属于 **run** 而不是 turn；后台工具里甚至可在发起 turn 之后很久仍可回答。
- 一次请求只答一次；需要下一答再 `ask`。
- run 结束（return / throw / cancel）会撤回未决请求。
- 可同时 outstanding 多个请求。
- 回复**不会** steer；有未决请求时新的人类消息仍遵循 session 的 `turnPolicy`。

对比 [`approval`](./human-in-the-loop)：审批在 `execute` 前闸住调用，且只能展示模型输入。两者可组合：`approval` 在前，`ask` 在内。

## `agent`：委派

Workflow tools 可调用可见子智能体并等待结果：

```ts
import { agent } from "eve/workflow";

const result = await agent(ctx, {
  key: "security-review",
  target: "reviewer",
  message: "Review the deployment plan for security risks.",
});
```

`key` 必填、非空，且在 workflow run 内唯一，用于跨 replay 的稳定身份。并行调用必须用不同 key。`target` 是模型可见的子智能体名；可用 `agentId` 续跑已有 child，用 `outputSchema` 要求结构化输出。

## `yield`：进度

Workflow body 可以是 async generator。每次 `yield` 是 durable 进度快照；return 值是结果（若不 return 则最后一次 yield）。

等待工具的每个 `yield` 作为 `action.partial` 流式发出（按 tool call id last-write-wins），**不进**模型历史。后台工具的每个 `yield` 用 note 唤醒 owning Agent。

## `ctx.abortSignal`

run 被取消时 abort（等待工具：被 steer 的 turn；后台：`task_cancel` 或 session 结束）。它是 durable 的，会跨 replay，收到它的 step 能观察到 abort。传给应停止的 steps，并在 `try/finally` 清理。信号触发后最多给 body 约 30 秒收尾；挂在 hook / `sleep` 上的 body 可能观察不到信号。

## 语义摘要

- 一次调用、一个结果。等待工具的 call 解析一次（返回值 / 错误 / 取消）。后台工具的 call 先解析为 receipt；之后都是独立的 session input。
- 等待工具运行时 turn park。`queue` 消息会等；`steer` 会取消 turn → 取消 run → 撤回请求。Input responses 永不 steer。
- 后台 runs 属于 session：跨 turn 存活，进入 task index，可用 `task_cancel`，session 结束时取消。
- 错误遵循 SDK：step 内抛错按 step 策略重试；`FatalError` 不重试；逃出 body 的错误使 run 失败。
- 身份跟工具走：workflow id 来自工具路径，重命名/移动文件等于新 workflow。进行中的 runs 在启动它们的部署上完成。

## 项目建议

- 长审批、外部回调、定时提醒：优先 durable tool，而不是自己堆状态机。
- 需要人继续对话时用 `execution: "background"` + `ask`。
- 与 [人在环中](./human-in-the-loop) 分工：入口闸用 `approval`，流程内问答用 `ask`。

## 接下来读什么

- [工具（Tools）](./overview)
- [人在环中](./human-in-the-loop)
- [子智能体](../subagents)
- [执行模型与持久性](../concepts/execution-model-and-durability)
