---
title: "Discord"
description: "通过 Discord HTTP Interactions（斜杠命令、组件、模态框）触达 Agent。"
---

# Discord

Discord channel 把 Agent 接入 Discord 的 HTTP Interactions，包括斜杠和应用命令、消息组件和模态框提交。Discord 强制三秒 ACK 截止，所以 channel 会立即确认命令，并在后台运行 eve 工作。凭证和入站请求校验通过 [Vercel Connect](../guides/auth-and-route-protection) 运行，因此 Discord bot token 不会进入你的环境，Connect 在把 interaction 转发给 eve 之前会校验 Discord 的签名。构建于其上的契约见 [Channels](./overview)。

## 设置 Discord（Set up Discord）

从 eve 项目运行引导式设置：

```sh
pnpm eve add channel/discord
```

设置会引导你创建 Discord 应用和 bot，然后：

- 在需要时登录 Vercel 并创建或关联项目；
- 校验 bot token；
- 创建 Vercel Connect client 并把 `/eve/v1/discord` 作为其 trigger destination；
- 注册一个带必填 `message` 选项的应用命令；
- 配置 Discord 应用的 Interactions Endpoint URL；
- 用 Connect 托管的凭证脚手架出 channel；并且
- 打印 bot 安装 URL。

命令默认使用 `/ask` 和描述 **Ask the eve agent**。你可以在设置期间编辑两者。Discord 全局命令注册后最多需要一小时才会出现。

生成的 channel 长这样：

```ts title="agent/channels/discord.ts"
import { connectDiscordCredentials } from "@vercel/connect/eve";
import { discordChannel } from "eve/channels/discord";

export default discordChannel({
  credentials: connectDiscordCredentials("discord/my-agent"),
});
```

路由默认是 `POST /eve/v1/discord`。Connect 惰性解析 application ID 和 bot token，并用同项目 Vercel OIDC 校验转发的 interactions。

### 手动配置 Discord

如果你不使用引导式 Connect 设置，请用 Discord 的 API 或 Developer Portal 注册命令。名为 `message` 的字符串选项与 eve 的默认提示提取对齐：

```sh
curl -X PUT "https://discord.com/api/v10/applications/$DISCORD_APPLICATION_ID/commands" \
  -H "Authorization: Bot $DISCORD_BOT_TOKEN" -H "Content-Type: application/json" \
  -d '[{"name":"ask","description":"Ask the eve agent","type":1,
"options":[{"name":"message","description":"What should the agent do?","type":3,"required":true}]}]'
```

然后把公开的 `https://…/eve/v1/discord` 路由配置为应用的 Interactions Endpoint URL。向 `discordChannel` 传 `credentials: { applicationId, botToken, publicKey }`，或设置对应的 `DISCORD_APPLICATION_ID`、`DISCORD_BOT_TOKEN` 和 `DISCORD_PUBLIC_KEY` 环境变量。

## 渠道如何处理消息

### Dispatch

`onCommand(ctx, interaction)` 决定是否 dispatch 以及在什么 `auth` 下 dispatch。返回 `{ auth }` 继续，或返回 `null` 丢弃 interaction。默认 auth 来自调用用户。事件 handlers 接收 `(eventData, channel, ctx)`，Discord 平台 handle 在 `channel.discord` 上：

```ts
import { discordChannel } from "eve/channels/discord";

export default discordChannel({
  onCommand: (ctx, interaction) => ({
    auth: {
      principalId: interaction.user.id,
      principalType: "user",
      authenticator: "discord",
      attributes: { channel_id: interaction.channelId, guild_id: interaction.guildId ?? "" },
    },
  }),
  events: {
    "message.completed"(eventData, channel, ctx) {
      if (eventData.finishReason === "tool-calls") return;
      if (eventData.message) channel.discord.post(eventData.message);
    },
  },
});
```

### 投递（Delivery）

默认的 `message.completed` handler 用第一条回复编辑 deferred response，之后发送 followups。如果 interaction token 被拒绝，它会回退到 bot 认证的频道消息。长文本会被拆分到 Discord 的 2000 字符限制内，生成的消息默认 `allowed_mentions: { parse: [] }`。

输入状态在 `turn.started` 和 `actions.requested` 时触发，但只在有 bot token 时。自定义 hooks 中自己调用 `channel.discord.startTyping()`。

### Human-in-the-loop（HITL）

HITL 渲染为 Discord 组件。确认和选项变成按钮，`display: "select"` 变成字符串下拉，自由输入变成打开模态框的按钮。用户响应后，parked session（暂停等待输入）恢复。

### 主动 session（Proactive sessions）

通过 schedule `run` handler 里的 `to(discord, target).send(message, { auth })`，或另一渠道的 `ctx.to(discord, target).send(message, { auth })`，无需入站 interaction 即可启动 session。主动目标形状是 `{ channelId, conversationId?, initialMessage? }`。两条路径都需要 bot token，由 Connect 或 `DISCORD_BOT_TOKEN` 提供。

### 附件（Attachments）

该渠道目前不支持入站文件附件。

## 接下来读什么（What to read next）

- [Channels overview](./overview)：channel 契约和所有内置渠道
- [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)：入站流量认证
