---
title: "可观测性（Observability）"
description: "生命周期 instrumentation、OpenTelemetry destinations，以及从 instrumentation.ts 迁移。"
---

# 可观测性（Observability）

官方原文入口：[Instrumentation](https://eve.dev/docs/observability/instrumentation)。公开 URL 在 `/docs/observability/...`；本站镜像 GitHub 路径 `docs/guides/instrumentation/`。

从 `eve 0.62.0` 起，遥测写在 `agent/instrumentation/` 目录，不再用单个 `agent/instrumentation.ts`。

- [Instrumentation](./instrumentation)：按文件处理 runtime 生命周期事件，并控制每个文件收到的内容
- [OpenTelemetry](./otel)：内置 local traces 与第三方 OpenTelemetry destinations
- [迁移 Instrumentation](./migration)：从 `agent/instrumentation.ts` 拆到目录

旧单文件 API 的中文笔记仍保留在 [overview](./overview) 与 [providers](./providers)，不进入官方对齐导航。
