---
title: "项目布局（Project Layout）"
description: "agent/ 下的 authored slots 与路径派生的命名规则。"
---

# 项目布局（Project Layout）

eve 通过遍历 `agent/` 下的文件系统来构建 Agent。每个目录都是一个 authored slot，文件落在哪个 slot 决定 eve 如何加载它。

## 命名规则（Naming rule）

身份来自路径。你从不在 `define*` 调用上写 `name` 或 `id` 字段。

| 路径 | 解析为 |
| --- | --- |
| `agent/tools/get_weather.ts` | tool `get_weather` |
| `agent/connections/linear.ts` | connection `linear` |
| `agent/skills/summarize.md` | skill `summarize` |
| `agent/subagents/researcher/agent.ts` | subagent `researcher` |

根 Agent 从外围 `package.json` 的 `name` 取名字，`package.json` 没有 `name` 时回退到 app-root 目录名。子智能体从它的目录取名字。

## 推荐布局（Recommended layout）

```txt
my-agent/
├── package.json
├── tsconfig.json
├── agent/
│   ├── agent.ts
│   ├── instructions.md
│   ├── instrumentation.ts
│   ├── channels/
│   ├── connections/
│   ├── hooks/
│   ├── skills/
│   ├── lib/
│   ├── sandbox/
│   ├── tools/
│   ├── schedules/
│   └── subagents/
└── evals/
```

Evals 住在 app root 的 `evals/`，是 `agent/` 的兄弟，不在它里面。见 [Evals](../evals/overview)。

## Slot 表

Subagents 列说明本地子智能体（`subagents/<id>/`）是否可以编写该 slot。声明的子智能体从根继承任何东西；它发现自己的 slots。见 [子智能体（Subagents）](../subagents)。

| 路径 | 描述 | 子智能体 | 备注 |
| --- | --- | --- | --- |
| `agent.ts` | Runtime 配置 | 是 | Model、modelOptions、compaction、build、experimental。见 [Agent config](../agent-config)。 |
| `instructions.md` / `instructions.ts` / `instructions/` | 基础 system prompt | 可选 | 一个扁平文件，或 `.md` 和 `.ts` 文件的目录。静态 sources 在构建时组合。动态 sources（`defineDynamic` + `defineInstructions`）在运行时解析。根上必填，子智能体上可选。 |
| `instrumentation.ts` | 遥测配置 | 否 | OTel exporter 和 AI SDK span 设置，自动发现并在 agent 代码之前运行。仅根。 |
| `channels/` | HTTP / 消息入口 | 否 | 仅根。 |
| `connections/` | 外部服务连接（MCP、OpenAPI） | 是 | 每文件一个 connection；名字从文件名派生。 |
| `hooks/` | 生命周期和流事件订阅者 | 是 | 仅模块支撑。支持递归目录。 |
| `skills/` | 按需流程和能力包 | 是 | 扁平 markdown、模块支撑 skills 或打包 skills。播种到 `$HOME/.agents/skills/...`，`$HOME` 不可用时 `/workspace/skills/...` 作为回退。 |
| `lib/` | 共享 authored helper 代码 | 是 | 仅导入；不挂载进 workspace。 |
| `sandbox.ts` 或 `sandbox/sandbox.ts` | Agent 的单个 sandbox | 是 | 用顶层 `sandbox.ts` 做仅定义的覆盖；用 `sandbox/sandbox.ts` + `sandbox/workspace/**` 同时播种文件。两者都未编写时应用框架默认。 |
| `sandbox/workspace/**` | 播种进 sandbox 的文件 | 是 | 在 session bootstrap 时镜像到 `/workspace/...`。 |
| `tools/` | 类型化可执行集成 | 是 | 仅模块支撑。 |
| `schedules/` | 定时任务 | 否 | 每个 schedule 是 `<name>.ts`（默认导出 `defineSchedule`）或 `<name>.md`（frontmatter `cron:` + prompt body）。支持递归嵌套。仅根。 |
| `subagents/` | 专家子 Agent | 是 | 每个子级是 `subagents/<id>/` 下自己的本地包。支持嵌套子智能体。 |

## 什么到达 runtime sandbox

eve 不挂载整棵树。Authored workspace 文件落在 sandbox workspace：

- `agent/sandbox/workspace/**` → session bootstrap 时的 `/workspace/...`

Skill 文件落在 workspace 之外，`$HOME/.agents/skills/...` 下。如果 `$HOME` 不可用，eve 回退到 `/workspace/skills/...`。打包 skill 引用（如 `references/checklist.md`）相对包含该 skill `SKILL.md` 的目录解析。

`lib/` 中的一切保持仅导入的源码，永远不进入 workspace。

## 本地子智能体布局

本地子智能体住在 `subagents/<id>/` 下，使用与根相同的 `agent.ts` 形状。

```txt
agent/subagents/researcher/
├── agent.ts
├── instructions.md
├── connections/
├── hooks/
├── skills/
├── lib/
├── sandbox/
├── tools/
└── subagents/
```

规则：

- `agent.ts` 必填。静态子智能体的定义必须声明 `description`；动态子智能体的 resolver 必须返回带 description 的定义。父级在降级的子智能体工具上读取它，决定何时委派。
- `instructions.md` / `instructions.ts` 可选（与根 Agent 不同，那里必填）。
- `connections/`、`hooks/`、`skills/`、`lib/`、`sandbox/` 和 `tools/` 都受支持，从子智能体自己的目录发现。
- 本地子智能体内不支持 `channels/` 和 `schedules/`。
- 支持嵌套子智能体。

## 扁平布局

当 app root 也是 agent root 时支持：

```txt
my-agent/
├── package.json
├── agent.ts
├── instructions.md
├── tools/
└── skills/
```

优先使用嵌套布局。它让 app root 与 authored surface 分离。

## 为什么 eve 没有发现我的文件？

运行 `eve info`。它列出发现的 surface 并打印发现诊断。然后检查文件是否落在正确的 authored slot（按上面的 slot 表），以及 root-vs-subagent 边界是否有效。eve 也会在 `.eve/` 下写出可检查的 artifacts。调试 artifacts 见 [instrumentation.ts](../guides/instrumentation)，[CLI](./cli) 参考。

## 接下来读什么（What to read next）

- [`agent.ts`](../agent-config)：根上的 runtime 配置
- [工具（Tools）](../tools)：最常见的 authored slot
- [TypeScript API](./typescript-api)：define\* helpers 和它们从哪里 import
