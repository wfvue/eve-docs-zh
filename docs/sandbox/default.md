---
title: "Default Sandbox"
description: "让 eve 为当前环境自动选择 sandbox provider。"
---

# Default Sandbox

官方原文：[Default Sandbox](https://eve.dev/docs/sandbox/default)。

`DefaultSandbox.environment()` 保留 eve 的标准行为，且**不**暴露 provider 特定的 live 创建选项。

```ts
import { DefaultSandbox, defineSandbox } from "eve/sandbox";

export const environment = DefaultSandbox.environment();
export default defineSandbox(() => environment.open());
```

在 Vercel 上会选 [Vercel Sandbox](./vercel)。其它环境按主机支持顺序尝试 [Docker](./docker)、[microsandbox](./microsandbox)、[just-bash](./just-bash)。

需要某 provider 的镜像、VM、网络、算力或 mount 选项时，直接用该 provider。
