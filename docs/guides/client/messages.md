---
title: "消息（Messages）"
description: "使用 eve/client 发送文本、完整 turn payload、client context、附件和 HITL responses。"
---

# 消息（Messages）

`ClientSession` 一次发送一个 turn。新的 session 会在第一次发送时启动；只要上一个 turn 让 session 处于 waiting 状态，后续发送就会继续同一段对话。

## 发送文本（Send text）

给 `send()` 传字符串即可发送纯文本：

```ts
import { Client } from "eve/client";

const client = new Client({ host: "http://127.0.0.1:3000" });
const session = client.session();

const response = await session.send("What is the weather in Brooklyn?");

console.log(response.sessionId, response.continuationToken);

const result = await response.result();
console.log(result.status, result.message);
```

`response.result()` 会消费 event stream，并返回 `MessageResult`：

| Field | Meaning |
| --- | --- |
| `message` | 当前 turn 最终 assistant text。 |
| `status` | `"waiting"`、`"completed"` 或 `"failed"`。 |
| `events` | 当前 turn 中观察到的全部 stream events。 |
| `sessionId` | 用于 streaming 和 inspection 的 session ID。 |
| `data` | 当前 turn 请求了 [output schema](../output-schema) 时的结构化输出。 |

如果 stream 中包含 `session.failed`，turn 会返回 `status: "failed"`，而不是抛错。Transport 和 route errors 会抛 `ClientError`。

## 发送完整 turn payload（Send a full turn payload）

当需要的不只是纯文本时，可以给 `send()` 传对象：

```ts
const response = await session.send({
  message: "What should I do on this screen?",
  clientContext: {
    route: "/billing",
    plan: "pro",
    seatsUsed: 4,
  },
});

await response.result();
```

`clientContext` 是只作用于下一次 model call 的 one-turn context。字符串会变成 user-role context message，字符串数组会变成多条 context messages，对象会 JSON 序列化成一条 context message。它不会持久化到 durable session history，也不会单独 dispatch turn。

## 发送附件（Send attachments）

`send()` 接受 AI SDK `UserContent`，所以一条 message 可以混合 text 和 file parts：

```ts
const response = await session.send({
  message: [
    { type: "text", text: "Summarize this report." },
    {
      type: "file",
      data: reportDataUrl,
      mediaType: "application/pdf",
      filename: "report.pdf",
    },
  ],
});

await response.result();
```

本地文件需要先读成 base64 `data:` URL：

```ts
import { readFile } from "node:fs/promises";

const bytes = await readFile("report.pdf");
const reportDataUrl = `data:application/pdf;base64,${bytes.toString("base64")}`;
```

## 回答 human input requests（Answer human input requests）

工具可以暂停等待审批，也可以向用户提问。Stream 会发出 `input.requested`，其中包含一个或多个 requests。通过同一个 session 发送 `inputResponses` 来回答：

```ts
import type { InputRequest } from "eve/client";

let pendingRequests: readonly InputRequest[] = [];

const response = await session.send("Run the deployment checks.");

for await (const event of response) {
  if (event.type === "input.requested") {
    pendingRequests = event.data.requests;
  }
}

const resumed = await session.send({
  inputResponses: pendingRequests.map((request) => ({
    requestId: request.requestId,
    optionId: "approve",
  })),
});

await resumed.result();
```

当 resumed turn 同时需要 human answer 和 follow-up text 时，可以把 `message`、`inputResponses` 和 `clientContext` 一起发送。

## Single-use responses（Single-use responses）

`MessageResponse` 只能消费一次。你可以聚合它：

```ts
const result = await response.result();
```

也可以流式迭代它：

```ts
for await (const event of response) {
  console.log(event.type);
}
```

不要对同一个 response 同时做两件事。Stream 一旦被消费，`ClientSession` 会推进自己的 cursor，用于下一个 turn。

## 接下来读什么（What to read next）

- [续接（Continuations）](../continuations)：session cursor 如何推进
- [流式输出（Streaming）](../streaming)：不用 `result()`，实时处理 events
- [工具（Tools）](../../../tools)：配置 approvals 和 question prompts
