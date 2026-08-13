---
title: "自定义渠道（Custom Channels）"
description: "用 routes、events、metadata、continuation tokens 和文件上传编写自定义 HTTP 与 WebSocket 渠道。"
---

# 自定义渠道（Custom Channels）

当 eve 没有为你的场景提供渠道时，你就自己构建一个。自定义渠道暴露 HTTP 或 WebSocket 端点、解析入站请求、启动或恢复 session、观察 runtime 事件，并负责把结果投递回你的平台。

## 文件位置与身份（File location and identity）

自定义渠道位于根 Agent 的 `agent/channels/` 下。本地子智能体目前不声明渠道。

channel 文件的 stem 就是 channel id，所以 `agent/channels/internal-webhook.ts` 的地址是 `internal-webhook`。把 channel 定义作为模块的默认导出。

## 定义一个 channel（Define a channel）

把平台的会话身份传给每个操作：

```ts title="agent/channels/support.ts"
import { defineChannel, GET, POST } from "eve/channels";

export default defineChannel({
  routes: [
    POST("/threads/:threadId/messages", async (request, { from, params }) => {
      const body = await request.json();
      const source = from(params.threadId);
      if (body.message === "/new") {
        return Response.json(await source.reset({ reason: "User requested /new" }));
      }
      const session = await source.send(body.message, { auth: null });
      return Response.json({ sessionId: session.id });
    }),
    POST("/threads/:threadId/cancel", async (_request, { from, params }) =>
      Response.json(await from(params.threadId).cancel()),
    ),
    POST("/threads/:threadId/compact", async (_request, { from, params }) =>
      Response.json(await from(params.threadId).compact()),
    ),
    POST("/threads/:threadId/clear", async (_request, { from, params }) =>
      Response.json(await from(params.threadId).clear()),
    ),
    GET("/sessions/:sessionId/stream", async (_request, { attachSession, params }) => {
      const stream = await attachSession(params.sessionId).getEventStream();
      return new Response(stream, {
        headers: { "content-type": "application/x-ndjson; charset=utf-8" },
      });
    }),
  ],
  events: {
    "message.completed"(event, _channel, ctx) {
      console.log(ctx.session.id, event.message);
    },
  },
});
```

每个路由都会收到这些操作面：

- `from(address)` 把 `send`、`respond`、`cancel`、`compact`、`clear` 和 `reset` 绑定到一个 channel 本地 continuation address。
- `resolveSession(address)` 快照当前拥有某个 channel 本地 continuation address 的 session。
- `attachSession(sessionId)` 创建一个无 I/O 的 handle，固定到一个 durable session ID。
- `to(channel, target).send(message, options)` 把工作交给另一个自写渠道。
- `params`、`waitUntil` 和 `requestIp` 提供请求元数据和生命周期控制。

事件 handlers 接收 `(eventData, channel, ctx)`。`ctx.session.id` 标识确切 session，而 `channel.continuation` 暴露当前地址，以及当该 channel 需要移动地址时的 `rekey()`。`session.failed` 只接收 `(eventData, channel)`，因为它在 session 上下文之外运行；它的事件数据直接包含 `sessionId`。

`channel.continuation.token` 始终是 `from()`、`resolveSession()` 和 `rekey()` 接受的 channel 本地地址。框架命名空间前缀不属于自写渠道 API。

## Channel 操作与 session handles

Channel 操作是动态的：每次调用都作用于当前拥有该地址的 session。只有 `send()` 能在地址无主时创建 session。

```ts
const source = from(threadId);
const session = await source.send("Hello", { auth });
await source.respond(inputResponses, { auth });
await source.cancel({ turnId });
await source.compact();
await source.clear();
await source.reset({ reason: "Start over" });
const currentSession = await resolveSession(threadId);
```

`Session` 是固定的：每次调用都只作用于一个 durable ID。它从不创建、跟随或解析替代 session。

