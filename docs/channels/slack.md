---
title: "Slack"
description: "用 Vercel Connect 托管的凭证、线程回复和交互按钮，从 Slack 应用提及和私信触达 Agent。"
---

# Slack

Slack channel 把 Agent 放进一个 workspace。它回应 `@提及` 和私信（DM）、在线程里回复、显示输入状态，并把 human-in-the-loop（HITL）提示变成按钮。[Vercel Connect](https://vercel.com/kb/guide/vercel-connect) 是推荐方案：它托管 Slack bot token、校验入站请求、支持 token 轮换和多个 workspace 安装，并在不把 Slack 密钥复制进项目环境的情况下把事件转发给你的 Agent。如果不能用 Vercel Connect，你也可以通过环境变量提供 bot token 和 signing secret。构建于其上的契约见 [Channels](./overview)。

## 添加渠道（Add the channel）

从 Agent 项目运行引导式设置：

```sh
eve add channel/slack
```

该命令推荐 Vercel Connect，然后脚手架出 `agent/channels/slack.ts` 并安装任何需要的依赖。只有当你需要自己管理 Slack bot token 和 signing secret 时才选环境变量选项。

### 推荐：使用 Vercel Connect

Vercel Connect 设置需要 Vercel CLI。引导流程会在需要时登录、创建或关联一个 Vercel 项目、创建或复用 Slack connector、等待你在 workspace 中安装它，并在写入 channel 文件之前把 `/eve/v1/slack` 注册为 trigger destination。

生成的 channel 在运行时解析凭证：

```ts title="agent/channels/slack.ts"
import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";

export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
});
```

`connectSlackCredentials` 返回 `{ botToken, webhookVerifier }`，把 token 轮换、多 workspace 租户和请求校验留在 Connect 内部，而不是你的代码里。

### 自己管理 Slack 凭证

当 Agent 不运行在 Vercel 上或 Vercel Connect 不可用时，使用这个回退方案。在设置命令中，**Use portable credentials** 就是环境变量选项；eve 会把 `SLACK_BOT_TOKEN` 和 `SLACK_SIGNING_SECRET` 加到 `.env.example`。

这个选项不会创建或安装 Slack 应用。请在 [Slack app settings](https://api.slack.com/apps) 中配置：

1. 添加 `app_mentions:read` 和 `chat:write` bot scopes。DM 需要 `im:history`，入站附件需要 `files:read`，Agent 上传文件时需要 `files:write`。
2. 安装或重装应用，把它的 Bot User OAuth Token 复制到 `SLACK_BOT_TOKEN`，把 **Basic Information** 里的 signing secret 复制到 `SLACK_SIGNING_SECRET`。
3. 在 `.env.local`（本地开发）或目标运行环境里设置这两个值，然后在一个公开 URL 上启动或部署 Agent。
4. 在 **Event Subscriptions** 下，把 Request URL 设为 `https://your-agent.example/eve/v1/slack`。订阅 `app_mention`，DM 还要订阅 `message.im`。
5. 当 Agent 使用按钮或 HITL 提示时，在 **Interactivity & Shortcuts** 下使用同一个 Request URL。

如果你还想处理没有被提及的线程回复，按 [无需重复提及即可继续对话](#continue-conversations-without-repeated-mentions) 所述添加对应的 message 事件和 history scopes。

## 部署（Deploy）

trigger destination 和 channel 文件就绪后部署生产 Agent：

```sh
eve deploy
```

`eve deploy` 把关联的 Vercel 项目部署到生产环境。引导流程会把 trigger destination 注册到生产分支——这是 Vercel CLI 的默认值。当你需要不同分支或环境时，在 Connect dashboard 中单独管理 trigger destination。

## 用 Vercel Connect 测试 preview 分支

当你想要 preview Slack 流量与生产隔离时，使用单独的 connector，然后把 preview 分支注册为 trigger destination：

```sh
npm install -g vercel@latest
vercel connect create slack --name your-agent-preview --triggers
vercel connect attach slack/your-agent-preview \
  --environment preview \
  --triggers \
  --trigger-branch your-preview-branch \
  --trigger-path /eve/v1/slack \
  --yes
```

在关联的项目目录中运行这些命令。`--environment preview` 让 connector 凭证对 Preview 部署可用。`--trigger-branch` 选择接收转发 Slack webhook 的分支。

在运行时选择匹配的 connector，而不是把生成的 production UID 硬编码：

```ts title="agent/channels/slack.ts"
import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";

const connectorUid =
  process.env.VERCEL_ENV === "preview" ? "slack/your-agent-preview" : "slack/my-agent";

export default slackChannel({
  credentials: connectSlackCredentials(connectorUid),
});
```

带 triggers 创建 connector 也会注册一个默认的 production destination。在把 preview connector 视为隔离之前，从 Connect dashboard 移除该 destination。引导式的 production 设置不限制凭证环境，所以也要在 dashboard 里把 production connector 的项目访问设为 **Production**、preview connector 设为 **Preview**。`vercel connect detach` 移除的是项目 token 访问，不是 trigger destinations。Vercel Connect 每个 connector 最多支持三个 trigger destination；当前限制和环境指引见 [Vercel Connect guide](https://vercel.com/kb/guide/vercel-connect)。

Slack 必须能在没有交互式认证挑战的情况下触达 preview 路由。对 Connect trigger，在可用时用 [Deployment Protection Exception](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions) 豁免分支域名，或用未受保护的 preview 域名。对使用环境变量凭证的 Slack 应用，把 `?x-vercel-protection-bypass=your-generated-secret` 追加到它的事件和交互请求 URL。启用 [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) 并不会绕过请求，除非发送方出示该 secret。

## 手动设置 Vercel Connect

要在引导流程之外设置 connector，先创建它，再把 eve 的 Slack 路由注册到关联项目：

```sh
npm install -g vercel@latest
vercel connect create slack --name your-agent --triggers
vercel connect attach slack/your-agent \
  --environment production \
  --triggers \
  --trigger-path /eve/v1/slack \
  --yes
```

`--triggers` 启用 Slack Event Subscriptions。attach 命令除了 connector 创建时带的默认 destination 之外还会注册 eve 的路由。在 [Connect dashboard](https://vercel.com/d?to=/[team]/~/connect) 中单独移除默认 destination。对已有 connector，跳过 `create` 直接 attach 目标路由。

## Slack 投递故障排查

按顺序检查投递链路，以便定位 Slack 事件停在哪里：

| 症状 | 检查 | 下一步 |
| --- | --- | --- |
| `eve add channel/slack` 在脚手架之前停止 | 阅读设置错误：失败的 Vercel 登录、项目关联、workspace 安装、connector 查找或 trigger 注册步骤 | 解决该步骤后重跑 `eve add channel/slack` |
| 设置提示无法移除已有 trigger destination | 在 Connect dashboard 检查 connector 的 destinations。`vercel connect detach` 移除项目 token 访问，不移除 trigger destinations | 在 dashboard 编辑或移除过期的 destination，然后用 `vercel connect attach` 注册 `/eve/v1/slack` |
| 提及从未到达部署 | 确认 connector trigger destination 使用预期的项目和分支、启用了 triggers、并指向 `/eve/v1/slack` | 在 Connect dashboard 编辑或移除过期 destinations，然后用 `vercel connect attach` 注册预期的 destination |
| 提及正常但 DM 或线程回复不行 | 检查 Slack 应用的 Event Subscriptions 和 OAuth scopes。DM 需要 `message.im` 和 `im:history`；频道回复需要匹配的 message 事件和 history scope | 添加缺失的事件或 scopes，如果 Slack 要求则重装 Slack 应用 |
| preview 请求收到认证页或保护错误 | 检查分支域名是否已豁免，或直接 Slack 请求 URL 是否带 `x-vercel-protection-bypass`。Slack 无法完成交互式 Vercel Authentication 挑战 | 为分支域名添加 Deployment Protection Exception，或给使用环境变量凭证的 Slack 应用加上 automation bypass 查询参数 |
| webhook 到达部署但 Agent 不回复 | 打开项目的 Vercel runtime 日志，然后在 **Agent Runs** 中检查 session（当你的团队有权限时） | 用第一个缺失或失败的阶段把问题收窄到 channel dispatch、Agent run 或 Slack 出站投递 |

## 渠道如何处理入站事件

### 消息钩子（Message hooks）

Message hooks 返回 `{ auth }` 以 dispatch、`null` 以丢弃，或 `{ auth, context }` 把背景信息注入 history。

- `onMessage(ctx, message)` 处理 Slack `message` 事件。eve 会在该 hook 运行前丢弃由已安装应用自己编写的消息，防止自回复循环。来自其他 bot 的消息仍然可见；当这些也应该被忽略时，检查 `message.author?.isBot`。`ctx.isBotMentioned()` 和 `ctx.isSubscribed()` 支持提及与活跃线程策略。
- `onAppMention(ctx, message)` 只处理 `app_mention`，优先级高于 `onMessage`。它的默认实现会派生 workspace-scoped auth 并发布 `Thinking…`。
- `onDirectMessage(ctx, message)` 只处理 DM，优先级高于 `onMessage`。Bot 编写的消息和编辑会先被过滤；Slack 要求 `message.im` 和 `im:history`。

| 入站事件 | Handler 顺序 |
| --- | --- |
| App mention | `onAppMention` → `onMessage` → `onEvent` → 内置 mention 默认 |
| Direct message | `onDirectMessage` → `onMessage` → `onEvent` → 内置 DM 默认 |
| 其他 Slack message | `onMessage` → `onEvent` → 忽略 |
| 其他 Events API 事件 | `onEvent` → 忽略 |

只有第一个可用的 handler 会运行。返回 `null` 的 message hook 会丢弃消息；它不会继续往下走表。

`onInteraction(action, ctx)` 单独处理未被 HITL 消费的 `block_actions` 回调。eve 会把触发用户的 Slack user id 附加到同一模型消息的文本上，无需 profile 查询即可保留说话人归属。

#### 限制谁能调用 Agent

有效的 Slack 签名只能证明事件来自 Slack，不能决定你的 Agent 该信任哪个频道或哪个人。在返回 auth 之前，入站 handler 里要 fail closed，尤其是当应用安装在共享的 Slack Connect 频道时：

```ts title="agent/channels/slack.ts"
import { connectSlackCredentials } from "@vercel/connect/eve";
import { defaultSlackAuth, slackChannel, type SlackMessage } from "eve/channels/slack";

const allowedChannels = new Set(["C01234567"]);
const allowedUsers = new Set(["U01234567"]);

function isAllowedUser(message: SlackMessage) {
  const userId = message.author?.userId;
  return Boolean(userId && allowedUsers.has(userId));
}

export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
  onAppMention(ctx, message) {
    if (!isAllowedUser(message) || !allowedChannels.has(message.channelId)) {
      return null;
    }
    return { auth: defaultSlackAuth(message, ctx) };
  },
  onDirectMessage(ctx, message) {
    if (!isAllowedUser(message)) return null;
    return { auth: defaultSlackAuth(message, ctx) };
  },
});
```

覆盖每一个启用的入站 handler；漏掉 `onDirectMessage` 会保留 eve 默认的 DM 行为。Slack Connect 可以投递外部用户的事件，所以请为你的策略所期望的显式用户和当前频道 ID 授权。如果访问取决于组织成员身份，请从 Slack 的共享频道和用户数据中解析，而不是从请求签名推断。

敏感工具内部也要保留授权检查。入站 allowlist 控制谁能启动 turn；工具级检查控制该已认证 Slack 主体可以读取或修改什么。

上面的 allowlist 只拦截由消息启动的 turn。内置 HITL 按钮在 `onInteraction` 之前处理，点击者会为恢复的 session 提供 Slack auth。任何能与 Slack 消息交互的人都可以回答它。把敏感提示放在只限预期审批人的频道里，并在敏感工具执行副作用之前重新检查 `ctx.session.auth.current`。

#### 无需重复提及即可继续对话

用 `onMessage` 处理显式提及，并在线程中继续带有活跃 eve session 的回复：

```ts title="agent/channels/slack.ts"
export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
  async onMessage(ctx, message) {
    if (message.author?.isBot) return null;
    const isDirectMessage = message.raw.channel_type === "im";
    return isDirectMessage || ctx.isBotMentioned() || (await ctx.isSubscribed())
      ? { auth: null }
      : null;
  },
});
```

`isBotMentioned()` 识别显式提及。`isSubscribed()` 检查消息是否属于带有活跃 eve session 的线程。对 Vercel Connect，创建 connector 时打开 **Advanced**，在 **Trigger Event Types** 下添加 `message.channels`，在 **Bot Scopes** 下添加 `channels:history`。私有频道还需要 `message.groups` 和 `groups:history`。

当路由取决于谁加入了线程时，使用 `ctx.thread.listParticipants()`。它获取当前线程并返回按首次出现顺序排列的唯一人类 Slack user id，所以第一个 id 是人工启动线程的起始作者。Bot 和系统消息会被排除：

```ts
async onMessage(ctx, message) {
  if (!message.author || message.author.isBot) return null;
  const participants = await ctx.thread.listParticipants();
  const isGroupFollowUpFromStarter =
    participants.length > 1 && participants[0] === message.author.userId;
  return isGroupFollowUpFromStarter ? { auth: null } : null;
}
```

与 `threadContext` 一样，这个 helper 会调用 `conversations.replies` 并需要匹配的 Slack history scope。它最多观察线程的前 50 条消息，抓取失败会被记录并吞掉，所以返回的列表可能为空或过期——把意外的空列表当作"不路由"，而不是"没有参与者"。

#### 加载之前的线程消息

默认你只会得到触发提及，而不是线程里更早的回复。启用 `threadContext` 可以在每条消息都按稳定 Slack user id 归属的情况下抓取并注入它们。使用 `since: "last-agent-reply"` 让重复提及只注入新增内容：

```ts title="agent/channels/slack.ts"
import { slackChannel } from "eve/channels/slack";
import { connectSlackCredentials } from "@vercel/connect/eve";

export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
  threadContext: { since: "last-agent-reply" },
});
```

`since` 设置每次提及注入的边界，接受三个值：

- `"thread-root"`（默认）：每次提及都注入线程里的所有先前消息。`threadContext: {}` 行为相同。
- `"last-agent-reply"`：只注入此已安装 Agent 最后一次回复之后的消息，让重复提及保持增量。来自其他 Slack bot 的回复不会移动边界。
- 一个谓词 `(message: SlackThreadMessage) => boolean`：只注入它匹配的最后一条消息之后的内容，比如"自最后一条提到某个用户的消息之后"。

`threadContext` 需要匹配的 Slack history scope。线程 helper 会复用同一个入站 handler 中已加载的消息，重叠的刷新共享一次 `conversations.replies` 请求。当 Agent 应该只看到直接提及时省略它。需要自定义过滤或对原始线程消息做非模型处理时，`loadThreadContextMessages` 仍然可用。

#### 控制重叠 turn

已接受的 Slack 消息默认使用基于取消的 steering：eve 缓冲新消息、取消活跃 turn、启动替代 turn。准入检查最先执行，因此被忽略的提及和被 hooks 拒绝的消息绝不会取消工作。当每个活跃 turn 都应该结束时设置 `turnPolicy: "queue"`：

```ts title="agent/channels/slack.ts"
export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
  turnPolicy: "queue",
});
```

Message hooks（`onMessage`、`onAppMention` 和 `onDirectMessage`）也在 `ctx` 上直接接收线程绑定的 session 操作。`ctx.cancel({ turnId? })` 对 Stop 按钮仍然有用：它取消时不发送替代输入。`"accepted"` 表示活跃线程 session 已 durable 排队该请求；park 的 session 会把它当作 no-op 消费；`"no_active_turn"` 表示该线程没有活跃的 session 拥有者。

Message 和 interaction hooks 在 `ctx` 上暴露每一个当前拥有者的操作：

```ts
async onAppMention(ctx) {
  await ctx.send("Run a separate turn.");
  await ctx.respond(inputResponses);
  await ctx.cancel();
  await ctx.compact();
  await ctx.clear();
  await ctx.reset({ reason: "Start over" });
  const session = await ctx.resolveSession();
  return { auth: null };
}
```

这些调用是相互独立的示例；一个 handler 通常只选一个。`ctx.send()` 是线程无主时唯一能创建 session 的方法。除非显式提供 `auth`，否则它会从入站用户派生 Slack auth。只有当后续工作必须固定在当前拥有的 durable session ID 上时，才使用 `await ctx.resolveSession()`。

#### 重置对话

当对话应该重新开始时，使用线程绑定的 `ctx.reset({ reason? })` 方法。Reset 终结性地退役当前拥有该线程的 session，包括任何进行中的 turn。下一条投递的消息会以全新的 history、state 和新的 session-scoped sandbox 启动新 session：

```ts title="agent/channels/slack.ts"
export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
  async onMessage(ctx, message) {
    if (message.text.trim() !== "/new") return null;
    await ctx.reset({ reason: "Slack user requested /new" });
    await ctx.thread.post("Started a fresh conversation.");
    return null;
  },
});
```

线程有 session 时 reset 返回 `{ status: "reset", previousSessionId }`，线程已空闲时返回 `{ status: "no_active_session" }`。两种结果都是成功。reset 后返回 `null` 会把触发消息当作命令消费；返回 `{ auth }` 则把该消息作为全新 session 的第一个 turn 投递。自定义 `onInteraction` handlers 接收同样的扁平操作，对 New conversation 按钮很有用。

### 其他 Events API 回调

用 `onEvent` 处理已订阅的事件，比如 `reaction_added`、`team_join` 或 `channel_created`。它接收原始、开放的 Slack 事件并拥有控制流。调用 `ctx.send(message, { target, auth })` 零次、一次或多次来启动 turn。每次调用都返回产生的 session。

```ts title="agent/channels/slack.ts"
import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";

const onboardingChannels = ["C0123ABC", "C0456DEF"];

export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
  async onEvent(ctx, event) {
    if (event.type !== "team_join") return;
    await Promise.all(
      onboardingChannels.map((channelId) =>
        ctx.send(
          `A user joined the Slack workspace. Onboard them from this event:\n${JSON.stringify(event)}`,
          {
            target: { channelId },
            auth: null,
          },
        ),
      ),
    );
  },
});
```

webhook 调用已经让被 await 的 `onEvent` handler 保持存活。对刻意脱离的工作，用 `ctx.waitUntil(promise)`，与 handler-form schedule 一致。`ctx.slack.request(operation, body)` 提供 workspace-scoped Slack Web API 访问，`ctx.envelope` 携带投递元数据，如 `team_id`、`event_id` 和 `event_time`。`ctx.send` 的调用会自动把回调的 team id 播种进 Slack session state。

因为泛化事件不一定与单个线程绑定，请把 target 放进每个操作的输入里：

```ts
const target = { channelId, threadTs };
await ctx.send("Follow up", { auth: null, target });
await ctx.respond(inputResponses, { auth: null, target });
await ctx.cancel({ target, turnId });
await ctx.compact({ target });
await ctx.clear({ target });
await ctx.reset({ reason: "Start over", target });
const session = await ctx.resolveSession({ target });
```

`onEvent` 是 message hooks 之后的原始回退。如果事件未被 `onAppMention`、`onDirectMessage` 或 `onMessage` 认领，作者写的 `onEvent` 会收到它；否则 eve 应用内置的 mention/DM 默认行为或忽略它。

`onEvent` 只覆盖 JSON `event_callback` 投递。URL verification、slash commands 和 interactive payloads 不会到达它。把你想要的每个事件和所需 OAuth scope 都添加到 Slack 应用的 Event Subscriptions 配置中；eve 只能处理 Slack 发送的事件。

### Handler 之外的 Slack API 调用

在 webhook 侧 handler（`onAppMention`、`onEvent`、`onInteraction`、`events`）内部，`ctx.slack.request(operation, body)` 是原始 API 的逃生舱。在这些上下文之外没有 handle——比如 schedule 要解析旧消息上的 reactions，就没有入站 Slack 请求。这种情况下直接调用 handle 使用的同一个原语：

```ts
import { callSlackApi } from "eve/channels/slack";
import { connectSlackCredentials } from "@vercel/connect/eve";

const { botToken } = connectSlackCredentials("slack/my-agent");
const response = await callSlackApi({
  botToken,
  operation: "reactions.get",
  body: { channel: "C0123456789", timestamp: "1712345678.000100", full: true },
});
if (!response.ok) throw new Error(String(response.error));
```

`callSlackApi` 在调用时解析函数形式的 token（secret managers、Connect rotation），并把 body 做 form 编码——这是唯一安全的默认值，因为 Slack 对 JSON 的支持不完整（`conversations.replies` 拒绝 JSON）。当你需要 bearer token 本身时，`resolveSlackBotToken` 会把 `SlackBotToken` 物化为字符串。

### 投递（Delivery）

默认 handler 在线程内回复并显示进度。输入状态指示器会自动发布：入站时是 `Thinking…`，`turn.started` 时是 `Working…`，`reasoning.appended` 时是截断的推理片段，`actions.requested` 时是动作标签——工具名加上它最有信息量的参数（`grep useEveAgent`、`read_file agent/agent.ts`）、dispatch 调用时的子智能体或远程 Agent 名，模型一次请求多个动作时还有 `+N more`。模型自己的工具前叙述（如果存在）优先于派生标签。推理片段渐进构建：至少四个字符的扩展会立即出现，而较小的流式增量使用五秒刷新间隔，避免每个 token 发一次 Slack 请求。如果你更喜欢通用措辞，可以覆盖 `events["reasoning.appended"]`。覆盖入站 handler 或 `events` handlers 来做定制。

出站文本把裸 `@` token 保留为字面文本。要提及用户，直接嵌入 Slack 的 `<@USER_ID>` 语法，或用 `channel.thread.mentionUser(userId)`。

当 session 在没有 `threadTs` 的情况下启动（比如 schedule 的 `to(slack, target).send(...)`），eve 会给它一个唯一的临时 continuation token。Agent 的第一条帖子会把 session 锚定到 Slack 消息时间戳，之后的帖子和提及恢复同一个 session。想先落地一个结构化锚点，可以带 `Card` 传 `initialMessage`。`threadTs` 和 `initialMessage` 互斥。

下面的例子覆盖 `onAppMention`，以作者消息为门禁，并把完成的回复发布到线程。事件 handlers 接收 `(eventData, channel, ctx)`，Slack 平台 handle 在 `channel.thread` 和 `channel.slack` 上：

```ts
import { defaultSlackAuth, slackChannel } from "eve/channels/slack";
import { connectSlackCredentials } from "@vercel/connect/eve";

export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
  onAppMention: (ctx, message) =>
    message.author ? { auth: defaultSlackAuth(message, ctx) } : null,
  events: {
    "message.completed"(eventData, channel, ctx) {
      if (eventData.finishReason === "tool-calls") return;
      if (eventData.message) channel.thread.post(eventData.message);
    },
  },
});
```

### Human-in-the-loop（HITL）

HITL 渲染为 Slack 按钮和下拉选择。用户响应后，parked session（暂停等待输入）恢复。

授权提示把公开状态与私有凭证分开。登录挑战（OAuth URL、device code）是一种凭证。任何完成它的人都会把自己的身份绑定到 session 的 connection。默认的 `authorization.required` handler 在线程里发布一条公开、无链接的状态，把实际挑战（包括 device code）以 ephemeral 方式投递给触发用户，然后在 `authorization.completed` 触发时更新该公开状态。Handler 接收一个私有投递上下文，带 `postEphemeral`、`postDirectMessage`（需要 `im:write` scope）和 `state`。刻意地，没有公开的 `post`，也没有原始 API 访问。

```ts
events: {
  "authorization.required"(eventData, channel) {
    const userId = channel.state.triggeringUserId;
    if (!userId || !eventData.authorization?.url) return;
    return channel.postDirectMessage(userId, `Sign in to continue: ${eventData.authorization.url}`);
  },
},
```

### 主动 session（Proactive sessions）

通过另一渠道的 `ctx.to(slack, target).send(message, { auth })`，或 schedule `run` handler 里的 `to(slack, target).send(message, { auth })`，无需入站消息即可启动 session。主动目标形状是 `{ channelId, threadTs?, initialMessage? }`。

### 附件（Attachments）

位于已认证 Slack URL 之后的入站文件会用 `fetchFile` 分阶段处理。`fetchFile` 契约见 [File uploads](./custom#file-uploads)。

私有文件下载需要 Slack bot token 的 `files:read` scope。发送附件前先添加 scope 并重装 Slack 应用。

分阶段处理的文件放在 session sandbox 的 `/workspace/attachments` 下。Session history 保留对该路径的引用，而不是 Slack 文件的第二份副本。如果后端无法重新挂载原始 sandbox，eve 就无法从 history 恢复附件字节；后续 turn 会收到 missing-file 结果。当 Agent 必须独立于 sandbox 可用性保留文件时，把文件存在 sandbox 之外。

## 接下来读什么（What to read next）

- [Channels overview](./overview)：channel 契约和所有内置渠道
- [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)：入站流量认证
