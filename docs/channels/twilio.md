---
title: "Twilio"
description: "通过 Twilio 用 SMS 和语音转写的电话触达 Agent。"
---

# Twilio

Twilio channel 把 Agent 放到一个电话号码上，让人们可以给它发短信或打电话。入站 SMS 以 webhook 到达。入站电话用 TwiML `<Gather input="speech">` 应答，产生的转写文本喂给 SMS 使用的同一个 eve session，所以打电话和发短信在下游看起来一样。每个请求在运行其他任何东西之前都会对照 `X-Twilio-Signature` 校验。原始 continuation token 是 `From:To`。构建于其上的契约见 [Channels](./overview)。

## 添加渠道（Add the channel）

```ts title="agent/channels/twilio.ts"
import { twilioChannel } from "eve/channels/twilio";

export default twilioChannel({
  allowFrom: "+15551234567",
  messaging: { from: "+15557654321" },
});
```

```sh
TWILIO_ACCOUNT_SID=AC... # required for default outbound SMS
TWILIO_AUTH_TOKEN=... # required for inbound signature verification
```

要跳过环境变量，通过 `credentials: { accountSid, authToken }` 传同样的值。Channel 挂载三条路由：

- `POST /eve/v1/twilio/messages`：Messaging webhook
- `POST /eve/v1/twilio/voice`：入站电话 webhook
- `POST /eve/v1/twilio/voice/transcription`：语音转写回调

把 Twilio 号码的 Messaging webhook 指向 `/messages`，Voice webhook 指向 `/voice`，使用 Twilio 会调用的确切公开 URL。

## 渠道如何处理消息

### Dispatch

`allowFrom` 必填。它决定谁能触达入站 hooks。传单个号码、列表、异步 resolver 或 `"*"`。通配符很危险；只有在 `onText`/`onVoice` 里有显式检查时才使用它。

```ts
export default twilioChannel({ allowFrom: ["+15551234567", "+15557654321"] });
```

`onText` 和 `onVoiceTranscription` 决定 dispatch 和 `auth`。返回 `{ auth }` 继续，或返回 `null` 丢弃消息。`onVoice` 在电话一进来时立即触发。返回 `null` 拒绝它，或返回一个对象来覆盖语音提示、语言、`<Say voice>` 和语音识别选项。

```ts
export default twilioChannel({
  allowFrom: ["+15551234567"],
  onText: (ctx, message) => ({
    auth: {
      principalId: message.from,
      principalType: "user",
      authenticator: "twilio",
      attributes: { to: message.to ?? "" },
    },
  }),
});
```

### 投递（Delivery）

默认的 `message.completed` handler 通过 Twilio 的 Messages API 以 SMS 发送回复。对入站消息的回复可以复用 webhook 的 `To` 作为发送方，但主动发送没有可复用的东西，所以它需要 `messaging.from` 或 `messaging.messagingServiceSid`。在代理后面时，设置 `webhookUrl` 让签名校验匹配确切配置的 URL，设置 `publicBaseUrl` 让 voice TwiML 能构建绝对回调 URL。

### Human-in-the-loop（HITL）

SMS 和语音没有原生按钮或卡片能力，所以 HITL 提示不会渲染成交互控件。Agent 的 `input.requested` 事件会在你声明 `events["input.requested"]` handler 时到达它。自行处理：把提示作为文本发送，并把来电者的回复映射回输入请求。

### 主动 session（Proactive sessions）

通过 schedule `run` handler 里的 `to(twilio, target).send(message, { auth })`，或另一渠道的 `ctx.to(twilio, target).send(message, { auth })`，无需入站消息即可启动 session。`target.phoneNumber` 必填，channel 需要 `messaging.from` 或 `messaging.messagingServiceSid` 作为出站发送方。

### 附件（Attachments）

该渠道目前不支持入站媒体附件。

## 免责声明（Disclaimer）

作为部署者，你有责任确保 Agent 符合适用法律。

例如，法律可能要求你告知来电者和发短信的人，通话会被记录/转写并由自动化 AI 系统处理，并在要求时获得同意（包括两方同意司法辖区）。对你发起的出站 SMS 或电话，你可能需要事先获得明确同意、遵守 STOP/opt-out 和安静时段规则，并完成要求的运营商注册。

## 接下来读什么（What to read next）

- [Channels overview](./overview)：channel 契约和所有内置渠道
- [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)：入站流量认证
