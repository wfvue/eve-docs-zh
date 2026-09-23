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

## 2026-09-16 上游同步


对照 `vercel/eve` docs tip `3c2edaedc40ef91f57f990f0d30be0e39fada000`（相对上次 `bef74fe8f2817beba060a0f12fbf0a782efd2299`）。llms.txt fingerprint 更新为 sha256 `8a01fbbe744f886467be0d9f511fb38f09d696d3ffc646c365700288e23df969`。

已更新：

- [x] `guides/instrumentation/`：扁平 `instrumentation.md` / `instrumentation-providers.md` 重组为 `overview` + `providers` + `otel`；导航默认折叠（`defaultOpen: false`）；公开 URL `/docs/observability/...`
- [x] 匿名 audience **fail-closed** 为 `unknown`（channels/custom、eve、connections、patterns/multi-tenant-auth、guides/dynamic-capabilities）
- [x] 去掉 registry 打包组件叙事：`eve add channel/linear` / `connection/linear`（channels/linear、install-integrations、reference/cli、guides/dev-tui）
- [x] 动态 workflows：`workflow()` factory 替代 `experimental_workflow`（tools/workflows；中文补充页 dynamic-workflows 同步）
- [x] 单 owner session / 部署 handoff：concepts/execution-model-and-durability 展开；agent-config、channels、sessions-runs、subagents、steering 语义（同 turn ID，不再取消替代）
- [x] Channel audiences 澄清：overview / chat-sdk / slack；custom `rekey` → `alias`
- [x] OTEL / remote-agents / deployment/vercel / typescript-api / cli 交叉链接与小改动
- [x] Dev TUI：`EVE_TUI_RENDER_MARKDOWN`；本地 traces 默认保留内容（`EVE_TRACES_CONTENT=off` 可关）

跳过：官方 Integrations / Templates gallery（按路线图）。

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
- [x] `memory/overview.md`：顶层 `agents/` workspace 分命名空间
- [x] `sandbox.md`：默认镜像 / `EVE_SANDBOX_IMAGE_TAG` / `vercel()` image·source 优先级与 `vercel-sandbox` 用户

仍跳过：

- [ ] 官方 Integrations 画廊
- [ ] 官方 Templates 画廊
- [ ] Benchmarks

## 2026-09-03 上游同步

对照 `vercel/eve` docs tip `aae26311a845b5638f701311b742fab7d9cb4baf`，以及此前 docs-touching commits：`7810640f`（instrumentation-providers）、`d8c58bd0`（memory file Vercel Blob）、`fc123f42` / `6e630b40`（workspace CLI / declarative workspaces / vercel deploy）。

已更新：

- [x] NEW：`docs/guides/instrumentation/providers.md`（experimental providers 布局）+ guides meta
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
