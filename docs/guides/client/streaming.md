---
title: "流式输出（Streaming）"
description: "实时消费 Eve client stream events，按 event index 重连，并聚合 turn results。"
---

# 流式输出（Streaming）

每次 `ClientSession.send()` 都会先 POST 一个 turn，然后读取该 session 的 NDJSON event stream。`MessageResponse` 提供两种消费 stream 的方式：用 `result()` 聚合，或实时迭代 events。

## 聚合一个 turn（Aggregate a turn）

只需要最终 turn summary 时，使用 `result()`：

```ts
const response = await session.send("Summarize the latest forecast.");
const result = await response.result();

console.log(result.status);
console.log(result.message);
console.log(result.events.length);
```

它会一直消费 stream，直到当前 turn boundary：

- `session.waiting`
- `session.completed`
- `session.failed`

## 实时流式 events（Stream events live）

想渲染过程时，使用 `for await...of`：

```ts
const response = await session.send("Draft a plan and show your work.");

for await (const event of response) {
  if (event.type === "message.appended") {
    process.stdout.write(event.data.messageDelta);
  }

  if (event.type === "message.completed" && event.data.finishReason !== "tool-calls") {
    console.log("\nfinal:", event.data.message);
  }
}
```

`message.appended`、`reasoning.appended` 和 `action.input.appended` 是增量 delta events。eve 可能在 durable stream write 进行中合并同一文本块或工具调用的相邻增量，但会保留文本和事件顺序。不同事件类型、工具 `callId` 或 stream coordinate 是屏障。对应的 completed 形式 `message.completed` 和 `reasoning.completed` 是不渲染 deltas 的兼容路径。流式工具输入在匹配的校验调用到达 `actions.requested` 时完成。

## 处理 event types（Handle event types）

需要 exhaustiveness 或 helper 时，从 `eve/client` 导入 event types：

```ts
import type { HandleMessageStreamEvent } from "eve/client";
import { isCurrentTurnBoundaryEvent } from "eve/client";

function handleEvent(event: HandleMessageStreamEvent) {
  if (isCurrentTurnBoundaryEvent(event)) {
    console.log("turn settled:", event.type);
  }
}
```

最常见的 UI events：

| Event | Use |
| --- | --- |
| `message.received` | 确认用户消息已到达。 |
| `reasoning.appended` | 模型提供 reasoning 时渲染 reasoning deltas。 |
| `message.appended` | 渲染 assistant text deltas。 |
| `action.input.appended` | 在校验完成前累积原始 tool-input deltas。 |
| `actions.requested` | 在执行前显示模型请求的 tool calls。 |
| `action.result` | 显示 tool call results。 |
| `input.requested` | 暂停 UI，等待审批或问题回答。 |
| `result.completed` | 读取 [output schema](../output-schema) 产生的结构化输出。 |
| `session.waiting` | 重新启用 composer，等待下一条 turn。 |
| `session.completed` | 标记对话终止。 |
| `session.failed` | 标记对话失败。 |

完整 event 表见 [Sessions, runs & streaming](../../../concepts/sessions-runs-and-streaming)。

每个 `action.input.appended` 事件存储 `inputTextDelta` 和它的零基 UTF-16 code-unit `inputTextOffset`，这样消费者可以拒绝缺口，而不是拼接损坏输入。默认 message reducer 从 offset `0` 开始或重启，忽略不连续的非零 offset。它把接受的 deltas 累积进 `state: "input-streaming"` 的 `dynamic-tool` part；`inputText` 字段是可能不完整的累计原始文本。匹配的 `actions.requested` 把同一 `toolCallId` 升级为 `state: "input-available"`，并把校验后的值放进 `input`。

## 授权暂停（Authorization pauses）

`authorization.required` 不同于普通 `session.waiting` boundary。它表示 connection 需要 OAuth 或其它 authorization challenge，parked turn 需要等授权完成后才能继续。Chat UI 应渲染 authorization prompt，禁用该 session 的普通文本输入，并和其它 chat history 一样持久化该 event。

如果 authorization prompt pending 时支持刷新，请保存 started session 的 session cursor，并在加载时重新 hydrate 已保存 events。不要把 `authorization.required` 后缺少 `session.waiting` 当作对话已结束；callback 或结构化 decline 应恢复同一个 Eve session。

## 重连（Reconnection）

Client 会在 transient stream disconnect 后重连。它会从当前 session 已消费的 event 数量继续：

```ts
const client = new Client({
  host: "https://agent.example.com",
  maxReconnectAttempts: 5,
});
```

`maxReconnectAttempts` 是 per turn 的，默认值为 `3`。

## 手动打开 stream（Open a stream manually）

已有 session cursor、只需要连接已有 stream 时，使用 `session.stream()`：

```ts
const session = client.session({
  continuationToken: "eve:6c8b1f2e-3d4a-4b9c-8e21-9f0a1b2c3d4e",
  sessionId: "wrun_01ARYZ6S41TSV4RRFFQ69G5FAV",
  streamIndex: 10,
});

for await (const event of session.stream()) {
  console.log(event.type);
}
```

传入 `startIndex` 可以覆盖已保存 cursor：

```ts
for await (const event of session.stream({ startIndex: 0 })) {
  console.log(event.type);
}
```

如果 session 没有 `sessionId`，`stream()` 会抛错，因为第一次 send 之前还没有可连接的 stream。

## 中止请求（Abort a request）

传入 `AbortSignal` 可以取消 POST 或 stream。Abort 只是本地传输取消：turn 可跨断线恢复，断开连接**不会**停止服务端工作。要用 `session.cancel()` 停掉进行中的 turn，或用 `session.cancel({ tasks: true })` 一并停掉该 session 拥有的后台任务。取消是异步的；在流上观察 `turn.cancelled` 后跟 `session.waiting`，并在后续 turn 查看 task 状态以确认任务取消。

应该在 await `send()` 之前启动 timeout，这样 POST 和 stream 都会被覆盖：

```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

const response = await session.send({
  message: "Run a long analysis.",
  signal: controller.signal,
});

for await (const event of response) {
  console.log(event.type);
}

clearTimeout(timeout);
```

Response 被 abort 后，下一轮请创建新的 send。不要复用同一个 `MessageResponse`。

## 接下来读什么（What to read next）

- [消息（Messages）](../messages)：创建 streams 的 send APIs
- [续接（Continuations）](../continuations)：stream cursors 如何持久化
- [输出 Schema（Output schema）](../output-schema)：消费 `result.completed`
