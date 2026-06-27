---
title: "Next.js"
description: "使用 withEve 把 Eve Agent 和 Next.js 应用作为一个项目运行。"
---

# Next.js

`eve/next` 可以把 Next.js frontend 和 Eve Agent 作为一个项目运行。用 `withEve()` 包裹 Next config 后，本地开发时二者共用一个 dev server，部署到 Vercel 时也作为同一个项目发布。[`useEveAgent`](../overview) 会自动找到挂载好的 routes，因此不需要配置 CORS，也不需要维护额外 URL 环境变量。

## 前置条件（Prerequisites）

- 项目中已安装 `eve` 包：`npm install eve@latest`。
- 已有 Eve Agent 目录。没有时先看 [快速开始（Getting started）](../../../getting-started)。
- 一个要挂载 Agent 的 Next.js app。

## 包裹 Next.js 配置（Wrap the Next.js config）

```ts title="next.config.ts"
import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {};

export default withEve(nextConfig);
```

默认情况下，`withEve()` 会在 Next.js project root 内查找 `agent/` 文件夹。如果 Agent 在其它位置，通过 `eveRoot` 指定：

```ts
export default withEve(nextConfig, {
  eveRoot: "../my-agent",
});
```

### `withEve` 选项（`withEve` options）

所有字段都是可选的。

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `eveRoot` | `string` | Next.js app root | Eve app root 路径。默认相对 `process.cwd()`，绝对路径也可用。Agent 不在 Next.js 项目内时设置它。 |
| `eveBuildCommand` | `string` | `"eve build"` | 生成 Eve Vercel service 的构建命令。Agent 需要项目特定 prework，又不想改 Next.js build 时使用。 |
| `servicePrefix` | `string` | `"/_eve_internal/eve"` | Eve service 的私有 Vercel route namespace。手动设置 Vercel Build Output mount 时必须一致。 |
| `devServerTimeoutMs` | `number` | `180000` | 等待 Eve development server 可用的最长时间。 |

冷启动很慢时，可以增加 development timeout：

```ts
export default withEve(nextConfig, {
  devServerTimeoutMs: 300_000,
});
```

## 调用 hook（Call the hook）

配置 `withEve()` 后，Eve routes 是 same-origin。Client code 可以直接调用 [`useEveAgent`](../overview)，不需要指定 host。基于 cookie 的 auth，例如 Auth.js 或任何 session cookie，不需要额外配置，因为浏览器会在每个 Eve request 上自动发送 cookies。非 cookie 方案需要自己附加凭据：

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

- **Local production build**：`next build && next start` 会从构建好的 `.output/server/index.mjs` 在稳定本地端口 `4274` 服务 Eve runtime，并把 Eve routes proxy 过去。先运行 `eve build`，确保 output 存在。可用 `EVE_NEXT_PRODUCTION_PORT` 修改端口：

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
