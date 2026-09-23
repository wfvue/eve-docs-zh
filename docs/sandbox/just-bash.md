---
title: "just-bash Sandbox"
description: "纯 JavaScript shell 与虚拟文件系统。"
---

# just-bash Sandbox

官方原文：[just-bash Sandbox](https://eve.dev/docs/sandbox/just-bash)。

`JustBashSandbox.environment()` 提供 shell 与文件系统，**不**启动容器或 VM。

```ts
import { defineSandbox } from "eve/sandbox";
import { JustBashSandbox } from "eve/sandbox/just-bash";

export const environment = JustBashSandbox.environment();
export default defineSandbox(() => environment.open());
```

just-bash 可以 prepare 并持久化其虚拟文件系统。它不能用 OCI 镜像或 Dockerfile，不跑原生进程，也不提供网络隔离。session **不**暴露 `setNetworkPolicy()`。

## 自动安装

`eve dev` 里若有 environment 使用 just-bash，且包缺失，eve 会装进你的应用——除非在 environment 选项里设 `autoInstall: false`。`DefaultSandbox` 只会选一个 provider，但别的 environment（例如本地 self-modification）仍可独立用 just-bash。其它 environment 需你自行安装依赖。

对 pnpm 项目，自动安装会在所属 `pnpm-workspace.yaml` 的 `ignoredOptionalDependencies` 里加入 `@mongodb-js/zstd` 与 `node-liblzma`（若尚无显式 package policy）。基础 shell / 文件系统不需要这些可选原生编解码；缺了它们，依赖这些编解码的命令可能不可用。eve 会保留已有的 package-specific build 决定，**不会**自动批准 build scripts。

详解见 [沙盒概览](./index)。
