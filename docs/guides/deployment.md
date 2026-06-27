---
title: "部署（Deployment）"
description: "把 Eve Agent 发布到 Vercel 或自有主机的生产检查清单，覆盖构建产物、环境变量、沙盒后端、鉴权、部署和验证。"
---

# 部署（Deployment）

Eve 在本地、Vercel 和长期运行的 Node 主机上使用同一套运行模型。因此，把一个 Agent 从 `eve dev` 推到生产环境，大多数工作是按顺序完成构建、配置、部署和验证。

## 1. 构建（Build）

`eve build` 会编译 Agent，并写出宿主环境需要的运行产物：

```bash
eve build
```

当环境变量 `VERCEL` 存在时，所有 Vercel hosted build 都会设置它，`eve build` 会把 [Vercel Build Output](https://vercel.com/docs/build-output-api) 写到 `.vercel/output`。普通本地 `eve build` 不会写这个 bundle。无论哪种情况，都会在 `.eve/` 下生成 Eve 的编译产物，包括 discovery manifest、compiled manifest、diagnostics 和 module map。排查部署会加载哪些 authored surface 时，优先看这些产物。构建 artifact 和失败排查见 [可观测性（instrumentation.ts）](../instrumentation)。

### 可移植性如何工作（How portability works）

Nitro 是 Eve 的 HTTP host layer。它提供一个构建产物，让 health、session、stream、channel、callback 和 schedule routes 可以脱离 dev server 运行。Workflow 执行和 sandbox 执行是独立的 runtime adapters，不是隐藏在 Nitro 内部的 Vercel 依赖。

在 Vercel 上，Eve 会输出 Vercel Build Output，Workflow SDK 运行在 Vercel Workflow 上，`defaultBackend()` 会选择 Vercel Sandbox。在 Vercel 之外，`eve start` 会服务标准 Nitro Node output，Workflow SDK 默认使用本地 world，`defaultBackend()` 会按可用性选择本地 sandbox backend。本地 workflow world 会把 run state 持久化到磁盘，和 Vercel 没有直接耦合；latest-deployment routing、dashboard run attributes 这类 Vercel-only 行为只是额外能力。

高级自托管部署可以在根 `agent.ts` 中选择另一个已安装的 Workflow world package：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-opus-4.8",
  experimental: {
    workflow: {
      world: "@acme/eve-workflow-world",
    },
  },
});
```

World package 应该从运行时环境变量读取凭据和 host-specific options，并导出 default factory 或 `createWorld()` function。底层 SDK 抽象见 [Workflow Worlds](https://workflow-sdk.dev/worlds)。

## 2. 环境变量和密钥（Environment variables and secrets）

这些配置应该放在部署环境或 secret manager 中，不能写进源码或编译产物：

- **模型凭据（model credential）**。Vercel 上最低配置成本的方式是 Vercel AI Gateway。链接 Vercel project 后，`anthropic/claude-opus-4.8` 这类 Gateway model id 可以通过 Vercel OIDC 鉴权，不需要维护 provider keys。Vercel 之外，可以为 Gateway 路由模型设置 `AI_GATEWAY_API_KEY`，或使用 [AI SDK provider package](https://ai-sdk.dev/docs/foundations/providers-and-models) 配置直接 provider model，并设置对应 provider key，例如 `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY`。
- **Route-auth secrets**，例如 `ROUTE_AUTH_BASIC_PASSWORD`，以及 channel `auth` 使用到的 JWT/OIDC signing keys。见 [鉴权与路由保护（Auth and route protection）](../auth-and-route-protection)。

Route-auth secrets 不会被序列化到 compiled discovery 或 module-map artifacts。Runtime 会从 authored channel definition 重新 materialize 它们。如果部署启用了 Vercel preview protection，而你想用 `eve dev` 驱动它，请在本地启动前设置 `VERCEL_AUTOMATION_BYPASS_SECRET`。

## 3. 模型路由（Model routing）

`agent/agent.ts` 里的 `model` 形状决定 Eve 是调用 Vercel AI Gateway，还是直接调用 provider endpoint。

字符串 model id 会走 Gateway：

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-opus-4.8",
});
```

这在 Vercel 上可以用 project OIDC 鉴权，在其它环境里可以用 `AI_GATEWAY_API_KEY`。即使通过 `modelOptions.providerOptions.gateway.byok` 传入 provider key，请求仍然会经过 Gateway，只是 Gateway 使用的 upstream key 发生变化。

