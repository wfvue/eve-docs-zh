---
title: "上线（Ship It）"
description: "Build an Agent 教程第 8 步：用 useEveAgent 给 Agent 加 Web 仪表盘，替换 placeholderAuth，并部署到 Vercel。"
---

# 上线（Ship It）

分析助手在 TUI 里运行。现在加上 Web 仪表盘，并在 Vercel 上部署一个私有的单用户版本。本例用用户名和密码保护示例应用，不需要再接另一套认证服务。

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

## 使用生成的聊天组件

保留生成的 `app/_components/agent-chat.tsx` 与 `agent-message.tsx`。`app/page.tsx` 已经渲染聊天，`useEveAgent` 处理 session 创建与流式输出。

生成 UI 会展示工具结果与错误、授权链接、审批按钮和提问表单。[守护支出](./guard-the-spend) 的支出审批需要这些控件才能恢复等待中的 turn。只渲染文本消息的组件会让这些交互不可用。

运行 `npm run dev`，打开 server 打印的本地 Web URL，问一个无过滤的收入查询。确认审批会出现，批准后查询能完成。流程通了再自定义 UI；见 [前端（Frontend）](../guides/frontend/overview)。

## 替换 `placeholderAuth`

脚手架的 channel 带 `placeholderAuth()`，会拒绝未认证的生产请求。换成在每次请求上核对凭证的 verifier。切勿在不检查请求的情况下返回固定用户。

创建 `agent/lib/auth.ts`。这里使用 eve 的 HTTP Basic verifier，并以常数时间比较密码。缺少环境变量、缺少凭证、凭证错误都会 fail-closed：

```ts title="agent/lib/auth.ts"
import { verifyHttpBasic, withAuthChallenges } from "eve/channels/auth";

export const appAuth = withAuthChallenges(
  (request: Request) => {
    const username = process.env.ANALYTICS_USERNAME;
    const password = process.env.ANALYTICS_PASSWORD;
    if (!username || !password) return null;

    if (request.headers.has("origin") && request.headers.get("sec-fetch-site") !== "same-origin")
      return null;

    const result = verifyHttpBasic(request.headers.get("authorization"), { username, password });
    if (!result.ok) return null;

    return {
      ...result.sessionAuth,
      attributes: { team: "growth" },
      issuer: "analytics-tutorial",
    };
  },
  [{ scheme: "Basic", parameters: { realm: "analytics", charset: "UTF-8" } }],
);
```

替换 `agent/channels/eve.ts`，去掉早先的 `devTeam` 条目。eve channel 对 session 创建、消息、控件和流都会检查 `appAuth`。其余 helper 保留已认证的 Vercel CLI 访问与本地开发：

```ts title="agent/channels/eve.ts"
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";
import { appAuth } from "../lib/auth";

export default eveChannel({
  auth: [appAuth, vercelOidc(), localDev()],
});
```

验证后的用户名成为 user principal。`growth` 团队会选中 [团队手册](./team-playbooks) 里的示例手册。把这些凭证只留给一个人。共享密码不会给每个人独立身份或隔离 session。多用户应用请用真实 session provider，并强制 [session ownership](../guides/auth-and-route-protection#what-reaches-ctxsessionauth)。

在项目根添加 `proxy.ts`，让打开仪表盘时触发浏览器原生用户名/密码提示。它保护生成的 UI 路由；eve API 路由仍走 channel auth，因此 OIDC 认证的 CLI 请求不会撞上仅浏览器的门禁：

```ts title="proxy.ts"
import { routeAuth } from "eve/channels/auth";
import { NextResponse } from "next/server";
import { appAuth } from "./agent/lib/auth";

export async function proxy(request: Request) {
  if (process.env.NODE_ENV === "development") return NextResponse.next();
  const result = await routeAuth(request, appAuth);
  return result instanceof Response ? result : NextResponse.next();
}

export const config = { matcher: ["/", "/s/:path*"] };
```

登录后，浏览器会在生成聊天的同源请求上带上凭证。当浏览器发送 `Origin` 头时，Basic verifier 还要求 [`Sec-Fetch-Site: same-origin`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site)。认证模块保持在服务端：不要把密码放进 React 组件、`NEXT_PUBLIC_` 变量或客户端 `useEveAgent` 选项。部署的 HTTP Basic 请使用 HTTPS。

## 部署到 Vercel

从 `analytics-assistant/` link 一个 Vercel 项目，并添加用户名与足够长的唯一密码。这些命令会交互式提示输入，避免密码进入 shell 历史：

```sh
npx vercel@latest link
npx vercel@latest env add ANALYTICS_USERNAME preview
npx vercel@latest env add ANALYTICS_PASSWORD preview
```

部署前，在项目的 Preview 环境配置 Agent 使用的模型凭证；本地 `.env` 不会随部署上传。若本地用过 ChatGPT 订阅，请把 `agent/agent.ts` 换成 AI Gateway 模型，并为该模型配置 `AI_GATEWAY_API_KEY`。订阅凭证留在笔记本上。模型与 runtime 配置见 [部署（Deployment）](../guides/deployment/overview)。

```sh
npx vercel@latest deploy
```

打开 HTTPS preview URL，输入配置的用户名和密码。创建 session 并问一个示例数据问题。在隐私窗口取消登录提示，确认仪表盘被拒绝。不带凭证的 `POST /eve/v1/session` 也必须返回 `401`。

已认证 Web 应用与 eve runtime 同源，sandbox 跑在 Vercel Sandbox。也可以通过已认证 CLI 冒烟测试部署：

```sh
npx eve dev https://your-analytics-app.vercel.app
```

生产部署时，也把用户名、密码和模型凭证加到 Production 环境，然后运行 `npx vercel@latest deploy --prod`。缺少 Basic 凭证会保持浏览器访问关闭。

这个私有助手查询示例数据、在 sandbox 里做分析、绘制图表、记住定义、加载 Growth 手册，并在昂贵查询前征求确认。

## 你学到了什么

跨八步你构建并上线了一个 Agent，沿途用了：

- **工具（Tools）** 给模型类型化动作（`run_sql`、`chart_series`、`define_metric`）。
- **Sandbox** 在隔离的 `/workspace` 里做 SQL 之外的计算和绘图。
- **状态（State）**（`defineState`）跨 turn 记住团队的术语表。
- **动态技能（Dynamic skills）**（`defineDynamic`）按调用者加载正确团队手册。
- **Human-in-the-loop** 审批（`approval`）门禁昂贵查询。
- **Channel 认证** 把请求变成已认证 principal。
- **部署（Deployment）** 到 Vercel，runtime 在你的 web 应用后面。

## 下一步

- 有数据服务要替换示例数据集时，见 [连接仓库](./connect-a-warehouse)。
- [MCP 连接（MCP connections）](../connections/mcp)：工具 allowlists 和 per-connection 审批。
- [Sandbox](../sandbox)：后端、生命周期和网络策略。
- [动态能力（Dynamic capabilities）](../guides/dynamic-capabilities)：在这个同样的示例上做 schema 派生的动态工具、只读分析子智能体和模型编写的报告工作流。
- [鉴权与路由保护（Auth and route protection）](../guides/auth-and-route-protection)：生产认证模式。

了解更多：[前端（Frontend）](../guides/frontend/overview) · [鉴权与路由保护（Auth and route protection）](../guides/auth-and-route-protection) · [部署（Deployment）](../guides/deployment/overview)
