---
title: "CLI"
description: "eve CLI 每个命令的参考：init、set、info、build、start、dev、logs、trace、link、deploy、eval、channels 和 extension。"
---

# CLI

相关 `eve` 命令可从应用根目录或其任意子目录运行。在 `agents/` workspace 中，Agent 专用命令接受 `--agent <name>`；存在多个 Agent 且未指定时打开 picker。非交互运行必须传 `--agent`。不带命令运行 `eve`：当前目录还不是 eve 项目时走 `eve init`，已是项目时走 `eve dev`。每个命令会加载根目录的 `.env` / `.env.local`。

官方原文：[CLI](https://eve.dev/docs/reference/cli)。

## 命令（Commands）

| 命令 | 描述 |
| --- | --- |
| `eve` | 初始化当前目录；已是 eve 项目时启动开发 |
| `eve init [target]` | 创建新 Agent，或把 Agent 加入已有项目 / workspace |
| `eve info` | 打印解析后的应用，包括 tools、skills、subagents、schedules、channels、routes、artifact 与发现诊断 |
| `eve build` | 编译 `.eve/` artifacts 并构建 host 输出 |
| `eve start` | 服务已构建的 `.output/` |
| `eve dev` / `eve dev <url>` | 本地开发 UI，或连接到已有 server |
| `eve acp [url]` | 经 stdio 提供 ACP v1 agent |
| `eve logs` / `eve traces` | 诊断日志与本地 span 树 |
| `eve link` / `eve deploy` | 关联 Vercel 项目 / 部署生产 |
| `eve eval` | 运行 evals |
| `eve channels list` | 列出用户编写的渠道 |
| `eve extension init` / `build` | Extension 包脚手架与构建 |
| `eve set` | 修改根 Agent model / reasoning |
| `eve add <item>` | 从官方或已配置的 shadcn registry 安装条目 |
| `eve integration setup <kind>` | 在 registry 文件已安装后直接运行内置 setup flow |
| `eve registry <command>` | 添加 sources，并列出、搜索或查看 catalog |

`eve build` 因发现错误失败时，打印完整诊断与 diagnostics artifact 路径。

## `eve init` 与 declarative workspaces

```bash
eve init [target] [--agents <name,...>] [--model <provider/model-id>] [--reasoning <effort>] [--channel-web-nextjs]
```

| 目标 | 发生什么 |
| --- | --- |
| `eve init my-agent` | 在 `my-agent/` 创建新 Agent 项目 |
| `eve init .` | 向已有 `package.json` 添加 `agent/` 与缺失依赖 |
| `eve init` 无目标 | 同 `.`；coding agents 得到设置指南而非脚手架 |
| `eve init my-project --agents foreman,researcher` | 创建 `agents/foreman/agent/` 与 `agents/researcher/agent/` workspace |
| 在 `agents/` workspace 里 `eve init billing` | 只添加 `agents/billing/agent/`，保留 package / 依赖 / TS 配置 |

| Flag | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `--agents <names>` | list | unset | 逗号分隔，创建 `agents/` workspace |
| `--model <model>` | string | `openai/gpt-5.6-luna-fast` | 根 Agent AI Gateway model ID |
| `--reasoning <effort>` | enum | provider default | `none`…`xhigh`；`provider-default` 保持未编写 |
| `--channel-web-nextjs` | flag | off | 新项目加 Web Chat；已有项目用 `eve add channel/web` |

**项目建议：** CI / 非交互脚本在 workspace 中始终传 `--agent`。

## `eve extension` / `eve set`

- `eve extension init [target]`：新建 extension 包（不能以已有 `package.json` 项目为目标）。
- `eve extension build`：构建 dist、declarations 与 `exports`。
- `eve set --model … --reasoning …`：不打开 TUI 改根配置；不写凭证。详见 [Extensions](https://eve.dev/docs/extensions)。

## Registry、`eve add` 与 `eve integration setup`

```sh
eve add extension/agent-browser
eve add linear
eve add memory/file
eve integration setup file-memory
eve add channel/slack --skip-install
eve registry search browser
eve registry view @acme/my-extension
```

`eve add` 在官方条目 setup 前询问；产品级包可拆组件。`--yes` / `--non-interactive` / `--answer` 适合 coding agents——**不要**把 secrets 放进命令行答案。设置被跳过时可 `eve add <item> --skip-install` 续跑。

`eve integration setup file-memory` **不重装** `agent/memory/file.ts`，直接跑存储开通：Vercel CLI 鉴权、解析已链接项目、调和私有 Blob store 并拉取环境。用于修复或核验先前开通。`eve add memory/file` 在 setup 后也会给出部署交接。详见 [File Memory](../memory/file)。

`eve registry add` 写入 `package.json#registries`；`search` 还包含 [skills.sh](https://skills.sh)（`@skills`）。

## `eve info` / `eve build` / `eve start`

```sh
eve info [--json]
eve build [--profile <path>] [--skip-sandbox-prewarm]
eve start [--host <host>] [--port <port>]
```

`eve info` 先于 `eve dev` 核对发现结果。`eve build` 在 `.eve/builds/` 编译并发布 host 输出；`--profile` 记录阶段计时与体积。`eve start` 服务 `.output/`（默认端口 `$PORT` 或 3000）。

## `eve dev`、`eve invoke`、logs、traces

```sh
eve dev [options]
eve dev https://your-app.vercel.app
eve invoke "Summarize station telemetry"
```

`eve dev` 启动本地 server + TUI；裸 URL / `--url` 只连远程。常用渲染 flag：`--tools`、`--reasoning`、`--subagents`、`--logs`。`eve acp` 走 stdio JSON-RPC。`eve invoke` 无 TUI 提交 turn，可 `--resume`。

本地会记录 ready URL、runtime 快照；无编写 `instrumentation.ts` 时写入 `.eve/traces/`。`eve logs` 读 `.eve/logs/` JSONL；`eve traces` 读 OTLP segments。`EVE_TRACES_CONTENT=on` 才捕获 prompt/工具负载。保留：`EVE_TRACES*`（年龄 / 总字节 / retain count）。

## `eve link` / `eve deploy` / `eve eval` / channels

- `eve link`：关联 Vercel 项目并拉取 AI Gateway 凭证到 `.env.local`（交互式；CI 用 `vercel link`）。
- `eve deploy`：生产部署（`vercel deploy --prod`）。declarative `agents/` workspace 见 [Deploy to Vercel](../guides/deployment/vercel)。
- `eve eval [evalId...] [--url]`：本地或远程跑 evals；见 [Evals](../evals/overview)。
- `eve channels list [--json]`：列出用户编写渠道。

## 推荐循环

1. 编辑 `agent/`（或 `agents/<name>/agent/`）。
2. `eve info` 确认发现。
3. 本地 `eve dev`。
4. `eve build`，再用 `eve start` 冒烟。

## 接下来读什么

- [Project layout](./project-layout)
- [instrumentation.ts](../guides/instrumentation)
- [Deploy to Vercel](../guides/deployment/vercel)
- [File Memory](../memory/file)
- [部署（Deployment）](../guides/deployment/overview)
