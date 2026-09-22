---
title: "Agent Files"
description: "查阅 Agent 目录槽位、路径派生命名、子智能体文件与文件系统发现规则。"
---

# Agent Files

官方原文：[Agent Files](https://eve.dev/docs/reference/agent-files)。

eve 从 Agent 目录下的文件构建 Agent。每个受支持路径决定 eve 如何加载该文件。推荐项目布局、何时拆分 Agent，见[项目结构](/docs/concepts/project-structure)。

> 项目建议：中文站仍保留实践页 [项目布局（Project Layout）](./project-layout)，侧重中文补充与历史对照；官方 live 槽位表以本页为准。

## Agent 目录布局

单 Agent 项目里，Agent 目录是 `agent/`。在 eve agent workspace 中，每个成员有 `agents/<name>/agent/`。最小根 Agent 需要 instructions 源；默认配置够用时 `agent.ts` 可选。

```text
agent/
├── agent.ts
├── instructions.md
├── instrumentation/
├── channels/
├── connections/
├── extensions/
├── hooks/
├── skills/
├── lib/
├── memory/
├── sandbox/
├── tools/
├── schedules/
└── subagents/
```

只添加需要的文件。框架默认占用同一批槽位，同路径文件会在编译时替换默认。Evals 放在 `agent/` **旁边**，不要放进 `agent/` 里。

## 从路径命名

eve 从文件路径派生能力名：

| 路径 | 解析为 |
| --- | --- |
| `agent/tools/get_weather.ts` | tool `get_weather` |
| `agent/connections/linear.ts` | connection `linear` |
| `agent/skills/summarize.md` | skill `summarize` |
| `agent/subagents/researcher/agent.ts` | subagent `researcher` |

独立根 Agent 使用其 package 名（去掉 npm scope）；未设 name 时用 app 目录名。eve workspace 成员用 `agents/` 下的目录名。本地子智能体用 `subagents/` 下的目录名。

## Agent 文件与目录

下表路径相对 Agent 目录。根 Agent 可用全部路径；子智能体仅可用标 **Yes** 的路径。

| 路径 | 用途 | 子智能体可用 | 说明 |
| --- | --- | --- | --- |
| `agent.ts` | 运行时配置 | Yes | 模型、model options、compaction、build、experimental。见 [Agents](/docs/agent-config)。 |
| `instructions.md` / `instructions.ts` / `instructions/` | 基础系统提示 | Yes | 扁平文件或 `.md` / `.ts` 目录。根上必填，子智能体可选。见 [Instructions](/docs/instructions)。 |
| `instrumentation/` | 遥测 providers 与 destinations | No | 每个文件一个按路径命名的 provider。见 [Instrumentation](/docs/observability/instrumentation)。 |
| `channels/` | HTTP 与消息入口 | No | 见 [Channels](/docs/channels/overview)。 |
| `connections/` | 外部 MCP / OpenAPI | Yes | 静态文件定义路径命名连接；动态源可按调用方解析。 |
| `extensions/` | 挂载的可复用能力 | Yes | 文件或目录挂载。见 [Extensions](/docs/extensions)。 |
| `hooks/` | 生命周期与流事件订阅 | Yes | 仅模块支撑；支持递归目录。 |
| `skills/` | 按需流程与能力包 | Yes | 扁平 Markdown、模块 skill 或打包 skill。 |
| `lib/` | 共享 authored helper | Yes | 仅 import；不会复制进 sandbox。 |
| `memory.ts` 或 `memory/<name>.ts` | 跨 session 记忆 | Yes | Provider 支撑槽位。见 [Memory](/docs/memory)。 |
| `sandbox.ts` 或 `sandbox/sandbox.ts` | Agent 的 sandbox | Yes | 两者都未编写时用框架默认。 |
| `sandbox/workspace/**` | 播种进 sandbox 的文件 | Yes | session 开始时镜像到 `/workspace/`。 |
| `tools/` | 类型化可执行集成 | Yes | 仅模块支撑。 |
| `schedules/` | 周期任务 | No | `defineSchedule` 模块或带 `cron` frontmatter 的 Markdown；支持递归嵌套。 |
| `subagents/` | 专家子智能体 | Yes | 本地目录或远程 Agent 定义；支持嵌套子智能体。 |

## Sandbox 里可用的文件

Agent 源码不会自动出现在 shell 命令里。要复制进 sandbox `/workspace/` 的文件放在 `agent/sandbox/workspace/`。Skill 运行时文件另行播种到 `$HOME/.agents/skills/`，并以 `/workspace/skills/` 为回退。见 [Sandboxes](/docs/sandbox) 与 [Skills](/docs/skills)。

## 本地子智能体

本地声明式子智能体位于 `agent/subagents/<name>/`：

```text
agent/subagents/researcher/
├── agent.ts                # 必填；须含 description
├── instructions.md         # 可选
├── tools/
└── subagents/
```

与根一样用 `defineAgent`，并支持上表标 **Yes** 的槽位。Channels、schedules、instrumentation 仅根可用。声明式子智能体不继承父级 authored 槽位；默认与隔离见 [Subagents](/docs/subagents#the-isolation-boundary)。

## 扁平布局

eve 也支持把 Agent 文件直接放在 app 根下（没有 `agent/` 目录）：

```text
my-agent/
├── package.json
├── agent.ts
├── instructions.md
├── tools/
└── skills/
```

Workspace 成员也可把扁平 Agent 文件直接放在 `agents/<name>/`。更推荐[项目结构](/docs/concepts/project-structure)里的嵌套布局，以便把应用文件与 Agent 定义分开。

## 调试文件发现

在 Agent 的 app 目录跑 `eve info`，或在 eve workspace 根跑 `eve info --agent <name>`。它会列出已发现文件与诊断信息。eve 还会在 `.eve/` 下写入可检查产物；见 [CLI 参考](/docs/reference/cli#eve-info)。

Workspace 发现只包含直接子目录 `agents/<name>/`：有 Agent 文件且**没有**自己的 `package.json`。根级 `agent/` 优先于 `agents/`，使项目变为单 Agent。如何转换布局见[添加第二个根 Agent](/docs/concepts/project-structure#add-a-second-root-agent)。
