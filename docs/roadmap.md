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

对照日期：2026-09-23（Asia/Shanghai），上游来源 [eve.dev/llms.txt](https://eve.dev/llms.txt)、[eve.dev/sitemap.md](https://eve.dev/sitemap.md) 与 [vercel/eve docs](https://github.com/vercel/eve/tree/main/docs)。记住的上游 docs tip SHA：`54fc9a3e95b63d3b20a3acc69416319b8eb5e3ee`（含 sandbox 目录化、移除 todo / 重建 ask_question+ctx.ask、模型 ID、去掉 Agent Runs 引导、Jev 链接）。官方 llms.txt fingerprint：sha256 `0492e1ed3c92a6860bf68703aa909b2765b7df42cff8a6216f1c299a4ba17eff`。

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 文档站基础 | 已完成 | Next.js + Fumadocs + GitHub Pages 静态部署已接入。 |
| 官方一级目录 | 进行中 | 已补 Memory、Extensions、Add Integrations、Protocols、Responsible Use 等新一级入口。 |
| 入门文档 | 已完成，需跟版本 | Introduction / Getting Started 已能读；默认脚手架模型现为 Grok 4.7（`spacexai/grok-4.7`）；示例常用 `claude-opus-5.5` / `gpt-6-*`。 |
| 核心能力 | 已完成高频补齐 | Tools、Skills、Sandbox、Subagents、Connections、Evals、Channels、Schedules、Memory、HITL。 |
| Integrate | 已完成入口 | Extensions、Add Integrations、ACP、UCP、Remote Agents、Frontend、Client。 |
| 搜索 / LLM 入口 | 已接入，需持续验证 | 构建时从 `docs/` 生成 `llms.txt` / `llms-full.txt`。 |
| 链接质量 | 进行中 | 已补上 Channels overview 里指向 Chat SDK / Photon 的断链。 |








## 2026-09-23 上游同步

对照 `vercel/eve` docs tip `54fc9a3e95b63d3b20a3acc69416319b8eb5e3ee`。官方 llms.txt fingerprint：sha256 `0492e1ed3c92a6860bf68703aa909b2765b7df42cff8a6216f1c299a4ba17eff`。

已更新：

- [x] **Sandbox 目录化**：`sandbox.md` → `sandbox/`（index / default / vercel / docker / microsandbox / just-bash）；旧文件保留为重定向占位
- [x] **BREAKING**：移除 `todo`；`ask_question` 改为基于 `ctx.ask()` 的 opt-in workflow 工具（built-in-tools、HITL、workflows、sessions、typescript-api、tutorial）
- [x] 示例模型 ID → `claude-opus-5.5` / `gpt-6-sol` / `gpt-6-luna*`；新 Agent 默认 `spacexai/grok-4.7`
- [x] 移除 Vercel **Agent Runs** 文档引导（otel、deployment/vercel、instrumentation 交叉引用）
- [x] Jev 链接与大小写（evaluate、judge、HITL、workflows 隐藏子智能体路由）
- [x] `eve init -n/--non-interactive` scaffold-only；deployment sandbox API 对齐 `VercelSandbox.environment()`

继续跳过：官方 Integrations / Templates galleries 与 Benchmarks 正文。

## 2026-09-22 目录与导航对齐

对照 `vercel/eve` docs tip `44e39a3945690f248f49c500b5f45ecb62f9266d`，从根目录到嵌套目录重新核对官方文档树。

已完成：

- [x] 根侧栏按官方 **Introduction / Build / Integrate / Operate / Reference** 分组重排；中文实践入口统一放在官方分组之后
- [x] 新增 `dynamic-configuration/` 导航分组，收纳「动态能力」与「自动模型选择」
- [x] `subagents.md` 对齐为 `subagents/index.md + meta.json` 目录结构，同时保留旧文件，避免已有链接失效
- [x] 可观测性对齐新版 `instrumentation / otel / migration`：新增迁移页、更新目录式 instrumentation 与 Agent Files 说明
- [x] 所有嵌套 `meta.json` 按官方顺序校准；Memory、Deployment、Instrumentation 等目录保留静态导出 landing
- [x] `guides`、`reference` 等中文独有实践页继续留在磁盘；只从官方对齐导航移出或排到官方项之后

继续跳过：官方 Integrations / Templates galleries 与 Benchmarks 正文；Benchmarks 仅保留官方链接。

## 2026-09-18 上游同步

对照 `vercel/eve` docs tip `a87ad469a9b99225ebc91012958c92f79b763a3f`（相对上次 `910bb45d299c916af572b5aa6449777a268c434c`）。llms.txt fingerprint 未变：sha256 `88e15479e8b9ed7b3641abcba9cbcb6c42cee874ad3ef3d9bcdf200186ac9ec4`。

已更新：

- [x] **新页** `guides/evaluate`：`eve/models` 的 `auto` + `eve/ai` 的 `evaluate`；agent-config / typescript-api 交叉链接
- [x] 自动工具审批：`approval: auto()`（HITL、tools overview、connections）
- [x] 控制 agent/subagent 工具投影：`tool: false`（subagents、remote-agents、workflows、agent-config）
- [x] Session prewarm + 持续流式（sessions-runs、channels/eve、client、frontend hooks；React 的 reactive prewarm）
- [x] Evals：显式 `t.session()` / `turn.session`；judge 默认提及 `gpt-5.6-luna`
- [x] Compaction 计入最终请求上下文 / envelope（context-control、agent-config）
- [x] 动态工具用捕获状态重放 schema factories（dynamic-capabilities、`defineDurableSchema`）

跳过：官方 Integrations / Templates gallery（按路线图）。

## 2026-09-17 上游同步

对照 `vercel/eve` docs tip `910bb45d299c916af572b5aa6449777a268c434c`（相对上次 `3c2edaedc40ef91f57f990f0d30be0e39fada000`）。llms.txt fingerprint 更新为 sha256 `88e15479e8b9ed7b3641abcba9cbcb6c42cee874ad3ef3d9bcdf200186ac9ec4`。

已更新：

- [x] **新页** `concepts/project-structure`、`reference/agent-files`；getting-started 精简并指向二者；保留实践页 `reference/project-layout`
- [x] init→chat：`/login` 凭据流；agent-config 的 `eve/models/openai|anthropic` helpers；dev-tui / cli / acp / telemetry 对齐
- [x] Teams Connect 引导（`channels/teams`）；Web Chat / workspace 边界（install-integrations、nextjs）
- [x] withEve 公开路由改为 `/eve/<name>/v1/*`（vercel、nextjs、schedules、subagents）；自托管 `Run workspace members`
- [x] trustedForwarders 覆盖 lineage + trace 内容约束（auth、remote-agents、otel）；providers audience 链到 channels overview
- [x] 动态 resolvers 在 `turn.started` 收到 `ctx.messages`；steering 可在答案前打断模型生成
- [x] sandbox 镜像 tag 去掉 build metadata；typescript-api 直接 provider 模型与 chatgpt 默认 luna-fast

跳过：官方 Integrations / Templates gallery（按路线图）。
