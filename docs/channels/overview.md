---
title: "渠道（Channels）"
description: "Channel 契约、内置 eve HTTP 渠道与自定义渠道：用户如何触达你的 Agent。"
---

# 渠道（Channels）

Channel 是平台与 Agent 之间的边缘适配器，负责三件事：

- 把平台输入规范化为一条用户消息。
- 持有渠道本地地址，把平台会话映射到当前的 durable session。
- 决定投递方式：回复如何、在哪里、是否返回。

eve 内置一个基础 HTTP channel 和一批一等平台渠道，你也可以自己编写。完整的渠道清单可以浏览 [Integrations](https://eve.dev/integrations) 画廊并选择 Channels 筛选器。

channel 把输入规范化之后，无论消息来自哪里，eve 都运行同一个 Agent runtime。Tool 和 instructions 不需要为 channel 写特殊逻辑。

## 重叠消息（Overlapping messages）

Channel 默认 `turnPolicy: "steer"`。当一条已接受的消息在 turn 进行中到达时，eve 会先把消息 durable 缓冲，然后协作式地取消当前 turn 并启动一个替代 turn。被取消的 turn 会发出 `turn.cancelled` 后跟 `session.waiting`；替代 turn 使用新的 turn ID。已经流式输出和完成的副作用不会回滚。

当每个 turn 必须结束后才能开始下一条消息时，在任何内置或自定义 channel 上设置 `turnPolicy: "queue"`：

```ts
export default defineChannel({
  turnPolicy: "queue",
  routes: [
    // ...
  ],
});
```

`from(address).send(...)`、固定的 `Session.send(...)`、跨渠道发送和 Chat SDK bridge 发送也都接受每次发送的 `turnPolicy` 覆盖。纯 `inputResponses` 投递只回答挂起的请求，不会 steer。显式的 `cancel()` 仍然是不带替代消息的停止操作。

Channel 准入检查仍然最先运行。被忽略的提及、被拒绝的签名、重复消息以及任何其他被丢弃的平台事件，都不会影响当前 turn。

每个 channel 都有自己的服务商条款、数据流、认证模型和用户同意预期。在通过 channel 发送非公开、敏感、受监管或生产数据之前，请确认渠道服务商以及你配置的 scopes、签名校验、路由认证和投递行为符合你的使用场景。

## Channel 文件的位置（Where channels live）

Channel 文件位于根 Agent 的 `agent/channels/` 下。文件 stem 就是 channel id：`agent/channels/intake.ts` 的地址是 `intake`。把 channel 作为模块的默认导出。本地子智能体不声明 channel。

```txt
agent/
  agent.ts
  channels/
    eve.ts
    slack.ts
    intake.ts
```

用 `eve add channel/photon-imessage`、`eve add channel/slack` 或 `eve add channel/web` 从 registry 安装 channel，也可以手写这个文件。

## eve HTTP channel（默认）

eve channel 是框架默认的 HTTP session API，是终端 UI、[`useEveAgent`](../guides/frontend/overview) 和 `curl` 都会打交道的路由。即使没有 `agent/channels/eve.ts` 文件它也默认启用。只有当需要覆盖默认配置（最常见的是路由认证策略）时才添加该文件。路由、认证和定制见 [HTTP channel](./eve)。

## 自定义渠道（Custom channels）

当 eve 没有为你的场景提供渠道时，用 `eve/channels` 的 `defineChannel` 构建一个。自定义 channel 声明路由处理器（`GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`WS`）、一个 `events` map，并用 `send(address, input)` 启动或恢复 session。完整教程见 [自定义渠道（Custom channels）](./custom)，包括 WebSocket 路由、跨渠道交接、channel metadata、地址令牌和文件上传。

## 与 Chat SDK 的关系（Relationship to the Chat SDK）

eve 使用 [Chat SDK 的 card-builder 组件](https://chat-sdk.dev/docs/api/cards)（Cards、Buttons、Actions 等）来组合丰富的 Slack 消息。当你用 [Slack channel](./slack) 构建 card 时，底层原语来自 Chat SDK，并在发布时转换为 Slack Block Kit。

eve 的一等渠道使用 eve 自有的 runtime 处理 webhook、验证、事件解析和线程管理。可选的 [Chat SDK channel](./chat-sdk) 是例外：它接受 Chat SDK adapter 并暴露其 `Chat` 和 `Thread` 原语。想要 eve 一等 Slack 集成用 `slackChannel`，想要 eve 原生自定义渠道用 `defineChannel(...)`，想有意识地使用 Chat SDK adapter 和 runtime 时用 `chatSdkChannel`。

## 用哪个渠道？（Which channel?）

| 你想要… | 使用 |
| --- | --- |
| Web 应用 / 浏览器聊天 UI | eve channel + [`useEveAgent`](../guides/frontend/overview) |
| 本地工具、SDK 客户端、`curl` | [eve HTTP channel](./eve)（默认） |
| Slack 提及、私信、按钮 | [Slack](./slack) |
| iMessage | [Photon](./photon) |
| Discord 斜杠命令、组件 | [Discord](./discord) |
| Microsoft Teams 消息 + Adaptive Cards | [Teams](./teams) |
| Telegram bot 消息 | [Telegram](./telegram) |
| SMS 或语音转写电话 | [Twilio](./twilio) |
| GitHub @提及、带 checkout 的 PR review | [GitHub](./github) |
| Linear issue 委派与 Agent Sessions | [Linear](./linear) |
| 其他 Chat SDK 支持的服务 | [Chat SDK adapters](./chat-sdk) |
| 其他任何场景（内部 webhook、WebSocket） | [自定义渠道（Custom channel）](./custom)（`defineChannel`，见上文） |

## 免责声明（Disclaimer）

作为部署者，你有责任确保 Agent 符合适用法律。

当 eve Agent 与人交流时，法律可能要求你披露对方正在与自动化 AI 系统交互。eve 不会自动添加这一披露；请在 instructions 和/或 channel 响应中自行配置。

## 接下来读什么（What to read next）

- [Slack](./slack)：最常用的平台渠道，端到端讲解
- [自定义渠道（Custom channels）](./custom)：用 `defineChannel` 为任何场景构建渠道
- [前端（Frontend）](../guides/frontend/overview)：在 eve channel 上用 `useEveAgent` 实现浏览器聊天
- [Integrations](https://eve.dev/integrations)：用 Channels 筛选器浏览所有内置渠道
