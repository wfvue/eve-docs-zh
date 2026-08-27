---
title: "跨渠道持久通知（Durable cross-channel notifications）"
description: "不启动 Agent turn 就把通知发到另一个平台，用应用自有 outbox 做重试和去重。"
---

# 跨渠道持久通知（Durable cross-channel notifications）

`ctx.to(channel, target).send(...)` 把消息交给另一个 channel，并在那里启动或恢复 Agent session。eve **目前**不提供直接的跨渠道消息队列或提供商 outbox。要在不调用模型的情况下发通知，改用目标平台的 API。通知必须撑过崩溃时，先把意图记进应用自有 outbox，再尝试投递。

应用自有 outbox 是当前 durable 提供商通知的模式。它提供至少一次处理。它本身不保证恰好一次投递：如果提供商接受了请求但响应丢失，dispatcher 无法知道该不该重试。提供商有幂等键时使用它。否则让重复无害，或在重试模糊请求前先对账目的地。

下面例子发到 Slack，需要 `SLACK_REVIEW_CHANNEL_ID` 和 `SLACK_BOT_TOKEN`。渠道使用 Vercel Connect 时，把 connector 的 `botToken` resolver 传给 `callSlackApi`。

官方原文：[Durable cross-channel notifications](https://eve.dev/docs/patterns/durable-cross-channel-notifications)。

## 记录通知意图

把平台特定副作用挂到该平台自己的 channel 上，而不是过滤一个全局 hook。这个 GitHub channel 为每次完成的 GitHub turn 记录一条 Slack 通知：

```ts title="agent/channels/github.ts"
import { githubChannel } from "eve/channels/github";
import { notificationOutbox } from "../lib/notification-outbox";

export default githubChannel({
  botName: process.env.GITHUB_APP_SLUG,
  events: {
    async "turn.completed"(event, channel, ctx) {
      await notificationOutbox.enqueue({
        key: `github-review:${ctx.session.id}:${event.turnId}`,
        destination: {
          channelId: process.env.SLACK_REVIEW_CHANNEL_ID!,
          provider: "slack",
        },
        message: `PR review completed for ${channel.repository.fullName}.`,
      });
    },
  },
});
```

`enqueue` 必须在 `key` 上强制唯一约束，例如 `INSERT ... ON CONFLICT DO NOTHING`。Durable step 可能在中断后重跑，channel event handlers 至少一次。稳定 key 防止这些尝试创建多行 outbox。

Channel 的 `events` handlers 只为该 channel 拥有的 sessions 运行。在内置渠道上，authored handler 会替换同一 event key 的内置 handler；使用没有内置 handler 的事件，或复现你打算替换的行为。渠道作用域规则见 [钩子（Hooks）](../guides/hooks)。

## 领取并投递 pending 行

用一个 handler-form schedule 做 dispatcher。用 lease 领取行，调用提供商 API，再把每行标为完成：

```ts title="agent/schedules/notification-outbox.ts"
import { callSlackApi } from "eve/channels/slack";
import { defineSchedule } from "eve/schedules";
import { notificationOutbox } from "../lib/notification-outbox";

export default defineSchedule({
  cron: "* * * * *",
  run({ waitUntil }) {
    waitUntil(
      (async () => {
        const notifications = await notificationOutbox.claim({
          limit: 25,
          leaseForMs: 5 * 60_000,
        });

        await Promise.all(
          notifications.map(async (notification) => {
            try {
              const response = await callSlackApi({
                botToken: undefined,
                operation: "chat.postMessage",
                body: {
                  channel: notification.destination.channelId,
                  text: notification.message,
                },
              });
              if (!response.ok) throw new Error(String(response.error));

              await notificationOutbox.complete(notification, {
                providerMessageId: String(response.ts),
              });
            } catch (error) {
              await notificationOutbox.release(notification, {
                error,
                retryAt: new Date(Date.now() + 5 * 60_000),
              });
            }
          }),
        );
      })(),
    );
  },
});
```

`botToken` 为 `undefined` 时，`callSlackApi` 回退到 `SLACK_BOT_TOKEN`。

存储适配器是应用代码。它需要这些语义：

- `enqueue` 按稳定操作 key 插入一次。
- `claim` 原子地 lease pending 行，避免重叠 dispatchers 并发发送同一行。
- `complete` 记录提供商 message ID 并把行标为已投递。
- `release` 记录错误并在 `retryAt` 之后让行重新合格。
- 过期 leases 回到 pending 集合。

## 处理模糊投递

能证明提供商没有接受请求的错误可以安全重试。超时、连接重置，或请求离开进程后的崩溃是模糊的。提供商可能已经接受了通知，尽管 dispatcher 没有记录完成。

按这个顺序处理该窗口：

1. 提供商 API 支持幂等键时，把 outbox key 传过去。
2. 否则，在提供商 metadata 里存一个稳定标记，并在重试前查询它（提供商提供可靠 lookup 时）。
3. 两者都没有时，把通知设计成重复是安全的，并且能被看成同一逻辑操作。

不要仅仅为了抑制重复就把模糊行标为 complete；那可能丢掉提供商从未接受的通知。除非提供商契约关掉这个模糊窗口，不要把 outbox 描述为恰好一次。

如果目的地应该运行 Agent 而不是接收通知，改用 [`ctx.to(...).send(...)`](../channels/custom)。那条路径会创建或恢复 durable session 并调用模型。
