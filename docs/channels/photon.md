---
title: "Photon"
description: "通过 Photon 把 eve Agent 接到 iMessage。"
---

# Photon

用 `photonIMessageChannel` 通过 Photon 项目接收并回复 iMessage。

运行 `eve add channel/photon-imessage` 可以创建或使用 Photon 项目并注册手机号，然后选择配置 Vercel Connect 还是 portable credentials。使用 Vercel Connect 时，eve 会登录并在需要时创建或关联 Vercel 项目，再通过 Connect 创建 connector 并配置 Photon webhook。渠道在 adapter 首次初始化时惰性解析凭据：

```ts title="agent/channels/photon.ts"
import { connectPhotonCredentials } from "@vercel/connect/eve";
import { photonIMessageChannel } from "eve/channels/photon";

export default photonIMessageChannel({
  credentials: connectPhotonCredentials("photon/my-agent"),
});
```

默认 webhook 路由是 `/eve/v1/photon`。渠道默认用同项目 Vercel OIDC 校验转发过来的 webhook，从每条消息作者派生用户身份，把已接受消息标为已读，并让同一 iMessage 对话继续同一个 eve session。新的已接受消息会协作式取消正在进行的 turn，并 steer 替代 turn。

当每条回复都必须结束后才处理下一条 Photon 消息时，设置 `turnPolicy: "queue"`。

用 `onMessage` 自定义入站分发。返回 `null` 忽略该消息；也可以在 `auth` 旁边返回 `title`，在 dispatch 启动 run 时设置标题：

```ts
export default photonIMessageChannel({
  credentials: connectPhotonCredentials("photon/my-agent"),
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

没有 Vercel Connect 的主机，在 `eve add channel/photon-imessage` 时选择 **Use portable credentials**。eve 会脚手架渠道文件，并把 `IMESSAGE_PROJECT_ID` 和 `IMESSAGE_PROJECT_SECRET` 写进 `.env.local`。

部署 Agent 之后：

1. 为公开的 `https://…/eve/v1/photon` URL 创建 Photon webhook。
2. 把签名密钥复制到 `IMESSAGE_WEBHOOK_SECRET`。
3. 在主机的加密环境变量里设置 `IMESSAGE_PROJECT_ID`、`IMESSAGE_PROJECT_SECRET` 和 `IMESSAGE_WEBHOOK_SECRET`。

手工配置时使用惰性、环境变量驱动的凭据：

```ts title="agent/channels/photon.ts"
import { photonIMessageChannel } from "eve/channels/photon";

export default photonIMessageChannel({
  async credentials() {
    const projectId = process.env.IMESSAGE_PROJECT_ID;
    const projectSecret = process.env.IMESSAGE_PROJECT_SECRET;
    if (!projectId || !projectSecret) throw new Error("Photon project credentials are required.");
    return { projectId, projectSecret };
  },
  webhookSecret: process.env.IMESSAGE_WEBHOOK_SECRET,
});
```

直接对接 Photon webhook 时传入 `webhookSecret` 或设置 `IMESSAGE_WEBHOOK_SECRET`；签名密钥优先于默认 OIDC 校验器。

## 接下来读什么

- [渠道概览（Channels overview）](./overview)
- [Linq](./linq)：同一类 iMessage / SMS 场景的另一条官方渠道

官方原文：[Photon](https://eve.dev/docs/channels/photon)。
