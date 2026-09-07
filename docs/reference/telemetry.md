---
title: "CLI 遥测（Telemetry）"
description: "了解 eve CLI 遥测收集哪些数据，以及如何关闭或调试。"
---

# CLI 遥测（Telemetry）

eve 会收集 CLI 使用数据，用来改进命令与开发体验。你可以随时关闭遥测。

官方原文：[CLI Telemetry](https://eve.dev/docs/reference/telemetry)。

> **官方说明：** Eve 仍处于 beta；遥测默认开启，关闭后不会影响命令本身。

## 收集什么

eve 会向 Vercel 发送：

- eve 版本、操作系统、CPU 架构，以及 stdin 是否为终端。
- 你运行的命令，以及成功、用法错误或失败。
- 对 `eve dev`：连到本地还是远程 Agent，以及 UI 是交互还是 headless。
- CLI session、本机 eve 安装、以及项目的随机标识符。

项目标识符只用来把同一项目的用量归在一起，**不会**发送项目名或路径。有 Git remote 时从 remote 派生，否则用 `REPOSITORY_URL` 或工作目录，发送前会做变换。

## 不收集什么

eve **不**收集：命令参数、prompts、Agent 文件、URL、请求头、错误消息、环境变量、文件路径或文件内容。

## 查看遥测数据

设 `EVE_TELEMETRY_DEBUG=1` 时，把本批遥测打印到 stderr，而不是发送：

```bash
EVE_TELEMETRY_DEBUG=1 eve info
```

## 关闭遥测

对本机永久关闭：

```bash
eve telemetry disable
```

查看状态或重新打开：

```bash
eve telemetry status
eve telemetry enable
```

只对单次命令关闭、且不改已保存偏好：

```bash
EVE_TELEMETRY_DISABLED=1 eve dev
```

交互式终端上，eve 在首次收集前会显示一次说明。偏好保存在平台用户配置目录。CI / Docker 里每次调用使用内存中的新标识符，不落盘。

Vercel 按 [Vercel Privacy Notice](https://vercel.com/legal/privacy-notice) 处理 CLI 遥测。

## 项目建议

- 公司策略禁止外发用量时，在镜像 / CI 里默认设 `EVE_TELEMETRY_DISABLED=1`，或在入职脚本里跑 `eve telemetry disable`。
- 排障时先用 `EVE_TELEMETRY_DEBUG=1` 确认 payload 是否符合预期，再决定是否长期关闭。