如果完全绕过 Gateway，请安装目标 provider 的 [AI SDK package](https://ai-sdk.dev/docs/foundations/providers-and-models)，传入 provider 的 model object，并设置该 provider 的常规环境变量：

```bash
npm install @ai-sdk/anthropic
```

```ts title="agent/agent.ts"
import { anthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

export default defineAgent({
  model: anthropic("claude-opus-4-8"),
});
```

这种形状会直接调用 Anthropic，runtime 读取 `ANTHROPIC_API_KEY`。直接 Anthropic model id 使用连字符，例如 `claude-opus-4-8`，和 Gateway 的 dotted id `anthropic/claude-opus-4.8` 不同。OpenAI 也一样：安装 `@ai-sdk/openai`，使用 `openai("...")`，并设置 `OPENAI_API_KEY`。这是无 Vercel-managed services 自部署时的常见选择。

## 4. 沙盒后端（Sandbox backend）

在 Vercel 上，[沙盒（Sandbox）](../../sandbox) 运行在托管的 [Vercel Sandbox](https://vercel.com/docs/sandbox) 基础设施上。可以在 sandbox definition 上附加 backend：

```ts title="agent/sandbox/sandbox.ts"
import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

export default defineSandbox({
  backend: vercel(),
});
```

如果不写 `backend`，Eve 会回退到 `defaultBackend()`：hosted build 选择 Vercel backend，其它环境选择本地 backend。一个定义可以同时覆盖两种环境。

自部署进程应保留 `defaultBackend()`，或显式选择 Docker、microsandbox 等非 Vercel backend。如果这些都不符合你的基础设施，可以编写自定义 `SandboxBackend` adapter，在自己的容器、虚拟机或隔离服务中创建 sessions。除非该进程确实要创建托管 Vercel sandboxes，否则不要固定使用 `vercel()`。

## 5. 构建时沙盒预热（Build-time sandbox prewarm）

Hosted builds 期间，Eve 会预热可复用的 Vercel sandbox templates，避免第一次 session 承担冷启动成本：

- 只有同时存在 `VERCEL` 和 `VERCEL_DEPLOYMENT_ID` 时才会预热。
- 没有 `bootstrap()`、也没有 workspace seed files 的 sandbox 会被跳过。
- 只有 seed 的模板会按 skills 和 workspace 文件内容生成 key，内容不变就会跨 deploy 复用。
- 带 `bootstrap()` 的模板会把可选 `revalidationKey()`、authored sandbox source 和 seed contents 一起纳入 key。
- 每个模板会在 build log 里显示为 `reused cached` 或 `built`。
- 预热只覆盖模板构建。`onSession()` 仍然会在 runtime 中对每个 session 执行一次。
- **构建时预热失败会导致 build 失败。**

如果设置了 `VERCEL` 但缺少 `VERCEL_DEPLOYMENT_ID`，Eve 会警告跳过预热。不要用 `vercel deploy --prebuilt` 部署这种 build，因为它的输出可能引用从未 provision 的 sandbox templates。应该运行 `vercel deploy`，让 Vercel 在 hosted build environment 中从源码构建。

## 6. 鉴权（Auth）

在第一个生产浏览器请求到达之前，把 scaffold 里的 `placeholderAuth()` 换成真实策略。Framework default 和 placeholder 都会拒绝生产浏览器流量，所以未配置应用会 fail closed，而不是开放路由。生产策略可以是内置 helper（`httpBasic()`、`jwtHmac()`、`jwtEcdsa()`、`oidc()`、`vercelOidc()`），也可以是验证你自己 session、API key 或 identity provider 的自定义 `AuthFn`。按顺序执行的 auth walk 和 fail-closed 保证见 [鉴权与路由保护（Auth and route protection）](../auth-and-route-protection)。

如果在 Vercel 之外自部署，不要把 `vercelOidc()` 当作唯一的生产 authenticator。请使用自己的 route policy，例如 Basic auth、JWT/OIDC verification，或自定义 verifier。

## 7. 在 Vercel 上部署（Deploy on Vercel）

可以通过 [Vercel CLI](https://vercel.com/docs/cli) 部署，也可以推送到 Git-connected project：

```bash
vercel deploy
```

部署后的应用会服务你本地访问过的同一组稳定 health、session 和 stream routes。

## 8. 不使用 Vercel 部署（Deploy without Vercel）

Eve 也可以作为普通 Node service 运行在你自己的 process manager、container platform 或 reverse proxy 后面：

```bash
eve build
PORT=3000 eve start --host 0.0.0.0
```

Eve 会把标准 Nitro output 写到 `.output/`，而不是 Vercel Build Output。`eve start` 会服务该 built app，并尊重 `PORT` 或 `--port`。TLS、routing、autoscaling 和 log collection 按普通 Node HTTP service 的方式放在进程外即可。

自部署 Agent 应明确做出 Vercel-specific 选择：

- 让 Workflow SDK 使用默认 local world，把 workflow state 存在 `.workflow-data`，并让主机把该目录放在持久化存储上；或在根 `agent.ts` 通过 `experimental.workflow.world` 选择其它 world。自定义 world 要和当前 Eve release 使用同一条 `@workflow/*` 版本线。当前是 `5.0.0-beta` 线，建议显式 pin，例如 `pnpm add @workflow/world-postgres@5.0.0-beta.x`。版本不匹配可能在 run replay 时抛 `ZodError: invalid_union`。
- 如果在 Eve 前面放 reverse proxy 或 ingress，必须同时转发 **`/eve/`** 和 **`/.well-known/workflow/`**。Workflow world 会把 run callbacks 发到 `/.well-known/workflow/v1/flow`；只代理 `/eve/` 会让 sessions 能启动，但 runs 会静默卡住。
- 想完全不依赖 Gateway 时，安装 provider 的 AI SDK package，并使用 direct provider model object 和 `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`。
- 如果仍然想从非 Vercel host 走 Gateway，设置 `AI_GATEWAY_API_KEY`。
- 把 `vercelOidc()` 换成你的 host 能验证的 auth。
- 使用 `defaultBackend()`、固定的非 Vercel sandbox backend（Docker 或 microsandbox），或你自己的 `SandboxBackend` adapter。
- 如果 Agent 定义了 schedules，默认 `eve build && eve start` 路径会启动 Nitro 的 schedule runner，Vercel 会自动把 schedules 接到 Vercel Cron。如果你把输出适配到自定义 HTTP-only host 或 preset，要确保它也运行 Nitro scheduled tasks，或由自己的 scheduler 触发同一工作。
- 把 Vercel Cron、Vercel Sandbox prewarm、Vercel Deployment Protection bypass 和 Agent Runs dashboard 视为 Vercel-only 便利能力。

HTTP contract 不变：health、session creation、streaming、channels、tools 和 subagents 都使用 `/eve/` 下的 routes，workflow dispatch route 位于 `/.well-known/workflow/`。Reverse proxy 必须保留两个前缀。任何能访问并鉴权这些 routes 的 client 都可以和 Agent 通信。

## 9. 验证部署（Verify the deployment）

先对 live routes 做 smoke test。先测 health：

```bash
curl https://<your-app>/eve/v1/health
```

再发一个真实 turn：

```bash
curl -X POST https://<your-app>/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"Hello from production"}'
```

POST 会返回 JSON，里面的 `sessionId` 标识新 session。然后用它连接该 session 的 stream：

```bash
curl https://<your-app>/eve/v1/session/<sessionId>/stream
```

也可以用 dev TUI 交互式驱动部署目标，适合 preview 和 production 冒烟测试：

```bash
eve dev https://<your-app>
```

如果部署使用 preview protection，请先在本地设置 `VERCEL_AUTOMATION_BYPASS_SECRET`。

## 在仪表盘查看运行（View runs in the dashboard）

Agent 部署后，平台会自动识别 `eve` framework，并在 Vercel dashboard 中项目 **Observability** 视图下显示 **Agent Runs** tab。你可以在那里浏览 sessions，并进入每段对话的 trace。

> Agent Runs tab 目前按团队开启。如果看不到，需要联系你的 Vercel 联系人启用。

Agent Runs 和 [可观测性（instrumentation.ts）](../instrumentation) 里配置的 OpenTelemetry exporters 是两套东西。后者仍然可用，并且是把 spans 发到 Braintrust、Datadog 或其它第三方 backend 的推荐方式。

## Eve 如何位于宿主框架之后（How eve sits behind a host framework）

你可以单独部署 Eve app，也可以把它挂载到拥有其它站点部分的宿主 Web framework 中，例如 marketing pages、dashboard、其它 API routes。宿主保留自己的 routing，并通过 framework integration 服务 Eve routes。两种方式下，Agent surface 和 HTTP contract 都一致。Next.js 的 `withEve` 以及其它支持框架见 [前端集成（Frontend）](../frontend/nextjs)。

## 检查清单（Checklist）

- [ ] `eve build` 成功；当 `VERCEL` 存在时写出 `.vercel/output`。
- [ ] Provider keys 和 route-auth secrets 已设置在部署环境。
- [ ] Sandbox backend 匹配环境：`vercel()` 或 `defaultBackend()`。
- [ ] 在 Vercel 上，build-time prewarm 成功 reused 或 built templates。
- [ ] `placeholderAuth()` 已替换成真实策略。
- [ ] `vercel deploy` 成功，或自托管进程可以通过 `eve start` 启动。
- [ ] Health、session 和 stream routes 在部署 URL 上可响应。

## 接下来读什么（What to read next）

- [鉴权与路由保护（Auth and route protection）](../auth-and-route-protection)：保护你刚部署的 routes
- [可观测性（instrumentation.ts）](../instrumentation)：tracing、run tags 和常见失败
- [沙盒（Sandbox）](../../sandbox)：backends、lifecycle 和 credential brokering
