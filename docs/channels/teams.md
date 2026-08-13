---
title: "Microsoft Teams"
description: "通过 Bot Framework Activity 协议从 Microsoft Teams 触达 Agent，带 Adaptive Card 的 human-in-the-loop 提示。"
---

# Microsoft Teams

Teams channel 以 bot 的身份把 Agent 运行在 Microsoft Teams 里。它接收 Bot Framework Activity POST，逐条检查 Bot Connector bearer JWT，并把消息活动路由给你的 Agent。Human-in-the-loop（HITL）提示以 Adaptive Cards 返回，回复通过 Bot Framework Connector REST API 发出。构建于其上的契约见 [Channels](./overview)。

## 添加渠道（Add the channel）

```ts title="agent/channels/teams.ts"
import { teamsChannel } from "eve/channels/teams";

export default teamsChannel();
```

```sh
MICROSOFT_APP_ID=...
MICROSOFT_APP_PASSWORD=...
MICROSOFT_TENANT_ID=... # optional, single-tenant bots
```

默认情况下 channel 挂载在 `POST /eve/v1/teams`。把 Azure Bot 或 Teams 应用的 messaging endpoint 指向这个公开 URL。要挂到别处，传 `route: "/api/teams/activity"`。

## 渠道如何处理消息

### Dispatch

默认的 `onMessage` 处理两种情况：personal-chat 消息，以及直接提及 bot 的频道或群聊消息。Ambient resource-specific-consent 消息会被丢弃，除非你覆盖它。dispatch 之前，eve 会去掉提及、添加 `<teams_context>` block，并按 root activity id（`replyToId ?? id`）界定频道和群线程。

例如，用上下文的 `isSubscribed()` helper 在无需再次提及的情况下继续活跃线程：

```ts
import { defaultTeamsAuth, teamsChannel } from "eve/channels/teams";

export default teamsChannel({
  async onMessage(ctx, message) {
    if (message.from.role === "bot" || message.from.id === message.recipient.id) return null;
    const isDirectMessage = message.scope === "personal";
    return isDirectMessage || message.isBotMentioned || (await ctx.isSubscribed())
      ? { auth: defaultTeamsAuth(message) }
      : null;
  },
});
```

`isSubscribed()` 检查对话之前是否涉及过 Agent。

### 投递（Delivery）

回复以 Markdown 发布（`textFormat: "markdown"`），超长文本拆分成多条消息，turn 开始和动作请求时发送输入状态指示器。

### Human-in-the-loop（HITL）

HITL 的 `input.requested` 事件渲染为 Adaptive Card。审批卡在卡内显示工具输入和回退文本。按钮和选项映射到 `Action.Submit`，下拉映射到 `Input.ChoiceSet`，自由输入映射到 `Input.Text`。Teams 可能以消息或 invoke 形式返回提交；eve 在常规消息提及门禁之前处理两者，并恢复卡中记录的线程。

默认情况下，提交使用点击卡片的用户的 Teams 身份。如果你为 allowlist 定制了 `onMessage`，请在 `onInputResponse` 中配置同样的策略；否则 eve 会拒绝 HITL 提交，而不是绕过消息门禁。

对非 HITL 的 invokes，在 `onInvoke(ctx, activity)` 中处理。

### 主动 session（Proactive sessions）

主动 session 需要现有的 conversation reference，因为 Bot Framework v1 表面无法按 Azure Active Directory（AAD）用户 id 创建新聊天。把 `serviceUrl`、`conversationId` 和其他 reference 字段传给 `receive(teams, { target })`。

### 附件（Attachments）

入站文件默认关闭。选择启用以允许个人 scope 下载和公开媒体 URL：

```ts
export default teamsChannel({
  files: { enabled: true, allowedHosts: ["contoso.sharepoint.com"] },
});
```

## 接下来读什么（What to read next）

- [Channels overview](./overview)：channel 契约和所有内置渠道
- [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)：入站流量认证
