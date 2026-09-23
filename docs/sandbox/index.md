---
title: "沙盒（Sandbox）"
description: "配置 eve Agent 使用的隔离文件系统与命令环境。"
---

# 沙盒（Sandbox）

官方原文：[Sandbox](https://eve.dev/docs/sandbox)。

> **官方说明：** Eve 目前为 **beta**。每个 eve Agent 恰好有一个根在 `/workspace` 的 sandbox。内置 `bash`、`read_file`、`write_file` 工具都瞄准它。若未编写 sandbox 文件，eve 会按当前环境自动选择可用的 provider。

## 使用 sandbox

编写的工具与回调通过 `ctx.getSandbox()` 拿到活着的 sandbox：

```ts title="agent/tools/run_analysis.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Run a Python script.",
  inputSchema: z.object({ script: z.string() }),
  async execute({ script }, ctx) {
    const sandbox = await ctx.getSandbox();
    await sandbox.writeTextFile({ path: "analysis.py", content: script });
    const result = await sandbox.run({ command: "python analysis.py" });
    if (result.exitCode !== 0) throw new Error(result.stderr);
    return result.stdout;
  },
});
```

相对路径解析到 `/workspace` 下。`run()` 返回 `{ exitCode, stdout, stderr }`；非零退出码**不会**自动抛错。长运行进程用 `spawn()`。

## 定义 environment

sandbox 模块导出 environment，并在 `defineSandbox()` 里返回 sandbox：

```ts title="agent/sandbox.ts"
import { DefaultSandbox, defineSandbox } from "eve/sandbox";

export const environment = DefaultSandbox.environment();
export default defineSandbox(() => environment.open());
```

`environment.open()` 启动当前 eve session 拥有的持久 sandbox。`defineSandbox()` 的选择器会一直跑到初始化成功，然后 eve checkpoint 所选 provider 及其状态。之后的 workflow step 与进程重启直接调用 provider 的 `resume()`，**不会**再跑选择器或 `environment.open()`。

把活 sandbox 的选项传给 `open()`，再在返回前配置返回的 sandbox。这段初始化对成功启动的 durable sandbox **只跑一次**：

```ts
import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";

export const environment = VercelSandbox.environment();

export default defineSandbox(async ({ session }) => {
  const sandbox = await environment.open({ networkPolicy: "deny-all" });
  await sandbox.writeTextFile({ path: ".eve/session", content: session.id });
  return sandbox;
});
```

必须导出 environment：因为 `eve build` 会在 session 还不存在时准备不可变的 environment 输入。

### 准备可复用的 environment

用 environment 的 `prepare` 选项做「每个新 sandbox 都会继承」的安装：

```ts
import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";

export const environment = VercelSandbox.environment({
  prepare: async (sandbox) => {
    const result = await sandbox.run({
      command: "sudo apt-get update && sudo apt-get install -y jq",
    });
    if (result.exitCode !== 0) throw new Error(result.stderr);
  },
});

export default defineSandbox(() => environment.open());
```

eve 在创建**可复用的 provider artifact** 时跑 `prepare`，不是每个活 session sandbox 各跑一次。Vercel 捕获 snapshot；Docker 捕获 image；microsandbox 捕获 VM snapshot；just-bash 捕获文件系统模板。

`eve dev` 期间，启动与 authored-source 重建**不会**立刻 prepare sandbox environment。第一次访问 sandbox 时，会先 prepare 该编译代际里的全部 environment，再打开请求的 sandbox——包括子智能体与 extension 声明的、哪怕 provider 不同的 environment。并发请求共享这次准备；失败的 prepare 可在下次访问重试。可选的 provider 安装 / setup 可能让「第一次访问」变慢。

`eve build` 仍会 eagerly prepare。生产环境里，eve 创建活 sandbox 时直接把记录的 artifact 交给 provider。生产 runtime **不会**重建或修复缺失的 artifact；缺 image / snapshot / template 会失败，并给出 rebuild / redeploy 指引。

### 跨 session 复用原生资源

内置 environment **不**暴露跨 session 共享。若要在多个 eve session 间复用原生计算或存储，请自定义 provider：返回 session 拥有的逻辑 sandbox 视图，并把共享资源放在该视图的 `stop` / `shutdown` / `delete` 之外。仅靠「按 session 分路径」**不是**隔离边界；互不信任的 session 需要分开的原生计算，或更强的 provider 侧隔离。

### 共享父级 sandbox

声明式子智能体可以显式使用派发它的父级 sandbox：

```ts title="agent/subagents/reviewer/sandbox.ts"
import { defineParentSandbox } from "eve/sandbox";

export default defineParentSandbox();
```

继承父级 sandbox 的子智能体**不能**再声明自己的 managed workspace 或 skill 文件。

## Managed workspace 与 skills

用 sandbox 目录放 authored workspace 种子：

```text
agent/sandbox/
  sandbox.ts
  workspace/
    schema.sql
```

`agent/sandbox/workspace/` 下的文件会播种可写的 `/workspace`。eve 在 prepare **新 environment 代际**时复制种子；已有活 sandbox 的状态**不会**被后续种子改动覆盖。

Agent skills 编译进单独的资源树，暴露在 `$HOME/.agents/skills`。这些路径在每个内置 provider 上都稳定，所以 instructions / tools 应写 `/workspace` 与 `$HOME/.agents/skills`，**不要**写死具体 home 目录或 provider 内部的 `/eve/resources`。

Provider 会带着显式 metadata 收到两棵树（`SandboxProviderResources` / `SandboxProviderResourceTree`）。Docker 与 microsandbox 把编译树只读挂到 `/eve/resources`，把 workspace 种子拷进可写 `/workspace`，并尽量只读暴露 skills。Vercel 的 snapshot environment 在捕获 snapshot 前写入 workspace 与 skill 内容。自定义 provider 自行决定 upload / mount / write，但必须在 authored `prepare` 跑之前暴露最终目标路径。

## 自定义 provider

用 `eve/sandbox/provider` 的 `defineSandboxProvider()` 定义 provider。五个泛型参数分别描述：environment 选项、live 选项、prepared artifact、最小可序列化 session 状态、以及 provider 特定的 sandbox session 类型。`prepare()` 返回完整可 JSON 序列化的 artifact；core 对新 durable sandbox session 调用一次 `start()` 并持久化最小 JSON 兼容状态；进程重启用当前 context、该状态与目标部署的**精确** artifact 调用 `resume()`。Handle 实现 `onSessionStop()`、`onRuntimeShutdown()`、`onSessionDelete()`。

`open()` 的选项属于 `start()`，**不会**序列化，也**不会**传给 `resume()`。provider 必须把重连所需的、由选项派生的不可变数据放进 session 状态。按当前 immutable-state 约定，`resume()` 重连已有原生状态；状态没了就失败，而不是重放 callback 副作用。自定义 provider 可以定义 start-only 回调字段；内置 provider 则在 `defineSandbox()` 里于 `open()` 之后初始化 sandbox。

准备阶段通过 `ctx.files` 发现 authored 文件；core 对项目布局与 artifact 存储 key 保密。把 provider SDK 值留在 provider 内部。`environment.open()` 保留 provider 的 sandbox capability 类型；异构 runtime registry 会把它擦成 eve 的公共 session 表面。

## Providers

| Provider | 适合做什么 |
| --- | --- |
| [Default](./default) | 自动选择 provider，沿用 eve 标准行为 |
| [Vercel](./vercel) | 基于 snapshot 的持久 Vercel Sandbox、域名网络策略、Drive mounts |
| [Docker](./docker) | 本地容器：默认镜像、已有 OCI 镜像或 Dockerfile |
| [microsandbox](./microsandbox) | 本地轻量 VM：OCI 镜像或 Dockerfile |
| [just-bash](./just-bash) | 纯 JS shell + 虚拟文件系统，无原生进程隔离 |

## 生命周期

session 拥有的 sandbox 在 provider 状态仍可用时，跨 turn 与部署保持存活。`sandbox.stop()` 停计算但不删持久状态；之后再访问会直接 resume。`sandbox.delete()` 清掉 provider 状态，下次 `ctx.getSandbox()` 会重跑选择器，并从当前 environment 开全新 sandbox。

改 sandbox 源码、preparation、Dockerfile、environment 选项、workspace 资源或 skills，会产生新的 environment 代际。已有 durable session 保留其记录的 sandbox 状态；新 session 用当前代际。

## 接下来读什么

- [子智能体（Subagents）](../subagents)：委派与 sandbox 所有权
- [安全模型](../concepts/security-model)：应用 runtime 与 sandbox 信任边界
- [Vercel Sandbox](https://vercel.com/docs/sandbox)：托管 sandbox 行为
