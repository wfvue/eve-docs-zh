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

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 文档站基础 | 已完成 | Next.js + Fumadocs + GitHub Pages 静态部署已接入。 |
| 首页视觉 | 已完成 | 首页已改为产品化 landing page，并展示 `llms.txt` / `llms-full.txt`。 |
| 官方一级目录 | 已完成 | 已按 Eve 官方目录补齐根级入口，保留中文补充目录。 |
| 入门文档 | 已完成 | Introduction、Getting Started、agent.ts、Instructions 已翻译。 |
| 核心能力文档 | 进行中 | Tools、Skills、Sandbox、Subagents、Connections、Evals 已重点补齐；Channels、Schedules 仍需继续扩写。 |
| 搜索 | 已接入，需持续验证 | 已接入静态搜索 API 和 Orama static client；GitHub Pages 子路径需要持续检查。 |
| LLM 入口 | 已接入，需持续验证 | 已加入自动生成脚本和兜底文件，提供 `llms.txt` / `llms-full.txt`。 |
| 链接质量 | 进行中 | 已修复 Connections 底部相对链接问题，后续需要全站检查。 |

## 第一阶段：基础骨架与部署

- [x] README
- [x] 文档首页
- [x] Fumadocs 文档结构
- [x] GitHub Pages 部署工作流
- [x] Next.js 静态导出配置
- [x] GitHub Pages basePath / assetPrefix
- [x] 首页产品化视觉优化
- [x] 右侧 About 文档站链接配置说明

## 第二阶段：官方目录对齐

- [x] 保留官方 root 目录结构
- [x] Introduction
- [x] Getting Started
- [x] agent.ts
- [x] Instructions
- [x] Tools
- [x] Skills / 技能
- [x] Channels
- [x] Connections
- [x] Sandbox / 沙盒
- [x] Subagents / 子智能体
- [x] Schedules
- [x] Evals
- [x] Guides
- [x] Concepts
- [x] Patterns
- [x] Reference
- [x] Tutorial

说明：这一阶段的“已完成”表示目录入口已经存在，不代表每个深层页面都已完整翻译。

## 第三阶段：重点文档完整翻译

已优先补齐：

- [x] Connections / 连接
  - [x] Overview
  - [x] MCP Connections
  - [x] OpenAPI Connections
- [x] Evals / 评测
  - [x] Overview
  - [x] Cases
  - [x] Assertions
  - [x] Judge
  - [x] Targets
  - [x] Reporters
  - [x] Running Evals
- [x] Subagents / 子智能体
- [x] Skills / 技能
- [x] Sandbox / 沙盒

接下来优先补齐：

- [ ] Channels / 渠道完整翻译
  - [ ] Eve channel
  - [ ] Slack
  - [ ] Discord
  - [ ] Teams
  - [ ] Telegram
  - [ ] Twilio
  - [ ] GitHub
  - [ ] Linear
  - [ ] Custom channel
- [ ] Schedules / 定时任务完整翻译
- [ ] Guides 高优先级页面
  - [ ] Auth and route protection
  - [ ] Instrumentation
  - [ ] Hooks
  - [ ] Session context
  - [ ] State
  - [ ] Dynamic capabilities
  - [ ] Dynamic workflows
  - [ ] Remote agents
- [ ] TypeScript SDK / Client 文档完整翻译
- [ ] Frontend 集成文档完整翻译

## 第四阶段：核心概念与参考资料补强

- [x] filesystem-first
- [x] Workflow SDK 原理
- [x] 沙盒说明
- [x] 术语表合并到核心概念
- [ ] Sessions / Runs / Streaming 深化
- [ ] Default harness
- [ ] Context control
- [ ] Security model
- [ ] HTTP API reference
- [ ] TypeScript API reference
- [ ] CLI reference
- [ ] Project layout reference

## 第五阶段：中文工程实践专题

- [x] 自部署入口
- [ ] Docker sandbox 实践
- [ ] microsandbox 评估
- [ ] Postgres World 配置
- [ ] DeepSeek provider 接入
- [ ] Hono + Eve 共存
- [ ] Vite SPA + Eve stream 恢复
- [ ] Nginx / Caddy 反向代理
- [ ] 内网部署安全建议
- [ ] GitHub Pages 静态搜索排查指南
- [ ] llms.txt / llms-full.txt 自动生成说明

## 第六阶段：示例项目

- [ ] minimal-agent
- [ ] hono-workflow
- [ ] spa-api-agent
- [ ] deepseek-agent
- [ ] local-postgres-world
- [ ] evals-smoke-example
- [ ] connections-mcp-example
- [ ] subagents-researcher-example

## 第七阶段：面向业务 Agent 的实践

- [ ] 线索导入 Skill 设计
- [ ] 综合研判 Skill 设计
- [ ] 正式报告保存工具设计
- [ ] 内置工具禁用与覆盖策略
- [ ] evals 回归测试用例
- [ ] 业务报告模板沉淀

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

Eve 仍在快速变化，本项目需要持续跟进上游文档和 API。

建议节奏：

```txt
每周：检查 eve.dev/docs 和 vercel/eve 文档目录变化
每周：抽查 GitHub Pages 部署、搜索和 LLM 文件链接
每月：整理一次已翻译 / 待翻译清单
重大版本：更新核心概念、示例代码和兼容性说明
```
