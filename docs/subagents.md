---
title: "子智能体（Subagents）"
description: "把工作委派给根 Agent 副本或声明式专家；委派统一作为 durable 后台任务运行。"
---

# 子智能体（Subagents）

官方原文：[Subagents](https://eve.dev/docs/subagents)。

eve 支持两种委派：仅根可用的内置 `agent` 工具（启动或续跑根 Agent 的副本），以及目录声明的专家子智能体。用子智能体做并行独立工作、收窄工具面，或把任务交给专家。

> **官方说明（2026-09-03）：** 声明式本地 / 远程子智能体，以及内置 `agent`，都作为 **durable background task** 运行：调用立刻返回 `{ status: "working", taskId, agentId }`，后续用 task notifications 唤醒父级。面向模型的实验性 `Workflow` 编排工具叙事已收敛到 [Workflows as Tools](./tools/workflows) 与本页的任务模型。

## 完成批处理（Completion batching）

同一 session 拥有的重叠后台工作会组成 cohort。后续用户 turn 里启动的任务，在更早工作仍 pending、或其成功结果尚未投递时，会加入未关闭的 cohort。eve 会把成功完成的通知攒到 cohort 内每个任务都完成 / 失败 / 取消之后，再在一次父 turn 里一起送达；部分完成不会唤起父模型。cohort 结算后新开的工作形成新 cohort。无需配置或 debounce。用户消息、输入请求、鉴权、失败与取消不等待 cohort。

## 内置 `agent` 工具

根 session 默认收到 `agent`。模型可委派给根 Agent 的新副本，或续跑已有副本：

```ts
{
  message: string;       // 子级看不到父级历史，要带齐上下文
  agentId?: string;      // 续跑或 steer 已有 child
  outputSchema?: object; // 本 turn 要求结构化输出
}
```

副本使用根的 instructions、connections、auth 和 sandbox；工具集合与根相同，但**没有**仅根的 `agent`；对话历史与 state 全新。文件写入对根立刻可见。内置 `agent` **始终后台运行**，无需额外配置：每次调用返回 receipt，再通过 task notifications 送达更新或最终结果。并行 children 应使用互不重叠的写范围。

`agent` 故意仅根可用。它创建的副本不能再调 `agent`；声明式子智能体也收不到内置 `agent`。若过期或强制递归调用到达执行层，eve 会拒绝而不是再开 child。

父→子通过 `message` 传数据。除非子级及其继承的 tools / connections / sandbox / telemetry 适合该数据，否则不要把敏感信息放进请求。

禁用根委派：

在根 Agent 上设 `tool: false`，可禁止根 session 再委派「自己的副本」：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-opus-4.8",
  tool: false,
});
```

也可以在 `agent/tools/agent.ts` 导出 `disableTool()`。该路径上的 authored 根工具优先于 `tool: false` 与内置。

## 声明式子智能体

放在 `agent/subagents/<id>/`，与根一样用 `defineAgent`；位于 `subagents/` 即标记为子智能体。子级需要明显不同的 prompt、角色或工具面时再声明。

```ts title="agent/subagents/researcher/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  description: "Investigate ambiguous questions before the parent agent responds.",
  model: "anthropic/claude-opus-4.8",
});
```

`description` 必填；父级靠它决定是否委派。设 `tool: false` 可把子智能体从父模型的工具面拿掉，同时仍允许 authored [workflow 工具](./tools/workflows) 用 `ctx.agent()` 按名调用：

```ts title="agent/subagents/researcher/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  description: "Investigate ambiguous questions for the routing workflow.",
  model: "anthropic/claude-opus-4.8",
  tool: false,
});
```

父级也可以在同名工具路径（如 `agent/tools/researcher.ts`）导出 `disableTool()`：压掉派生的模型工具，但不把名字从 workflow 调用注册表拿掉。同名 authored 工具替换面向模型的表面后，workflow 仍可用 `ctx.agent("researcher", ...)` 调底层子智能体。

每个声明式本地或远程子智能体作为 durable background task 运行：立刻返回 receipt，再用 notifications 报告更新、完成、失败或取消。人类输入请求会单独浮现在父 session。

拥有后台任务的 session（包括启动了嵌套后台工作的 child）可用 `task_cancel`。进度不再经子级 `task_update` 回调上报；父级通过 child session stream / task notifications 跟进。

挂载的 extension 也可从 `extension/subagents/` 贡献子智能体；mount 命名空间会前缀到可见名（如 `crm__reviewer`）。见 [Extensions](./extensions)。

### Vercel workspace 同伴（defineWorkspaceAgent）

在 Vercel agent workspace 里，可用 `defineWorkspaceAgent` 把另一个 workspace 成员暴露为远程子智能体。文件放在调用方的 `agent/subagents/` 下：文件名是模型可见工具名，`name` 指向 `agents/` 下的同伴目录名。

```ts title="agents/foreman/agent/subagents/research.ts"
import { defineWorkspaceAgent } from "eve";

