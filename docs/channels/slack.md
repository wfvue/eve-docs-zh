---
title: "Slack"
description: "从 Slack 应用提及、私信、slash commands 和交互回调触达 Agent。"
---

# Slack

Slack channel 把 Agent 放进一个 workspace。它处理 `@提及`、私信（DM）、slash commands、shortcuts 和交互回调；在线程里回复；显示输入状态；并把 human-in-the-loop（HITL）提示变成按钮。[Vercel Connect](https://vercel.com/kb/guide/vercel-connect) 是推荐方案。完整英文官方说明见 [eve.dev Slack channel](https://eve.dev/docs/channels/slack)。构建于其上的契约见 [Channels](./overview)。

## 添加渠道（Add the channel）

```sh
eve add channel/slack
```

该命令推荐 Vercel Connect，然后脚手架出 `agent/channels/slack.ts`。只有当你需要自己管理 Slack bot token 和 signing secret 时才选环境变量选项。

```ts title="agent/channels/slack.ts"
import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";

export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
});
```

部署用 `eve deploy`。Preview / Connect / 故障排查表与 credential 细节见官方英文页。

## Audience

Slack 公开频道为 `public`；DM、群组 DM 与私有频道为 `private`。入站事件未标明对话类型时，eve 会查询 Slack，并把模糊或失败的查找当作 `private`。audience 控制可观测性内容捕获，不是对频道的访问权。共享模型见 [Audience](./overview#audience)。

## 渠道如何处理入站事件

### 消息钩子（Message hooks）

Message hooks 返回 `{ auth }` 以 dispatch、`null` 以丢弃，或 `{ auth, context }` 把背景信息注入 history。公开对话使用返回的 `title`；**DM 与私有频道**的 run 标题固定为 `Private message`。

- `onMessage` / `onAppMention` / `onDirectMessage`：按优先级处理消息；第一个可用 handler 生效。
- `onInteraction` / `onInputResponse`：交互与 HITL。
- `onShortcut` / `onSlashCommand` / `onEvent`：shortcuts、slash commands 与其它 Events API。

入站 allowlist 要 fail closed（尤其是 Slack Connect）。敏感工具另做工具级授权。`threadContext` 与 `isSubscribed()` 用于无需重复提及的线程续聊。

#### 控制重叠 turn

已接受的 Slack 消息默认 steer：eve 缓冲新消息，并在下一个已提交的 workflow 边界应用到**同一 turn**。被忽略的提及和被 hooks 拒绝的消息不会进入 turn。当每个活跃 turn 都应该先结束时设置 `turnPolicy: "queue"`：

```ts title="agent/channels/slack.ts"
export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
  turnPolicy: "queue",
});
```

Message hooks 在 `ctx` 上暴露 `send` / `respond` / `cancel` / `compact` / `clear` / `reset` / `resolveSession`。重置对话用 `ctx.reset({ reason? })`。

### 投递与 HITL

默认在线程内回复并显示进度；长回复可上传为 Markdown snippet（需 `files:write`）。HITL 渲染为按钮与下拉；`approvalChannel` 可在 `"thread"` 与 `"direct-message"` 间选择。授权挑战默认把凭证以 ephemeral / DM 投递，公开帖只留状态。

### 主动 session（Proactive sessions）

通过另一渠道的 `ctx.to(slack, target).send(message, { auth })`，或 schedule `run` handler 里的 `to(slack, target).send(message, { auth })`，无需入站消息即可启动 session。主动目标形状是（默认 audience 为 `unknown`；仅当调用方已知目标可见性时再传 `audience`）。旧写法仍可用。主动目标形状是 `{ channelId, threadTs?, initialMessage? }`。

### 附件（Attachments）

已认证 Slack URL 上的入站文件用 `fetchFile` 分阶段处理（需 `files:read`）。见 [File uploads](./custom#file-uploads)。

## 接下来读什么（What to read next）

- [Channels overview](./overview)：channel 契约和所有内置渠道
- [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)：入站流量认证
- 官方全文：[eve.dev/docs/channels/slack](https://eve.dev/docs/channels/slack)（本页为学习向中文摘要；完整步骤、Connect preview、slash/HITL 示例以官方为准）
