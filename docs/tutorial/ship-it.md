---
title: "上线（Ship It）"
description: "Build an Agent 教程第 9 步：用 useEveAgent 给 Agent 加 Web 仪表盘，替换 placeholderAuth，并部署到 Vercel。"
---

# 上线（Ship It）

分析助手在 TUI 里跑得很好。现在真正上线：作为你的团队登录的 Web 仪表盘，在真实认证后面，部署在 Vercel 上。有三块要接：一个 React UI、channel 的认证，以及部署本身。

## 添加 Web Chat 应用

第 1 步脚手架 Agent 时没有 web 前端。现在从 `analytics-assistant/` 目录运行 `eve add channel/web` 添加一个：

```sh
npx eve add channel/web
```

这会添加一个 Next.js 应用（`next.config.ts`、`app/page.tsx`、`app/_components/`），接到现有 eve channel，外加聊天 UI 组件和它们的依赖。之后运行 `npm install` 安装添加的包。生成的 `next.config.ts` 用 `withEve` 包装你的配置，自动接通 eve 路由：

```ts title="next.config.ts"
import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {};

export default withEve(nextConfig);
```

## 用 `useEveAgent` 做仪表盘

仪表盘对话内置 eve HTTP channel（`agent/channels/eve.ts`）。在浏览器侧，`useEveAgent` 处理 session 创建、流式输出和 HITL。脚手架从 `app/_components/agent-chat.tsx` 渲染它的聊天，由 `app/page.tsx` 挂载。那个组件比你需要起步的更完整，所以把它的内容换成这个最小版本：

```tsx title="app/_components/agent-chat.tsx"
"use client";
import { useEveAgent } from "eve/react";

export function AgentChat() {
  const agent = useEveAgent();
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const message = String(data.get("q") ?? "").trim();
        if (message) void agent.send(message);
      }}
    >
      {agent.data.messages.map((message) => (
        <article key={message.id}>
          <header>{message.role}</header>
          {message.parts.map((part, index) =>
            part.type === "text" ? <p key={index}>{part.text}</p> : null,
          )}
        </article>
      ))}
      <input name="q" disabled={isBusy} placeholder="Ask about the data…" />
      <button type="submit" disabled={isBusy}>
        Ask
      </button>
    </form>
  );
}
```

生成的 `app/page.tsx` 已经 import 并渲染这个 `AgentChat` 导出，所以不需要其他接线：

```tsx title="app/page.tsx"
import { AgentChat } from "@/app/_components/agent-chat";

export default function Page() {
  return <AgentChat />;
}
```

`agent.data.messages` 和 `agent.status` 覆盖大多数聊天 UI。Hook 也浮出 HITL 提示（第 8 步的支出审批），所以仪表盘可以渲染 approve/cancel 控件。完整 API 见 [前端（Frontend）](../guides/frontend/overview)。

## 替换 `placeholderAuth`

脚手架的 channel 带 `placeholderAuth()`，它 fail-closed。它拒绝生产流量，让未认证应用不会意外上线。部署前把它换成你应用的真实认证。

你的认证住在一个把请求变成用户的模块里。创建 `agent/lib/auth.ts`，在这里接你的真实 provider（cookie session、Auth.js、Clerk）。下面的 stub 返回固定用户，让页面端到端编译运行：

```ts title="agent/lib/auth.ts"
export interface AppUser {
  id: string;
  team: string;
}

// Replace with your real session/provider lookup.
export async function authenticate(_request: Request): Promise<AppUser | null> {
  return { id: "demo-user", team: "growth" };
}
```

现在把 channel 指向它。替换 `agent/channels/eve.ts` 的内容（第 7 步留了一个仅 dev 的 `devTeam` 条目和 `placeholderAuth()`）。把你的应用 auth 列在最前，在 catch-all helpers 之前，这样任何不识别调用者的条目都会落到下一个：

```ts title="agent/channels/eve.ts"
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc, type AuthFn } from "eve/channels/auth";
import { authenticate } from "../lib/auth";

const appAuth: AuthFn<Request> = async (request) => {
  const user = await authenticate(request); // your cookie/session/provider
  if (!user) return null;
  return {
    attributes: { team: user.team }, // the claim Step 7's playbook reads
    principalType: "user",
    principalId: user.id,
    authenticator: "app",
    issuer: "analytics-dashboard",
  };
};

export default eveChannel({
  auth: [appAuth, vercelOidc(), localDev()],
});
```

那个 `team` attribute 正是第 7 步的动态手册从 `ctx.session.auth` 读取的东西。身份在这一点设置，并从那里流向每个能力。

## 部署到 Vercel

```sh
vercel deploy
```

在 Vercel 上，web 应用保持公开，eve runtime 在它后面同源，sandbox 运行在 Vercel Sandbox 上。你可以不离开 CLI 冒烟测试部署：

```sh
npx eve dev https://your-analytics-app.vercel.app
```

这就是完整的助手：已部署、已认证。它查询仓库、在 sandbox 里运行分析、绘制结果图表、记住团队的术语、按团队加载正确手册，并在花钱之前询问。

## 你学到了什么

跨九步你构建并上线了一个 Agent，沿途用了：

- **工具（Tools）** 给模型类型化动作（`run_sql`、`chart_series`、`define_metric`）。
- **连接（Connections）** 通过 OAuth MCP 触达仓库，带 eve 为你解析的 per-user tokens。
- **Sandbox** 在隔离的 `/workspace` 里做 SQL 之外的计算和绘图。
- **状态（State）**（`defineState`）跨 turn 记住团队的术语表。
- **动态技能（Dynamic skills）**（`defineDynamic`）按调用者加载正确团队手册。
- **Human-in-the-loop** 审批（`approval`）门禁昂贵查询。
- **Channel 认证** 把请求变成已认证 principal。
- **部署（Deployment）** 到 Vercel，runtime 在你的 web 应用后面。

## 下一步

- [MCP 连接（MCP connections）](../connections/mcp)：工具 allowlists 和 per-connection 审批。
- [Sandbox](../sandbox)：后端、生命周期和网络策略。
- [动态能力（Dynamic capabilities）](../guides/dynamic-capabilities)：在这个同样的示例上做 schema 派生的动态工具、只读分析子智能体和模型编写的报告工作流。
- [鉴权与路由保护（Auth and route protection）](../guides/auth-and-route-protection)：生产认证模式。

了解更多：[前端（Frontend）](../guides/frontend/overview) · [鉴权与路由保护（Auth and route protection）](../guides/auth-and-route-protection) · [部署（Deployment）](../guides/deployment)
