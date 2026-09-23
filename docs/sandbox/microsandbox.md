---
title: "microsandbox"
description: "用 OCI 镜像或 Dockerfile 创建本地轻量 VM。"
---

# microsandbox

官方原文：[microsandbox](https://eve.dev/docs/sandbox/microsandbox)。

microsandbox environment 可用 eve 默认镜像、已有 OCI 镜像，或 `agent/sandbox/Dockerfile`。

```ts
import { defineSandbox } from "eve/sandbox";
import { MicrosandboxSandbox } from "eve/sandbox/microsandbox";

export const environment = MicrosandboxSandbox.dockerfile({
  setup: { autoInstall: false },
});

export default defineSandbox(() => environment.open({ networkPolicy: "deny-all" }));
```

支持的主机：Apple Silicon 上的 macOS，以及带 glibc + KVM 的 Linux。

## Environment 选项

镜像、CPU、内存、pull policy、环境变量、VM setup 与 `prepare` 属于可复用 environment。`eve build` 在有 Dockerfile 时会构建镜像、准备 VM，并记录 snapshot 与 image 引用。

## Live VM 选项

把 `networkPolicy` 传给 `open()`。策略作用在**活 VM**上，不是 prepared snapshot。microsandbox 接受域名策略与 credential transforms。

创建 session 时直接使用记录的 snapshot 与 image。可写 VM 状态随 provider 的 session snapshot 生命周期持久化。

详解见 [沙盒概览](./index)。
