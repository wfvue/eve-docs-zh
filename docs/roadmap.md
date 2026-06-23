---
title: "路线图"
description: "Eve 中文文档项目的阶段目标与维护节奏。"
---

# 文档路线图

本项目按“先解释核心概念，再补工程实践，再补示例项目”的顺序推进。

## 第一阶段：基础骨架

- [x] README
- [x] 文档首页
- [x] filesystem-first
- [x] Workflow SDK 原理
- [x] Sandbox
- [x] 自部署
- [x] 鉴权与路由保护
- [x] 术语表

## 第二阶段：核心文档补全

- [ ] instructions
- [ ] tools
- [ ] skills
- [ ] sessions / runs / streaming
- [ ] built-in tools
- [ ] subagents
- [ ] channels
- [ ] connections
- [ ] schedules
- [ ] hooks
- [ ] instrumentation
- [ ] evals

## 第三阶段：自部署专题

- [ ] Docker sandbox 实践
- [ ] microsandbox 评估
- [ ] Postgres World 配置
- [ ] DeepSeek provider 接入
- [ ] Hono + Eve 共存
- [ ] Vite SPA + Eve stream 恢复
- [ ] Nginx/Caddy 反向代理
- [ ] 内网部署安全建议

## 第四阶段：示例项目

- [ ] minimal-agent
- [ ] hono-workflow
- [ ] spa-api-agent
- [ ] deepseek-agent
- [ ] local-postgres-world

## 第五阶段：面向业务 Agent 的实践

- [ ] 线索导入 Skill 设计
- [ ] 综合研判 Skill 设计
- [ ] 正式报告保存工具设计
- [ ] 内置工具禁用与覆盖策略
- [ ] evals 回归测试用例

## 长期维护

Eve 仍处于 beta，本项目需要定期跟进上游文档和 API 变化。

建议维护节奏：

```txt
每周：检查 eve.dev/docs 和 vercel/eve changelog
每月：整理一次变更记录
重大版本：更新核心概念和示例代码
```
