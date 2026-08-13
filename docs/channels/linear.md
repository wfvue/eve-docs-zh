---
title: "Linear"
description: "通过 Linear Agent Sessions 触达 Agent，带原生 Agent Activities（进度、提问、回复）与 Vercel Connect 凭证。"
---

# Linear

Linear channel 使用 Linear 的 Agent Session 表面，而不是普通评论。用户从 Linear 把工作委派给 Agent，eve 在 `/eve/v1/linear` 接收 `AgentSessionEvent` webhooks，channel 用原生 Agent Activities 回复，包括 `thought`、`action`、`elicitation`、`response` 和 `error`。凭证可以走 [Vercel Connect](../guides/auth-and-route-protection)，由它管理 Linear app、它的 access token 和入站 webhook 校验，所以你不需要持有 API key 或 webhook secret。构建于其上的契约见 [Channels](./overview)。

## 引导式 Connect 设置（Guided Connect setup）

从 Agent 目录运行 registry 设置：

```sh
eve add linear
```

在组件清单中选择 **Linear Channel**。如果你想让 Agent 通过 MCP 搜索和更新 Linear，**Linear MCP** 也默认选中。只安装 channel 本身，运行 `eve add channel/linear-agent`。

流程会在需要时登录 Vercel、创建或关联 Vercel 项目、在可用时复用兼容的现有 connector 或配置 app-scoped Linear Connect client，并把 `/eve/v1/linear` 注册为 trigger destination。然后安装 `@vercel/connect` 并写入带 connector UID 的 `agent/channels/linear.ts`。

Vercel Connect 以 Agent Sessions 所需的 `app:assignable` 和 `app:mentionable` scopes 创建 Linear app，接收并校验 `AgentSessionEvent` webhooks，并把它们转发给已部署的 Agent。部署后，在 Connect dashboard 打开 Linear app，并在你想委派工作的 workspace 中安装。然后委派一个 issue，或在 Linear Agent Session 中提及 Agent。

生成的 channel 使用 Connect 托管的凭证：

```ts title="agent/channels/linear.ts"
import { connectLinearCredentials } from "@vercel/connect/eve";
import { linearChannel } from "eve/channels/linear";

export default linearChannel({
  credentials: connectLinearCredentials("linear/my-agent"),
});
```

`connectLinearCredentials` 返回 `{ accessToken, webhookVerifier }`：eve 使用 Connect 托管的 app token 做 Linear GraphQL 调用，并按 Vercel OIDC 签名而不是 Linear webhook secret 校验 Connect 转发的 webhooks。Token 轮换、刷新和多 workspace 租户留在 Connect 内部，所以没有 `LINEAR_AGENT_ACCESS_TOKEN` 或 `LINEAR_WEBHOOK_SECRET` 要管理。

### 自带 Linear app

要运行你自己管理的 Linear OAuth app，直接传它的凭证：

```ts title="agent/channels/linear.ts"
import { linearChannel } from "eve/channels/linear";

export default linearChannel({
  credentials: {
    accessToken: process.env.LINEAR_AGENT_ACCESS_TOKEN,
    webhookSecret: process.env.LINEAR_WEBHOOK_SECRET,
  },
});
```

直接 webhook 校验默认接受 60 秒内的时间戳，正如 Linear 建议的那样。只有当你刻意接受延迟重试时，才把 `maxSkewMs` 设成更大的毫秒数。使用适合你重试策略的最窄窗口。

```sh
LINEAR_AGENT_ACCESS_TOKEN=lin_api_... # posts Agent Activities and creates proactive sessions
LINEAR_WEBHOOK_SECRET=... # verifies Linear-Signature
```

示例显式传了凭证。要依赖环境变量，去掉 `credentials` block：access token 回退到 `LINEAR_AGENT_ACCESS_TOKEN`、`LINEAR_ACCESS_TOKEN`、`LINEAR_API_KEY` 或 `LINEAR_API_TOKEN`，webhook secret 回退到 `LINEAR_WEBHOOK_SECRET`。两个字段也都接受惰性 resolver 函数。

创建 Linear OAuth app，启用 Agent Session 事件，并把 webhook URL 指向：

```sh
https://<deployment>/eve/v1/linear
```

对 Linear 的 Agent 表面，用 `actor=app` 配置 OAuth authorize URL，并授予让 app 以 Linear 中的 Agent 身份出现的 scopes，包括 `app:assignable` 和 `app:mentionable`。订阅 `AgentSessionEvent` webhook 类别，让 Linear 在 Agent 被委派或提及时发送 `created` 事件，在用户继续 session 时发送 `prompted` 事件。

Linear 在 `Linear-Signature` 中发送 webhook 签名；eve 对原始 body 校验 HMAC，并拒绝过期的 `webhookTimestamp` 值。如果可信网关在请求到达 eve 之前校验了 Linear，传 `credentials.webhookVerifier` 而不是 webhook secret。你的自定义 verifier 必须强制自己的时间戳策略，因为 `maxSkewMs` 不适用。

## 渠道如何处理消息

### Dispatch

