---
title: "SvelteKit"
description: "使用 eveSvelteKit Vite plugin 把 Eve Agent 和 SvelteKit 应用作为一个项目运行。"
---

# SvelteKit

`eve/sveltekit` 可以把 SvelteKit frontend 和 Eve Agent 作为一个项目运行，而不是两个服务。`eveSvelteKit()` Vite plugin 会让二者共享一个 dev server 和一个 Vercel deploy，[`useEveAgent`](../use-eve-agent-svelte) 会自动找到已挂载 routes。不需要配置 CORS，也不需要同步 URL 环境变量。

## 前置条件（Prerequisites）

- 项目中已安装 `eve` 包：`npm install eve@latest`。
- 已有 Eve Agent 目录。没有时先看 [快速开始（Getting started）](../../../getting-started)。
- 一个要挂载 Agent 的 SvelteKit app。

## 注册 Vite plugin（Register the Vite plugin）

把 `eveSvelteKit()` 放在 `sveltekit()` 前面：

```ts title="vite.config.ts"
import { sveltekit } from "@sveltejs/kit/vite";
import { eveSvelteKit } from "eve/sveltekit";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [eveSvelteKit(), sveltekit()],
});
```

Plugin 默认在 SvelteKit project root 下查找 `agent/` 文件夹。Agent 在其它位置时，传 `eveRoot`：

```ts
export default defineConfig({
  plugins: [
    eveSvelteKit({
      eveRoot: "../my-agent",
    }),
    sveltekit(),
  ],
});
```

Plugin 只接受两个选项：`eveRoot` 和 `eveBuildCommand`。

## 调用 binding（Call the binding）

配置 plugin 后，组件从 `eve/svelte` 调用 [`useEveAgent`](../use-eve-agent-svelte)，不需要传 host：

```svelte
<script lang="ts">
  import { useEveAgent } from "eve/svelte";

  const agent = useEveAgent();
  let message = $state("");
  let isBusy = $derived(agent.status === "submitted" || agent.status === "streaming");

  async function handleSubmit() {
    const text = message.trim();
    if (!text || isBusy) return;
    message = "";
    await agent.send({ message: text });
  }
</script>

<form onsubmit={(event) => {
  event.preventDefault();
  void handleSubmit();
}}>
  <input bind:value={message} disabled={isBusy} />
  <button type="submit" disabled={isBusy}>Send</button>
</form>
```

默认 Eve channel 是 fail-closed。没有 authored `agent/channels/eve.ts` 时，Eve 会注册 `eveChannel({ auth: [vercelOidc(), localDev()] })`。要设置自己的 auth policy，请添加：

```ts title="agent/channels/eve.ts"
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({ auth: [vercelOidc(), localDev()] });
```

公开 demo 可以使用 `none()` 跳过鉴权。更多见 [Channels](../../../channels/overview) 和 [鉴权与路由保护（Auth & route protection）](../../auth-and-route-protection)。

## 开发与部署拓扑（Dev vs deploy topology）

- **Local dev**：`npm run dev` 会在 SvelteKit 旁边启动 Eve dev server，并把 Eve routes proxy 到它，所以浏览器只访问 SvelteKit origin。`npm run build && npm run preview` 行为类似，preview server 会有自己的 Eve route proxy，并复用共享 Eve server 或启动一个。
- **Vercel**：SvelteKit app 和 Eve runtime 作为一个项目部署。Web app 是公开的，Eve runtime 位于同一 origin 后面。Agent 需要项目特定 build 时，设置 `eveBuildCommand`：

  ```ts
  export default defineConfig({
    plugins: [
      eveSvelteKit({
        eveBuildCommand: "npm run build:eve",
      }),
      sveltekit(),
    ],
  });
  ```

- **Non-Vercel hosts**：当 Eve service 位于独立 origin 时，直接把 `host` 传给 `useEveAgent`：

  ```ts
  const agent = useEveAgent({
    host: "https://agent.example.com",
  });
  ```

## 接下来读什么（What to read next）

- [`useEveAgent`（Svelte）](../use-eve-agent-svelte)：binding API
- [鉴权与路由保护（Auth & route protection）](../../auth-and-route-protection)
- [部署（Deployment）](../../deployment)