```ts
const session = attachSession(sessionId);
await session.send("Follow up", { auth });
await session.respond(inputResponses, { auth });
await session.cancel({ turnId });
await session.compact();
await session.clear();
await session.reset({ reason: "Retire this session" });
await session.getEventStream({ startIndex: 12 });
```

消息发送使用 channel 的 `turnPolicy`，默认 `"steer"`。活跃 turn 期间到达的已接受消息会先被 durable 缓冲，然后 eve 取消该 turn 并把消息作为替代 turn 启动。当活跃 turn 应该按顺序结束时，在 `defineChannel(...)` 上配置 `turnPolicy: "queue"`，或覆盖单次发送：

```ts
export default defineChannel({
  turnPolicy: "queue",
  routes: [
    POST("/messages", async (request, { from }) => {
      const body = await request.json();
      await from(body.threadId).send(body.message, {
        auth: null,
        turnPolicy: "steer",
      });
      return new Response(null, { status: 202 });
    }),
  ],
});
```

同样的覆盖也适用于固定的 `Session.send(...)` 和跨渠道 `to(...).send(...)`。`respond(...)` 从不 steer：它只投递被寻址的 input responses。需要不带替代消息地停止工作时用 `cancel()`。

Attach 不做查找。第一次操作会报告该 ID 是否活跃。只有当你需要把地址的当前拥有者快照为固定 handle 时才调用 `resolveSession(address)`。

## 操作语义（Operation semantics）

- `cancel` 协作式地停止活跃 turn。以 `turn.cancelled` 后跟 `session.waiting` 确认；之后 session 接受另一条消息。
- `compact` 在不添加合成用户消息的情况下摘要模型上下文。成功会发出 `compaction.requested`、`compaction.completed`，然后 `session.waiting`。
- `clear` 就地移除模型消息历史。它保留 system prompt、skills、tools、durable state、limits、地址所有权和 session sandbox。
- `reset` 终结性地退役当前 session。之后的地址 `send()` 会创建全新 session；固定的 `Session` handle 仍钉在已退役的 ID 上。

控制操作从不创建 session。未知或不活跃的目标返回良性的 no-active 状态。在调用 `reset` 之前要认证并去重命令 webhook，因为迟到的重复请求可以退役一个更新的地址拥有者。

## CORS

自定义 HTTP channel 默认不碰 CORS，除非你选择启用。传 `cors: true` 获得带 preflight 处理的宽松浏览器访问，或传一个可序列化的 CORS options 对象来收窄 origins、methods 和 headers：

```ts
import { defineChannel, POST } from "eve/channels";

export default defineChannel({
  cors: {
    origin: ["https://app.example.com"],
    methods: ["POST"],
    allowHeaders: ["authorization", "content-type"],
  },
  routes: [POST("/message", async () => new Response("ok"))],
});
```

## WebSocket 路由

当自定义 channel 需要 WebSocket 端点时使用 `WS()`。路由 handler 每次 upgrade 请求运行一次，并返回该连接的 lifecycle hooks：

```ts
import { defineChannel, WS } from "eve/channels";

export default defineChannel({
  routes: [
    WS("/voice/ws", async (_req, { from }) => ({
      async message(_peer, message) {
        await from("voice-demo").send(message.text(), { auth: null });
      },
    })),
  ],
});
```

`WS()` handlers 接收与 HTTP 路由 handlers 相同的 `from`、`to` 和 `attachSession` 操作，以及 `params`、`waitUntil` 和 `requestIp` 参数。返回的 hooks 是与 Nitro/H3 websocket routing 兼容的 eve 自有结构类型，包括 `upgrade`、`open`、`message`、`close` 和 `error`。

### Node upgrade server 逃生舱

当你拥有 websocket 行为时，优先使用上面的 `WS()` lifecycle hooks。eve 也暴露 `createWebSocketUpgradeServer()`，用于更窄的场景：第三方 SDK 或框架希望直接绑定 Node `http.Server` 的 `server.on("upgrade", ...)`。

