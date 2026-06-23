# Instrumentation

## 一句话解释

Instrumentation 是 Eve 的可观测性配置。

它通常写在：

```txt
agent/instrumentation.ts
```

用于记录 Agent 每一轮运行里的模型调用、工具调用、token、耗时、错误和上下文属性。

## 它解决什么问题

没有 instrumentation，你通常只知道：

```txt
用户问了什么
Agent 最后回答了什么
```

有了 instrumentation，可以看到：

```txt
这次 Agent 跑了几步
调用了哪个模型
调用了哪些工具
哪个工具最慢
token 消耗多少
为什么卡在 session.waiting
哪一步报错
```

## 三类可观测数据

Eve 的可观测性大致有三类：

```txt
Workflow run tags
OpenTelemetry export
Runtime context events
```

### Workflow run tags

Eve 自动给 Workflow run 打标签，例如：

```txt
$eve.type
$eve.parent
$eve.root
$eve.model
$eve.input_tokens
$eve.output_tokens
$eve.tool_count
```

这些标签由框架自动产生，通常用于 dashboard 拼出 session、turn、subagent 的运行树。

### OpenTelemetry export

OpenTelemetry 是通用可观测性标准。

你可以把 Eve 的 trace 发到：

```txt
Braintrust
Honeycomb
Datadog
Jaeger
Grafana Tempo
OpenTelemetry Collector
```

### Runtime context events

你可以在每次模型调用前，把业务字段附加到 trace 上，例如：

```txt
workspaceId
threadId
userId
channel
assistantId
```

## 最小配置

生产环境建议先关闭完整输入输出记录：

```ts
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  recordInputs: false,
  recordOutputs: false,
});
```

## 为什么要关闭 recordInputs / recordOutputs

默认记录完整输入输出可能会把敏感内容送到观测平台：

```txt
用户原始问题
线索正文
身份信息
工具结果
报告正文
模型输出
```

如果是业务系统、内网系统或敏感数据系统，建议默认：

```txt
recordInputs: false
recordOutputs: false
```

需要调试时，可以在脱敏测试环境临时开启。

## 加业务上下文

```ts
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  recordInputs: false,
  recordOutputs: false,

  events: {
    "step.started"(input) {
      return {
        runtimeContext: {
          "app.session_id": input.session.id,
          "app.turn_id": input.turn.id,
          "app.step_index": input.step.index,
          "app.channel_kind": input.channel.kind,
        },
      };
    },
  },
});
```

## 接 OTel Collector

```ts
import { defineInstrumentation } from "eve/instrumentation";
import { registerOTel } from "@vercel/otel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export default defineInstrumentation({
  recordInputs: false,
  recordOutputs: false,

  setup: ({ agentName }) =>
    registerOTel({
      serviceName: agentName,
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
      }),
    }),
});
```

## 和 hooks 的区别

```txt
instrumentation
  给监控系统看
  记录 trace、span、token、耗时、错误

hooks
  给业务逻辑用
  可用于审计、持久化、前端事件转发
```

不要把业务写入放进 instrumentation。

## 常见误区

### 误区一：Instrumentation 是必须的

不是。没有它 Eve 也能跑。它是观测和调试增强。

### 误区二：把生产输入输出全部记录到第三方

敏感系统不建议这么做。

### 误区三：用 instrumentation 保存业务消息

不建议。保存 chat message、审计日志应由 hooks、工具或后端 service 负责。

## 官方链接

- https://eve.dev/docs/guides/instrumentation
