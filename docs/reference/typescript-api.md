---
title: "TypeScript API"
description: "define* helpers、运行时 ctx，以及每个从哪导入。"
---

# TypeScript API

这是 `eve` 包的公开表面：你用来编写的 `define\*` helpers、它们在运行时接收的 `ctx`，以及每个的导入路径。完整契约在 `packages/eve/src/public/index.ts`；那里没有导出的任何东西都是框架内部。

身份来自文件系统，而不是你设置的字段。`agent/tools/get_weather.ts` 的工具是 `get_weather`，`agent/connections/linear.ts` 的 connection 是 `linear`，所以没有定义携带 `name` 或 `id`。

大多数文件看起来一样：导入一个 helper，默认导出结果。

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({ model: "anthropic/claude-opus-4.8" });
```

```ts title="agent/tools/get_weather.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Get the weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  async execute({ city }, ctx) {
    return { city, condition: "Sunny" };
  },
});
```

## define\* helpers

| Helper | 从哪导入 | 编写位置 | 指南 |
| --- | --- | --- | --- |
| `defineAgent` | `eve` | `agent/agent.ts` | [agent.ts](../agent-config) |
| `defineTool` | `eve/tools` | `agent/tools/<name>.ts` | [工具（Tools）](../tools) |
| `defineDurableCallback` | `eve/tools` | provider 包的动态工具工厂 | [动态能力（Dynamic capabilities）](../guides/dynamic-capabilities) |
| `defineDurableSchema` | `eve/tools` | provider 包的动态 input/output schema | [动态能力](../guides/dynamic-capabilities) |
| `defineDynamic` | `eve`、`eve/tools`、`eve/skills`、`eve/instructions`、`eve/connections` | 动态 model 或 subagent `agent.ts`；`agent/{tools,skills,instructions,connections}/` | [动态能力（Dynamic capabilities）](../guides/dynamic-capabilities) |
| `defineMcpClientConnection` | `eve/connections` | `agent/connections/<name>.ts` | [MCP 连接（MCP connections）](../connections/mcp) |
| `defineOpenAPIConnection` | `eve/connections` | `agent/connections/<name>.ts` | [OpenAPI 连接（OpenAPI connections）](../connections/openapi) |
| `defineChannel` | `eve/channels` | `agent/channels/<name>.ts` | [自定义渠道（Custom channels）](../channels/custom) |
| `eveChannel`、`slackChannel` 及其他平台 | `eve/channels/<platform>` | `agent/channels/<platform>.ts` | [渠道（Channels）](../channels/overview) |
| `defineSkill` | `eve/skills` | `agent/skills/<name>.ts` | [技能（Skills）](../skills) |
| `defineInstructions` | `eve/instructions` | `agent/instructions.ts` | [Instructions](../instructions) |
| `defineHook` | `eve/hooks` | `agent/hooks/<slug>.ts` | [钩子（Hooks）](../guides/hooks) |
| `defineSchedule` | `eve/schedules` | `agent/schedules/<name>.ts` | [定时任务（Schedules）](../schedules) |
| `defineState` | `eve/context` | tools、hooks、lifecycle | [Session context](../guides/session-context) |
| `defineSandbox` | `eve/sandbox` | `agent/sandbox.ts` | [Sandbox](../sandbox) |
| `defineInstrumentation` | `eve/instrumentation` | `agent/instrumentation.ts` | [instrumentation.ts](../guides/instrumentation/overview) |
| `defineRemoteAgent` | `eve` | `agent/subagents/<id>/agent.ts` | [远程 Agent（Remote agents）](../guides/remote-agents) |
| `defineEval` | `eve/evals` | `evals/*.eval.ts` | [Evals](../evals/overview) |
| `defineEvalConfig` | `eve/evals` | `evals/evals.config.ts` | [Evals](../evals/overview) |
| `mockModel` | `eve/evals` | 确定性 fixture agent models | [Evals](../evals/overview) |
| `useEveAgent` | `eve/react`、`eve/vue`、`eve/svelte` | frontend | [前端（Frontend）](../guides/frontend/overview) |

工具级编写 helpers（`defineTool`、`defineWorkflowTool`、`defineDurableCallback`、`defineDurableSchema`、`defineDynamic`、`disableTool`、`ToolLabelDefinition`）来自 `eve/tools`。几个非 `define\*` helper 补全了集合：`eve/tools` 的 `disableTool`、`webSearch`（见 [默认 Harness（Default harness）](../concepts/default-harness)），`eve/tools/sleep` 的 `sleep`，`eve/channels` 的路由动词 `GET`/`POST`/`PUT`/`PATCH`/`DELETE`/`WS`，`eve/tools/approval` 的审批策略 `auto`/`always`/`once`/`never`，以及 `eve/channels/auth` 的渠道认证 helpers `localDev`/`vercelOidc`/`placeholderAuth`。要包装内置工具，从 `eve/tools/defaults` 导入它的默认值（`bash`、`readFile`、`writeFile`、`glob`、`grep`、`webFetch`、`todo`、`loadSkill`）。`AgentReasoningDefinition` 从 `eve` 导出，用于顶层 `defineAgent({ reasoning })` 设置。`AgentLimitsDefinition` 为 `defineAgent({ limits })` 导出。`AgentWorkflowDefinition`、`AgentWorkflowRetentionDefinition` 和 `AgentWorkflowWorldDefinition` 从 `eve` 为 `defineAgent({ experimental: { workflow } })` 配置形状导出。`WebSearchToolInput` 和 `WebSearchProvider` 从 `eve/tools` 为它们对应的工具配置 helpers 导出。

`eve/connections` 这一份 `defineDynamic` 接受 `session.started` 和 `turn.started` handlers，返回一个 MCP 或 OpenAPI 连接定义、一份定义 map，或 `null`。Resolver 上下文暴露已认证 session 身份和 `channel.kind`，但不暴露对话历史、投递 payload、工具输入、模型输出或自由 channel metadata。带鉴权的返回定义必须设置 `instanceKey`：稳定、非密钥的账号或租户标识，这样 durable 授权恢复不会串到别的实例。

## 运行时上下文（`ctx`）


`ctx` 传给你的工具 `execute`、hook handlers、channel 事件 handlers 和 connection auth/header resolvers。它只在 authored 代码运行时才活着，所以在模块顶层拿它会抛错。完整模型见 [Session context](../guides/session-context)。

| 成员 | 用途 |
| --- | --- |
| `ctx.session` | 当前 session、turn、auth 和可选的 parent lineage（只读） |
| `ctx.getSandbox()` | 活跃 sandbox handle；`stop()` 释放 compute 但保留 durable state |
| `ctx.getSkill(identifier)` | 当前 Agent 可见的命名 skill 的 handle |
| `ctx.getToken(provider)` | 为 `connect("...")` 等内联 auth provider 解析 bearer token |
| `ctx.requireAuth(provider)` | 驱逐并重新授权内联 provider，通常在下游 `401` 之后 |

## 导入一览

| Import | 包含 |
| --- | --- |
| `eve` | `defineAgent`、`defineRemoteAgent`、`defineDynamic`、agent config 类型 |
| `eve/tools` | `defineTool`、`defineWorkflowTool`、`defineDurableCallback`、`defineDurableSchema`、`defineDynamic`、`disableTool`、工具类型 |
| `eve/tools/defaults` | 作为纯值的内置工具 |
| `eve/tools/approval` | `auto`、`always`、`once`、`never` |
| `eve/tools/sleep` | 可选的 durable `sleep` 工具 |
| `eve/connections` | `defineMcpClientConnection`、`defineOpenAPIConnection`、`defineDynamic` |
| `eve/channels` | `defineChannel`、路由动词 |
| `eve/channels/eve` | `eveChannel` |
| `eve/channels/auth` | `localDev`、`vercelOidc`、`placeholderAuth` |
| `eve/channels/{slack,discord,teams,telegram,twilio,github}` | 平台渠道工厂 |
| `eve/hooks` | `defineHook` |
| `eve/schedules` | `defineSchedule` |
| `eve/skills` | `defineSkill`、`defineDynamic` |
| `eve/instructions` | `defineInstructions`、`defineDynamic` |
| `eve/context` | `defineState`、session 和 state 类型 |
| `eve/sandbox` | `defineSandbox`、backends |
| `eve/instrumentation` | `defineInstrumentation`、`isChannel` |
| [`eve/models`](../guides/evaluate) | 用 `auto` 做自动模型选择 |
| [`eve/ai`](../guides/evaluate#evaluate-inside-a-tool) | 独立的 `evaluate` |
| `eve/models/openai` | `openai`、`chatgpt`（`experimental_chatgpt` 为弃用别名） |
| `eve/models/anthropic` | `anthropic` |
| `eve/evals` | `defineEval`、`defineEvalConfig`、`mockModel`、eval 类型 |
| `eve/evals/expect` | `includes`、`equals`、`matches`、`similarity` |
| `eve/evals/reporters` | `Braintrust`、`Datadog`、`JUnit`、`EvalReporter` |
| `eve/evals/loaders` | `loadJson`、`loadYaml` |
| `eve/react`、`eve/vue`、`eve/svelte` | `useEveAgent` |
| `eve/next`、`eve/nuxt`、`eve/sveltekit` | 框架 bundler 插件 |
| [`eve/client`](../guides/client/overview) | `Client`、`ClientSession` |

导出类型从它们描述的 helper 所在的同一 entrypoint 发货（例如 `ToolDefinition` 和 `ToolContext` 来自 `eve/tools`）。详尽清单读 `packages/eve/src/public/index.ts`。

## 直接 provider 模型

`eve/models/openai` 的 `openai(model?)` 与 `eve/models/anthropic` 的 `anthropic(model?)` 返回 eve 自有的模型实例（vendored providers），只接受可选 model ID。默认分别为 `gpt-5.6-luna-fast` 与 `claude-sonnet-5`。

本地用 `/login`，或设置 `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`。部署环境禁用本地 secret-store 发现，须显式配置服务端凭据。示例见[设置模型](../agent-config#设置模型)。

## ChatGPT 订阅模型

`eve/models/openai` 的 `chatgpt()` 通过本地 ChatGPT 登录服务 OpenAI 模型，并记到 ChatGPT 订阅账上。不带参数时选择 `gpt-5.6-luna-fast`：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";
import { chatgpt } from "eve/models/openai";

export default defineAgent({
  model: chatgpt(),
});
```

传另一个裸 OpenAI 模型 slug 覆盖默认。`experimental_chatgpt()` 仍作为已弃用别名保留。

`chatgpt()` 使用无状态请求（`store: false`）。eve 在 session 历史中保留 reasoning summaries 与加密 reasoning，并在工具调用后与后续 turn 重放。你不必显式配置 `reasoning.encrypted_content`。

 eve 走**一条**本地鉴权路径，但有两种凭据所有者：

1. 运行 `eve dev`，打开 `/login`，选择 **ChatGPT subscription**。
2. 若 `PATH` 上有 `codex`，eve 优先用 `codex app-server`；需要登录时启动 `codex login`。此时由 **Codex** 拥有凭据存储与刷新。
3. 找不到 Codex 二进制时，回退到直接浏览器登录，由 **eve** 拥有已保存 session 与刷新。浏览器未打开时用终端打印的 URL。

Codex 可用时，eve 向 app-server 要 token，**不**读写 Codex 登录文件。除「找不到二进制」外的 app-server 错误会直接报告，而不会静默切换凭据所有者。

**eve 自管回退**时，通过 [just-secrets](https://github.com/vercel-labs/just-secrets) 把 refresh token 与账号详情存在操作系统凭据库：macOS Keychain、Windows Credential Manager、Linux Secret Service。access token 只留在进程内存；新进程首次需要 token 时再刷新。该回退登录与 Codex 分离，也从不写入你的项目。若以前用过 `~/.eve/auth/chatgpt.json`，升级后请经 eve 自管回退再登录一次；成功写入后会删掉旧明文 session 文件。OS 凭据库不可用时不会回退到文件存储。

Linux（含 WSL）需要 `/usr/bin/secret-tool`（常见于 `libsecret-tools`）、session D-Bus 与已解锁的 Secret Service；macOS 需解锁 login keychain；Windows 需 PowerShell 与 Credential Manager。

**eve 自管回退**在 SSH 或本机 1455 端口被占用时改用 device code。Device 登录同样需要可用的 OS 凭据库；没有的无头环境请改用 API-key 模型。

ChatGPT 订阅凭证是本地用户凭证。`eve deploy` 会阻止活跃模型为 `chatgpt()` 的 Agent，因为这些凭证不会上传到部署。部署前请改用带可部署模型的环境分支，或切换到 AI Gateway 模型。

排障：

- **`chatgpt-sub login`**：打开 `/login`，再选 **ChatGPT subscription** 重新登录。有 Codex 时 eve 会启动 `codex login`；否则走直接登录。
- **`chatgpt-sub unavailable`（已装 Codex）**：更新或重启 Codex 后重试。eve **不会**用另一份已存 session 掩盖 app-server 失败。
- **`chatgpt-sub unavailable`（无 Codex）**：按提示排查 OS 凭据库，或在 token 刷新失败时检查网络，再从 `/login` 重试。若报告无效 session，重新登录覆盖。
- **后端拒绝模型**：可用性取决于已登录的 ChatGPT 账户。换一个受支持的 OpenAI 模型。
- **无法使用 device 登录**：在 ChatGPT 安全设置启用 device code authorization，或在本机终端且 1455 端口可用时登录。

## 接下来读什么（What to read next）

- [`agent.ts`](../agent-config)：这些 helpers 配置的 agent config
- [工具（Tools）](../tools)：`defineTool`，最常用的 helper
- [Agent Files](./agent-files)：每个 define\* 在磁盘上的位置
