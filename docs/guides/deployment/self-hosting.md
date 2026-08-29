---
title: "自托管 eve"
description: "把 eve Agent 作为 Node 服务运行，自备 workflow 存储、sandbox 后端和路由。"
---

# 自托管 eve

当你运营 Node 服务、容器平台或反向代理时，自托管 eve。你运行 eve 的 Nitro server，并选择存储 workflows、执行 sandbox sessions 的基础设施。

官方原文：[Self-Host eve](https://eve.dev/docs/guides/deployment/self-hosting)。更偏工程落地的中文实践（Hono、反向代理、内网）见 [自部署指南](../../deployment/self-hosting)，那是项目补充页，不是官方 Operate 页。

## 构建并启动 Node 服务

先构建 Agent，再启动生成的 server：

```bash
eve build
PORT=3000 eve start --host 0.0.0.0
```

构建把 Nitro server 写到 `.output/`。`eve start` 服务该 output，接受 `PORT` 或 `--port`。

把这个进程放进你给其它 Node web 服务用的进程管理器或容器平台。TLS、扩缩、重启和日志收集在那个平台里配置。

## 配置模型访问和路由鉴权

从非 Vercel 宿主走字符串 model ID 时，设置 `AI_GATEWAY_API_KEY`。要直接调用 provider，安装它的 [AI SDK provider 包](https://ai-sdk.dev/docs/foundations/providers-and-models)，在 `agent.ts` 里传入它的 model object，并设置它的 API key。示例见 [Agent 配置](../../agent-config#设置模型)。

不要把 `vercelOidc()` 当作 Vercel 之外唯一的生产 authenticator。配置 Basic auth、JWT 校验、通用 OIDC，或你的宿主能验证的自定义 verifier。见 [鉴权与路由保护](../auth-and-route-protection)。

## 持久化 workflow 状态 {#persist-workflow-state}

默认 local Workflow world 把 run state 存在 `.eve/.workflow-data`。把该目录挂到持久存储上，这样 runs 能撑过进程和容器替换。

也可以在根 `agent.ts` 里选择已安装的 Workflow world 包：

```ts
import { defineAgent } from "eve";

export default defineAgent({
  experimental: {
    workflow: {
      world: "@acme/eve-workflow-world",
    },
  },
});
```

包必须导出 default factory 或 `createWorld()` 函数。凭据和 host 选项从运行时环境变量读取。安装与当前 eve release 同一条 `@workflow/*` 线构建的 world。当前线是 `5.0.0-beta`，runtime 会拒绝不兼容的协议版本。

底层 Workflow SDK 抽象见 [Workflow Worlds](https://workflow-sdk.dev/worlds)。`experimental.workflow.world` 是 beta，可能在任意版本变化。

## 选择 sandbox 后端

`defaultBackend()` 按可用性选择本地 sandbox 后端。也可以为容器、虚拟机或隔离服务选择 Docker、microsandbox 或自定义 `SandboxBackend` adapter。

除非自托管进程确实要创建托管 Vercel sandboxes，否则不要选择 `vercel()`。后端配置和选择顺序见 [沙盒（Sandbox）](../../sandbox)。

## 配置代理路由

反向代理或 ingress 必须同时转发两个 runtime 路由前缀：

- `/eve/` 服务 health、sessions、streams、channels、tools 和 subagents
- `/.well-known/workflow/` 接收 workflow callbacks

只代理 `/eve/` 会让 session 能启动，但 callback 到不了 eve 时 run 会卡住。保留两个前缀，不要改写它们的路径。

## 运行 schedules

标准 `eve build && eve start` 路径会启动 Nitro 的 schedule runner。如果你把 output 适配成自定义 HTTP-only host 或 preset，就要自己跑 Nitro scheduled tasks，或从调度器调用同样的工作。

## 验证服务

代理和鉴权配置生效后检查 health 路由：

```bash
curl https://your_agent.example.com/eve/v1/health
```

然后连接开发 TUI，完成一次真实 turn：

```bash
eve dev https://your_agent.example.com
```

## 继续配置生产

- [鉴权与路由保护](../auth-and-route-protection)：配置宿主的路由策略
- [可观测性](../instrumentation)：导出 traces 并诊断 runtime 失败
- [沙盒（Sandbox）](../../sandbox)：选择并加固 sandbox 后端