默认 hook 会 dispatch `created` 和 `prompted` Agent Session 事件。eve 添加一个带 agent session、issue、comment 和组织标识符的 Linear context block，然后用 `agent-session:<id>` 继续同一个 session。

### 投递（Delivery）

Turn 开始会发布临时 `thought`，工具调用发布临时 `action` activities，最终 assistant 文本发布 durable `response`，失败发布 `error` activities。当模型在工具调用之前发出文本时，eve 会缓冲第一个非空行，并把它用作下一条临时 Linear `thought`，镜像 Slack 的输入状态行为。

### Human-in-the-loop（HITL）

HITL 输入请求渲染为 Linear `elicitation` activities。用户回复 Agent Session 时，channel 把该提示解析回挂起的 eve 输入请求，并用 `inputResponses` 恢复。

### 连接授权（Connection authorization）

当 user-scoped connection 需要授权时，默认 channel 会以 provider 的登录 URL 发布 Linear 原生的 `auth` elicitation，定向到启动 session 的 Linear 用户。无 URL 的 device flows 把它们的说明和用户代码渲染为纯 elicitation。授权完成后，channel 发布一条带结果的思想；成功授权表示 parked turn 正在恢复。

### 主动 session（Proactive sessions）

通过 `receive(linear, { target })` 无需入站 webhook 即可启动 session。target 形状和示例见下文 [主动 session](#proactive-sessions)。

### 附件（Attachments）

Agent Session 提示中托管在 `https://uploads.linear.app` 的 Markdown 图片会用解析后的 Linear access token 抓取，并作为图片文件部分包含。eve 只把 bearer token 发给那个确切的 HTTPS origin；来自其他 host 的图片保持为 Markdown 文本。如果 Linear 上传失败或返回非图片内容，eve 保留它的 Markdown 引用并继续文本 turn。该渠道目前不支持其他入站文件附件。

### API handle

事件 handlers 接收 `channel.linear`，它暴露 `createActivity`、`listActivities` 和 `updateSession`，用于自定义 Agent Activity 投递和 Agent Session 元数据。

## 自定义 hooks

返回 `{ auth }` 以 dispatch，或返回 `null` 确认而不唤醒 Agent。

```ts
import { defaultLinearAuth, linearChannel } from "eve/channels/linear";

export default linearChannel({
  onAgentSession: (_ctx, event) => {
    if (event.action !== "created" && event.action !== "prompted") return null;
    return { auth: defaultLinearAuth(event) };
  },
});
```

通过检查 `onAgentSession` 中的 `event.agentSession.issue`，把 dispatch 限制到一部分 Linear 团队或项目。在 `auth` 旁边返回 `context` 添加额外上下文。

```ts
import { defaultLinearAuth, linearChannel } from "eve/channels/linear";

export default linearChannel({
  onAgentSession: (_ctx, event) => {
    if (event.agentSession.issue?.identifier?.startsWith("OPS-") !== true) return null;
    return {
      auth: defaultLinearAuth(event),
      context: ["Only make reversible changes unless the issue says otherwise."],
    };
  },
});
```

想要更具体的 Agent Activities 时覆盖事件投递。

```ts
import { linearChannel } from "eve/channels/linear";

export default linearChannel({
  events: {
    async "message.completed"(eventData, channel) {
      if (eventData.finishReason === "tool-calls" || !eventData.message) return;
      await channel.linear.createActivity({
        body: `Done.\n\n${eventData.message}`,
        type: "response",
      });
    },
    async "input.requested"(eventData, channel) {
      await channel.linear.createActivity({
        body: eventData.requests.map((request) => request.prompt).join("\n\n"),
        type: "elicitation",
      });
    },
  },
});
```

当你的 Agent 创建外部产物时，添加 session 级链接。

```ts
await channel.linear.updateSession({
  addedExternalUrls: [{ label: "Run log", url: "https://example.com/runs/123" }],
});
```

## 主动 session

用 channel 的主动 target 继续现有 Agent Session，或从 Linear issue 或根评论创建新 session。Target 接受现有 `agentSessionId`，或用于先创建新 session 再发送消息的 `issueId` 或根 `commentId`。下面的示例从 schedule 运行；路由 handler 通过 `ctx.to(...)` 使用同样的 target 形状。

```ts
import { defineSchedule } from "eve/schedules";
import linear from "../channels/linear";

export default defineSchedule({
  cron: "0 14 * * 1",
  async run({ to, waitUntil, appAuth }) {
    waitUntil(
      to(linear, {
        issueId: "EVE-123",
        initialActivity: "Preparing the status update.",
      }).send("Post a concise status update with blockers and next actions.", {
        auth: appAuth,
      }),
    );
  },
});
```

对 issue 或 comment target，channel 在启动 eve turn 之前调用 Linear 的 proactive Agent Session mutations。对现有 `agentSessionId`，它跳过 session 创建，只播种 continuation token。

## 接下来读什么（What to read next）

- [Channels overview](./overview)：channel 契约和所有内置渠道
- [MCP 连接（MCP connections）](../connections/mcp)：当 Agent 需要从另一渠道检查或编辑 Linear 数据时，使用 Linear MCP connection