```ts
import { defineChannel, WS, createWebSocketUpgradeServer } from "eve/channels";

const bridge = createWebSocketUpgradeServer();
thirdPartySdk.attach(bridge.server);

export default defineChannel({
  routes: [WS("/vendor/ws", bridge.route)],
});
```

bridge server 不在自己的端口上监听。它只接收匹配 eve 路由的 upgrade 事件，而且只在 Nitro 暴露原始 Node upgrade request、socket 和 head 的 host 上。把它当作带有 server-binding API 的库的兼容适配器，而不是在 eve 中构建 websocket channel 的主要方式。

## 跨渠道交接（Cross-channel hand-off）

路由 handler 可以通过 `ctx.to(channel, target).send(message, options)` 在另一个渠道上启动 session。当某个渠道上的入站请求应该把对话转向另一个渠道时使用它，比如 incident webhook 在 Slack 中打开一个调查线程。

```ts
import { defineChannel, POST } from "eve/channels";
import slack from "./slack";

export default defineChannel({
  routes: [
    POST("/incident", async (req, ctx) => {
      const incident = await req.json();
      ctx.waitUntil(
        ctx
          .to(slack, { channelId: "C0123ABC" })
          .send(`Investigate ${incident.reference}: ${incident.title}`, {
            auth: {
              authenticator: "incidentio",
              principalType: "service",
              principalId: incident.actor.id,
              attributes: { reference: incident.reference, severity: incident.severity },
            },
          }),
      );
      return new Response("ok");
    }),
  ],
});
```

语义：

- 目标渠道的自写 `receive(input, { from })` hook 拥有 continuation-token 格式和初始状态。调用方把 target 传给 `to(...)`，然后把 message 和 auth 传给 `send(...)`。
- `auth` 会流入 `session.auth.initiator`，让目标渠道的事件 handlers 和 Agent 的 tools 能读取是谁启动了 session。
- 调用 `ctx.to(...).send(...)` 不会也在当前渠道上启动 session。入站渠道的响应就是路由 handler 显式返回的内容。
- 第一个参数是目标渠道模块的默认导出。直接从 `agent/channels/<name>.ts` 导入它。身份按引用匹配。

## Channel metadata

channel 可以把自己的 adapter state 子集投影为 metadata，供 instrumentation resolvers、dynamic tool resolvers 和 dynamic skill 或 instruction resolvers 使用。在 channel config 上定义 `metadata(state)` 函数：

```ts
import { defineChannel, POST } from "eve/channels";

export default defineChannel({
  state: {
    topic: null as string | null,
    contextMessages: [] as string[],
    internalCounter: 0,
  },
  metadata(state) {
    return {
      topic: state.topic,
      contextMessages: state.contextMessages,
    };
  },
  routes: [
    POST("/start", async (req, { from }) => {
      const body = await req.json();
      await from(body.token).send(body.message, {
        auth: null,
        state: { topic: body.topic, contextMessages: body.context, internalCounter: 0 },
      });
      return new Response("ok");
    }),
  ],
  events: {
    "turn.started"(eventData, channel) {
      channel.state.internalCounter += 1;
    },
  },
});
```

投影在 channel 事件 handlers 运行后 adapter state 变化时重新求值。Dynamic tool resolvers 通过 `ctx.channel.metadata` 读取它，并用 `isChannel` 收窄。完整消费模式见 [动态能力（Dynamic capabilities）](../guides/dynamic-capabilities)。

当父 Agent dispatch 子智能体时，框架会把父级的 channel metadata 投影转发给子级。同一个 `metadata(state)` 投影器也服务于 instrumentation metadata resolvers。

## Continuation tokens

每个 channel 操作都接受 channel 本地 token。框架在把 token 交给 runtime 之前，会从 `agent/channels/` 下的文件 stem 派生 channel 名前缀。

```ts
import { slackContinuationToken } from "eve/channels/slack";
import { twilioContinuationToken } from "eve/channels/twilio";

slackContinuationToken("C0123ABC", "1800000000.001234"); // "C0123ABC:1800000000.001234"
twilioContinuationToken("+15551234567", "+15557654321"); // "+15551234567:+15557654321"
```

