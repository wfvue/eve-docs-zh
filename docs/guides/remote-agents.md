---
title: "远程 Agent（Remote Agents）"
description: "使用 defineRemoteAgent 把另一个 Eve 部署当作子智能体调用：相同的 lowered tool shape、outbound auth 和 durable callback dispatch。"
---

# 远程 Agent（Remote Agents）

`defineRemoteAgent` 可以把一个单独部署的 Eve Agent 当作本地子智能体调用。当你要委派的 specialist 是另一个 URL 后面的、由其它团队或系统拥有的 Agent，而不是当前仓库里的一个目录时，就使用它。

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

`defineRemoteAgent` 接收以下参数：

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `url` | `string` | Yes | n/a | 要调用的远程 Eve 部署 base URL。 |
| `description` | `string` | Yes | n/a | 模型可见的 delegation 描述。 |
| `auth` | `OutboundAuthFn` | No | none | 来自 `eve/agents/auth` 的 outbound auth hook。 |
| `headers` | `HeadersValue` | No | none | 静态或懒解析的请求 headers。 |
| `path` | `string` | No | `/eve/v1/session` | 拼接到 `url` 后面的 create-session route。 |
| `outputSchema` | `StandardSchema \| JSON Schema` | No | none | 调用方要求的结构化返回类型。编译时会 lowering 成 JSON Schema，并像普通 task-mode output schema 一样由远程端强制执行。 |

## Lowered tool（The lowered tool）

远程 Agent 会被 lowered 成和本地子智能体相同的 `{ message, outputSchema? }` tool shape。父 Agent 会把远程端需要的内容都打包进 `message`。远程 Agent 看不到父 Agent 的历史。

在这里或每次调用时设置 `outputSchema` 后，远程 Agent 会以 task mode 运行，也就是一次性 delegation，返回一个结构化结果，而不是开放式对话。见 [子智能体（Subagents）](../../subagents)。结构化输出会作为 tool result 返回。

## 出站鉴权（Outbound auth）

`auth` 是来自 `eve/agents/auth` 的 `OutboundAuthFn`，用于给 outbound dispatch 附加请求 headers：

| Helper | Header |
| --- | --- |
| `vercelOidc(opts?)` | `Authorization: Bearer <Vercel OIDC token>`，用于 deployment-to-deployment trust |
| `bearer(token)` | `Authorization: Bearer <token>`，支持静态或懒解析 token |
| `basic({ username, password })` | `Authorization: Basic …` |

如果调用的是另一个部署在 Vercel 上的 Eve Agent，通常使用 `vercelOidc()`。远程端会验证 OIDC token 来授权调用方。接收侧配置见 [鉴权与路由保护（Auth & route protection）](../auth-and-route-protection)。

## 远程 dispatch 和 callback 如何工作（How remote dispatch and callbacks work）

本地子智能体是 inline 运行的。远程子智能体运行在自己的部署中，因此 dispatch 是异步的：

1. 父 Agent 在远程 `POST /eve/v1/session` 上启动一个 task-mode session，并传入 framework callback URL。
2. 父 turn park，即 durably suspend 而不占用 compute，直到远程端 POST terminal callback。见 [执行模型与持久性（Execution model & durability）](../../concepts/execution-model-and-durability)。
3. Callback 到达后，父 Agent 恢复，并浮现结果。

Parent stream 会带有和本地 delegation 相同的 `subagent.called`、`action.result` 和 `subagent.completed` events。对于 remote call，`subagent.called.data.remote.url` 会记录目标 URL。

两种失败路径都会作为 failed tool result 浮现给父 Agent，调用方可以在同一 session 中解释或恢复。启动失败会 inline 返回错误。远程端已经启动但后续失败时，会 POST terminal failure callback；父 Agent 收到后，会得到携带远程错误的 errored subagent result，如果没有错误内容则为 `REMOTE_AGENT_FAILED`。Terminal callback delivery 会作为底层 workflow engine 上的 durable step 运行。Callback POST 失败会重新抛出，而不是把 task 标记为 complete，因此 engine 会重试。

## 接下来读什么（What to read next）

- 本地 delegation 和隔离边界 → [子智能体（Subagents）](../../subagents)
- 让模型程序化编排远程 Agents → [动态工作流（Dynamic workflows）](../dynamic-workflows)
- 保护接收侧部署 → [鉴权与路由保护（Auth & route protection）](../auth-and-route-protection)
