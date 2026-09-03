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

`defineTool({ execution: "background" })` 会收到第三个 `task` 参数。返回普通值即完成 durable task；返回 `task.delegated({ executor, receipt })` 则立刻给出 `working` receipt，由外部 executor 继续。后台工具是常规执行模式，**不再**要求根 Agent 开实验开关才能作为执行模式存在（与旧中文稿「必须 `experimental.tasks`」的表述相比：subagents / 部分后台能力仍可能依赖任务基建，以官方当前页为准）。

内置、声明式本地与远程子智能体自动使用这套 background task 生命周期。进程内 executor 用 `task.send({ kind: "update" | "complete" | ... })` 报告进度与终态。跨进程 executor 线仍由框架拥有，尚非稳定 authored-tool API。

发起 turn 接受后台任务后，eve 会让模型确认工作已开始、不必等结果。[Schedule](../schedules) 发起的 turn 是例外：没有人提示它们，所以启动保持条件投递且不发 acknowledgement。

### Durable tools

`execute` 以 `"use workflow"` 开头时，工具作为 durable Workflow run 运行，而不是卡在模型 step 里。可等待人、webhook 或定时器；返回值仍结算该 tool call。详见 [Durable Tools](./workflows)。

## 工具抛错时

`execute` 抛错时，eve 记录失败的 `action.result`，并把错误交给模型。模型可以换动作或再调。eve **不会**按异常类型 / HTTP status / `retryable` 自动重试。非幂等写操作请用幂等键、应用层去重，或人审闸门——见 [执行模型与持久性](../concepts/execution-model-and-durability)。

## 审批和输出

敏感动作可配置 `approval`（`eve/tools/approval` 的 `always` / `once` / `never` 等）。详见 [人在环中](./human-in-the-loop)。

默认模型看到完整 `execute` 返回。可用 `toModelOutput` 只给模型摘要，channels / hooks 仍拿完整 `action.result`。图像等可用 `toolOutput` / `toolOutputPart` 构造 content parts（base64，注意体积与 compaction）。

## 项目建议

不要把正式业务逻辑全写在 tool 文件里。推荐让 tool 做薄封装，把权限、幂等、审计、事务和错误处理放在后端 service 中。

## 接下来读什么

- [人在环中](./human-in-the-loop)
- [Durable Tools](./workflows)
- [内置工具](../concepts/built-in-tools)
- [动态能力](../guides/dynamic-capabilities)
