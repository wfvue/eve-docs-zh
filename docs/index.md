# Eve 中文文档导航

本目录用于整理 Eve 的中文解释、学习笔记和工程实践。

## 核心概念

- [filesystem-first 是什么](core-concepts/filesystem-first.md)
- [Workflow SDK 原理](core-concepts/workflow-sdk.md)
- [Sandbox 是什么](core-concepts/sandbox.md)

## 部署与运行

- [自部署指南](deployment/self-hosting.md)

## 官方 Guide 解读

- [鉴权与路由保护](guides/auth-and-route-protection.md)

## 工程建议

如果你只做 SPA，不做 SSR，推荐架构是：

```txt
apps/web      # React + Vite SPA
apps/api      # Hono 普通业务 API
apps/agent    # Eve / Workflow Agent Runtime
packages/*    # shared/db/document/agent-core 等共享包
```

Eve 不要求你把前端改成 SSR。Vite 可以继续只负责 SPA，Hono 继续负责业务 API，Eve 独立承担 Agent 会话、工具调用、可恢复 stream 和长任务。

## 重要提醒

Eve 目前仍处于 beta。本文档会尽量跟随上游，但所有准确行为仍以官方文档和源码为准：

- https://eve.dev/docs
- https://github.com/vercel/eve
