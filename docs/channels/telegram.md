---
title: "Telegram"
description: "通过 Telegram bot webhook 触达 Agent，带 inline-keyboard 的 human-in-the-loop 提示和附件。"
---

# Telegram

Telegram channel 把 Agent 放到一个 Telegram bot 后面。它接收 Bot API webhooks，在信任任何东西之前检查 `X-Telegram-Bot-Api-Secret-Token` 头，并把它关心的消息（私聊，加上提到 bot 的群消息）路由到 `sendMessage` 回复。构建于其上的契约见 [Channels](./overview)。

## 添加渠道（Add the channel）

```ts title="agent/channels/telegram.ts"
import { telegramChannel } from "eve/channels/telegram";

export default telegramChannel({
  botUsername: "my_bot",
});
```

```sh
TELEGRAM_BOT_TOKEN=123456:... # replies, typing, callbacks, proactive sends
TELEGRAM_WEBHOOK_SECRET_TOKEN=... # must match the secret_token you register
```

你也可以通过 `credentials: { botToken, webhookSecretToken }` 传同样的值。Channel 挂载 `POST /eve/v1/telegram`。自己注册部署后的 URL；eve 不会调用 `setWebhook`：

```sh
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-app.example.com/eve/v1/telegram",
"secret_token":"'"$TELEGRAM_WEBHOOK_SECRET_TOKEN"'",
"allowed_updates":["message","callback_query"]}'
```

## 渠道如何处理消息

### Dispatch

在私聊中，文本、说明文字、照片和文档都会通过。群聊更严格。只有三样东西能唤醒 bot：命令（`/ask`、`/ask@my_bot`）、`@my_bot` 提及（当设置了 `botUsername` 时），或对 bot 自己某条消息的回复。其他一切都被忽略。

论坛主题在 continuation token 中携带 `message_thread_id`，所以每个主题都留在自己的线程里。

要定制 auth 或过滤，覆盖 `onMessage`。群隐私模式本身在 BotFather 里配置，不在这里。

### 投递（Delivery）

默认的 `message.completed` handler 通过 `sendMessage` 发送纯文本。它不传 `parse_mode`，所以任何 Markdown 都会按字面显示。超过 Telegram 4096 字符限制的回复会拆分成多条消息。自定义 handlers 使用 `channel.telegram`。

### Human-in-the-loop（HITL）

HITL 把选项请求变成 inline-keyboard 按钮，自由输入请求变成 `ForceReply`。Telegram 把 `callback_data` 限制在 64 字节，所以 eve 在 channel state 中保留紧凑的 callback ids。它用 `answerCallbackQuery` 确认自己的回调；任何它不认识的东西都会进 `onCallbackQuery`。

### 主动 session（Proactive sessions）

通过 schedule `run` handler 里的 `to(telegram, target).send(message, { auth })`，或另一渠道的 `ctx.to(telegram, target).send(message, { auth })`，无需入站消息即可启动 session。`target.chatId` 必填。加 `messageThreadId` 落到特定论坛主题。

私有主动聊天按 chat 键控，定向主题时按 chat 加 `messageThreadId` 键控。群和超级群主动发送锚定到 Telegram 返回的 bot message id，所以同一聊天中对不同 bot 消息的回复可以恢复不同的 session。如果出站发送时 Telegram 没有返回可识别的聊天类型，eve 会保持 session 不锚定，而不是猜测。

### 附件（Attachments）

支持入站照片和文档。eve 仅在上传策略允许该类型时通过 `getFile` 按需抓取：

```ts
export default telegramChannel({
  botUsername: "my_bot",
  uploadPolicy: { allowedMediaTypes: ["image/*", "application/pdf"], maxBytes: 10 * 1024 * 1024 },
});
```

## 接下来读什么（What to read next）

- [Channels overview](./overview)：channel 契约和所有内置渠道
- [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)：入站流量认证
