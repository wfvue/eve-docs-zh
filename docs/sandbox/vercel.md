---
title: "Vercel Sandbox"
description: "在 Vercel 上创建基于 snapshot 的持久 sandbox。"
---

# Vercel Sandbox

官方原文：[Vercel Sandbox](https://eve.dev/docs/sandbox/vercel)。

`VercelSandbox.environment()` 会准备可复用的 Vercel Sandbox snapshot，并用记录的 snapshot ID 创建持久 session sandbox。

```ts
import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";

export const environment = VercelSandbox.environment({
  prepare: async (sandbox) => {
    await sandbox.run({ command: "pnpm install --frozen-lockfile" });
  },
});

export default defineSandbox(() =>
  environment.open({
    networkPolicy: {
      allow: {
        "api.github.com": [],
      },
    },
    resources: { vcpus: 4 },
  }),
);
```

## Snapshot 准备

构建时 eve 创建临时持久 Vercel Sandbox，安装基础 runtime，写入 managed workspace 与 skill 文件，跑 authored `prepare`，再捕获 snapshot。构建 artifact 记录 snapshot ID。

活 session sandbox 尚不存在时，eve **直接**从该 snapshot ID 创建，runtime 不必再查找临时 template Sandbox。

## open 之后初始化

在 `open()` 之后、返回 sandbox 之前，初始化**仅属于本 session** 的状态。下面选择器把配置写进持久 `/workspace`：

```ts
import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";

export const environment = VercelSandbox.environment();

export default defineSandbox(async ({ session }) => {
  const sandbox = await environment.open();
  await sandbox.writeTextFile({
    content: JSON.stringify({ sessionId: session.id, workspace: "analysis" }),
    path: ".eve/session.json",
  });
  return sandbox;
});
```

选择器会跑到初始化成功为止。之后的 workflow step 与进程重启 resume 同一 provider 状态，**不会**重跑选择器，因此文件不会在每个边界被重写。

也可以在返回前配置活 sandbox 并跑 setup 命令：

```ts
export default defineSandbox(async () => {
  const sandbox = await environment.open();
  await sandbox.setNetworkPolicy("deny-all");
  const result = await sandbox.run({ command: "mkdir -p .cache/app" });
  if (result.exitCode !== 0) throw new Error(result.stderr);
  return sandbox;
});
```

> **项目建议：** 不可变、每个新 session 都应继承的安装放进 environment 的 `prepare`；只属于一个 durable session 的状态放在 open 之后的初始化里。

## 网络策略

把初始策略传给 `open()`。它作用在**新活** Vercel Sandbox 上，不是 environment 定义本身：

```ts
return environment.open({
  networkPolicy: {
    allow: {
      "api.example.com": [
        {
          transform: [{ headers: { authorization: `Bearer ${token}` } }],
        },
      ],
    },
  },
});
```

Credential transforms 在网络边界注入 header，密钥不会进入 sandbox 进程。专用 Vercel environment 返回的 session **要求**有 `setNetworkPolicy()`，因此 `open()` 之后可直接更新策略，无需再做 capability 检查：

```ts
const sandbox = await environment.open();
await sandbox.setNetworkPolicy("deny-all");
return sandbox;
```

## Live sandbox 选项

`open()` 还接受 Vercel 算力资源、timeout 与 Drive mounts。项目凭证与自定义 fetch 配在 environment 上，**不要**放进 `open()`——因为 resume 不会重建 start-only 选项。

在 `defineSandbox()` 里直接初始化返回的 sandbox。若初始化失败，eve 会删掉刚启动的 sandbox，并在下次访问重试选择器。初始化成功后，provider 只持久化不可变、JSON 兼容的状态。若之后具名 Vercel Sandbox 消失，resume 会失败，而不是重放初始化副作用。

持久 sandbox 身份与 prepared snapshot 来源由 eve 拥有。

详解见 [沙盒概览](./index)。
