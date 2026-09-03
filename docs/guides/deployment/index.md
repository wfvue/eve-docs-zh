---
title: "部署概览（Overview）"
description: "在 Vercel 与自托管之间选择部署策略，并准备生产环境。"
---

# 部署概览（Overview）

可以把 eve 部署到 Vercel，也可以在自有基础设施上作为 Node 服务运行。部署策略决定构建产物、workflow 存储、sandbox 后端和路由。Agent 基于文件系统的配置在这些策略之间是可移植的。

官方原文：[Deployment overview](https://eve.dev/docs/guides/deployment/overview)。中文站额外保留 [自部署实践](../../deployment/self-hosting) 等工程页，不替代官方 Operate 页。

## 选择部署策略

先决定 eve runtime 跑在哪里：

| 策略 | 构建产物 | Workflows | Sandbox | 什么时候选它 |
| --- | --- | --- | --- | --- |
| [部署到 Vercel](./vercel) | `.vercel/output` | Vercel Workflow | Vercel Sandbox | 希望 Vercel 运营 runtime 服务 |
| [自托管](./self-hosting) | `.output/` Node server | 本地或自定义 Workflow world | Docker、microsandbox 或自定义 | 你自己运营 Node 或容器基础设施 |

eve 与前端无关，可以挂在 Next.js、Nuxt 或 SvelteKit 应用里。见 [前端集成（Frontend）](../frontend/overview)。

## 生产前要满足的运行时要求

1. 运行 `eve build`，编译 Agent 并生成 host output。
2. 提供模型凭据，以及 tools、connections、route authentication 需要的 secrets。
3. 在接受浏览器流量前，把 `placeholderAuth()` 换成生产路由策略。
4. 选择与宿主匹配的 workflow 和 sandbox 实现。
5. 验证 health 路由，并完成一次真实 Agent turn。

`eve build` 总会把编译产物写到 `.eve/`。Vercel 构建还会写 `.vercel/output`。其它宿主的构建把标准 Nitro server 写到 `.output/`。

## 配置凭据

把凭据放在部署环境或 secret manager 里。不要写进源码或编译产物。

模型配置决定需要哪种凭据。字符串 model ID 走 [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)，需要 Vercel project OIDC 或 `AI_GATEWAY_API_KEY`。Provider 编写的模型使用该 provider 的包和 API key。两种形式见 [Agent 配置](../../agent-config#设置模型)。

生产路由鉴权与模型访问分开配置。默认策略会拒绝生产环境的浏览器流量。可用策略和 secret 要求见 [鉴权与路由保护](../auth-and-route-protection)。

## 验证部署

先打公开 health 路由：

```bash
curl https://your_agent.example.com/eve/v1/health
```

然后把开发 TUI 连到部署，发一条真实消息：

```bash
eve dev https://your_agent.example.com
```

如果 Vercel 部署开了 Deployment Protection，先在本地设置 `VERCEL_AUTOMATION_BYPASS_SECRET`。

## 继续看平台指南

- [部署到 Vercel](./vercel)：使用 Vercel Build Output、Workflow、Sandbox、Cron 和可观测性
- [自托管 eve](./self-hosting)：用你管理的基础设施跑 Nitro Node server
- [前端集成](../frontend/overview)：把 eve 挂到 Next.js、Nuxt 或 SvelteKit

**项目建议：** 中文工程实践（Hono 共存、反向代理、内网安全）仍在 [自部署指南](../../deployment/self-hosting)，本目录只对齐官方 Operate 页。
