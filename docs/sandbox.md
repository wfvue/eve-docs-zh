---
title: "Sandbox"
description: "Agent 的隔离工作区。"
---

# Sandbox

Sandbox 是 eve agent 的隔离工作区，用于命令执行、脚本运行和文件读写。它让 Agent 的工作文件和应用运行时分开。

## 要点

- 工作目录是 `/workspace`。
- 默认文件类能力会作用在这里。
- 自定义工具可以通过运行时上下文获取 sandbox 句柄。
- 可以预置 `agent/sandbox/workspace/` 下的文件。
- 生产环境仍需要配置网络、凭据和审计策略。
