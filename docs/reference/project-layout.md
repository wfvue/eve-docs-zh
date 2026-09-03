---
title: "项目布局（Project Layout）"
description: "agent/ 下的 authored slots 与路径派生的命名规则。"
---

# 项目布局（Project Layout）

eve 通过遍历 `agent/` 下的文件系统来构建 Agent。每个目录都是一个 authored slot，文件落在哪个 slot 决定 eve 如何加载它。

> 官方 live 站点目前把这份内容并进 [Getting Started](https://eve.dev/docs/getting-started)。中文站保留独立参考页。`memory/` 和 `extensions/` 来自官方 [Memory](https://eve.dev/docs/memory) 和 [Extensions](https://eve.dev/docs/extensions) 页面；官方 Getting Started 的推荐布局表暂未列出这两行。

## 命名规则（Naming rule）

身份来自路径。你从不在 `define*` 调用上写 `name` 或 `id` 字段。

| 路径 | 解析为 |
| --- | --- |
| `agent/tools/get_weather.ts` | tool `get_weather` |
| `agent/connections/linear.ts` | connection `linear` |
| `agent/skills/summarize.md` | skill `summarize` |
| `agent/subagents/researcher/agent.ts` | subagent `researcher` |
| `agent/memory/profile.ts` | memory slot `profile` |
| `agent/extensions/crm.ts` | extension mount `crm` |

根 Agent 从外围 `package.json` 的 `name` 取名字，`package.json` 没有 `name` 时回退到 app-root 目录名。子智能体从它的目录取名字。

## 推荐布局（Recommended layout）

最小 Agent 需要 `instructions.md`；默认配置够用时 `agent.ts` 可选。框架默认值占用普通 agent slots，编写同一路径会在编译前替换默认值。

```txt
my-agent/
├── package.json
├── tsconfig.json
├── agent/
│   ├── agent.ts
│   ├── instructions.md
│   ├── instrumentation.ts
│   ├── memory/
│   ├── extensions/
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

| 路径 | 描述 | 子智能体 | 备注 |
| --- | --- | --- | --- |
| `agent.ts` | Runtime 配置 | 是 | Model、modelOptions、compaction、build、experimental。见 [Agent config](../agent-config)。 |
| `instructions.md` / `instructions.ts` / `instructions/` | 基础 system prompt | 可选 | 根上必填，子智能体上可选。 |
| `instrumentation.ts` | 遥测配置 | 否 | 仅根。 |
| `memory.ts` 或 `memory/` | 跨 session 记忆 | 是 | 单 slot 用 `memory.ts`；命名 slots 用 `memory/<name>.ts`。见 [记忆（Memory）](../memory)。 |
| `extensions/` | 挂载可复用能力包 | 否 | 文件名是 mount namespace。见 [扩展（Extensions）](../extensions)。 |
| `channels/` | HTTP / 消息入口 | 否 | 仅根。 |
| `connections/` | 外部服务连接（MCP、OpenAPI） | 是 | 静态文件定义一个以路径命名的 connection。动态文件可在运行时解析出一组随调用者变化的连接。 |
| `hooks/` | 生命周期和流事件订阅者 | 是 | 仅模块支撑。 |
| `skills/` | 按需流程和能力包 | 是 | |
| `lib/` | 共享 authored helper 代码 | 是 | 仅导入；不挂载进 workspace。 |
| `sandbox.ts` 或 `sandbox/sandbox.ts` | Agent 的单个 sandbox | 是 | |
| `sandbox/workspace/**` | 播种进 sandbox 的文件 | 是 | |
| `tools/` | 类型化可执行集成 | 是 | 仅模块支撑。 |
| `schedules/` | 定时任务 | 否 | 仅根。 |
| `subagents/` | 专家子 Agent | 是 | 支持嵌套子智能体。 |

Extensions 不能贡献 memory slots。子智能体可以有自己的 memory 和 sandbox；channels 和 schedules 仍仅根。

## 什么到达 runtime sandbox

eve 不挂载整棵树。只有 `agent/sandbox/workspace/**` 在 session bootstrap 时镜像到 `/workspace/`。Skill 文件落在 `$HOME/.agents/skills/...`；`$HOME` 不可用时回退到 `/workspace/skills/...`。`lib/` 永远不进入 workspace。

## 本地子智能体布局

```txt
agent/subagents/researcher/
├── agent.ts
├── instructions.md
├── memory/
├── connections/
├── hooks/
├── skills/
├── lib/
├── sandbox/
├── tools/
└── subagents/
```

`agent.ts` 必填且必须提供 description。`instructions` 可选。本地子智能体内不支持 `channels/`、`schedules/` 和 `extensions/`。

## 扁平布局

当 app root 也是 agent root 时支持把 `agent.ts`、`instructions.md`、`tools/` 和 `skills/` 放在根上。优先使用嵌套布局。

## 为什么 eve 没有发现我的文件？

运行 `eve info`。它列出发现的 surface 并打印发现诊断。eve 也会在 `.eve/` 下写出可检查的 artifacts。见 [Observability](../guides/instrumentation) 和 [CLI](./cli)。

## 接下来读什么

- [`agent.ts`](../agent-config)
- [记忆（Memory）](../memory)
- [扩展（Extensions）](../extensions)
- [工具（Tools）](../tools)
- [TypeScript API](./typescript-api)
