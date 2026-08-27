---
title: "Agent Client Protocol（ACP）"
description: "从 ACP 客户端使用本地或已部署的 eve Agent。"
---

# Agent Client Protocol（ACP）

[Agent Client Protocol](https://agentclientprotocol.com/)（ACP）客户端可以把一份已编写的 eve 应用作为本地子进程启动。eve 在 stdio 上提供稳定的 ACP v1，同时仍由正常的开发服务器作为执行 runtime。

```sh
eve acp
```

不传 URL 时，客户端从 eve 应用根目录启动一个进程。它会监督本地开发服务器；关闭 ACP 连接会停掉这个由它拥有的服务器。要把 ACP 桥接到已部署的 eve Agent，传入其 URL：

```sh
eve acp https://agent.example.com
```

对可识别的 Vercel 部署，eve 会校验精确 origin，并从本地 Vercel session 解析短时、项目范围的 OIDC token。如果需要登录或 Trusted Sources 变更，先运行 `eve dev` 并完成 `/vc:login`，再启动 ACP。部署配置了 Protection Bypass for Automation token 时，仍可使用 `VERCEL_AUTOMATION_BYPASS_SECRET`。

## 配置 Zed

把 eve 应用根目录作为 Zed workspace 打开。在 **Agent Settings → External Agents** 中添加自定义 Agent：

```json
{
  "agent_servers": {
    "eve-local": {
      "type": "custom",
      "command": "pnpm",
      "args": ["exec", "eve", "acp"],
      "env": {}
    }
  }
}
```

如果 Zed 环境找不到 `pnpm`，使用绝对命令路径。workspace 必须就是 eve 应用根目录；eve 会拒绝不同的 `session/new.cwd`，避免跑错应用。

为此 Agent 禁用 Zed 项目 MCP servers。当前初始 adapter 不接受客户端提供的 MCP servers。

## 支持的行为

ACP 客户端可以收到：

- 流式 assistant 文本和 reasoning
- tool-call 请求和结果
- 一次性工具审批和拒绝
- 客户端支持 ACP form elicitation 时的固定选项和自由文本提问
- 协作式 turn 取消
- 彼此独立的并发 ACP sessions
- session 关闭与进程清理

开发期重建仍遵循 eve 的正常语义：进行中的工作钉在它那一代编译产物上，下一轮 turn 使用最新一次成功编译。

## 安全与能力边界

ACP 模式不会把编辑器宿主文件系统或终端交给 Agent。`session/new.cwd` 只用来识别要启动的 eve 应用，不会挂进 Agent sandbox。

当前初始 adapter **不支持**：

- 已部署的 ACP HTTP 或 WebSocket 端点
- ACP 认证（远程桥接使用已部署 eve Agent 现有的 HTTP 认证）
- ACP v2
- 客户端文件系统或终端方法
- 客户端提供的 MCP servers
- prompt 中的图片、音频、文件或 embedded resources
- 跨进程重启的 session 加载、列表、恢复或 durable ACP ID
- ACP 模型或 mode 配置

Agent 继续使用 eve 应用里编写的 connections、tools、凭据和 sandbox 策略。Prompt 文本和 ACP metadata **不会**建立已认证的终端用户 principal。

## 诊断连接

ACP 把 stdout 保留给换行分隔的 JSON-RPC。eve 把编译输出、服务器日志和诊断发到 stderr，避免污染协议流。

快速无头冒烟测试时，从应用根目录运行 `acpx` 这类 ACP 客户端。`acpx` 会自己启动 ACP 进程，不要另外再跑 `eve acp`。

```sh
npx acpx@latest --agent 'pnpm exec eve acp' exec 'Reply with exactly: ACP works'
```

如果是在 eve 源码 checkout 里测试，请使用一份 authored fixture，不要用 monorepo 根（那里没有 `eve` 可执行文件）：

```sh
cd apps/fixtures/weather-agent
npx acpx@latest --agent 'pnpm exec eve acp' exec 'Reply with exactly: ACP works'
```

启动失败时，同时看 ACP 客户端日志和 eve 的 stderr。非空的客户端 MCP 配置、不匹配的工作目录、以及不支持的 prompt 内容，都会在模型工作开始前给出明确的协议错误。

## 接下来读什么

- [终端 UI（Terminal UI）](../guides/dev-tui)：本地交互式驱动 Agent 的另一条路径
- [远程 Agent（Remote Agents）](../guides/remote-agents)：把另一个 eve 部署当作子智能体调用

官方原文：[Agent Client Protocol (ACP)](https://eve.dev/docs/protocols/acp)。
