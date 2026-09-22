---
title: "Instrumentation"
description: "在 agent/instrumentation/ 下处理生命周期事件，并为每个目的地控制内容采集。"
url: "/observability/instrumentation"
---

# Instrumentation

官方原文：[Instrumentation](https://eve.dev/docs/observability/instrumentation)。

把生命周期 instrumentation 写成 `agent/instrumentation/` 下的文件。每个文件独立处理 eve runtime 事件；OpenTelemetry exporter 与共享 span 设置则用内置 [OpenTelemetry API](./otel)。

> 从 `eve 0.62.0` 起，目录布局取代 `agent/instrumentation.ts`。升级旧项目先读[迁移指南](./migration)。

## 添加 instrumentation

文件名就是 instrumentation slot。生命周期事件文件必须默认导出 `defineInstrumentation(...)`，要覆盖并关闭同名默认项则导出 `disableInstrumentation()`：

```text
agent/instrumentation/
  audit.ts  # 生命周期 instrumentation
```

下面的例子只记录动作耗时与结果，不需要工具参数或返回值：

```ts title="agent/instrumentation/audit.ts"
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  events: {
    "action.started": (event, ctx) => {
      ctx.state.set({ name: event.name, startedAt: Date.now() });
    },
    "action.completed": (event, ctx) => {
      const started = ctx.state.get() as
        | { name: string; startedAt: number }
        | undefined;
      if (!started) return;

      console.log({
        action: started.name,
        durationMs: Date.now() - started.startedAt,
        outcome: event.outcome,
      });
    },
  },
});
```

`ctx.state` 是按「文件 + operation」隔离的 JSON 存储。它会跨 durable suspension 保留，在终端事件后释放。

## 控制输入与输出

每个 `defineInstrumentation(...)` 文件都有独立 `tracePolicy`：决定是否接收 trace，以及事件里是否包含输入 / 输出内容。OTel destinations 另共享 `otel(...)` 声明的进程级策略。

```ts title="agent/instrumentation/audit.ts"
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  tracePolicy: ({ audience, environment }) => ({
    emit: true,
    recordInputs: audience === "public" || environment === "development",
    recordOutputs: audience === "public" || environment === "development",
  }),
  events: {
    "model.call.started": (event) => console.log("input", event.input),
    "model.call.completed": (event) => console.log("output", event.content),
  },
});
```

策略函数会收到 `agentName`、`channel`、`audience`、`mode`、`environment` 与 `principalType`。无策略（或返回 `true`）时，eve 默认发送元数据；内容默认值如下：

| 环境 | Audience | 内容 |
| --- | --- | --- |
| Development | 任意 | 输入与输出 |
| Preview / production | `public` | 输入与输出 |
| Preview / production | `private` / `unknown` | 仅元数据 |

返回 `{ emit: false }` 可不采样本 trace。返回 `{ emit: true, recordInputs, recordOutputs }` 可显式控制两个方向；被省略的内容字段对 handler 不可用。

输入包括模型 prompts、工具参数、channel 输入与用户回复；输出包括模型回复、工具结果、输入请求、provider metadata 与错误详情。Channel 创建 session 时只分类一次 audience；它控制内容捕获，**不是访问控制**。来源见 [Channels / Audience](../../channels/overview#audience)。

## 字段脱敏

Lifecycle event 是不可变快照。先把所需字段复制成目的地 payload，再修改副本：

```ts title="agent/instrumentation/audit.ts"
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  tracePolicy: () => ({ emit: true, recordInputs: true, recordOutputs: false }),
  events: {
    "action.started": async (event) => {
      await sendAuditRecord({
        id: event.idempotencyKey,
        input: redactApiKey(event.input),
        kind: event.kind,
        name: event.name,
      });
    },
  },
});

function redactApiKey(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return "apiKey" in record ? { ...record, apiKey: "[redacted]" } : record;
}

async function sendAuditRecord(record: unknown) {
  void record;
}
```

目的地不需要整个内容方向时，优先用 `recordInputs: false` / `recordOutputs: false`；只有确实要保留部分字段时才做字段级脱敏。

## 生命周期事件

Instrumentation 可处理 session、channel delivery、turn、model attempt / call、action、input request、tool call 等事件。开始与终端事件共享 `idempotencyKey`，适合作为外部记录 ID。

普通工具同时发出两组事件：

- `action.*`：eve durable dispatch 生命周期，覆盖 tools、skills、subagents 与 remote agents。
- `tool.call.*`：AI SDK 进程内工具执行边界；只有需要这个细节时才监听。

不同文件的 handlers 并发执行且故障隔离，不要依赖先后顺序。用 `flush` 排空缓冲，用 `shutdown` 释放资源。

## 接下来读什么

- [迁移 Instrumentation](./migration)：替换旧 `agent/instrumentation.ts`
- [OpenTelemetry](./otel)：配置 destinations、托管导出与 destination 级过滤
- [本地开发](../dev-tui)：在 TUI 中检查 traces
- [Hooks](../hooks)：在 instrumentation 生命周期之外响应 runtime 事件
