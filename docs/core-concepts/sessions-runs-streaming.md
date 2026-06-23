# Sessions / Runs / Streaming

## 一句话解释

Eve 的一次对话不是普通 HTTP 请求，而是一个可恢复的 durable session。

你会看到这些概念：

```txt
sessionId / runId      用来连接 stream、恢复输出、inspect 运行
continuationToken      用来继续同一个 session 的下一轮消息
stream                 Eve 的事件流输出
```

## 创建 Session

前端或后端调用：

```txt
POST /eve/v1/session
```

请求示例：

```json
{
  "message": "你好",
  "clientContext": {
    "threadId": "业务自己的 threadId",
    "workspaceId": "业务自己的 workspaceId"
  }
}
```

返回示例：

```json
{
  "ok": true,
  "sessionId": "wrun_xxx",
  "continuationToken": "eve:xxx"
}
```

## sessionId 是什么

`sessionId` 是 Eve / Workflow 运行层的 ID。

它用来：

```txt
连接 stream
刷新后恢复输出
查看运行状态
调试 inspect
```

连接 stream：

```txt
GET /eve/v1/session/:sessionId/stream
```

## continuationToken 是什么

`continuationToken` 是继续同一个 Eve session 的凭证。

第一轮结束后，如果用户继续说：

```txt
继续生成报告
```

就要把 `continuationToken` 带回去，Eve 才知道这是同一个会话的下一轮，而不是新会话。

## threadId 是什么

`threadId` 通常不是 Eve 必需的，而是你的业务系统自己的会话 ID。

推荐分工：

```txt
threadId
  业务会话 ID，存在你自己的数据库里

sessionId / runId
  Eve 运行 ID，用来连接 stream 和恢复输出

continuationToken
  Eve 续聊凭证，用来发下一轮
```

业务系统建议保存映射：

```txt
threadId
workspaceId
userId
eveSessionId
continuationToken
lastEventIndex
status
```

## Stream 是什么

Eve stream 不是简单 token 流，而是事件流。

它可能包含：

```txt
session.started
turn.started
message.received
step.started
actions.requested
action.result
message.appended
message.completed
session.waiting
session.completed
```

前端应该按事件类型渲染：

```txt
message.appended       追加模型文本
actions.requested      展示工具调用
action.result          展示工具结果摘要
session.waiting        等待用户继续输入或确认
session.completed      本次会话完成
```

## 刷新恢复

刷新恢复靠：

```txt
sessionId + lastEventIndex
```

前端刷新后，重新请求：

```txt
GET /eve/v1/session/:sessionId/stream?startIndex=上次消费到的位置
```

这样可以从指定事件位置继续接收。

## 推荐前端状态

```ts
type EveCursor = {
  threadId: string;
  sessionId: string;
  continuationToken: string;
  lastEventIndex: number;
  status: 'running' | 'waiting' | 'completed' | 'failed';
};
```

最小原则：

```txt
用户看到的是业务 thread
前端恢复 stream 用 sessionId
下一轮继续对话用 continuationToken
```

## 常见误区

### 误区一：把 threadId 当成 Eve sessionId

不是一回事。threadId 是业务系统的，sessionId 是 Eve 运行时的。

### 误区二：只保存 sessionId，不保存 continuationToken

这样可以恢复 stream，但下一轮继续会话会比较麻烦。

### 误区三：把 continuationToken 打进公开日志

不建议。它是继续会话的凭证，应当按会话级敏感信息处理。

## 官方链接

- https://eve.dev/docs/concepts/sessions-runs-and-streaming