自定义渠道自己编写连接身份字段的函数。框架不会替你派生任何东西；channel 拥有自己的 token 格式。

当应该寻址 session 的身份到后来才得知时，用 `channel.continuation?.rekey(rawToken)` 重新设置活跃地址。Runtime 保留当前 channel 命名空间。

Rekeying 改变当前 session 的地址。`reset` 不同：它终结性地退役当前 session，并让它的既有地址可供后续 `send()` 使用。`cancel` 更窄：它只停止活跃 turn，保留 session、history 和 continuation-token 所有权不变。

`context(state, session)` 配置选项构建每个 step 传给每个事件 handler 的 `channel` 参数。它接收 channel 的活跃 adapter `state` 和 `SessionHandle`，返回 channel 拥有的上下文（线程 handles、API 客户端、late-bound 回调）。框架注入 [`ChannelContinuationOps`](#define-a-channel)，并把结果作为第二个位置参数传给每个 handler。闭包捕获 `session` 让工厂可以注册稍后重新设置地址的回调。通过返回的上下文做出的 state 修改会写回 adapter state。

```ts
import { defineChannel } from "eve/channels";
import { mintRef } from "./refs";

defineChannel<{ ref: string | null }>({
  state: { ref: null },
  context(state, session) {
    return {
      state,
      registerAnchor(ref: string) {
        state.ref = ref;
        session.continuation?.rekey(ref);
      },
    };
  },
  events: {
    "message.completed"(eventData, channel) {
      if (!channel.state.ref) channel.registerAnchor(mintRef());
    },
  },
  routes: [/* ... */],
});
```

在下一个 workflow boundary，runtime 会在释放旧 token 之前认领新的 park hook。如果另一个活跃 session 已经拥有新 token，re-keying session 会失败而不是接管它。成功 re-key 之后，仍寻址到旧 token 的入站投递会被丢弃，所以请与发送方协调使用新 token。

## 文件上传（File uploads）

`from(address).send()` 接受包含 `string | UserContent` 的 `message`，而 `Session.send()` 直接接受 `string | UserContent`。要包含文件附件，传一个混合文本和文件部分的 `UserContent` 数组：

```ts
await from(continuationToken).send(
  [
    { type: "text", text: body.message },
    { type: "file", data: imageBytes, mediaType: "image/png" },
  ],
  { auth },
);
```

对于文件位于已认证 URL 之后的平台（如 Slack），把 `URL` 对象放进 `FilePart.data`，并在 channel config 上声明 `fetchFile`：

```ts
defineChannel({
  fetchFile(url) {
    if (!url.startsWith("https://files.slack.com/")) return null;
    return fetch(url, { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.arrayBuffer())
      .then((b) => ({ bytes: Buffer.from(b) }));
  },
  routes: [
    POST("/webhook", async (req, { from }) => {
      await from(continuationToken).send(
        [
          { type: "text", text: message.text },
          ...message.attachments.map((a) => ({
            type: "file" as const,
            data: new URL(a.url),
            mediaType: a.mediaType,
          })),
        ],
        {
          auth,
          state,
        },
      );
    }),
  ],
});
```

`URL` 对象会以字符串形式穿过队列边界，并在 workflow step 内重新构成。分阶段处理管线以序列化的 URL（URL 的 `href`）调用 `fetchFile`，这就是示例匹配 `url.startsWith(...)` 的原因。返回 bytes 把文件分阶段处理到 sandbox，或返回 `null` 让 URL 直接传给模型 provider。

框架负责把 bytes 分阶段处理到 sandbox、执行上传策略、为模型调用水合文件，并在队列序列化后重新构成 `URL` 对象。

## 接下来读什么（What to read next）

- [Channels overview](./overview)
- [动态能力（Dynamic capabilities）](../guides/dynamic-capabilities)
- [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)
