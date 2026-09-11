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

对照日期：2026-09-11，上游来源 [eve.dev/llms.txt](https://eve.dev/llms.txt)、[eve.dev/sitemap.md](https://eve.dev/sitemap.md) 与 [vercel/eve docs](https://github.com/vercel/eve/tree/main/docs)。记住的上游 docs tip SHA：`9381078c9d4ec40f8105b1009c7781b5dcea8609`（相对上次 `a24b68c`：workflow checkpoint batching / retention、Slack 长回复 snippet、trace schema v4 / principals、Agent Runs preview、`ctx.agent(target, input)`）。llms.txt fingerprint：sha256 `be2f43bd4730671fc87abd72a14ffe9a48a0415ad4edf39bd3e0ea9db991eb2c`（未变）。

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 文档站基础 | 已完成 | Next.js + Fumadocs + GitHub Pages 静态部署已接入。 |
| 官方一级目录 | 进行中 | 已补 Memory、Extensions、Add Integrations、Protocols、Responsible Use 等新一级入口。 |
| 入门文档 | 已完成，需跟版本 | Introduction / Getting Started 已能读；默认脚手架模型现为 GPT-5.6 Luna Fast。 |
| 核心能力 | 已完成高频补齐 | Tools、Skills、Sandbox、Subagents、Connections、Evals、Channels、Schedules、Memory、HITL。 |
| Integrate | 已完成入口 | Extensions、Add Integrations、ACP、UCP、Remote Agents、Frontend、Client。 |
| 搜索 / LLM 入口 | 已接入，需持续验证 | 构建时从 `docs/` 生成 `llms.txt` / `llms-full.txt`。 |
| 链接质量 | 进行中 | 已补上 Channels overview 里指向 Chat SDK / Photon 的断链。 |


## 2026-09-11 上游同步

对照 `vercel/eve` docs tip `9381078c9d4ec40f8105b1009c7781b5dcea8609`（相对上次 `a24b68c5774bffeb0e4e762c3aab3ec7ab64a179`）。llms.txt fingerprint 未变：sha256 `be2f43bd4730671fc87abd72a14ffe9a48a0415ad4edf39bd3e0ea9db991eb2c`。

已更新：

- [x] `agent-config`：`experimental.workflow.modelCallsPerStep` checkpoint batching；`experimental.workflow.retention`
- [x] `concepts/execution-model-and-durability`：batching / steering / replay 单元
- [x] `tools/workflows`：`ctx.agent(target, input)`（去掉作者侧 `key`）
- [x] `channels/slack`：超长回复上传 `eve-response.md` Markdown snippet（需 `files:write`）
- [x] `guides/dev-tui`：pending cancel 可用 `Ctrl+C` 中断等待
- [x] `guides/instrumentation` / `instrumentation-providers`：schema v4、principals、Agent Runs preview+production
- [x] `guides/remote-agents`：conversation baggage / `agent.dispatch` link
- [x] `sandbox`：不可用 Vercel snapshot 时删除坏记录再重建
- [x] `subagents` / `reference/typescript-api`：batching 重试与 `AgentWorkflowRetentionDefinition`

跳过：官方 Integrations / Templates gallery（按路线图）。

## 2026-09-10 上游同步

对照 `vercel/eve` docs tip `a24b68c5774bffeb0e4e762c3aab3ec7ab64a179`（相对上次 `c952497cd15c36680f6723bf311cb74878ac30c8`）。llms.txt fingerprint 更新为 sha256 `be2f43bd4730671fc87abd72a14ffe9a48a0415ad4edf39bd3e0ea9db991eb2c`。

已更新：

- [x] `memory/overview`（及 `memory/index`）：provider 表以 File memory 打头；补 Upstash AgentKit；新增 Kybernesis Arcana（`eve add memory/arcana`）
- [x] `evals/reporters`：新增 Datadog Experiments reporter；Braintrust 标签/metadata；自定义 reporter 生命周期回调扩展
- [x] `guides/dynamic-capabilities`：provider 包用 `defineDurableCallback` 创建可重放动态工具
- [x] `reference/typescript-api`：导出 `defineDurableCallback`；reporters 列表含 Datadog
- [x] `tools/overview`：`label.start` / `delta` / `complete` activity 投影
- [x] `reference/telemetry`：setup 失败类别与 ephemeral/persistent 标识

仍跳过：

- [ ] 官方 Integrations 画廊（含 Arcana / Datadog 卡片独立中文页）
- [ ] 官方 Templates 画廊
- [ ] Benchmarks

## 2026-09-08 上游同步

对照 `vercel/eve` docs tip `c952497cd15c36680f6723bf311cb74878ac30c8`（相对上次 `4b5fad41beeecae1286611974ea970d565d13dde`）。llms.txt fingerprint 未变：sha256 `19d6b745d7ea95fcc6d966301b494ff402618bb449ecad70316ebcc9c983d11d`。

已更新：

- [x] 教程：默认学习路径改为示例数据；`connect-a-warehouse` 标为可选并移到导航末尾；Connect GA + connector UID 说明
- [x] `tutorial/run-analysis`：图表依赖 bootstrap、`exitCode` 检查、下载生成图表脚本
- [x] `tutorial/ship-it`：HTTP Basic 保护已部署仪表盘（`proxy.ts`）
- [x] `sandbox.md`：`sandbox.run` / bootstrap 的 `exitCode` 检查与方法表
- [x] `connections/overview`：Connect connector UID（非 `--name` 显示名）
- [x] `reference/typescript-api`：ChatGPT 订阅改为 eve `/model` 浏览器登录（无需 Codex CLI；`~/.eve/auth/chatgpt.json`；device code）
- [x] `concepts/default-harness`：摘要前先按提供方 token 计量裁剪工具结果
- [x] `concepts/sessions-runs-and-streaming`：`meta.deliveryIds`
- [x] `guides/client/continuations`：`send()` 与已接受投递关联；server/client 同升
- [x] `reference/cli`：保留 Node `--conditions`；自托管拷贝布局 + prewarm
- [x] `guides/hooks`：对话 session 中 `turn.started`/首个 `step.started` 失败以 `session.waiting` 结束
- [x] `subagents.md`：取消仍投递最终通知
- [x] `instructions.md`：框架上下文跨工具步骤保持位置
- [x] `guides/dynamic-capabilities`：回调身份限定在 session/lifecycle/resolver
- [x] `tools/workflows.md`：tsconfig `paths` 别名用于 workflow 导入

仍跳过：

- [ ] 官方 Integrations 画廊
- [ ] 官方 Templates 画廊
- [ ] Benchmarks

## 2026-09-07 上游同步

对照 `vercel/eve` docs tip `4b5fad41beeecae1286611974ea970d565d13dde`（相对上次 `4ee671565be5ba21bbf3555fe2fa3b5b64fdd99b`）。

已更新：

- [x] NEW：`docs/reference/telemetry.md`（CLI 遥测）+ reference meta + `cli.md` 遥测入口
- [x] `concepts/built-in-tools.md`：`defaultTools: false` / 按工具 `eve add` / `disableTool`（#3069）
- [x] `memory/file.md`：Blob 开通走 OIDC，`EVE_MEMORY_BLOB_*` 探测顺序（#3077）
- [x] `memory/custom-provider.md`：abort / steering 下的 recall 失败语义（#3082）
- [x] `guides/instrumentation.md`：OTel 兼容 backend 列表含 Sentry（#3052）
- [x] `guides/client/streaming.md`：`result()` 关 HTTP stream；浏览器 body 读取失败重连（#3071 / #3082）
- [x] `tools/overview.md` + `tools/workflows.md`：后台 yield / `task.postMessage`、`defineWorkflowTool` + owner hooks（#2997 / #3042 / #3082）
- [x] `install-integrations.md`：拒绝 `agents/` workspace 安装 Web Chat（#3059）
- [x] `channels/mcp.md`：发布 MCP 调用契约、structured errors、请求大小边界（#2988）
- [x] `channels/slack.md` / `connections/openapi.md` / `evals/running.md` / `guides/dynamic-capabilities.md` / `guides/frontend/overview.md`：#3082 小修
- [x] `subagents.md` + `guides/remote-agents.md`：后台子智能体 steering（#3016）

仍跳过：

- [ ] 官方 Integrations 画廊
- [ ] 官方 Templates 画廊
- [ ] Benchmarks

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
