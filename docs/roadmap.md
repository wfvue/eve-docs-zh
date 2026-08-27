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

对照日期：2026-08-27，上游来源 [eve.dev/llms.txt](https://eve.dev/llms.txt)、[eve.dev/sitemap.md](https://eve.dev/sitemap.md) 与 [vercel/eve docs](https://github.com/vercel/eve/tree/main/docs)。

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 文档站基础 | 已完成 | Next.js + Fumadocs + GitHub Pages 静态部署已接入。 |
| 官方一级目录 | 进行中 | 已补 Memory、Extensions、Add Integrations、Protocols、Responsible Use 等新一级入口。 |
| 入门文档 | 已完成，需跟版本 | Introduction / Getting Started 已能读；官方脚手架模型和布局表仍在变。 |
| 核心能力 | 已完成高频补齐 | Tools、Skills、Sandbox、Subagents、Connections、Evals、Channels、Schedules、Memory、HITL。 |
| Integrate | 已完成入口 | Extensions、Add Integrations、ACP、UCP、Remote Agents、Frontend、Client。 |
| 搜索 / LLM 入口 | 已接入，需持续验证 | 构建时从 `docs/` 生成 `llms.txt` / `llms-full.txt`。 |
| 链接质量 | 进行中 | 已补上 Channels overview 里指向 Chat SDK / Photon 的断链。 |

## 2026-08-27 上游同步

已补官方新增页面：

- [x] Memory
- [x] Add Integrations
- [x] Extensions
- [x] MCP Channel / Chat SDK / Linq / Photon
- [x] Protocols：ACP、UCP
- [x] Built-in Tools
- [x] Concepts State（官方路径）
- [x] Durable cross-channel notifications
- [x] Responsible Use
- [x] HITL 按官方补审批策略、response policy、kind 判别器

仍缺或仍偏旧、下次优先：

- [ ] 官方 Integrations 画廊（eve.dev/integrations/*）逐条中文页——数量大，本轮不展开
- [ ] 官方 Templates 画廊
- [ ] Benchmarks（官方 sidebar 外链 `/benchmarks`）
- [ ] Getting Started 按官方最新脚手架模型与布局全文对照
- [ ] CLI / TypeScript API / HTTP API 按最新命令与 helper 再对一次
- [ ] Default harness 以外的 Concepts 深页（execution model、sessions、security）抽查
- [ ] `llms-full.txt` 需站点构建后才会包含新页正文

## 第一阶段：基础骨架与部署

- [x] README、文档首页、Fumadocs、GitHub Pages、静态导出、basePath

## 第二阶段：官方目录对齐

- [x] 保留官方 root 目录结构，并随 2026-08 官方 nav 增加 Memory / Integrate / Protocols / Responsible Use

说明：这一阶段的“已完成”表示目录入口已经存在，不代表每个深层页面都已完整翻译。

## 第三阶段：重点文档完整翻译

- [x] Connections、Evals、Subagents、Skills、Sandbox
- [x] Channels 一等渠道（含本轮 MCP / Chat SDK / Linq / Photon）
- [x] Schedules、Guides 高优先级、TypeScript SDK、Frontend
- [x] Memory、Extensions、Add Integrations、Protocols

## 第四阶段：核心概念与参考资料补强

- [x] filesystem-first、Workflow SDK、术语表、Sessions / Runs / Streaming
- [x] Default harness（已把内置工具拆到 Built-in Tools）
- [x] Context control、Security model
- [x] HTTP API / TypeScript API / CLI / Project layout（仍需按新版本抽查）
- [x] Built-in Tools、Concepts State

## 第五阶段：中文工程实践专题

官方目录补齐优先于本阶段。以下专题仍未开始：

- [ ] Docker sandbox 实践
- [ ] microsandbox 评估
- [ ] Postgres World 配置
- [ ] DeepSeek provider 接入
- [ ] Hono + Eve 共存
- [ ] Vite SPA + Eve stream 恢复
- [ ] Nginx / Caddy 反向代理
- [ ] 内网部署安全建议
- [ ] GitHub Pages 静态搜索排查指南
- [x] 自部署入口
- [x] llms.txt / llms-full.txt 自动生成脚本（需构建时刷新全文）

## 第六阶段：示例项目

- [ ] minimal-agent、hono-workflow、spa-api-agent、deepseek-agent、local-postgres-world、evals-smoke-example、connections-mcp-example、subagents-researcher-example

## 第七阶段：面向业务 Agent 的实践

- [ ] 线索导入 Skill、综合研判 Skill、正式报告保存工具、内置工具禁用与覆盖策略、evals 回归、业务报告模板

## 质量维护清单

每次新增或改动文档后，建议同步检查：

- [ ] 侧边栏目录顺序是否清晰
- [ ] 页面标题是否采用中文优先、英文括号的形式
- [ ] 相对链接是否在 GitHub Pages 子路径下可打开
- [ ] 搜索是否还能请求 `/eve-docs-zh/api/search`
- [ ] `llms.txt` 和 `llms-full.txt` 是否能访问
- [ ] 是否有占位页、乱码页或只写了标题的页面
- [ ] 是否需要更新本路线图

## 长期维护节奏

```txt
每周：检查 eve.dev/docs 和 vercel/eve 文档目录变化
每周：抽查 GitHub Pages 部署、搜索和 LLM 文件链接
每月：整理一次已翻译 / 待翻译清单
重大版本：更新核心概念、示例代码和兼容性说明
```
