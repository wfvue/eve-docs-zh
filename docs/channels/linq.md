---
title: "Linq"
description: "通过 Linq 把 eve Agent 接到 iMessage 和 SMS。"
---

# Linq

用 `linqChannel` 通过 Linq 接收并回复 iMessage 和 SMS 对话。

运行 `eve add channel/linq` 可以选择 Vercel Connect 或 portable credentials。使用 Vercel Connect 时，eve 会登录并在需要时创建或关联 Vercel 项目。然后选择是创建托管的 Linq 账号和线路，还是用 partner API token 连接已有账号。eve 会拉取该账号下的电话号码，你再给 Agent 选号。eve 通过 Connect 配置 connector 和 webhook：

```ts title="agent/channels/linq.ts"
import { connectLinqCredentials } from "@vercel/connect/eve";
import { linqChannel } from "eve/channels/linq";

export default linqChannel({
  credentials: connectLinqCredentials("linq/my-agent"),
});
```

默认 webhook 路由是 `/eve/v1/linq`。渠道默认用同项目 Vercel OIDC 校验转发过来的 webhook，从每条消息作者派生用户身份，把已接受消息标为已读，并让同一 Linq 对话继续同一个 eve session。新的已接受消息会协作式取消正在进行的 turn，并 steer 替代 turn。

当每条回复都必须结束后才处理下一条 Linq 消息时，设置 `turnPolicy: "queue"`。

用 `onMessage` 自定义入站分发。返回 `null` 忽略该消息；也可以在 `auth` 旁边返回 `title`，在 dispatch 启动 run 时设置标题：

```ts
export default linqChannel({
  credentials: connectLinqCredentials("linq/my-agent"),
  onMessage(_ctx, message) {
    if (message.author.isBot) return null;
    return {
      auth: null,
      context: [`The sender is ${message.author.fullName}.`],
    };
  },
});
```

用 `route` 覆盖 webhook 路径，或用 `webhookVerifier` 换成其它受信任转发器的校验器。

## 其它主机（Other hosts）

没有 Vercel Connect 的主机，在 `eve add channel/linq` 时选择 **Use portable credentials**。eve 会把 `LINQ_API_KEY` 和 `LINQ_WEBHOOK_SECRET` 写进 `.env.local`。

部署 Agent 之后：

1. 为公开的 `https://…/eve/v1/linq` URL 创建 Linq webhook，订阅 `message.received`、`reaction.added` 和 `reaction.removed`。
2. 在主机的加密环境变量里设置 `LINQ_API_KEY` 和 `LINQ_WEBHOOK_SECRET`。

手工配置时传入 API key 和 webhook 签名密钥：

```ts title="agent/channels/linq.ts"
import { linqChannel } from "eve/channels/linq";

export default linqChannel({
  credentials: {
    apiKey: process.env.LINQ_API_KEY!,
    signingSecret: process.env.LINQ_WEBHOOK_SECRET!,
  },
});
```

直接对接 Linq webhook 时传入 `signingSecret`。如果同时提供了 `webhookVerifier`，后者优先。

## 接下来读什么

- [渠道概览（Channels overview）](./overview)
- [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)

官方原文：[Linq](https://eve.dev/docs/channels/linq)。
