---
title: "Nuxt"
description: "使用 eve/nuxt module 把 Eve Agent 和 Nuxt 应用作为一个项目运行。"
---

# Nuxt

`eve/nuxt` module 可以把 Nuxt frontend 和 Eve Agent 作为一个项目运行，共用一个 dev server 和一个 Vercel deploy。自动导入的 [`useEveAgent`](../use-eve-agent-vue) composable 会自己找到已挂载 routes，因此不需要配置 CORS，也不需要同步 URL 环境变量。

## 前置条件（Prerequisites）

- 项目中已安装 `eve` 包：`npm install eve@latest`。
- 已有 Eve Agent 目录。没有时先看 [快速开始（Getting started）](../../../getting-started)。
- 一个要挂载 Agent 的 Nuxt app。

## 注册 module（Register the module）

```ts title="nuxt.config.ts"
export default defineNuxtConfig({
  modules: ["eve/nuxt"],
});
```

Module 默认在 Nuxt project root 下查找 `agent/` 文件夹。Agent 在其它位置时，传入 `eveRoot`：

```ts
export default defineNuxtConfig({
  modules: ["eve/nuxt"],
  eve: {
    eveRoot: "../my-agent",
  },
});
```

`eve` key 只接受两个选项：`eveRoot` 和 `eveBuildCommand`。

## 调用 composable（Call the composable）

`useEveAgent`（`eve/vue`）会被自动导入，因此组件中不需要显式 import，也不需要指定 host：

```vue
<script setup lang="ts">
const { status, send } = useEveAgent();

const isBusy = computed(() => status.value === "submitted" || status.value === "streaming");
const message = ref("");

async function handleSubmit() {
  const text = message.value.trim();
  if (!text || isBusy.value) return;
  message.value = "";
  await send({ message: text });
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="message" :disabled="isBusy" />
    <button type="submit" :disabled="isBusy">Send</button>
  </form>
</template>
```

默认 Eve channel 是 fail-closed。没有 authored `agent/channels/eve.ts` 时，Eve 会注册 `eveChannel({ auth: [vercelOidc(), localDev()] })`。要使用自己的 auth policy，请添加 `agent/channels/eve.ts`：

```ts title="agent/channels/eve.ts"
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({ auth: [vercelOidc(), localDev()] });
```

公开 demo 可以使用 `none()` 跳过鉴权。更多见 [Channels](../../../channels/overview) 和 [鉴权与路由保护（Auth & route protection）](../../auth-and-route-protection)。

## 开发与部署拓扑（Dev vs deploy topology）

- **Local dev**：`npm run dev` 会在 `nuxt dev` 旁边启动 Eve dev server，并通过 Nuxt proxy Eve routes。浏览器看到的仍然只有 Nuxt origin。
- **Vercel**：Nuxt app 和 Eve runtime 作为一个 Vercel project 发布。Web app 保持公开，runtime 隐藏在同一 origin 后面。Agent 需要单独 build step 时设置 `eveBuildCommand`：

  ```ts
  export default defineNuxtConfig({
    modules: ["eve/nuxt"],
    eve: {
      eveBuildCommand: "npm run build:eve",
    },
  });
  ```

- **Non-Vercel hosts**：当 Eve service 位于独立 origin 时，使用 `EVE_NUXT_PRODUCTION_ORIGIN` 指定。要覆盖本地端口，默认 `4274`，使用 `EVE_NUXT_PRODUCTION_PORT`：

  ```bash
  EVE_NUXT_PRODUCTION_ORIGIN=https://agent.example.com npm run build
  EVE_NUXT_PRODUCTION_PORT=5000 npm run build && npm run preview
  ```

## 接下来读什么（What to read next）

- [`useEveAgent`（Vue）](../use-eve-agent-vue)：composable API
- [鉴权与路由保护（Auth & route protection）](../../auth-and-route-protection)
- [部署（Deployment）](../../deployment)
