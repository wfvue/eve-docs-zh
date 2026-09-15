---
title: "路线图"
description: "Eve 中文文档项目的阶段目标、当前进度与维护节奏。"
---

# 文档路线图

本路线图是 `eve-docs-zh` 中文文档项目的维护计划，不代表 Eve 官方产品路线图。

当前目标已经从“搭建基础骨架”进入到“持续补齐官方文档 + 提升中文文档站体验”的阶段。后续推进原则是：

```txt
官方目录不能少，中文补充可以多；
先保证能读，再逐页补完整；
先补高频能力，再补参考和教程；
每次补文档时同步检查链接、搜索、llms.txt 和导航。
```

## 当前状态

对照日期：2026-09-15，上游来源 [eve.dev/llms.txt](https://eve.dev/llms.txt)、[eve.dev/sitemap.md](https://eve.dev/sitemap.md) 与 [vercel/eve docs](https://github.com/vercel/eve/tree/main/docs)。记住的上游 docs tip SHA：`bef74fe8f2817beba060a0f12fbf0a782efd2299`（相对上次 `7fa514bc`：MCP `protocolVersionDiscovery`、Slack 私有输入 / `defaultDeliver`、统一 `audience()`、Next.js workspace 自动发现、`eve init` 接受已有 package、Codex app-server ChatGPT 凭据、根 session / `agent.run.id` 身份）。llms.txt fingerprint：sha256 `be2f43bd4730671fc87abd72a14ffe9a48a0415ad4edf39bd3e0ea9db991eb2c`（未变）。

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 文档站基础 | 已完成 | Next.js + Fumadocs + GitHub Pages 静态部署已接入。 |
| 官方一级目录 | 进行中 | 已补 Memory、Extensions、Add Integrations、Protocols、Responsible Use 等新一级入口。 |
| 入门文档 | 已完成，需跟版本 | Introduction / Getting Started 已能读；默认脚手架模型现为 GPT-5.6 Luna Fast。 |
| 核心能力 | 已完成高频补齐 | Tools、Skills、Sandbox、Subagents、Connections、Evals、Channels、Schedules、Memory、HITL。 |
| Integrate | 已完成入口 | Extensions、Add Integrations、ACP、UCP、Remote Agents、Frontend、Client。 |
| 搜索 / LLM 入口 | 已接入，需持续验证 | 构建时从 `docs/` 生成 `llms.txt` / `llms-full.txt`。 |
| 链接质量 | 进行中 | 已补上 Channels overview 里指向 Chat SDK / Photon 的断链。 |



## 2026-09-15 上游同步

对照 `vercel/eve` docs tip `bef74fe8f2817beba060a0f12fbf0a782efd2299`（相对上次 `7fa514bceadd6f680f3e9407756b827fd0e9a837`）。llms.txt fingerprint 未变：sha256 `be2f43bd4730671fc87abd72a14ffe9a48a0415ad4edf39bd3e0ea9db991eb2c`。

已更新：

- [x] `connections/mcp`：按连接配置 `protocolVersionDiscovery`
- [x] `channels/slack`：`approvalChannel` 私有输入投递；`input.requested` 可 `defaultDeliver()`；DM/私有频道标题 `Private message`
- [x] `channels/custom` / `channels/eve`：统一 `audience()` 分类（不再用 metadata 保留键）
- [x] `subagents`：task child activity 归属；`defineWorkspaceAgent` + Next.js `/eve/agents/<name>` mount
- [x] `guides/frontend/nextjs` / `install-integrations`：`withEve()` 自动发现 `agents/` workspace
- [x] `reference/cli`：`eve init` 可直接把 Agent 加进已有 package（含路径目标）
- [x] `guides/instrumentation*` / `remote-agents`：audience + development 内容默认；`vercel.session_id` 根 session 与 `agent.run.id`
- [x] `reference/typescript-api`：ChatGPT 凭据优先 Codex app-server，回退 eve + just-secrets

跳过：官方 Integrations / Templates gallery（按路线图）。

## 2026-09-14 上游同步

对照 `vercel/eve` docs tip `7fa514bceadd6f680f3e9407756b827fd0e9a837`（相对上次 `9381078c9d4ec40f8105b1009c7781b5dcea8609`）。llms.txt fingerprint 未变：sha256 `be2f43bd4730671fc87abd72a14ffe9a48a0415ad4edf39bd3e0ea9db991eb2c`。

已更新：

- [x] `subagents`：`defineWorkspaceAgent`（Vercel workspace peers）；去掉子级 `task_update`；completion batching
- [x] `guides/dynamic-capabilities`：动态子智能体可用父级 `ctx.model`（effective model）
- [x] `guides/deployment/vercel`：根 `vercel.ts` + `withEve`（`eve/vercel`）组合其它服务
- [x] `guides/instrumentation`：memory spans、`invoke_workflow`、recalled-as-input、`legacy.unknown`、远程 `tracestate` caller
- [x] `guides/remote-agents`：W3C `tracestate` 保留 dispatching caller
- [x] `reference/typescript-api`：ChatGPT 凭据改存 OS credential store（just-secrets）
- [x] `concepts/built-in-tools`：移除 `task_update`
- [x] `concepts/sessions-runs-and-streaming`：`content-filter` → `MODEL_CALL_FAILED`
- [x] `reference/cli`：`eve init` 可启用 self-modification 子智能体

跳过：官方 Integrations / Templates gallery（按路线图）。
