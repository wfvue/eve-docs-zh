---
title: "远程 Agent（Remote Agents）"
description: "使用 defineRemoteAgent 把另一个 Eve 部署当作子智能体调用：相同的 tool call、outbound auth 与 durable 后台任务回调。"
---

# 远程 Agent（Remote Agents）

`defineRemoteAgent` 可以把一个单独部署的 Eve Agent 当作本地子智能体调用。当你要委派的 specialist 是另一个 URL 后面的、由其它团队或系统拥有的 Agent，而不是当前仓库里的一个目录时，就使用它。

官方原文：[Remote Agents](https://eve.dev/docs/guides/remote-agents)。

文件放在 `agent/subagents/` 下，所以它的 tool name 会从路径派生，不需要 `name` 字段。

```ts title="agent/subagents/weather.ts"
import { defineRemoteAgent } from "eve";
import { vercelOidc } from "eve/agents/auth";

export default defineRemoteAgent({
  url: "https://weather-agent.example.com",
  description: "Answers weather, temperature, forecast, wind, rain, and snow questions.",
  auth: vercelOidc(),
});
```

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `url` | `string \| (() => string \| Promise<string>)` | Yes | n/a | 远程 Eve 部署 base URL。字符串在编译期固化；函数在运行时解析（可读 `process.env`）。 |
| `description` | `string` | Yes | n/a | 模型可见的 delegation 描述。 |
| `auth` | `OutboundAuthFn` | No | none | 来自 `eve/agents/auth` 的 outbound auth hook。 |
| `forwardPrincipal` | `boolean` | No | `false` | 把发起 turn 的 session principal 转发给远程部署。 |
| `headers` | `HeadersValue` | No | none | 静态或懒解析的请求 headers。 |
| `path` | `string` | No | `/eve/v1/session` | create-session 请求拼到 `url` 后的路径。 |
| `outputSchema` | `StandardSchema \| JSON Schema` | No | none | 每个新远程 session 首 turn 的结构化返回类型；续跑可另带 per-call schema。 |

## 动态远程 Agent

目标或可用性取决于当前 session 时，用 `defineDynamic` 包装：返回 `defineRemoteAgent(...)` 则暴露，返回 `null` 则省略。支持 `session.started` / `turn.started`。函数型 URL 在事件处理时解析；`auth` / `headers` 保持懒解析，且不要闭包 `_event` / `ctx`。

## 调用方式

对模型而言，远程 Agent 就是另一个子智能体工具：传 `message`，可选 `outputSchema`。`message` 必须带齐任务与上下文，因为远程端看不到父级历史。结构化结果出现在任务的 completion notification 里，远程 child 仍可续聊。续跑行为见 [子智能体](../../subagents)。

## 出站鉴权

Vercel 上 Agent 调另一个 Vercel Agent 时，常用 `vercelOidc()`。跨项目时，在接收方的 eve channel 用 `vercelOidc({ subjects: [...] })` 允许调用方项目；若开了 Deployment Protection，还要配 Trusted Sources。细节见 [鉴权与路由保护](../auth-and-route-protection)。

## 转发调用方身份

默认远程 session 以**你的调用应用**身份运行，而不是终端用户。需要远程侧按用户工作（例如 per-user Vercel Connect）时，设 `forwardPrincipal: true`。线上只传 principal 元数据，不传 token；接收方用自己的 connections 解析凭据。接收方必须用 `eveChannel({ trustedForwarders })` 显式信任转发者，否则 403。

> ⚠️ **官方说明：** 在依赖较新的续跑 / reset 行为前，先升级两端部署。带 continuation forwarding 的发送方会在已鉴权 follow-up 上带 `forwardedPrincipal`；只支持创建时转发的旧接收方会以 HTTP 400 拒绝——eve 不会去掉该字段重试，以免静默改成 service principal。

## 远程 dispatch 与回调

远程子智能体在自己的部署里作为 **durable 后台任务**运行：

1. 父级在远程 `POST /eve/v1/session` 上启动持久会话，并传入 framework callback URL。
2. 远程接受 child 后，调用立刻返回 `{ status: "working", taskId, agentId }`。
3. 稍后 callback 结算任务，并向父级发送 task notification。

Parent stream 带有与本地委派相同的 `subagent.called`、`action.result`、`subagent.completed`；远程调用时 `subagent.called.data.remote.url` 记录目标。

已 admit 的任务在发起 turn 取消后仍存活；尚未 admit 的随取消 step 拒绝。用 `task_cancel` 停已 admit 的任务。取消时 eve 会重新解析 `headers` / `auth`。父 session 结束时，eve 对每个远程 child 发已鉴权 `reset`（尽力而为）。

启动失败会在返回 receipt 前拒绝 admit。启动后终端失败 callback 会使任务失败并用远程错误（或 `REMOTE_AGENT_FAILED`）通知父级。Terminal callback delivery 作为 durable step；POST 失败会重抛以便 engine 重试。

## 项目建议

- 远程与本地子智能体对模型暴露同一形状；优先把差异放在鉴权与运维边界。
- 跨用户复用同一远程 child session 时，注意历史与工具输出仍可能可见——需要隔离就分 session。

## 接下来读什么

- [子智能体](../../subagents)
- [鉴权与路由保护](../auth-and-route-protection)
- [Workflows as Tools](../../tools/workflows)
