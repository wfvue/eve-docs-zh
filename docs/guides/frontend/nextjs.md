---
title: "Next.js"
description: "使用 withEve 把 Eve Agent 和 Next.js 应用作为一个项目运行。"
---

# Next.js

`eve/next` 把 Next.js 应用接到一个或多个 eve Agent。用 `withEve(nextConfig)` 包裹 Next 配置后，用一条开发命令跑应用与 Agent，并作为同一个 Vercel 项目部署。浏览器请求走同源路由；Agent runtime 仍是独立 service。

当 **Next.js 拥有**应用的开发与部署生命周期时，用这个集成。若前端是 agent workspace 的对等方，在 Vercel 上用 [`eve/vercel`](../deployment/vercel#compose-agents-with-other-vercel-services) 组合，或用[自托管进程管理器与代理](../deployment/self-hosting#run-workspace-members)。对等前端可以只用 `eve/react`，不必 `eve/next`。取舍见[项目结构](/docs/concepts/project-structure#configure-a-web-deployment)。

## 前置条件（Prerequisites）

- 项目中已安装 `eve` 包：`npm install eve@latest`。
- 已有 Eve Agent 目录。没有时先看 [快速开始](../../../getting-started)。
- 一个 Next.js app，或单 Agent 项目且希望在下面生成一个。

## 添加生成的 Web Chat 应用

单 Agent 项目可安装生成的 Next.js Web Chat：

```bash
eve add channel/web
```

安装器会加入 Next.js 应用，并用 `withEve()` 包裹 `next.config.ts`。生成的聊天通过同源 `/eve/v1/*` 调用未命名 Agent。

接受生产浏览器流量前，请替换生成的占位鉴权策略。见[鉴权浏览器请求](./overview#authenticate-browser-requests)。

Web Chat 安装器**不支持** eve agent workspace。若希望由 Next.js 托管集成，请自建根级 Next.js 应用并按下列步骤操作；`withEve(nextConfig)` 会发现 workspace 成员，但不会生成聊天 UI。要把前端保持为对等应用，见[workspace 布局指引](/docs/concepts/project-structure#configure-a-web-deployment)。

## 包裹 Next.js 配置（Wrap the Next.js config）

```ts title="next.config.ts"
import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {};

export default withEve(nextConfig);
```

默认情况下，`withEve(nextConfig)` 会在 Next.js project root 内查找 `agent/`，并把 API 挂到 `/eve/v1/*`。当项目根本身是带 `agents/<name>/` 成员的 eve workspace 时，它会**自动发现**每个成员，并分别挂到 `/eve/<name>/v1/*`。这种布局不需要显式 `agents` map。

单个 Agent 在别处时，用 `eveRoot` 指向它：

```ts
export default withEve(nextConfig, {
  eveRoot: "../my-agent",
});
```

## 挂载 workspace 外的 Agent

要挂载**不属于**项目级 `agents/` workspace 的 Agent，用 `agents`。字符串值是 Agent root；对象值可覆盖该 Agent 的 build 命令或私有 production service 前缀：

```ts
export default withEve(nextConfig, {
  agents: {
    support: "./apps/support-agent",
    billing: {
      root: "./apps/billing-agent",
      buildCommand: "pnpm build:billing-agent",
      servicePrefix: "/_eve_internal/billing",
    },
  },
});
```

命名 Agent 挂在 `/eve/<name>/v1/*`。React 侧用 `agent` 选对应实例：

```tsx
const support = useEveAgent({ agent: "support" });
const billing = useEveAgent({ agent: "billing" });
```

`eveRoot` 与 `agents` 二选一：`eveRoot` 仍是单个未命名 Agent（挂在 `/eve/v1/*`）的简写。生成的 Agent service 会把 `EVE_PUBLIC_ROUTE_PREFIX` 设为该 Agent 的公开 mount（例如 `/eve/support`），以便 OAuth / 远程子智能体回调落到公开路径。

### `withEve` 选项（`withEve` options）

所有字段都是可选的。

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `eveRoot` | `string` | Next.js app root | 单个未命名 Eve app root（相对 `process.cwd()`，也可绝对路径）。不要与 `agents` 同用。 |
| `agents` | `Record<string, ...>` | workspace 可推断 | 命名 Agent 挂到 `/eve/<name>/v1/*`。未设 `agents` / `eveRoot` 时，`withEve()` 会发现项目级 `agents/<name>/`；否则每个值是 root 字符串或 `{ root, buildCommand?, servicePrefix? }`。 |
| `eveBuildCommand` | `string` | 生成 | 生成 Eve Vercel service 的默认构建命令；多 Agent 时作为未自带 `buildCommand` 者的默认。 |
| `servicePrefix` | `string` | `"/_eve_internal/eve"` | 私有 route namespace（遗留手动 Vercel service / 非 Vercel 生产代理）。命名 Agent 会从此前缀派生唯一默认值。 |
| `devServerTimeoutMs` | `number` | `180000` | 等待每个 Eve development server 可用的最长时间。 |

冷启动很慢时，可以增加 development timeout：

```ts
export default withEve(nextConfig, {
  devServerTimeoutMs: 300_000,
});
```

## 调用 hook（Call the hook）

单个未命名 Agent：调用 [`useEveAgent`](./overview) 时不必传 `agent` 或 `host`。命名 Agent（无论来自 workspace 发现还是显式配置）传入名称：

```tsx
"use client";

import { useEveAgent } from "eve/react";

export function SupportStatus() {
  const support = useEveAgent({ agent: "support" });
  return <p>{support.status}</p>;
}
```

渲染消息与发送 turn 见[基础聊天](./overview#basic-chat-react)。

基于 cookie 的 auth（Auth.js 或任意 session cookie）通常无需额外接线，浏览器会在每个 eve 请求上带上 cookie。非 cookie 方案自行附加凭据：

```tsx
const agent = useEveAgent({
  headers: async () => ({
    authorization: `Bearer ${await getAccessToken()}`,
  }),
});
```

默认 Eve channel 是 fail-closed。没有 authored `agent/channels/eve.ts` 时，Eve 注册的是 `eveChannel({ auth: [vercelOidc(), localDev()] })`：`vercelOidc()` 先尝试解析 Vercel caller，`localDev()` 放行剩余 localhost requests，其它全部返回 `401`。要使用你自己的 auth policy，请添加 `agent/channels/eve.ts`：

```ts title="agent/channels/eve.ts"
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({ auth: [vercelOidc(), localDev()] });
```

公开 demo 可以使用 `none()` 跳过鉴权。更多见 [Channels](../../../channels/overview) 和 [鉴权与路由保护（Auth & route protection）](../../auth-and-route-protection)。

## 开发与部署拓扑（Dev vs deploy topology）

- **Local dev**：`npm run dev` 会在 `next dev` 旁边启动 Eve dev server，并把 Eve routes rewrite 到它。浏览器只访问 Next.js origin。
- **Vercel**：Web app 和 Eve runtime 作为同一个项目部署。Web app 保持公开，Eve runtime 隐藏在同一 site origin 后面。Agent 需要自己的 build step 时，设置 `eveBuildCommand`：

  ```ts
  export default withEve(nextConfig, {
    eveBuildCommand: "npm run build:eve",
  });
  ```

- **Local production build**：`next build && next start` 会从构建好的 `.output/server/index.mjs` 在稳定本地端口 `4274` 服务 Eve runtime，并把 Eve routes proxy 过去。先运行 `eve build`，确保 output 存在。在 `agents/` workspace 中，请先在每个 `agents/<name>/` 目录构建成员，再启动 Next.js。可用 `EVE_NEXT_PRODUCTION_PORT` 修改端口：

  ```bash
  EVE_NEXT_PRODUCTION_PORT=5000 npm run build && npm start
  ```

- **Non-Vercel hosts**：当 Eve service 在单独 origin 上时，通过 `EVE_NEXT_PRODUCTION_ORIGIN` 告诉 Next.js 目标地址：

  ```bash
  EVE_NEXT_PRODUCTION_ORIGIN=https://agent.example.com npm run build
  ```

## 接下来读什么（What to read next）

- [前端概览（Frontend overview）](../overview)：`useEveAgent` API
- [鉴权与路由保护（Auth & route protection）](../../auth-and-route-protection)
- [部署（Deployment）](../../deployment)
