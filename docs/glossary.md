# Eve 术语表

## Eve

Vercel 推出的 filesystem-first durable AI agents 框架。它用 `agent/` 目录组织 Agent 能力，并结合 AI SDK、Workflow SDK、Sandbox、Channels、Skills、Tools 等机制。

## filesystem-first

以文件系统为第一入口。文件放在哪个约定目录里，就决定它是什么能力。

例如：

```txt
agent/instructions.md       主 Agent 指令
agent/tools/search.ts       工具 search
agent/skills/foo/SKILL.md   Skill foo
agent/subagents/bar/        子 Agent bar
```

## instructions

Agent 永远携带的常驻系统提示词，通常写在 `agent/instructions.md`。

适合写身份、长期规则、安全边界、输出风格。不适合写很长的业务流程。

## tool

模型可以调用的结构化动作。通常放在 `agent/tools/*.ts`。

工具应尽量薄封装，真实业务逻辑交给后端 service。

## skill

按需加载的流程说明。通常放在 `agent/skills/<name>/SKILL.md`。

Skill 不增加执行能力，只给模型补充过程性说明。真正执行动作仍靠 tools。

## subagent

子 Agent。用于把某类任务委派给专门的 Agent，例如风险审查、报告写作、知识库检索。

## channel

Agent 的入口。HTTP、Slack、Discord、schedule、subagent 都可以是 channel。

## session

Eve 中一次可持续的 Agent 会话。它可以跨 turn、跨刷新、跨恢复继续。

## run / workflow run

Workflow 层的一次运行。Eve 的 session、turn、subagent 调用背后都可能对应 workflow run。

## continuationToken

继续同一个 Eve session 的凭证。下一轮用户消息需要带它，Eve 才知道不是新会话。

## sessionId / runId

Eve 返回的运行 ID。常用于连接 stream、恢复输出、inspect 运行。

## stream

Eve 的流式事件输出。它不是普通 token 流，而是事件流，可能包含 message、reasoning、tool call、tool result、waiting、completed 等事件。

## Workflow SDK

给 TypeScript 异步流程提供持久化执行能力的 SDK。核心思想是 workflow + step + event log + replay。

## World

Workflow SDK 的底层存储和队列抽象。

常见 World：

```txt
Local World       本地开发
Postgres World    自部署生产
Vercel World      Vercel 托管
```

## Sandbox

Agent 的隔离工作区。用于执行 bash、读写临时文件、运行脚本。自部署第一阶段建议 Docker sandbox + deny-all 网络。

## instrumentation

可观测性配置。通常写在 `agent/instrumentation.ts`，用于把模型调用、工具调用、token、耗时等信息发送到 OpenTelemetry 后端。

## evals

Agent 的自动化测试。放在 `evals/*.eval.ts`，用于测试 Agent 是否调用正确工具、是否完成任务、回复是否符合预期。

## Hono

轻量 Web API 框架。它负责 HTTP 路由、鉴权、中间件和业务 API。可以和 Eve 共存。

## Nitro

服务端构建和运行框架。Workflow/Eve 可能使用 Nitro 承载服务端运行和构建，不代表前端必须 SSR。

## AI SDK

Vercel 的模型调用 SDK。负责统一模型 provider、streamText、tool calling、UIMessage 等能力。Eve 的模型调用层基于 AI SDK 的 LanguageModel 抽象。
