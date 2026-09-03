---
title: "部署到 Vercel"
description: "用 Vercel Workflow、Sandbox、Cron 和项目凭据部署 eve Agent；支持 agents/ 工作区布局。"
---

# 部署到 Vercel

当你希望框架托管构建和 runtime 集成时，把 eve 部署到 Vercel。Vercel 运行 web 服务、workflows、sandboxes、schedules 和部署可观测性。

官方原文：[Deploy to Vercel](https://eve.dev/docs/guides/deployment/vercel)。

## 准备 Vercel 项目

把 Agent 目录关联到 Vercel 项目：

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

## 声明式 Agent 工作区

只包含多个可独立寻址根 Agent 的项目，可用 eve 的 hostless workspace 布局：

```text
my-project/
├── package.json
└── agents/
    ├── support/
    │   └── agent/
    └── research/
        └── agent/
```

存在 `agents/` 目录即标记为 workspace。eve 只校验并发现直接子目录 `agents/<name>/agent/`；目录名成为公开身份，暴露在 `/<name>/eve/v1/*`。在子目录运行 Agent 专用命令，或在 workspace 根传入 `--agent <name>`；省略名称时，交互命令会打开 picker。项目级的 build / link / deploy 从 workspace 根运行。Workspace 根拥有项目 package、依赖和构建脚本。

用 `eve init my-project --agents support,research` 创建该布局，或在已有 workspace 里用 `eve init billing` 再加一个 Agent。

若没有手写 `vercel.json#services`，每次 `eve build` 都会推导完整的 Vercel Services graph。若 `vercel.json` 已声明 `services`，则以手写 graph 为准，并用 `vercel build` 构建与校验整个项目。这样异构项目（前端、私有 API、bindings、其它非 eve 服务）不必依赖生成的配置文件。

## 部署 Agent

把已链接项目部署到生产：

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

检查 health 路由并连接开发 TUI。Workspace 布局下路径带上 Agent 名：

```bash
curl https://your_agent.vercel.app/support/eve/v1/health
eve dev https://your_agent.vercel.app/support
```

如果部署开了 Deployment Protection，连接前先在本地设置 `VERCEL_AUTOMATION_BYPASS_SECRET`。

## 在仪表盘查看运行

Vercel 检测到 eve 后，可以在项目 **Observability** 视图下加一个 **Agent Runs** tab，用来浏览 sessions 并检查每段对话的 trace。

Agent Runs tab 需要为你的 Vercel team 开启。看不到时联系 Vercel 代表。第三方 tracing backend 配置见 [可观测性](../instrumentation)。

## 继续配置生产

- [鉴权与路由保护](../auth-and-route-protection)：配置谁能调用已部署的 Agent
- [可观测性](../instrumentation)：导出 traces 并诊断 runtime 失败
- [沙盒（Sandbox）](../../sandbox)：配置资源、隔离和网络访问
