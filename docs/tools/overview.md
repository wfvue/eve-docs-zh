---
title: "Tools"
description: "定义 Agent 可以调用的类型化动作，并用人工审批保护敏感动作；支持后台任务与 durable workflow 工具。"
---

# Tools：工具

Tool 是 Agent 可以调用的类型化动作，例如调用 API、查询数据库或写入文件。动作保留在你控制的代码里，模型只看到名称、说明和输入 schema。Authored tools 在应用 runtime 运行，可访问 `process.env`，不在 [sandbox](../sandbox) 里。

官方原文：[Tools](https://eve.dev/docs/tools)。

## 基本结构

`agent/tools/get_weather.ts` 会暴露为 `get_weather`。一个 tool 需要：

- 文件名：决定模型可见名称。
- `description`：告诉模型什么时候该用它。
- `inputSchema`：定义输入参数（Zod / Standard Schema / 纯 JSON Schema）。
- `execute`：真正执行动作的函数（可 sync / async / async generator）。

```ts
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string().min(1) }),
  async execute({ city }) {
    return { city, condition: "Sunny" };
  },
});
```

返回结构化数据时可加可选 `outputSchema`。

### 流式初步结果

Async generator 可在完成前 `yield` 完整输出快照；每次 `yield` 替换上一份；最终 yield 是模型看到的 tool result。更早的 yield 作为 `action.partial` 发给 channels / hooks / clients，**不进**模型历史。

### 后台执行

后台执行决定结果如何交回父 Agent；durable 挂起决定 executor 能否在 workflow wait 处暂停并释放计算。二者独立：

| 定义 | `execute` 内 durable 等待 | 交给模型的结果 |
| --- | --- | --- |
| `defineTool` | 否；在发起 step 内跑完 | executor 结束后的输出 |
| `defineTool` + `execution: "background"` | 否；发起 step 仍等 executor | 先 task receipt，再 task notifications |
| `defineWorkflowTool` | 是；工具 call 等待时可挂起 | workflow 结束后的输出 |
| `defineWorkflowTool` + `execution: "background"` | 是；body 可长于发起 step | 先 receipt，再 notifications |

后台工具收到第三个 `task` 参数。工具结果是 receipt `{ status: "working", taskId }`；最终输出属于该 task。`outputSchema` / `toModelOutput` 描述的是固定 receipt。

`task.delegated()` **已移除**。把外部工作放进 `defineWorkflowTool` executor，结束后再返回结果。迁移后请重建仍引用旧 API 的 extensions。

`yield task.postMessage(message)` 是唯一会请求父 Agent 再开一轮 turn 的 yield。调用 `task.postMessage` 只构造描述符，必须 `yield` 才会发送。workflow body 里，等待之后还要用的值放在局部变量中（replay 会重建）。需要人回答时用 [`ctx.ask`](./workflows#ask-a-human-ctxask)。后台工具是常规执行模式，**不需要**根 Agent 实验开关。内置 / 声明式本地 / 远程子智能体自动走这套任务生命周期。

发起 turn 接受后台任务后，eve 会让模型确认工作已开始、不必等结果。[Schedule](../schedules) 发起的 turn 是例外：没有人提示它们，所以启动保持条件投递且不发 acknowledgement。

### Yield 与 return

`yield` 把值交给 eve 的 generator consumer；它本身**不会**创建对人 / 定时器 / 外部事件的 durable 等待。含义取决于执行模式：

| Executor | 普通 `yield value` | 最终输出 |
| --- | --- | --- |
| `defineTool` 默认 | 更早的值是 `action.partial` 快照；最后一次 yield 成 tool result | 最后一次 yield；generator `return` 被忽略 |
| `defineWorkflowTool` 默认 | 每次 yield 都是 `action.partial` | 显式 return；若 return 为 `null`/`undefined` 则回退到最后一次 yield，再否则 `null` |
| 任一 + `execution: "background"` | 仅流式任务进度，**不**请求父 turn | 显式 return 成为 task 输出；无 return 则以 `null` 完成；最后一次 yield **不是**回退 |

后台工具上，`yield task.postMessage(message)` 在任务仍开放时向父 Agent 发消息。`return` 完成任务；`throw` 使任务失败。进度快照不进模型历史作为中间 tool result。

### Workflows as tools（工作流工具）

用 `eve/tools` 的 `defineWorkflowTool`，且 executor 以 `"use workflow"` 开头，每次调用作为 durable Workflow run。可等人、webhook、定时器而不占计算，再把结果交回模型。详见 [Workflows as Tools](./workflows)。

## 工具抛错时

`execute` 抛错时，eve 记录失败的 `action.result`，并把错误交给模型。模型可以换动作或再调。eve **不会**按异常类型 / HTTP status / `retryable` 自动重试。非幂等写操作请用幂等键、应用层去重，或人审闸门——见 [执行模型与持久性](../concepts/execution-model-and-durability)。

## 审批和输出

敏感动作可配置 `approval`（`eve/tools/approval` 的 `always` / `once` / `never` 等）。详见 [人在环中](./human-in-the-loop)。

默认模型看到完整 `execute` 返回。可用 `toModelOutput` 只给模型摘要，channels / hooks 仍拿完整 `action.result`。图像等可用 `toolOutput` / `toolOutputPart` 构造 content parts（base64，注意体积与 compaction）。

## 项目建议

不要把正式业务逻辑全写在 tool 文件里。推荐让 tool 做薄封装，把权限、幂等、审计、事务和错误处理放在后端 service 中。

## 接下来读什么

- [人在环中](./human-in-the-loop)
- [Workflows as Tools](./workflows)
- [内置工具](../concepts/built-in-tools)
- [动态能力](../guides/dynamic-capabilities)
