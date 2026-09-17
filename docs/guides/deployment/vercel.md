---
title: "部署到 Vercel"
description: "用 Vercel Workflow、Sandbox、Cron 和项目凭据部署 eve Agent；支持 agents/ 工作区布局。"
---

# 部署到 Vercel

当你希望框架托管构建和 runtime 集成时，把 eve 部署到 Vercel。Vercel 运行 web 服务、workflows、sandboxes、schedules 和部署可观测性。

官方原文：[Deploy to Vercel](https://eve.dev/docs/guides/deployment/vercel)。

## 准备 Vercel 项目

从**项目根**关联到 Vercel 项目。eve agent workspace 请用 workspace 根，不要进成员目录：

```bash
eve link
```

命令会链接已有项目或创建一个，然后拉取环境变量。非交互场景直接点名项目，而不是用 picker：

```bash
eve link --project your_project_name --non-interactive
```

账号能访问多个 team 时再加 `--team`。项目不存在时 `eve link` 会创建它。

## 配置凭据和鉴权

字符串 model ID 通过 [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) 路由。部署用 project OIDC 认证，这条路径不需要 provider API key。

把直接模型提供商、tools 和 connections 的凭据加到 Vercel 项目环境。把 [路由鉴权策略](../auth-and-route-protection) 需要的签名密钥或密码也加上。在浏览器发出生产请求前替换 `placeholderAuth()`。

## 选择 sandbox 后端

不写 sandbox `backend` 时使用 `defaultBackend()`。在 Vercel 上它会选择 Vercel Sandbox。也可以显式选择：

```ts
import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

export default defineSandbox({
  backend: vercel(),
});
```

资源限制、网络策略和生命周期 hooks 见 [沙盒（Sandbox）](../../sandbox)。

**官方说明：** Vercel 构建期间，如果 sandbox 有 `bootstrap()` 或 seed files，eve 会自动创建或复用 sandbox template。构建需要创建 Vercel Sandbox templates 的权限，预热失败会阻断部署。模板与 session 设置见 [sandbox 生命周期](../../sandbox#生命周期lifecycle)。

## 部署 Agent

无前端的单 Agent 项目用 `eve build`。纯 Agent workspace 从 workspace 根跑：eve 为每个成员生成独立构建的 service，以及 `/<name>/eve/v1/*` 传输路由；所有成员部署在**同一个** Vercel 项目。Workspace 成员身份与布局规则见[项目结构](../../concepts/project-structure)。

以 Next.js 为中心的项目用 [`next.config.ts` 里的 `withEve`](../frontend/nextjs) 与 Next 构建命令。若在 `vercel.ts` 里编写更广的 service graph，用下面的配置。

### 与其它 Vercel 服务组合（withEve）

Agent 与其它应用是对等服务时，用 `eve/vercel` 的 `withEve`。它把 workspace Agent 贡献进 Vercel service graph，**不**管理或要求特定前端框架。与 `eve/next` 不同，项目生命周期与 Next.js 分离。两种集成都把 Agent service **一起**部署进同一个 Vercel 项目。

`eve/vercel` 目前要求 `agents/` workspace（即使只有一个成员），**不**支持独立的根 `agent/`。

workspace 里若有对等 Next.js 前端（例如 `apps/web/`），用根 `vercel.ts` 替换 `vercel.json`。前端用普通 Next.js 配置，**不要** `eve/next`：

```ts title="vercel.ts"
import { withEve } from "eve/vercel";

export default await withEve({
  services: {
    web: {
      framework: "nextjs",
      root: "apps/web",
    },
  },
  routes: [
    {
      src: "^(.*)$",
      destination: { type: "service", service: "web" },
    },
  ],
});
```

Vercel 在解析 service graph 前评估 `vercel.ts`。`withEve` 把根 Agent、或每个直接 workspace 成员，加成独立构建的 service，并返回普通 Vercel 配置。命名 workspace Agent 挂在 `/eve/<name>/v1/*`；根 Agent 挂在 `/eve/v1/*`。随后 Vercel 分别构建前端与各 eve Agent。前端不需要在框架配置里再写 `withEve`，也不需要构建 Agent 的 build script。

Web Chat 安装器不支持 agent workspace。前端请用 [React 聊天示例](../frontend/overview#basic-chat-react) 自建，并为每个对外暴露的 Agent 配置鉴权。同一源码布局自托管时，用自己的[进程与代理配置](./self-hosting#run-workspace-members)替换 Vercel 组合。

本地跑完整 service graph：Vercel CLI **59.16.0+**，`vercel dev --local`。命名 Agent 在开发里同样用 `/eve/<name>/v1/*`；默认 `defineWorkspaceAgent` transport 可在无部署凭据时调用同伴。只需要单个 Agent 与 eve 终端 UI 时，改用 `eve dev`。

生成的传输路由插在 filesystem handler 之前（没有则插在 authored routes 之前）。`withEve` 不会覆盖已 authored、且属于生成 Agent 的 service key 或精确传输路由——冲突时抛错：删掉 authored 路由，并移除或重命名 authored service。`services` 数组形式的名字也必须唯一。其它 service 名、路由、bindings、Cron Jobs 仍写在 `vercel.ts`。

一个 Vercel 项目只能有一种配置源：采用 `vercel.ts` 时删掉 `vercel.json`。根 package 依赖里要有 `eve`，以便评估配置时能 `import eve/vercel`。`withEve` 会发现其评估目录所在的 workspace（含 Vercel 临时 `.vercel` 配置目录）。只有需要指定特定 workspace 根时，才把 `{ root: "/absolute/workspace/path" }` 作为第二参数传入。

已 authored、路由在 `/eve/v1` 的 eve service 已使用协议路径；callback 仍在 `/eve/v1/callback/*`。命名挂载如 `/eve/support` 会把该挂载加在协议路径前，得到 `/eve/support/v1/callback/*`。

### 部署项目

从项目根把已链接项目部署到生产：

```bash
eve deploy
```

`eve deploy` 会安装依赖、运行 `vercel deploy --prod`，并在部署后拉取项目环境。也可以推送到 Git-connected Vercel 项目。托管 Vercel 构建会设置 `VERCEL`，所以 `eve build` 把部署 bundle 写到 `.vercel/output`。

非交互场景要事先确认生产部署。`--project` 会先 link，所以新项目不需要单独 `eve link`：

```bash
eve deploy --project your_project_name --non-interactive --yes
```

Vercel 用生成的 output 配置这些服务：

- **Web runtime**：服务 health、session、stream、channel、callback 和 schedule 路由
- **Vercel Workflow**：持久化并恢复 durable runs，开启 optimistic replay preconditions，让过期 event-log snapshot 在提交前重新加载
- **Vercel Cron**：调用编写的 schedules
- **Vercel Sandbox**：运行 `defaultBackend()` 选出的 sandbox sessions

## 验证部署

单个未命名 Agent：检查 health 并连接开发 TUI：

```bash
curl https://your_agent.vercel.app/eve/v1/health
eve dev https://your_agent.vercel.app
```

Workspace Agent 带上公开 `/eve/<name>` 挂载，例如：

```bash
curl https://your_agent.vercel.app/eve/support/v1/health
eve dev https://your_agent.vercel.app/eve/support
```

如果部署开了 Deployment Protection，连接前先在本地设置 `VERCEL_AUTOMATION_BYPASS_SECRET`。

## 在仪表盘查看运行

Vercel 检测到 eve 后，可以在项目 **Observability** 视图下加一个 **Agent Runs** tab，用来浏览 sessions 并检查每段对话的 trace。

Agent Runs tab 需要为你的 Vercel team 开启。看不到时联系 Vercel 代表。第三方 tracing backend 配置见 [可观测性](../instrumentation/overview)。

## 继续配置生产

- [鉴权与路由保护](../auth-and-route-protection)：配置谁能调用已部署的 Agent
- [可观测性](../instrumentation/overview)：导出 traces 并诊断 runtime 失败
- [沙盒（Sandbox）](../../sandbox)：配置资源、隔离和网络访问
