---
title: "Sessions、Runs 与 Streaming"
description: "ID 地址化的 session 契约：消息、控制、NDJSON 事件流与重连。"
---

# Sessions、Runs 与 Streaming

每个 eve 应用都对着一个 [durable session](./execution-model-and-durability) 说同一种稳定 HTTP API。这一页就是你持有的契约：你拿到的 handles、你流式监听的事件，以及如何重连。

## 按表面身份化（Identity by surface）

HTTP API 和 TypeScript 客户端对消息、控制和流使用同一个 durable `sessionId`。每个操作都精确作用于那个 session；没有操作隐式跟随或创建替代。

Authored channels 也有 channel 本地 continuation tokens。一个 token 寻址当前拥有某个平台对话的 session，比如 Slack 线程。那个身份留在 channel 边界之后，永远不被 eve HTTP session API 接受或返回。见 [自定义渠道（Custom channels）](../channels/custom#channel-operations-and-session-handles)。

Session 默认持续 30 天；在 `agent.ts` 中配置 `limits.sessionTimeoutMs`，或设为 `false` 禁用截止。到期时，eve 让活跃 turn settle、发出 `session.completed`，并释放 continuation，让下一条符合条件的 channel 消息从新开始。存储的 session 数据不会被删除。见 [Agent config](../agent-config#runtime-limits)。

React、Vue 和 Svelte 应用用 [`useEveAgent()`](../guides/frontend/overview) 而不是手动调用这些路由。Next.js 和 Nuxt 应用可以从同源把它们代理到 eve runtime。

## 启动 session

```sh
curl -X POST http://127.0.0.1:2000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"Summarize the latest forecast."}'
```

eve 立即在 JSON body 和 `x-eve-session-id` 头中返回 durable `sessionId`。

## 流式监听 session

```sh
curl http://127.0.0.1:2000/eve/v1/session/<sessionId>/stream
```

流是换行分隔的 JSON（NDJSON），每行一个事件：

| 事件 | 含义 |
| --- | --- |
| `session.started` | 创建了一个 durable session。 |
| `turn.started` | 一个新 turn 开始了。 |
| `message.received` | 一条入站用户消息被接受；携带扁平文本加上结构化文本/文件部分。 |
| `step.started` | 一个模型 step 开始了。 |
| `action.input.appended` | 原始工具输入文本增量、字符偏移和 tool-call 身份。 |
| `actions.requested` | 模型请求了一个或多个动作，包括工具调用；调用在执行前流式输出。 |
| `action.partial` | 一个本地执行的工具 generator 产出了初步输出快照。 |
| `action.result` | 一次工具调用返回了。 |
| `input.requested` | Run 暂停等待人类输入（[HITL](../guides/human-in-the-loop) 审批或 `ask_question`）；携带 `requests`。 |
| `subagent.called` | 委派了一个子智能体；携带要 attach 的 `childSessionId`。 |
| `subagent.completed` | 一个被委派的子智能体完成了。 |
| `reasoning.appended` | 一个推理增量（增量式，带到目前为止的累计文本）。 |
| `reasoning.completed` | 最终确定的推理块。 |
| `message.appended` | 一个 assistant 文本增量（增量式，带到目前为止的累计文本）。 |
| `message.completed` | 一个最终确定的 assistant 文本块。 |
| `result.completed` | 请求了输出 schema 的 turn 的最终结构化结果；携带 `result`。 |
| `compaction.requested` | 上下文窗口压缩开始了；携带 `modelId`、`sessionId`、`turnId`、`usageInputTokens`。 |
| `compaction.completed` | 一个压缩 checkpoint 被写入 durable history。 |
| `authorization.required` | 一个 connection 需要 OAuth；携带 `name`、`description` 和一个 `authorization` 挑战。 |
| `authorization.completed` | 一个 connection 的授权已解决；携带 `outcome`。 |
| `step.completed` | 一个模型 step 完成了；携带 `finishReason` 和 usage。 |
| `step.failed` | 一个模型 step 失败了；携带 `{ code, message, details? }`。 |
| `turn.completed` | Turn 完成了。 |
| `turn.failed` | Turn 失败了；携带 `{ code, message, details? }`。 |
| `turn.cancelled` | Turn 在完成前被取消；总是后跟 `session.waiting`。 |
| `session.waiting` | Session park 了，准备接收下一条消息。 |
| `session.failed` | Session 失败了。 |
| `session.completed` | Session 到达了终点。 |

`reasoning.appended`、`message.appended` 和 `action.input.appended` 在到达时增量流式输出。当 durable stream writer 忙时，eve 可能合并同一文本块或工具调用的相邻增量，但会保留文本和事件顺序。不同事件类型、工具 `callId` 或 stream coordinate 构成排序屏障。文本和 reasoning appends 同时携带新增量和当前块的累计文本。最终块出现在 `message.completed` 和 `reasoning.completed` 上，这是不渲染增量流式输出的客户端的兼容路径。

流式工具输入变成校验后的调用时，它的 `action.input.appended` 事件会先于匹配的 `actions.requested`。每次 append 携带 `callId`、`toolName`、`inputTextDelta` 和 `inputTextOffset`；offset 是增量开始处的零基 UTF-16 code-unit 位置。只存 delta 和 offset，避免在每个 durable event 里重复累计输入。默认 client reducer 从 offset `0` 开始或重启累积，忽略不连续的非零 offset，并把可能不完整的 JSON 投影成 `state: "input-streaming"` 的 `dynamic-tool` part，累计文本在 `inputText`。`actions.requested` 把同一 `toolCallId` 升级为 `state: "input-available"` 和校验后的 `input`。被排除的内部动作不会发布它们的输入流。

`action.partial` 携带来自 authored async-generator 工具的一次完整初步输出快照。同一 `callId` 的后续 partial 会替换它，`action.result` 是最终快照。当 durable writer 忙时，eve 可能只保留一个调用的最新相邻 partial。把 partials 当作 last-write-wins：durable step 可以重试并重放重叠的事件运行。Provider 执行的工具进度和 MCP progress 通知不会投影为 `action.partial` 事件。

注意：请考虑在你的应用中显示、存储或传输 reasoning 事件的隐私、保密性和用户体验影响。

`message.completed` 在一个 turn 里可以触发多次：Agent 经常在工具调用之前发出临时 assistant 文本。要区分工具调用叙述和最终回复，检查 `message.completed.data.finishReason`。`step.completed.data.finishReason` 镜像 step 结果，usage 在 `step.completed` 上。

被委派的子智能体在自己的 child-session stream 上发布进度。父级只发出带 `childSessionId` 的 `subagent.called`，客户端用它 attach。

`step.failed` 和 `turn.failed` 携带 `{ code, message, details? }` 对应失败片段或 turn，`session.failed` 是终端的 session 级变体。`turn.cancelled` 不是失败：被取消的 turn 结束时不带任何失败事件，`session.waiting` 随后出现，session 正常接受下一条消息——取消前 turn 流式输出的任何内容都留在流上，而 durable history 只保留已经 settle 的内容。当 turn 请求了输出 schema 时，最终载荷在 turn 边界之前作为 `data.result` 落在 `result.completed` 上。`authorization.required` 携带登录挑战（`data.authorization` 可能包含 `url`、`userCode`、`expiresAt`、`instructions`），`authorization.completed` 携带 `data.outcome`（`"authorized" | "declined" | "failed" | "timed-out"`）。

## 事件信封（The event envelope）

与 `type` 和 `data` 一起，每个事件都携带 `meta` 信封：

```json
{
  "type": "message.completed",
  "data": {
    "message": "Sunny and 72°F.",
    "finishReason": "stop",
    "sequence": 0,
    "stepIndex": 0,
    "turnId": "turn_0"
  },
  "meta": { "id": "evt_01KYJBZA88B4M9XN3RTC5FDGHJ", "at": "2026-07-27T18:04:11.912Z" }
}
```

- **`meta.id`** 唯一标识事件。它是 `evt_` 前缀的 [ULID](https://github.com/ulid/spec)：毫秒时间戳后跟随机位，所以 id 大致按时间排序。
- **`meta.at`** 是事件发出的 ISO-8601 时间。

`meta.id` 是稳定的。eve 只铸一次，在事件写入 durable stream 时，并随事件存储。从 cursor 重连、回卷到 `startIndex=0` 或重放已完成的 session，都为同一个事件返回同一个 id。

`meta.at` 一直都在；`meta.id` 在 stream 版本 20 出现。早期版本写入的事件带信封存储，但里面没有 id，所以回卷到你升级之前运行的 session 部分，会产生 `meta.id` 缺失的事件，即使类型说它总是字符串。eve 会放行这些事件而不是丢弃，它们无法去重。暴露在你升级之前的 session 结束时终止。

这让它成为把流摄入数据库而不在重读时重复行的关键：

```sql
insert into agent_events (id, session_id, type, data, emitted_at)
values ($1, $2, $3, $4, $5)
on conflict (id) do nothing;
```

因为 id 以时间戳开头，`primary key (id)` 大致保持 append 顺序，让插入保持聚簇。

**id 覆盖什么。** 重连不是同一个事件到达你两次的唯一方式。在所有这些情况下，以 `meta.id` 为键让摄入正确：

- Turn 中途重连并重叠你已经处理过的事件。
- 用 `startIndex=0` 回卷，或用负 `startIndex` 从尾部读回。
- 恢复与活跃流重放的前缀重叠的已保存事件日志。

**它不覆盖什么：重试的 step 会在新 ids 下重新发出。** eve 每个 durable step 最多运行四次。如果一个 step 中途被打断——崩溃、超时、它重试过去的模型错误——它已经写入的任何内容都留在流上，新尝试以它自己的 ids 发出自己的事件。两次尝试携带相同的 `turnId`、`stepIndex` 和 `sequence`，因为重试从 step 的输入恢复那个状态，但它们是不同的事件，没有字段记录哪次尝试完成。

重放*已完成*的 step 是另一回事，什么都不发出：eve 从 journal 提供记录的结果，不重跑 body。崩溃恢复、重新部署和恢复 parked turn 因此不会给流增加任何东西。只有被打断的 step 会重跑。

还有三件要知道的事：

- **Id 按时间排序，但不是全序。** 一个 session 的 turn steps 可以在不同进程里运行，各自用自己的时钟和随机位生成 id。不同 step 在同一毫秒发出的两个事件可能以任意顺序排序，机器之间的时钟偏移可以反转邻居。当你需要精确顺序分页时，记录你自己的摄入顺序，或按顺序读流并存储索引——不要用 `where id > $cursor` 作为无损 cursor。流本身是权威的：`startIndex` 是绝对事件计数。
- **Id 标识事件，不是意图。** 两个负载完全相同的事件——`step.failed` → `turn.failed` → `session.failed` 级联，或一个 step 里两个相同的文本增量——是带不同 id 的不同事件。只在 `meta.id` 上去重；按内容匹配会丢真实数据。
- **子智能体的事件是重新发出的，不是共享的。** 当父级把子级的事件转发到自己流上时，父级的副本是带自己 id 的独立事件。通过 `subagent.called.data.childSessionId` 关联两条流。

Authored [hooks](../guides/hooks) 接收同一个信封，但按发出时而不是读取时观察每个事件——所以 hook 把重试看成新事件，`meta.id` 是存储行的键而不是重试守卫。hook 不需要防御两件事：为人类输入 park 的 turn 恢复时不重新发出任何它已发送的内容，重试的 turn dispatch 无法双流一个 turn，因为只有一个 turn run 能认领 session 的 turn inbox。

## 发送后续消息

一旦 session 在等待（你会看到 `session.waiting`），把后续消息 POST 到它的 ID 地址化消息端点：

```sh
curl -X POST http://127.0.0.1:2000/eve/v1/session/<sessionId> \
  -H 'content-type: application/json' \
  -d '{"message":"Now send the short version."}'
```

后续消息复用同一个 durable session：同样的 history、同样的 state。消息发送默认基于取消的 `"steer"`；如果 turn 活跃，eve 缓冲后续消息、取消那个 turn，并在新 turn ID 下启动消息。当活跃工作应该先完成时，Channels 和 TypeScript `Session.send(...)` 调用可以选择 `turnPolicy: "queue"`。结构化 `inputResponses` 从不 steer。

如果一个挂起的批次在等待 human-in-the-loop 审批，匹配的文本回复（如 `approve` 或 `cancel`）会回答它。无关文本立即启动普通 turn，不会拒绝工具调用；审批保持挂起且可回答。之后按它的 `requestId` 键控的结构化 `inputResponses` 答案仍然恢复原始工具调用，即使中间有 turn。

对只有一个提问的批次，精确选项匹配或允许的自由文本回复会回答 `ask_question`。任何其他后续消息都会把问题标记为未回答并启动新 turn。当几个审批或提问批次挂起时，eve 不会猜测纯文本寻址哪个批次：消息启动普通 turn，批次保持打开。用结构化响应无歧义地定向请求。

结构化响应按 ID 匹配任何当前挂起的请求，不只是最新批次。它只在那个请求被回答、清除或取消后才过期。eve 把过期的响应作为新用户消息投递给模型，模型决定旧的选项是否仍然重要。过期的审批绝不会授权更早的工具调用；如果仍然需要，模型必须再次请求动作和审批。

一次投递可以回答几个批次的请求。eve 按 durable 顺序恢复带审批的批次，并携带后来的答案前进，直到每个批次都能恢复。

多条替代消息保留它们 durable 的到达顺序，并且当它们在取消 settle 之前到达时可能被折叠进同一个替代 turn。当前 runtime 契约见 [message delivery and steering](./execution-model-and-durability#message-delivery-and-steering)。

## 取消进行中的 turn

POST 到 session 的 cancel 端点以停止当前运行的 turn。Body 可选；传 `turnId`（盖在每 个 turn-scoped 流事件上）把取消范围限定到你观察到的 turn：

```sh
curl -X POST http://127.0.0.1:2000/eve/v1/session/<sessionId>/cancel
# {"ok":true,"sessionId":"<sessionId>","status":"accepted"}
```

`"accepted"` 表示活跃 session 已 durable 排队该请求。在流上以 `turn.cancelled` 后跟 `session.waiting` 确认实际取消；session 随后正常接受下一条消息。如果 turn 在等待活跃的本地或远程子智能体，eve 也会在让父级 settle 之前递归请求取消每个被收养的子级。每个子级在自己的 child-session stream 上报告自己的取消边界；父级不会为被取消的工作发出 `subagent.completed`。活跃但已 park 的 session 也返回 `"accepted"` 并把命令当作 no-op 消费。`"no_active_turn"` 表示 session 或 channel 地址未知或已终结。两种状态都是成功，所以客户端可以 fire and forget。完整路由契约见 [eve channel](../channels/eve)。

HTTP 路由对 `"accepted"` 返回 `202`，对 `"no_active_turn"` 返回 `200`。只有 accepted 结果包含 `sessionId`。

自定义渠道路由通过 `from(address).cancel()` 或 `attachSession(sessionId).cancel()` 请求同样的取消。见 [自定义渠道（custom channels）](../channels/custom#channel-operations-and-session-handles)。

## Compact、clear 和 reset

所有 session 控制都是 ID 地址化的，不接受 continuation token：

```sh
curl -X POST http://127.0.0.1:2000/eve/v1/session/<sessionId>/compact
curl -X POST http://127.0.0.1:2000/eve/v1/session/<sessionId>/clear
curl -X POST http://127.0.0.1:2000/eve/v1/session/<sessionId>/reset \
  -H 'content-type: application/json' \
  -d '{"reason":"Start over"}'
```

Compaction 摘要上下文，clear 就地移除模型消息历史，reset 终结性退役 session。重置的 ID 永远不会成为新 session；要全新对话，显式创建另一个 session。

## 重连与回卷（Reconnect and rewind）

流是 durable 的。每个事件在 step 完成前被记录，所以消费者可以在 HTTP 连接结束时从自己的 cursor 重连。非负 `startIndex` 是绝对事件计数：用它从你中断的地方继续，或传 `0` 回卷到开头。

如果重连重叠了你已处理的事件，[`meta.id`](#the-event-envelope) 标识重复项：它跨重连和回卷不变，所以以它为键的消费者可以安全重放。

```sh
curl "http://127.0.0.1:2000/eve/v1/session/<sessionId>/stream?startIndex=<count>"
```

负 `startIndex` 相对流的当前尾部读取。例如 `-1` 读取最新事件，对可恢复 session 通常是 `session.waiting`：

```sh
curl "http://127.0.0.1:2000/eve/v1/session/<sessionId>/stream?startIndex=-1"
```

因为尾部相对位置不解析为绝对已消费事件计数，客户端尾部读取不会自动重连或推进存储的 cursor。

要一次 catch-up 读取而不是跟随活跃流，传 `includeTailIndex=1`。响应随后携带 `x-eve-stream-tail-index` 头：最后一条 durable 记录事件的零基索引，或第一条之前的 `-1`。从你的 cursor 读直到超过那个尾部，然后断开——如果连接先断开，从更新后的 cursor 重连：

```sh
curl -i "http://127.0.0.1:2000/eve/v1/session/<sessionId>/stream?startIndex=<count>&includeTailIndex=1"
# x-eve-stream-tail-index: <tail>
```

查找是 opt-in；不带参数请求不会得到头。TypeScript 客户端把它包装成 `stream({ follow: false })`。

## 从 TypeScript 使用客户端

对脚本、服务端到服务端调用、测试、evals 和自定义 UI，`eve/client` 把这些路由包装成类型化客户端，所以你不用手写 POST 和 NDJSON 流循环。

从 [TypeScript SDK](../guides/client/overview) 指南开始。它覆盖基本用法、发送消息、session state、流式输出和每个 turn 的 `outputSchema` 结果。

## 通过 HTTP 检查 Agent

`GET /eve/v1/info` 返回运行中 Agent 的 JSON 检查快照：model、instructions、authored 和框架工具、skills、channels、schedules、subagents、sandbox、connections、hooks、workflow 和 workspace 元数据。当 `agent/channels/eve.ts` 写了路由 auth 时它使用解析后的 `eveChannel()` 路由 auth；否则回退到 Vercel OIDC 加本地开发访问的框架默认。

```sh
curl http://127.0.0.1:2000/eve/v1/info
```

默认 auth 链（`[vercelOidc(), localDev(), placeholderAuth()]`）下，Vercel OIDC bearer 优先，`eve dev` 或 `vercel dev` server 认证本地请求，其他一切被拒绝。已部署的 Vercel 目标需要有效的 OIDC bearer，同项目调用者有绕过机制。见 [鉴权与路由保护（auth & route protection）](../guides/auth-and-route-protection)。

## Dispatch 顺序

每个流事件按此顺序运行四步：

1. **Channel handler**：channel 的事件 handler 运行，可以变更 adapter state。
2. **Metadata 投影**：框架重新求值 channel 的 `metadata(state)` 并存储结果。
3. **Hooks**：订阅该事件的 authored [hooks](../guides/hooks) 触发。
4. **Dynamic resolvers**：[dynamic](../guides/dynamic-capabilities) tool、skill 和 instruction resolvers 触发，`ctx.channel.metadata` 已经持有第 2 步新鲜投影的 metadata。

顺序是结构性的，不是偶然的。到 resolver 或 hook 读取 channel metadata 时，channel 已经更新了它的 state，投影是最新的。

## 接下来读什么（What to read next）

- [执行模型与持久性（Execution model & durability）](./execution-model-and-durability)：什么让 session durable，parked work 如何恢复。
- [Channels](../channels/overview)：平台地址如何映射到 durable sessions。
- [TypeScript SDK](../guides/client/overview)：从脚本和服务端代码调用这些路由。
- [前端（Frontend）](../guides/frontend/overview)：`useEveAgent` 而不是裸路由。
