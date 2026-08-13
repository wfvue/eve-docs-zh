---
title: "执行模型与持久性（Execution Model and Durability）"
description: "eve session 如何运行：durable 对话、按 step 打点的 turn，以及稍后恢复的 parked work。"
---

# 执行模型与持久性（Execution Model and Durability）

eve session 是一次 durable 对话。它可以运行数天，并且在你不做任何工作的情况下扛过进程重启和重新部署。你编写能力（tools、instructions、channels），eve 运行循环。

## Sessions、turns 和 steps

工作嵌套在三个层级：

- **session**：整个 durable 对话或任务。它长寿，可以跨越数天或数周内的许多请求而不丢失上下文。
- **turn**：一条用户消息和它触发的所有工作（模型调用、工具调用、推理），直到 Agent 产生它的响应。
- **step**：turn 内的一个 durable checkpoint（一次模型调用和它做出的工具调用）。

每个 turn 都作为 durable workflow 运行，构建在开源的 [Workflow SDK](https://workflow-sdk.dev/) 上（在 Vercel 上部署时是 Vercel Workflow）。eve 在每个 step boundary 打点进度并序列化 durable state。你的代码运行在受管理的 step 内，所以 tools、sandbox 和子智能体感觉上是同步的，即使它们底下的 session 是 durable 的。

Workflow SDK 并不固有地绑定 Vercel。在本地开发和自部署的 `eve start` 进程中，eve 默认使用 SDK 的本地 world；该 world 把 workflow runs 持久化到磁盘上的 `.eve/.workflow-data`，并通过同一组 Nitro 托管的 workflow 路由 dispatch。在 Vercel 上，同样的 workflow 代码改为运行在 Vercel Workflow 上，后者增加了平台特性，如最新生产部署路由和 dashboard run 元数据。

当 Vercel 生产部署变化时，现有 session 的下一个模型 turn 使用该部署当前的 instructions、model 和 tools。Durable session 保留它的对话历史和 authored state，所以基于身份的渠道（如 Telegram 私聊和 Twilio 电话号码对话）会采纳 Agent 更新，而不需要新 session。

Nitro 托管 HTTP 路由和 workflow entrypoints。它不提供 workflow state store 或 sandbox runtime。那些是单独的适配器：Workflow 使用活跃 world 实现，Sandbox 使用来自 `agent/sandbox` 或 `defaultBackend()` 的后端。

对高级自托管部署，根 `agent.ts` 可以用 `experimental.workflow.world` 选择要使用的已安装 Workflow world 包：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-opus-4.8",
  experimental: {
    workflow: {
      world: "@workflow/world-postgres",
    },
  },
});
```

World 包支撑 workflow state、队列、hooks 和流。把 secrets 和部署特定选项放在该包读取的 runtime 环境变量里，而不是 `agent.ts` 中。自定义 worlds 必须实现 eve 内置 `@workflow/*` 包（目前是 `5.0.0-beta` 线）所期望的 runtime 协议；Workflow SDK 会在初始化期间拒绝不兼容的协议版本。见 [自托管 eve](../guides/deployment/self-hosting#persist-workflow-state)、[agent.ts](../agent-config#workflow-world) 和 [Workflow Worlds](https://workflow-sdk.dev/worlds)。

## Agent loop 和 sandbox

一个 eve Agent 跨越两个责任不同的执行环境：

```txt
可信 app runtime                           完整 Node.js 访问和凭证
  Agent loop                               durable workflow、模型调用和编排
    agent/agent.ts                         agent/instructions.md
  Runtime code                             tools、hooks、instrumentation 和 connections
    agent/tools/**                         agent/hooks/**
    agent/instrumentation.ts               agent/connections/**
  Secrets 和 credentials                   provider keys、tool secrets 和 MCP/OpenAPI auth 留在这里
        │
        ▼ ctx.getSandbox()
隔离 sandbox                               没有 app secrets 的文件系统和进程
  Skills                                  为 Agent 物化 $HOME/.agents/skills
                                          （来自 agent/skills/**）
  Sandbox operations                      shell 命令、文件访问、脚本和服务器
  Workspace                               持久的 per-session 文件 /workspace
                                          （来自 agent/sandbox/workspace/**）
```

Agent loop 作为 app runtime 里的 durable workflow 运行。模型调用、工具执行器、hooks、instrumentation 和 connection 客户端也在这里运行，拥有完整 Node.js 访问。

App 侧代码通过 `ctx.getSandbox()` 触达 sandbox。内置 `bash`、`read_file`、`write_file`、`glob` 和 `grep` 工具使用它，当 authored tools 需要隔离的文件系统或进程访问时也可以使用它。

[sandbox](../sandbox) 拥有 per-session 文件系统和进程。Authored skills 物化在 `$HOME/.agents/skills` 下，`agent/sandbox/workspace/**` 播种 `/workspace`。Loop 和 sandbox 有解耦的生命周期：durable workflow 可以独立 park 或重启，而 app runtime 只在代码需要时打开或复用 sandbox compute。

这个拆分给 Agent 一个真正的文件系统和进程环境，而不把凭证或可信集成代码放进模型控制的 compute。Workflow 可以在不持有 sandbox compute 的情况下 park，而 sandbox 容量和后端可以独立于 durable 编排变化。因为访问流经 app 侧工具，sandbox 工作获得与任何其他工具调用相同的审批和 instrumentation 路径。

Provider keys、tool secrets 和 MCP、OpenAPI 与 connection 凭证留在 app runtime。当 sandbox 进程需要已认证的网络访问时，[凭证代理](./security-model#credential-brokering) 处理请求而不向进程暴露凭证。

## 崩溃后恢复（Resuming after a crash）

崩溃进程、命中超时或 turn 中途重新部署，run 会从最后一个完成的 step 继续，而不是重放整个 turn。已完成的 step 从不重跑；eve 重放记录的结果。中途被打断的 step 会重跑，所以要让非幂等副作用（如扣费和发邮件）幂等，或用审批门禁它们。该 step 已经写到 session stream 的内容会保留，重跑会在新 ids 下再次发出它的事件，所以流消费者会看到两次尝试——见 [事件信封](./sessions-runs-and-streaming#the-event-envelope)。

没有什么要配置的。eve 拥有 workflow 生命周期，session 默认 durable。

你不直接编写 workflow 代码。Workflow 原语（`start()`、`resumeHook()` 等）是 eve runtime 层的实现细节；channels、tools 和 hooks 从不碰它们。两个表面给你的代码 session 数据：工具通过 `ctx.session` 读取当前 session 的元数据（id、turn、auth、parent lineage），[`defineState`](../guides/state) 读写 session-scoped durable state。读写模型见 [State](../guides/state)。

## Parked work

有些工作必须等待，包括人类审批 [tool](../tools)、[connection](../connections) 的交互式 OAuth 登录，或长时间运行的 [subagent](../subagents)。在这些点，turn 会 durable 地 park。Workflow 挂起，不持有 compute，直到它等待的输入到达（点击、回调、子级完成），即使那晚得多。到达时，对话从它离开的确切位置继续。

## 消息投递与 steering

eve 不为 session 维护 durable 的用户消息 FIFO 队列。ID 地址化的 HTTP 投递和 channel 地址投递都面向 session 当前的 command inbox；两者都不是通用消息队列。

只有一个活跃 session 能拥有 channel continuation token。Channel 创建的 session 在处理第一个 turn 之前同时提交它稳定的 session-ID 别名和 channel 别名，如果另一个 run 已拥有该 channel 别名则创建失败。Rekeying 只替换那个 channel 别名。HTTP 创建的 session 有稳定的 ID 别名，没有 channel continuation token。竞争的 channel 输入不会转发给拥有者。

当 session 在等待时，通过它的 ID 或当前 channel 地址的投递会唤醒它并启动下一个 turn。消息发送默认 `turnPolicy: "steer"`：turn 活跃时，session driver 在请求协作式取消之前 durable 缓冲替代消息。被打断的 turn 发出 `turn.cancelled` 后跟 `session.waiting`，然后替代 turn 以新 turn ID 启动。部分输出和已完成的副作用不会回滚。

`turnPolicy: "queue"` 保留消息直到活跃 turn settle。如果 driver 检查时几条投递都就绪，eve 可能会把相邻消息折叠进下一个 turn，同时保留它们的到达顺序。纯 `inputResponses` 投递不会 steer；它们保持对它们所寻址的挂起请求可用。

每个内置和自定义渠道都接受默认 `turnPolicy`，命令式消息发送可以覆盖它。策略与消息在同一个 durable 投递命令里，所以并发发送方无法把替代所有权与取消意图分开。独立的 session 仍然独立运行。

## 子智能体（Subagents）

一个 turn 可以把工作交给 [subagent](../subagents)。每个子智能体有自己的上下文和 durable session；声明的子智能体还有自己的 sandbox、skills 和 state。没有任何东西隐式跨边界。

## eve 如何排列 session 历史

Session 内的对话历史是 append-only。Turns 按顺序落地，turn 内的工具调用（和它们的结果）也保持顺序。读回一个 session，你看到的事件就是它们发生的顺序。

## 接下来读什么（What to read next）

- [Sessions 和 streaming](./sessions-runs-and-streaming)：你持有的 handles 和你观看的事件流。
- [安全模型（Security model）](./security-model)：runtime 强制执行的信任边界。
- [State](../guides/state)：跨 step boundaries 持久化的 durable per-session memory。
