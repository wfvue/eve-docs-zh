---
title: "续接（Continuations）"
description: "用 continuation tokens、session IDs 和 stream cursors 持久化并恢复 Eve client sessions。"
---

# 续接（Continuations）

每个 Eve client turn 都会返回两个 handle，混淆它们是常见错误。TypeScript client 会同时帮你跟踪二者：

- `continuationToken`：resume handle。用它发送下一条 user turn。
- `sessionId`：stream-and-inspect handle。用它连接 event history。

`ClientSession` 还会跟踪 `streamIndex`，表示已经消费过的 events 数量。这三个字段合起来就是 `SessionState`。

## 读取并持久化状态（Read and persist state）

一个 streamed turn 结束后，读取 `session.state`：

```ts
const session = client.session();

const response = await session.send("Create a launch checklist.");
await response.result();

await saveSessionState(session.state);
```

请保存完整 state object：

```ts
interface SessionState {
  continuationToken?: string;
  sessionId?: string;
  streamIndex: number;
}
```

Continuation token 用于恢复对话。Session ID 和 stream index 让 client 可以重新连接到正确 stream 位置，而不 replay 已经消费过的 events。

`SessionState` 是 cursor，不是 chat transcript。如果你的应用要展示历史消息，请单独持久化 stream events，并按自己的 chat 或 thread ID 存储。Reload 后，把保存的 `SessionState` 传回 `client.session(savedState)`，或传给 `useEveAgent({ initialSession })`；把保存的 events 传给自己的 renderer，或传给 `useEveAgent({ initialEvents })`。

## 恢复已保存 session（Resume a saved session）

把保存的 state 传回 `client.session()`：

```ts
import type { SessionState } from "eve/client";

const saved = (await loadSessionState()) as SessionState;
const session = client.session(saved);

const response = await session.send("Now shorten it.");
const result = await response.result();
console.log(result.message);
```

如果只有 continuation token，可以把它作为 shorthand 传入：

```ts
const session = client.session(continuationToken);
const response = await session.send("Continue where we left off.");
await response.result();
```

Shorthand 可以发送 follow-up，但不知道之前的 stream cursor。当你控制持久化时，优先保存完整 `SessionState`。

## Waiting、completed 和 failed sessions（Waiting, completed, and failed sessions）

当一个 turn 以 `session.waiting` 结束时，client 会保留 state，让下一次 send 继续同一段对话。

当一个 turn 以 `session.completed` 或 `session.failed` 结束时，client 会重置本地 state。下一次 send 会启动新的 durable session：

```ts
const response = await session.send("Do this one-shot task.");
const result = await response.result();

if (result.status === "completed") {
  // session.state 现在是新的 cursor：{ streamIndex: 0 }
}
```

这和 runtime contract 一致：只有 waiting session 能接受下一条 user input。

## 多个 sessions（Multiple sessions）

每段对话创建一个独立的 `ClientSession`：

```ts
const research = client.session();
const support = client.session();

const researchResponse = await research.send("Research competitors.");
await researchResponse.result();

const supportResponse = await support.send("Draft a support reply.");
await supportResponse.result();

await save("research", research.state);
await save("support", support.state);
```

共享的 `Client` 只拥有 host、auth、headers 和 reconnect settings。Conversation state 位于每个 `ClientSession` 上。

对 multi-chat UI 来说，通常是一条应用 chat row 搭配两个 Eve 字段：最新 `SessionState` 和用于渲染的有序 event log。不要在侧边栏多个对话之间复用一个 `ClientSession`，也不要把 `streamIndex` 当作数据库行号；它只是该 Eve session 的远程 stream cursor。

## 重新连接已有 stream（Reconnect an existing stream）

当 session 已有 `sessionId` 时，`session.stream()` 可以从保存的 cursor 重新连接到 stream。重启后恢复 `SessionState` 是最常见原因：

```ts
const session = client.session(savedState);

for await (const event of session.stream()) {
  console.log(event.type);
}
```

`stream()` 是附加到已有 run；要发送新的 user input，请用 `send()`。如果要用 `startIndex` 覆盖 cursor，或理解完整 reconnect 模型，见 [流式输出（Streaming）](../streaming#手动打开-streamopen-a-stream-manually)。

## 接下来读什么（What to read next）

- [流式输出（Streaming）](../streaming)：按 event index 重新连接并流式处理 events
- [Sessions, runs & streaming](../../../concepts/sessions-runs-and-streaming)：原始 HTTP contract
- [Eve channel](../../../channels/eve)：continuation tokens 来自哪里
