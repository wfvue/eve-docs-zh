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

对照日期：2026-09-04，上游来源 [eve.dev/llms.txt](https://eve.dev/llms.txt)、[eve.dev/sitemap.md](https://eve.dev/sitemap.md) 与 [vercel/eve docs](https://github.com/vercel/eve/tree/main/docs)。记住的上游 docs SHA：`4ee671565be5ba21bbf3555fe2fa3b5b64fdd99b`（docs tip 经 `38fd8d9` 等；含 token 费用限额、`tasks: true` 取消、Workflows as Tools 澄清、sandbox 镜像/用户）。llms.txt fingerprint：sha256 `19d6b745d7ea95fcc6d966301b494ff402618bb449ecad70316ebcc9c983d11d`，92 行（相对 2026-09-03 未变）。

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 文档站基础 | 已完成 | Next.js + Fumadocs + GitHub Pages 静态部署已接入。 |
| 官方一级目录 | 进行中 | 已补 Memory、Extensions、Add Integrations、Protocols、Responsible Use 等新一级入口。 |
| 入门文档 | 已完成，需跟版本 | Introduction / Getting Started 已能读；默认脚手架模型现为 GPT-5.6 Luna Fast。 |
| 核心能力 | 已完成高频补齐 | Tools、Skills、Sandbox、Subagents、Connections、Evals、Channels、Schedules、Memory、HITL。 |
| Integrate | 已完成入口 | Extensions、Add Integrations、ACP、UCP、Remote Agents、Frontend、Client。 |
| 搜索 / LLM 入口 | 已接入，需持续验证 | 构建时从 `docs/` 生成 `llms.txt` / `llms-full.txt`。 |
| 链接质量 | 进行中 | 已补上 Channels overview 里指向 Chat SDK / Photon 的断链。 |

## 2026-09-04 上游同步

对照 `vercel/eve` docs tip `4ee671565be5ba21bbf3555fe2fa3b5b64fdd99b`（相对上次 `aae26311` 的 docs-touching：`dc08cbf` workflows 澄清、`73aec25` token cost limits、`9091777` cancel tasks、`3b73073` sleep-as-workflow、`d594b94` agents/ memory namespace、`bad0813`/`38fd8d9` sandbox）。

已更新：

- [x] `agent-config.md`：补 Runtime limits（含 `maxTokenCostUsdPerSession`）
- [x] `tools/workflows.md` + `tools/overview.md`：Durable Tools → Workflows as Tools；后台工具无需根实验开关
- [x] `sessions-runs-and-streaming` / `channels/eve` / `guides/client/streaming`：`tasks: true` 取消后台任务
- [x] `concepts/built-in-tools.md`：`sleep` 作为 durable tool workflow、并发并行
- [x] `memory/overview.md`：顶层 `agents/` workspace 分 namespace
- [x] `sandbox.md`：默认镜像 / `EVE_SANDBOX_IMAGE_TAG` / `vercel()` image·source 优先级与 `vercel-sandbox` 用户

仍跳过：

- [ ] 官方 Integrations 画廊
- [ ] 官方 Templates 画廊
- [ ] Benchmarks

## 2026-09-03 上游同步

对照 `vercel/eve` docs tip `aae26311a845b5638f701311b742fab7d9cb4baf`，以及此前 docs-touching commits：`7810640f`（instrumentation-providers）、`d8c58bd0`（memory file Vercel Blob）、`fc123f42` / `6e630b40`（workspace CLI / declarative workspaces / vercel deploy）。

已更新：

- [x] NEW：`docs/guides/instrumentation-providers.md`（experimental providers 布局）+ guides meta
- [x] `instrumentation.md`：链到 providers，标注 experimental
- [x] `memory/file.md`：`eve add memory/file` 开通私有 Blob、`EVE_MEMORY_*`、backends 表、setup 修复、`vercelBlob()`
- [x] `install-integrations.md`：memory/file setup 说明
- [x] `reference/cli.md`：agents/ workspace、`--agents`、`eve integration setup`
- [x] `guides/deployment/vercel.md`：声明式 agent workspaces / 路径带 agent 名
- [x] Subagents 毕业为 workflow / 后台任务（#2690）：built-in-tools、context-control、execution-model、sessions-runs、dynamic-capabilities、frontend overview、remote-agents、subagents、tools/overview
- [x] NEW：`docs/tools/workflows.md`（Durable Tools）+ tools meta

仍跳过：

- [ ] 官方 Integrations 画廊
- [ ] 官方 Templates 画廊
- [ ] Benchmarks

## 2026-09-02 上游同步

对照 `vercel/eve` docs commit `e07d423d5c4242c0894803728c86427fa25a1e9c`：

已更新：

- [x] Memory：官方拆掉单页 `docs/memory.md`，改为 `docs/memory/`（overview / file / custom-provider + meta.json）
- [x] Multi-tenant memory：链接改到 `../memory`、`../memory/custom-provider` 与 overview 锚点
- [x] Instructions：What to read next 补充 Memory——provider 支撑、比 session 更久的上下文

仍跳过：

- [ ] 官方 Integrations 画廊
- [ ] 官方 Templates 画廊
- [ ] Benchmarks

## 2026-09-01 上游同步

对照 `vercel/eve` docs 自 `f062299`（Slack slash commands）以来的 commits：

已更新：

- [x] Memory：Supermemory 从「即将推出」变为可用的第三方 provider；安装命令 `eve add memory/supermemory`
- [x] Connections / Dynamic capabilities：`defineDynamic` 可解析 MCP / OpenAPI 连接；带鉴权条目必须设 `instanceKey`
- [x] Extensions：`extension/connections/` 也可以放 `defineDynamic(...)`
- [x] TypeScript API：`defineDynamic` 可从 `eve/connections` 导入
- [x] Project layout：`connections/` 区分静态文件和动态文件
- [x] CLI traces：`EVE_TRACES_CONTENT` 默认改为 off，token/cost 走 OTel GenAI `gen_ai.usage.*`

仍跳过：

- [ ] 官方 Integrations 画廊（含新增 Supermemory 卡片本身的独立中文页）
- [ ] 官方 Templates 画廊
- [ ] Benchmarks

## 长期维护节奏

```txt
每周：检查 eve.dev/docs 和 vercel/eve 文档目录变化
每周：抽查 GitHub Pages 部署、搜索和 LLM 文件链接
每月：整理一次已翻译 / 待翻译清单
重大版本：更新核心概念、示例代码和兼容性说明
```
