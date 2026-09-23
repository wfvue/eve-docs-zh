---
title: "Docker Sandbox"
description: "用镜像或 Dockerfile 创建本地持久容器。"
---

# Docker Sandbox

官方原文：[Docker Sandbox](https://eve.dev/docs/sandbox/docker)。

Docker environment 可用 eve 默认镜像、已有 OCI 镜像，或 `agent/sandbox/Dockerfile`。

```ts
import { defineSandbox } from "eve/sandbox";
import { DockerSandbox } from "eve/sandbox/docker";

export const environment = DockerSandbox.image("ghcr.io/acme/agent@sha256:...");

export default defineSandbox(() => environment.open({ networkPolicy: "deny-all" }));
```

默认镜像用 `DockerSandbox.environment()`；同目录 Dockerfile 约定用 `DockerSandbox.dockerfile()`。

## Environment 选项

镜像、pull policy、环境变量与 `prepare` 属于可复用 environment。prepare 时 eve 会起临时容器、灌入 managed resources、跑 authored preparation，并把结果 commit 成记录的 template image。

## Live 容器选项

把 `networkPolicy` 传给 `open()`。Docker 只支持 `"allow-all"` 与 `"deny-all"`。策略作用在**活容器**上，不是 prepared image。

session 拥有的容器把可写 `/workspace` 状态保存在容器文件系统里；停止后再启动仍带着该状态。

managed workspace、skills、父级继承与自定义 provider 见 [沙盒概览](./index)。
