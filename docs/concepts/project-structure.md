---
title: "项目结构（Project Structure）"
description: "先从一个 Agent 起步，把应用代码放在旁边；只有需要可分别寻址的多个根 Agent 时，再拆成 workspace。"
---

# 项目结构（Project Structure）

官方原文：[Project Structure](https://eve.dev/docs/concepts/project-structure)。

先从一个根 Agent，放在 `agent/`。根 Agent 通过自己的 HTTP API 或 channel 接收请求；它可以有许多 tools、skills 和子智能体。浏览器应用文件请放在 `agent/` 之外。

| 当你需要… | 结构 |
| --- | --- |
| 一个 Agent（可有可无浏览器应用） | `agent/` 与应用代码并列 |
| 由 Agent 委派的专家 | 该 Agent 内的 `agent/subagents/<name>/` |
| 多个可分别寻址、共享同一 package 与部署的根 Agent | eve agent workspace：`agents/<name>/agent/` |
| 独立依赖、版本或发布节奏 | 分开的 Agent package 或项目 |

每个根 Agent 都可以有[声明式子智能体](/docs/subagents#declared-subagents)，各自带 prompt、tools 和 sandbox。这些专家没有独立的 channel 端点，也不会继承父级已编写的能力。若只需要可选的操作步骤，用 [skill](/docs/skills) 更合适。

## 单个 Agent

独立 Agent，或嵌在 Web 应用里的 Agent，用这种布局：

```text
project/
├── package.json
├── agent/
│   ├── instructions.md
│   ├── tools/
│   └── subagents/
├── evals/
├── app/                    # 可选：Next.js 浏览器应用
└── next.config.ts          # 可选：Next.js 集成
```

用[快速开始](/docs/getting-started)创建 Agent。[Agent Files 参考](/docs/reference/agent-files)列出支持的路径。Agent 专用 helper 放在 `agent/lib/`；可复用能力通过 [extensions](/docs/extensions) 共享。

生成 Next.js 聊天 UI：在项目根运行 `eve add channel/web`。已有浏览器应用：按[框架集成指南](/docs/guides/frontend/overview#per-framework-integration)接入。

## 多个根 Agent

例如客户端需要分别寻址 support 与 research 时，用 eve agent workspace：

```text
project/
├── package.json
├── agents/
│   ├── support/
│   │   ├── agent/
│   │   └── evals/
│   └── research/
│       ├── agent/
│       └── evals/
└── apps/                   # 可选对等应用，不是 eve workspace 成员
    └── web/
```

成员共享根 package、依赖、脚本和 Vercel 部署。目录名就是 CLI 与公开路由上的身份。成员**不能**有自己的 `package.json`：加了就会被排除出 eve workspace 发现。与包管理器 workspace 不同，这种布局**不**给成员单独的依赖或版本边界。

创建 workspace 并选定要跑的 Agent：

```bash
npx eve@latest init operations --agents support,research
cd operations
npx eve dev --agent support
```

`dev`、`info`、`eval` 等 Agent 命令可从 `agents/<name>/` 运行，或在 workspace 根传 `--agent <name>`。`eve dev --agent support` 只跑选定 Agent，不会启动对等应用。其它 Agent 需要时再单独启动；本地[workspace 同伴调用](/docs/subagents#vercel-workspace-peers)要显式 transport。

在 Vercel 上从根目录跑 `eve link` 与 `eve deploy`，一次部署包含全部成员。不要求有前端。自托管时，[分别构建并运行每个成员](/docs/guides/deployment/self-hosting#run-workspace-members)。

## 独立发布

需要独立依赖或发布节奏时（即便在同一 monorepo），用分开的 package 或项目。它们不是 eve agent-workspace 成员。能力共享用 [workspace extensions](/docs/extensions#use-an-extension-in-a-workspace)；跨部署委派用[远程 Agent](/docs/guides/remote-agents)。

## 配置 Web 部署

前端与 Agent 如何一起跑，和「有几个 Agent」无关：

- **把 Agent 加进 Next.js 应用：** 在 `next.config.ts` 用 [`eve/next`](/docs/guides/frontend/nextjs)。Next.js 拥有应用生命周期；集成在本地启动 Agent 进程并代理请求，在 Vercel 上贡献独立的 Agent service。根级 Next.js 应用可以与 `agent/` 或 `agents/` 并列；workspace 成员会自动发现。
- **给 agent workspace 加前端：** 把前端当作对等应用，例如 `apps/web/`。在 Vercel 上用根 [`vercel.ts` 里的 `eve/vercel`](/docs/guides/deployment/vercel#compose-agents-with-other-vercel-services) 把 Agent 与前端 service 一起贡献。[自托管](/docs/guides/deployment/self-hosting#run-workspace-members)时用进程管理器与反向代理。前端不需要 `eve/next`。

`apps/web/` 只是组织约定，不是 eve 文件系统槽位。对等服务由部署配置拥有；eve 只发现 Agent。两种 Vercel 集成都是**一起**部署这些服务，而不是各自独立发布。

生成式 Web Chat 安装器**不支持** agent workspace。请自行创建前端与 Agent 选择 UI，可参考 [React 聊天示例](/docs/guides/frontend/overview#basic-chat-react)。对等 Next.js 前端用 `next dev` 与 Agent 分开开发。若已编写 Vercel service graph，可用 `vercel dev --local` 跑组合，而无需链接 Vercel 项目。

对单个 `agent/` 项目，`eve add channel/web` 目前会生成使用 `eve/next` 的根级 Next.js 应用。`eve/vercel` 目前要求 `agents/` workspace，不能组合独立的根 `agent/`。

## 添加第二个根 Agent

把单 Agent 项目转成 workspace 时，把原 Agent 从项目根挪走：

```bash
mkdir -p agents/support
mv agent agents/support/agent
```

若有 `evals/`，一并移到 `agents/support/evals/`。`package.json`、依赖、环境文件和浏览器应用留在项目根。**不要**再留根级 `agent/`：只要还有根 `agent/`，即便也有 `agents/`，eve 仍按单 Agent 项目处理。

加下一个 Agent 之前：

- 更新 `tsconfig.json` 包含 `agents/**/*.ts`，保留应用侧 includes。更新已移动文件的 import 与路径别名，包括脚手架 `package.json#imports` 里指向 `./agent/*` 或 `./evals/*` 的项。
- 更新假定只有一个 Agent 的脚本。Agent 范围命令用 `--agent support`；仅 Agent 的 Vercel workspace 用根 `eve build`。Next.js 应用保留框架脚本，并按其[构建说明](/docs/guides/frontend/nextjs#dev-vs-deploy-topology)操作。
- 更新 HTTP 客户端与 webhook，对准命名 Agent 的公开路由。根 Next.js 应用应去掉单 Agent 的 `eveRoot` 覆盖以便 workspace 发现，并在客户端 hook 里选择 `support`。把 Agent 名与 durable-session 链接一起存。

然后添加第二个 Agent 并检查发现结果：

```bash
npx eve init research
npx eve info --agent support
npx eve info --agent research
```

用 `npx eve eval --agent support` 跑已移动 Agent 的 evals。之后从 workspace 根用 `npx eve init <name>` 继续添加。