export default defineWorkspaceAgent({
  name: "research",
});
```

默认用同伴根 `defineAgent({ description })` 作为工具描述；也可传 `description` 覆盖。省略 `transport` 时，eve 为 **Vercel 运行环境**选择内置传输。本地 `vercel dev` 可在无部署凭据时路由 workspace 调用；Vercel 部署走当前 deployment，并用调用方 Vercel OIDC。命名同伴使用 `/eve/<name>` mount。在这些环境之外要显式提供 `url` 与可选 `auth` / `headers`。显式 transport 会完全替换环境默认值。需要转发用户身份时设 `forwardPrincipal: true`（见 [远程 Agent](./guides/remote-agents)）。用根 `vercel.ts` 经 `withEve` 组合后跑 `vercel dev --local`，可启动全部成员并启用默认本地 workspace transport。`eve dev` 只启动选定 Agent；要对着单独跑着的同伴调用，配置显式 transport。

### 条件可用

从该子智能体的 `agent.ts` 导出 `defineDynamic`：返回 `defineAgent` 配置则暴露，返回 `null` 则从父级工具面省略。解析器在 `session.started` 或 `turn.started` 运行（不支持 `step.started`）。打包控制（如 `build.externalDependencies`）放在外层 `defineDynamic` 上。详见 [动态能力](./guides/dynamic-capabilities#动态子智能体)。

最小文件：

```text
agent/subagents/researcher/
├── agent.ts            # 必填
├── instructions.md     # 或 instructions.ts，可选
├── tools/
├── extensions/
├── skills/
├── sandbox/
└── subagents/
```

`schedules/` 不支持在声明式子智能体内；schedules 仅根。

## 隔离边界

声明式子智能体**不**继承根的 authored slots。Discovery 把它的目录当作自己的 agent root。

| Slot | 根内置 `agent` | 声明式子智能体 |
| --- | --- | --- |
| Instructions | 继承（Agent 副本） | 自己的 `instructions.{md,ts}`，可选 |
| Tools | 继承，除仅根工具 | 自己的 `tools/` |
| Connections | 继承 | 自己的 `connections/` |
| Skills | 继承 | 自己的 `skills/` |
| Sandbox | 与父共享 | 自己的 `sandbox/`，否则框架默认 |
| Hooks | 继承 | 自己的 `hooks/` |
| Extensions | 继承贡献 | 自己的 `extensions/` |
| State | 全新 | 全新 |
| Channels / Schedules | 仅根 | 仅根 |

两个子智能体要同一流程时，把 skill 打进 [workspace extension](./extensions) 再分别 mount；共享 typed helpers 走 `lib/`。`defineState` 对两种委派都不共享。

## 父级看到什么

eve 把当前 Agent **启用了工具投影**的每个子智能体（内置副本、声明式或 [远程](./guides/remote-agents)）降成同一形状的模型可见工具：`{ message, agentId?, outputSchema? }`。父级必须在 `message` 里带齐上下文。

声明式子智能体可调用自己目录下的嵌套子智能体；没有单独的深度限制，嵌套止于目录树。内置 `agent` 仍遵循仅根规则；`limits.maxSubagentDepth` 已不存在。

Child sessions 仍可调用自己的声明式 / 远程子智能体，但收不到内置 `agent`。Authored workflow 工具使用与直接委派相同的子智能体可用性与授权检查。

直接声明的工具名是路径派生名，无前缀（`agent/subagents/researcher/` → `researcher`）。Extension 贡献的带 mount 前缀。默认情况下，子智能体名 `researcher` 会与同名 authored 工具冲突。若 authored 工具故意包装该子智能体，把子智能体的 `tool` 设为 `false`：authored 工具成为面向模型的能力，`ctx.agent("researcher", ...)` 仍指向 child。同名 `disableTool()` 会完全移除面向模型的能力。其它静态 / 活跃动态冲突仍是错误。

不要把子智能体委派本身当作审批边界；敏感工具仍要 `approval`、connection 审批、路由/session 鉴权等。

每个委派开启自己的 child session 与 stream。父 stream 有 `subagent.called` / `subagent.completed`，以及从后代代理的交互式 `input.requested` / `authorization.*`。跟进子级其它进度：读 `childSessionId` 再订阅 child stream。

带 activity 上报的渠道会把 backing Agent 的工具活动归属到其后台任务：本地与远程子智能体共享该任务的进度项，而不是再开一条独立的 agent 项。用 `agentId` 续跑或 steer child 时，新活动挂到**新**任务上；旧任务保持已完成 / 已取消状态。这适用于内置 `agent` 与声明式子智能体工具，**不**适用于自定义 workflow 工具内部的 child 调用。Activity 上报尽力而为，不改变任务执行或结果投递。

已 admit 的后台任务在发起 turn 取消后仍存活；尚未 admit 的随取消 step 拒绝。用 `task_cancel` 停已 admit 的任务。取消会把任务的最终通知投递给仍活跃的父级，即使必须强制停止该任务。父 session 终结会取消剩余 live tasks。

子智能体模型调用会对分类后的瞬时 provider 失败自动重试（含流开始后的 overload），最多三次新尝试，默认只重复当前未提交的 call。若声明的子智能体开启了 [Workflow checkpoint batching](./agent-config)，则可能重放当前批内未提交的多次调用与内联工具。其它可恢复错误回落到 Workflow 的 durable step 重试。瞬时模型重试与空响应补发耗尽后返回一次失败任务结果，不会叠两套重试预算；终端错误立即失败。

## Agent messaging

Child 回答后 park 而不是终结，保留 session 与历史。失败 turn 也可能 park。把 park 的 `agentId` 传回同一子智能体工具并带新 `message` 即可续跑。省略 `agentId`（或空 / null）总是新开 child；未知 `agentId` 回退为新开而不是失败。已知 `agentId` 走错子智能体工具 → `AGENT_MISMATCH`。

要 **steer** 正在运行的后台 child：用同一子智能体工具，带上它的 `agentId` 和更新后的 `message`。在答案输出或本地工具执行开始前，steering 会打断 child 待进行的模型生成，并在同一 turn 应用更新。正在执行的 tools 先收尾并 checkpoint；答案输出开始后，steering 等到下一个已提交的 Workflow 边界。receipt 保留同一 `agentId` 与 `taskId`；steering **不会**取消任务、替换其 completion callback，也不会撤销已发生的工具副作用。

仍在 starting、或归属于阻塞中的 workflow 调用（而不是已 admit 的后台任务）的 child，继续返回 `AGENT_BUSY`。投递失败会报告给调用方；eve 不会另开替换 child 来掩盖失败。

parked children 集合变化时，eve 注入带 `<agents>` 的 `[Agents]` 笔记；仅在列表变化时追加（利于 prompt cache）。父 session 结束时，eve 终结本地 children，并对远程 children 发已鉴权 reset（尽力而为）。

## 何时拆

需要不同 prompt / 专家角色、更窄工具面或独立 runtime 上下文时拆。可选流程用 [技能](./skills) 更轻。

## 接下来读什么

- [远程 Agent](./guides/remote-agents)
- [Workflows as Tools](./tools/workflows)
- [内置工具](./concepts/built-in-tools)
